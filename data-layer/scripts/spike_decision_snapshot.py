"""
Spike: modello della decisione (docs/PROGETTAZIONE.md, §5.6 e §3).

Obiettivo dello spike: verificare, sulle neutralizzazioni delle 3 gare-caso
(docs/PROGETTAZIONE.md §9 / data-layer/scripts/report_numbers.py), se il
calcolo proposto in §5.6 per "posizione di rientro prevista se boxi"
produce numeri sensati rispetto a quello che è successo davvero in pista.
Non tocca la pipeline né i JSON: solo lettura di public/data/races/*.json.

Per ogni pilota, allo snapshot del giro del deploy di ogni neutralizzazione:
  - stato visto dal muretto: posizione, gap avanti/dietro (da `ms`
    cumulati), età/mescola gomme (dagli outcomes), giri mancanti, soste
    già fatte prima del giro del deploy;
  - opzione BOX quantificata: costo atteso = mediana degli effectiveLoss
    dei pit UNDER_SC "affidabili" (lowConfidence == False) di questo
    stesso evento; se l'evento non ne ha di affidabili, fallback a 15.5s
    (mediana di campione dichiarata nel task, provvisoria per lo spike);
    posizione di rientro prevista = tempo cumulato al giro del deploy +
    costo atteso, contando quanti piloti hanno un tempo proiettato
    inferiore al proprio (v. correzione sotto);
  - scelta reale: BOX (si è fermato nella finestra sotto SC/VSC), FORZATA
    (outcome v1 == LOCKED_OUT) o STAY (nessuna delle due);
  - esito: outcomes[].posDelta, già calcolato dalla pipeline a 5 giri
    dall'evento;
  - per chi ha scelto BOX: confronto tra rientro previsto e la posAfter
    reale registrata sul pit (posizione subito dopo la sosta).

Correzione rispetto alla prima versione dello spike (validata sul GP
Arabia Saudita 2024): il conteggio "quante auto restano davanti" ora
proietta in avanti anche i rivali che si fermano nella stessa finestra
(stesso costo atteso generico), non solo il pilota in esame — altrimenti,
quando quasi tutto il gruppo boxa insieme sotto SC, il modello sovrastima
quanto si scivola indietro (i rivali "congelati" al giro del deploy
scavalcano il pilota anche se in realtà si fermano anche loro).

Uso:
    python data-layer/scripts/spike_decision_snapshot.py
"""

import csv
import json
import statistics
from pathlib import Path
from typing import Dict, List, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
REPO_ROOT = DATA_LAYER_DIR.parent
RACES_DIR = REPO_ROOT / "public" / "data" / "races"
DRIVERS_CSV = REPO_ROOT / "data" / "raw" / "drivers.csv"

# Le 3 gare-caso di docs/PROGETTAZIONE.md §9 / data-layer/scripts/report_numbers.py
CASE_RACES = ["2023-bahrain", "2024-jeddah", "2023-albert_park"]

FALLBACK_COST_S = 15.5  # mediana di campione dichiarata nel task (fallback provvisorio)


