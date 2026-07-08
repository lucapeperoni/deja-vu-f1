"""
Test della metrica del costo effettivo del pit stop (docs/PROGETTAZIONE.md,
sezione 5). Usa una gara sintetica di 10 giri con una VSC ai giri 6-7.
"""

from app.metrics.effective_pit_loss import (
    CONTEXT_GREEN,
    CONTEXT_JUST_AFTER,
    CONTEXT_JUST_BEFORE,
    CONTEXT_UNDER_SC,
    CONTEXT_UNDER_VSC,
    NeutralizationWindow,
    calculate_pit_cost,
    classify_pit_context,
    compute_baseline,
    compute_field_reference_by_lap,
)

VSC_WINDOW = [NeutralizationWindow(event_id="vsc-1", type="VSC", start_lap=6, end_lap=7)]


# ---------------------------------------------------------------------------
# classify_pit_context
# ---------------------------------------------------------------------------

def test_classify_pit_context_green_far_from_window():
    context, event_id = classify_pit_context(pit_lap=1, windows=VSC_WINDOW)
    assert context == CONTEXT_GREEN
    assert event_id is None


def test_classify_pit_context_under_vsc_on_in_lap():
    context, event_id = classify_pit_context(pit_lap=6, windows=VSC_WINDOW)
    assert context == CONTEXT_UNDER_VSC
    assert event_id == "vsc-1"


def test_classify_pit_context_under_vsc_on_out_lap():
    # pit al giro 5: giro di uscita è il 6, dentro la finestra VSC
    context, event_id = classify_pit_context(pit_lap=5, windows=VSC_WINDOW)
    assert context == CONTEXT_UNDER_VSC
    assert event_id == "vsc-1"


def test_classify_pit_context_just_before():
    # pit al giro 4: in-lap/out-lap sono 4 e 5, non toccano la finestra 6-7,
    # ma mancano solo 2 giri all'inizio della VSC -> e' un "fregato"
    context, event_id = classify_pit_context(pit_lap=4, windows=VSC_WINDOW)
    assert context == CONTEXT_JUST_BEFORE
    assert event_id == "vsc-1"


def test_classify_pit_context_just_before_out_of_range():
    # pit al giro 2: 6-2=4 > soglia di 3 giri -> non e' piu' "fregato"
    context, _ = classify_pit_context(pit_lap=2, windows=VSC_WINDOW)
    assert context == CONTEXT_GREEN


def test_classify_pit_context_just_after():
    # la VSC finisce al giro 7; un pit al giro 9 e' entro 2 giri dalla fine
    context, event_id = classify_pit_context(pit_lap=9, windows=VSC_WINDOW)
    assert context == CONTEXT_JUST_AFTER
    assert event_id == "vsc-1"


# ---------------------------------------------------------------------------
# compute_baseline
# ---------------------------------------------------------------------------

def test_compute_baseline_uses_window_when_enough_clean_laps():
    # pilota con un solo pit al giro 3, nessuna neutralizzazione vicina:
    # nella finestra +-5 restano abbastanza giri puliti, niente widening
    lap_times = {1: 90_000, 2: 90_000, 3: 112_000, 4: 100_000, 5: 90_000,
                 8: 90_000, 9: 90_000, 10: 90_000}
    baseline = compute_baseline(
        driver_lap_times_ms=lap_times,
        pit_affected_laps={3, 4},
        neutralized_laps=set(),
        pit_laps_sorted=[3],
        center_lap=3,
        total_laps=10,
    )
    assert baseline == 90_000


