"""
Pipeline del motore di eventi (docs/PROGETTAZIONE.md sezione 6, task E2.2).
Legge i CSV Ergast tramite `app/events/` e scrive, accanto ai JSON già
prodotti da `build_all.py` (che questo script NON tocca e NON sovrascrive):

- public/data/events/index.json — il catalogo: una voce per ogni
  combinazione (evento, parametri), con rarità, finestra, siccità
  corrente e peso editoriale. Alimenta la home e il compositore.
- public/data/events/<eventId>.json — un file per evento: le occorrenze
  complete per ogni combinazione di parametri, più le serie per stagione
  e per circuito (conteggio e tasso). Se supera i 300 KB, le occorrenze
  vengono troncate al solo raceId (anno e circuito si risalgono da
  races-index.json, che è già la fonte canonica raceId -> anno/circuito:
  non è dato perso, è solo tolta una ridondanza) e lo script lo segnala
  nel riepilogo finale.
- public/data/facts/<anno>-<circuitRef>.json — per ognuna delle 1125 gare,
  i fatti notevoli (docs/PROGETTAZIONE.md sezione 5.4) già ordinati.
- public/data/races-index.json — le 1125 gare per il selettore (Indy 500
  incluse con il flag isIndy500: e' un indice di navigazione, non un
  denominatore di un evento, quindi non applica la trappola 1).
- public/data/params.json — esteso con i pesi di notevolezza e le regole
  delle trappole di sezione 5.6, SENZA toccare le chiavi già scritte da
  build_all.py (che /methodology legge già).

Uso (dalla cartella data-layer, con l'ambiente virtuale attivo):
    python scripts/build_events.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
REPO_ROOT = DATA_LAYER_DIR.parent
PUBLIC_DATA_DIR = REPO_ROOT / "public" / "data"
EVENTS_DIR = PUBLIC_DATA_DIR / "events"
FACTS_DIR = PUBLIC_DATA_DIR / "facts"
PARAMS_PATH = PUBLIC_DATA_DIR / "params.json"
RACES_INDEX_PATH = PUBLIC_DATA_DIR / "races-index.json"
RESULTS_PLANE_PATH = PUBLIC_DATA_DIR / "results-plane.json"

BUDGET_BYTES = 300 * 1024

sys.path.insert(0, str(DATA_LAYER_DIR))

from app.events import catalog  # noqa: E402,F401 (registra gli eventi)
from app.events.engine import evaluate, occurrences  # noqa: E402
from app.events.loader import Dataset, Race, Result, load_dataset  # noqa: E402
from app.events.metrics import (  # noqa: E402
    occorrenze_e_tasso_per_circuito,
    occorrenze_per_stagione,
    siccita_corrente,
)
from app.events.notability import (  # noqa: E402
    PESO_EDITORIALE,
    PESO_RARITA,
    PESO_SICCITA,
    facts_for_race,
)
from app.events.registry import EventDefinition, all_events, parameter_combinations  # noqa: E402


# ---------------------------------------------------------------------------
# Serializzazione delle occorrenze (payload eterogenei: Result singolo,
# coppie, liste di Result, numeri, booleani)
# ---------------------------------------------------------------------------

def _descrivi_payload(payload: Any) -> Dict[str, Any]:
    if isinstance(payload, Result):
        return {"driverId": payload.driver_id, "constructorId": payload.constructor_id}

    if isinstance(payload, tuple) and len(payload) == 2 and all(isinstance(x, Result) for x in payload):
        p1, p2 = payload
        descrizione: Dict[str, Any] = {
            "driverId1": p1.driver_id,
            "driverId2": p2.driver_id,
            "constructorId1": p1.constructor_id,
            "constructorId2": p2.constructor_id,
        }
        if p1.milliseconds is not None and p2.milliseconds is not None:
            descrizione["valoreSecondi"] = round((p2.milliseconds - p1.milliseconds) / 1000.0, 3)
        return descrizione

    if isinstance(payload, list) and payload and isinstance(payload[0], Result):
        return {
            "driverIds": [r.driver_id for r in payload],
            "constructorIds": sorted({r.constructor_id for r in payload}),
        }

    if isinstance(payload, bool):
        return {}

    if isinstance(payload, (int, float)):
        return {"valore": payload}

    if isinstance(payload, dict):
        # I pit stop e gli esiti della famiglia neutralizzazioni
        # (neutralizations.py): dict grezzi letti da public/data/
        # aggregate.json, non Result di loader.py. driverId lì è già una
        # stringa (Ergast driverId), non serve castarla.
        descrizione: Dict[str, Any] = {"driverId": payload.get("driverId")}
        for chiave in ("context", "category", "lap", "doubleStack", "effectiveLoss", "discount"):
            if chiave in payload:
                descrizione[chiave] = payload[chiave]
        # Gli esiti (outcomes[]) sono per pilota x NEUTRALIZZAZIONE, non per
        # pilota x gara: una gara con piu' SC/VSC produce piu' righe per lo
        # stesso pilota nella stessa gara (es. LOCKED_OUT in due finestre
        # diverse della stessa corsa). Senza questo campo le due righe
        # sembrano un duplicato invece di due eventi distinti.
        if "eventId" in payload:
            descrizione["neutralizzazione"] = payload["eventId"]
        return descrizione

    # Liste di (lap, driverId): gli eventi di comando in pista. Il dettaglio
    # per giro non serve al fatto (occupa spazio senza aggiungere
    # informazione utile a "dove e quando"), quindi non si include.
    return {}


def _occorrenza_completa(dataset: Dataset, observation) -> Dict[str, Any]:
    race: Race = observation.race
    record = {
        "raceId": race.race_id,
        "anno": race.year,
        "circuitRef": dataset.circuits[race.circuit_id].ref,
    }
    record.update(_descrivi_payload(observation.payload))
    return record


def _occorrenza_essenziale(dataset: Dataset, observation) -> Dict[str, Any]:
    """Usata solo quando il file dell'evento sfora i 300 KB anche con i
    campi completi: tiene raceId e, se il payload è un Result, anche
    driverId (pochi byte, il frontend lo risolve in un nome vero da
    drivers-index.json senza doverlo duplicare come stringa qui).
    constructorId resta fuori: su migliaia di righe (l'unico evento che
    arriva a questo troncamento, "ritiro per causa specifica", ne ha oltre
    6500) anche pochi byte a riga fanno tornare il file sopra i 300 KB.
    Anno e circuito si risalgono comunque da races-index.json (raceId ->
    anno/circuitRef), non servono duplicati su migliaia di righe."""
    record: Dict[str, Any] = {"raceId": observation.race.race_id}
    payload = observation.payload
    if isinstance(payload, Result):
        record["driverId"] = payload.driver_id
    return record


# ---------------------------------------------------------------------------
# public/data/events/index.json e <eventId>.json
# ---------------------------------------------------------------------------

def _costruisci_voce_indice(dataset: Dataset, event: EventDefinition, params: Dict[str, Any]) -> Dict[str, Any]:
    risultato = evaluate(dataset, event, **params)
    siccita = siccita_corrente(dataset, event, **params)
    return {
        "eventId": event.id,
        "nome": event.nome,
        "famiglia": event.famiglia,
        "unita": event.unita,
        "descrizione": event.descrizione,
        "parametri": params,
        "parametriDisponibili": {p.name: list(p.values) for p in event.parametri},
        "campi": event.campi,
        "annoDa": event.anno_da,
        "annoA": event.anno_a,
        "occorrenze": risultato.occorrenze,
        "denominatore": risultato.denominatore,
        "rarita": risultato.rarita,
        "siccitaGareCorrente": siccita.gare,
        "siccitaAnniCorrente": siccita.anni,
        "ultimaOccorrenza": risultato.ultima_occorrenza,
        "pesoEditoriale": event.peso_editoriale,
    }


def _costruisci_file_evento(dataset: Dataset, event: EventDefinition) -> Dict[str, Any]:
    per_parametro = []
    for params in parameter_combinations(event):
        risultato = evaluate(dataset, event, **params)
        occorse = occurrences(dataset, event, **params)
        per_stagione = occorrenze_per_stagione(dataset, event, **params)
        per_circuito = occorrenze_e_tasso_per_circuito(dataset, event, **params)

        per_parametro.append(
            {
                "parametri": params,
                "occorrenze": risultato.occorrenze,
                "denominatore": risultato.denominatore,
                "rarita": risultato.rarita,
                "ultimaOccorrenza": risultato.ultima_occorrenza,
                "occorrenzeDettaglio": [_occorrenza_completa(dataset, o) for o in occorse],
                "perStagione": {str(anno): n for anno, n in sorted(per_stagione.items())},
                "perCircuito": [
                    {
                        "circuitRef": dataset.circuits[c.circuit_id].ref,
                        "nome": c.nome_circuito,
                        "occorrenze": c.occorrenze,
                        "gareOspitate": c.gare_ospitate,
                        "tasso": round(c.tasso, 4),
                    }
                    for c in per_circuito
                    if c.occorrenze > 0
                ],
            }
        )

    return {
        "eventId": event.id,
        "nome": event.nome,
        "famiglia": event.famiglia,
        "unita": event.unita,
        "descrizione": event.descrizione,
        "campi": event.campi,
        "annoDa": event.anno_da,
        "annoA": event.anno_a,
        "pesoEditoriale": event.peso_editoriale,
        "parametriDisponibili": {p.name: list(p.values) for p in event.parametri},
        "perParametro": per_parametro,
    }


def _dimensione_json(obj: Any) -> int:
    return len(json.dumps(obj, ensure_ascii=False).encode("utf-8"))


def _tronca_ai_campi_essenziali(dataset: Dataset, event: EventDefinition, file_evento: Dict[str, Any]) -> None:
    for blocco_parametro in file_evento["perParametro"]:
        occorse = occurrences(dataset, event, **blocco_parametro["parametri"])
        blocco_parametro["occorrenzeDettaglio"] = [_occorrenza_essenziale(dataset, o) for o in occorse]


# ---------------------------------------------------------------------------
# public/data/facts/<anno>-<circuitRef>.json
# ---------------------------------------------------------------------------

def _costruisci_file_fatti(dataset: Dataset, race: Race) -> Dict[str, Any]:
    fatti = facts_for_race(dataset, race)
    return {
        "raceId": race.race_id,
        "anno": race.year,
        "circuitRef": dataset.circuits[race.circuit_id].ref,
        "nomeCircuito": dataset.circuits[race.circuit_id].name,
        "nomeGara": race.name,
        "fatti": [
            {
                "eventId": f.event.id,
                "nome": f.event.nome,
                "famiglia": f.event.famiglia,
                "parametri": f.parametri,
                "rarita": f.rarita,
                "siccitaGare": f.siccita_gare,
                "pesoEditoriale": f.peso_editoriale,
                "notevolezza": round(f.notevolezza, 4),
            }
            for f in fatti
        ],
    }


# ---------------------------------------------------------------------------
# public/data/races-index.json
# ---------------------------------------------------------------------------

def _costruisci_races_index(dataset: Dataset) -> List[Dict[str, Any]]:
    races = sorted(dataset.race_window(1950, 2024, include_indy500=True), key=lambda r: r.date)
    return [
        {
            "raceId": r.race_id,
            "anno": r.year,
            "round": r.round,
            "nomeGara": r.name,
            "data": r.date.isoformat(),
            "circuitRef": dataset.circuits[r.circuit_id].ref,
            "nomeCircuito": dataset.circuits[r.circuit_id].name,
            "isIndy500": r.is_indy500,
        }
        for r in races
    ]


# ---------------------------------------------------------------------------
# public/data/results-plane.json — vista 5, sezione 7 e 10 rischio 4:
# "26.759 risultati come nuvola densa (griglia x arrivo)". Struttura a
# colonne (array paralleli per indice), non un array di oggetti: un oggetto
# per risultato con le chiavi ripetute 26mila volte pesa 1.27 MB, le stesse
# colonne senza chiavi ripetute 355 KB — SOPRA il budget di 300 KB usato
# altrove. Deroga deliberata (chiesta e confermata): driverId serve a
# risolvere ESATTAMENTE quale risultato evidenziare per un evento
# RISULTATO/TEAM_GARA (grid=0 può comparire più volte nella stessa gara —
# partenza dalla corsia box, trappola 4 — quindi (raceId, grid) da solo non
# è una chiave sicura), e questo file non viene MAI spedito intero al
# client: solo il server lo legge (src/app/eventi/[eventId]/page.tsx),
# risolve i punti da evidenziare per l'evento corrente, e manda al browser
# solo {griglia, arrivo} (senza driverId, ~159 KB) più la manciata di punti
# evidenziati. anno e circuito NON sono duplicati: si risalgono da
# races-index.json via raceId. Indy 500 esclusa (trappola 1).
# ---------------------------------------------------------------------------

def _costruisci_results_plane(dataset: Dataset) -> Dict[str, List[Optional[int]]]:
    races = dataset.race_window(1950, 2024, include_indy500=False)
    griglia: List[Optional[int]] = []
    arrivo: List[Optional[int]] = []
    race_ids: List[int] = []
    driver_ids: List[int] = []
    for race in races:
        for res in dataset.results_by_race.get(race.race_id, []):
            griglia.append(res.grid)
            arrivo.append(res.position)
            race_ids.append(race.race_id)
            driver_ids.append(res.driver_id)
    return {"griglia": griglia, "arrivo": arrivo, "raceId": race_ids, "driverId": driver_ids}


# ---------------------------------------------------------------------------
# public/data/params.json — estensione additiva
# ---------------------------------------------------------------------------

def _estendi_params(dataset: Dataset) -> None:
    if PARAMS_PATH.exists():
        with open(PARAMS_PATH, encoding="utf-8") as f:
            params = json.load(f)
    else:
        params = {}

    tutti_i_risultati = [r for lista in dataset.results_by_race.values() for r in lista]
    numero_risultati = len(tutti_i_risultati)
    numero_indy500 = sum(1 for r in dataset.races.values() if r.is_indy500)
    numero_position_vuota = sum(1 for r in tutti_i_risultati if r.position is None)
    # "Did not qualify" (statusId 81) e' un solo statusId dentro la categoria
    # piu' ampia NON_QUALIFICATO (che include anche 107% Rule e Did not
    # prequalify): il numero citato in CATALOGO-EVENTI.md sezione 11 e'
    # specificamente questo statusId, non l'intera categoria.
    numero_did_not_qualify = sum(
        1
        for r in tutti_i_risultati
        if dataset.status_by_id[r.status_id].name == "Did not qualify"
    )

    params["eventi"] = {
        "pesiNotevolezza": {
            "rarita": PESO_RARITA,
            "siccita": PESO_SICCITA,
            "pesoEditoriale": PESO_EDITORIALE,
        },
        "trappole": {
            "indy500": {
                "descrizione": (
                    "Le gare a Indianapolis 1950-1960 erano la 500 Miglia, "
                    "valida per il mondiale ma non una gara di Formula 1: "
                    "escluse dalla finestra di ogni evento salvo dove "
                    "esplicitamente richiesto (es. races-index.json, che è "
                    "un indice di navigazione, non un denominatore)."
                ),
                "circuitRef": "indianapolis",
                "annoDa": 1950,
                "annoA": 1960,
                "numeroGare": numero_indy500,
            },
            "tassonomiaRitiri": {
                "descrizione": (
                    "Ogni statusId è mappato esplicitamente (non con "
                    "euristiche sulle stringhe) in una delle 5 categorie: "
                    "CLASSIFICATO, NON_QUALIFICATO, NON_PARTITO, "
                    "RITIRO_TECNICO, RITIRO_INCIDENTE."
                ),
                "categorie": [
                    "CLASSIFICATO",
                    "NON_QUALIFICATO",
                    "NON_PARTITO",
                    "RITIRO_TECNICO",
                    "RITIRO_INCIDENTE",
                ],
                "numeroDidNotQualify": numero_did_not_qualify,
            },
            "gridZero": {
                "descrizione": (
                    "grid == 0 non è la posizione zero: se il pilota ha "
                    "preso il via è una partenza dalla pit lane (categoria "
                    "a sé), altrimenti il pilota non è mai partito."
                ),
            },
            "campiVuoti": {
                "descrizione": (
                    "\\N nei CSV Ergast diventa None, mai 0: le unità con "
                    "un campo mancante escono dal denominatore dell'evento "
                    "invece di essere contate come 'non è successo'."
                ),
                "numeroRisultati": numero_risultati,
                "numeroPositionVuota": numero_position_vuota,
                "percentualePositionVuota": round(100 * numero_position_vuota / numero_risultati, 1),
            },
            "puntiNonComparabili": {
                "descrizione": (
                    "Il sistema di punteggio è cambiato più volte dal 1950: "
                    "i confronti in punti sono validi solo dentro la stessa "
                    "era, o vanno normalizzati, mai confrontati grezzi tra "
                    "epoche diverse."
                ),
            },
        },
    }

    with open(PARAMS_PATH, "w", encoding="utf-8") as f:
        json.dump(params, f, ensure_ascii=False, indent=2)
        f.write("\n")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> None:
    dataset = load_dataset()
    EVENTS_DIR.mkdir(parents=True, exist_ok=True)
    FACTS_DIR.mkdir(parents=True, exist_ok=True)

    eventi = all_events()

    # --- events/index.json e events/<eventId>.json ---
    indice: List[Dict[str, Any]] = []
    file_troncati: List[str] = []

    for event in eventi:
        for params in parameter_combinations(event):
            indice.append(_costruisci_voce_indice(dataset, event, params))

        file_evento = _costruisci_file_evento(dataset, event)
        dimensione = _dimensione_json(file_evento)
        if dimensione > BUDGET_BYTES:
            _tronca_ai_campi_essenziali(dataset, event, file_evento)
            file_troncati.append(event.id)

        with open(EVENTS_DIR / f"{event.id}.json", "w", encoding="utf-8") as f:
            json.dump(file_evento, f, ensure_ascii=False)

    with open(EVENTS_DIR / "index.json", "w", encoding="utf-8") as f:
        json.dump(indice, f, ensure_ascii=False, indent=2)

    # --- facts/<anno>-<circuitRef>.json ---
    # Nota: nel 2020 e nel 2021 alcuni circuiti hanno ospitato DUE gare nella
    # stessa stagione (calendario Covid): "<anno>-<circuitRef>.json" da solo
    # collide silenziosamente per quelle coppie (4 su 1125). Per la seconda
    # gara in poi con la stessa coppia si aggiunge "-r<round>" al nome file,
    # cosi' nessuna gara viene sovrascritta.
    races = sorted(dataset.race_window(1950, 2024, include_indy500=True), key=lambda r: r.date)
    gare_con_fatti = 0
    nomi_file_usati: Dict[str, int] = {}
    collisioni: List[str] = []
    for race in races:
        file_fatti = _costruisci_file_fatti(dataset, race)
        if file_fatti["fatti"]:
            gare_con_fatti += 1
        circuit_ref = dataset.circuits[race.circuit_id].ref
        nome_base = f"{race.year}-{circuit_ref}"
        if nome_base in nomi_file_usati:
            nomi_file_usati[nome_base] += 1
            nome_file = f"{nome_base}-r{race.round}"
            collisioni.append(f"{nome_base}.json -> {nome_file}.json (round {race.round})")
        else:
            nomi_file_usati[nome_base] = 1
            nome_file = nome_base
        with open(FACTS_DIR / f"{nome_file}.json", "w", encoding="utf-8") as f:
            json.dump(file_fatti, f, ensure_ascii=False)

    # --- races-index.json ---
    with open(RACES_INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(_costruisci_races_index(dataset), f, ensure_ascii=False, indent=2)

    # --- results-plane.json (vista 5) ---
    results_plane = _costruisci_results_plane(dataset)
    with open(RESULTS_PLANE_PATH, "w", encoding="utf-8") as f:
        json.dump(results_plane, f, ensure_ascii=False, separators=(",", ":"))

    # --- params.json (estensione additiva) ---
    _estendi_params(dataset)

    # --- riepilogo ---
    tutti_i_file = (
        list(EVENTS_DIR.glob("*.json"))
        + list(FACTS_DIR.glob("*.json"))
        + [RACES_INDEX_PATH, RESULTS_PLANE_PATH, PARAMS_PATH]
    )
    dimensioni = [(p, p.stat().st_size) for p in tutti_i_file]
    peso_totale = sum(size for _, size in dimensioni)
    top5 = sorted(dimensioni, key=lambda t: t[1], reverse=True)[:5]

    print(f"Eventi esportati: {len(eventi)} ({len(indice)} combinazioni evento+parametri)")
    print(f"Peso totale cartella (events/ + facts/ + races-index.json + params.json): {peso_totale / 1024:.1f} KB")
    print("File più pesanti:")
    for path, size in top5:
        print(f"  {path.relative_to(REPO_ROOT)}: {size / 1024:.1f} KB")
    print(f"Gare con almeno un fatto notevole: {gare_con_fatti} su {len(races)}")
    print(
        f"Risultati esportati per la vista 5 (results-plane.json): "
        f"{len(results_plane['griglia'])}, {RESULTS_PLANE_PATH.stat().st_size / 1024:.1f} KB"
    )
    if file_troncati:
        print(f"Eventi troncati ai campi essenziali (sopra i 300 KB): {', '.join(file_troncati)}")
    else:
        print("Nessun file evento ha superato i 300 KB.")
    if collisioni:
        print(f"Collisioni di nome file in facts/ risolte con '-r<round>' ({len(collisioni)}):")
        for c in collisioni:
            print(f"  {c}")


if __name__ == "__main__":
    main()
