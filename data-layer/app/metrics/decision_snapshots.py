"""
Il layer del pivot: lo snapshot della decisione per pilota x neutralizzazione
(docs/PROGETTAZIONE.md sezione 5.6) e l'indice combinato della mappa "quando
conviene" (decisione presa dopo lo spike P1.2, stessa sezione).

Industrializzazione di data-layer/scripts/spike_decision_snapshot.py (P1.1)
e spike_decision_map.py (P1.2), validati su Jeddah/Bahrain/Australia 2023 e
su tutte le 46 gare. Le funzioni qui sotto operano sullo stesso schema JSON
già esportato (race/neutralizations/drivers[].{laps,pits,outcomes}) invece
che sugli oggetti interni della pipeline: cosi' si puo' verificare la parita'
con lo spike leggendo lo stesso file, ed e' lo stesso principio con cui
effective_pit_loss.py separa il calcolo puro dall'orchestrazione in
build_all.py.

Non ricalcola né tocca costo effettivo/sconto/etichetta di pit (§5.1-5.4):
legge solo i campi già scritti da calculate_pit_cost in `pits` (context,
effectiveLoss, lowConfidence, eventId) e da classify_outcome in `outcomes`
(category, posDelta, tyreAge, tyreCompound).

Decisione presa dopo lo spike P1.2 (nessuna coppia di 2 assi mostrava un
confine visibile su ~800 decisioni): la mappa aggregata "quando conviene"
non è uno scatter, è un confronto di distribuzioni sull'indice combinato
definito qui sotto (COMBINED_INDEX_WEIGHTS) — un vantaggio statistico
reale ma modesto (correlazione misurata nello spike: 0,34-0,36 con
l'esito), non una previsione. Lo snapshot per-evento (rientro previsto)
resta invece preciso (errore mediano 1 posizione, spike P1.1): è il
decisore vero, per caso singolo; l'indice combinato è un'euristica
aggregata dichiarata nella scheda decisione, non un rientro previsto.
"""

import statistics
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel

CONTEXT_UNDER_SC = "UNDER_SC"
CONTEXT_UNDER_VSC = "UNDER_VSC"
BOX_CONTEXTS = frozenset({CONTEXT_UNDER_SC, CONTEXT_UNDER_VSC})

CHOICE_BOX = "BOX"
CHOICE_STAY = "STAY"
CHOICE_FORCED = "FORCED"

VERDICT_GAINED = "GAINED"
VERDICT_LOST = "LOST"
VERDICT_NEUTRAL = "NEUTRAL"

CATEGORY_LOCKED_OUT = "LOCKED_OUT"
CATEGORY_NOT_NEEDED = "NOT_NEEDED"

# Soglie dichiarate (esportate anche in params.json, v. build_all.py)
BOX_FALLBACK_COST_SECONDS = 15.5  # mediana di campione (spike P1.1), usata solo se
# l'evento non ha nessun pit affidabile nello stesso contesto (SC o VSC)
VERDICT_GAIN_THRESHOLD = 1   # posDelta >= questa soglia -> GAINED
VERDICT_LOSS_THRESHOLD = -1  # posDelta <= questa soglia -> LOST
COMBINED_INDEX_WEIGHTS = {"trafficFraction": 0.6, "gapBehind": 0.4}  # pesi dichiarati a
# mano (non ottimizzati sui dati, campione troppo piccolo per un fit affidabile),
# in proporzione alla correlazione individuale misurata nello spike P1.2 (0,28 e 0,18)
MIN_SAMPLES_FOR_TYRE_REGRESSION = 20  # sotto questa soglia, freshTyreDeltaPerLap = None


class BoxOption(BaseModel):
    expected_loss: Optional[float] = None
    predicted_rejoin_pos: Optional[int] = None
    fresh_tyre_delta_per_lap: Optional[float] = None


