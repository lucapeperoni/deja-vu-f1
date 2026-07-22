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

Correzioni trovate facendo girare `scripts/spike_facts.py` (E1.2) e
`scripts/build_events.py` (E2.2) su gare vere:

1. **Deduplica delle famiglie di soglie monotone.** Un evento come
   "vittoria partendo N° o peggio" (N ∈ {5,10,15,20}) è monotono: una
   rimonta dalla 17ª posizione soddisfa contemporaneamente N=5, N=10 e
   N=15, e senza deduplica il generatore riportava la STESSA vittoria tre
   volte come tre fatti distinti. Non serve sapere in che direzione un
   parametro è monotono: tra combinazioni dello stesso evento che occorrono
   insieme, quella con la rarità più bassa è per definizione la più
   stringente, quindi tenere solo quella basta.
2. **Le statistiche del catalogo si ricalcolavano ad ogni gara.** Risolto
   in E1.2 con una cache per istanza di `Dataset`.
3. **`facts_for_race` su tutte le 1125 gare era troppo lento per
   `build_events.py`** (stimato ~7 minuti): ogni chiamata rifaceva da zero,
   PER OGNI evento e PER OGNI valore di parametro, la scansione di tutte le
   occorrenze per controllare "è successa qui?" e poi da capo per calcolare
   la siccità. La soluzione è uno **snapshot** per dataset (`_snapshot`):
   occorrenze di ogni (evento, parametri) ordinate una volta sola per data,
   con un indice raceId -> posizione sia nella finestra sia tra le
   occorrenze, cosi' sia "è successo in questa gara?" sia "quanto tempo
   era passato prima?" diventano lookup O(1)/O(log n) invece di scansioni
   O(n) ripetute 1125 volte.
