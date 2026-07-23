"""
Esporta i nomi di piloti e costruttori per la tabella delle occorrenze del
compositore (vista 2, docs/PROGETTAZIONE.md sezione 7): gli occorrenzeDettaglio
di public/data/events/<eventId>.json portano solo driverId/constructorId
numerici (schema Ergast), che da soli non dicono nulla a chi legge ("driver
id 1: 830"). Con questi due indici il frontend risolve gli id in nomi veri
senza dover leggere data/raw/*.csv a ogni richiesta.

Script a parte invece di estendere il loader condiviso (stesso principio di
build_circuits_geo.py): un solo lookup id -> nome, usato da una sola vista,
non giustifica toccare app/events/loader.py.

Scrive:
- public/data/drivers-index.json: {driverId: "Nome Cognome"}
- public/data/constructors-index.json: {constructorId: "Nome"}

Uso (dalla cartella data-layer):
    python scripts/build_names_index.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Dict

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
REPO_ROOT = DATA_LAYER_DIR.parent
RAW_DIR = REPO_ROOT / "data" / "raw"
PUBLIC_DATA_DIR = REPO_ROOT / "public" / "data"


def build_drivers_index() -> Dict[str, str]:
    with open(RAW_DIR / "drivers.csv", encoding="utf-8") as f:
        return {row["driverId"]: f"{row['forename']} {row['surname']}" for row in csv.DictReader(f)}


def build_constructors_index() -> Dict[str, str]:
    with open(RAW_DIR / "constructors.csv", encoding="utf-8") as f:
        return {row["constructorId"]: row["name"] for row in csv.DictReader(f)}


if __name__ == "__main__":
    drivers = build_drivers_index()
    constructors = build_constructors_index()

    with open(PUBLIC_DATA_DIR / "drivers-index.json", "w", encoding="utf-8") as f:
        json.dump(drivers, f, ensure_ascii=False)
    with open(PUBLIC_DATA_DIR / "constructors-index.json", "w", encoding="utf-8") as f:
        json.dump(constructors, f, ensure_ascii=False)

    print(f"Piloti esportati: {len(drivers)} -> public/data/drivers-index.json")
    print(f"Costruttori esportati: {len(constructors)} -> public/data/constructors-index.json")
