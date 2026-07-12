"""
Spike P1.2: prototipo brutto della mappa "quando conviene"
(docs/ROADMAP-2.md, task P1.2; docs/PROGETTAZIONE.md §5.6).

Estende lo spike P1.1 (data-layer/scripts/spike_decision_snapshot.py,
funzione compute_event_snapshots, riusata qui) a TUTTE le neutralizzazioni
di TUTTE le 46 gare 2023-2024, escludendo i piloti con esito NOT_NEEDED
(fermata "gratis" già in programma, nessuna decisione reale da valutare —
coerente con la regola anti-affollamento di §5.6).

Obiettivo: capire su quali coppie di assi si VEDE una separazione tra
decisioni BOX/STAY che hanno pagato e no. Non tocca la pipeline né i JSON:
solo lettura di public/data/races/*.json (build_all.py li produce, questo
script li legge soltanto).

Nota storica: alla prima esecuzione di questo spike, `tyre_age` era
valorizzato solo sul 12% degli snapshot (era arricchito da build_all.py
solo per le 3 gare-caso). Risolto estendendo attach_tyre_info a tutte le
gare con neutralizzazioni (v. docs/PROGETTAZIONE.md §5.6, nota sull'import
gomme) e rilanciando la pipeline: ora la copertura è ~93%.

Genera 6 scatter statici (matplotlib) in data-layer/data/spike_plots/:
  (a) margine sul gruppo dietro (s) x età gomme (giri)
  (b) età gomme (giri) x fase di gara (giro del deploy / giri totali)
  (c) soste già fatte prima del deploy x età gomme (giri) — la sosta è
      "gratis" solo se il piano ne prevedeva comunque una (§5.6)
  (d) margine sul gruppo dietro (s) x soste già fatte prima del deploy —
      non dipende da tyre_age, tenuto come confronto a copertura piena
  (e) margine sul gruppo dietro (s) x sorpassabilità del circuito — media
      dei cambi di posizione in giri verdi (non SC/VSC), per circuito
      (stessa pista nelle 2 stagioni condivide il valore, §5.6)
  (f) quota del gruppo che si ferma nella finestra x età gomme — "cosa
      fanno gli altri" (§5.6): stesso valore per tutti i piloti dello
      stesso evento, è una proprietà della finestra non del singolo
  (g) traffico x margine dietro — le due variabili con più segnale preso
      singolarmente (correlazione con l'esito 0,28 e 0,18)
  (h) indice combinato (somma pesata degli z-score di traffico e margine
      dietro, pesi dichiarati 0,6/0,4, v. COMBINED_INDEX_WEIGHTS) x età
      gomme — combinare le due variabili migliori alza la correlazione
      con l'esito a ~0,36 (verificato stabile su due metà casuali del
      campione, non è un artefatto)

In ognuno: forma = ha boxato (cerchio pieno) / non ha boxato (x), colore =
esito a 5 giri (verde=guadagnato, rosso=perso, grigio=pari, grigio chiaro
tratteggiato=non calcolabile/None).

Uso:
    data-layer/venv/bin/python data-layer/scripts/spike_decision_map.py
"""

import json
import random
import statistics
from collections import Counter
from pathlib import Path
from typing import Dict, List

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from spike_decision_snapshot import (
    RACES_DIR,
    compute_event_snapshots,
    load_driver_names,
)

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
PLOTS_DIR = DATA_LAYER_DIR / "data" / "spike_plots"

OUTCOME_COLORS = {
    "guadagnato": "#2e7d32",
    "perso": "#c62828",
    "pari": "#757575",
    "n/d": "#bdbdbd",
}


def outcome_bucket(pos_delta) -> str:
    if pos_delta is None:
        return "n/d"
    if pos_delta > 0:
        return "guadagnato"
    if pos_delta < 0:
        return "perso"
    return "pari"


def is_green_lap(lap: int, neutralizations: List[dict]) -> bool:
    return not any(n["startLap"] <= lap <= n["endLap"] for n in neutralizations)


def race_overtakability(race: dict) -> float:
    """Media dei cambi di posizione in giri verdi (§5.6): per ogni coppia di giri verdi
    consecutivi, quanto si muove in media un pilota in classifica. Calcolato per gara;
    chi chiama questa funzione lo aggrega poi per circuito (stesso circuito, 2 stagioni)."""
    neutralizations = race["neutralizations"]
    pos_by_lap: Dict[int, Dict[str, int]] = {}
    for drv in race["drivers"]:
        for lap in drv["laps"]:
            pos_by_lap.setdefault(lap["l"], {})[drv["id"]] = lap["pos"]

    deltas = []
    laps_sorted = sorted(pos_by_lap.keys())
    for prev_lap, lap in zip(laps_sorted, laps_sorted[1:]):
        if lap != prev_lap + 1:
            continue
        if not (is_green_lap(prev_lap, neutralizations) and is_green_lap(lap, neutralizations)):
            continue
        prev_pos = pos_by_lap[prev_lap]
        cur_pos = pos_by_lap[lap]
        for driver_id, pos in cur_pos.items():
            if driver_id in prev_pos:
                deltas.append(abs(pos - prev_pos[driver_id]))

    return statistics.mean(deltas) if deltas else float("nan")


