"""
Loader dei CSV Ergast in data/raw/ (docs/PROGETTAZIONE.md sezione 4 e 5.6).

Applica qui, una volta sola, le normalizzazioni delle "trappole" descritte
in PROGETTAZIONE.md sezione 5.6 e CATALOGO-EVENTI.md sezione 11, cosi' il
motore di eventi (registry.py, catalog.py, engine.py) lavora sempre su dati
gia' puliti e non deve ripetere le stesse decisioni caso per caso:

1. `is_indy500` sulle gare a Indianapolis 1950-1960 (la 500 Miglia contava
   per il mondiale ma non era una gara di F1); le gare a Indianapolis
   2000-2007 (Gran Premio degli Stati Uniti) restano incluse e NON hanno
   questo flag.
2. Tassonomia esplicita dei 139 statusId in 5 categorie (STATUS_CATEGORY_BY_ID
   sotto): non e' calcolata da euristiche sulle stringhe di `status.csv`,
   e' un dizionario id -> categoria scritto a mano e ispezionabile.
3. Campi vuoti ("\\N" nei CSV Ergast) diventano `None`, mai `0` o stringa
   vuota silenziosa.
4. `grid == 0` non e' "posizione zero": diventa `grid = None` +
   `started_from_pit_lane = True` quando il pilota ha comunque preso il via
   (vedi `_normalize_grid`); se invece non ha preso il via per niente
   (non-qualificato/non-partito) resta `grid = None` senza il flag.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent
RAW_DIR = REPO_ROOT / "data" / "raw"


# ---------------------------------------------------------------------------
# Tassonomia dello status (trappola 2 di PROGETTAZIONE.md sezione 5.6)
# ---------------------------------------------------------------------------

class StatusCategory:
    CLASSIFICATO = "CLASSIFICATO"
    NON_QUALIFICATO = "NON_QUALIFICATO"
    NON_PARTITO = "NON_PARTITO"
    RITIRO_TECNICO = "RITIRO_TECNICO"
    RITIRO_INCIDENTE = "RITIRO_INCIDENTE"


# Il pilota ha tagliato il traguardo (anche doppiato): "Finished" e tutte le
# varianti "+N Laps" di status.csv.
_CLASSIFICATO_IDS = {
    1,
    11, 12, 13, 14, 15, 16, 17, 18, 19,
    45, 50, 53, 55, 58, 88,
    111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
    122, 123, 124, 125, 127, 128, 133, 134,
}

# Il pilota non ha ottenuto un posto in griglia: eliminato in qualifica.
_NON_QUALIFICATO_IDS = {
    77,  # 107% Rule
    81,  # Did not qualify
    97,  # Did not prequalify
}

# Il pilota aveva un posto in griglia ma non ha preso il via.
_NON_PARTITO_IDS = {
    54,  # Withdrew
}

# Uscito di gara per un incidente/collisione (in pista, con un altro pilota
# o da solo) o per una conseguenza fisica diretta di un incidente.
_RITIRO_INCIDENTE_IDS = {
    3,    # Accident
    4,    # Collision
    20,   # Spun off
    73,   # Injured
    82,   # Injury
    104,  # Fatal accident
    107,  # Eye injury
    130,  # Collision damage
}

# Tutto il resto: guasti meccanici/elettrici/idraulici, squalifiche ed
# esclusioni post-gara, malori non legati a un incidente, "Not classified"
# (arrivato ma non abbastanza giri per essere classificato). Nessuno di
# questi e' un incidente in pista ne' un mancato via/qualifica, quindi
# ricade nel "ritiro" generico non-incidente.
_RITIRO_TECNICO_IDS = {
    2,  5, 6, 7, 8, 9, 10,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
    41, 42, 43, 44, 46, 47, 48, 49, 51, 56,
    59, 60, 61, 62, 63, 64, 65, 66, 67, 68,
    69, 70, 71, 72, 74, 75, 76, 78, 79, 80,
    83, 84, 85, 86, 87, 89, 90, 91, 92, 93,
    94, 95, 96, 98, 99, 100, 101, 102, 103,
    105, 106, 108, 109, 110, 121, 126, 129,
    131, 132, 135, 136, 137, 138, 139, 140, 141,
}

STATUS_CATEGORY_BY_ID: Dict[int, str] = {}
for _id in _CLASSIFICATO_IDS:
    STATUS_CATEGORY_BY_ID[_id] = StatusCategory.CLASSIFICATO
for _id in _NON_QUALIFICATO_IDS:
    STATUS_CATEGORY_BY_ID[_id] = StatusCategory.NON_QUALIFICATO
for _id in _NON_PARTITO_IDS:
    STATUS_CATEGORY_BY_ID[_id] = StatusCategory.NON_PARTITO
for _id in _RITIRO_INCIDENTE_IDS:
    STATUS_CATEGORY_BY_ID[_id] = StatusCategory.RITIRO_INCIDENTE
for _id in _RITIRO_TECNICO_IDS:
    STATUS_CATEGORY_BY_ID[_id] = StatusCategory.RITIRO_TECNICO

# Insieme delle categorie che contano come "il pilota ha effettivamente
# preso il via" (usato per normalizzare grid == 0, trappola 4).
_HA_PRESO_IL_VIA = {
    StatusCategory.CLASSIFICATO,
    StatusCategory.RITIRO_TECNICO,
    StatusCategory.RITIRO_INCIDENTE,
}


# ---------------------------------------------------------------------------
# Modello dati
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class StatusInfo:
    status_id: int
    name: str
    category: str


@dataclass(frozen=True)
class Circuit:
    circuit_id: int
    ref: str
    name: str
    country: str


@dataclass(frozen=True)
class Race:
    race_id: int
    year: int
    round: int
    circuit_id: int
    name: str
    date: date
    is_indy500: bool


@dataclass(frozen=True)
class Result:
    result_id: int
    race_id: int
    driver_id: int
    constructor_id: int
    grid: Optional[int]
    started_from_pit_lane: bool
    position: Optional[int]
    position_order: int
    points: float
    laps: int
    milliseconds: Optional[int]
    fastest_lap: Optional[int]
    rank: Optional[int]
    status_id: int
    status_category: str


@dataclass
class Dataset:
    races: Dict[int, Race]
    results_by_race: Dict[int, List[Result]]
    circuits: Dict[int, Circuit]
    status_by_id: Dict[int, StatusInfo]

    def race_window(
        self, anno_da: int, anno_a: int, include_indy500: bool = False
    ) -> List[Race]:
        """Le gare della finestra [anno_da, anno_a], con l'Indy 500 esclusa
        di default (trappola 1)."""
        return [
            r
            for r in self.races.values()
            if anno_da <= r.year <= anno_a and (include_indy500 or not r.is_indy500)
        ]


# ---------------------------------------------------------------------------
# Helper di parsing (trappola 3: "\N" -> None, mai 0 o "")
# ---------------------------------------------------------------------------

def _none_if_null(value: str) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return None if value == "" or value == "\\N" else value


def _int_or_none(value: str) -> Optional[int]:
    v = _none_if_null(value)
    return int(v) if v is not None else None


def _float_or_none(value: str) -> Optional[float]:
    v = _none_if_null(value)
    return float(v) if v is not None else None


def _normalize_grid(raw_grid: str, status_category: str) -> Tuple[Optional[int], bool]:
    """Trappola 4: grid == 0 non e' "posizione zero".

    Se il pilota ha comunque preso il via (categoria "ha preso il via"),
    grid == 0 significa partenza dalla pit lane: si azzera a `None` e si
    alza `started_from_pit_lane`. Se invece non ha preso il via affatto
    (non-qualificato/non-partito), grid == 0 e' semplicemente "non
    applicabile", senza il flag pit lane.
    """
    grid = _int_or_none(raw_grid)
    if grid == 0:
        took_the_start = status_category in _HA_PRESO_IL_VIA
        return None, took_the_start
    return grid, False


# ---------------------------------------------------------------------------
# Caricamento
# ---------------------------------------------------------------------------

def _load_status(raw_dir: Path) -> Dict[int, StatusInfo]:
    by_id: Dict[int, StatusInfo] = {}
    with open(raw_dir / "status.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            status_id = int(row["statusId"])
            if status_id not in STATUS_CATEGORY_BY_ID:
                raise ValueError(
                    f"statusId {status_id} ('{row['status']}') non e' mappato in "
                    "STATUS_CATEGORY_BY_ID: la tassonomia deve coprire esplicitamente "
                    "tutti gli statusId di status.csv."
                )
            by_id[status_id] = StatusInfo(
                status_id=status_id,
                name=row["status"],
                category=STATUS_CATEGORY_BY_ID[status_id],
            )
    # Copertura completa nei due sensi: ogni id mappato deve anche esistere
    # davvero in status.csv (altrimenti la tassonomia e' scollegata dai dati).
    extra_ids = set(STATUS_CATEGORY_BY_ID) - set(by_id)
    if extra_ids:
        raise ValueError(
            f"STATUS_CATEGORY_BY_ID mappa statusId assenti da status.csv: {sorted(extra_ids)}"
        )
    return by_id


def _load_circuits(raw_dir: Path) -> Dict[int, Circuit]:
    circuits: Dict[int, Circuit] = {}
    with open(raw_dir / "circuits.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            circuit_id = int(row["circuitId"])
            circuits[circuit_id] = Circuit(
                circuit_id=circuit_id,
                ref=row["circuitRef"],
                name=row["name"],
                country=row["country"],
            )
    return circuits


def _load_races(raw_dir: Path, circuits: Dict[int, Circuit]) -> Dict[int, Race]:
    races: Dict[int, Race] = {}
    with open(raw_dir / "races.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            race_id = int(row["raceId"])
            circuit_id = int(row["circuitId"])
            year = int(row["year"])
            circuit_ref = circuits[circuit_id].ref
            is_indy500 = circuit_ref == "indianapolis" and 1950 <= year <= 1960
            races[race_id] = Race(
                race_id=race_id,
                year=year,
                round=int(row["round"]),
                circuit_id=circuit_id,
                name=row["name"],
                date=date.fromisoformat(row["date"]),
                is_indy500=is_indy500,
            )
    return races


def _load_results(
    raw_dir: Path, status_by_id: Dict[int, StatusInfo]
) -> Dict[int, List[Result]]:
    results_by_race: Dict[int, List[Result]] = {}
    with open(raw_dir / "results.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            status_id = int(row["statusId"])
            status_category = status_by_id[status_id].category
            grid, started_from_pit_lane = _normalize_grid(row["grid"], status_category)
            race_id = int(row["raceId"])
            result = Result(
                result_id=int(row["resultId"]),
                race_id=race_id,
                driver_id=int(row["driverId"]),
                constructor_id=int(row["constructorId"]),
                grid=grid,
                started_from_pit_lane=started_from_pit_lane,
                position=_int_or_none(row["position"]),
                position_order=int(row["positionOrder"]),
                points=float(row["points"]),
                laps=int(row["laps"]),
                milliseconds=_int_or_none(row["milliseconds"]),
                fastest_lap=_int_or_none(row["fastestLap"]),
                rank=_int_or_none(row["rank"]),
                status_id=status_id,
                status_category=status_category,
            )
            results_by_race.setdefault(race_id, []).append(result)
    return results_by_race


def load_dataset(raw_dir: Path = RAW_DIR) -> Dataset:
    status_by_id = _load_status(raw_dir)
    circuits = _load_circuits(raw_dir)
    races = _load_races(raw_dir, circuits)
    results_by_race = _load_results(raw_dir, status_by_id)
    return Dataset(
        races=races,
        results_by_race=results_by_race,
        circuits=circuits,
        status_by_id=status_by_id,
    )


def load_lap_leaders(raw_dir: Path = RAW_DIR) -> Dict[int, List[Tuple[int, int]]]:
    """Per ogni raceId presente in lap_times.csv, la sequenza (lap, driverId)
    di chi comanda in quel giro (position == 1), ordinata per giro.

    Caricato a parte da `load_dataset` perche' lap_times.csv e' ~17 MB e
    serve solo all'evento "nessun cambio di leader" (finestra 1996+).
    """
    leaders_by_race: Dict[int, List[Tuple[int, int]]] = {}
    with open(raw_dir / "lap_times.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["position"] != "1":
                continue
            race_id = int(row["raceId"])
            leaders_by_race.setdefault(race_id, []).append(
                (int(row["lap"]), int(row["driverId"]))
            )
    for race_id, entries in leaders_by_race.items():
        entries.sort(key=lambda e: e[0])
    return leaders_by_race


def load_pit_stop_counts(raw_dir: Path = RAW_DIR) -> Dict[Tuple[int, int], int]:
    """Numero di soste per (raceId, driverId), da pit_stops.csv (2011-2024).

    Caricato a parte da `load_dataset` per lo stesso motivo di
    `load_lap_leaders`: serve solo alla famiglia STRATEGIA (finestra
    2011+). Una chiave assente significa "questa gara non e' coperta da
    pit_stops.csv", non "zero soste" — è compito di chi consuma questo
    dizionario controllare la copertura della gara (vedi
    `_gare_con_pit_stops` in catalog.py) prima di leggere 0 per un pilota
    che semplicemente non e' in questo dizionario.
    """
    conteggio: Dict[Tuple[int, int], int] = {}
    with open(raw_dir / "pit_stops.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            chiave = (int(row["raceId"]), int(row["driverId"]))
            conteggio[chiave] = conteggio.get(chiave, 0) + 1
    return conteggio
