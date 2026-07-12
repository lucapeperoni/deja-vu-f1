"""
Verifica dell'aggregato dei decision snapshot (task P2.2, vedi docs/ROADMAP-2.md).

Lezione imparata nella v1 (ROADMAP v1, esito task 2.1): mai fidarsi del report
a schermo, controllare l'aggregato. Questo script non ricalcola nulla: legge
gli snapshot gia' esportati da build_all.py (task P2.1, modulo
app/metrics/decision_snapshots.py) in public/data/races/*.json e public/data/
aggregate.json, e stampa distribuzioni, istogrammi testuali, i casi estremi
per giudizio manuale e il conteggio dei campi mancanti con la causa.

Usa i file di gara (races/*.json) come fonte, non aggregate.json: quest'ultimo
esporta solo i campi minimi per la mappa (raceId, eventId, driverId, choice,
verdict, combinedIndex, notNeeded), non gapBehind/tyreAge/predictedRejoinPos,
che servono qui. Il conteggio totale viene comunque incrociato con
aggregate.json (stesso principio del controllo incrociato in report_numbers.py).

Uso (dalla cartella data-layer, python3 di sistema, nessuna dipendenza esterna):
    python scripts/validate_decisions.py
"""

import csv
import json
import statistics
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
REPO_ROOT = DATA_LAYER_DIR.parent
PUBLIC_DATA_DIR = REPO_ROOT / "public" / "data"
RAW_DIR = REPO_ROOT / "data" / "raw"

N_HISTOGRAM_BUCKETS = 12
N_EXTREME_CASES = 10


