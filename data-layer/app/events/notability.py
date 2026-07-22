"""
Il punteggio di notevolezza (docs/PROGETTAZIONE.md sezione 5.4):

    notevolezza = PESO_RARITA * (1 - rarita_normalizzata)
                + PESO_SICCITA * siccita_normalizzata
                + PESO_EDITORIALE * peso_editoriale

Non è un modello: è una regola di ordinamento dichiarata a mano, esattamente
come dice §5.4 ("la rarità pura premierebbe sempre gli eventi assurdi e
irrilevanti, la siccità da sola premierebbe i ritorni banali, il peso
editoriale tiene conto della rilevanza umana"). I tre pesi sono costanti
qui sopra, in un unico posto — nella pipeline vera finirebbero in
params.json, come già succede per le soglie della v2.

`rarita_normalizzata` e `siccita_normalizzata` sono min-max su TUTTO il
catalogo (tutti gli eventi, tutte le combinazioni di parametri): serve per
poter confrontare un evento su 1125 gare con uno su 285 sulla stessa scala
0-1, non per dire che le due rarità "sono la stessa cosa" (quello lo dice
sempre e solo la finestra dichiarata, mai questo punteggio).

Due correzioni trovate facendo girare `scripts/spike_facts.py` su gare
vere (milestone E1.2):

1. **Deduplica delle famiglie di soglie monotone.** Un evento come
   "vittoria partendo N° o peggio" (N ∈ {5,10,15,20}) è monotono: una
   rimonta dalla 17ª posizione soddisfa contemporaneamente N=5, N=10 e
   N=15, e senza deduplica il generatore riportava la STESSA vittoria tre
   volte come tre fatti distinti. Non serve sapere in che direzione un
   parametro è monotono (crescente o decrescente): se più combinazioni
   dello stesso evento occorrono nella stessa gara, quella con la rarità
   più bassa è per definizione la più stringente (un sottoinsieme di
   un'occorrenza più comune ha sempre rarità minore o uguale), quindi
   tenere solo quella basta ed è generico, senza bisogno di dichiarare
   monotonia evento per evento.
2. **Le statistiche del catalogo si ricalcolavano ad ogni gara.**
   `_statistiche_catalogo` rivaluta tutti gli eventi su tutte le
   combinazioni di parametri: chiamarla una volta per gara (come faceva
   `facts_for_race`) su 4 gare costava ~24s. Cache per istanza di
   `Dataset` (`_cache_statistiche`): il dataset non cambia tra una
   chiamata e l'altra nello stesso processo, quindi si ricalcola una sola
   volta.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from .engine import evaluate, occurrences
from .loader import Dataset, Race
from .metrics import siccita_prima_di
from .registry import EventDefinition, all_events

PESO_RARITA = 0.4
PESO_SICCITA = 0.3
PESO_EDITORIALE = 0.3


@dataclass(frozen=True)
class NotableFact:
    event: EventDefinition
    parametri: Dict[str, Any]
    rarita: float
    siccita_gare: int
    peso_editoriale: float
    notevolezza: float


def _combinazioni_parametri(event: EventDefinition):
    """Il prodotto cartesiano delle griglie di parametri dell'evento (nel
    catalogo attuale ce n'è al più uno, ma la definizione di registry.py ne
    ammette di più: qui si generalizza senza bisogno di toccare gli altri
    file quando succederà)."""
    if not event.parametri:
        yield {}
        return
    nomi = [p.name for p in event.parametri]
    griglie = [p.values for p in event.parametri]
    for combo in itertools.product(*griglie):
        yield dict(zip(nomi, combo))


def _statistiche_catalogo(dataset: Dataset) -> Tuple[float, float, int, int]:
    rarita_values: List[float] = []
    siccita_values: List[int] = []

    for event in all_events():
        for params in _combinazioni_parametri(event):
            risultato = evaluate(dataset, event, **params)
            if risultato.rarita is not None:
                rarita_values.append(risultato.rarita)
            for o in occurrences(dataset, event, **params):
                siccita = siccita_prima_di(dataset, event, o.race, **params)
                siccita_values.append(siccita.gare)

    rarita_min = min(rarita_values) if rarita_values else 0.0
    rarita_max = max(rarita_values) if rarita_values else 1.0
    siccita_min = min(siccita_values) if siccita_values else 0
    siccita_max = max(siccita_values) if siccita_values else 0
    return rarita_min, rarita_max, siccita_min, siccita_max


# Cache per istanza di Dataset (id(dataset) -> statistiche): valida finche'
# lo stesso oggetto Dataset viene riusato senza essere ricostruito da capo
# (load_dataset() ne crea uno nuovo ad ogni chiamata, quindi la cache non
# mescola mai dataset diversi tra loro).
_cache_statistiche: Dict[int, Tuple[float, float, int, int]] = {}


def _statistiche_catalogo_cached(dataset: Dataset) -> Tuple[float, float, int, int]:
    chiave = id(dataset)
    if chiave not in _cache_statistiche:
        _cache_statistiche[chiave] = _statistiche_catalogo(dataset)
    return _cache_statistiche[chiave]


def _normalizza(value: float, minimo: float, massimo: float) -> float:
    if massimo == minimo:
        return 0.0
    return (value - minimo) / (massimo - minimo)


def _tieni_solo_il_piu_estremo(fatti: List[NotableFact]) -> List[NotableFact]:
    """Se più combinazioni di parametri dello STESSO evento occorrono nella
    stessa gara (famiglie di soglie monotone: vedi il modulo docstring),
    tiene solo quella con la rarità più bassa — la più stringente — e
    scarta le altre come ridondanti."""
    migliore_per_evento: Dict[str, NotableFact] = {}
    for f in fatti:
        attuale = migliore_per_evento.get(f.event.id)
        if attuale is None or f.rarita < attuale.rarita:
            migliore_per_evento[f.event.id] = f
    return list(migliore_per_evento.values())


def facts_for_race(dataset: Dataset, race: Race) -> List[NotableFact]:
    """Data una gara, gli eventi del catalogo occorsi in quella gara,
    ordinati per notevolezza decrescente. Per ogni evento compare al più
    un fatto (vedi `_tieni_solo_il_piu_estremo`): niente doppioni quando la
    stessa occorrenza soddisfa più soglie della stessa famiglia."""
    rarita_min, rarita_max, siccita_min, siccita_max = _statistiche_catalogo_cached(dataset)

    fatti: List[NotableFact] = []
    for event in all_events():
        if not (event.anno_da <= race.year <= event.anno_a):
            continue
        for params in _combinazioni_parametri(event):
            osservazioni = occurrences(dataset, event, **params)
            if not any(o.race.race_id == race.race_id for o in osservazioni):
                continue

            risultato = evaluate(dataset, event, **params)
            if risultato.rarita is None:
                continue
            siccita = siccita_prima_di(dataset, event, race, **params)

            rarita_normalizzata = _normalizza(risultato.rarita, rarita_min, rarita_max)
            siccita_normalizzata = _normalizza(siccita.gare, siccita_min, siccita_max)

            notevolezza = (
                PESO_RARITA * (1 - rarita_normalizzata)
                + PESO_SICCITA * siccita_normalizzata
                + PESO_EDITORIALE * event.peso_editoriale
            )

            fatti.append(
                NotableFact(
                    event=event,
                    parametri=params,
                    rarita=risultato.rarita,
                    siccita_gare=siccita.gare,
                    peso_editoriale=event.peso_editoriale,
                    notevolezza=notevolezza,
                )
            )

    fatti = _tieni_solo_il_piu_estremo(fatti)
    fatti.sort(key=lambda f: f.notevolezza, reverse=True)
    return fatti