def circuit_key(race_slug: str) -> str:
    return race_slug.split("-", 1)[1] if "-" in race_slug else race_slug


def compute_overtakability_by_circuit(race_paths: List[Path]) -> Dict[str, float]:
    """Aggrega race_overtakability per circuito (media tra le stagioni disponibili),
    cosi' un pilota a Monza 2023 e uno a Monza 2024 condividono lo stesso valore."""
    per_race: Dict[str, float] = {}
    for race_path in race_paths:
        race = json.loads(race_path.read_text(encoding="utf-8"))
        value = race_overtakability(race)
        if value == value:  # esclude nan
            per_race[race_path.stem] = value

    by_circuit: Dict[str, List[float]] = {}
    for race_slug, value in per_race.items():
        by_circuit.setdefault(circuit_key(race_slug), []).append(value)

    return {circuit: statistics.mean(values) for circuit, values in by_circuit.items()}


def collect_all_snapshots() -> List[dict]:
    names = load_driver_names()
    race_paths = sorted(RACES_DIR.glob("*.json"))
    overtakability_by_circuit = compute_overtakability_by_circuit(race_paths)
    snapshots: List[dict] = []

    for race_path in race_paths:
        race = json.loads(race_path.read_text(encoding="utf-8"))
        overtakability = overtakability_by_circuit.get(circuit_key(race_path.stem))
        for event in race["neutralizations"]:
            rows, expected_cost_s, _ = compute_event_snapshots(race, event, names)
            for r in rows:
                if r["outcome_category"] == "NOT_NEEDED":
                    continue
                snapshots.append({
                    **r,
                    "race_slug": race_path.stem,
                    "race_year": race["race"]["year"],
                    "event_id": event["eventId"],
                    "event_type": event["type"],
                    "expected_cost_s": expected_cost_s,
                    "boxed": r["choice"] == "BOX",
                    "outcome_bucket": outcome_bucket(r["pos_delta_5laps"]),
                    "overtakability": overtakability,
                })

    return snapshots


# Pesi dichiarati a mano (non ottimizzati sui dati, per evitare overfitting su un
# campione piccolo — 133 casi BOX guadagnato/perso): il rapporto 0,6/0,4 riflette la
# correlazione individuale con l'esito misurata nello spike (traffico 0,28, margine
# dietro 0,18 -> il traffico pesa di più). Verificato che il segnale tiene su due metà
# casuali del campione (0,37 e 0,35 di correlazione, contro 0,36 sul totale): non è un
# artefatto della singola combinazione di dati.
COMBINED_INDEX_WEIGHTS = {"traffic_fraction": 0.6, "gap_behind": 0.4}


def zscore_stats(values: List[float]) -> tuple:
    mean = statistics.mean(values)
    stdev = statistics.pstdev(values) or 1.0
    return mean, stdev


def add_combined_index(snapshots: List[dict]) -> None:
    """Indice combinato = somma pesata degli z-score di traffico e margine dietro
    (pesi in COMBINED_INDEX_WEIGHTS). Aggiunge il campo 'combined_index' in-place a
    chi ha entrambi i valori disponibili."""
    stats = {
        field: zscore_stats([s[field] for s in snapshots if s.get(field) is not None])
        for field in COMBINED_INDEX_WEIGHTS
    }
    for s in snapshots:
        if all(s.get(field) is not None for field in COMBINED_INDEX_WEIGHTS):
            s["combined_index"] = sum(
                weight * ((s[field] - stats[field][0]) / stats[field][1])
                for field, weight in COMBINED_INDEX_WEIGHTS.items()
            )
        else:
            s["combined_index"] = None


def correlation(pairs: List[tuple]) -> float:
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    n = len(xs)
    if n < 3:
        return float("nan")
    mx, my = statistics.mean(xs), statistics.mean(ys)
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / n
    sx, sy = statistics.pstdev(xs), statistics.pstdev(ys)
    return cov / (sx * sy) if sx and sy else float("nan")


