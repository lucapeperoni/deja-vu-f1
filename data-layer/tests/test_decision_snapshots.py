"""
Test del layer della decisione (docs/PROGETTAZIONE.md, sezione 5.6).
Usa dati sintetici piccoli, come test_effective_pit_loss.py.
"""

from app.metrics.decision_snapshots import (
    CATEGORY_LOCKED_OUT,
    CHOICE_BOX,
    CHOICE_FORCED,
    CHOICE_STAY,
    VERDICT_GAINED,
    VERDICT_LOST,
    VERDICT_NEUTRAL,
    build_event_decisions,
    classify_choice,
    classify_verdict,
    compute_combined_index,
    compute_expected_box_cost,
    compute_fresh_tyre_delta_per_lap,
    compute_gap_ahead_behind,
    compute_predicted_rejoin_position,
    compute_projected_ms_by_driver,
    compute_race_overtakability,
    compute_traffic_fraction,
    fill_combined_index,
    ols_slope,
    population_stats,
    to_json_record,
)


# ---------------------------------------------------------------------------
# classify_choice / classify_verdict
# ---------------------------------------------------------------------------

def test_classify_choice_box_when_pit_in_window():
    assert classify_choice(pit_in_window=True, outcome_category="NEUTRAL") == CHOICE_BOX


def test_classify_choice_forced_when_locked_out_and_no_pit():
    assert classify_choice(pit_in_window=False, outcome_category=CATEGORY_LOCKED_OUT) == CHOICE_FORCED


def test_classify_choice_stay_otherwise():
    assert classify_choice(pit_in_window=False, outcome_category="NEUTRAL") == CHOICE_STAY


def test_classify_verdict_gained():
    assert classify_verdict(1) == VERDICT_GAINED
    assert classify_verdict(5) == VERDICT_GAINED


def test_classify_verdict_lost():
    assert classify_verdict(-1) == VERDICT_LOST
    assert classify_verdict(-4) == VERDICT_LOST


def test_classify_verdict_neutral_zero_or_none():
    assert classify_verdict(0) == VERDICT_NEUTRAL
    assert classify_verdict(None) == VERDICT_NEUTRAL


# ---------------------------------------------------------------------------
# compute_expected_box_cost / compute_traffic_fraction
# ---------------------------------------------------------------------------

def test_compute_expected_box_cost_uses_median_of_reliable_costs():
    assert compute_expected_box_cost([10.0, 12.0, 14.0]) == 12.0


def test_compute_expected_box_cost_fallback_when_no_reliable_costs():
    assert compute_expected_box_cost([], fallback_cost_s=15.5) == 15.5


def test_compute_traffic_fraction():
    assert compute_traffic_fraction({"A": True, "B": True, "C": False, "D": False}) == 0.5


def test_compute_traffic_fraction_empty():
    assert compute_traffic_fraction({}) is None


# ---------------------------------------------------------------------------
# compute_gap_ahead_behind
# ---------------------------------------------------------------------------

def test_compute_gap_ahead_behind():
    ms_by_pos = {1: 100_000.0, 2: 105_000.0, 3: 112_000.0}
    gap_ahead, gap_behind = compute_gap_ahead_behind(pos=2, ms=105_000.0, ms_by_pos_at_deploy=ms_by_pos)
    assert gap_ahead == 5.0
    assert gap_behind == 7.0


def test_compute_gap_ahead_behind_leader_has_no_gap_ahead():
    ms_by_pos = {1: 100_000.0, 2: 105_000.0}
    gap_ahead, gap_behind = compute_gap_ahead_behind(pos=1, ms=100_000.0, ms_by_pos_at_deploy=ms_by_pos)
    assert gap_ahead is None
    assert gap_behind == 5.0


# ---------------------------------------------------------------------------
# compute_projected_ms_by_driver / compute_predicted_rejoin_position
#
# Caso Jeddah: se i rivali che boxano insieme al pilota in esame venissero
# trattati come "fermi", il rientro previsto sarebbe sistematicamente troppo
# indietro (era il bug della prima versione dello spike P1.1/P1.2).
# ---------------------------------------------------------------------------

