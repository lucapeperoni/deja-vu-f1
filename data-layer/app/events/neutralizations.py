"""
La famiglia NEUTRALIZZAZIONI (docs/PROGETTAZIONE.md sezioni 5.5 e 12):
eredita il motore della v2 (costo effettivo del pit stop, prezzo di
listino, sconto, etichette, esiti pilota×evento — vedi
`app/metrics/effective_pit_loss.py` e `app/metrics/decision_snapshots.py`)
SENZA ricalcolare nulla: legge i JSON già prodotti da
`data-layer/scripts/build_all.py` in `public/data/` (`index.json`,
`aggregate.json`). Non tocca `build_all.py` né i suoi output.

Finestra fissa **2023-2024, 46 gare** — non è il perimetro Ergast delle
altre famiglie (1950-2024): è quello di OpenF1, che serve solo per le
finestre SC/VSC (§0/§5.2 di PROGETTAZIONE.md: "OpenF1 (SC/VSC) |
2023-2024 | 46 | neutralizzazioni").

Le "osservazioni" di questa famiglia non sono le `Result` di loader.py
(quelle vengono dai CSV Ergast): sono i pit stop e gli esiti pilota×evento
già calcolati dalla pipeline v2, con lo stesso significato che hanno lì
(§12.2: contesto GREEN/UNDER_VSC/UNDER_SC/JUST_BEFORE/JUST_AFTER per i
pit; categoria EXPLOITED/FULL_PRICE/LOCKED_OUT/NOT_NEEDED/NEUTRAL per gli
esiti). Ogni pit stop e ogni esito porta però con sé la `Race` Ergast
corrispondente (stesso `raceId` di `races.csv`, già presente in
`index.json`), così `engine.py`/`metrics.py` possono riassumere
"quando/dove" esattamente come per le altre famiglie, senza duplicare la
nozione di gara.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

from .loader import Dataset, Race
from .registry import Observation, ParameterSpec, Unit, evento

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent
PUBLIC_DATA_DIR = REPO_ROOT / "public" / "data"

ANNO_DA = 2023
ANNO_A = 2024


@dataclass(frozen=True)
class _DatiNeutralizzazioni:
    index: List[Dict[str, Any]]
    pit_stops: List[Dict[str, Any]]
    outcomes: List[Dict[str, Any]]
    race_by_slug: Dict[str, Race]


_cache_dati: Dict[int, _DatiNeutralizzazioni] = {}


def _carica_dati(dataset: Dataset) -> _DatiNeutralizzazioni:
    chiave = id(dataset)
    if chiave in _cache_dati:
        return _cache_dati[chiave]

    with open(PUBLIC_DATA_DIR / "index.json", encoding="utf-8") as f:
        index = json.load(f)
    with open(PUBLIC_DATA_DIR / "aggregate.json", encoding="utf-8") as f:
        aggregate = json.load(f)

    race_by_slug: Dict[str, Race] = {}
    for entry in index:
        race_id = int(entry["raceId"])
        race_by_slug[entry["id"]] = dataset.races[race_id]

    dati = _DatiNeutralizzazioni(
        index=index,
        pit_stops=aggregate["pitStops"],
        outcomes=aggregate["outcomes"],
        race_by_slug=race_by_slug,
    )
    _cache_dati[chiave] = dati
    return dati


# ---------------------------------------------------------------------------
# 1. Gara con almeno N neutralizzazioni
# ---------------------------------------------------------------------------

def _osservazioni_gara_con_neutralizzazioni(dataset: Dataset) -> List[Observation]:
    dati = _carica_dati(dataset)
    return [
        Observation(race=dati.race_by_slug[entry["id"]], payload=entry["totalNeutralizations"])
        for entry in dati.index
    ]


@evento(
    id="gara_con_almeno_n_neutralizzazioni",
    nome="Gara con almeno N neutralizzazioni",
    famiglia="neutralizzazioni",
    unita=Unit.GARA,
    campi=["public/data/index.json:totalNeutralizations"],
    osservazioni=_osservazioni_gara_con_neutralizzazioni,
    parametri=[ParameterSpec("N", [1, 2, 3])],
    anno_da=ANNO_DA,
    anno_a=ANNO_A,
    peso_editoriale=0.5,
    descrizione="La gara ha avuto almeno N neutralizzazioni (Safety Car o Virtual Safety Car).",
)
def gara_con_almeno_n_neutralizzazioni(n_neutralizzazioni: int, *, N: int) -> bool:
    return n_neutralizzazioni >= N


# ---------------------------------------------------------------------------
# 2. Pit stop sotto Safety Car / sotto VSC
# ---------------------------------------------------------------------------

def _osservazioni_pit_stop(dataset: Dataset) -> List[Observation]:
    dati = _carica_dati(dataset)
    return [
        Observation(race=dati.race_by_slug[pit["raceId"]], payload=pit)
        for pit in dati.pit_stops
    ]


@evento(
    id="pit_sotto_neutralizzazione",
    nome="Pit stop sotto Safety Car / sotto VSC",
    famiglia="neutralizzazioni",
    unita=Unit.RISULTATO,
    campi=["public/data/aggregate.json:pitStops[].context"],
    osservazioni=_osservazioni_pit_stop,
    parametri=[ParameterSpec("contesto", ["UNDER_SC", "UNDER_VSC"])],
    anno_da=ANNO_DA,
    anno_a=ANNO_A,
    peso_editoriale=0.6,
    descrizione="Il pilota si e' fermato ai box mentre la gara era neutralizzata.",
)
def pit_sotto_neutralizzazione(pit: Dict[str, Any], *, contesto: str) -> bool:
    return pit["context"] == contesto


# ---------------------------------------------------------------------------
# 3. Pilota escluso dalla finestra (LOCKED_OUT)
# ---------------------------------------------------------------------------

def _osservazioni_outcome(dataset: Dataset) -> List[Observation]:
    dati = _carica_dati(dataset)
    return [
        Observation(race=dati.race_by_slug[outcome["raceId"]], payload=outcome)
        for outcome in dati.outcomes
    ]


@evento(
    id="pilota_locked_out",
    nome="Pilota escluso dalla finestra (LOCKED_OUT)",
    famiglia="neutralizzazioni",
    unita=Unit.RISULTATO,
    campi=["public/data/aggregate.json:outcomes[].category"],
    osservazioni=_osservazioni_outcome,
    parametri=[],
    anno_da=ANNO_DA,
    anno_a=ANNO_A,
    peso_editoriale=0.55,
    descrizione="Il pilota non ha potuto sfruttare la neutralizzazione: gomme troppo fresche o troppe auto davanti al rientro.",
)
def pilota_locked_out(outcome: Dict[str, Any], **_: object) -> bool:
    return outcome["category"] == "LOCKED_OUT"


# ---------------------------------------------------------------------------
# 4. Pit in double stack
# ---------------------------------------------------------------------------

@evento(
    id="pit_double_stack",
    nome="Pit in double stack",
    famiglia="neutralizzazioni",
    unita=Unit.RISULTATO,
    campi=["public/data/aggregate.json:pitStops[].doubleStack"],
    osservazioni=_osservazioni_pit_stop,
    parametri=[],
    anno_da=ANNO_DA,
    anno_a=ANNO_A,
    peso_editoriale=0.4,
    descrizione="Il pilota si e' fermato subito dopo il compagno di squadra, nella stessa finestra.",
)
def pit_double_stack(pit: Dict[str, Any], **_: object) -> bool:
    return bool(pit["doubleStack"])


# ---------------------------------------------------------------------------
# 5. Pilota "fregato" (JUST_BEFORE)
# ---------------------------------------------------------------------------

@evento(
    id="pilota_fregato",
    nome='Pilota "fregato" (JUST_BEFORE)',
    famiglia="neutralizzazioni",
    unita=Unit.RISULTATO,
    campi=["public/data/aggregate.json:pitStops[].context"],
    osservazioni=_osservazioni_pit_stop,
    parametri=[],
    anno_da=ANNO_DA,
    anno_a=ANNO_A,
    peso_editoriale=0.5,
    descrizione="Il pilota si era fermato pochi giri prima dell'inizio di una neutralizzazione, senza sfruttarne lo sconto.",
)
def pilota_fregato(pit: Dict[str, Any], **_: object) -> bool:
    return pit["context"] == "JUST_BEFORE"
