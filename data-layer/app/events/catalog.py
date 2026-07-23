"""
Il catalogo (docs/CATALOGO-EVENTI.md, docs/PROGETTAZIONE.md sezione 5.1):
33 eventi in 9 famiglie, ben oltre la soglia minima di 20 eventi in 5
famiglie di PROGETTAZIONE.md sezione 10 (rischio 2).

Ogni evento e' una coppia (osservazioni, predicate): `osservazioni(dataset)`
sceglie e filtra le unita' valide della finestra (qui vivono le regole di
denominatore e le trappole di sezione 5.6), `predicate(payload, **params)`
e' il solo test booleano sul singolo payload. Diverse funzioni
`osservazioni` sono condivise da più eventi quando l'universo delle unità
osservabili è lo stesso e cambia solo il predicato (es. i due "doppio
ritiro", i tre eventi di "comando in pista").

Famiglie:

- griglia_e_risultato: vittoria_da_griglia, podio_da_griglia,
  nessuno_dei_primi_3_in_griglia_sul_podio, pole_finita_con_ritiro
- margine: margine_vittoria, vittoria_oltre_n_minuti
- gare_anomale: meno_di_n_classificati, nessun_ritiro,
  percentuale_ritiri_sopra_n
- team: doppietta, tripletta, doppio_ritiro, doppio_ritiro_stessa_causa,
  prima_vittoria_costruttore
- carriera: prima_vittoria_in_carriera, primo_podio_in_carriera,
  prima_pole_in_carriera, vittoria_al_debutto, podio_al_debutto,
  prima_vittoria_pilota_su_circuito
- ritiri: ritiro_per_causa_specifica, causa_non_vista_da_anni
- comando_in_pista (1996+, richiede lap_times): nessun_cambio_di_leader,
  almeno_n_piloti_al_comando, vittoria_ultimo_giro,
  rimonta_almeno_n_posizioni (quest'ultimo NON richiede lap_times — vedi
  nota nella sua definizione: usa la finestra piena 1950-2024, non 1996+,
  perché grid/position sono disponibili su tutto il dataset)
- strategia (2011+, richiede pit_stops.csv): vincitore_con_almeno_n_soste,
  pilota_con_almeno_n_soste
- neutralizzazioni (2023-2024, eredità v2 — legge public/data/index.json e
  aggregate.json, non i CSV Ergast: vedi neutralizations.py):
  gara_con_almeno_n_neutralizzazioni, pit_sotto_neutralizzazione,
  pilota_locked_out, pit_double_stack, pilota_fregato
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from .loader import Dataset, Result, StatusCategory, load_lap_leaders, load_pit_stop_counts
from .registry import Observation, ParameterSpec, Unit, evento

_RITIRO_CATEGORIES = {StatusCategory.RITIRO_TECNICO, StatusCategory.RITIRO_INCIDENTE}

# Chi ha effettivamente preso il via (trappola 4, stessa nozione usata in
# loader.py per normalizzare grid == 0): serve a più famiglie qui sotto per
# non contare NON_QUALIFICATO/NON_PARTITO come se avessero corso.
_HA_PRESO_IL_VIA = {
    StatusCategory.CLASSIFICATO,
    StatusCategory.RITIRO_TECNICO,
    StatusCategory.RITIRO_INCIDENTE,
}


# ---------------------------------------------------------------------------
# Famiglia: griglia_e_risultato
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
    campi=["results.position", "results.grid", "results.statusId"],
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


def _osservazioni_podio_da_griglia(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        for r in results:
            if r.position in (1, 2, 3):
                obs.append(Observation(race=race, payload=r))
    return obs


@evento(
    id="podio_da_griglia",
    nome="Podio partendo N° o peggio",
    famiglia="griglia_e_risultato",
    unita=Unit.RISULTATO,
    campi=["results.position", "results.grid", "results.statusId"],
    osservazioni=_osservazioni_podio_da_griglia,
    parametri=[ParameterSpec("N", [10, 15, 20])],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.55,
    descrizione="Un pilota e' salito sul podio partendo N-esimo o peggio in griglia.",
)
def podio_da_griglia(result: Result, *, N: int) -> bool:
    if result.started_from_pit_lane:
        return True
    if result.grid is None:
        return False
    return result.grid >= N


def _osservazioni_podio_senza_top3_griglia(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        podio = [r for r in results if r.position in (1, 2, 3)]
        if len(podio) < 3:
            # Trappola 3: podio incompleto (gara abbreviata, pochi arrivati)
            # non e' calcolabile, esce dal denominatore.
            continue
        obs.append(Observation(race=race, payload=podio))
    return obs


@evento(
    id="nessuno_dei_primi_3_in_griglia_sul_podio",
    nome="Nessuno dei primi 3 in griglia sul podio",
    famiglia="griglia_e_risultato",
    unita=Unit.GARA,
    campi=["results.position", "results.grid", "results.statusId"],
    osservazioni=_osservazioni_podio_senza_top3_griglia,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.5,
    descrizione="Nessuno dei tre piloti partiti nelle prime tre posizioni e' salito sul podio.",
)
def nessuno_dei_primi_3_in_griglia_sul_podio(podio: List[Result], **_: object) -> bool:
    for r in podio:
        if r.started_from_pit_lane:
            continue
        if r.grid is not None and r.grid in (1, 2, 3):
            return False
    return True


def _osservazioni_pole_finita_con_ritiro(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        poleman = next((r for r in results if r.grid == 1), None)
        if poleman is None:
            continue
        obs.append(Observation(race=race, payload=poleman))
    return obs


@evento(
    id="pole_finita_con_ritiro",
    nome="Pole finita con un ritiro",
    famiglia="griglia_e_risultato",
    unita=Unit.RISULTATO,
    campi=["results.grid", "results.statusId"],
    osservazioni=_osservazioni_pole_finita_con_ritiro,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.5,
    descrizione="Chi era partito in pole si e' ritirato.",
)
def pole_finita_con_ritiro(poleman: Result, **_: object) -> bool:
    return poleman.status_category in _RITIRO_CATEGORIES


# ---------------------------------------------------------------------------
# Famiglia: margine
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
    campi=["results.position", "results.milliseconds", "results.laps"],
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


@evento(
    id="vittoria_oltre_n_minuti",
    nome="Vittoria con margine oltre N minuti",
    famiglia="margine",
    unita=Unit.RISULTATO,
    campi=["results.position", "results.milliseconds", "results.laps"],
    osservazioni=_osservazioni_margine_vittoria,
    parametri=[ParameterSpec("N", [1, 2, 5])],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.5,
    descrizione="Il distacco tra 1° e 2° classificato supera N minuti.",
)
def vittoria_oltre_n_minuti(payload, *, N: float) -> bool:
    p1, p2 = payload
    margine_minuti = (p2.milliseconds - p1.milliseconds) / 1000.0 / 60.0
    return margine_minuti > N


# ---------------------------------------------------------------------------
# Famiglia: gare_anomale
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
    campi=["results.statusId"],
    osservazioni=_osservazioni_meno_classificati,
    parametri=[ParameterSpec("N", [6, 8, 10])],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.5,
    descrizione="La gara ha avuto meno di N piloti classificati al traguardo.",
)
def meno_di_n_classificati(n_classificati: int, *, N: int) -> bool:
    return n_classificati < N


def _osservazioni_nessun_ritiro(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        n_ritiri = sum(1 for r in results if r.status_category in _RITIRO_CATEGORIES)
        obs.append(Observation(race=race, payload=n_ritiri))
    return obs


@evento(
    id="nessun_ritiro",
    nome="Gara senza nessun ritiro",
    famiglia="gare_anomale",
    unita=Unit.GARA,
    campi=["results.statusId"],
    osservazioni=_osservazioni_nessun_ritiro,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.6,
    descrizione="Tutti i piloti che hanno preso il via hanno tagliato il traguardo.",
)
def nessun_ritiro(n_ritiri: int, **_: object) -> bool:
    return n_ritiri == 0


def _osservazioni_percentuale_ritiri(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        presi_il_via = [r for r in results if r.status_category in _HA_PRESO_IL_VIA]
        if not presi_il_via:
            continue
        n_ritiri = sum(1 for r in presi_il_via if r.status_category in _RITIRO_CATEGORIES)
        percentuale = 100.0 * n_ritiri / len(presi_il_via)
        obs.append(Observation(race=race, payload=percentuale))
    return obs


@evento(
    id="percentuale_ritiri_sopra_n",
    nome="Percentuale di ritiri sopra N%",
    famiglia="gare_anomale",
    unita=Unit.GARA,
    campi=["results.statusId"],
    osservazioni=_osservazioni_percentuale_ritiri,
    parametri=[ParameterSpec("N", [50, 70, 85])],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.5,
    descrizione="Più di N% di chi ha preso il via si e' ritirato.",
)
def percentuale_ritiri_sopra_n(percentuale: float, *, N: float) -> bool:
    return percentuale > N


# ---------------------------------------------------------------------------
# Famiglia: team
# ---------------------------------------------------------------------------

def _osservazioni_doppietta(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        p1 = next((r for r in results if r.position == 1), None)
        p2 = next((r for r in results if r.position == 2), None)
        if p1 is None or p2 is None:
            continue
        obs.append(Observation(race=race, payload=(p1, p2)))
    return obs


@evento(
    id="doppietta",
    nome="Doppietta 1-2 dello stesso team",
    famiglia="team",
    unita=Unit.GARA,
    campi=["results.position", "results.constructorId"],
    osservazioni=_osservazioni_doppietta,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.5,
    descrizione="Le prime due posizioni sono dello stesso costruttore.",
)
def doppietta(payload, **_: object) -> bool:
    p1, p2 = payload
    return p1.constructor_id == p2.constructor_id


def _osservazioni_tripletta(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        podio = [next((r for r in results if r.position == p), None) for p in (1, 2, 3)]
        if any(r is None for r in podio):
            continue
        obs.append(Observation(race=race, payload=podio))
    return obs


@evento(
    id="tripletta",
    nome="Tripletta 1-2-3 dello stesso team",
    famiglia="team",
    unita=Unit.GARA,
    campi=["results.position", "results.constructorId"],
    osservazioni=_osservazioni_tripletta,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.9,
    descrizione="Le prime tre posizioni sono dello stesso costruttore.",
)
def tripletta(podio: List[Result], **_: object) -> bool:
    constructor_ids = {r.constructor_id for r in podio}
    return len(constructor_ids) == 1


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
    id="doppio_ritiro",
    nome="Doppio ritiro dello stesso team (qualunque causa)",
    famiglia="team",
    unita=Unit.TEAM_GARA,
    campi=["results.constructorId", "results.statusId"],
    osservazioni=_osservazioni_doppio_ritiro_stessa_causa,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    # Peso abbassato da 0.35 a 0.25 (QA vista 6, sezione 10 rischio 1): su un
    # campione di 5 gare a caso questo evento compariva in 4/5 delle
    # classifiche di notevolezza, quasi sempre alla stessa notevolezza — un
    # artefatto di essere valutato per team dentro una gara con 8-16 team:
    # anche una rarita' vera del 20% per team diventa "quasi sempre almeno
    # un team" a livello di gara. Da riverificare su un campione più ampio
    # dopo la modifica.
    peso_editoriale=0.25,
    descrizione="Entrambe le auto dello stesso team si sono ritirate, per qualunque causa.",
)
def doppio_ritiro(team_results: List[Result], **_: object) -> bool:
    n_ritiri = sum(1 for r in team_results if r.status_category in _RITIRO_CATEGORIES)
    return n_ritiri >= 2


@evento(
    id="doppio_ritiro_stessa_causa",
    nome="Doppio ritiro dello stesso team per la stessa causa",
    famiglia="team",
    unita=Unit.TEAM_GARA,
    campi=["results.constructorId", "results.statusId"],
    osservazioni=_osservazioni_doppio_ritiro_stessa_causa,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    # Peso abbassato da 0.4 a 0.3 (stesso motivo di doppio_ritiro sopra: QA
    # vista 6, compariva nella top-5 di TUTTE le 5 gare campionate).
    peso_editoriale=0.3,
    descrizione="Entrambe le auto dello stesso team si sono ritirate per la stessa causa.",
)
def doppio_ritiro_stessa_causa(team_results: List[Result], **_: object) -> bool:
    conteggio_per_status: Dict[int, int] = {}
    for r in team_results:
        if r.status_category not in _RITIRO_CATEGORIES:
            continue
        conteggio_per_status[r.status_id] = conteggio_per_status.get(r.status_id, 0) + 1
    return any(n >= 2 for n in conteggio_per_status.values())


def _osservazioni_prima_vittoria_costruttore(dataset: Dataset) -> List[Observation]:
    races_in_ordine = sorted(dataset.race_window(1950, 2024), key=lambda r: r.date)
    prima_vittoria_di: Dict[int, int] = {}
    obs = []
    for race in races_in_ordine:
        results = dataset.results_by_race.get(race.race_id, [])
        winner = next((r for r in results if r.position == 1), None)
        if winner is None:
            continue
        e_la_prima = winner.constructor_id not in prima_vittoria_di
        if e_la_prima:
            prima_vittoria_di[winner.constructor_id] = race.race_id
        # Payload = il vincitore quando è davvero la prima volta, altrimenti
        # None: il predicato sotto distingue i due casi, e per le occorrenze
        # vere _descrivi_payload (build_events.py) risolve driverId/
        # constructorId in nomi veri invece di scartarli (erano un bool puro).
        obs.append(Observation(race=race, payload=winner if e_la_prima else None))
    return obs


@evento(
    id="prima_vittoria_costruttore",
    nome="Prima vittoria assoluta di un costruttore",
    famiglia="team",
    unita=Unit.RISULTATO,
    campi=["results.position", "results.constructorId", "races.date"],
    osservazioni=_osservazioni_prima_vittoria_costruttore,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.75,
    descrizione="Il costruttore vincitore vinceva per la prima volta nella sua storia.",
)
def prima_vittoria_costruttore(payload: Optional[Result], **_: object) -> bool:
    return payload is not None


# ---------------------------------------------------------------------------
# Famiglia: carriera
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
        # Payload = il vincitore solo quando è davvero la prima volta (vedi
        # prima_vittoria_costruttore sopra per il perché: None invece di un
        # bool puro fa risolvere driverId/constructorId in nomi veri).
        obs.append(Observation(race=race, payload=winner if e_la_prima else None))
    return obs


@evento(
    id="prima_vittoria_in_carriera",
    nome="Prima vittoria in carriera",
    famiglia="carriera",
    unita=Unit.RISULTATO,
    campi=["results.position", "results.driverId", "races.date"],
    osservazioni=_osservazioni_prima_vittoria_in_carriera,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.8,
    descrizione="Il vincitore della gara vinceva per la prima volta in carriera.",
)
def prima_vittoria_in_carriera(payload: Optional[Result], **_: object) -> bool:
    return payload is not None


def _osservazioni_primo_podio_in_carriera(dataset: Dataset) -> List[Observation]:
    races_in_ordine = sorted(dataset.race_window(1950, 2024), key=lambda r: r.date)
    gia_a_podio: Dict[int, int] = {}
    obs = []
    for race in races_in_ordine:
        results = dataset.results_by_race.get(race.race_id, [])
        for r in results:
            if r.position not in (1, 2, 3):
                continue
            e_il_primo = r.driver_id not in gia_a_podio
            if e_il_primo:
                gia_a_podio[r.driver_id] = race.race_id
            # Payload = il risultato solo quando è davvero il primo podio
            # (vedi prima_vittoria_costruttore sopra per il perché).
            obs.append(Observation(race=race, payload=r if e_il_primo else None))
    return obs


@evento(
    id="primo_podio_in_carriera",
    nome="Primo podio in carriera",
    famiglia="carriera",
    unita=Unit.RISULTATO,
    campi=["results.position", "results.driverId", "races.date"],
    osservazioni=_osservazioni_primo_podio_in_carriera,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.6,
    descrizione="Il pilota saliva sul podio per la prima volta in carriera.",
)
def primo_podio_in_carriera(payload: Optional[Result], **_: object) -> bool:
    return payload is not None


def _osservazioni_prima_pole_in_carriera(dataset: Dataset) -> List[Observation]:
    races_in_ordine = sorted(dataset.race_window(1950, 2024), key=lambda r: r.date)
    gia_in_pole: Dict[int, int] = {}
    obs = []
    for race in races_in_ordine:
        results = dataset.results_by_race.get(race.race_id, [])
        poleman = next((r for r in results if r.grid == 1), None)
        if poleman is None:
            continue
        e_la_prima = poleman.driver_id not in gia_in_pole
        if e_la_prima:
            gia_in_pole[poleman.driver_id] = race.race_id
        # Payload = il poleman solo quando è davvero la prima volta (vedi
        # prima_vittoria_costruttore sopra per il perché).
        obs.append(Observation(race=race, payload=poleman if e_la_prima else None))
    return obs


@evento(
    id="prima_pole_in_carriera",
    nome="Prima pole in carriera",
    famiglia="carriera",
    unita=Unit.RISULTATO,
    campi=["results.grid", "results.driverId", "races.date"],
    osservazioni=_osservazioni_prima_pole_in_carriera,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.6,
    descrizione="Il pilota otteneva la pole position per la prima volta in carriera.",
)
def prima_pole_in_carriera(payload: Optional[Result], **_: object) -> bool:
    return payload is not None


def _debutto_per_pilota(dataset: Dataset) -> Dict[int, int]:
    """Il raceId della prima gara in cui ogni pilota ha preso il via
    (trappola 4: non conta chi non e' mai partito, non-qualificato o
    non-partito — vedi _HA_PRESO_IL_VIA)."""
    races_in_ordine = sorted(dataset.race_window(1950, 2024), key=lambda r: r.date)
    debutto: Dict[int, int] = {}
    for race in races_in_ordine:
        results = dataset.results_by_race.get(race.race_id, [])
        for r in results:
            if r.status_category not in _HA_PRESO_IL_VIA:
                continue
            if r.driver_id not in debutto:
                debutto[r.driver_id] = race.race_id
    return debutto


def _osservazioni_debutto(dataset: Dataset) -> List[Observation]:
    debutto = _debutto_per_pilota(dataset)
    debutto_race_ids = set(debutto.values())
    obs = []
    for race in dataset.race_window(1950, 2024):
        if race.race_id not in debutto_race_ids:
            continue
        results = dataset.results_by_race.get(race.race_id, [])
        for r in results:
            if debutto.get(r.driver_id) == race.race_id:
                obs.append(Observation(race=race, payload=r))
    return obs


@evento(
    id="vittoria_al_debutto",
    nome="Vittoria al debutto assoluto",
    famiglia="carriera",
    unita=Unit.RISULTATO,
    campi=["results.position", "results.driverId", "results.statusId", "races.date"],
    osservazioni=_osservazioni_debutto,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.95,
    descrizione="Il pilota ha vinto la sua primissima gara in F1.",
)
def vittoria_al_debutto(result: Result, **_: object) -> bool:
    return result.position == 1


@evento(
    id="podio_al_debutto",
    nome="Podio al debutto assoluto",
    famiglia="carriera",
    unita=Unit.RISULTATO,
    campi=["results.position", "results.driverId", "results.statusId", "races.date"],
    osservazioni=_osservazioni_debutto,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.85,
    descrizione="Il pilota e' salito sul podio alla sua primissima gara in F1.",
)
def podio_al_debutto(result: Result, **_: object) -> bool:
    return result.position in (1, 2, 3)


def _osservazioni_prima_vittoria_su_circuito(dataset: Dataset) -> List[Observation]:
    races_in_ordine = sorted(dataset.race_window(1950, 2024), key=lambda r: r.date)
    gia_vinto_su_circuito = set()
    obs = []
    for race in races_in_ordine:
        results = dataset.results_by_race.get(race.race_id, [])
        winner = next((r for r in results if r.position == 1), None)
        if winner is None:
            continue
        chiave = (winner.driver_id, race.circuit_id)
        e_la_prima = chiave not in gia_vinto_su_circuito
        if e_la_prima:
            gia_vinto_su_circuito.add(chiave)
        # Payload = il vincitore solo quando è davvero la prima volta su
        # questo circuito (vedi prima_vittoria_costruttore sopra).
        obs.append(Observation(race=race, payload=winner if e_la_prima else None))
    return obs


@evento(
    id="prima_vittoria_pilota_su_circuito",
    nome="Prima vittoria del pilota su quel circuito",
    famiglia="carriera",
    unita=Unit.RISULTATO,
    campi=["results.position", "results.driverId", "races.circuitId", "races.date"],
    osservazioni=_osservazioni_prima_vittoria_su_circuito,
    parametri=[],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.4,
    descrizione="Il vincitore vinceva per la prima volta su questo circuito.",
)
def prima_vittoria_pilota_su_circuito(payload: Optional[Result], **_: object) -> bool:
    return payload is not None


# ---------------------------------------------------------------------------
# Famiglia: ritiri
# ---------------------------------------------------------------------------

# Le 8 cause piu' frequenti di docs/CATALOGO-EVENTI.md sezione 6, usate come
# griglia di parametri (un statusId per ognuna): Motore, Incidente,
# Collisione, Cambio, Testacoda, Sospensione, Trasmissione, Elettrico.
_CAUSE_RITIRO_PARAMETRO = [5, 3, 4, 6, 20, 22, 7, 10]


def _osservazioni_ritiro_per_causa(dataset: Dataset) -> List[Observation]:
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        for r in results:
            if r.status_category not in _RITIRO_CATEGORIES:
                continue
            obs.append(Observation(race=race, payload=r))
    return obs


@evento(
    id="ritiro_per_causa_specifica",
    nome="Ritiro per una causa specifica",
    famiglia="ritiri",
    unita=Unit.RISULTATO,
    campi=["results.statusId"],
    osservazioni=_osservazioni_ritiro_per_causa,
    parametri=[ParameterSpec("causa", _CAUSE_RITIRO_PARAMETRO)],
    anno_da=1950,
    anno_a=2024,
    # Peso abbassato da 0.3 a 0.2 (stesso motivo di doppio_ritiro e rimonta
    # sopra: QA vista 6, compariva nella top-5 di 12 gare su 12 campionate —
    # il caso più forte tra i quattro. Valutato per pilota × causa dentro
    # una gara con ~20 piloti e ~8 cause possibili, quindi "qualche ritiro
    # per qualche causa" è quasi certo ogni gara anche se ogni singola causa
    # è vera-rara).
    peso_editoriale=0.2,
    descrizione="Il pilota si e' ritirato per una causa specifica (guasto o incidente), sul totale dei ritiri.",
)
def ritiro_per_causa_specifica(result: Result, *, causa: int) -> bool:
    return result.status_id == causa


def _osservazioni_causa_non_vista_da_anni(dataset: Dataset) -> List[Observation]:
    """Non e' un evento GARA/RISULTATO/TEAM_GARA in senso stretto: l'unita'
    osservabile e' "una causa di ritiro usata almeno una volta nella
    finestra" (docs/CATALOGO-EVENTI.md sezione 6, ~105 cause). Il payload
    e' quanti anni sono passati dall'ULTIMA gara in cui quella causa e'
    comparsa fino all'ultima gara della finestra; la gara associata
    all'osservazione (per `ultima_occorrenza`/`circuito_top` nel motore) e'
    quella dell'ultima comparsa, non una gara "in cui l'evento accade" in
    senso letterale."""
    finestra = dataset.race_window(1950, 2024)
    if not finestra:
        return []

    ultima_gara_per_causa: Dict[int, object] = {}
    for race in finestra:
        results = dataset.results_by_race.get(race.race_id, [])
        for r in results:
            if r.status_category not in _RITIRO_CATEGORIES:
                continue
            attuale = ultima_gara_per_causa.get(r.status_id)
            if attuale is None or race.date > attuale.date:
                ultima_gara_per_causa[r.status_id] = race

    ultima_gara_finestra = max(finestra, key=lambda r: r.date)
    obs = []
    for status_id, race_ultima in ultima_gara_per_causa.items():
        anni_fermo = ultima_gara_finestra.year - race_ultima.year
        obs.append(Observation(race=race_ultima, payload=anni_fermo))
    return obs


@evento(
    id="causa_non_vista_da_anni",
    nome="Causa di ritiro non vista da più di N anni",
    famiglia="ritiri",
    unita=Unit.RISULTATO,
    campi=["results.statusId", "races.date", "races.year"],
    osservazioni=_osservazioni_causa_non_vista_da_anni,
    parametri=[ParameterSpec("N", [10, 20, 30])],
    anno_da=1950,
    anno_a=2024,
    peso_editoriale=0.5,
    descrizione="Nessuno si ritira più per questa causa da oltre N anni.",
)
def causa_non_vista_da_anni(anni_fermo: int, *, N: int) -> bool:
    return anni_fermo > N


# ---------------------------------------------------------------------------
# Famiglia: comando_in_pista (1996-2024, richiede lap_times)
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
    campi=["lap_times.position", "lap_times.lap", "lap_times.driverId"],
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


@evento(
    id="almeno_n_piloti_al_comando",
    nome="Almeno N piloti diversi al comando",
    famiglia="comando_in_pista",
    unita=Unit.GARA,
    campi=["lap_times.position", "lap_times.lap", "lap_times.driverId"],
    osservazioni=_osservazioni_nessun_cambio_di_leader,
    parametri=[ParameterSpec("N", [3, 4, 5])],
    anno_da=1996,
    anno_a=2024,
    peso_editoriale=0.55,
    descrizione="Almeno N piloti diversi hanno comandato la gara in pista.",
)
def almeno_n_piloti_al_comando(leaders: List[tuple], *, N: int) -> bool:
    driver_ids = {driver_id for _lap, driver_id in leaders}
    return len(driver_ids) >= N


@evento(
    id="vittoria_ultimo_giro",
    nome="Vittoria conquistata all'ultimo giro",
    famiglia="comando_in_pista",
    unita=Unit.GARA,
    campi=["lap_times.position", "lap_times.lap", "lap_times.driverId"],
    osservazioni=_osservazioni_nessun_cambio_di_leader,
    parametri=[],
    anno_da=1996,
    anno_a=2024,
    peso_editoriale=0.85,
    descrizione="Il comando e' cambiato all'ultimo giro, decidendo la vittoria all'ultimo respiro.",
)
def vittoria_ultimo_giro(leaders: List[tuple], **_: object) -> bool:
    if len(leaders) < 2:
        return False
    penultimo_leader = leaders[-2][1]
    ultimo_leader = leaders[-1][1]
    return penultimo_leader != ultimo_leader


def _osservazioni_rimonta(dataset: Dataset) -> List[Observation]:
    """A differenza degli altri eventi di questa famiglia NON richiede
    lap_times (serve solo grid e position, disponibili su tutto il
    dataset): usa quindi la finestra piena 1950-2024 invece di 1996-2024,
    per non buttare 46 anni di dati calcolabili solo per uniformita' con
    gli altri eventi "comando_in_pista". E' lo stesso identico calcolo del
    controllo 7 di scripts/spike_events.py sulla rimonta piu' grande."""
    obs = []
    for race in dataset.race_window(1950, 2024):
        results = dataset.results_by_race.get(race.race_id, [])
        for r in results:
            if r.grid is None or r.position is None:
                continue
            obs.append(Observation(race=race, payload=r.grid - r.position))
    return obs


