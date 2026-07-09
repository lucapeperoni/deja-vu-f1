"""
Pipeline completa (task 2.1 della roadmap, vedi docs/PROGETTAZIONE.md
sezioni 5 e 6). Costruisce i JSON per il frontend a partire dai CSV Ergast
e dai messaggi di race control OpenF1, per tutte le gare delle stagioni
2023 e 2024.

Uso (dalla cartella data-layer, con l'ambiente virtuale attivo):
    python scripts/build_all.py

Output in public/data/:
  index.json       elenco gare (anno, nome, circuito, n. neutralizzazioni, flag "interessante")
  races/<slug>.json  un file per gara, schema sezione 6 della specifica
  aggregate.json   tutti i pit delle due stagioni + matrice esiti pilota x evento x gara
  params.json      soglie dichiarate della pipeline (per /methodology, task 4.2)

La validazione sulla gara campione (task 1.2, validate_sample_race.py) ha
già dimostrato che il calcolo funziona; qui si industrializza sullo stesso
principio: un pilota alla volta, un giro alla volta, niente scorciatoie.
"""

import asyncio
import csv
import json
import statistics
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
REPO_ROOT = DATA_LAYER_DIR.parent
ERGAST_DIR = REPO_ROOT / "data" / "raw"
PUBLIC_DATA_DIR = REPO_ROOT / "public" / "data"

sys.path.insert(0, str(DATA_LAYER_DIR))

from app.clients.openf1_client import OpenF1Client  # noqa: E402
from app.metrics.neutralization_events import (  # noqa: E402
    build_lap_indexed_windows,
    parse_rc_messages,
)
from app.metrics.effective_pit_loss import (  # noqa: E402
    BASELINE_MIN_CLEAN_LAPS,
    BASELINE_WINDOW_LAPS,
    FIELD_REFERENCE_MIN_SAMPLES,
    JUST_AFTER_MAX_LAPS,
    JUST_BEFORE_MAX_LAPS,
    MIN_GREEN_STOPS_FOR_CONFIDENCE,
    CONTEXT_UNDER_SC,
    CONTEXT_UNDER_VSC,
    CONTEXT_JUST_BEFORE,
    calculate_pit_cost,
)

YEARS = [2023, 2024]

# Soglie dichiarate per la classificazione degli esiti (sezione 5.5 della
# specifica). Esportate anche in public/data/params.json così la pagina
# /methodology (task 4.2) le legge da qui, non le riscrive a mano.
TYRE_AGE_MIN_LAPS = 8          # sotto questa età, le gomme sono "troppo fresche" per fermarsi
TRAFFIC_MIN_CARS = 3           # auto entro un "pit stop di tempo" dietro = rientro nel traffico
POST_EVENT_OUTCOME_OFFSET = 3  # giri dopo la fine dell'evento per misurare il posDelta

RATE_LIMIT_SECONDS = 1.0       # pausa gentile tra una gara e l'altra verso OpenF1

# Alcuni giri in lap_times.csv durano diverse migliaia di secondi: sono
# bandiere rosse (il tempo del giro include l'intera sospensione della
# gara), non giri di corsa veri. Se uno di questi cade come giro di
# entrata/uscita di un pit stop, il costo effettivo esploderebbe a
# migliaia di secondi (verificato sui dati: 152 giri su 46 gare superano
# questa soglia, con un distacco netto dal giro "lento ma vero" più lungo
# osservato, 230s sotto Safety Car pesante). Questi giri vengono esclusi
# a monte, prima di qualunque calcolo: se un pit stop cade proprio su uno
# di questi giri il suo costo risulterà non calcolabile (None) invece che
# assurdo. Limite noto, da dichiarare in /methodology (task 4.2): le gare
# con bandiera rossa non sono modellate come evento a sé, i giri coinvolti
# sono semplicemente trattati come dati mancanti.
MAX_PLAUSIBLE_LAP_MS = 240_000  # 4 minuti


# ---------------------------------------------------------------------------
# Caricamento CSV Ergast (letti una sola volta, non per gara)
# ---------------------------------------------------------------------------

