"""
Verifica i conteggi di data-layer/app/events/catalog.py contro
docs/CATALOGO-EVENTI.md (milestone E2.1, docs/ROADMAP-3.md).

Il catalogo applica le trappole di PROGETTAZIONE.md sezione 5.6 (Indy 500
esclusa, tassonomia dei ritiri) mentre docs/CATALOGO-EVENTI.md riporta i
numeri grezzi calcolati senza filtri: i valori attesi qui sotto sono quindi
quelli **con le trappole applicate**, non le cifre stampate nel documento.
Ogni test cita, nel commento, il numero grezzo del documento e come si
arriva al numero atteso (di solito: si esclude l'Indy 500 e si riapplica la
tassonomia), cosi' la verifica resta leggibile senza dover riaprire lo
storico della chat che l'ha prodotta.
"""

import sys
from pathlib import Path

import pytest

DATA_LAYER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(DATA_LAYER_DIR))

from app.events import catalog  # noqa: E402,F401 (registra gli eventi)
from app.events.engine import evaluate  # noqa: E402
from app.events.loader import load_dataset  # noqa: E402
from app.events.registry import get_event  # noqa: E402


@pytest.fixture(scope="module")
def dataset():
    return load_dataset()


def _occorrenze(dataset, event_id, **params):
    return evaluate(dataset, get_event(event_id), **params).occorrenze


def _denominatore(dataset, event_id, **params):
    return evaluate(dataset, get_event(event_id), **params).denominatore


# ---------------------------------------------------------------------------
# griglia_e_risultato
# ---------------------------------------------------------------------------

def test_vittoria_da_griglia_n10(dataset):
    # CATALOGO-EVENTI.md §1: grezzo 40. Con Indy 500 esclusa (3 vittorie a
    # Indy con griglia >= 10): 40 - 3 = 37.
    assert _occorrenze(dataset, "vittoria_da_griglia", N=10) == 37
    assert _denominatore(dataset, "vittoria_da_griglia", N=10) == 1114


def test_vittoria_da_griglia_n20(dataset):
    # CATALOGO-EVENTI.md §1: 1, Long Beach 1983 — nessuna vittoria Indy 500
    # partiva da griglia >= 20, quindi invariato dalla trappola.
    assert _occorrenze(dataset, "vittoria_da_griglia", N=20) == 1


def test_podio_da_griglia_n15(dataset):
    # CATALOGO-EVENTI.md §1: 75 (grezzo, coincide includendo l'Indy 500).
    # Con la trappola 1 applicata: 69 (verificato includendo/escludendo le
    # gare Indy 500 nel motore).
    assert _occorrenze(dataset, "podio_da_griglia", N=15) == 69


# ---------------------------------------------------------------------------
# margine
# ---------------------------------------------------------------------------

def test_margine_vittoria_sotto_un_decimo(dataset):
    # CATALOGO-EVENTI.md §2: 5 volte, invariato dalla trappola (nessuna
    # gara Indy 500 ha un margine sotto 2 secondi in nessuna soglia).
    assert _occorrenze(dataset, "margine_vittoria", N=0.1) == 5


def test_margine_vittoria_sotto_due_secondi(dataset):
    # CATALOGO-EVENTI.md §2: 183 volte, invariato.
    assert _occorrenze(dataset, "margine_vittoria", N=2) == 183


# ---------------------------------------------------------------------------
# gare_anomale
# ---------------------------------------------------------------------------

def test_meno_di_6_classificati(dataset):
    # CATALOGO-EVENTI.md §3 riporta 8 (grezzo), ma il numero è un bug del
    # documento stesso: la riga "% ritiri record" nella stessa sezione
    # dichiara già Monaco 1996 con 3 classificati, che la riga "8 volte,
    # ultima 1984" ignora. Il numero adottato (17) è verificato a mano su
    # Monaco 1996 e Australia 2008 — vedi la nota in CATALOGO-EVENTI.md §3.
    assert _occorrenze(dataset, "meno_di_n_classificati", N=6) == 17