@evento(
    id="rimonta_almeno_n_posizioni",
    nome="Rimonta di almeno N posizioni",
    famiglia="comando_in_pista",
    unita=Unit.RISULTATO,
    campi=["results.grid", "results.position"],
    osservazioni=_osservazioni_rimonta,
    parametri=[ParameterSpec("N", [10, 15, 20])],
    anno_da=1950,
    anno_a=2024,
    # Peso abbassato da 0.5 a 0.4 (stesso motivo: QA vista 6, compariva in
    # 3/5 gare campionate a notevolezza quasi identica — valutato per ogni
    # pilota in griglia, ~20 per gara, compensa lo stesso effetto).
    peso_editoriale=0.4,
    descrizione="Il pilota ha guadagnato almeno N posizioni tra griglia e arrivo.",
)
def rimonta_almeno_n_posizioni(rimonta: int, *, N: int) -> bool:
    return rimonta >= N


# ---------------------------------------------------------------------------
# Famiglia: strategia (2011-2024, richiede pit_stops.csv)
# ---------------------------------------------------------------------------

_pit_stop_counts_cache = None


def _pit_stop_counts() -> Dict[Tuple[int, int], int]:
    global _pit_stop_counts_cache
    if _pit_stop_counts_cache is None:
        _pit_stop_counts_cache = load_pit_stop_counts()
    return _pit_stop_counts_cache