def test_compute_baseline_widens_to_stint_when_not_enough_clean_laps():
    # pilota con tre pit ravvicinati (giri 2, 4, 9) e una VSC 6-7: nella
    # finestra +-5 attorno al pit di giro 4 restano solo i giri 1 e 8
    # puliti (< 3 richiesti), quindi si allarga allo stint [4, 8], che
    # esclude il giro 1 (fuori stint) e i giri 6-7 (neutralizzati).
    lap_times = {1: 80_000, 4: 999_999, 5: 999_999, 8: 90_000, 9: 999_999, 10: 999_999}
    baseline = compute_baseline(
        driver_lap_times_ms=lap_times,
        pit_affected_laps={2, 3, 4, 5, 9, 10},
        neutralized_laps={6, 7},
        pit_laps_sorted=[2, 4, 9],
        center_lap=4,
        total_laps=10,
    )
    # se non si allargasse correttamente allo stint, il giro 1 (80_000)
    # entrerebbe nel calcolo e la baseline sarebbe la mediana di {80000, 90000}
    assert baseline == 90_000


def test_compute_baseline_returns_none_without_any_clean_lap():
    baseline = compute_baseline(
        driver_lap_times_ms={5: 90_000},
        pit_affected_laps={5, 6},
        neutralized_laps=set(),
        pit_laps_sorted=[5],
        center_lap=5,
        total_laps=5,
    )
    assert baseline is None


# ---------------------------------------------------------------------------
# calculate_pit_cost — scenario end-to-end su una gara sintetica di 10 giri
# ---------------------------------------------------------------------------

def _clean_laps(driver_id: str, value_ms: float, laps=range(1, 11)) -> list:
    return [{"driver_id": driver_id, "lap": l, "milliseconds": value_ms} for l in laps]


def _race_scenario():
    neutralizations = [{"event_id": "vsc-1", "type": "VSC", "start_lap": 6, "end_lap": 7}]

    laps = []

    # Driver "1": pit in verde al giro 2, abbastanza lontano dalla VSC (6-7)
    # da non ricadere nella finestra "fregato" (soglia di 3 giri, sezione 5.4)
    laps += _clean_laps("1", 90_000, laps=[1, 4, 5, 6, 7, 8, 9, 10])
    laps += [
        {"driver_id": "1", "lap": 2, "milliseconds": 112_000},
        {"driver_id": "1", "lap": 3, "milliseconds": 100_000},
    ]

    # Driver "44": pit al giro 6, dentro la finestra VSC (sconto atteso)
    laps += _clean_laps("44", 90_000, laps=[1, 2, 3, 4, 5, 8, 9, 10])
    laps += [
        {"driver_id": "44", "lap": 6, "milliseconds": 100_000},
        {"driver_id": "44", "lap": 7, "milliseconds": 95_000},
    ]

    # Driver "77": pit al giro 4, "fregato" a 2 giri dalla VSC (paga prezzo pieno)
    laps += _clean_laps("77", 90_000, laps=[1, 2, 3, 6, 7, 8, 9])
    laps += [
        {"driver_id": "77", "lap": 4, "milliseconds": 112_000},
        {"driver_id": "77", "lap": 5, "milliseconds": 100_000},
    ]

    pit_stops = [
        {"driver_id": "1", "lap": 2},
        {"driver_id": "44", "lap": 6},
        {"driver_id": "77", "lap": 4},
    ]

    return laps, pit_stops, neutralizations


def test_calculate_pit_cost_context_labels():
    laps, pit_stops, neutralizations = _race_scenario()
    results = calculate_pit_cost(laps, pit_stops, neutralizations)
    by_driver = {r.driver_id: r for r in results}

    assert by_driver["1"].context == CONTEXT_GREEN
    assert by_driver["44"].context == CONTEXT_UNDER_VSC
    assert by_driver["44"].event_id == "vsc-1"
    assert by_driver["77"].context == CONTEXT_JUST_BEFORE


def test_calculate_pit_cost_effective_loss_and_baseline():
    laps, pit_stops, neutralizations = _race_scenario()
    results = calculate_pit_cost(laps, pit_stops, neutralizations)
    by_driver = {r.driver_id: r for r in results}

    # baseline pulita a 90s per tutti (i giri neutralizzati/di pit sono esclusi)
    assert by_driver["1"].baseline_lap_ms == 90_000
    assert by_driver["44"].baseline_lap_ms == 90_000
    assert by_driver["77"].baseline_lap_ms == 90_000

    # costo effettivo = (in-lap + out-lap) - 2*baseline, in secondi
    assert by_driver["1"].effective_pit_loss_seconds == 32.0     # (112000+100000-180000)/1000
    assert by_driver["44"].effective_pit_loss_seconds == 15.0    # (100000+95000-180000)/1000
    assert by_driver["77"].effective_pit_loss_seconds == 32.0    # identico al pit in verde


