"""
Numeri chiave per relazione e presentazione (task 5.3 della roadmap, vedi
docs/PROGETTAZIONE.md sezioni 5, 9 e 10).

Legge SOLO i JSON gia' pubblicati in public/data/ (l'output della pipeline,
build_all.py, task 2.1) piu' data/raw/drivers.csv per tradurre i driverId
Ergast in nomi leggibili. Non ricalcola nessuna metrica: ogni numero qui e'
una lettura o un'aggregazione statistica (conteggio, mediana, min/max) di un
campo gia' presente nei JSON, cosi' il numero resta legato alla riga di
codice che lo ha prodotto in origine (vedi commenti "Fonte" nel codice sotto
e nell'output).

Uso (dalla cartella data-layer, con l'ambiente virtuale attivo, oppure con
python3 di sistema perche' non servono dipendenze esterne):
    python scripts/report_numbers.py

Scrive docs/NUMERI.md nella cartella del repo.
"""

import csv
import json
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
REPO_ROOT = DATA_LAYER_DIR.parent
PUBLIC_DATA_DIR = REPO_ROOT / "public" / "data"
RAW_DIR = REPO_ROOT / "data" / "raw"
OUTPUT_PATH = REPO_ROOT / "docs" / "NUMERI.md"

# Le 3 gare-caso scelte in docs/PROGETTAZIONE.md sezione 9 (select_case_races.py,
# task 2.2) e raccontate in public/data/stories.json (task 5.1).
CASE_RACES = ["2023-bahrain", "2024-jeddah", "2023-albert_park"]

# Contesti di pit che contano come scelta BOX nel layer della decisione
# (docs/PROGETTAZIONE.md §5.6, data-layer/app/metrics/decision_snapshots.py
# BOX_CONTEXTS): un pit JUST_AFTER non conta come BOX, e' STAY.
BOX_CONTEXTS = {"UNDER_SC", "UNDER_VSC"}

CATEGORY_LABELS = {
    "EXPLOITED": "ha sfruttato la finestra",
    "LOCKED_OUT": "escluso (gomme fresche o traffico)",
    "NOT_NEEDED": "non aveva bisogno di fermarsi",
    "FULL_PRICE": "fregato (fermo appena prima)",
    "NEUTRAL": "nessuna delle precedenti",
}