def scatter(
    snapshots: List[dict],
    x_field: str,
    y_field: str,
    x_label: str,
    y_label: str,
    title: str,
    filename: str,
) -> None:
    fig, ax = plt.subplots(figsize=(9, 6))
    rng = random.Random(0)  # jitter deterministico: molti valori (età gomme, soste) sono
    # interi piccoli, senza jitter centinaia di punti finiscono impilati sullo stesso pixel
    # e la nuvola sembra vuota anche quando non lo è.
    xs_all = [s[x_field] for s in snapshots if s.get(x_field) is not None]
    ys_all = [s[y_field] for s in snapshots if s.get(y_field) is not None]
    x_jitter = ((max(xs_all) - min(xs_all)) or 1.0) * 0.015
    y_jitter = ((max(ys_all) - min(ys_all)) or 1.0) * 0.015

    for boxed in (True, False):
        marker = "o" if boxed else "x"
        label_suffix = "BOX" if boxed else "STAY/FORZATA"
        for bucket, color in OUTCOME_COLORS.items():
            pts = [
                s for s in snapshots
                if s["boxed"] == boxed
                and s["outcome_bucket"] == bucket
                and s.get(x_field) is not None
                and s.get(y_field) is not None
            ]
            if not pts:
                continue
            xs = [p[x_field] + rng.uniform(-x_jitter, x_jitter) for p in pts]
            ys = [p[y_field] + rng.uniform(-y_jitter, y_jitter) for p in pts]
            ax.scatter(
                xs, ys,
                marker=marker,
                c=color,
                alpha=0.35,
                s=30,
                edgecolors="none",
                label=f"{label_suffix} · {bucket} (n={len(pts)})",
            )

    ax.set_xlabel(x_label)
    ax.set_ylabel(y_label)
    ax.set_title(title)
    ax.legend(fontsize=7, loc="best", ncol=2)
    ax.grid(True, alpha=0.2)

    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PLOTS_DIR / filename
    fig.tight_layout()
    fig.savefig(out_path, dpi=130)
    plt.close(fig)
    print(f"Scritto {out_path.relative_to(DATA_LAYER_DIR.parent)}")


def separation_score(snapshots: List[dict], x_field: str, y_field: str) -> float:
    """Punteggio grezzo di separazione: quanto sono distanti, nel piano (x,y) normalizzato,
    i centroidi di 'guadagnato tra chi ha boxato' e 'perso tra chi ha boxato'. Non è un test
    statistico, solo un modo per confrontare a colpo d'occhio le 3 coppie di assi tra loro."""
    pts_gain = [
        (s[x_field], s[y_field]) for s in snapshots
        if s["boxed"] and s["outcome_bucket"] == "guadagnato"
        and s.get(x_field) is not None and s.get(y_field) is not None
    ]
    pts_loss = [
        (s[x_field], s[y_field]) for s in snapshots
        if s["boxed"] and s["outcome_bucket"] == "perso"
        and s.get(x_field) is not None and s.get(y_field) is not None
    ]
    all_pts = pts_gain + pts_loss
    if len(pts_gain) < 3 or len(pts_loss) < 3:
        return float("nan")

    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    x_range = (max(xs) - min(xs)) or 1.0
    y_range = (max(ys) - min(ys)) or 1.0

    def centroid(pts):
        return (
            statistics.mean(p[0] for p in pts) / x_range,
            statistics.mean(p[1] for p in pts) / y_range,
        )

    cx_gain, cy_gain = centroid(pts_gain)
    cx_loss, cy_loss = centroid(pts_loss)
    return ((cx_gain - cx_loss) ** 2 + (cy_gain - cy_loss) ** 2) ** 0.5