def load_driver_names() -> Dict[str, str]:
    names: Dict[str, str] = {}
    with open(DRIVERS_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            names[row["code"]] = f"{row['forename']} {row['surname']}"
    return names


def lap_lookup(driver: dict) -> Dict[int, dict]:
    return {lap["l"]: lap for lap in driver["laps"]}


def compute_event_snapshots(race: dict, event: dict, names: Dict[str, str]) -> tuple:
    """Calcola gli snapshot pilota x evento per UNA neutralizzazione, senza stampare nulla.

    Riusabile sia dallo spike su gara singola (P1.1, sotto) sia dallo spike sull'intero
    dataset (P1.2, data-layer/scripts/spike_decision_map.py): la logica di calcolo è la
    stessa, cambia solo su cosa si itera.

    Ritorna (rows, expected_cost_s, cost_source).
    """
    drivers = race["drivers"]
    event_id = event["eventId"]
    deploy_lap = event["startLap"]

    # --- costo atteso dell'opzione BOX: mediana dei pit UNDER_SC affidabili di questo evento ---
    reliable_costs = []
    for drv in drivers:
        for pit in drv["pits"]:
            if (
                pit.get("eventId") == event_id
                and pit["context"] == "UNDER_SC"
                and not pit["lowConfidence"]
                and pit["effectiveLoss"] is not None
            ):
                reliable_costs.append(pit["effectiveLoss"])

    if reliable_costs:
        expected_cost_s = statistics.median(reliable_costs)
        cost_source = f"mediana di {len(reliable_costs)} pit UNDER_SC affidabili di questo evento"
    else:
        expected_cost_s = FALLBACK_COST_S
        cost_source = "fallback: nessun pit affidabile per questo evento, uso mediana di campione"

    laps_by_driver = {drv["id"]: lap_lookup(drv) for drv in drivers}

    # posizione -> ms cumulati al giro del deploy, per calcolare gap
    ms_by_pos_at_deploy: Dict[int, float] = {}
    for drv in drivers:
        snap = laps_by_driver[drv["id"]].get(deploy_lap)
        if snap is not None:
            ms_by_pos_at_deploy[snap["pos"]] = snap["ms"]

    # --- prima passata: chi si ferma davvero sotto SC/VSC in questa finestra (serve per
    # proiettare anche i rivali, non solo il pilota in esame) ---
    pit_in_window_by_driver: Dict[str, Optional[dict]] = {}
    ms_at_deploy_by_driver: Dict[str, float] = {}
    for drv in drivers:
        driver_id = drv["id"]
        snap = laps_by_driver[driver_id].get(deploy_lap)
        if snap is None:
            continue
        ms_at_deploy_by_driver[driver_id] = snap["ms"]
        pit_in_window_by_driver[driver_id] = next(
            (p for p in drv["pits"] if p.get("eventId") == event_id and p["context"] == "UNDER_SC"),
            None,
        )

    # quota del gruppo che si ferma in questa finestra (§5.6: "cosa fanno gli altri") — stesso
    # valore per ogni pilota di questo evento, è una proprietà dell'evento non del singolo.
    n_at_deploy = len(pit_in_window_by_driver)
    n_boxed = sum(1 for p in pit_in_window_by_driver.values() if p is not None)
    traffic_fraction = n_boxed / n_at_deploy if n_at_deploy else None

    # tempo proiettato di OGNI pilota alla fine della finestra: chi boxa (davvero) viene
    # proiettato in avanti dello stesso costo atteso generico; chi non boxa resta fermo al
    # suo tempo del giro del deploy.
    projected_ms_by_driver: Dict[str, float] = {}
    for driver_id, ms in ms_at_deploy_by_driver.items():
        if pit_in_window_by_driver.get(driver_id) is not None:
            projected_ms_by_driver[driver_id] = ms + expected_cost_s * 1000
        else:
            projected_ms_by_driver[driver_id] = ms

    rows = []
    for drv in drivers:
        driver_id = drv["id"]
        snap = laps_by_driver[driver_id].get(deploy_lap)
        if snap is None:
            continue  # non in gara a quel giro (ritirato prima)

        outcome = next((o for o in drv["outcomes"] if o["eventId"] == event_id), None)
        if outcome is None:
            continue  # non coinvolto in questo evento

        pos = snap["pos"]
        ms = snap["ms"]
        ahead_ms = ms_by_pos_at_deploy.get(pos - 1)
        behind_ms = ms_by_pos_at_deploy.get(pos + 1)
        gap_ahead = (ms - ahead_ms) / 1000 if ahead_ms is not None else None
        gap_behind = (behind_ms - ms) / 1000 if behind_ms is not None else None

        laps_remaining = race["race"]["laps"] - deploy_lap
        pits_before = [p for p in drv["pits"] if p["lap"] < deploy_lap]

        pit_in_window = pit_in_window_by_driver.get(driver_id)
        if pit_in_window is not None:
            choice = "BOX"
        elif outcome["category"] == "LOCKED_OUT":
            choice = "FORZATA"
        else:
            choice = "STAY"

        # rientro previsto: proietto il mio tempo cumulato in avanti del costo atteso, poi
        # conto quanti rivali hanno un tempo proiettato inferiore al mio -> restano davanti.
        projected_ms = ms + expected_cost_s * 1000
        cars_ahead = sum(
            1
            for other_id, other_projected_ms in projected_ms_by_driver.items()
            if other_id != driver_id and other_projected_ms < projected_ms
        )
        predicted_pos = cars_ahead + 1

        rows.append({
            "driver": names.get(driver_id, driver_id),
            "code": driver_id,
            "pos": pos,
            "gap_ahead": gap_ahead,
            "gap_behind": gap_behind,
            "tyre_age": outcome.get("tyreAge"),
            "tyre_compound": outcome.get("tyreCompound"),
            "deploy_lap": deploy_lap,
            "race_laps": race["race"]["laps"],
            "race_progress": deploy_lap / race["race"]["laps"],
            "laps_remaining": laps_remaining,
            "pits_before": len(pits_before),
            "traffic_fraction": traffic_fraction,
            "choice": choice,
            "outcome_category": outcome["category"],
            "pos_delta_5laps": outcome["posDelta"],
            "predicted_pos": predicted_pos,
            "pit_pos_after": pit_in_window["posAfter"] if pit_in_window else None,
        })

    rows.sort(key=lambda r: r["pos"])
    return rows, expected_cost_s, cost_source


def analyze_event(race: dict, event: dict, names: Dict[str, str]) -> List[dict]:
    """Stampa tabella + riepilogo per un singolo evento (usato dallo spike P1.1). Ritorna gli errori."""
    print(f"\nNeutralizzazione: {event['type']} giri {event['startLap']}-{event['endLap']} "
          f"(eventId={event['eventId']}, giro del deploy usato per lo snapshot: {event['startLap']})")

    rows, expected_cost_s, cost_source = compute_event_snapshots(race, event, names)
    print(f"Costo atteso opzione BOX: {expected_cost_s:.3f}s ({cost_source})")

    # --- tabella ---
    header = (
        f"{'Pilota':<18}{'Pos':>4}{'GapAv':>8}{'GapDie':>8}{'Gomma':>10}{'Età':>5}"
        f"{'GiriRim':>8}{'Soste':>7}{'Scelta':>9}{'Esito':>12}{'ΔPos5g':>8}{'RientroPrev':>13}{'PosAfterReale':>15}"
    )
    print(header)
    print("-" * len(header))
    for r in rows:
        gap_a = f"{r['gap_ahead']:.1f}" if r["gap_ahead"] is not None else "-"
        gap_d = f"{r['gap_behind']:.1f}" if r["gap_behind"] is not None else "-"
        compound = (r["tyre_compound"] or "?")[:6]
        tyre_age = r["tyre_age"] if r["tyre_age"] is not None else "-"
        pit_after = r["pit_pos_after"] if r["pit_pos_after"] is not None else "-"
        print(
            f"{r['driver']:<18}{r['pos']:>4}{gap_a:>8}{gap_d:>8}{compound:>10}{tyre_age!s:>5}"
            f"{r['laps_remaining']:>8}{r['pits_before']:>7}{r['choice']:>9}"
            f"{r['outcome_category']:>12}{r['pos_delta_5laps']!s:>8}{r['predicted_pos']:>13}{pit_after!s:>15}"
        )

    # --- riepilogo errore di previsione: solo chi ha effettivamente boxato nella finestra ---
    boxed = [r for r in rows if r["choice"] == "BOX" and r["pit_pos_after"] is not None]
    errors = [(r, abs(r["predicted_pos"] - r["pit_pos_after"])) for r in boxed]
    errors.sort(key=lambda t: -t[1])

    print("--- Errore di previsione (rientro previsto vs posAfter reale, solo chi ha boxato) ---")
    if not errors:
        print("Nessun pilota ha boxato nella finestra: nessun confronto possibile.")
    else:
        abs_errors = [e for _, e in errors]
        print(f"N. piloti confrontati: {len(errors)}")
        print(f"Errore mediano: {statistics.median(abs_errors):.1f} posizioni")
        print(f"Errore medio: {statistics.mean(abs_errors):.1f} posizioni")
        print("Casi peggiori:")
        for r, err in errors[:5]:
            print(
                f"  {r['driver']:<18} previsto={r['predicted_pos']:>3}  reale={r['pit_pos_after']:>3}  "
                f"errore={err:>3}"
            )

    return errors


def main() -> None:
    names = load_driver_names()
    all_errors: List[float] = []

    for race_slug in CASE_RACES:
        race_path = RACES_DIR / f"{race_slug}.json"
        race = json.loads(race_path.read_text(encoding="utf-8"))
        print("=" * 100)
        print(f"Gara: {race['race']['name']} {race['race']['year']} "
              f"(giri totali: {race['race']['laps']})")

        for event in race["neutralizations"]:
            errors = analyze_event(race, event, names)
            all_errors.extend(err for _, err in errors)

    print("=" * 100)
    print("\n--- Riepilogo complessivo su tutte le neutralizzazioni delle 3 gare-caso ---")
    if not all_errors:
        print("Nessun confronto disponibile.")
    else:
        print(f"N. confronti totali (pilota × evento, solo chi ha boxato): {len(all_errors)}")
        print(f"Errore mediano: {statistics.median(all_errors):.1f} posizioni")
        print(f"Errore medio: {statistics.mean(all_errors):.1f} posizioni")
        print(f"Errore massimo: {max(all_errors):.0f} posizioni")


if __name__ == "__main__":
    main()