def _gare_con_pit_stops() -> set:
    """I raceId davvero coperti da pit_stops.csv (trappola 3: una gara
    assente non ha "zero soste", ha dati mancanti)."""
    return {race_id for race_id, _driver_id in _pit_stop_counts().keys()}


def _osservazioni_vincitore_soste(dataset: Dataset) -> List[Observation]:
    conteggio = _pit_stop_counts()
    gare_coperte = _gare_con_pit_stops()
    obs = []
    for race in dataset.race_window(2011, 2024):
        if race.race_id not in gare_coperte:
            continue
        results = dataset.results_by_race.get(race.race_id, [])
        winner = next((r for r in results if r.position == 1), None)
        if winner is None:
            continue
        n_soste = conteggio.get((race.race_id, winner.driver_id), 0)
        obs.append(Observation(race=race, payload=n_soste))
    return obs


@evento(
    id="vincitore_con_almeno_n_soste",
    nome="Il vincitore ha fatto almeno N soste",
    famiglia="strategia",
    unita=Unit.RISULTATO,
    campi=["results.position", "results.driverId", "pit_stops.stop"],
    osservazioni=_osservazioni_vincitore_soste,
    parametri=[ParameterSpec("N", [3, 4, 5])],
    anno_da=2011,
    anno_a=2024,
    peso_editoriale=0.5,
    descrizione="Chi ha vinto la gara ha fatto almeno N soste ai box.",
)
def vincitore_con_almeno_n_soste(n_soste: int, *, N: int) -> bool:
    return n_soste >= N