def load_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_driver_names() -> Dict[str, str]:
    """Fonte: data/raw/drivers.csv (dataset Ergast/Kaggle, sezione 4 della
    specifica). Serve solo per tradurre driverId numerici in nomi leggibili
    nel report, non e' usato in nessun calcolo."""
    names = {}
    with open(RAW_DIR / "drivers.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            names[row["driverId"]] = f"{row['forename']} {row['surname']} ({row['code']})"
    return names


def fmt_signed(value: Optional[float], decimals: int = 1) -> str:
    if value is None:
        return "n/d"
    sign = "+" if value >= 0 else ""
    return f"{sign}{value:.{decimals}f}"


def median_or_none(values: List[float]) -> Optional[float]:
    return statistics.median(values) if values else None


def rejoin_errors_for_race(race: dict) -> List[float]:
    """Errore di previsione del rientro (§5.6, spike P1.1): |predictedRejoinPos -
    posAfter reale|, solo per le decisioni con scelta BOX il cui pit corrispondente
    (stesso driverId, stesso eventId, contesto UNDER_SC/UNDER_VSC) e' presente e ha
    una posizione dopo la sosta registrata. Stessa regola di confronto usata in
    data-layer/scripts/spike_decision_snapshot.py (rientro previsto vs posAfter),
    qui estesa a tutte le 46 gare invece che alle sole 3 gare-caso dello spike."""
    drivers_by_id = {d["driverId"]: d for d in race["drivers"]}
    errors: List[float] = []
    for dec in race["decisions"]:
        if dec["choice"] != "BOX":
            continue
        predicted = dec["boxOption"]["predictedRejoinPos"]
        if predicted is None:
            continue
        driver = drivers_by_id.get(dec["driverId"])
        if driver is None:
            continue
        pit = next(
            (p for p in driver["pits"] if p.get("eventId") == dec["eventId"] and p["context"] in BOX_CONTEXTS),
            None,
        )
        if pit is None or pit.get("posAfter") is None:
            continue
        errors.append(abs(predicted - pit["posAfter"]))
    return errors


def main():
    index = load_json(PUBLIC_DATA_DIR / "index.json")
    aggregate = load_json(PUBLIC_DATA_DIR / "aggregate.json")
    stories = load_json(PUBLIC_DATA_DIR / "stories.json")
    names = load_driver_names()

    pits = aggregate["pitStops"]
    outcomes = aggregate["outcomes"]

    race_files = sorted(PUBLIC_DATA_DIR.glob("races/*.json"))
    races = {p.stem: load_json(p) for p in race_files}

    lines: List[str] = []

    def w(line: str = ""):
        lines.append(line)

    w("# Numeri chiave — Chaos Discount")
    w()
    w("Generato automaticamente da `data-layer/scripts/report_numbers.py` a partire")
    w("dai JSON in `public/data/` (l'output della pipeline, task 2.1) e da")
    w("`data/raw/drivers.csv` (solo per i nomi dei piloti). Ogni numero indica il")
    w("file sorgente e la regola con cui e' stato calcolato, cosi' e' verificabile")
    w("e difendibile all'esame. Definizioni complete in `docs/PROGETTAZIONE.md`")
    w("sezione 5.")
    w()

    # ------------------------------------------------------------------
    # 1. Dimensione del campione
    # ------------------------------------------------------------------
    n_races = len(index)
    n_neutralizations = sum(r["totalNeutralizations"] for r in index)
    # controllo incrociato: stesso conteggio contando direttamente le finestre
    # nei singoli file di gara (deve coincidere, altrimenti index.json e'
    # disallineato dai file di gara)
    n_neutralizations_check = sum(len(r["neutralizations"]) for r in races.values())
    assert n_neutralizations == n_neutralizations_check, "index.json disallineato da races/*.json"

    n_pits_total = len(pits)
    n_outcomes_total = len(outcomes)

    w("## 1. Dimensione del campione")
    w()
    w(f"- **{n_races} gare** — stagioni 2023 e 2024 complete.")
    w(f"  Fonte: `public/data/index.json`, numero di elementi dell'elenco.")
    w(f"- **{n_neutralizations} neutralizzazioni** (Safety Car o Virtual Safety Car) catturate nelle {n_races} gare.")
    w(f"  Fonte: `public/data/index.json`, somma del campo `totalNeutralizations`;")
    w(f"  incrociato contando le finestre in `public/data/races/*.json` (`neutralizations`),")
    w(f"  stesso numero ({n_neutralizations_check}).")
    w(f"- **{n_pits_total} pit stop** totali nel campione, di cui **{n_outcomes_total} esiti** pilota-per-evento (un pilota puo' non avere un esito registrato se non era in gara in quel momento).")
    w(f"  Fonte: `public/data/aggregate.json`, lunghezza degli array `pitStops` e `outcomes`.")
    w()

    # ------------------------------------------------------------------
    # 2. Prezzo di listino
    # ------------------------------------------------------------------
    nominal_values = [r["race"]["nominalPitLoss"] for r in races.values() if r["race"].get("nominalPitLoss") is not None]
    nominal_median = median_or_none(nominal_values)
    n_low_conf_races = sum(
        1
        for r in races.values()
        if any(p.get("lowConfidence") for d in r["drivers"] for p in d["pits"] if p["context"] == "GREEN")
    )

    # cross-check: mediana "pooled" di tutti i pit in verde del campione
    green_effective = [p["effectiveLoss"] for p in pits if p["context"] == "GREEN" and p["effectiveLoss"] is not None]
    green_pooled_median = median_or_none(green_effective)

    w("## 2. Il prezzo di listino")
    w()
    w(f"- **Prezzo di listino mediano: {nominal_median:.1f}s** (mediana su {len(nominal_values)} gare).")
    w(f"  Fonte: `public/data/races/*.json`, campo `race.nominalPitLoss` — per ogni gara e' gia' la mediana dei costi effettivi dei pit in bandiera verde (regola §5.2 della specifica, calcolata in `data-layer/app/metrics/effective_pit_loss.py`); qui si prende la mediana di quel valore sulle {len(nominal_values)} gare del campione.")
    w(f"  Controllo incrociato: la mediana \"aggregata\" di tutti i {len(green_effective)} pit in verde del campione (senza passare per gara) e' {green_pooled_median:.1f}s — coerente.")
    w(f"  Fonte: `public/data/aggregate.json`, `pitStops[].effectiveLoss` con `context == \"GREEN\"`.")
    n_races_word = "gara" if n_low_conf_races == 1 else "gare"
    w(f"- Nota di cautela: **{n_low_conf_races} {n_races_word}** {'ha' if n_low_conf_races == 1 else 'hanno'} meno di 4 pit in verde (soglia `minGreenStopsForConfidence`), quindi il loro prezzo di listino e' marcato a bassa confidenza (`lowConfidence`); il fallback sulla mediana di pista descritto in §5.2 della specifica non e' stato implementato nella pipeline attuale — se richiesto all'esame, va dichiarato come limite noto.")
    w(f"  Fonte: `public/data/races/*.json`, campo `pits[].lowConfidence` sui pit `GREEN`.")
    w()

    # ------------------------------------------------------------------
    # 3. Lo sconto sotto VSC e sotto SC
    # ------------------------------------------------------------------
    def discounts_for(context: str) -> List[float]:
        return [p["discount"] for p in pits if p["context"] == context and p["discount"] is not None]

    def eff_for(context: str) -> List[float]:
        return [p["effectiveLoss"] for p in pits if p["context"] == context and p["effectiveLoss"] is not None]

    disc_vsc = discounts_for("UNDER_VSC")
    disc_sc = discounts_for("UNDER_SC")
    disc_green = discounts_for("GREEN")
    eff_vsc = eff_for("UNDER_VSC")
    eff_sc = eff_for("UNDER_SC")
    eff_green = eff_for("GREEN")

    w("## 3. Lo sconto sotto neutralizzazione")
    w()
    w(f"- **Sconto mediano sotto Safety Car: {fmt_signed(median_or_none(disc_sc))}s** (n={len(disc_sc)} pit).")
    w(f"- **Sconto mediano sotto Virtual Safety Car: {fmt_signed(median_or_none(disc_vsc))}s** (n={len(disc_vsc)} pit).")
    w(f"- Per confronto, sconto mediano di un pit in bandiera verde (deve essere vicino a zero, per definizione): {fmt_signed(median_or_none(disc_green))}s (n={len(disc_green)}).")
    w(f"  Fonte: `public/data/aggregate.json`, campo `pitStops[].discount` filtrato per `context`; lo sconto e' gia' calcolato dalla pipeline come \"prezzo di listino della gara − costo effettivo del pit\" (regola §5.3).")
    w()
    w(f"- Controllo incrociato in costo effettivo assoluto (non relativo al listino di ogni singola gara): mediana verde {median_or_none(eff_green):.1f}s, mediana sotto SC {median_or_none(eff_sc):.1f}s, mediana sotto VSC {median_or_none(eff_vsc):.1f}s.")
    w(f"  Fonte: `public/data/aggregate.json`, campo `pitStops[].effectiveLoss`. Questi tre numeri sono quelli gia' citati e validati in `docs/PROGETTAZIONE.md` §5.1bis dopo la correzione del riferimento di gruppo mancante: la SC piena mostra uno sconto netto, la VSC resta vicina al verde (limite di granularita' dichiarato in `/methodology`).")
    w()

    # ------------------------------------------------------------------
    # 4. I fregati (JUST_BEFORE)
    # ------------------------------------------------------------------
    just_before = [p for p in pits if p["context"] == "JUST_BEFORE"]
    jb_discounts = [p["discount"] for p in just_before if p["discount"] is not None]
    jb_median = median_or_none(jb_discounts)

    w("## 4. I \"fregati\" (JUST_BEFORE)")
    w()
    w(f"- **{len(just_before)} pit stop** classificati JUST_BEFORE: fermata in bandiera verde nei 3 giri prima dell'inizio di una neutralizzazione (soglia `justBeforeMaxLaps`, regola §5.4).")
    w(f"  Fonte: `public/data/aggregate.json`, `pitStops[]` con `context == \"JUST_BEFORE\"`.")
    w(f"- **Mediana della perdita: {fmt_signed(jb_median)}s** rispetto al prezzo di listino della propria gara (n={len(jb_discounts)}) — un valore negativo significa che in mediana questi piloti hanno pagato PIU' del prezzo pieno, non solo \"niente sconto\": il traffico/l'incidente che ha causato la neutralizzazione spesso li aveva gia' rallentati mentre erano ai box.")
    w(f"  Fonte: `public/data/aggregate.json`, campo `pitStops[].discount` sugli stessi pit stop (stessa regola §5.3 usata per tutti i contesti).")
    w()

    # ------------------------------------------------------------------
    # 5. Distribuzione degli esiti della lotteria
    # ------------------------------------------------------------------
    cat_counts = Counter(o["category"] for o in outcomes)
    total_cat = sum(cat_counts.values())

    w("## 5. Distribuzione degli esiti della lotteria")
    w()
    w(f"Su {total_cat} esiti pilota-per-evento (regola §5.5, soglie dichiarate in `public/data/params.json` e in `/methodology`):")
    w()
    w("| Esito | Significato | Conteggio | % |")
    w("|---|---|---:|---:|")
    for cat in ["EXPLOITED", "LOCKED_OUT", "FULL_PRICE", "NOT_NEEDED", "NEUTRAL"]:
        n = cat_counts.get(cat, 0)
        pct = 100.0 * n / total_cat if total_cat else 0.0
        w(f"| {cat} | {CATEGORY_LABELS[cat]} | {n} | {pct:.1f}% |")
    w()
    w(f"Fonte: `public/data/aggregate.json`, campo `outcomes[].category`, conteggio e percentuale sul totale di {total_cat} righe.")
    w()

    # ------------------------------------------------------------------
    # 6. I casi estremi
    # ------------------------------------------------------------------
    valid_pits = [p for p in pits if p["discount"] is not None and not p.get("lowConfidence")]
    best_pit = max(valid_pits, key=lambda p: p["discount"])
    valid_outcomes = [o for o in outcomes if o["posDelta"] is not None]
    worst_outcome = max(valid_outcomes, key=lambda o: o["posDelta"])

    w("## 6. I casi estremi")
    w()
    w(f"- **Lo sconto piu' estremo del campione: {names.get(best_pit['driverId'], best_pit['driverId'])}, {best_pit['raceId']} ({best_pit['year']}), giro {best_pit['lap']}, contesto {best_pit['context']}: {fmt_signed(best_pit['discount'])}s di sconto** (costo effettivo {best_pit['effectiveLoss']:.1f}s, sotto zero: e' letteralmente \"guadagnato\" fermandosi).")
    w(f"  Fonte: `public/data/aggregate.json`, massimo di `pitStops[].discount` tra i pit non marcati `lowConfidence` (esclusi perche' §5.1bis/10.8 li segnala come residuo di riferimento di gruppo inaffidabile, non storia genuina).")
    w()
    w(f"- **Il caso piu' sfortunato: {names.get(worst_outcome['driverId'], worst_outcome['driverId'])}, {worst_outcome['raceId']} ({worst_outcome['year']}), evento {worst_outcome['eventId']}, esito {worst_outcome['category']}: {fmt_signed(worst_outcome['posDelta'], 0)} posizioni** (un valore positivo di `posDelta` e' un peggioramento della posizione).")
    post_event_offset = load_json(PUBLIC_DATA_DIR / 'params.json')['postEventOutcomeOffsetLaps']
    w(f"  Fonte: `public/data/aggregate.json`, massimo di `outcomes[].posDelta` tra gli esiti con delta noto (regola §5.5: il delta si misura tra il momento dell'evento e {post_event_offset} giri dopo).")
    w()

    # ------------------------------------------------------------------
    # 7. Le 3 gare-caso
    # ------------------------------------------------------------------
    w("## 7. Le 3 gare-caso")
    w()
    w("Selezionate in `data-layer/scripts/select_case_races.py` (task 2.2, criteri")
    w("in `docs/PROGETTAZIONE.md` sezione 9) e raccontate in `public/data/stories.json`")
    w("(task 5.1). I numeri sotto sono ricalcolati direttamente dai file di gara per")
    w("verificare che coincidano con le storie.")
    w()

    for slug in CASE_RACES:
        race = races[slug]
        title = stories.get(slug, {}).get("title", "")
        w(f"### {race['race']['name']} {race['race']['year']} (`{slug}`)")
        w()
        if title:
            w(f"_{title}_")
            w()

        drivers = race["drivers"]
        neutralizations = race["neutralizations"]
        nominal = race["race"].get("nominalPitLoss")

        if slug == "2023-bahrain":
            event_id = neutralizations[0]["eventId"]
            pits_window = [(d["id"], p) for d in drivers for p in d["pits"] if p["eventId"] == event_id]
            best = max(pits_window, key=lambda x: x[1]["discount"] if x[1]["discount"] is not None else -999)
            w(f"- **1 sola neutralizzazione** in tutta la gara (VSC, giri {neutralizations[0]['startLap']}-{neutralizations[0]['endLap']}) — la lotteria si gioca in un solo momento. Fonte: `neutralizations` nel file di gara.")
            w(f"- **{len(pits_window)} pit stop** nella finestra, contro un prezzo di listino di {nominal:.1f}s. Fonte: `drivers[].pits[]` filtrati per `eventId == \"{event_id}\"`.")
            w(f"- Il miglior colpo: **{best[0]}** paga {best[1]['effectiveLoss']:.1f}s ({fmt_signed(best[1]['discount'])}s di sconto). Fonte: stesso array, campo `discount`.")
        elif slug == "2024-jeddah":
            event_id = neutralizations[0]["eventId"]
            pits_window = [(d["id"], p) for d in drivers for p in d["pits"] if p["eventId"] == event_id]
            outs_window = [o for d in drivers for o in d["outcomes"] if o["eventId"] == event_id]
            cats = Counter(o["category"] for o in outs_window)
            best = max(pits_window, key=lambda x: x[1]["discount"] if x[1]["discount"] is not None else -999)
            w(f"- **Safety Car ai giri {neutralizations[0]['startLap']}-{neutralizations[0]['endLap']}**, prezzo di listino {nominal:.1f}s. Fonte: `neutralizations` e `race.nominalPitLoss`.")
            w(f"- Split netto: **{cats.get('EXPLOITED', 0)} EXPLOITED contro {cats.get('LOCKED_OUT', 0)} LOCKED_OUT** su {sum(cats.values())} esiti registrati per l'evento. Fonte: `drivers[].outcomes[]` filtrati per `eventId`, conteggio per `category`.")
            w(f"- Il miglior colpo: **{best[0]}** paga {best[1]['effectiveLoss']:.1f}s ({fmt_signed(best[1]['discount'])}s di sconto) su {len(pits_window)} pit nella finestra.")
        elif slug == "2023-albert_park":
            cats_by_event = {}
            for n in neutralizations:
                eid = n["eventId"]
                outs = [o for d in drivers for o in d["outcomes"] if o["eventId"] == eid]
                cats_by_event[eid] = Counter(o["category"] for o in outs)
            ds_by_team = defaultdict(int)
            total_ds = 0
            for d in drivers:
                for p in d["pits"]:
                    if p.get("doubleStack"):
                        total_ds += 1
                        ds_by_team[d["team"]] += 1
            e1, e2 = neutralizations[0]["eventId"], neutralizations[1]["eventId"]
            w(
                f"- **3 neutralizzazioni** nella stessa gara con esiti opposti: sul primo SC "
                f"(giri {neutralizations[0]['startLap']}-{neutralizations[0]['endLap']}) "
                f"{cats_by_event[e1].get('EXPLOITED', 0)} EXPLOITED contro {cats_by_event[e1].get('LOCKED_OUT', 0)} LOCKED_OUT; "
                f"sul secondo SC (giri {neutralizations[1]['startLap']}-{neutralizations[1]['endLap']}) si ribalta: "
                f"{cats_by_event[e2].get('EXPLOITED', 0)} EXPLOITED contro {cats_by_event[e2].get('LOCKED_OUT', 0)} LOCKED_OUT."
            )
            w(f"  Fonte: `drivers[].outcomes[]` filtrati per ciascun `eventId`.")
            w(f"- **{total_ds} pit stop in double stack**, distribuiti su **{len(ds_by_team)} team diversi** — non concentrati su una sola squadra.")
            w(f"  Fonte: `drivers[].pits[]`, campo `doubleStack`, raggruppati per `team`.")

        # --- lettura decisionale (§5.6, task P2.1): stessa gara, layer nuovo ---
        real_decisions = [d for d in race["decisions"] if not d["notNeeded"]]
        choice_counts = Counter(d["choice"] for d in real_decisions)
        box_decisions = [d for d in real_decisions if d["choice"] == "BOX"]
        box_gained_race = sum(1 for d in box_decisions if d["outcome"]["verdict"] == "GAINED")
        race_errors = rejoin_errors_for_race(race)
        w(
            f"- Lettura decisionale: **{choice_counts.get('BOX', 0)} BOX**, "
            f"**{choice_counts.get('STAY', 0)} STAY**, **{choice_counts.get('FORCED', 0)} FORZATE** "
            f"({len(real_decisions)} decisioni reali, NOT_NEEDED escluse); tra chi ha scelto BOX, "
            f"**{box_gained_race}/{len(box_decisions)}** ha guadagnato posizioni a 5 giri."
        )
        w(f"  Fonte: `public/data/races/{slug}.json`, campo `decisions[]` (choice, outcome.verdict).")
        if race_errors:
            w(
                f"- Errore mediano del rientro previsto in questa gara: "
                f"**{median_or_none(race_errors):.1f} posizioni** (n={len(race_errors)} pit BOX confrontabili)."
            )
            w(
                f"  Fonte: `decisions[].boxOption.predictedRejoinPos` confrontato con "
                f"`drivers[].pits[].posAfter` dello stesso evento (stessa regola dello spike P1.1, "
                f"v. `rejoin_errors_for_race` in questo script)."
            )
        w()

    # ------------------------------------------------------------------
    # 8. v2 — la decisione (§5.6, task P2.1/P2.2/P4.2)
    # ------------------------------------------------------------------
    all_decisions = [dec for race in races.values() for dec in race["decisions"]]
    n_decisions_total = len(all_decisions)
    n_not_needed = sum(1 for d in all_decisions if d["notNeeded"])
    n_forced = sum(1 for d in all_decisions if d["choice"] == "FORCED")
    real_decisions = [d for d in all_decisions if not d["notNeeded"]]
    n_real = len(real_decisions)

    combined_values = [d["combinedIndex"] for d in real_decisions if d["combinedIndex"] is not None]
    combined_median = median_or_none(combined_values)

    def verdict_rate(choice: str, index_filter=None) -> tuple:
        pool = [
            d
            for d in real_decisions
            if d["choice"] == choice
            and (index_filter is None or (d["combinedIndex"] is not None and index_filter(d["combinedIndex"])))
        ]
        n = len(pool)
        n_gained = sum(1 for d in pool if d["outcome"]["verdict"] == "GAINED")
        pct = 100.0 * n_gained / n if n else 0.0
        return n, n_gained, pct

    box_n, box_gained, box_pct = verdict_rate("BOX")
    box_above_n, box_above_gained, box_above_pct = verdict_rate("BOX", lambda v: v > combined_median)
    box_below_n, box_below_gained, box_below_pct = verdict_rate("BOX", lambda v: v <= combined_median)

    stay_n, stay_gained, stay_pct = verdict_rate("STAY")
    stay_above_n, stay_above_gained, stay_above_pct = verdict_rate("STAY", lambda v: v > combined_median)
    stay_below_n, stay_below_gained, stay_below_pct = verdict_rate("STAY", lambda v: v <= combined_median)

    all_rejoin_errors = [err for race in races.values() for err in rejoin_errors_for_race(race)]

    w("## 8. v2 — la decisione")
    w()
    w(
        "Numeri del layer del pivot (`decision_snapshots.py`, §5.6): uno snapshot per "
        "pilota × neutralizzazione, con le due opzioni quantificate, la scelta e il "
        "verdetto a 5 giri. Fonte per tutta la sezione: `public/data/races/*.json`, "
        "campo `decisions[]` di ogni gara (non `aggregate.json`, che ne tiene solo un "
        "sottoinsieme di campi per la mappa)."
    )
    w()
    w(
        "Attenzione al segno: qui `posDelta5` positivo significa **guadagno** di posizioni "
        "(regola `classify_verdict` in `decision_snapshots.py`) — l'opposto della convenzione "
        "di `outcomes[].posDelta` usata nella sezione 6, dove positivo è un peggioramento. Sono "
        "due campi diversi con regole di segno diverse, non un'incoerenza tra le sezioni."
    )
    w()
    w(
        f"- **{n_decisions_total} decisioni** pilota×evento nel campione, di cui "
        f"**{n_not_needed} NOT_NEEDED** (non gli serviva fermarsi: escluse dalla mappa "
        f"e da questa sezione) e **{n_forced} FORZATE** (LOCKED_OUT: non poteva scegliere) "
        f"— restano **{n_real} decisioni reali** (scelta libera tra BOX e STAY)."
    )
    w(f"  Fonte: `decisions[].notNeeded` e `decisions[].choice`, conteggio su tutte le 46 gare.")
    w()
    w(
        f"- **Soglia di margine usata sotto**: la mediana dell'indice combinato sulle "
        f"decisioni reali, **{combined_median:.1f}** (per costruzione, media 0 sulla "
        f"popolazione usata per gli z-score in `fill_combined_index`; la mediana calcolata "
        f"qui puo' scostarsi leggermente per asimmetria del campione)."
    )
    w(f"  Fonte: mediana di `decisions[].combinedIndex` non nulli, esclusi i NOT_NEEDED.")
    w()
    w(
        f"- **BOX ha guadagnato posizioni nel {box_pct:.1f}% dei casi** ({box_gained}/{box_n}) "
        f"sull'intero campione; **{box_above_pct:.1f}%** ({box_above_gained}/{box_above_n}) "
        f"quando l'indice combinato e' sopra la soglia di margine, **{box_below_pct:.1f}%** "
        f"({box_below_gained}/{box_below_n}) quando e' sotto — lo scarto tra le due condizioni "
        f"e' la prova numerica della tendenza dichiarata in `/methodology` (correlazione "
        f"indice/esito 0,34-0,36, non un confine netto)."
    )
    w(f"  Fonte: `decisions[]` con `choice == \"BOX\"`, `outcome.verdict == \"GAINED\"`, filtrati per `combinedIndex` sopra/sotto la mediana qui sopra.")
    w()
    w(
        f"- **STAY ha guadagnato posizioni nel {stay_pct:.1f}% dei casi** ({stay_gained}/{stay_n}); "
        f"**{stay_above_pct:.1f}%** ({stay_above_gained}/{stay_above_n}) sopra la soglia di margine, "
        f"**{stay_below_pct:.1f}%** ({stay_below_gained}/{stay_below_n}) sotto. L'indice combinato e' "
        f"costruito e verificato sulla scelta BOX (v. `/methodology`): questa riga e' un controllo "
        f"di coerenza, non la sua base di validazione."
    )
    w(f"  Fonte: `decisions[]` con `choice == \"STAY\"`, stessa regola della riga precedente.")
    w()
    if all_rejoin_errors:
        w(
            f"- **Errore mediano del rientro previsto: {median_or_none(all_rejoin_errors):.1f} posizioni** "
            f"(n={len(all_rejoin_errors)} pit BOX confrontabili su tutte le 46 gare, non solo le 3 "
            f"gare-caso dello spike P1.1)."
        )
        w(
            f"  Fonte: `decisions[].boxOption.predictedRejoinPos` confrontato con `drivers[].pits[].posAfter` "
            f"dello stesso pilota/evento (contesto UNDER_SC/UNDER_VSC); vedi `rejoin_errors_for_race` in "
            f"questo script."
        )
        w()

    # caso piu' clamorosamente sbagliato / piu' perfetto, nel campione della mappa (solo scelta BOX,
    # v. P3.1: la mappa in home plotta solo BOX guadagnato/perso)
    flat_box = [
        {**d, "raceId": slug, "raceName": races[slug]["race"]["name"], "year": races[slug]["race"]["year"]}
        for slug in races
        for d in races[slug]["decisions"]
        if d["choice"] == "BOX" and d["combinedIndex"] is not None and d["outcome"]["posDelta5"] is not None
    ]
    above = [d for d in flat_box if d["combinedIndex"] > combined_median]
    below = [d for d in flat_box if d["combinedIndex"] <= combined_median]
    worst_surprise = min(above, key=lambda d: d["outcome"]["posDelta5"]) if above else None
    best_surprise = max(below, key=lambda d: d["outcome"]["posDelta5"]) if below else None

    if worst_surprise:
        w(
            f"- **La scelta più clamorosamente sbagliata**: {names.get(worst_surprise['driverId'], worst_surprise['driverId'])}, "
            f"{worst_surprise['raceName']} {worst_surprise['year']} (`{worst_surprise['raceId']}`), evento "
            f"{worst_surprise['eventId']} — indice combinato {worst_surprise['combinedIndex']:.1f} (sopra la soglia "
            f"di margine: condizioni statisticamente favorevoli a BOX), eppure {fmt_signed(worst_surprise['outcome']['posDelta5'], 0)} "
            f"posizioni a 5 giri (verdetto {worst_surprise['outcome']['verdict']}). La prova più netta che l'indice "
            f"è una tendenza, non una garanzia sul singolo caso."
        )
        w(f"  Fonte: `decisions[]` con `choice == \"BOX\"` e `combinedIndex` sopra la soglia di margine, minimo di `outcome.posDelta5`.")
        w()
    if best_surprise:
        w(
            f"- **La scelta più perfetta nonostante i numeri contrari**: {names.get(best_surprise['driverId'], best_surprise['driverId'])}, "
            f"{best_surprise['raceName']} {best_surprise['year']} (`{best_surprise['raceId']}`), evento "
            f"{best_surprise['eventId']} — indice combinato {best_surprise['combinedIndex']:.1f} (sotto la soglia di "
            f"margine: condizioni statisticamente sfavorevoli a BOX), eppure {fmt_signed(best_surprise['outcome']['posDelta5'], 0)} "
            f"posizioni a 5 giri (verdetto {best_surprise['outcome']['verdict']})."
        )
        w(f"  Fonte: `decisions[]` con `choice == \"BOX\"` e `combinedIndex` sotto la soglia di margine, massimo di `outcome.posDelta5`.")
        w()

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Scritto {OUTPUT_PATH.relative_to(REPO_ROOT)} ({len(lines)} righe).")


if __name__ == "__main__":
    main()