class SnapshotState(BaseModel):
    pos: Optional[int] = None
    gap_ahead: Optional[float] = None
    gap_behind: Optional[float] = None
    tyre_age: Optional[int] = None
    compound: Optional[str] = None
    laps_remaining: Optional[int] = None
    stops_done: int = 0
    stops_typical: int = 0
    traffic_fraction: Optional[float] = None


class Outcome(BaseModel):
    pos_delta5: Optional[int] = None
    verdict: str = VERDICT_NEUTRAL


class DecisionSnapshot(BaseModel):
    event_id: str
    driver_id: str
    snapshot: SnapshotState
    box_option: BoxOption
    choice: str
    outcome: Outcome
    combined_index: Optional[float] = None
    not_needed: bool = False


# ---------------------------------------------------------------------------
# Blocchi puri, testabili con dati sintetici (come effective_pit_loss.py)
# ---------------------------------------------------------------------------

def classify_choice(pit_in_window: bool, outcome_category: str) -> str:
    """BOX se un pit del pilota cade in questa finestra con contesto
    UNDER_SC/UNDER_VSC; un pit JUST_AFTER (fuori da BOX_CONTEXTS) non conta
    come BOX, e' STAY, ha scelto di aspettare. FORCED se l'esito v1 era
    LOCKED_OUT (non poteva scegliere)."""
    if pit_in_window:
        return CHOICE_BOX
    if outcome_category == CATEGORY_LOCKED_OUT:
        return CHOICE_FORCED
    return CHOICE_STAY


def classify_verdict(pos_delta: Optional[int]) -> str:
    if pos_delta is None:
        return VERDICT_NEUTRAL
    if pos_delta >= VERDICT_GAIN_THRESHOLD:
        return VERDICT_GAINED
    if pos_delta <= VERDICT_LOSS_THRESHOLD:
        return VERDICT_LOST
    return VERDICT_NEUTRAL


def compute_expected_box_cost(
    reliable_costs_for_event: List[float], fallback_cost_s: float = BOX_FALLBACK_COST_SECONDS
) -> float:
    """Mediana degli effectiveLoss dei pit affidabili (context UNDER_SC/UNDER_VSC,
    lowConfidence=False, effectiveLoss non nullo) di QUESTO evento. Fallback
    dichiarato se l'evento non ne ha nessuno."""
    if reliable_costs_for_event:
        return statistics.median(reliable_costs_for_event)
    return fallback_cost_s


def compute_traffic_fraction(pit_in_window_by_driver: Dict[str, bool]) -> Optional[float]:
    """Quota dei piloti coinvolti nell'evento che hanno boxato in questa finestra
    (§5.6: "cosa fanno gli altri"). Stesso valore per ogni pilota dell'evento."""
    if not pit_in_window_by_driver:
        return None
    n_boxed = sum(1 for boxed in pit_in_window_by_driver.values() if boxed)
    return n_boxed / len(pit_in_window_by_driver)


def compute_gap_ahead_behind(
    pos: int, ms: float, ms_by_pos_at_deploy: Dict[int, float]
) -> Tuple[Optional[float], Optional[float]]:
    """Gap in secondi dal tempo cumulato di chi sta immediatamente davanti/dietro
    in classifica, allo stesso giro del deploy."""
    ahead_ms = ms_by_pos_at_deploy.get(pos - 1)
    behind_ms = ms_by_pos_at_deploy.get(pos + 1)
    gap_ahead = (ms - ahead_ms) / 1000 if ahead_ms is not None else None
    gap_behind = (behind_ms - ms) / 1000 if behind_ms is not None else None
    return gap_ahead, gap_behind