"""

from __future__ import annotations

from bisect import bisect_left
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from .engine import evaluate, occurrences
from .loader import Dataset, Race
from .registry import EventDefinition, Observation, all_events, parameter_combinations

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


# ---------------------------------------------------------------------------
# Snapshot: tutto cio' che serve per rispondere velocemente, per qualunque
# gara, a "questo evento+parametri e' occorso qui?" e "da quanto tempo non
# accadeva prima di questa gara?".
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class _FinestraIndicizzata:
    date_ordinate: List
    indice_per_race_id: Dict[int, int]


@dataclass(frozen=True)
class _EventSnapshot:
    event: EventDefinition
    params: Dict[str, Any]
    rarita: float
    occorrenze_ordinate: List[Observation]
    indice_per_race_id: Dict[int, int]


def _finestra_indicizzata(dataset: Dataset, anno_da: int, anno_a: int) -> _FinestraIndicizzata:
    finestra_ordinata = sorted(dataset.race_window(anno_da, anno_a), key=lambda r: r.date)
    return _FinestraIndicizzata(
        date_ordinate=[r.date for r in finestra_ordinata],
        indice_per_race_id={r.race_id: i for i, r in enumerate(finestra_ordinata)},
    )


def _costruisci_snapshot(dataset: Dataset) -> Tuple[List[_EventSnapshot], Dict[Tuple[int, int], _FinestraIndicizzata]]:
    finestre: Dict[Tuple[int, int], _FinestraIndicizzata] = {}
    snapshot: List[_EventSnapshot] = []

    for event in all_events():
        chiave_finestra = (event.anno_da, event.anno_a)
        if chiave_finestra not in finestre:
            finestre[chiave_finestra] = _finestra_indicizzata(dataset, event.anno_da, event.anno_a)

        for params in parameter_combinations(event):
            risultato = evaluate(dataset, event, **params)
            if risultato.rarita is None:
                continue
            occorse_ordinate = sorted(occurrences(dataset, event, **params), key=lambda o: o.race.date)
            indice = {o.race.race_id: i for i, o in enumerate(occorse_ordinate)}
            snapshot.append(
                _EventSnapshot(
                    event=event,
                    params=params,
                    rarita=risultato.rarita,
                    occorrenze_ordinate=occorse_ordinate,
                    indice_per_race_id=indice,
                )
            )

    return snapshot, finestre


_cache_snapshot: Dict[int, Tuple[List[_EventSnapshot], Dict[Tuple[int, int], _FinestraIndicizzata]]] = {}


def _snapshot_cached(dataset: Dataset):
    chiave = id(dataset)
    if chiave not in _cache_snapshot:
        _cache_snapshot[chiave] = _costruisci_snapshot(dataset)
    return _cache_snapshot[chiave]


def _siccita_gare_prima_di(
    finestra: _FinestraIndicizzata, occorse_ordinate: List[Observation], race: Race
) -> int:
    """Gare trascorse dall'occorrenza precedente a `race` fino a `race`
    esclusa (stessa definizione di `metrics.siccita_prima_di`, qui O(1)
    invece di una scansione perche' finestra e occorrenze sono gia'
    ordinate e indicizzate per raceId)."""
    idx_race = finestra.indice_per_race_id[race.race_id]
    idx_occorrenza = bisect_left([o.race.date for o in occorse_ordinate], race.date)

    if idx_occorrenza == 0:
        return idx_race

    precedente = occorse_ordinate[idx_occorrenza - 1].race
    idx_precedente = finestra.indice_per_race_id[precedente.race_id]
    return idx_race - idx_precedente - 1


def _statistiche_catalogo(snapshot: List[_EventSnapshot], finestre: Dict[Tuple[int, int], _FinestraIndicizzata]) -> Tuple[float, float, int, int]:
    rarita_values = [s.rarita for s in snapshot]
    siccita_values: List[int] = []
    for s in snapshot:
        finestra = finestre[(s.event.anno_da, s.event.anno_a)]
        for o in s.occorrenze_ordinate:
            siccita_values.append(_siccita_gare_prima_di(finestra, s.occorrenze_ordinate, o.race))

    rarita_min = min(rarita_values) if rarita_values else 0.0
    rarita_max = max(rarita_values) if rarita_values else 1.0
    siccita_min = min(siccita_values) if siccita_values else 0
    siccita_max = max(siccita_values) if siccita_values else 0
    return rarita_min, rarita_max, siccita_min, siccita_max


_cache_statistiche: Dict[int, Tuple[float, float, int, int]] = {}


def _statistiche_catalogo_cached(dataset: Dataset) -> Tuple[float, float, int, int]:
    chiave = id(dataset)
    if chiave not in _cache_statistiche:
        snapshot, finestre = _snapshot_cached(dataset)
        _cache_statistiche[chiave] = _statistiche_catalogo(snapshot, finestre)
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
    snapshot, finestre = _snapshot_cached(dataset)
    rarita_min, rarita_max, siccita_min, siccita_max = _statistiche_catalogo_cached(dataset)

    fatti: List[NotableFact] = []
    for s in snapshot:
        if race.race_id not in s.indice_per_race_id:
            continue

        finestra = finestre[(s.event.anno_da, s.event.anno_a)]
        siccita_gare = _siccita_gare_prima_di(finestra, s.occorrenze_ordinate, race)

        rarita_normalizzata = _normalizza(s.rarita, rarita_min, rarita_max)
        siccita_normalizzata = _normalizza(siccita_gare, siccita_min, siccita_max)

        notevolezza = (
            PESO_RARITA * (1 - rarita_normalizzata)
            + PESO_SICCITA * siccita_normalizzata
            + PESO_EDITORIALE * s.event.peso_editoriale
        )

        fatti.append(
            NotableFact(
                event=s.event,
                parametri=s.params,
                rarita=s.rarita,
                siccita_gare=siccita_gare,
                peso_editoriale=s.event.peso_editoriale,
                notevolezza=notevolezza,
            )
        )

    fatti = _tieni_solo_il_piu_estremo(fatti)
    fatti.sort(key=lambda f: f.notevolezza, reverse=True)
    return fatti
