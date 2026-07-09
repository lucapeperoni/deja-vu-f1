"""
Selezione delle gare-caso (task 2.2 della roadmap, vedi docs/PROGETTAZIONE.md
sezione 9). Legge i JSON prodotti da build_all.py (task 2.1) e ordina le
gare 2023-2024 per "interesse narrativo" secondo quattro criteri:

  (a) presenza di una VSC breve a metà gara con almeno 3 pit stop nella
      finestra — la lotteria pura del tipo #1
  (b) presenza di una SC con almeno 5 posizioni totali rimescolate tra il
      giro del deployment e 3 giri dopo la fine del ciclo di soste — il
      tipo #2, "SC che compatta e rimescola"
  (c) presenza di un double stack — alimenta il tipo #3 e la vista 5
  (d) varianza degli sconti nella gara — un indicatore generico di quanto
      la gara sia stata "movimentata" sul fronte pit stop

Uso (dalla cartella data-layer, con l'ambiente virtuale attivo):
    python scripts/select_case_races.py
"""

import json
import statistics
from pathlib import Path
from typing import Dict, List, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
REPO_ROOT = DATA_LAYER_DIR.parent
PUBLIC_DATA_DIR = REPO_ROOT / "public" / "data"

# "A metà gara" per la VSC pura: tra il 25% e il 75% dei giri di gara.
MID_RACE_LOW_FRAC = 0.25
MID_RACE_HIGH_FRAC = 0.75
VSC_MIN_PITS_IN_WINDOW = 3
SC_MIN_POSITIONS_RESHUFFLED = 5


def load_races() -> List[Dict]:
    races = []
    for path in sorted((PUBLIC_DATA_DIR / "races").glob("*.json")):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        data["_slug"] = path.stem
        races.append(data)
    return races


def compute_metrics(race: Dict) -> Dict:
    total_laps = race["race"]["laps"]
    neutralizations = race["neutralizations"]
    drivers = race["drivers"]

    all_pits = [p for d in drivers for p in d["pits"]]
    all_outcomes = [o for d in drivers for o in d["outcomes"]]

    # (a) VSC breve a meta gara con >= 3 pit nella finestra
    vsc_mid_race_score = 0
    vsc_mid_race_event = None
    for n in neutralizations:
        if n["type"] != "VSC":
            continue
        frac = n["startLap"] / total_laps if total_laps else 0
        if not (MID_RACE_LOW_FRAC <= frac <= MID_RACE_HIGH_FRAC):
            continue
        n_pits_in_window = sum(
            1 for p in all_pits if p["eventId"] == n["eventId"] and p["context"] == "UNDER_VSC"
        )
        if n_pits_in_window > vsc_mid_race_score:
            vsc_mid_race_score = n_pits_in_window
            vsc_mid_race_event = n["eventId"]

    # (b) SC con posizioni rimescolate (somma |posDelta| sugli esiti dell'evento)
    sc_reshuffle_score = 0
    sc_reshuffle_event = None
    for n in neutralizations:
        if n["type"] != "SC":
            continue
        deltas = [
            abs(o["posDelta"])
            for o in all_outcomes
            if o["eventId"] == n["eventId"] and o["posDelta"] is not None
        ]
        total_reshuffled = sum(deltas)
        if total_reshuffled > sc_reshuffle_score:
            sc_reshuffle_score = total_reshuffled
            sc_reshuffle_event = n["eventId"]

    # (c) double stack
    double_stack_count = sum(1 for p in all_pits if p.get("doubleStack"))

    # (d) varianza degli sconti
    discounts = [p["discount"] for p in all_pits if p.get("discount") is not None]
    discount_variance = statistics.pvariance(discounts) if len(discounts) >= 2 else 0.0

    return {
        "slug": race["_slug"],
        "name": race["race"]["name"],
        "year": race["race"]["year"],
        "totalLaps": total_laps,
        "totalNeutralizations": len(neutralizations),
        "vscMidRaceScore": vsc_mid_race_score,
        "vscMidRaceEvent": vsc_mid_race_event,
        "scReshuffleScore": sc_reshuffle_score,
        "scReshuffleEvent": sc_reshuffle_event,
        "doubleStackCount": double_stack_count,
        "discountVariance": discount_variance,
        "qualifiesVscPure": vsc_mid_race_score >= VSC_MIN_PITS_IN_WINDOW,
        "qualifiesScReshuffle": sc_reshuffle_score >= SC_MIN_POSITIONS_RESHUFFLED,
        "qualifiesDoubleStack": double_stack_count > 0,
        "qualifiesControl": len(neutralizations) == 0,
    }