def compute_projected_ms_by_driver(
    ms_at_deploy_by_driver: Dict[str, float],
    pit_in_window_by_driver: Dict[str, bool],
    expected_cost_s: float,
) -> Dict[str, float]:
    """Tempo cumulato proiettato di OGNI pilota alla fine della finestra: chi
    boxa (davvero, nella realtà) viene proiettato in avanti dello stesso costo
    atteso generico; chi non boxa resta fermo al suo tempo del giro del
    deploy. Corregge la sovrastima del "rientro previsto" quando quasi tutto
    il gruppo si ferma insieme (verificato sullo spike P1.1 su Jeddah): senza
    questa correzione, i rivali che boxano vengono trattati come se restassero
    fermi, e il pilota in esame sembra scivolare più indietro di quanto farà
    davvero."""
    projected: Dict[str, float] = {}
    for driver_id, ms in ms_at_deploy_by_driver.items():
        if pit_in_window_by_driver.get(driver_id):
            projected[driver_id] = ms + expected_cost_s * 1000
        else:
            projected[driver_id] = ms
    return projected


def compute_predicted_rejoin_position(
    driver_id: str, own_projected_ms: float, projected_ms_by_driver: Dict[str, float]
) -> int:
    """Posizione di rientro prevista: conta quanti rivali hanno un tempo
    proiettato inferiore al proprio -> restano davanti."""
    cars_ahead = sum(
        1
        for other_id, other_ms in projected_ms_by_driver.items()
        if other_id != driver_id and other_ms < own_projected_ms
    )
    return cars_ahead + 1


def zscore(value: Optional[float], mean: float, stdev: float) -> Optional[float]:
    if value is None:
        return None
    return (value - mean) / (stdev or 1.0)


def population_stats(values: List[float]) -> Tuple[float, float]:
    mean = statistics.mean(values)
    stdev = statistics.pstdev(values) or 1.0
    return mean, stdev


def compute_combined_index(
    traffic_fraction: Optional[float],
    gap_behind: Optional[float],
    traffic_stats: Tuple[float, float],
    gap_stats: Tuple[float, float],
    weights: Dict[str, float] = COMBINED_INDEX_WEIGHTS,
) -> Optional[float]:
    """Indice combinato = somma pesata degli z-score di traffico e margine
    dietro (pesi dichiarati, v. modulo docstring). None se manca uno dei due
    input: coerente con lo spike, non si inventa un valore parziale."""
    if traffic_fraction is None or gap_behind is None:
        return None
    zt = zscore(traffic_fraction, *traffic_stats)
    zg = zscore(gap_behind, *gap_stats)
    return weights["trafficFraction"] * zt + weights["gapBehind"] * zg


def ols_slope(pairs: List[Tuple[float, float]]) -> Optional[float]:
    """Regressione lineare grezza (minimi quadrati) y su x: ritorna solo la
    pendenza. None se la varianza di x e' zero (tutti i punti con la stessa x)."""
    n = len(pairs)
    if n < 2:
        return None
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    mx, my = statistics.mean(xs), statistics.mean(ys)
    ss_xx = sum((x - mx) ** 2 for x in xs)
    if ss_xx == 0:
        return None
    ss_xy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return ss_xy / ss_xx


def compute_fresh_tyre_delta_per_lap(
    tyre_age_lap_time_pairs: List[Tuple[float, float]],
    min_samples: int = MIN_SAMPLES_FOR_TYRE_REGRESSION,
) -> Optional[float]:
    """Stima semplice (§5.6, "versione semplice") del vantaggio in s/giro delle
    gomme fresche: pendenza di una regressione grezza tempo-giro (s) su età
    gomma (giri), sui giri verdi della stessa gara. Positiva se le gomme più
    vecchie costano tempo (atteso). None se il campione è troppo piccolo per
    fidarsi di una pendenza (soglia dichiarata, come le altre della pipeline)."""
    if len(tyre_age_lap_time_pairs) < min_samples:
        return None
    return ols_slope(tyre_age_lap_time_pairs)