def test_projected_ms_freezes_non_boxing_drivers():
    ms_at_deploy = {"A": 100_000.0, "B": 101_000.0}
    pit_in_window = {"A": True, "B": False}
    projected = compute_projected_ms_by_driver(ms_at_deploy, pit_in_window, expected_cost_s=10.0)
    assert projected["A"] == 100_000.0 + 10_000.0
    assert projected["B"] == 101_000.0


def test_predicted_rejoin_position_accounts_for_rivals_who_also_box():
    # 3 piloti appaiati a inizio SC; tutti boxano con lo stesso costo atteso:
    # l'ordine relativo non cambia, A resta primo.
    ms_at_deploy = {"A": 100_000.0, "B": 100_500.0, "C": 101_000.0}
    pit_in_window = {"A": True, "B": True, "C": True}
    projected = compute_projected_ms_by_driver(ms_at_deploy, pit_in_window, expected_cost_s=10.0)
    pos_a = compute_predicted_rejoin_position("A", projected["A"], projected)
    assert pos_a == 1

    # Se invece C NON boxa (resta fermo al suo tempo), scavalca chi si e' fermato.
    pit_in_window_2 = {"A": True, "B": True, "C": False}
    projected_2 = compute_projected_ms_by_driver(ms_at_deploy, pit_in_window_2, expected_cost_s=10.0)
    pos_a_2 = compute_predicted_rejoin_position("A", projected_2["A"], projected_2)
    assert pos_a_2 == 2  # C (101_000, non boxa) ora precede A (110_000 proiettato)


# ---------------------------------------------------------------------------
# indice combinato
# ---------------------------------------------------------------------------

def test_population_stats():
    mean, stdev = population_stats([1.0, 2.0, 3.0])
    assert mean == 2.0
    assert stdev > 0


def test_compute_combined_index_none_when_missing_input():
    assert compute_combined_index(None, 5.0, (0.5, 0.2), (5.0, 2.0)) is None
    assert compute_combined_index(0.5, None, (0.5, 0.2), (5.0, 2.0)) is None


def test_compute_combined_index_weighted_zscore():
    # traffico e margine entrambi 1 deviazione standard sopra la media ->
    # indice = 0.6*1 + 0.4*1 = 1.0 con i pesi di default
    idx = compute_combined_index(
        traffic_fraction=0.7, gap_behind=7.0, traffic_stats=(0.5, 0.2), gap_stats=(5.0, 2.0)
    )
    assert round(idx, 6) == 1.0


def test_fill_combined_index_excludes_not_needed_from_population():
    decisions = [
        {"not_needed": False, "snapshot": {"traffic_fraction": 0.2, "gap_behind": 1.0}, "combined_index": None},
        {"not_needed": False, "snapshot": {"traffic_fraction": 0.8, "gap_behind": 9.0}, "combined_index": None},
        # notNeeded con valori estremi: non deve spostare media/deviazione standard
        {"not_needed": True, "snapshot": {"traffic_fraction": 100.0, "gap_behind": 100.0}, "combined_index": None},
    ]
    fill_combined_index(decisions)
    assert decisions[0]["combined_index"] is not None
    assert decisions[1]["combined_index"] is not None
    # la media di popolazione (0.2, 0.8 / 1.0, 9.0) non include il record notNeeded:
    # il primo record (sotto media) deve avere indice negativo, il secondo positivo
    assert decisions[0]["combined_index"] < 0
    assert decisions[1]["combined_index"] > 0


# ---------------------------------------------------------------------------
# regressione gomme fresche
# ---------------------------------------------------------------------------

def test_ols_slope_perfect_line():
    pairs = [(0.0, 90.0), (1.0, 90.5), (2.0, 91.0), (3.0, 91.5)]
    assert round(ols_slope(pairs), 6) == 0.5


def test_ols_slope_needs_variance_in_x():
    assert ols_slope([(5.0, 90.0), (5.0, 91.0)]) is None


def test_compute_fresh_tyre_delta_per_lap_below_min_samples_is_none():
    pairs = [(float(i), 90.0 + 0.5 * i) for i in range(5)]
    assert compute_fresh_tyre_delta_per_lap(pairs, min_samples=20) is None