def test_nessun_ritiro(dataset):
    # CATALOGO-EVENTI.md §3: 14 (grezzo, conta Withdrew/DNQ come ritiro).
    # Con la tassonomia di §5.6 applicata (solo RITIRO_TECNICO/INCIDENTE
    # contano come ritiro): 16.
    assert _occorrenze(dataset, "nessun_ritiro") == 16


# ---------------------------------------------------------------------------
# team
# ---------------------------------------------------------------------------

def test_doppio_ritiro_stessa_causa(dataset):
    # CATALOGO-EVENTI.md §4: 772 (grezzo, non riproducibile: vedi la nota
    # nel documento). 665 è il numero adottato, coerente con la tassonomia
    # di §5.6 applicata senza eccezioni.
    assert _occorrenze(dataset, "doppio_ritiro_stessa_causa") == 665


def test_doppio_ritiro_qualunque_causa(dataset):
    # CATALOGO-EVENTI.md §4: 2964 grezzo -> 2311 con le trappole (spiegato
    # per intero: -626 tassonomia, -27 Indy 500 — vedi CATALOGO-EVENTI.md §4).
    assert _occorrenze(dataset, "doppio_ritiro") == 2311


def test_prima_vittoria_costruttore(dataset):
    # CATALOGO-EVENTI.md §4: 47 (grezzo, coincide includendo l'Indy 500).
    # Con la trappola 1: 43 (4 costruttori la cui unica "prima vittoria"
    # cadeva in una gara Indy 500).
    assert _occorrenze(dataset, "prima_vittoria_costruttore") == 43


# ---------------------------------------------------------------------------
# carriera
# ---------------------------------------------------------------------------

def test_prima_vittoria_in_carriera(dataset):
    # CATALOGO-EVENTI.md §5: 115 grezzo -> 105 con trappole (già verificato
    # e commitato in E1.2).
    assert _occorrenze(dataset, "prima_vittoria_in_carriera") == 105


def test_primo_podio_in_carriera(dataset):
    # CATALOGO-EVENTI.md §5: 216 (grezzo, coincide includendo l'Indy 500).
    # Con la trappola 1: 191.
    assert _occorrenze(dataset, "primo_podio_in_carriera") == 191


def test_vittoria_al_debutto(dataset):
    # CATALOGO-EVENTI.md §5: 3 (grezzo, coincide includendo l'Indy 500,
    # ultima 1961 Francia). Con la trappola 1: 2 (un debutto vincente era
    # all'Indy 500).
    assert _occorrenze(dataset, "vittoria_al_debutto") == 2


def test_prima_vittoria_pilota_su_circuito(dataset):
    # CATALOGO-EVENTI.md §5: 687 (grezzo, coincide includendo l'Indy 500).
    # Con la trappola 1: 677.
    assert _occorrenze(dataset, "prima_vittoria_pilota_su_circuito") == 677


# ---------------------------------------------------------------------------
# ritiri
# ---------------------------------------------------------------------------

def test_ritiro_per_causa_collisione(dataset):
    # CATALOGO-EVENTI.md §6: "Collisione 854" — coincide ESATTAMENTE anche
    # con la trappola 1 applicata: zero collisioni multi-vettura nelle 11
    # gare Indy 500 (gara ovale, non un circuito stradale).
    assert _occorrenze(dataset, "ritiro_per_causa_specifica", causa=4) == 854


def test_ritiro_per_causa_elettrico(dataset):
    # CATALOGO-EVENTI.md §6: "Elettrico 316" — coincide esattamente, stesso
    # motivo (zero guasti elettrici registrati alle gare Indy 500 nel
    # dataset).
    assert _occorrenze(dataset, "ritiro_per_causa_specifica", causa=10) == 316


def test_ritiro_per_causa_motore(dataset):
    # CATALOGO-EVENTI.md §6: "Motore 2026" grezzo -> 2001 con la trappola 1
    # (25 guasti motore nelle 11 gare Indy 500, dove i motori Offenhauser
    # rompevano spesso).
    assert _occorrenze(dataset, "ritiro_per_causa_specifica", causa=5) == 2001


