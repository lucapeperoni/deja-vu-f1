"""
Spike del motore di eventi (docs/PROGETTAZIONE.md sezione 11, milestone di
fine fase E1): valuta i 6 eventi di data-layer/app/events/catalog.py su ogni
valore dei loro parametri e stampa nome, finestra, occorrenze, denominatore,
rarita', ultima occorrenza e circuito con piu' occorrenze — da confrontare a
mano con docs/CATALOGO-EVENTI.md.

In coda gira anche un settimo controllo, indipendente dal catalogo
(docs/ROADMAP-3.md E1.1, criterio "il filtro Indianapolis è verificabile:
attivandolo e disattivandolo il conteggio della 'rimonta più grande'
cambia"): non è un evento del catalogo, è solo una verifica diretta su
`Dataset.race_window(..., include_indy500=)` che dimostra che il filtro
dell'Indy 500 (PROGETTAZIONE §5.6 trappola 1) sposta davvero il record.

Uso (dalla cartella data-layer, non servono dipendenze esterne):
    python scripts/spike_events.py
"""

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent

sys.path.insert(0, str(DATA_LAYER_DIR))

from app.events import catalog  # noqa: E402,F401 (registra gli eventi)
from app.events.engine import EventResult, evaluate  # noqa: E402
from app.events.loader import Dataset, load_dataset  # noqa: E402
from app.events.registry import all_events  # noqa: E402


def _format_rarita(rarita) -> str:
    return f"{rarita * 100:.2f}%" if rarita is not None else "n/d"


def _print_result(param_label: str, result: EventResult) -> None:
    print(
        f"    [{param_label}] occorrenze={result.occorrenze:>5} "
        f"denominatore={result.denominatore:>5} "
        f"rarita={_format_rarita(result.rarita):>8} "
        f"ultima={result.ultima_occorrenza or 'mai'} "
        f"circuito_top={result.circuito_top or '-'} "
        f"({result.circuito_top_conteggio})"
    )


def _rimonta_piu_grande(dataset: Dataset, include_indy500: bool):
    """La rimonta piu' grande (grid - posizione finale) nella finestra
    1950-2024, con o senza le gare Indy 500. Non e' un evento del catalogo:
    e' il controllo diretto di PROGETTAZIONE.md §5.6 trappola 1 ("inquina
    i record: la 'rimonta piu' grande di sempre' risulta Indy 1957, 30
    posizioni"). Considera solo risultati con griglia nota (grid is not
    None: chi e' partito dalla pit lane non ha una griglia numerica da cui
    calcolare una rimonta) e posizione finale nota (classificato)."""
    migliore = None
    for race in dataset.race_window(1950, 2024, include_indy500=include_indy500):
        for r in dataset.results_by_race.get(race.race_id, []):
            if r.grid is None or r.position is None:
                continue
            rimonta = r.grid - r.position
            if migliore is None or rimonta > migliore[0]:
                migliore = (rimonta, race, r)
    return migliore


def _check_filtro_indy500_su_rimonta(dataset: Dataset) -> None:
    print("=== Controllo 7 (non un evento del catalogo): filtro Indy 500 "
          "sulla rimonta piu' grande ===")

    con_indy = _rimonta_piu_grande(dataset, include_indy500=True)
    senza_indy = _rimonta_piu_grande(dataset, include_indy500=False)

    for label, esito in (("con Indy 500", con_indy), ("senza Indy 500 (con trappola 1)", senza_indy)):
        if esito is None:
            print(f"    {label}: nessuna gara calcolabile")
            continue
        rimonta, race, result = esito
        circuito = dataset.circuits[race.circuit_id].name
        print(
            f"    {label}: {rimonta} posizioni — {race.year} {race.name} "
            f"({circuito}), griglia {result.grid} -> arrivo {result.position}"
        )

    if con_indy is not None and senza_indy is not None:
        cambia = con_indy[0] != senza_indy[0] or con_indy[1].race_id != senza_indy[1].race_id
        esito_label = "il filtro CAMBIA il record (atteso)" if cambia else "il filtro NON cambia nulla (inatteso: verificare)"
        print(f"    -> {esito_label}")
    print()


def main() -> None:
    dataset = load_dataset()

    for event in all_events():
        print(f"=== {event.nome} ({event.id}) ===")
        print(f"    famiglia={event.famiglia} unita={event.unita} "
              f"finestra={event.anno_da}-{event.anno_a}")

        if event.parametri:
            spec = event.parametri[0]
            for value in spec.values:
                result = evaluate(dataset, event, **{spec.name: value})
                _print_result(f"{spec.name}={value}", result)
        else:
            result = evaluate(dataset, event)
            _print_result("-", result)

        print()

    _check_filtro_indy500_su_rimonta(dataset)


if __name__ == "__main__":
    main()
