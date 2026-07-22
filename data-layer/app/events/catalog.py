"""
Sei eventi di famiglie diverse (docs/CATALOGO-EVENTI.md), scelti per provare
il modello dichiarativo di registry.py su unita' di osservazione diverse:

1. vittoria_da_griglia       — RISULTATO, N in {5, 10, 15, 20}
2. margine_vittoria          — RISULTATO (coppia 1°/2°), N in {0.1, 0.5, 1, 2}
3. meno_di_n_classificati    — GARA, N in {6, 8, 10}
4. doppio_ritiro_stessa_causa — TEAM_GARA
5. prima_vittoria_in_carriera — RISULTATO
6. nessun_cambio_di_leader   — GARA, finestra 1996-2024 (richiede lap_times)

Ogni evento e' una coppia (osservazioni, predicate): `osservazioni(dataset)`
sceglie e filtra le unita' valide della finestra (qui vivono le regole di
denominatore e le trappole di sezione 5.6), `predicate(payload, **params)`
e' il solo test booleano sul singolo payload.
"""

from __future__ import annotations

from typing import Dict, List

from .loader import Dataset, Result, StatusCategory, load_lap_leaders
from .registry import Observation, ParameterSpec, Unit, evento

_RITIRO_CATEGORIES = {StatusCategory.RITIRO_TECNICO, StatusCategory.RITIRO_INCIDENTE}


# ---------------------------------------------------------------------------
# 1. Vittoria partendo N o peggio
# ---------------------------------------------------------------------------

