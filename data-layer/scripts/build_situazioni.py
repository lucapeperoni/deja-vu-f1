"""
Le tabelle delle situazioni (Déjà vu, v4 — docs/PROGETTAZIONE-v4.md §6,
docs/ROADMAP-7.md fase D1.1).

Legge i CSV Ergast in data/raw/ e scrive due tabelle COLONNARI (array
paralleli, stesso schema di results-plane.json) in public/data/situazioni/:

- risultati.json — una riga per riga di results.csv (26.759): il risultato
  pilota×gara arricchito con quello che serve ai fatti atomici del motore
  (griglia, arrivo, stato, giri, giro veloce, posizione dopo il giro 1, giri
  al comando, soste, qualifica, compagno di squadra, contatori di carriera).
- gare.json — una riga per gara (1125): contesto di gara (classificati,
  ritiri, cambi di leader, margine, doppietta, neutralizzazioni).

Regole ereditate dalla v3 (le 5 trappole, docs/PROGETTAZIONE.md §5.6):
- Indy 500 1950-1960 presente ma marcata (`indy`), così il motore la esclude.
- Tassonomia degli status: lo stesso dizionario a mano di app/events/loader.py.
- \\N diventa null, MAI 0. Le colonne derivate da tempi sul giro (1996+),
  soste (2011+), qualifiche (1994+) sono null fuori finestra: "non lo
  sappiamo" è diverso da "non è successo".
- grid == 0: se il pilota ha preso il via è partenza dalla pit lane
  (`pitLane` = 1, `griglia` = null); altrimenti griglia null e basta.

Ogni colonna dichiara la sua finestra in `meta.finestre`, ed è da lì che il
motore calcola l'intersezione delle finestre di una situazione.

Uso (dalla cartella data-layer, con l'ambiente virtuale attivo):
    python scripts/build_situazioni.py
"""

from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
REPO_ROOT = DATA_LAYER_DIR.parent
RAW_DIR = REPO_ROOT / "data" / "raw"
OUT_DIR = REPO_ROOT / "public" / "data" / "situazioni"
RACES_V2_DIR = REPO_ROOT / "public" / "data" / "races"

sys.path.insert(0, str(DATA_LAYER_DIR))
from app.events.loader import STATUS_CATEGORY_BY_ID, StatusCategory  # noqa: E402

STATO_CODES = [
    StatusCategory.CLASSIFICATO,
    StatusCategory.NON_QUALIFICATO,
    StatusCategory.NON_PARTITO,
    StatusCategory.RITIRO_TECNICO,
    StatusCategory.RITIRO_INCIDENTE,
]
HA_PRESO_IL_VIA = {0, 3, 4}  # indici in STATO_CODES

# Finestre di copertura per colonna (anno da, anno a). Verificate sui CSV
# l'11 set 2026: lap_times 1996-2024, pit_stops 2011-2024, qualifying
# 1994-2024, fastestLap/rank 2004-2024.
FINESTRE = {
    "base": (1950, 2024),
    "giroVeloce": (2004, 2024),
    "tempiSulGiro": (1996, 2024),
    "soste": (2011, 2024),
    "qualifica": (1994, 2024),
    "neutralizzazioni": (2023, 2024),
}


def read(name: str, **kw) -> pd.DataFrame:
    return pd.read_csv(RAW_DIR / name, na_values=["\\N"], keep_default_na=False, **kw)


def col(series: pd.Series, kind: str = "int") -> list:
    """Serializza una colonna: NaN -> None, numeri -> int/float nativi."""
    out = []
    for v in series.tolist():
        if v is None or (isinstance(v, float) and np.isnan(v)):
            out.append(None)
        elif kind == "int":
            out.append(int(v))
        else:
            out.append(float(v))
    return out