def test_calculate_pit_cost_nominal_and_discount():
    laps, pit_stops, neutralizations = _race_scenario()
    results = calculate_pit_cost(laps, pit_stops, neutralizations)
    by_driver = {r.driver_id: r for r in results}

    # unico pit in verde della gara (driver "1") -> prezzo di listino = suo costo
    assert by_driver["1"].nominal_pit_loss_seconds == 32.0

    # sconto = prezzo di listino - costo effettivo
    assert by_driver["44"].discount_seconds == 17.0   # 32 - 15: la VSC ha fatto risparmiare
    assert by_driver["77"].discount_seconds == 0.0     # nessuno sconto: ha pagato prezzo pieno

    # con un solo pit in verde su tre, la confidenza e' bassa (< 4, soglia della specifica)
    assert all(r.low_confidence for r in results)


def test_calculate_pit_cost_double_stack_flag():
    neutralizations = []
    laps = (
        _clean_laps("10", 90_000, laps=[1, 2, 3, 4, 5, 6, 7, 9, 10])
        + [{"driver_id": "10", "lap": 8, "milliseconds": 110_000}]
        + _clean_laps("11", 90_000, laps=[1, 2, 3, 4, 5, 6, 7, 9, 10])
        + [{"driver_id": "11", "lap": 8, "milliseconds": 118_000}]
        + _clean_laps("20", 90_000, laps=[1, 2, 3, 4, 5, 6, 7, 8, 10])
        + [{"driver_id": "20", "lap": 9, "milliseconds": 112_000}]
    )
    pit_stops = [
        {"driver_id": "10", "lap": 8, "team_id": "red_bull"},
        {"driver_id": "11", "lap": 8, "team_id": "red_bull"},   # double stack col compagno
        {"driver_id": "20", "lap": 9, "team_id": "mercedes"},   # nessun compagno allo stesso giro
    ]

    results = calculate_pit_cost(laps, pit_stops, neutralizations)
    by_driver = {r.driver_id: r for r in results}

    assert by_driver["10"].double_stack is True
    assert by_driver["11"].double_stack is True
    assert by_driver["20"].double_stack is False


# ---------------------------------------------------------------------------
# compute_field_reference_by_lap — il ritmo del gruppo sotto neutralizzazione
# ---------------------------------------------------------------------------
#
# Bug reale trovato validando la pipeline sulla gara campione (Singapore
# 2023): confrontare il giro di un pilota fermo sotto Safety Car con il SUO
# ritmo normale gonfiava il costo a dismisura, perché sotto SC rallenta
# TUTTO il gruppo, non solo chi si ferma. Il riferimento giusto per quei
# giri è il ritmo di chi resta in pista nello stesso giro.

def test_compute_field_reference_by_lap_excludes_pitting_drivers():
    lap_times_by_driver = {
        "B": {4: 130_000, 5: 130_000},
        "C": {4: 130_000, 5: 130_000},
        "D": {4: 130_000, 5: 130_000},
        # "A" si ferma proprio ai giri 4 e 5: il suo tempo (rallentato anche
        # dal pit stop, non solo dalla SC) non deve inquinare il riferimento
        "A": {4: 200_000, 5: 200_000},
    }
    pit_affected = {"A": {4, 5}}

    reference = compute_field_reference_by_lap(lap_times_by_driver, pit_affected, laps_to_cover={4, 5})

    assert reference == {4: 130_000, 5: 130_000}


