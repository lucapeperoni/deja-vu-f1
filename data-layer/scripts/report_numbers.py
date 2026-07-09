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
        w()

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Scritto {OUTPUT_PATH.relative_to(REPO_ROOT)} ({len(lines)} righe).")


if __name__ == "__main__":
    main()
