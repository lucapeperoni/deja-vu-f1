"""
Validazione della pipeline su una gara campione vera (task 1.2 della
roadmap, vedi docs/PROGETTAZIONE.md sezioni 4, 5, 10).

Gara scelta: Gran Premio di Singapore 2023 (Ergast raceId=1113,
OpenF1 session_key=9165, meeting_key=1219, 17 settembre 2023).

Perché questa gara: è già in cache nel data-layer (niente rischio di rete),
ha sia una Safety Car (giri 20-22, causata dall'incidente Alonso/track
limits) sia una Virtual Safety Car (giri 44-45) come eventi puliti e
distinti, con un vero "tappo" di soste ai box al giro 20 — esattamente lo
scenario "SC che compatta il gruppo" del tipo di gara-caso #2 descritto
nella sezione 9 della specifica.

Esecuzione (dalla cartella data-layer, con l'ambiente virtuale attivo):
    python scripts/validate_sample_race.py
"""

import asyncio
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
REPO_ROOT = DATA_LAYER_DIR.parent
ERGAST_DIR = REPO_ROOT / "data" / "raw"

sys.path.insert(0, str(DATA_LAYER_DIR))

from app.clients.openf1_client import OpenF1Client  # noqa: E402
from app.metrics.neutralization_events import (  # noqa: E402
    build_lap_indexed_windows,
    parse_rc_messages,
)
from app.metrics.effective_pit_loss import calculate_pit_cost  # noqa: E402

RACE_ID = "1113"       # Ergast: Singapore Grand Prix 2023
SESSION_KEY = 9165     # OpenF1: sessione di gara dello stesso weekend
MEETING_KEY = 1219
YEAR = 2023

GREEN_EXPECTED_RANGE = (18.0, 30.0)   # secondi, tolleranza larga sul "20-25s" della specifica
VSC_DISCOUNT_EXPECTED_RANGE = (5.0, 16.0)  # secondi, tolleranza larga sull'"8-12s" della specifica