def print_table(metrics: List[Dict]):
    header = (
        f"{'gara':<28} {'giri':>4} {'neutr.':>6} {'VSC-mid':>7} {'SC-resh':>7} "
        f"{'stack':>5} {'var.sconto':>10}"
    )
    print(header)
    print("-" * len(header))
    for m in sorted(metrics, key=lambda x: (x["scReshuffleScore"], x["vscMidRaceScore"]), reverse=True):
        label = f"{m['name']} {m['year']}"
        print(
            f"{label:<28} {m['totalLaps']:>4} {m['totalNeutralizations']:>6} "
            f"{m['vscMidRaceScore']:>7} {m['scReshuffleScore']:>7.0f} "
            f"{m['doubleStackCount']:>5} {m['discountVariance']:>10.1f}"
        )


def pick_best(metrics: List[Dict], key_flag: str, sort_key) -> Optional[Dict]:
    candidates = [m for m in metrics if m[key_flag]]
    if not candidates:
        return None
    return max(candidates, key=sort_key)


def main():
    races = load_races()
    metrics = [compute_metrics(r) for r in races]

    print(f"=== Classifica gare 2023-2024 per interesse narrativo ({len(metrics)} gare) ===\n")
    print_table(metrics)

    print("\n=== Proposta di selezione (sezione 9 della specifica) ===\n")

    vsc_pick = pick_best(metrics, "qualifiesVscPure", lambda m: m["vscMidRaceScore"])
    sc_pick = pick_best(
        metrics,
        "qualifiesScReshuffle",
        lambda m: m["scReshuffleScore"],
    )
    # Per il double stack, tra le gare con double stack scegliamo quella con
    # piu' casi ma escludendo le due gia' scelte sopra, per avere 3 storie
    # diverse invece di ripetere la stessa gara.
    already_picked = {p["slug"] for p in [vsc_pick, sc_pick] if p}
    stack_candidates = [
        m for m in metrics if m["qualifiesDoubleStack"] and m["slug"] not in already_picked
    ]
    stack_pick = max(stack_candidates, key=lambda m: m["doubleStackCount"]) if stack_candidates else None

    control_candidates = [m for m in metrics if m["qualifiesControl"]]
    control_pick = max(control_candidates, key=lambda m: m["totalLaps"]) if control_candidates else None

    for label, pick in [
        ("Tipo 1 - VSC pura a meta gara", vsc_pick),
        ("Tipo 2 - SC che rimescola", sc_pick),
        ("Tipo 3 - double stack", stack_pick),
        ("Controllo - senza neutralizzazioni", control_pick),
    ]:
        if pick is None:
            print(f"{label}: NESSUNA gara qualificata con le soglie attuali")
        else:
            print(
                f"{label}: {pick['name']} {pick['year']} ({pick['slug']}) — "
                f"VSC-mid={pick['vscMidRaceScore']}, SC-resh={pick['scReshuffleScore']:.0f}, "
                f"stack={pick['doubleStackCount']}, neutr={pick['totalNeutralizations']}"
            )

    return vsc_pick, sc_pick, stack_pick, control_pick


if __name__ == "__main__":
    main()