def test_causa_non_vista_da_piu_di_10_anni(dataset):
    # CATALOGO-EVENTI.md §6 non da' un conteggio per questo evento (solo
    # esempi qualitativi), ma i 4 esempi citati sono verificati uno per uno
    # nel commento di _osservazioni_causa_non_vista_da_anni in catalog.py e
    # coincidono esattamente: Frizione ferma al 2014 Bahrain, Accensione al
    # 2002 Francia, Semiasse al 2001 Germania, Finito il carburante al 2019
    # Bahrain. Qui si fissa solo il conteggio come test di regressione.
    assert _occorrenze(dataset, "causa_non_vista_da_anni", N=10) == 45


# ---------------------------------------------------------------------------
# comando_in_pista
# ---------------------------------------------------------------------------

def test_nessun_cambio_di_leader(dataset):
    # CATALOGO-EVENTI.md §7: 99, invariato (nessuna gara Indy 500 rientra
    # nella finestra 1996-2024 di questo evento).
    assert _occorrenze(dataset, "nessun_cambio_di_leader") == 99
    assert _denominatore(dataset, "nessun_cambio_di_leader") == 544


def test_almeno_5_piloti_al_comando(dataset):
    # CATALOGO-EVENTI.md §7: "Gare con ≥5 piloti diversi al comando: 33" —
    # coincide esattamente (nessuna sovrapposizione con l'Indy 500, fuori
    # dalla finestra 1996+).
    assert _occorrenze(dataset, "almeno_n_piloti_al_comando", N=5) == 33


def test_rimonta_almeno_10_posizioni(dataset):
    # CATALOGO-EVENTI.md §7: "Le rimonte: >=10 posizioni 1750 volte"
    # (grezzo, coincide includendo l'Indy 500). Con la trappola 1: 1668
    # (l'Indy 500 e' storicamente ricca di rimonte enormi per l'alta
    # percentuale di ritiri, come mostra scripts/spike_events.py controllo 7).
    assert _occorrenze(dataset, "rimonta_almeno_n_posizioni", N=10) == 1668


def test_rimonta_almeno_20_posizioni(dataset):
    # CATALOGO-EVENTI.md §7: ">=20 posizioni solo 33 volte" (grezzo,
    # coincide includendo l'Indy 500, tra cui il record Indy 1957 di
    # +30 posizioni citato in PROGETTAZIONE.md §5.6). Con la trappola 1: 18.
    assert _occorrenze(dataset, "rimonta_almeno_n_posizioni", N=20) == 18


# ---------------------------------------------------------------------------
# strategia
# ---------------------------------------------------------------------------

def test_vincitore_con_almeno_3_soste(dataset):
    # CATALOGO-EVENTI.md §8: "il vincitore ha fatto ... 3 soste 45, 4 soste
    # 14, 5 soste 2, 6 soste 2" -> almeno 3 soste = 45+14+2+2 = 63.
    # Coincide esattamente: 2011-2024 e' fuori da qualunque finestra Indy 500.
    assert _occorrenze(dataset, "vincitore_con_almeno_n_soste", N=3) == 63


def test_pilota_con_almeno_7_soste(dataset):
    # CATALOGO-EVENTI.md §8: "7 soste 3 volte" -> coincide esattamente.
    assert _occorrenze(dataset, "pilota_con_almeno_n_soste", N=7) == 3


def test_pilota_con_almeno_5_soste(dataset):
    # CATALOGO-EVENTI.md §8: "5 soste 91, 6 soste 26, 7 soste 3" -> almeno
    # 5 soste = 91+26+3 = 120. Coincide esattamente.
    assert _occorrenze(dataset, "pilota_con_almeno_n_soste", N=5) == 120


# ---------------------------------------------------------------------------
# Copertura minima del catalogo (PROGETTAZIONE.md sezione 10, rischio 2)
# ---------------------------------------------------------------------------

def test_catalogo_ha_almeno_20_eventi_in_almeno_5_famiglie():
    from app.events.registry import all_events

    eventi = all_events()
    famiglie = {e.famiglia for e in eventi}
    assert len(eventi) >= 20
    assert len(famiglie) >= 5
