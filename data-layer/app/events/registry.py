"""
Definizione dichiarativa di un evento (docs/PROGETTAZIONE.md sezione 5.1).

Un evento e': un identificatore, un nome in italiano, una famiglia, l'unita'
di osservazione, i campi CSV da cui dipende (`campi` — trappola 3 di
PROGETTAZIONE §5.6: "ogni evento deve dichiarare da quali campi dipende"),
una funzione che seleziona le osservazioni valide nella sua finestra di
copertura (`osservazioni`), un predicato booleano valutato su ognuna
(`predicate`), i parametri con la loro griglia di valori, la finestra di
copertura e un peso editoriale 0-1. Il decoratore `@evento` registra le
definizioni; `catalog.py` le usa per dichiarare gli eventi del catalogo.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterator, List, Sequence


class Unit:
    """Le tre unita' di osservazione di PROGETTAZIONE.md sezione 5.1."""

    GARA = "GARA"
    RISULTATO = "RISULTATO"
    TEAM_GARA = "TEAM_GARA"


@dataclass(frozen=True)
class ParameterSpec:
    name: str
    values: Sequence[Any]


@dataclass(frozen=True)
class Observation:
    """Una singola unita' osservabile nella finestra di un evento: la gara a
    cui appartiene (per riassumere quando/dove) piu' il payload specifico
    che il predicato dell'evento sa interpretare (un Result, un conteggio,
    una coppia di risultati, ...)."""

    race: Any
    payload: Any = None


@dataclass(frozen=True)
class EventDefinition:
    id: str
    nome: str
    famiglia: str
    unita: str
    campi: List[str]
    osservazioni: Callable[[Any], List[Any]]
    predicate: Callable[..., bool]
    parametri: List[ParameterSpec] = field(default_factory=list)
    anno_da: int = 1950
    anno_a: int = 2024
    peso_editoriale: float = 0.5
    descrizione: str = ""


_REGISTRY: Dict[str, EventDefinition] = {}


def evento(
    *,
    id: str,
    nome: str,
    famiglia: str,
    unita: str,
    campi: List[str],
    osservazioni: Callable[[Any], List[Any]],
    parametri: List[ParameterSpec] = None,
    anno_da: int = 1950,
    anno_a: int = 2024,
    peso_editoriale: float = 0.5,
    descrizione: str = "",
):
    """Decoratore: registra `fn` (il predicato) come evento `id` del catalogo.

    `campi` e' obbligatorio (nessun default): elenca le colonne CSV
    ("tabella.colonna") da cui l'evento dipende, cosi' e' visibile a colpo
    d'occhio quali eventi si appoggiano a un campo con molti valori
    mancanti (es. `results.milliseconds`, vuoto nel 71% dei risultati) —
    trappola 3 di PROGETTAZIONE.md sezione 5.6.
    """

    def decorator(fn: Callable[..., bool]) -> Callable[..., bool]:
        if id in _REGISTRY:
            raise ValueError(f"evento duplicato: {id}")
        if not campi:
            raise ValueError(f"evento '{id}': 'campi' non puo' essere vuoto")
        _REGISTRY[id] = EventDefinition(
            id=id,
            nome=nome,
            famiglia=famiglia,
            unita=unita,
            campi=list(campi),
            osservazioni=osservazioni,
            predicate=fn,
            parametri=parametri or [],
            anno_da=anno_da,
            anno_a=anno_a,
            peso_editoriale=peso_editoriale,
            descrizione=descrizione,
        )
        return fn

    return decorator


def all_events() -> List[EventDefinition]:
    return list(_REGISTRY.values())


def parameter_combinations(event: EventDefinition) -> Iterator[Dict[str, Any]]:
    """Il prodotto cartesiano delle griglie di parametri dell'evento (nel
    catalogo attuale ce n'e' al piu' uno per evento, ma qui si generalizza
    a N parametri senza dover cambiare `engine.py`/`notability.py`/
    `build_events.py` quando servira'). Un evento senza parametri produce
    una sola combinazione vuota."""
    if not event.parametri:
        yield {}
        return
    nomi = [p.name for p in event.parametri]
    griglie = [p.values for p in event.parametri]
    for combo in itertools.product(*griglie):
        yield dict(zip(nomi, combo))


def get_event(event_id: str) -> EventDefinition:
    return _REGISTRY[event_id]


def clear_registry_for_tests() -> None:
    """Solo per i test: svuota il registro cosi' un test puo' registrare
    eventi sintetici senza scontrarsi con id gia' usati da catalog.py."""
    _REGISTRY.clear()
