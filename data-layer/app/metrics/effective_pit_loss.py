"""
Calcolo del costo effettivo di un pit stop e dello sconto da neutralizzazione.

Vedi docs/PROGETTAZIONE.md sezione 5 per le definizioni operative.

Punto centrale: il costo di un pit stop NON è la durata in pit lane
(pit_duration di OpenF1) — quella è quasi identica in verde e sotto
Safety Car. Lo sconto nasce dal fatto che, mentre un pilota attraversa la
pit lane, gli altri piloti in pista vanno anch'essi piano. Il costo si
misura quindi dai tempi sul giro (Ergast lap_times.csv), confrontando il
giro di entrata e il giro di uscita ai box con il ritmo "normale" del
pilota in quel momento della gara.

Le finestre di neutralizzazione (SC/VSC) vanno passate già espresse in
numero di giro (start_lap, end_lap): la conversione dai timestamp OpenF1
di neutralization_events.py al numero di giro è compito della pipeline
(vedi build_all.py, task 2.1 della roadmap), non di questo modulo.
"""

from typing import List, Dict, Optional, Set, Tuple
from pydantic import BaseModel
import statistics

# Soglie dichiarate (vedi docs/PROGETTAZIONE.md sezione 5.4/5.5 e 10.6)
BASELINE_WINDOW_LAPS = 5
BASELINE_MIN_CLEAN_LAPS = 3
JUST_BEFORE_MAX_LAPS = 3
JUST_AFTER_MAX_LAPS = 2
MIN_GREEN_STOPS_FOR_CONFIDENCE = 4

CONTEXT_GREEN = "GREEN"
CONTEXT_UNDER_VSC = "UNDER_VSC"
CONTEXT_UNDER_SC = "UNDER_SC"
CONTEXT_JUST_BEFORE = "JUST_BEFORE"
CONTEXT_JUST_AFTER = "JUST_AFTER"


class NeutralizationWindow(BaseModel):
    """Finestra di neutralizzazione espressa in numero di giro."""
    event_id: str
    type: str  # "SC" oppure "VSC"
    start_lap: int
    end_lap: int


class PitCostImpact(BaseModel):
    pit_stop_id: str
    driver_id: str
    lap: int
    context: str
    event_id: Optional[str] = None
    baseline_lap_ms: Optional[float] = None
    effective_pit_loss_seconds: Optional[float] = None
    nominal_pit_loss_seconds: Optional[float] = None
    discount_seconds: Optional[float] = None
    double_stack: bool = False
    low_confidence: bool = False


def _context_for_window_type(window_type: str) -> str:
    return CONTEXT_UNDER_SC if window_type.upper() == "SC" else CONTEXT_UNDER_VSC


def classify_pit_context(
    pit_lap: int, windows: List[NeutralizationWindow]
) -> Tuple[str, Optional[str]]:
    """
    Assegna l'etichetta di contesto di un pit stop (sezione 5.4 della specifica).

    Un pit stop occupa il giro di entrata (pit_lap) e il giro di uscita
    (pit_lap + 1): se una neutralizzazione è attiva in uno dei due giri,
    il pit è "sotto" quella neutralizzazione.
    """
    in_out_laps = {pit_lap, pit_lap + 1}

    for w in windows:
        window_laps = set(range(w.start_lap, w.end_lap + 1))
        if in_out_laps & window_laps:
            return _context_for_window_type(w.type), w.event_id

    just_before_candidates = [
        w for w in windows if 0 < (w.start_lap - pit_lap) <= JUST_BEFORE_MAX_LAPS
    ]
    if just_before_candidates:
        nearest = min(just_before_candidates, key=lambda w: w.start_lap - pit_lap)
        return CONTEXT_JUST_BEFORE, nearest.event_id

    just_after_candidates = [
        w for w in windows if 0 < (pit_lap - w.end_lap) <= JUST_AFTER_MAX_LAPS
    ]
    if just_after_candidates:
        nearest = min(just_after_candidates, key=lambda w: pit_lap - w.end_lap)
        return CONTEXT_JUST_AFTER, nearest.event_id

    return CONTEXT_GREEN, None