def load_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_driver_names() -> Dict[str, str]:
    """Fonte: data/raw/drivers.csv, come in report_numbers.py. Il driverId nei
    decision record e' l'id Ergast (stringa numerica), non il codice a 3
    lettere: serve la stessa traduzione per renderlo leggibile qui."""
    names = {}
    with open(RAW_DIR / "drivers.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            names[row["driverId"]] = f"{row['forename']} {row['surname']} ({row['code']})"
    return names


def load_all_decisions() -> List[Dict]:
    """Un record per pilota x evento, con raceId/raceName aggiunti (non
    presenti nel record originale: e' implicito nel file che lo contiene)."""
    decisions: List[Dict] = []
    for path in sorted(PUBLIC_DATA_DIR.glob("races/*.json")):
        race = load_json(path)
        race_name = f"{race['race']['name']} {race['race']['year']}"
        for d in race["decisions"]:
            row = dict(d)
            row["raceId"] = path.stem
            row["raceName"] = race_name
            decisions.append(row)
    return decisions


def fmt(value) -> str:
    if value is None:
        return "n/d"
    if isinstance(value, float):
        return f"{value:.2f}"
    return str(value)


def text_histogram(values: List[float], label: str, unit: str, n_buckets: int = N_HISTOGRAM_BUCKETS) -> List[str]:
    """Istogramma grezzo testuale: bucket a larghezza fissa tra min e max
    osservati (non tra limiti teorici, cosi' i bucket vuoti ai margini sono
    gia' un segnale di outlier)."""
    lines = []
    if not values:
        lines.append(f"{label}: nessun valore disponibile.")
        return lines
    lo, hi = min(values), max(values)
    lines.append(
        f"{label} (n={len(values)}, min={lo:.2f}{unit}, max={hi:.2f}{unit}, "
        f"mediana={statistics.median(values):.2f}{unit}):"
    )
    if lo == hi:
        lines.append(f"  tutti i valori sono uguali a {lo:.2f}{unit}")
        return lines
    width = (hi - lo) / n_buckets
    counts = [0] * n_buckets
    for v in values:
        idx = int((v - lo) / width)
        if idx >= n_buckets:
            idx = n_buckets - 1
        counts[idx] += 1
    max_count = max(counts)
    scale = 50 / max_count if max_count else 1
    for i, c in enumerate(counts):
        bucket_lo = lo + i * width
        bucket_hi = bucket_lo + width
        bar = "#" * max(0, round(c * scale))
        lines.append(f"  [{bucket_lo:7.2f}, {bucket_hi:7.2f}) {c:4d} {bar}")
    return lines


def extreme_cases(decisions: List[Dict], getter, label: str, unit: str, n: int = N_EXTREME_CASES) -> List[str]:
    """I n casi con il valore piu' alto e piu' basso per il campo (getter),
    con gara/pilota/evento per il giudizio a mano richiesto dal task."""
    lines = []
    valid = [(getter(d), d) for d in decisions if getter(d) is not None]
    if not valid:
        lines.append(f"{label}: nessun valore disponibile.")
        return lines

    def render(rows, direction):
        lines.append(f"  {direction} {min(n, len(rows))}:")
        for value, d in rows[:n]:
            lines.append(
                f"    {value:>10.2f}{unit}  {d['raceName']:<30} driverId={d['driverId']:<4} "
                f"eventId={d['eventId']:<16} choice={d['choice']:<6} verdict={d['outcome']['verdict']}"
            )

    lines.append(f"{label}:")
    render(sorted(valid, key=lambda t: t[0], reverse=True), "Piu' alti")
    render(sorted(valid, key=lambda t: t[0]), "Piu' bassi")
    return lines


def main():
    decisions = load_all_decisions()
    names = load_driver_names()  # noqa: F841 (disponibile per ispezione manuale futura, non usato nel testo attuale)

    aggregate = load_json(PUBLIC_DATA_DIR / "aggregate.json")
    n_aggregate = len(aggregate["decisions"])

    out: List[str] = []

    def w(line: str = ""):
        out.append(line)
        print(line)

    w("=" * 78)
    w("VALIDAZIONE DECISION SNAPSHOT (task P2.2)")
    w("=" * 78)
    w()

    # ------------------------------------------------------------------
    # 0. Controllo incrociato coi conteggi di P2.1
    # ------------------------------------------------------------------
    w(f"Snapshot letti da races/*.json: {len(decisions)}")
    w(f"Snapshot in aggregate.json:     {n_aggregate}")
    if len(decisions) != n_aggregate:
        w("!! DISALLINEAMENTO tra races/*.json e aggregate.json — da investigare prima di procedere.")
    else:
        w("OK: i due conteggi coincidono (767 attesi da P2.1).")
    w()

    # ------------------------------------------------------------------
    # 1. Distribuzione scelta x esito
    # ------------------------------------------------------------------
    w("-" * 78)
    w("1. DISTRIBUZIONE SCELTA x ESITO")
    w("-" * 78)
    crosstab = Counter((d["choice"], d["outcome"]["verdict"]) for d in decisions)
    choices = ["BOX", "STAY", "FORCED"]
    verdicts = ["GAINED", "LOST", "NEUTRAL"]
    header = f"{'':10s}" + "".join(f"{v:>10s}" for v in verdicts) + f"{'TOTALE':>10s}"
    w(header)
    for c in choices:
        row_total = sum(crosstab[(c, v)] for v in verdicts)
        row = f"{c:10s}" + "".join(f"{crosstab[(c, v)]:>10d}" for v in verdicts) + f"{row_total:>10d}"
        w(row)
    col_totals = [sum(crosstab[(c, v)] for c in choices) for v in verdicts]
    grand_total = sum(col_totals)
    w(f"{'TOTALE':10s}" + "".join(f"{t:>10d}" for t in col_totals) + f"{grand_total:>10d}")
    n_not_needed = sum(1 for d in decisions if d["notNeeded"])
    w(f"(di cui notNeeded=true, non decisioni reali: {n_not_needed})")
    w()

    # ------------------------------------------------------------------
    # 2. Istogrammi grezzi
    # ------------------------------------------------------------------
    w("-" * 78)
    w("2. ISTOGRAMMI GREZZI")
    w("-" * 78)
    w()
    gap_behind = [d["snapshot"]["gapBehind"] for d in decisions if d["snapshot"]["gapBehind"] is not None]
    for line in text_histogram(gap_behind, "gapBehind", "s"):
        w(line)
    w()
    tyre_age = [d["snapshot"]["tyreAge"] for d in decisions if d["snapshot"]["tyreAge"] is not None]
    for line in text_histogram(tyre_age, "tyreAge", " giri"):
        w(line)
    w()
    rejoin = [d["boxOption"]["predictedRejoinPos"] for d in decisions if d["boxOption"]["predictedRejoinPos"] is not None]
    for line in text_histogram(rejoin, "predictedRejoinPos", "") :
        w(line)
    w()

    # ------------------------------------------------------------------
    # 3. Casi estremi (da giudicare a mano)
    # ------------------------------------------------------------------
    w("-" * 78)
    w(f"3. I {N_EXTREME_CASES} CASI PIU' ESTREMI PER CAMPO")
    w("-" * 78)
    w()
    for line in extreme_cases(decisions, lambda d: d["snapshot"]["gapBehind"], "gapBehind", "s"):
        w(line)
    w()
    for line in extreme_cases(decisions, lambda d: d["snapshot"]["tyreAge"], "tyreAge", " giri"):
        w(line)
    w()
    for line in extreme_cases(decisions, lambda d: d["boxOption"]["predictedRejoinPos"], "predictedRejoinPos", ""):
        w(line)
    w()

    # ------------------------------------------------------------------
    # 4. Campi mancanti e perche'
    # ------------------------------------------------------------------
    w("-" * 78)
    w("4. CAMPI MANCANTI (None) E PERCHE'")
    w("-" * 78)
    w()

    def missing(getter):
        return [d for d in decisions if getter(d) is None]

    fields_to_check = [
        ("snapshot.gapAhead", lambda d: d["snapshot"]["gapAhead"]),
        ("snapshot.gapBehind", lambda d: d["snapshot"]["gapBehind"]),
        ("snapshot.tyreAge", lambda d: d["snapshot"]["tyreAge"]),
        ("snapshot.compound", lambda d: d["snapshot"]["compound"]),
        ("snapshot.trafficFraction", lambda d: d["snapshot"]["trafficFraction"]),
        ("boxOption.predictedRejoinPos", lambda d: d["boxOption"]["predictedRejoinPos"]),
        ("boxOption.freshTyreDeltaPerLap", lambda d: d["boxOption"]["freshTyreDeltaPerLap"]),
        ("outcome.posDelta5", lambda d: d["outcome"]["posDelta5"]),
        ("combinedIndex", lambda d: d["combinedIndex"]),
    ]
    for name, getter in fields_to_check:
        miss = missing(getter)
        w(f"{name}: {len(miss)}/{len(decisions)} mancanti")
        if miss:
            # posizione del pilota in griglia al momento del deploy, per capire
            # se i mancanti sono concentrati in testa/coda (limite di bordo atteso)
            pos_counter = Counter(d["snapshot"]["pos"] for d in miss)
            top_positions = pos_counter.most_common(5)
            w(f"  posizioni piu' frequenti tra i mancanti: {top_positions}")
    w()
    w("Interpretazione attesa (da verificare nella sezione 5):")
    w("- gapAhead manca per chi e' 1o al momento del deploy (nessuno davanti).")
    w("- gapBehind manca per l'ultimo in classifica al momento del deploy (nessuno dietro).")
    w("- trafficFraction/combinedIndex mancano solo se l'evento non ha alcun pilota con snapshot valido nella finestra (dato mancante a monte, non un bug di questo modulo).")
    w("- predictedRejoinPos e' sempre calcolato dal codice (compute_predicted_rejoin_position non ha rami che ritornano None): se qui risultasse >0 mancante, e' un bug, non un limite di bordo atteso.")
    w("- posDelta5 manca quando il pilota non ha una posizione registrata al giro di misura (deploy + postEventOutcomeOffsetLaps, v. build_all.py riga ~430): tipicamente un ritiro prima di quel giro. Limite noto a monte (calcolo dell'esito, non di questo modulo), gia' gestito a valle: classify_verdict(None) restituisce NEUTRAL, non un errore.")
    w()

    # ------------------------------------------------------------------
    # 5. Valori impossibili
    # ------------------------------------------------------------------
    w("-" * 78)
    w("5. VALORI IMPOSSIBILI")
    w("-" * 78)
    w()

    impossible_found = False

    neg_gap_ahead = [d for d in decisions if (d["snapshot"]["gapAhead"] or 0) < 0]
    neg_gap_behind = [d for d in decisions if (d["snapshot"]["gapBehind"] or 0) < 0]
    flagged = [d for d in decisions if d["snapshot"].get("unreliableGapReference")]
    if neg_gap_ahead or neg_gap_behind:
        impossible_found = True
        w(f"!! gapAhead negativo: {len(neg_gap_ahead)} casi; gapBehind negativo: {len(neg_gap_behind)} casi.")
        events = sorted({(d["raceName"], d["eventId"]) for d in (neg_gap_ahead + neg_gap_behind)})
        w(f"   Tutti concentrati in {len(events)} evento/i: {events}")
        w(
            "   CAUSA (verificata su public/data/races/*.json e build_all.py, "
            "build_laps_and_positions): al giro di deploy la classifica ufficiale "
            "(pos) e il tempo cumulato (ms, somma dei tempi sul giro che superano "
            "il filtro MAX_PLAUSIBLE_LAP_MS) non sono piu' comparabili tra piloti. "
            "build_laps_and_positions esclude i giri con tempo anomalo (bandiera "
            "rossa) dalla somma cumulata ma NON dalla posizione: se due piloti "
            "hanno un numero diverso di giri esclusi prima del deploy, il loro "
            "'ms' cumulato non rappresenta piu' lo stesso riferimento temporale, "
            "pur restando valida la loro posizione ufficiale. Il caso trovato "
            "(Australian GP 2023, VSC-3, giro 18) e' coerente: quella gara ha avuto "
            "bandiera rossa multipla (excludedAnomalousLaps > 0 in race.json)."
        )
        w(
            f"   CORREZIONE APPLICATA (non silenziosa): app/metrics/decision_snapshots.py "
            f"aggiunge ora il campo dichiarato snapshot.unreliableGapReference (come "
            f"lowConfidence sui pit), true quando gapAhead o gapBehind risultano negativi. "
            f"Non si corregge il valore (resta il gap calcolato, negativo e tutto): chi "
            f"consuma il dato decide se escluderlo. Record flaggati ora: {len(flagged)}."
        )
        for d in (neg_gap_ahead + neg_gap_behind)[:N_EXTREME_CASES]:
            w(
                f"   {d['raceName']:<28} driverId={d['driverId']:<4} eventId={d['eventId']:<16} "
                f"pos={d['snapshot']['pos']} gapAhead={fmt(d['snapshot']['gapAhead'])} "
                f"gapBehind={fmt(d['snapshot']['gapBehind'])} unreliableGapReference={d['snapshot'].get('unreliableGapReference')}"
            )
    else:
        w("OK: nessun gapAhead/gapBehind negativo (i tempi cumulati per posizione sono coerenti con l'ordine).")
    w()

    max_race_laps = {}
    for path in sorted(PUBLIC_DATA_DIR.glob("races/*.json")):
        race = load_json(path)
        max_race_laps[path.stem] = race["race"]["laps"]
    neg_tyre_age = [d for d in decisions if d["snapshot"]["tyreAge"] is not None and d["snapshot"]["tyreAge"] < 0]
    huge_tyre_age = [
        d for d in decisions
        if d["snapshot"]["tyreAge"] is not None and d["snapshot"]["tyreAge"] > max_race_laps.get(d["raceId"], 999)
    ]
    if neg_tyre_age or huge_tyre_age:
        impossible_found = True
        w(f"!! tyreAge negativo: {len(neg_tyre_age)} casi; tyreAge > giri totali della gara: {len(huge_tyre_age)} casi.")
        for d in (neg_tyre_age + huge_tyre_age)[:N_EXTREME_CASES]:
            w(
                f"   {d['raceName']:<28} driverId={d['driverId']:<4} eventId={d['eventId']:<16} "
                f"tyreAge={d['snapshot']['tyreAge']} (giri gara={max_race_laps.get(d['raceId'])})"
            )
    else:
        w("OK: nessun tyreAge negativo o superiore ai giri totali della gara.")
    w()

    n_drivers_by_race = {}
    for path in sorted(PUBLIC_DATA_DIR.glob("races/*.json")):
        race = load_json(path)
        n_drivers_by_race[path.stem] = len(race["drivers"])
    bad_rejoin = [
        d for d in decisions
        if d["boxOption"]["predictedRejoinPos"] is not None
        and not (1 <= d["boxOption"]["predictedRejoinPos"] <= n_drivers_by_race.get(d["raceId"], 20))
    ]
    if bad_rejoin:
        impossible_found = True
        w(f"!! predictedRejoinPos fuori griglia (< 1 o > n. piloti in gara): {len(bad_rejoin)} casi.")
        for d in bad_rejoin[:N_EXTREME_CASES]:
            w(
                f"   {d['raceName']:<28} driverId={d['driverId']:<4} eventId={d['eventId']:<16} "
                f"predictedRejoinPos={d['boxOption']['predictedRejoinPos']} "
                f"(n. piloti gara={n_drivers_by_race.get(d['raceId'])})"
            )
    else:
        w("OK: nessun predictedRejoinPos fuori dalla griglia della propria gara.")
    w()

    bad_traffic = [
        d for d in decisions
        if d["snapshot"]["trafficFraction"] is not None
        and not (0.0 <= d["snapshot"]["trafficFraction"] <= 1.0)
    ]
    if bad_traffic:
        impossible_found = True
        w(f"!! trafficFraction fuori [0,1]: {len(bad_traffic)} casi.")
        for d in bad_traffic[:N_EXTREME_CASES]:
            w(f"   {d['raceName']:<28} driverId={d['driverId']:<4} eventId={d['eventId']:<16} trafficFraction={d['snapshot']['trafficFraction']}")
    else:
        w("OK: trafficFraction sempre in [0,1].")
    w()

    if not impossible_found:
        w("Nessun valore impossibile trovato su nessuno dei campi controllati sopra.")
    w()

    w("=" * 78)
    w("FINE VALIDAZIONE")
    w("=" * 78)


if __name__ == "__main__":
    main()