def test_compute_fresh_tyre_delta_per_lap_above_min_samples():
    pairs = [(float(i), 90.0 + 0.5 * i) for i in range(25)]
    assert round(compute_fresh_tyre_delta_per_lap(pairs, min_samples=20), 6) == 0.5


# ---------------------------------------------------------------------------
# sorpassabilità circuito
# ---------------------------------------------------------------------------

def test_compute_race_overtakability_ignores_neutralized_laps():
    pos_by_lap = {
        1: {"A": 1, "B": 2},
        2: {"A": 2, "B": 1},  # scambio in verde: delta 1 per entrambi
        3: {"A": 2, "B": 1},  # giro 3 e' sotto SC: va ignorato
        4: {"A": 3, "B": 1},  # confronto 3->4 coinvolge il giro neutralizzato: ignorato
    }
    value = compute_race_overtakability(pos_by_lap, neutralized_laps={3})
    assert value == 1.0  # solo la coppia (1,2) e' valida, delta medio = 1


def test_compute_race_overtakability_none_without_green_pairs():
    pos_by_lap = {1: {"A": 1}, 2: {"A": 1}}
    assert compute_race_overtakability(pos_by_lap, neutralized_laps={1, 2}) is None


# ---------------------------------------------------------------------------
# build_event_decisions: gara sintetica minima, verifica end-to-end
# ---------------------------------------------------------------------------

def _synthetic_race_json():
    """2 piloti, SC ai giri 3-4. HAM boxa nella finestra (costo 10s affidabile),
    VER resta fuori (LOCKED_OUT: gomme troppo fresche, coerente col v1)."""
    return {
        "race": {"laps": 10},
        "neutralizations": [{"eventId": "sc-1", "type": "SC", "startLap": 3, "endLap": 4}],
        "drivers": [
            {
                "id": "HAM",
                "driverId": "1",
                "laps": [
                    {"l": 3, "pos": 2, "ms": 300_000.0},
                    {"l": 4, "pos": 3, "ms": 410_000.0},
                ],
                "pits": [
                    {
                        "lap": 3,
                        "eventId": "sc-1",
                        "context": "UNDER_SC",
                        "effectiveLoss": 10.0,
                        "lowConfidence": False,
                    }
                ],
                "outcomes": [
                    {"eventId": "sc-1", "category": "EXPLOITED", "posDelta": -1, "tyreAge": 6, "tyreCompound": "MEDIUM"}
                ],
            },
            {
                "id": "VER",
                "driverId": "2",
                "laps": [
                    {"l": 3, "pos": 1, "ms": 295_000.0},
                    {"l": 4, "pos": 1, "ms": 305_000.0},
                ],
                "pits": [],
                "outcomes": [
                    {"eventId": "sc-1", "category": "LOCKED_OUT", "posDelta": 1, "tyreAge": 3, "tyreCompound": "SOFT"}
                ],
            },
        ],
    }


def test_build_event_decisions_end_to_end():
    race_json = _synthetic_race_json()
    event = race_json["neutralizations"][0]
    records = build_event_decisions(race_json, event, fresh_tyre_delta_per_lap=0.3)
    by_driver = {r["driver_id"]: r for r in records}

    assert by_driver["1"]["choice"] == CHOICE_BOX
    assert by_driver["1"]["box_option"]["expected_loss"] == 10.0
    assert by_driver["1"]["outcome"]["verdict"] == VERDICT_LOST
    assert by_driver["1"]["snapshot"]["traffic_fraction"] == 0.5  # 1 su 2 boxa

    assert by_driver["2"]["choice"] == CHOICE_FORCED
    assert by_driver["2"]["outcome"]["verdict"] == VERDICT_GAINED
    assert by_driver["2"]["not_needed"] is False


def test_to_json_record_uses_camel_case_schema():
    race_json = _synthetic_race_json()
    event = race_json["neutralizations"][0]
    record = build_event_decisions(race_json, event, fresh_tyre_delta_per_lap=None)[0]
    json_record = to_json_record(record)
    assert json_record["eventId"] == "sc-1"
    assert "gapBehind" in json_record["snapshot"]
    assert "predictedRejoinPos" in json_record["boxOption"]
    assert "posDelta5" in json_record["outcome"]
    assert "combinedIndex" in json_record
    assert "notNeeded" in json_record