def _pit_affected_laps(driver_pit_laps: List[int]) -> Set[int]:
    """Tutti i giri di entrata/uscita di un pilota, per l'intera gara."""
    affected: Set[int] = set()
    for lap in driver_pit_laps:
        affected.add(lap)
        affected.add(lap + 1)
    return affected


def _neutralized_laps(windows: List[NeutralizationWindow]) -> Set[int]:
    laps: Set[int] = set()
    for w in windows:
        laps.update(range(w.start_lap, w.end_lap + 1))
    return laps


def _stint_bounds(
    pit_laps_sorted: List[int], center_lap: int, total_laps: int
) -> Tuple[int, int]:
    """
    Confini dello stint che contiene center_lap: dal giro dopo l'uscita
    dal pit precedente al giro prima dell'entrata al pit successivo.
    """
    stint_start = 1
    for lap in pit_laps_sorted:
        if lap < center_lap:
            stint_start = lap + 2  # il giro dopo l'out-lap del pit precedente
        else:
            break

    stint_end = total_laps
    for lap in pit_laps_sorted:
        if lap > center_lap:
            stint_end = lap - 1  # il giro prima dell'in-lap del pit successivo
            break

    return stint_start, stint_end


def compute_baseline(
    driver_lap_times_ms: Dict[int, float],
    pit_affected_laps: Set[int],
    neutralized_laps: Set[int],
    pit_laps_sorted: List[int],
    center_lap: int,
    total_laps: int,
) -> Optional[float]:
    """
    Baseline del pilota (mediana dei giri "puliti") attorno a center_lap.

    "Pulito" = non è un giro di entrata/uscita da nessun pit stop del
    pilota, non è un giro con neutralizzazione attiva, ed esiste un tempo
    registrato per quel giro.

    Se nella finestra di ±BASELINE_WINDOW_LAPS ci sono meno di
    BASELINE_MIN_CLEAN_LAPS giri puliti, la ricerca si allarga a tutto lo
    stint che contiene center_lap.
    """

    def clean_laps_in_range(lo: int, hi: int) -> List[float]:
        return [
            driver_lap_times_ms[lap]
            for lap in range(lo, hi + 1)
            if lap in driver_lap_times_ms
            and lap not in pit_affected_laps
            and lap not in neutralized_laps
        ]

    window_lo = max(1, center_lap - BASELINE_WINDOW_LAPS)
    window_hi = min(total_laps, center_lap + BASELINE_WINDOW_LAPS)
    clean = clean_laps_in_range(window_lo, window_hi)

    if len(clean) < BASELINE_MIN_CLEAN_LAPS:
        stint_start, stint_end = _stint_bounds(pit_laps_sorted, center_lap, total_laps)
        clean = clean_laps_in_range(stint_start, stint_end)

    if not clean:
        return None
    return statistics.median(clean)


def _effective_pit_loss_seconds(
    driver_lap_times_ms: Dict[int, float], pit_lap: int, baseline_ms: Optional[float]
) -> Optional[float]:
    """
    costo effettivo = (tempo giro entrata + tempo giro uscita) - 2 * baseline

    Se il giro di uscita non esiste (es. pit stop nell'ultimo giro di
    gara), si usa la sola perdita sul giro di entrata rispetto alla
    baseline, raddoppiata coerentemente con la formula.
    """
    if baseline_ms is None:
        return None

    in_lap_ms = driver_lap_times_ms.get(pit_lap)
    if in_lap_ms is None:
        return None

    out_lap_ms = driver_lap_times_ms.get(pit_lap + 1)
    if out_lap_ms is None:
        out_lap_ms = baseline_ms  # nessuna perdita aggiuntiva stimabile sul giro mancante

    return ((in_lap_ms + out_lap_ms) - 2 * baseline_ms) / 1000.0