def read_csv(filename: str):
    with open(ERGAST_DIR / filename, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_ergast_race_data():
    races = {r["raceId"]: r for r in read_csv("races.csv")}
    drivers = {d["driverId"]: d for d in read_csv("drivers.csv")}
    constructors = {c["constructorId"]: c for c in read_csv("constructors.csv")}

    results_rows = [r for r in read_csv("results.csv") if r["raceId"] == RACE_ID]
    team_by_driver = {r["driverId"]: r["constructorId"] for r in results_rows}

    lap_rows = [r for r in read_csv("lap_times.csv") if r["raceId"] == RACE_ID]
    laps = [
        {"driver_id": r["driverId"], "lap": int(r["lap"]), "milliseconds": float(r["milliseconds"])}
        for r in lap_rows
        if r.get("milliseconds") not in (None, "", "\\N")
    ]

    pit_rows = [r for r in read_csv("pit_stops.csv") if r["raceId"] == RACE_ID]
    pit_stops = [
        {
            "driver_id": r["driverId"],
            "lap": int(r["lap"]),
            "stop": int(r["stop"]),
            "team_id": team_by_driver.get(r["driverId"]),
        }
        for r in pit_rows
    ]

    ergast_total_laps = max((l["lap"] for l in laps), default=0)

    return {
        "race": races.get(RACE_ID),
        "drivers": drivers,
        "constructors": constructors,
        "laps": laps,
        "pit_stops": pit_stops,
        "ergast_total_laps": ergast_total_laps,
    }


def check_lap_count_alignment(ergast_total_laps: int, openf1_laps: list):
    max_lap_by_driver = defaultdict(int)
    for row in openf1_laps:
        ln = row.get("lap_number")
        if ln is not None:
            max_lap_by_driver[row["driver_number"]] = max(max_lap_by_driver[row["driver_number"]], ln)

    if not max_lap_by_driver:
        print("  ATTENZIONE: nessun dato /laps ricevuto da OpenF1, impossibile verificare l'allineamento.")
        return

    highest = max(max_lap_by_driver.values())
    finishers = {d: l for d, l in max_lap_by_driver.items() if l >= highest - 3}
    modal_distance, n_at_mode = Counter(finishers.values()).most_common(1)[0]

    print(f"  Giri totali secondo Ergast (max in lap_times.csv): {ergast_total_laps}")
    print(
        f"  Giri totali secondo OpenF1 (valore più comune tra chi ha "
        f"completato la gara, {n_at_mode}/{len(finishers)} piloti): {modal_distance}"
    )

    if modal_distance != ergast_total_laps:
        print(
            f"  ATTENZIONE: disallineamento di {modal_distance - ergast_total_laps} giro/i "
            f"tra Ergast ({ergast_total_laps}) e OpenF1 ({modal_distance})."
        )
    else:
        print("  Allineamento OK: i due dataset concordano sul numero di giri di gara.")

    outliers = {d: l for d, l in finishers.items() if l != modal_distance}
    if outliers:
        print(f"  Nota: piloti OpenF1 con un conteggio giri diverso dalla moda: {outliers}")
    n_retired = len(max_lap_by_driver) - len(finishers)
    if n_retired:
        print(f"  ({n_retired} pilota/i con molti meno giri: probabili ritiri, esclusi dal confronto)")


def driver_label(driver_row, constructors, team_id):
    if not driver_row:
        return "?"
    code = driver_row.get("code") or driver_row.get("surname", "?").upper()[:3]
    team = constructors.get(team_id, {}).get("name", "") if team_id else ""
    return f"{code} ({team})" if team else code


def print_results_table(results, drivers, constructors, pit_team_by_key):
    header = f"{'pilota':<22} {'giro':>4} {'contesto':<12} {'costo eff.':>11} {'sconto':>8} {'doppio stack':>12}"
    print(header)
    print("-" * len(header))
    for r in sorted(results, key=lambda x: x.lap):
        driver_row = drivers.get(r.driver_id)
        team_id = pit_team_by_key.get((r.driver_id, r.lap))
        label = driver_label(driver_row, constructors, team_id)
        cost = f"{r.effective_pit_loss_seconds:.1f}s" if r.effective_pit_loss_seconds is not None else "n/d"
        discount = f"{r.discount_seconds:+.1f}s" if r.discount_seconds is not None else "n/d"
        stack = "sì" if r.double_stack else ""
        print(f"{label:<22} {r.lap:>4} {r.context:<12} {cost:>11} {discount:>8} {stack:>12}")


def main():
    print(f"=== Validazione pipeline: gara campione Ergast raceId={RACE_ID}, "
          f"OpenF1 session_key={SESSION_KEY} ===\n")

    data = load_ergast_race_data()
    race = data["race"]
    print(f"Gara: {race['name']} {race['year']} (round {race['round']}), data {race['date']}")
    print(f"Piloti con tempi sul giro: {len({l['driver_id'] for l in data['laps']})}")
    print(f"Pit stop trovati (Ergast): {len(data['pit_stops'])}\n")

    print("--- Passo 2: neutralizzazioni da OpenF1 (race control) ---")

    async def fetch():
        client = OpenF1Client()
        try:
            rc_raw = await client.get_race_control(SESSION_KEY, MEETING_KEY, YEAR)
            laps_raw = await client.get_laps(SESSION_KEY, MEETING_KEY, YEAR)
        finally:
            await client.close()
        return rc_raw, laps_raw

    rc_raw, openf1_laps_raw = asyncio.run(fetch())
    rc_parsed = parse_rc_messages(rc_raw)
    windows, window_warnings = build_lap_indexed_windows(SESSION_KEY, rc_parsed)

    for w in windows:
        print(f"  {w['type']:<3} evento {w['event_id']}: giro {w['start_lap']} -> giro {w['end_lap']}")
    for warn in window_warnings:
        print(f"  ATTENZIONE: {warn}")
    if not windows:
        print("  ATTENZIONE: nessuna neutralizzazione risolta in numero di giro.")
    print()

    print("--- Passo 3: allineamento numero di giri Ergast <-> OpenF1 ---")
    check_lap_count_alignment(data["ergast_total_laps"], openf1_laps_raw)
    print()

    print("--- Passo 4: calcolo costo effettivo, prezzo di listino, sconto ---")
    results = calculate_pit_cost(data["laps"], data["pit_stops"], windows)
    pit_team_by_key = {(p["driver_id"], p["lap"]): p.get("team_id") for p in data["pit_stops"]}

    nominal = next((r.nominal_pit_loss_seconds for r in results if r.nominal_pit_loss_seconds is not None), None)
    low_conf = results[0].low_confidence if results else True
    n_green = sum(1 for r in results if r.context == "GREEN" and r.effective_pit_loss_seconds is not None)
    print(f"  Prezzo di listino (mediana pit in verde, n={n_green}): "
          f"{nominal:.1f}s" if nominal is not None else "  Prezzo di listino: non calcolabile (nessun pit verde)")
    if low_conf:
        print("  (confidenza bassa: meno di 4 pit in verde nella gara)")
    print()

    print("--- Passo 5: tabella pit stop ---")
    print_results_table(results, data["drivers"], data["constructors"], pit_team_by_key)
    print()

    print("=== Controllo di sanità (ordini di grandezza attesi, sezione 5.3 della specifica) ===")
    green_costs = [r.effective_pit_loss_seconds for r in results if r.context == "GREEN" and r.effective_pit_loss_seconds]
    vsc_discounts = [r.discount_seconds for r in results if r.context == "UNDER_VSC" and r.discount_seconds is not None]
    sc_discounts = [r.discount_seconds for r in results if r.context == "UNDER_SC" and r.discount_seconds is not None]
    fregati = [r for r in results if r.context == "JUST_BEFORE"]

    def verdict(label, values, expected_range):
        if not values:
            print(f"  {label}: nessun caso in questa gara (n/d)")
            return None
        lo, hi = expected_range
        ok = all(lo <= v <= hi for v in values)
        vals_str = ", ".join(f"{v:.1f}s" for v in values)
        print(f"  {label}: {vals_str}  ->  {'OK, dentro il range atteso' if ok else 'FUORI dal range atteso'}")
        return ok

    ok_green = verdict("Pit in verde (atteso 18-30s)", green_costs, GREEN_EXPECTED_RANGE)
    ok_vsc = verdict("Sconto sotto VSC (atteso 5-16s)", vsc_discounts, VSC_DISCOUNT_EXPECTED_RANGE)
    if sc_discounts:
        print(f"  Sconto sotto SC: {', '.join(f'{v:.1f}s' for v in sc_discounts)} "
              f"(atteso maggiore del VSC, nessun limite superiore fisso)")
    if fregati:
        print(f"  Piloti 'fregati' (JUST_BEFORE, pagano prezzo pieno appena prima della finestra): "
              f"{len(fregati)} caso/i")

    print()
    all_checks = [c for c in [ok_green, ok_vsc] if c is not None]
    if all_checks and all(all_checks):
        print("VERDETTO: i numeri tornano con gli ordini di grandezza attesi dalla specifica.")
    elif all_checks:
        print("VERDETTO: alcuni numeri NON tornano con gli ordini di grandezza attesi. Vedi sopra.")
    else:
        print("VERDETTO: dati insufficienti in questa gara per un verdetto completo.")


if __name__ == "__main__":
    main()
