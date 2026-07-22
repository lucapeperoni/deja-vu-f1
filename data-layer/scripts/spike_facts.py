"""
Spike del generatore di fatti notevoli (docs/PROGETTAZIONE.md sezione 5.4,
milestone E1.2): per alcune gare vere stampa gli eventi occorsi del
catalogo (data-layer/app/events/catalog.py), ordinati per notevolezza.

Gare scelte, motivate:
- 1957 British Grand Prix — anni '50/'60, ed è la gara con la guida
  condivisa (due piloti entrambi "vincitori", stesso grid) trovata durante
  la validazione di E1.1: buona prova che il generatore non si rompe su un
  caso limite del dataset.
- 1996 Monaco Grand Prix — anni '90, la gara con solo 3 classificati su 22
  (19 ritiri) che ha smascherato il bug dei numeri grezzi di
  "meno di N classificati" in docs/CATALOGO-EVENTI.md §3: se il generatore
  non la segnala come fatto notevole, l'evento 3 o il punteggio hanno un
  problema.
- 2024 São Paulo Grand Prix — 2024, la vittoria di Verstappen dalla 17ª
  posizione citata in docs/CATALOGO-EVENTI.md come "ultima volta" di più
  soglie di "vittoria da griglia" contemporaneamente.
- la gara più recente del dataset (qualunque essa sia), per mostrare cosa
  il generatore direbbe su una gara "di oggi".

Uso (dalla cartella data-layer, non servono dipendenze esterne):
    python scripts/spike_facts.py
"""

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent

sys.path.insert(0, str(DATA_LAYER_DIR))

from app.events import catalog  # noqa: E402,F401 (registra gli eventi)
from app.events.loader import Dataset, Race, load_dataset  # noqa: E402
from app.events.notability import NotableFact, facts_for_race  # noqa: E402

RACE_IDS_MOTIVATI = {
    780: "1957 British Grand Prix (anni '50/'60 — guida condivisa)",
    229: "1996 Monaco Grand Prix (anni '90 — solo 3 classificati su 22)",
    1141: "2024 São Paulo Grand Prix (2024 — vittoria dalla 17ª posizione)",
}


def _print_facts(dataset: Dataset, race: Race, motivazione: str) -> None:
    circuito = dataset.circuits[race.circuit_id].name
    print(f"=== {race.year} {race.name} ({circuito}) — race_id={race.race_id} ===")
    print(f"    {motivazione}")

    fatti = facts_for_race(dataset, race)
    if not fatti:
        print("    nessun evento del catalogo occorso in questa gara.")
        print()
        return

    for f in fatti:
        parametri_label = ", ".join(f"{k}={v}" for k, v in f.parametri.items()) or "-"
        print(
            f"    [{f.notevolezza:.3f}] {f.event.nome} ({parametri_label}) — "
            f"rarita={f.rarita * 100:.2f}% siccita_gare={f.siccita_gare} "
            f"peso_editoriale={f.peso_editoriale}"
        )
    print()


def main() -> None:
    dataset = load_dataset()

    for race_id, motivazione in RACE_IDS_MOTIVATI.items():
        race = dataset.races[race_id]
        _print_facts(dataset, race, motivazione)

    piu_recente = max(dataset.races.values(), key=lambda r: r.date)
    _print_facts(dataset, piu_recente, "la gara più recente del dataset")


if __name__ == "__main__":
    main()