def calculate_pit_cost(
    laps: List[Dict],
    pit_stops: List[Dict],
    neutralizations: List[Dict],
) -> List[PitCostImpact]:
    """
    Calcola costo effettivo, prezzo di listino, sconto ed etichetta di
    contesto per ogni pit stop di una gara.

    Parametri (schema Ergast, driver_id/lap come chiavi):
      laps: [{"driver_id": ..., "lap": int, "milliseconds": float}, ...]
      pit_stops: [{"driver_id": ..., "lap": int, "stop": int (opz.),
                   "team_id": ... (opz., per il flag double_stack)}, ...]
      neutralizations: [{"event_id": str, "type": "SC"|"VSC",
                         "start_lap": int, "end_lap": int}, ...]
    """
    windows = [NeutralizationWindow(**n) for n in neutralizations]
    total_laps = max((l["lap"] for l in laps), default=0)

    # Tempi giro per pilota
    lap_times_by_driver: Dict[str, Dict[int, float]] = {}
    for l in laps:
        driver_id = str(l["driver_id"])
        lap_times_by_driver.setdefault(driver_id, {})[l["lap"]] = float(l["milliseconds"])

    # Giri di pit per pilota (serve per i confini di stint e i giri da escludere)
    pit_laps_by_driver: Dict[str, List[int]] = {}
    for p in pit_stops:
        driver_id = str(p["driver_id"])
        pit_laps_by_driver.setdefault(driver_id, []).append(p["lap"])
    for driver_id in pit_laps_by_driver:
        pit_laps_by_driver[driver_id].sort()

    neutralized_laps = _neutralized_laps(windows)

    # Double stack: due piloti dello stesso team fermi nello stesso giro
    stops_by_lap_team: Dict[Tuple[int, str], List[Dict]] = {}
    for p in pit_stops:
        team_id = p.get("team_id")
        if team_id is None:
            continue
        stops_by_lap_team.setdefault((p["lap"], str(team_id)), []).append(p)

    results: List[PitCostImpact] = []

    for p in pit_stops:
        driver_id = str(p["driver_id"])
        pit_lap = p["lap"]

        driver_lap_times = lap_times_by_driver.get(driver_id, {})
        pit_laps_sorted = pit_laps_by_driver.get(driver_id, [])
        affected_laps = _pit_affected_laps(pit_laps_sorted)

        baseline_ms = compute_baseline(
            driver_lap_times,
            affected_laps,
            neutralized_laps,
            pit_laps_sorted,
            pit_lap,
            total_laps,
        )
        effective_loss = _effective_pit_loss_seconds(driver_lap_times, pit_lap, baseline_ms)
        context, event_id = classify_pit_context(pit_lap, windows)

        team_id = p.get("team_id")
        double_stack = False
        if team_id is not None:
            same_stop = stops_by_lap_team.get((pit_lap, str(team_id)), [])
            double_stack = len(same_stop) > 1

        results.append(
            PitCostImpact(
                pit_stop_id=f"pit-{driver_id}-{pit_lap}",
                driver_id=driver_id,
                lap=pit_lap,
                context=context,
                event_id=event_id,
                baseline_lap_ms=baseline_ms,
                effective_pit_loss_seconds=effective_loss,
                double_stack=double_stack,
            )
        )

    # Prezzo di listino: mediana dei costi effettivi dei pit in verde
    green_losses = [
        r.effective_pit_loss_seconds
        for r in results
        if r.context == CONTEXT_GREEN and r.effective_pit_loss_seconds is not None
    ]
    nominal_pit_loss = statistics.median(green_losses) if green_losses else None
    low_confidence = len(green_losses) < MIN_GREEN_STOPS_FOR_CONFIDENCE

    for r in results:
        r.nominal_pit_loss_seconds = nominal_pit_loss
        r.low_confidence = low_confidence
        if nominal_pit_loss is not None and r.effective_pit_loss_seconds is not None:
            r.discount_seconds = nominal_pit_loss - r.effective_pit_loss_seconds

    return results