def compute_race_overtakability(
    pos_by_lap: Dict[int, Dict[str, int]], neutralized_laps: set
) -> Optional[float]:
    """Media dei cambi di posizione tra giri verdi consecutivi (§5.6): quanto
    si muove in media un pilota in classifica quando la pista è "in verde".
    Chi chiama questa funzione aggrega poi per circuito (stessa pista nelle 2
    stagioni condivide il valore)."""
    deltas: List[int] = []
    laps_sorted = sorted(pos_by_lap.keys())
    for prev_lap, lap in zip(laps_sorted, laps_sorted[1:]):
        if lap != prev_lap + 1:
            continue
        if prev_lap in neutralized_laps or lap in neutralized_laps:
            continue
        prev_pos = pos_by_lap[prev_lap]
        cur_pos = pos_by_lap[lap]
        for driver_id, pos in cur_pos.items():
            if driver_id in prev_pos:
                deltas.append(abs(pos - prev_pos[driver_id]))
    return statistics.mean(deltas) if deltas else None


# ---------------------------------------------------------------------------
# Orchestratore: uno snapshot per pilota x evento, per UNA gara già esportata
# ---------------------------------------------------------------------------

def build_event_decisions(race_json: Dict, event: Dict, fresh_tyre_delta_per_lap: Optional[float]) -> List[Dict]:
    """Costruisce i record decision (senza combinedIndex: serve la popolazione
    di TUTTE le gare, riempito in un secondo passaggio da build_all.py) per
    UNA neutralizzazione. Stessa logica dello spike P1.1/P1.2, operante sullo
    schema JSON già esportato (race_json["drivers"][i].{laps,pits,outcomes})."""
    event_id = event["eventId"]
    deploy_lap = event["startLap"]
    drivers = race_json["drivers"]
    race_laps = race_json["race"]["laps"]

    laps_by_driver = {d["id"]: {lap["l"]: lap for lap in d["laps"]} for d in drivers}

    reliable_costs = [
        pit["effectiveLoss"]
        for d in drivers
        for pit in d["pits"]
        if pit.get("eventId") == event_id
        and pit["context"] in BOX_CONTEXTS
        and not pit["lowConfidence"]
        and pit["effectiveLoss"] is not None
    ]
    expected_cost_s = compute_expected_box_cost(reliable_costs)

    ms_by_pos_at_deploy: Dict[int, float] = {}
    ms_at_deploy_by_driver: Dict[str, float] = {}
    pit_in_window_by_driver: Dict[str, bool] = {}
    pit_in_window_record_by_driver: Dict[str, Optional[Dict]] = {}

    for d in drivers:
        snap = laps_by_driver[d["id"]].get(deploy_lap)
        if snap is None:
            continue
        ms_by_pos_at_deploy[snap["pos"]] = snap["ms"]
        ms_at_deploy_by_driver[d["id"]] = snap["ms"]
        pit_in_window = next(
            (p for p in d["pits"] if p.get("eventId") == event_id and p["context"] in BOX_CONTEXTS),
            None,
        )
        pit_in_window_record_by_driver[d["id"]] = pit_in_window
        pit_in_window_by_driver[d["id"]] = pit_in_window is not None

    traffic_fraction = compute_traffic_fraction(pit_in_window_by_driver)
    projected_ms_by_driver = compute_projected_ms_by_driver(
        ms_at_deploy_by_driver, pit_in_window_by_driver, expected_cost_s
    )

    records: List[Dict] = []
    for d in drivers:
        snap = laps_by_driver[d["id"]].get(deploy_lap)
        if snap is None:
            continue
        outcome = next((o for o in d["outcomes"] if o["eventId"] == event_id), None)
        if outcome is None:
            continue

        pos, ms = snap["pos"], snap["ms"]
        gap_ahead, gap_behind = compute_gap_ahead_behind(pos, ms, ms_by_pos_at_deploy)

        pits_before = sum(1 for p in d["pits"] if p["lap"] < deploy_lap)
        stops_typical = len(d["pits"])

        pit_in_window = pit_in_window_record_by_driver.get(d["id"])
        choice = classify_choice(pit_in_window is not None, outcome["category"])
        verdict = classify_verdict(outcome["posDelta"])

        own_projected_ms = ms + expected_cost_s * 1000
        predicted_rejoin_pos = compute_predicted_rejoin_position(
            d["id"], own_projected_ms, projected_ms_by_driver
        )

        records.append(
            DecisionSnapshot(
                event_id=event_id,
                driver_id=d["driverId"],
                snapshot=SnapshotState(
                    pos=pos,
                    gap_ahead=gap_ahead,
                    gap_behind=gap_behind,
                    tyre_age=outcome.get("tyreAge"),
                    compound=outcome.get("tyreCompound"),
                    laps_remaining=race_laps - deploy_lap,
                    stops_done=pits_before,
                    stops_typical=stops_typical,
                    traffic_fraction=traffic_fraction,
                ),
                box_option=BoxOption(
                    expected_loss=expected_cost_s,
                    predicted_rejoin_pos=predicted_rejoin_pos,
                    fresh_tyre_delta_per_lap=fresh_tyre_delta_per_lap,
                ),
                choice=choice,
                outcome=Outcome(pos_delta5=outcome["posDelta"], verdict=verdict),
                combined_index=None,
                not_needed=outcome["category"] == CATEGORY_NOT_NEEDED,
            ).model_dump(by_alias=False)
        )

    return records


