"""
Definizione dichiarativa di un evento (docs/PROGETTAZIONE.md sezione 5.1).

Un evento e': un identificatore, un nome in italiano, una famiglia, l'unita'
di osservazione, una funzione che seleziona le osservazioni valide nella sua
finestra di copertura (`osservazioni`), un predicato booleano valutato su
ognuna (`predicate`), i parametri con la loro griglia di valori, la finestra
di copertura e un peso editoriale 0-1. Il decoratore `@evento` registra le
definizioni; `catalog.py` le usa per dichiarare i 6 eventi dello spike.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Sequence


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
    osservazioni: Callable[[Any], List[Any]],
    parametri: List[ParameterSpec] = None,
    anno_da: int = 1950,
    anno_a: int = 2024,
    peso_editoriale: float = 0.5,
    descrizione: str = "",
):
    """Decoratore: registra `fn` (il predicato) come evento `id` del catalogo."""

    def decorator(fn: Callable[..., bool]) -> Callable[..., bool]:
        if id in _REGISTRY:
            raise ValueError(f"evento duplicato: {id}")
        _REGISTRY[id] = EventDefinition(
            id=id,
            nome=nome,
            famiglia=famiglia,
            unita=unita,
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


def get_event(event_id: str) -> EventDefinition:
    return _REGISTRY[event_id]


def clear_registry_for_tests() -> None:
    """Solo per i test: svuota il registro cosi' un test puo' registrare
    eventi sintetici senza scontrarsi con id gia' usati da catalog.py."""
    _REGISTRY.clear()
