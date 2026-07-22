"""
Motore di eventi (docs/PROGETTAZIONE.md sezione 5.1/5.2): valuta un evento
su tutte le unita' osservabili della sua finestra di copertura e restituisce
occorrenze, denominatore e rarita'.

    rarita' = occorrenze / unita' osservabili nella finestra di copertura

Il "denominatore" non e' un conteggio arbitrario: e' esattamente il numero
di osservazioni che `event.osservazioni(dataset)` ha ritenuto valide (gia'
filtrate per finestra, Indy 500 e campi mancanti da `catalog.py`) — cosi'
la trappola 3 di PROGETTAZIONE.md ("le unita' con campo mancante escono dal
denominatore, non contate come 'non e' successo'") e' rispettata per
costruzione, non con un controllo a posteriori.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .loader import Dataset
from .registry import EventDefinition, Observation


@dataclass(frozen=True)
class EventResult:
    event_id: str
    parametri: Dict[str, Any]
    occorrenze: int
    denominatore: int
    rarita: Optional[float]
    ultima_occorrenza: Optional[str]
    circuito_top: Optional[str]
    circuito_top_conteggio: int


# Cache di event.osservazioni(dataset) per (id(dataset), event.id): costruire
# l'universo delle osservazioni (scandire tutte le gare/risultati della
# finestra) e' la parte costosa, e NON dipende dai parametri — un evento con
# 4 valori di N rifarebbe altrimenti la stessa scansione 4 volte. Valida
# finche' lo stesso oggetto Dataset viene riusato senza essere ricostruito
# (vedi la stessa tecnica in notability.py per le statistiche del catalogo).
_cache_osservazioni: Dict[Any, List[Observation]] = {}


def _osservazioni_cached(dataset: Dataset, event: EventDefinition) -> List[Observation]:
    chiave = (id(dataset), event.id)
    if chiave not in _cache_osservazioni:
        _cache_osservazioni[chiave] = event.osservazioni(dataset)
    return _cache_osservazioni[chiave]


def occurrences(dataset: Dataset, event: EventDefinition, **params: Any) -> List[Observation]:
    """Le sole osservazioni della finestra di `event` in cui il predicato è
    vero. Usata sia da `evaluate` sia da `metrics.py`/`notability.py`, così
    la nozione di "occorrenza" resta una sola in tutto il motore."""
    osservazioni: List[Observation] = _osservazioni_cached(dataset, event)
    return [o for o in osservazioni if event.predicate(o.payload, **params)]


def evaluate(dataset: Dataset, event: EventDefinition, **params: Any) -> EventResult:
    denominatore = len(_osservazioni_cached(dataset, event))
    occorse = occurrences(dataset, event, **params)
    occorrenze = len(occorse)
    rarita = occorrenze / denominatore if denominatore else None

    ultima_occorrenza = None
    circuito_top = None
    circuito_top_conteggio = 0

    if occorse:
        ultima_race = max(occorse, key=lambda o: o.race.date).race
        ultima_occorrenza = f"{ultima_race.year} {dataset.circuits[ultima_race.circuit_id].name}"

        conteggio_per_circuito: Dict[int, int] = {}
        for o in occorse:
            conteggio_per_circuito[o.race.circuit_id] = (
                conteggio_per_circuito.get(o.race.circuit_id, 0) + 1
            )
        top_circuit_id = max(conteggio_per_circuito, key=lambda cid: conteggio_per_circuito[cid])
        circuito_top = dataset.circuits[top_circuit_id].name
        circuito_top_conteggio = conteggio_per_circuito[top_circuit_id]

    return EventResult(
        event_id=event.id,
        parametri=dict(params),
        occorrenze=occorrenze,
        denominatore=denominatore,
        rarita=rarita,
        ultima_occorrenza=ultima_occorrenza,
        circuito_top=circuito_top,
        circuito_top_conteggio=circuito_top_conteggio,
    )