def build_race_decisions(race_json: Dict, fresh_tyre_delta_per_lap: Optional[float]) -> List[Dict]:
    """Tutti i record decision di una gara (tutte le sue neutralizzazioni)."""
    decisions: List[Dict] = []
    for event in race_json["neutralizations"]:
        decisions.extend(build_event_decisions(race_json, event, fresh_tyre_delta_per_lap))
    return decisions


def fill_combined_index(all_decisions: List[Dict]) -> None:
    """Secondo passaggio (in-place): calcola combinedIndex su OGNI record,
    usando media/deviazione standard di trafficFraction e gapBehind calcolate
    sulla popolazione dei record NON notNeeded (§5.6: i NOT_NEEDED non sono
    decisioni reali, non devono influenzare la normalizzazione)."""
    population = [d for d in all_decisions if not d["not_needed"]]
    traffic_values = [
        d["snapshot"]["traffic_fraction"] for d in population if d["snapshot"]["traffic_fraction"] is not None
    ]
    gap_values = [d["snapshot"]["gap_behind"] for d in population if d["snapshot"]["gap_behind"] is not None]
    if not traffic_values or not gap_values:
        return

    traffic_stats = population_stats(traffic_values)
    gap_stats = population_stats(gap_values)

    for d in all_decisions:
        d["combined_index"] = compute_combined_index(
            d["snapshot"]["traffic_fraction"], d["snapshot"]["gap_behind"], traffic_stats, gap_stats
        )


def to_json_record(d: Dict) -> Dict:
    """Traduce un record interno (snake_case, come prodotto da build_event_decisions
    e arricchito da fill_combined_index) nello schema camelCase del JSON di gara,
    coerente con il resto di public/data/races/*.json (es. pits_json/outcomes_json
    in build_all.py)."""
    s, b, o = d["snapshot"], d["box_option"], d["outcome"]
    return {
        "eventId": d["event_id"],
        "driverId": d["driver_id"],
        "snapshot": {
            "pos": s["pos"],
            "gapAhead": s["gap_ahead"],
            "gapBehind": s["gap_behind"],
            "tyreAge": s["tyre_age"],
            "compound": s["compound"],
            "lapsRemaining": s["laps_remaining"],
            "stopsDone": s["stops_done"],
            "stopsTypical": s["stops_typical"],
            "trafficFraction": s["traffic_fraction"],
        },
        "boxOption": {
            "expectedLoss": b["expected_loss"],
            "predictedRejoinPos": b["predicted_rejoin_pos"],
            "freshTyreDeltaPerLap": b["fresh_tyre_delta_per_lap"],
        },
        "choice": d["choice"],
        "outcome": {
            "posDelta5": o["pos_delta5"],
            "verdict": o["verdict"],
        },
        "combinedIndex": d["combined_index"],
        "notNeeded": d["not_needed"],
    }