def read_csv(filename: str) -> List[Dict]:
    with open(ERGAST_DIR / filename, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def group_by(rows: List[Dict], key: str) -> Dict[str, List[Dict]]:
    grouped: Dict[str, List[Dict]] = defaultdict(list)
    for r in rows:
        grouped[r[key]].append(r)
    return grouped


class ErgastData:
    def __init__(self):
        self.races = {r["raceId"]: r for r in read_csv("races.csv")}
        self.circuits = {c["circuitId"]: c for c in read_csv("circuits.csv")}
        self.drivers = {d["driverId"]: d for d in read_csv("drivers.csv")}
        self.constructors = {c["constructorId"]: c for c in read_csv("constructors.csv")}
        self.results_by_race = group_by(read_csv("results.csv"), "raceId")
        self.lap_times_by_race = group_by(read_csv("lap_times.csv"), "raceId")
        self.pit_stops_by_race = group_by(read_csv("pit_stops.csv"), "raceId")

    def races_for_years(self, years: List[int]) -> List[Dict]:
        wanted = {str(y) for y in years}
        rows = [r for r in self.races.values() if r["year"] in wanted]
        rows.sort(key=lambda r: (r["year"], int(r["round"])))
        return rows


# ---------------------------------------------------------------------------
# Aggancio Ergast <-> OpenF1 (per data, non per numero di giro: quello
# serve solo per le finestre di neutralizzazione una volta trovata la gara)
# ---------------------------------------------------------------------------

async def fetch_openf1_race_sessions_by_year(client: OpenF1Client, year: int) -> List[Dict]:
    sessions = await client.get_sessions(year=year)
    return [s for s in sessions if s.get("session_name") == "Race"]


def match_openf1_session(race_row: Dict, openf1_sessions: List[Dict]) -> Optional[Dict]:
    """
    Aggancio per data. Tolleranza di +-1 giorno: le gare in notturna (es.
    Las Vegas) partono a tarda sera locale, che in UTC ricade nel giorno
    successivo rispetto alla data "nominale" usata da Ergast.
    """
    race_date = date.fromisoformat(race_row["date"])
    best_match, best_diff = None, None
    for s in openf1_sessions:
        date_start = s.get("date_start") or ""
        if len(date_start) < 10:
            continue
        session_date = date.fromisoformat(date_start[:10])
        diff = abs((session_date - race_date).days)
        if diff <= 1 and (best_diff is None or diff < best_diff):
            best_match, best_diff = s, diff
    return best_match


# ---------------------------------------------------------------------------
# Calcoli derivati dai tempi sul giro (Ergast lap_times.csv)
# ---------------------------------------------------------------------------

def build_laps_and_positions(lap_rows: List[Dict]):
    """
    Ritorna:
      laps_for_metric: [{driver_id, lap, milliseconds}, ...] per calculate_pit_cost
      cum_time_by_driver: {driver_id: {lap: cumulative_ms}}
      position_by_driver: {driver_id: {lap: position}}
      total_laps: int
      n_excluded_laps: int (giri scartati per MAX_PLAUSIBLE_LAP_MS)

    Nota: i giri con tempo anomalo (bandiera rossa, vedi MAX_PLAUSIBLE_LAP_MS)
    sono esclusi dal tempo/costo ma NON dalla posizione: la classifica in
    quel giro resta un dato valido anche se il tempo non lo è.
    """
    all_rows = [r for r in lap_rows if r.get("milliseconds") not in (None, "", "\\N")]
    time_rows = [r for r in all_rows if float(r["milliseconds"]) <= MAX_PLAUSIBLE_LAP_MS]
    n_excluded_laps = len(all_rows) - len(time_rows)

    laps_for_metric = [
        {"driver_id": r["driverId"], "lap": int(r["lap"]), "milliseconds": float(r["milliseconds"])}
        for r in time_rows
    ]

    ms_by_driver: Dict[str, Dict[int, float]] = defaultdict(dict)
    pos_by_driver: Dict[str, Dict[int, int]] = defaultdict(dict)
    for r in time_rows:
        ms_by_driver[r["driverId"]][int(r["lap"])] = float(r["milliseconds"])
    for r in all_rows:
        if r.get("position") not in (None, "", "\\N"):
            pos_by_driver[r["driverId"]][int(r["lap"])] = int(r["position"])

    cum_time_by_driver: Dict[str, Dict[int, float]] = defaultdict(dict)
    for driver_id, laps in ms_by_driver.items():
        running_total = 0.0
        for lap in sorted(laps):
            running_total += laps[lap]
            cum_time_by_driver[driver_id][lap] = running_total

    total_laps = max((int(r["lap"]) for r in all_rows), default=0)

    return laps_for_metric, cum_time_by_driver, pos_by_driver, total_laps, n_excluded_laps


def build_race_trace(
    cum_time_by_driver: Dict[str, Dict[int, float]], winner_driver_id: Optional[str], total_laps: int
):
    """
    Race trace: distacco (in secondi) dal ritmo costante di riferimento del
    vincitore (sezione 6/7 della specifica). gap_to_leader e' invece il
    distacco reale dal leader nello stesso giro (semplificazione: non
    corregge i giri di ritardo, accettabile per la fedelta' di questo
    progetto).
    """
    if winner_driver_id is None or winner_driver_id not in cum_time_by_driver:
        winner_avg_lap_ms = None
    else:
        winner_laps = cum_time_by_driver[winner_driver_id]
        winner_lap_times = []
        prev = 0.0
        for lap in sorted(winner_laps):
            winner_lap_times.append(winner_laps[lap] - prev)
            prev = winner_laps[lap]
        winner_avg_lap_ms = statistics.mean(winner_lap_times) if winner_lap_times else None

    leader_cum_by_lap: Dict[int, float] = {}
    for lap in range(1, total_laps + 1):
        values_at_lap = [cum[lap] for cum in cum_time_by_driver.values() if lap in cum]
        if values_at_lap:
            leader_cum_by_lap[lap] = min(values_at_lap)

    trace_by_driver: Dict[str, Dict[int, Dict[str, float]]] = defaultdict(dict)
    for driver_id, cum in cum_time_by_driver.items():
        for lap, cum_ms in cum.items():
            gap_leader = (cum_ms - leader_cum_by_lap[lap]) / 1000.0 if lap in leader_cum_by_lap else None
            trace = (
                (cum_ms - lap * winner_avg_lap_ms) / 1000.0
                if winner_avg_lap_ms is not None
                else None
            )
            trace_by_driver[driver_id][lap] = {"gapLeader": gap_leader, "trace": trace}

    return trace_by_driver


# ---------------------------------------------------------------------------
# Esiti pilota x evento (sezione 5.5 della specifica)
# ---------------------------------------------------------------------------

def last_pit_lap_before(pit_laps_sorted: List[int], lap: int) -> int:
    last = 0
    for pl in pit_laps_sorted:
        if pl < lap:
            last = pl
        else:
            break
    return last


def classify_outcome(
    driver_id: str,
    event: Dict,
    pit_results_by_driver: Dict[str, List],
    pit_laps_by_driver: Dict[str, List[int]],
    cum_time_by_driver: Dict[str, Dict[int, float]],
    nominal_pit_loss: Optional[float],
    total_pit_count_by_driver: Dict[str, int],
) -> str:
    """
    Regole operative (soglie in cima al file):
      EXPLOITED    si e' fermato durante la finestra
      FULL_PRICE   si era fermato in verde nei JUST_BEFORE_MAX_LAPS giri prima
      LOCKED_OUT   non fermato: gomme piu' giovani di TYRE_AGE_MIN_LAPS,
                   oppure rientrerebbe dietro almeno TRAFFIC_MIN_CARS auto
      NOT_NEEDED   non fermato: ha gia' completato tutte le soste previste
      NEUTRAL      nessuna delle precedenti (non si e' fermato per scelta/
                   strategia non altrimenti classificata)
    """
    driver_pit_results = pit_results_by_driver.get(driver_id, [])
    for r in driver_pit_results:
        if r.event_id == event["event_id"] and r.context in (CONTEXT_UNDER_SC, CONTEXT_UNDER_VSC):
            return "EXPLOITED"
        if r.event_id == event["event_id"] and r.context == CONTEXT_JUST_BEFORE:
            return "FULL_PRICE"

    pit_laps_sorted = pit_laps_by_driver.get(driver_id, [])
    stops_before_event = sum(1 for pl in pit_laps_sorted if pl < event["start_lap"])
    if stops_before_event >= total_pit_count_by_driver.get(driver_id, 0) and stops_before_event > 0:
        # Ha gia' fatto tutte le soste che avrebbe fatto in gara prima
        # dell'evento: la finestra non lo riguarda.
        return "NOT_NEEDED"

    tyre_age = event["start_lap"] - last_pit_lap_before(pit_laps_sorted, event["start_lap"])
    if tyre_age < TYRE_AGE_MIN_LAPS:
        return "LOCKED_OUT"

    if nominal_pit_loss is not None:
        driver_cum = cum_time_by_driver.get(driver_id, {})
        driver_time_at_event = driver_cum.get(event["start_lap"])
        if driver_time_at_event is not None:
            cars_behind_within_pit_loss = 0
            for other_id, other_cum in cum_time_by_driver.items():
                if other_id == driver_id:
                    continue
                other_time = other_cum.get(event["start_lap"])
                if other_time is None:
                    continue
                gap = other_time - driver_time_at_event
                if 0 < gap <= nominal_pit_loss * 1000.0:
                    cars_behind_within_pit_loss += 1
            if cars_behind_within_pit_loss >= TRAFFIC_MIN_CARS:
                return "LOCKED_OUT"

    return "NEUTRAL"


# ---------------------------------------------------------------------------
# Costruzione del JSON per una singola gara
# ---------------------------------------------------------------------------

def build_race_json(ergast: ErgastData, race_row: Dict, windows: List[Dict]) -> Dict:
    race_id = race_row["raceId"]
    circuit = ergast.circuits.get(race_row["circuitId"], {})
    results_rows = ergast.results_by_race.get(race_id, [])
    lap_rows = ergast.lap_times_by_race.get(race_id, [])
    pit_rows = ergast.pit_stops_by_race.get(race_id, [])

    team_by_driver = {r["driverId"]: r["constructorId"] for r in results_rows}
    grid_by_driver = {r["driverId"]: (int(r["grid"]) if r["grid"] not in (None, "", "\\N") else None) for r in results_rows}
    finish_by_driver = {
        r["driverId"]: (int(r["positionOrder"]) if r["positionOrder"] not in (None, "", "\\N") else None)
        for r in results_rows
    }
    winner_row = next((r for r in results_rows if r.get("positionOrder") == "1"), None)
    winner_driver_id = winner_row["driverId"] if winner_row else None

    laps_for_metric, cum_time_by_driver, pos_by_driver, total_laps, n_excluded_laps = build_laps_and_positions(lap_rows)
    trace_by_driver = build_race_trace(cum_time_by_driver, winner_driver_id, total_laps)

    pit_stops_for_metric = [
        {
            "driver_id": r["driverId"],
            "lap": int(r["lap"]),
            "stop": int(r["stop"]),
            "team_id": team_by_driver.get(r["driverId"]),
        }
        for r in pit_rows
    ]

    pit_results = calculate_pit_cost(laps_for_metric, pit_stops_for_metric, windows)

    pit_laps_by_driver: Dict[str, List[int]] = defaultdict(list)
    total_pit_count_by_driver: Dict[str, int] = defaultdict(int)
    for r in pit_rows:
        pit_laps_by_driver[r["driverId"]].append(int(r["lap"]))
        total_pit_count_by_driver[r["driverId"]] += 1
    for driver_id in pit_laps_by_driver:
        pit_laps_by_driver[driver_id].sort()

    pit_results_by_driver: Dict[str, List] = defaultdict(list)
    for r in pit_results:
        pit_results_by_driver[r.driver_id].append(r)

    nominal_pit_loss = next((r.nominal_pit_loss_seconds for r in pit_results if r.nominal_pit_loss_seconds is not None), None)

    def position_at(driver_id: str, lap: int) -> Optional[int]:
        return pos_by_driver.get(driver_id, {}).get(lap)

    # Piloti presenti in gara: chi ha almeno un giro registrato
    driver_ids = sorted(set(lap_rows and [r["driverId"] for r in lap_rows] or []))

    drivers_json = []
    for driver_id in driver_ids:
        driver_row = ergast.drivers.get(driver_id, {})
        laps_json = [
            {
                "l": lap,
                "pos": pos_by_driver.get(driver_id, {}).get(lap),
                "ms": cum_time_by_driver.get(driver_id, {}).get(lap),
                "gapLeader": trace_by_driver.get(driver_id, {}).get(lap, {}).get("gapLeader"),
                "trace": trace_by_driver.get(driver_id, {}).get(lap, {}).get("trace"),
            }
            for lap in sorted(cum_time_by_driver.get(driver_id, {}))
        ]

        pits_json = []
        for r in pit_results_by_driver.get(driver_id, []):
            pits_json.append(
                {
                    "lap": r.lap,
                    "context": r.context,
                    "eventId": r.event_id,
                    "effectiveLoss": r.effective_pit_loss_seconds,
                    "discount": r.discount_seconds,
                    "posBefore": position_at(driver_id, r.lap - 1),
                    "posAfter": position_at(driver_id, r.lap + 1),
                    "posAfter3": position_at(driver_id, r.lap + 1 + POST_EVENT_OUTCOME_OFFSET),
                    "posAfter5": position_at(driver_id, r.lap + 1 + 5),
                    "doubleStack": r.double_stack,
                }
            )

        outcomes_json = []
        for idx, event in enumerate(windows):
            category = classify_outcome(
                driver_id,
                event,
                pit_results_by_driver,
                pit_laps_by_driver,
                cum_time_by_driver,
                nominal_pit_loss,
                total_pit_count_by_driver,
            )
            pos_at_start = position_at(driver_id, event["start_lap"])
            pos_after = position_at(driver_id, event["end_lap"] + POST_EVENT_OUTCOME_OFFSET)
            pos_delta = (
                pos_at_start - pos_after if pos_at_start is not None and pos_after is not None else None
            )
            outcomes_json.append({"event": idx, "eventId": event["event_id"], "category": category, "posDelta": pos_delta})

        drivers_json.append(
            {
                "id": driver_row.get("code") or driver_id,
                "driverId": driver_id,
                "team": ergast.constructors.get(team_by_driver.get(driver_id), {}).get("constructorRef"),
                "grid": grid_by_driver.get(driver_id),
                "finish": finish_by_driver.get(driver_id),
                "laps": laps_json,
                "pits": pits_json,
                "outcomes": outcomes_json,
            }
        )

    return {
        "race": {
            "raceId": race_id,
            "name": race_row["name"],
            "circuit": circuit.get("name"),
            "country": circuit.get("country"),
            "year": int(race_row["year"]),
            "round": int(race_row["round"]),
            "date": race_row["date"],
            "laps": total_laps,
            "nominalPitLoss": nominal_pit_loss,
            "excludedAnomalousLaps": n_excluded_laps,
        },
        "neutralizations": [
            {"eventId": w["event_id"], "type": w["type"], "startLap": w["start_lap"], "endLap": w["end_lap"]}
            for w in windows
        ],
        "drivers": drivers_json,
    }


def slugify(race_row: Dict, ergast: ErgastData) -> str:
    circuit = ergast.circuits.get(race_row["circuitId"], {})
    circuit_ref = circuit.get("circuitRef", "unknown")
    return f"{race_row['year']}-{circuit_ref}"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def process_all_races():
    ergast = ErgastData()
    race_rows = ergast.races_for_years(YEARS)

    client = OpenF1Client()
    openf1_sessions_by_year: Dict[int, List[Dict]] = {}
    for year in YEARS:
        openf1_sessions_by_year[year] = await fetch_openf1_race_sessions_by_year(client, year)

    processed = []
    skipped = []
    index_entries = []
    all_pit_rows_for_aggregate = []
    outcome_matrix = []  # righe per aggregate.json: {race, driver, event, category}

    for race_row in race_rows:
        race_id = race_row["raceId"]
        year = int(race_row["year"])
        label = f"{race_row['name']} {year} (raceId {race_id})"

        lap_rows = ergast.lap_times_by_race.get(race_id, [])
        pit_rows = ergast.pit_stops_by_race.get(race_id, [])
        if not lap_rows:
            skipped.append((label, "nessun tempo sul giro in lap_times.csv (dati Ergast mancanti)"))
            continue

        openf1_session = match_openf1_session(race_row, openf1_sessions_by_year[year])
        if openf1_session is None:
            skipped.append((label, "nessuna sessione di gara OpenF1 trovata per questa data"))
            continue

        session_key = openf1_session["session_key"]
        meeting_key = openf1_session["meeting_key"]

        try:
            rc_raw = await client.get_race_control(session_key, meeting_key, year)
        except Exception as exc:  # noqa: BLE001 - vogliamo continuare sulle altre gare
            skipped.append((label, f"errore nel recupero race control OpenF1: {exc}"))
            await asyncio.sleep(RATE_LIMIT_SECONDS)
            continue

        rc_parsed = parse_rc_messages(rc_raw)
        windows, window_warnings = build_lap_indexed_windows(session_key, rc_parsed)
        for w in window_warnings:
            print(f"  [{label}] ATTENZIONE: {w}")

        race_json = build_race_json(ergast, race_row, windows)
        slug = slugify(race_row, ergast)

        races_dir = PUBLIC_DATA_DIR / "races"
        races_dir.mkdir(parents=True, exist_ok=True)
        out_path = races_dir / f"{slug}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(race_json, f, ensure_ascii=False)

        n_neutralizations = len(windows)
        index_entries.append(
            {
                "id": slug,
                "raceId": race_id,
                "year": year,
                "round": int(race_row["round"]),
                "name": race_row["name"],
                "circuit": race_json["race"]["circuit"],
                "totalNeutralizations": n_neutralizations,
                "interesting": n_neutralizations > 0,
            }
        )

        for driver in race_json["drivers"]:
            for pit in driver["pits"]:
                all_pit_rows_for_aggregate.append(
                    {
                        "raceId": slug,
                        "year": year,
                        "driverId": driver["driverId"],
                        "lap": pit["lap"],
                        "context": pit["context"],
                        "effectiveLoss": pit["effectiveLoss"],
                        "discount": pit["discount"],
                        "doubleStack": pit["doubleStack"],
                    }
                )
            for outcome in driver["outcomes"]:
                outcome_matrix.append(
                    {
                        "raceId": slug,
                        "year": year,
                        "driverId": driver["driverId"],
                        "eventId": outcome["eventId"],
                        "category": outcome["category"],
                        "posDelta": outcome["posDelta"],
                    }
                )

        n_excluded = race_json["race"]["excludedAnomalousLaps"]
        processed.append((label, n_neutralizations, out_path.stat().st_size, n_excluded))
        excluded_note = f", {n_excluded} giri anomali esclusi" if n_excluded else ""
        print(f"  OK  {label}: {n_neutralizations} neutralizzazioni, {out_path.stat().st_size // 1024} KB{excluded_note}")

        await asyncio.sleep(RATE_LIMIT_SECONDS)

    await client.close()

    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(PUBLIC_DATA_DIR / "index.json", "w", encoding="utf-8") as f:
        json.dump(index_entries, f, ensure_ascii=False, indent=2)

    with open(PUBLIC_DATA_DIR / "aggregate.json", "w", encoding="utf-8") as f:
        json.dump({"pitStops": all_pit_rows_for_aggregate, "outcomes": outcome_matrix}, f, ensure_ascii=False)

    params = {
        "tyreAgeMinLaps": TYRE_AGE_MIN_LAPS,
        "trafficMinCars": TRAFFIC_MIN_CARS,
        "postEventOutcomeOffsetLaps": POST_EVENT_OUTCOME_OFFSET,
        "justBeforeMaxLaps": JUST_BEFORE_MAX_LAPS,
        "justAfterMaxLaps": JUST_AFTER_MAX_LAPS,
        "baselineWindowLaps": BASELINE_WINDOW_LAPS,
        "baselineMinCleanLaps": BASELINE_MIN_CLEAN_LAPS,
        "minGreenStopsForConfidence": MIN_GREEN_STOPS_FOR_CONFIDENCE,
        "fieldReferenceMinSamples": FIELD_REFERENCE_MIN_SAMPLES,
    }
    with open(PUBLIC_DATA_DIR / "params.json", "w", encoding="utf-8") as f:
        json.dump(params, f, ensure_ascii=False, indent=2)

    return processed, skipped, index_entries


def main():
    processed, skipped, index_entries = asyncio.run(process_all_races())

    total_neutralizations = sum(n for _, n, _, _ in processed)
    total_excluded_laps = sum(e for _, _, _, e in processed)

    print("\n=== Report finale ===")
    print(f"Gare processate: {len(processed)} / {len(processed) + len(skipped)}")
    print(f"Gare saltate: {len(skipped)}")
    for label, reason in skipped:
        print(f"  - {label}: {reason}")
    print(f"Neutralizzazioni totali trovate: {total_neutralizations}")
    print(f"Giri con tempo anomalo esclusi (bandiere rosse, vedi MAX_PLAUSIBLE_LAP_MS): {total_excluded_laps}")
    races_with_excluded = [(label, e) for label, _, _, e in processed if e > 0]
    for label, e in races_with_excluded:
        print(f"  - {label}: {e} giri esclusi")

    races_files = sorted((PUBLIC_DATA_DIR / "races").glob("*.json"))
    if races_files:
        sizes_kb = [f.stat().st_size / 1024 for f in races_files]
        print(
            f"File di gara: {len(races_files)}, dimensione media {statistics.mean(sizes_kb):.0f} KB, "
            f"massima {max(sizes_kb):.0f} KB"
        )
    for name in ["index.json", "aggregate.json", "params.json"]:
        p = PUBLIC_DATA_DIR / name
        if p.exists():
            print(f"{name}: {p.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