def _osservazioni_vittoria_da_griglia(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        winner = next((r for r in results if r.position == 1), None)
        if winner is None:
            continue
        obs.append(Observation(race=race, payload=winner))
    return obs


@evento(
    id="vittoria_da_griglia",
    nome="Vittoria partendo N° o peggio",
    famiglia="griglia_e_risultato",
    unita=Unit.RISULTATO,
    osservazioni=_osservazioni_vittoria_da_griglia,
    parametri=[ParameterSpec("N", [5, 10, 15, 20])],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.6,
    descrizione="Il vincitore era partito N-esimo o peggio in griglia.",
)
def vittoria_da_griglia(winner: Result, *, N: int) -> bool:
    if winner.started_from_pit_lane:
        # Partire dalla pit lane e' peggio di qualunque posizione in griglia.
        return True
    if winner.grid is None:
        return False
    return winner.grid >= N


# ---------------------------------------------------------------------------
# 2. Margine di vittoria sotto N secondi
# ---------------------------------------------------------------------------

def _osservazioni_margine_vittoria(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        p1 = next((r for r in results if r.position == 1), None)
        p2 = next((r for r in results if r.position == 2), None)
        if p1 is None or p2 is None:
            continue
        if p1.milliseconds is None or p2.milliseconds is None:
            # Trappola 3: tempo mancante esce dal denominatore, non conta
            # come "margine non stretto".
            continue
        if p1.laps != p2.laps:
            # Il margine si calcola solo quando 1° e 2° sono sullo stesso giro.
            continue
        obs.append(Observation(race=race, payload=(p1, p2)))
    return obs


@evento(
    id="margine_vittoria",
    nome="Margine di vittoria sotto N secondi",
    famiglia="margine",
    unita=Unit.RISULTATO,
    osservazioni=_osservazioni_margine_vittoria,
    parametri=[ParameterSpec("N", [0.1, 0.5, 1, 2])],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.7,
    descrizione="Il distacco tra 1° e 2° classificato e' sotto N secondi.",
)
def margine_vittoria(payload, *, N: float) -> bool:
    p1, p2 = payload
    margine_secondi = (p2.milliseconds - p1.milliseconds) / 1000.0
    return margine_secondi < N


# ---------------------------------------------------------------------------
# 3. Meno di N piloti classificati
# ---------------------------------------------------------------------------

def _osservazioni_meno_classificati(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        n_classificati = sum(
            1 for r in results if r.status_category == StatusCategory.CLASSIFICATO
        )
        obs.append(Observation(race=race, payload=n_classificati))
    return obs


@evento(
    id="meno_di_n_classificati",
    nome="Meno di N piloti classificati",
    famiglia="gare_anomale",
    unita=Unit.GARA,
    osservazioni=_osservazioni_meno_classificati,
    parametri=[ParameterSpec("N", [6, 8, 10])],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.5,
    descrizione="La gara ha avuto meno di N piloti classificati al traguardo.",
)
def meno_di_n_classificati(n_classificati: int, *, N: int) -> bool:
    return n_classificati < N


# ---------------------------------------------------------------------------
# 4. Doppio ritiro dello stesso team per la stessa causa
# ---------------------------------------------------------------------------

def _osservazioni_doppio_ritiro_stessa_causa(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        by_constructor: Dict[int, List[Result]] = {}
        for r in results:
            by_constructor.setdefault(r.constructor_id, []).append(r)
        for team_results in by_constructor.values():
            if len(team_results) < 2:
                # Serve almeno 2 auto in gara per poter parlare di "doppio".
                continue
            obs.append(Observation(race=race, payload=team_results))
    return obs


@evento(
    id="doppio_ritiro_stessa_causa",
    nome="Doppio ritiro dello stesso team per la stessa causa",
    famiglia="team",
    unita=Unit.TEAM_GARA,
    osservazioni=_osservazioni_doppio_ritiro_stessa_causa,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.4,
    descrizione="Entrambe le auto dello stesso team si sono ritirate per la stessa causa.",
)
def doppio_ritiro_stessa_causa(team_results: List[Result], **_: object) -> bool:
    conteggio_per_status: Dict[int, int] = {}
    for r in team_results:
        if r.status_category not in _RITIRO_CATEGORIES:
            continue
        conteggio_per_status[r.status_id] = conteggio_per_status.get(r.status_id, 0) + 1
    return any(n >= 2 for n in conteggio_per_status.values())


# ---------------------------------------------------------------------------
# 5. Prima vittoria in carriera
# ---------------------------------------------------------------------------

def _osservazioni_prima_vittoria_in_carriera(dataset: Dataset) -> List[Observation]:
    races_in_ordine = sorted(dataset.race_window(1950, 2024), key=lambda r: r.date)
    prima_vittoria_di: Dict[int, int] = {}
    obs = []
    for race in races_in_ordine:
        results = dataset.results_by_race.get(race.race_id, [])
        winner = next((r for r in results if r.position == 1), None)
        if winner is None:
            continue
        e_la_prima = winner.driver_id not in prima_vittoria_di
        if e_la_prima:
            prima_vittoria_di[winner.driver_id] = race.race_id
        obs.append(Observation(race=race, payload=e_la_prima))
    return obs


@evento(
    id="prima_vittoria_in_carriera",
    nome="Prima vittoria in carriera",
    famiglia="prime_volte",
    unita=Unit.RISULTATO,
    osservazioni=_osservazioni_prima_vittoria_in_carriera,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.8,
    descrizione="Il vincitore della gara vinceva per la prima volta in carriera.",
)
def prima_vittoria_in_carriera(e_la_prima: bool, **_: object) -> bool:
    return e_la_prima


# ---------------------------------------------------------------------------
# 6. Gara senza nessun cambio di leader (1996-2024, richiede lap_times)
# ---------------------------------------------------------------------------

_lap_leaders_cache = None


def _lap_leaders() -> Dict[int, List[tuple]]:
    global _lap_leaders_cache
    if _lap_leaders_cache is None:
        _lap_leaders_cache = load_lap_leaders()
    return _lap_leaders_cache


def _osservazioni_nessun_cambio_di_leader(dataset: Dataset) -> List[Observation]:
    leaders_by_race = _lap_leaders()
    obs = []
    for race in dataset.race_window(1996, 2024):
        leaders = leaders_by_race.get(race.race_id)
        if not leaders:
            # Trappola 3: senza lap_times la gara non e' calcolabile, esce
            # dal denominatore invece di essere contata come "cambio avvenuto".
            continue
        obs.append(Observation(race=race, payload=leaders))
    return obs


@evento(
    id="nessun_cambio_di_leader",
    nome="Gara senza nessun cambio di leader",
    famiglia="comando_in_pista",
    unita=Unit.GARA,
    osservazioni=_osservazioni_nessun_cambio_di_leader,
    parametri=[],
    anno_da=1996,
    anno_a=2024,
    peso_editoriale=0.6,
    descrizione="Chi era al comando al giro 1 lo e' rimasto fino alla bandiera a scacchi.",
)
def nessun_cambio_di_leader(leaders: List[tuple], **_: object) -> bool:
    driver_ids = {driver_id for _lap, driver_id in leaders}
    return len(driver_ids) == 1
