"""
Distribuzione nel tempo e nello spazio di un evento (docs/PROGETTAZIONE.md
sezione 5.3):

- **quando**: occorrenze per stagione, più la siccità corrente (gare e anni
  dall'ultima occorrenza);
- **dove**: occorrenze per circuito e tasso per gara ospitata (mai il
  numero grezzo da solo: un circuito con 70 gare ne avrà sempre più di uno
  con 8, §5.2).

La sezione "chi" di §5.3 (pilota/costruttore/nazionalità) non serve a
questo spike (nessuno dei 6 eventi di `catalog.py` la richiede per essere
ordinato in `notability.py`) e non è implementata qui.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .engine import occurrences
from .loader import Dataset, Race
from .registry import EventDefinition


@dataclass(frozen=True)
class CircuitRate:
    circuit_id: int
    nome_circuito: str
    occorrenze: int
    gare_ospitate: int
    tasso: float


@dataclass(frozen=True)
class Siccita:
    gare: Optional[int]
    anni: Optional[int]


def occorrenze_per_stagione(dataset: Dataset, event: EventDefinition, **params: Any) -> Dict[int, int]:
    conteggio: Dict[int, int] = {}
    for o in occurrences(dataset, event, **params):
        conteggio[o.race.year] = conteggio.get(o.race.year, 0) + 1
    return conteggio


def occorrenze_e_tasso_per_circuito(
    dataset: Dataset, event: EventDefinition, **params: Any
) -> List[CircuitRate]:
    finestra = dataset.race_window(event.anno_da, event.anno_a)
    gare_ospitate_per_circuito = Counter(r.circuit_id for r in finestra)
    occorse_per_circuito = Counter(o.race.circuit_id for o in occurrences(dataset, event, **params))

    risultato = [
        CircuitRate(
            circuit_id=circuit_id,
            nome_circuito=dataset.circuits[circuit_id].name,
            occorrenze=occorse_per_circuito.get(circuit_id, 0),
            gare_ospitate=n_gare,
            tasso=occorse_per_circuito.get(circuit_id, 0) / n_gare if n_gare else 0.0,
        )
        for circuit_id, n_gare in gare_ospitate_per_circuito.items()
    ]
    risultato.sort(key=lambda c: (c.occorrenze, c.tasso), reverse=True)
    return risultato


def siccita_corrente(dataset: Dataset, event: EventDefinition, **params: Any) -> Siccita:
    """Gare e anni trascorsi dall'ultima occorrenza fino all'ultima gara
    della finestra di copertura — non fino a "oggi": il dataset finisce nel
    2024, calcolare rispetto alla data di sistema non avrebbe senso."""
    finestra = dataset.race_window(event.anno_da, event.anno_a)
    if not finestra:
        return Siccita(gare=None, anni=None)

    occorse = occurrences(dataset, event, **params)
    if not occorse:
        return Siccita(gare=None, anni=None)

    ultima_gara_finestra = max(finestra, key=lambda r: r.date)
    ultima_occorrenza = max(occorse, key=lambda o: o.race.date).race

    gare = sum(1 for r in finestra if r.date > ultima_occorrenza.date)
    anni = ultima_gara_finestra.year - ultima_occorrenza.year
    return Siccita(gare=gare, anni=anni)


def siccita_prima_di(dataset: Dataset, event: EventDefinition, race: Race, **params: Any) -> Siccita:
    """Gare e anni trascorsi dall'occorrenza precedente a `race` — non da
    oggi. È la siccità "al momento del fatto", usata da `notability.py`:
    un fatto è notevole in base a quanto tempo era passato PRIMA che
    accadesse, non in base a quanto ne è passato da allora a oggi.

    Se non c'è un'occorrenza precedente nella finestra, la siccità è la
    lunghezza della finestra trascorsa fino a `race` (il record più lungo
    possibile a quel punto, non "mai successo": nella finestra dei dati
    potrebbe essere la primissima occasione utile).
    """
    finestra = dataset.race_window(event.anno_da, event.anno_a)
    precedenti = [o for o in occurrences(dataset, event, **params) if o.race.date < race.date]

    if not precedenti:
        gare = sum(1 for r in finestra if r.date < race.date)
        anni = max(race.year - event.anno_da, 0)
        return Siccita(gare=gare, anni=anni)

    ultima_precedente = max(precedenti, key=lambda o: o.race.date).race
    gare = sum(1 for r in finestra if ultima_precedente.date < r.date < race.date)
    anni = race.year - ultima_precedente.year
    return Siccita(gare=gare, anni=anni)