def main() -> None:
    results = read("results.csv")
    races = read("races.csv")
    circuits = read("circuits.csv")
    laps = read("lap_times.csv", usecols=["raceId", "driverId", "lap", "position"])
    pits = read("pit_stops.csv", usecols=["raceId", "driverId", "stop", "lap"])
    quali = read("qualifying.csv", usecols=["raceId", "driverId", "position"])

    races = races.merge(circuits[["circuitId", "circuitRef", "country"]], on="circuitId")
    races["indy"] = ((races.circuitRef == "indianapolis") & (races.year <= 1960)).astype(int)
    races = races.sort_values(["year", "round"]).reset_index(drop=True)
    race_meta = races.set_index("raceId")

    # ------------------------------------------------------------------
    # risultati: base
    # ------------------------------------------------------------------
    r = results.merge(races[["raceId", "year", "round", "date"]], on="raceId", how="left")
    r["statoCat"] = r.statusId.map(lambda s: STATO_CODES.index(STATUS_CATEGORY_BY_ID[int(s)]))
    unknown = r.statusId[~r.statusId.isin(STATUS_CATEGORY_BY_ID.keys())]
    if len(unknown):
        raise SystemExit(f"statusId senza categoria: {sorted(unknown.unique())}")

    ha_preso_il_via = r.statoCat.isin(HA_PRESO_IL_VIA)
    r["pitLane"] = ((r.grid == 0) & ha_preso_il_via).astype(int)
    r["griglia"] = r.grid.where(r.grid > 0)  # 0 -> null (trappola 4)
    r["arrivo"] = r.position
    r["ordine"] = r.positionOrder
    r["giri"] = r.laps
    r["giroVeloceRank"] = r["rank"].where(r.year >= FINESTRE["giroVeloce"][0])
    r["punti"] = r.points

    winner_ms = r[r.position == 1].groupby("raceId").milliseconds.first()
    r["msDalVincitore"] = r.milliseconds - r.raceId.map(winner_ms)
    r.loc[r.position == 1, "msDalVincitore"] = 0
    r.loc[r.milliseconds.isna(), "msDalVincitore"] = np.nan

    # ------------------------------------------------------------------
    # risultati: dai tempi sul giro (1996+)
    # ------------------------------------------------------------------
    laps = laps.sort_values(["raceId", "driverId", "lap"])
    g = laps.groupby(["raceId", "driverId"])
    lap1 = laps[laps.lap == 1].set_index(["raceId", "driverId"]).position
    led = laps[laps.position == 1].groupby(["raceId", "driverId"]).lap
    derived = pd.DataFrame({
        "posDopoGiro1": lap1,
        "giriAlComando": led.size(),
        "primoGiroAlComando": led.min(),
        "posPeggiore": g.position.max(),
        "posMigliore": g.position.min(),
    })
    derived["giriAlComando"] = derived.giriAlComando.fillna(0)
    races_with_laps = set(laps.raceId.unique())
    r = r.merge(derived, left_on=["raceId", "driverId"], right_index=True, how="left")
    in_lap_window = r.raceId.isin(races_with_laps)
    # Piloti che hanno preso il via in una gara CON tempi sul giro ma senza
    # righe proprie (es. ritirati al giro 1): giriAlComando = 0 è vero, il
    # resto resta null. Fuori finestra tutto null.
    r.loc[in_lap_window & ha_preso_il_via, "giriAlComando"] = r.loc[in_lap_window & ha_preso_il_via, "giriAlComando"].fillna(0)
    r.loc[~in_lap_window, ["posDopoGiro1", "giriAlComando", "primoGiroAlComando", "posPeggiore", "posMigliore"]] = np.nan

    # ------------------------------------------------------------------
    # risultati: soste (2011+) e qualifica (1994+)
    # ------------------------------------------------------------------
    pg = pits.groupby(["raceId", "driverId"])
    ps = pd.DataFrame({"soste": pg.stop.max(), "giroPrimaSosta": pg.lap.min()})
    r = r.merge(ps, left_on=["raceId", "driverId"], right_index=True, how="left")
    in_pit_window = r.year >= FINESTRE["soste"][0]
    r.loc[in_pit_window & ha_preso_il_via, "soste"] = r.loc[in_pit_window & ha_preso_il_via, "soste"].fillna(0)
    r.loc[~in_pit_window, ["soste", "giroPrimaSosta"]] = np.nan

    q = quali.rename(columns={"position": "posQualifica"}).drop_duplicates(["raceId", "driverId"])
    r = r.merge(q, on=["raceId", "driverId"], how="left")
    r.loc[r.year < FINESTRE["qualifica"][0], "posQualifica"] = np.nan

    # ------------------------------------------------------------------
    # risultati: compagno di squadra (ordine del compagno, se uno solo)
    # ------------------------------------------------------------------
    team_size = r.groupby(["raceId", "constructorId"]).driverId.transform("size")
    team_order_sum = r.groupby(["raceId", "constructorId"]).ordine.transform("sum")
    r["ordineCompagno"] = (team_order_sum - r.ordine).where(team_size == 2)

    # ------------------------------------------------------------------
    # risultati: contatori di carriera (in ordine cronologico, PRIMA della gara)
    # ------------------------------------------------------------------
    r = r.sort_values(["date", "raceId", "positionOrder"]).reset_index(drop=True)
    r["_win"] = (r.position == 1).astype(int)
    r["_podio"] = (r.position <= 3).astype(int)
    r["_pole"] = (r.grid == 1).astype(int)
    byd = r.groupby("driverId")
    r["gpInCarriera"] = byd.cumcount() + 1
    r["vittoriePrima"] = byd._win.cumsum() - r._win
    r["podiPrima"] = byd._podio.cumsum() - r._podio
    r["polePrima"] = byd._pole.cumsum() - r._pole
    r["circuitRef"] = r.raceId.map(race_meta.circuitRef)
    bydc = r.groupby(["driverId", "circuitRef"])
    r["vittorieSuCircuitoPrima"] = bydc._win.cumsum() - r._win
    r = r.sort_values("resultId").reset_index(drop=True)

    # ------------------------------------------------------------------
    # gare
    # ------------------------------------------------------------------
    rg = r.groupby("raceId")
    gare = pd.DataFrame({
        "partiti": rg.statoCat.apply(lambda s: int(s.isin(HA_PRESO_IL_VIA).sum())),
        "classificati": rg.statoCat.apply(lambda s: int((s == 0).sum())),
        "ritiri": rg.statoCat.apply(lambda s: int(s.isin({3, 4}).sum())),
    })
    top = r[r.position.isin([1, 2, 3])].sort_values(["raceId", "position"])
    podio_teams = top.groupby("raceId").constructorId.apply(list)
    gare["doppietta"] = podio_teams.map(lambda t: int(len(t) >= 2 and t[0] == t[1]))
    gare["tripletta"] = podio_teams.map(lambda t: int(len(t) >= 3 and t[0] == t[1] == t[2]))
    second_ms = r[r.position == 2].groupby("raceId").msDalVincitore.first()
    gare["margineMs"] = second_ms

    # cambi di leader dai tempi sul giro
    leaders = laps[laps.position == 1].sort_values(["raceId", "lap"])
    def leader_stats(df: pd.DataFrame) -> pd.Series:
        seq = df.driverId.tolist()
        changes = sum(1 for a, b in zip(seq, seq[1:]) if a != b)
        last_lap_change = int(len(seq) >= 2 and seq[-1] != seq[-2])
        return pd.Series({"cambiDiLeader": changes, "leaderDiversi": len(set(seq)), "vittoriaUltimoGiro": last_lap_change})
    ls = leaders.groupby("raceId").apply(leader_stats)
    gare = gare.join(ls)

    # neutralizzazioni v2 (2023-2024), dai JSON già prodotti da build_all.py
    neutr = {}
    for f in RACES_V2_DIR.glob("*.json"):
        d = json.loads(f.read_text())
        neutr[int(d["race"]["raceId"])] = len(d.get("neutralizations") or [])
    gare["neutralizzazioni"] = pd.Series(neutr)

    gare = gare.reindex(races.raceId)  # ordine cronologico, tutte le 1125
    gare["anno"] = races.set_index("raceId").year
    gare["round"] = races.set_index("raceId")["round"]
    gare["circuitRef"] = races.set_index("raceId").circuitRef
    gare["paese"] = races.set_index("raceId").country
    gare["indy"] = races.set_index("raceId").indy
    gare["nome"] = races.set_index("raceId")["name"]
    gare["data"] = races.set_index("raceId")["date"]

    # ------------------------------------------------------------------
    # Serializzazione colonnare
    # ------------------------------------------------------------------
    # Serializzazione compatta. Tre scelte, tutte dichiarate in meta:
    # 1. righe ordinate per (raceId, ordine): raceId va per differenza e
    #    ordine diventa quasi sempre +1 (entrambi comprimono a niente);
    # 2. le colonne DERIVABILI dal resto della tabella con una passata
    #    cronologica (contatori di carriera, ordine del compagno) NON si
    #    spediscono: pesavano ~95 KB compressi su 275 e il motore le
    #    ricalcola alla decodifica (scripts/verify-situazioni.ts le confronta
    #    con i numeri di questo script);
    # 3. il distacco dal vincitore va in decimi di secondo, non millisecondi.
    r = r.sort_values(["raceId", "ordine"]).reset_index(drop=True)
    r["raceIdDelta"] = r.raceId.diff().fillna(r.raceId.iloc[0]).astype(int)
    r["decimiDalVincitore"] = (r.msDalVincitore / 100).round()

    ris_cols_int = [
        "raceIdDelta", "driverId", "constructorId", "griglia", "pitLane", "arrivo", "ordine",
        "statoCat", "statusId", "giri", "giroVeloceRank", "decimiDalVincitore",
        "posDopoGiro1", "giriAlComando", "primoGiroAlComando", "posPeggiore", "posMigliore",
        "soste", "giroPrimaSosta", "posQualifica",
    ]
    risultati = {c: col(r[c]) for c in ris_cols_int}
    risultati["punti"] = [int(v) if float(v).is_integer() else float(v) for v in r.punti.tolist()]
    finestre_base = [c for c in ris_cols_int if c not in (
        "giroVeloceRank", "posDopoGiro1", "giriAlComando", "primoGiroAlComando",
        "posPeggiore", "posMigliore", "soste", "giroPrimaSosta", "posQualifica")]
    risultati_out = {
        "versione": 1,
        "righe": len(r),
        "ordinamento": "raceId crescente, poi ordine di arrivo",
        "statoCodes": STATO_CODES,
        "colonne": risultati,
        "derivate": {
            "descrizione": "Colonne che il motore ricalcola alla decodifica da questa stessa tabella + gare.json (ordine cronologico per data), per non spedirle: i valori attesi sono verificati in scripts/verify-situazioni.ts contro build_situazioni.py.",
            "gpInCarriera": "numero progressivo di gare del pilota, questa compresa",
            "vittoriePrima": "vittorie del pilota prima di questa gara",
            "podiPrima": "podi prima di questa gara",
            "polePrima": "partenze dalla 1a casella prima di questa gara",
            "vittorieSuCircuitoPrima": "vittorie del pilota su questo circuito prima di questa gara",
            "ordineCompagno": "ordine di arrivo del compagno, se il team aveva esattamente 2 piloti",
        },
        "meta": {
            "finestre": {
                **{c: FINESTRE["base"] for c in finestre_base},
                "punti": FINESTRE["base"],
                "giroVeloceRank": FINESTRE["giroVeloce"],
                **{c: FINESTRE["tempiSulGiro"] for c in ("posDopoGiro1", "giriAlComando", "primoGiroAlComando", "posPeggiore", "posMigliore")},
                "soste": FINESTRE["soste"], "giroPrimaSosta": FINESTRE["soste"],
                "posQualifica": FINESTRE["qualifica"],
            },
            "note": {
                "raceIdDelta": "raceId per differenza dalla riga precedente (la prima riga porta il valore pieno)",
                "griglia": "null = sconosciuta o pit lane (vedi pitLane) o non partito; mai 0",
                "arrivo": "null = non classificato (vedi statoCat)",
                "decimiDalVincitore": "decimi di secondo dal vincitore; null se il pilota non ha un tempo (doppiato, ritirato)",
                "giriAlComando": "0 = ha corso senza mai guidare; null = fuori finestra o senza tempi sul giro",
                "soste": "0 = nessuna sosta registrata (2011+); null = fuori finestra",
            },
        },
    }

    gare_cols = ["raceId", "anno", "round", "indy", "partiti", "classificati", "ritiri",
                 "doppietta", "tripletta", "margineMs", "cambiDiLeader", "leaderDiversi",
                 "vittoriaUltimoGiro", "neutralizzazioni"]
    gare = gare.reset_index()
    gare_out = {
        "versione": 1,
        "righe": len(gare),
        "colonne": {
            **{c: col(gare[c]) for c in gare_cols},
            "circuitRef": gare.circuitRef.tolist(),
            "paese": gare.paese.tolist(),
            "nome": gare.nome.tolist(),
            "data": gare.data.tolist(),
        },
        "meta": {
            "finestre": {
                **{c: FINESTRE["base"] for c in gare_cols if c not in ("cambiDiLeader", "leaderDiversi", "vittoriaUltimoGiro", "neutralizzazioni")},
                **{c: FINESTRE["tempiSulGiro"] for c in ("cambiDiLeader", "leaderDiversi", "vittoriaUltimoGiro")},
                "neutralizzazioni": FINESTRE["neutralizzazioni"],
            },
            "note": {
                "indy": "1 = 500 Miglia di Indianapolis 1950-1960: presente ma da escludere da ogni denominatore",
                "margineMs": "millisecondi tra 1° e 2°; null se il 2° non ha un tempo (doppiato o assente)",
                "vittoriaUltimoGiro": "1 = il leader e' cambiato nell'ultimo giro (tempi sul giro, 1996+)",
            },
        },
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, payload in (("risultati.json", risultati_out), ("gare.json", gare_out)):
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        (OUT_DIR / name).write_bytes(raw)
        print(f"{name}: {len(raw)/1024:.1f} KB grezzi, {len(gzip.compress(raw, 9))/1024:.1f} KB gzip")

    # ------------------------------------------------------------------
    # Verifica obbligatoria (ROADMAP-7 D1.1), numeri calcolati a mano l'11 set 2026
    # ------------------------------------------------------------------
    rr = r.merge(gare[["raceId", "indy", "circuitRef"]].rename(columns={"circuitRef": "_c"}), on="raceId")
    rr = rr[rr.indy == 0]
    w10 = rr[(rr.arrivo == 1) & (rr.griglia >= 10)]
    n_gare = rr.raceId.nunique()
    monza = w10[w10._c == "monza"]
    ham = w10[w10.driverId == 1]
    validi = int((rr.griglia.notna() & rr.arrivo.notna()).sum())
    checks = [
        ("vittorie da griglia >=10", len(w10), 37),
        ("gare non Indy", n_gare, 1114),
        ("... a Monza", len(monza), 2),
        ("... di Hamilton", len(ham), 2),
        ("risultati con griglia e arrivo noti", validi, 15518),
        ("gare di Hamilton a Monza", int(rr[(rr.driverId == 1) & (rr._c == "monza")].raceId.nunique()), 18),
        ("gare totali", len(gare), 1125),
        ("righe risultati", len(r), 26759),
    ]
    ok = True
    for label, got, exp in checks:
        flag = "OK " if got == exp else "ERR"
        ok = ok and got == exp
        print(f"  [{flag}] {label}: {got} (atteso {exp})")
    print(f"  Hamilton altrove: {sorted(ham.year.tolist())}  Monza: {sorted(monza.year.tolist())}")
    print(f"  Gasly Monza 2020 primo giro al comando: {int(r[(r.raceId == 1038) & (r.driverId == 842)].primoGiroAlComando.iloc[0])} (atteso 28)")
    if not ok:
        raise SystemExit("Verifica fallita")


if __name__ == "__main__":
    main()