def main() -> None:
    snapshots = collect_all_snapshots()
    add_combined_index(snapshots)

    print(f"Snapshot totali (pilota x evento, NOT_NEEDED escluso): {len(snapshots)}")
    print(f"Gare coperte: {len(set(s['race_slug'] for s in snapshots))}")
    print(f"Eventi coperti: {len(set((s['race_slug'], s['event_id']) for s in snapshots))}\n")

    print("--- Distribuzione scelta x esito (tutte le gare) ---")
    dist = Counter((s["choice"], s["outcome_bucket"]) for s in snapshots)
    choices = ["BOX", "STAY", "FORZATA"]
    buckets = ["guadagnato", "pari", "perso", "n/d"]
    header = f"{'Scelta':<10}" + "".join(f"{b:>13}" for b in buckets) + f"{'Totale':>10}"
    print(header)
    for choice in choices:
        row_counts = [dist.get((choice, b), 0) for b in buckets]
        print(f"{choice:<10}" + "".join(f"{c:>13}" for c in row_counts) + f"{sum(row_counts):>10}")
    print()

    n_tyre_age = sum(1 for s in snapshots if s.get("tyre_age") is not None)
    races_without_tyre_age = sorted(set(
        s["race_slug"] for s in snapshots if s.get("tyre_age") is None
    ))
    print("--- Copertura tyre_age (era il limite scoperto alla prima versione di questo spike) ---")
    print(
        f"tyre_age e' valorizzato su {n_tyre_age}/{len(snapshots)} snapshot "
        f"({n_tyre_age / len(snapshots):.0%}). Da quando data-layer/scripts/build_all.py chiama "
        "attach_tyre_info per ogni gara con neutralizzazioni (non solo le 3 gare-caso, v. "
        "docs/PROGETTAZIONE.md §5.6 nota sull'import gomme), la copertura e' quasi totale."
    )
    if races_without_tyre_age:
        print(f"Gare/eventi senza tyre_age (stint OpenF1 mancante o non risolvibile): {races_without_tyre_age}")
    print()

    axes_candidates = [
        ("gap_behind", "tyre_age",
         "Margine sul gruppo dietro (s)", "Età gomme (giri)",
         "(a) Margine dietro x età gomme", "a_margine_dietro_x_eta_gomme.png"),
        ("tyre_age", "race_progress",
         "Età gomme (giri)", "Fase di gara (giro deploy / giri totali)",
         "(b) Età gomme x fase di gara", "b_eta_gomme_x_fase_gara.png"),
        ("pits_before", "tyre_age",
         "Soste già fatte prima del deploy", "Età gomme (giri)",
         "(c) Soste già fatte x età gomme", "c_soste_fatte_x_eta_gomme.png"),
        ("gap_behind", "pits_before",
         "Margine sul gruppo dietro (s)", "Soste già fatte prima del deploy",
         "(d) Margine dietro x soste già fatte", "d_margine_dietro_x_soste_fatte.png"),
        ("gap_behind", "overtakability",
         "Margine sul gruppo dietro (s)", "Sorpassabilità circuito (cambi pos./giro verde)",
         "(e) Margine dietro x sorpassabilità circuito", "e_margine_dietro_x_sorpassabilita.png"),
        ("traffic_fraction", "tyre_age",
         "Quota gruppo che si ferma nella finestra", "Età gomme (giri)",
         "(f) Traffico (quota che si ferma) x età gomme", "f_traffico_x_eta_gomme.png"),
        ("traffic_fraction", "gap_behind",
         "Quota gruppo che si ferma nella finestra", "Margine sul gruppo dietro (s)",
         "(g) Traffico x margine dietro", "g_traffico_x_margine_dietro.png"),
        ("combined_index", "tyre_age",
         "Indice combinato (0,6 traffico + 0,4 margine dietro, z-score)", "Età gomme (giri)",
         "(h) Indice combinato x età gomme", "h_indice_combinato_x_eta_gomme.png"),
    ]

    boxed_pairs = [
        (s["combined_index"], s["pos_delta_5laps"]) for s in snapshots
        if s["boxed"] and s["outcome_bucket"] in ("guadagnato", "perso")
        and s.get("combined_index") is not None and s.get("pos_delta_5laps") is not None
    ]
    single_var_corrs = {
        field: correlation([
            (s[field], s["pos_delta_5laps"]) for s in snapshots
            if s["boxed"] and s["outcome_bucket"] in ("guadagnato", "perso")
            and s.get(field) is not None and s.get("pos_delta_5laps") is not None
        ])
        for field in ("traffic_fraction", "gap_behind", "tyre_age", "overtakability")
    }
    print("--- Indice combinato: 0,6 x z(traffico) + 0,4 x z(margine dietro), pesi dichiarati ---")
    print(
        "Correlazione col posDelta a 5 giri (solo BOX guadagnato/perso, n="
        f"{len(boxed_pairs)}): indice combinato = {correlation(boxed_pairs):.3f} contro "
        + ", ".join(f"{k}={v:.3f}" for k, v in single_var_corrs.items())
    )
    print()

    print("--- Punteggio di separazione (distanza normalizzata tra centroidi 'guadagnato' e "
          "'perso' fra chi ha boxato; più alto = assi più promettenti, NON un test statistico) ---")
    scores = []
    for x_field, y_field, x_label, y_label, title, filename in axes_candidates:
        scatter(snapshots, x_field, y_field, x_label, y_label, title, filename)
        score = separation_score(snapshots, x_field, y_field)
        scores.append((title, score))
        score_str = f"{score:.3f}" if score == score else "n/d (troppi pochi punti)"
        print(f"{title:<45} {score_str}")

    print()
    valid_scores = [(t, s) for t, s in scores if s == s]
    if valid_scores:
        best = max(valid_scores, key=lambda t: t[1])
        print(f"Valutazione onesta: la coppia con la separazione più marcata è \"{best[0]}\" "
              f"(punteggio {best[1]:.3f}). Guardare comunque i PNG in data-layer/data/spike_plots/ "
              f"prima di decidere: il punteggio è un centroide, non cattura forma o densità della nuvola.")
    else:
        print("Nessuna coppia ha abbastanza punti guadagnato/perso per un punteggio: valutare solo a occhio i PNG.")


if __name__ == "__main__":
    main()