def test_compute_field_reference_by_lap_skips_laps_below_min_samples():
    # solo 2 piloti disponibili per il giro 4, sotto la soglia di 3
    lap_times_by_driver = {"B": {4: 130_000}, "C": {4: 130_000}}
    reference = compute_field_reference_by_lap(lap_times_by_driver, {}, laps_to_cover={4})
    assert reference == {}


def test_calculate_pit_cost_under_sc_uses_field_pace_not_personal_baseline():
    """
    Gara sintetica di 10 giri, SC ai giri 6-7. Tre piloti (B, C, D) restano
    in pista e sotto SC rallentano tutti a 130s/giro (contro i 90s normali).
    Il pilota A si ferma proprio durante la SC: il suo costo effettivo deve
    riflettere il pit stop, non il rallentamento imposto dalla SC a tutti.
    """
    neutralizations = [{"event_id": "sc-1", "type": "SC", "start_lap": 6, "end_lap": 7}]

    laps = []
    for driver in ["B", "C", "D"]:
        for lap in range(1, 11):
            value = 130_000 if lap in (6, 7) else 90_000
            laps.append({"driver_id": driver, "lap": lap, "milliseconds": value})

    laps += [
        {"driver_id": "A", "lap": 1, "milliseconds": 90_000},
        {"driver_id": "A", "lap": 2, "milliseconds": 90_000},
        {"driver_id": "A", "lap": 3, "milliseconds": 90_000},
        {"driver_id": "A", "lap": 4, "milliseconds": 90_000},
        {"driver_id": "A", "lap": 5, "milliseconds": 90_000},
        {"driver_id": "A", "lap": 6, "milliseconds": 140_000},  # in-lap, sotto SC
        {"driver_id": "A", "lap": 7, "milliseconds": 135_000},  # out-lap, sotto SC
        {"driver_id": "A", "lap": 8, "milliseconds": 90_000},
        {"driver_id": "A", "lap": 9, "milliseconds": 90_000},
        {"driver_id": "A", "lap": 10, "milliseconds": 90_000},
    ]

    # E: pit in verde, lontano dalla SC, serve da prezzo di listino
    laps += [
        {"driver_id": "E", "lap": 1, "milliseconds": 112_000},
        {"driver_id": "E", "lap": 2, "milliseconds": 100_000},
        {"driver_id": "E", "lap": 3, "milliseconds": 90_000},
        {"driver_id": "E", "lap": 4, "milliseconds": 90_000},
        {"driver_id": "E", "lap": 5, "milliseconds": 90_000},
        {"driver_id": "E", "lap": 6, "milliseconds": 130_000},
        {"driver_id": "E", "lap": 7, "milliseconds": 130_000},
        {"driver_id": "E", "lap": 8, "milliseconds": 90_000},
        {"driver_id": "E", "lap": 9, "milliseconds": 90_000},
        {"driver_id": "E", "lap": 10, "milliseconds": 90_000},
    ]

    pit_stops = [
        {"driver_id": "A", "lap": 6},
        {"driver_id": "E", "lap": 1},
    ]

    results = calculate_pit_cost(laps, pit_stops, neutralizations)
    by_driver = {r.driver_id: r for r in results}

    assert by_driver["A"].context == CONTEXT_UNDER_SC
    # la baseline personale di A resta il suo ritmo verde (90s)...
    assert by_driver["A"].baseline_lap_ms == 90_000
    # ...ma il costo effettivo usa il ritmo del gruppo sotto SC (130s) come
    # riferimento per i giri 6 e 7, non i 90s abituali di A:
    # (140000-130000) + (135000-130000) = 15000ms
    assert by_driver["A"].effective_pit_loss_seconds == 15.0

    # il pit in verde di E non e' toccato dal riferimento di gruppo
    assert by_driver["E"].effective_pit_loss_seconds == 32.0

    # ora lo sconto e' positivo: fermarsi sotto SC costa MENO del prezzo
    # di listino, come atteso dalla sezione 5.3 della specifica
    assert by_driver["A"].discount_seconds == 17.0
    assert by_driver["A"].discount_seconds > 0
