"""
Esporta le coordinate dei circuiti per la vista 4 ("dove", docs/PROGETTAZIONE.md
sezione 5.3 e 7): legge direttamente data/raw/circuits.csv, che ha lat/lng ma
non è ancora letto da nessuno script — `app.events.loader.Circuit` non porta
questi due campi (task E2.x non li usava) e i JSON già esportati da
build_events.py/build_all.py non li includono.

Script a parte invece di estendere il loader condiviso: e' un solo lookup
circuitRef -> {lat, lng}, usato da un'unica vista, e toccare
`app/events/loader.py` (importato da tutti gli altri script del motore
eventi) per due colonne non ancora usate altrove sarebbe un rischio
sproporzionato al beneficio.

Scrive public/data/circuits-geo.json: {circuitRef: {lat, lng, nome, paese}}.

Uso (dalla cartella data-layer):
    python scripts/build_circuits_geo.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Dict

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
REPO_ROOT = DATA_LAYER_DIR.parent
CIRCUITS_CSV_PATH = REPO_ROOT / "data" / "raw" / "circuits.csv"
OUTPUT_PATH = REPO_ROOT / "public" / "data" / "circuits-geo.json"


def build_circuits_geo() -> Dict[str, Any]:
    with open(CIRCUITS_CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return {
            row["circuitRef"]: {
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
                "nome": row["name"],
                "paese": row["country"],
            }
            for row in reader
        }


if __name__ == "__main__":
    geo = build_circuits_geo()
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(geo, f, ensure_ascii=False, indent=2)
    print(f"Circuiti esportati: {len(geo)} -> {OUTPUT_PATH.relative_to(REPO_ROOT)}")