def _osservazioni_pilota_soste(dataset: Dataset) -> List[Observation]:
    conteggio = _pit_stop_counts()
    gare_coperte = _gare_con_pit_stops()
    obs = []
    for race in dataset.race_window(2011, 2024):
        if race.race_id not in gare_coperte:
            continue
        results = dataset.results_by_race.get(race.race_id, [])
        for r in results:
            if r.status_category not in _HA_PRESO_IL_VIA:
                continue
            n_soste = conteggio.get((race.race_id, r.driver_id), 0)
            obs.append(Observation(race=race, payload=n_soste))
    return obs


@evento(
    id="pilota_con_almeno_n_soste",
    nome="Un pilota ha fatto almeno N soste",
    famiglia="strategia",
    unita=Unit.RISULTATO,
    campi=["results.driverId", "results.statusId", "pit_stops.stop"],
    osservazioni=_osservazioni_pilota_soste,
    parametri=[ParameterSpec("N", [4, 5, 7])],
    anno_da=2011,
    anno_a=2024,
    peso_editoriale=0.35,
    descrizione="Un pilota ha fatto almeno N soste ai box in questa gara.",
)
def pilota_con_almeno_n_soste(n_soste: int, *, N: int) -> bool:
    return n_soste >= N


# ---------------------------------------------------------------------------
# Famiglia: neutralizzazioni (2023-2024, eredità v2 — vedi neutralizations.py)
# ---------------------------------------------------------------------------

from . import neutralizations  # noqa: E402,F401 (registra la famiglia neutralizzazioni)
