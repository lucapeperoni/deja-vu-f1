# Numeri chiave — Chaos Discount

Generato automaticamente da `data-layer/scripts/report_numbers.py` a partire
dai JSON in `public/data/` (l'output della pipeline, task 2.1) e da
`data/raw/drivers.csv` (solo per i nomi dei piloti). Ogni numero indica il
file sorgente e la regola con cui e' stato calcolato, cosi' e' verificabile
e difendibile all'esame. Definizioni complete in `docs/PROGETTAZIONE.md`
sezione 5.

## 1. Dimensione del campione

- **46 gare** — stagioni 2023 e 2024 complete.
  Fonte: `public/data/index.json`, numero di elementi dell'elenco.
- **42 neutralizzazioni** (Safety Car o Virtual Safety Car) catturate nelle 46 gare.
  Fonte: `public/data/index.json`, somma del campo `totalNeutralizations`;
  incrociato contando le finestre in `public/data/races/*.json` (`neutralizations`),
  stesso numero (42).
- **1737 pit stop** totali nel campione, di cui **812 esiti** pilota-per-evento (un pilota puo' non avere un esito registrato se non era in gara in quel momento).
  Fonte: `public/data/aggregate.json`, lunghezza degli array `pitStops` e `outcomes`.

## 2. Il prezzo di listino

- **Prezzo di listino mediano: 22.4s** (mediana su 46 gare).
  Fonte: `public/data/races/*.json`, campo `race.nominalPitLoss` — per ogni gara e' gia' la mediana dei costi effettivi dei pit in bandiera verde (regola §5.2 della specifica, calcolata in `data-layer/app/metrics/effective_pit_loss.py`); qui si prende la mediana di quel valore sulle 46 gare del campione.
  Controllo incrociato: la mediana "aggregata" di tutti i 1285 pit in verde del campione (senza passare per gara) e' 22.5s — coerente.
  Fonte: `public/data/aggregate.json`, `pitStops[].effectiveLoss` con `context == "GREEN"`.
- Nota di cautela: **1 gara** ha meno di 4 pit in verde (soglia `minGreenStopsForConfidence`), quindi il loro prezzo di listino e' marcato a bassa confidenza (`lowConfidence`); il fallback sulla mediana di pista descritto in §5.2 della specifica non e' stato implementato nella pipeline attuale — se richiesto all'esame, va dichiarato come limite noto.
  Fonte: `public/data/races/*.json`, campo `pits[].lowConfidence` sui pit `GREEN`.

## 3. Lo sconto sotto neutralizzazione

- **Sconto mediano sotto Safety Car: +9.0s** (n=142 pit).
- **Sconto mediano sotto Virtual Safety Car: -0.4s** (n=81 pit).
- Per confronto, sconto mediano di un pit in bandiera verde (deve essere vicino a zero, per definizione): +0.0s (n=1285).
  Fonte: `public/data/aggregate.json`, campo `pitStops[].discount` filtrato per `context`; lo sconto e' gia' calcolato dalla pipeline come "prezzo di listino della gara − costo effettivo del pit" (regola §5.3).

- Controllo incrociato in costo effettivo assoluto (non relativo al listino di ogni singola gara): mediana verde 22.5s, mediana sotto SC 15.5s, mediana sotto VSC 23.1s.
  Fonte: `public/data/aggregate.json`, campo `pitStops[].effectiveLoss`. Questi tre numeri sono quelli gia' citati e validati in `docs/PROGETTAZIONE.md` §5.1bis dopo la correzione del riferimento di gruppo mancante: la SC piena mostra uno sconto netto, la VSC resta vicina al verde (limite di granularita' dichiarato in `/methodology`).

## 4. I "fregati" (JUST_BEFORE)

- **39 pit stop** classificati JUST_BEFORE: fermata in bandiera verde nei 3 giri prima dell'inizio di una neutralizzazione (soglia `justBeforeMaxLaps`, regola §5.4).
  Fonte: `public/data/aggregate.json`, `pitStops[]` con `context == "JUST_BEFORE"`.
- **Mediana della perdita: -17.4s** rispetto al prezzo di listino della propria gara (n=39) — un valore negativo significa che in mediana questi piloti hanno pagato PIU' del prezzo pieno, non solo "niente sconto": il traffico/l'incidente che ha causato la neutralizzazione spesso li aveva gia' rallentati mentre erano ai box.
  Fonte: `public/data/aggregate.json`, campo `pitStops[].discount` sugli stessi pit stop (stessa regola §5.3 usata per tutti i contesti).

## 5. Distribuzione degli esiti della lotteria

Su 812 esiti pilota-per-evento (regola §5.5, soglie dichiarate in `public/data/params.json` e in `/methodology`):

| Esito | Significato | Conteggio | % |
|---|---|---:|---:|
| EXPLOITED | ha sfruttato la finestra | 301 | 37.1% |
| LOCKED_OUT | escluso (gomme fresche o traffico) | 296 | 36.5% |
| FULL_PRICE | fregato (fermo appena prima) | 39 | 4.8% |
| NOT_NEEDED | non aveva bisogno di fermarsi | 142 | 17.5% |
| NEUTRAL | nessuna delle precedenti | 34 | 4.2% |

Fonte: `public/data/aggregate.json`, campo `outcomes[].category`, conteggio e percentuale sul totale di 812 righe.

## 6. I casi estremi

- **Lo sconto piu' estremo del campione: Sergio Pérez (PER), 2023-albert_park (2023), giro 2, contesto UNDER_SC: +58.7s di sconto** (costo effettivo -13.7s, sotto zero: e' letteralmente "guadagnato" fermandosi).
  Fonte: `public/data/aggregate.json`, massimo di `pitStops[].discount` tra i pit non marcati `lowConfidence` (esclusi perche' §5.1bis/10.8 li segnala come residuo di riferimento di gruppo inaffidabile, non storia genuina).

- **Il caso piu' sfortunato: Guanyu Zhou (ZHO), 2024-jeddah (2024), evento 9480-sc-1, esito LOCKED_OUT: +8 posizioni** (un valore positivo di `posDelta` e' un peggioramento della posizione).
  Fonte: `public/data/aggregate.json`, massimo di `outcomes[].posDelta` tra gli esiti con delta noto (regola §5.5: il delta si misura tra il momento dell'evento e 3 giri dopo).

## 7. Le 3 gare-caso

Selezionate in `data-layer/scripts/select_case_races.py` (task 2.2, criteri
in `docs/PROGETTAZIONE.md` sezione 9) e raccontate in `public/data/stories.json`
(task 5.1). I numeri sotto sono ricalcolati direttamente dai file di gara per
verificare che coincidano con le storie.

### Bahrain Grand Prix 2023 (`2023-bahrain`)

_Bahrain 2023: un momento solo, sei scelte di fermarsi_

- **1 sola neutralizzazione** in tutta la gara (VSC, giri 41-42) — la lotteria si gioca in un solo momento. Fonte: `neutralizations` nel file di gara.
- **6 pit stop** nella finestra, contro un prezzo di listino di 23.6s. Fonte: `drivers[].pits[]` filtrati per `eventId == "7953-vsc-1"`.
- Il miglior colpo: **GAS** paga 18.1s (+5.5s di sconto). Fonte: stesso array, campo `discount`.
- Lettura decisionale: **6 BOX**, **0 STAY**, **2 FORZATE** (8 decisioni reali, NOT_NEEDED escluse); tra chi ha scelto BOX, **3/6** ha guadagnato posizioni a 5 giri.
  Fonte: `public/data/races/2023-bahrain.json`, campo `decisions[]` (choice, outcome.verdict).
- Errore mediano del rientro previsto in questa gara: **0.0 posizioni** (n=6 pit BOX confrontabili).
  Fonte: `decisions[].boxOption.predictedRejoinPos` confrontato con `drivers[].pits[].posAfter` dello stesso evento (stessa regola dello spike P1.1, v. `rejoin_errors_for_race` in questo script).

### Saudi Arabian Grand Prix 2024 (`2024-jeddah`)

_Una Safety Car, uno split netto: chi può e chi no_

- **Safety Car ai giri 7-9**, prezzo di listino 20.9s. Fonte: `neutralizations` e `race.nominalPitLoss`.
- Split netto: **14 EXPLOITED contro 6 LOCKED_OUT** su 20 esiti registrati per l'evento. Fonte: `drivers[].outcomes[]` filtrati per `eventId`, conteggio per `category`.
- Il miglior colpo: **OCO** paga 8.1s (+12.8s di sconto) su 14 pit nella finestra.
- Lettura decisionale: **14 BOX**, **0 STAY**, **4 FORZATE** (18 decisioni reali, NOT_NEEDED escluse); tra chi ha scelto BOX, **1/14** ha guadagnato posizioni a 5 giri.
  Fonte: `public/data/races/2024-jeddah.json`, campo `decisions[]` (choice, outcome.verdict).
- Errore mediano del rientro previsto in questa gara: **1.0 posizioni** (n=14 pit BOX confrontabili).
  Fonte: `decisions[].boxOption.predictedRejoinPos` confrontato con `drivers[].pits[].posAfter` dello stesso evento (stessa regola dello spike P1.1, v. `rejoin_errors_for_race` in questo script).

### Australian Grand Prix 2023 (`2023-albert_park`)

_Australia 2023: tre finestre, la decisione doppia del double stack_

- **3 neutralizzazioni** nella stessa gara con esiti opposti: sul primo SC (giri 1-3) 5 EXPLOITED contro 14 LOCKED_OUT; sul secondo SC (giri 7-18) si ribalta: 18 EXPLOITED contro 1 LOCKED_OUT.
  Fonte: `drivers[].outcomes[]` filtrati per ciascun `eventId`.
- **42 pit stop in double stack**, distribuiti su **8 team diversi** — non concentrati su una sola squadra.
  Fonte: `drivers[].pits[]`, campo `doubleStack`, raggruppati per `team`.
- Lettura decisionale: **23 BOX**, **3 STAY**, **27 FORZATE** (53 decisioni reali, NOT_NEEDED escluse); tra chi ha scelto BOX, **12/23** ha guadagnato posizioni a 5 giri.
  Fonte: `public/data/races/2023-albert_park.json`, campo `decisions[]` (choice, outcome.verdict).
- Errore mediano del rientro previsto in questa gara: **0.0 posizioni** (n=23 pit BOX confrontabili).
  Fonte: `decisions[].boxOption.predictedRejoinPos` confrontato con `drivers[].pits[].posAfter` dello stesso evento (stessa regola dello spike P1.1, v. `rejoin_errors_for_race` in questo script).

## 8. v2 — la decisione

Numeri del layer del pivot (`decision_snapshots.py`, §5.6): uno snapshot per pilota × neutralizzazione, con le due opzioni quantificate, la scelta e il verdetto a 5 giri. Fonte per tutta la sezione: `public/data/races/*.json`, campo `decisions[]` di ogni gara (non `aggregate.json`, che ne tiene solo un sottoinsieme di campi per la mappa).

Attenzione al segno: qui `posDelta5` positivo significa **guadagno** di posizioni (regola `classify_verdict` in `decision_snapshots.py`) — l'opposto della convenzione di `outcomes[].posDelta` usata nella sezione 6, dove positivo è un peggioramento. Sono due campi diversi con regole di segno diverse, non un'incoerenza tra le sezioni.

- **767 decisioni** pilota×evento nel campione, di cui **121 NOT_NEEDED** (non gli serviva fermarsi: escluse dalla mappa e da questa sezione) e **290 FORZATE** (LOCKED_OUT: non poteva scegliere) — restano **646 decisioni reali** (scelta libera tra BOX e STAY).
  Fonte: `decisions[].notNeeded` e `decisions[].choice`, conteggio su tutte le 46 gare.

- **Soglia di margine usata sotto**: la mediana dell'indice combinato sulle decisioni reali, **-0.2** (per costruzione, media 0 sulla popolazione usata per gli z-score in `fill_combined_index`; la mediana calcolata qui puo' scostarsi leggermente per asimmetria del campione).
  Fonte: mediana di `decisions[].combinedIndex` non nulli, esclusi i NOT_NEEDED.

- **BOX ha guadagnato posizioni nel 28.9% dei casi** (88/304) sull'intero campione; **29.4%** (72/245) quando l'indice combinato e' sopra la soglia di margine, **16.2%** (6/37) quando e' sotto — lo scarto tra le due condizioni e' la prova numerica della tendenza dichiarata in `/methodology` (correlazione indice/esito 0,34-0,36, non un confine netto).
  Fonte: `decisions[]` con `choice == "BOX"`, `outcome.verdict == "GAINED"`, filtrati per `combinedIndex` sopra/sotto la mediana qui sopra.

- **STAY ha guadagnato posizioni nel 25.0% dei casi** (13/52); **42.1%** (8/19) sopra la soglia di margine, **14.3%** (4/28) sotto. L'indice combinato e' costruito e verificato sulla scelta BOX (v. `/methodology`): questa riga e' un controllo di coerenza, non la sua base di validazione.
  Fonte: `decisions[]` con `choice == "STAY"`, stessa regola della riga precedente.

- **Errore mediano del rientro previsto: 1.0 posizioni** (n=303 pit BOX confrontabili su tutte le 46 gare, non solo le 3 gare-caso dello spike P1.1).
  Fonte: `decisions[].boxOption.predictedRejoinPos` confrontato con `drivers[].pits[].posAfter` dello stesso pilota/evento (contesto UNDER_SC/UNDER_VSC); vedi `rejoin_errors_for_race` in questo script.

- **La scelta più clamorosamente sbagliata**: Kevin Magnussen (MAG), Austrian Grand Prix 2023 (`2023-red_bull_ring`), evento 9118-sc-1 — indice combinato 0.8 (sopra la soglia di margine: condizioni statisticamente favorevoli a BOX), eppure -12 posizioni a 5 giri (verdetto LOST). La prova più netta che l'indice è una tendenza, non una garanzia sul singolo caso.
  Fonte: `decisions[]` con `choice == "BOX"` e `combinedIndex` sopra la soglia di margine, minimo di `outcome.posDelta5`.

- **La scelta più perfetta nonostante i numeri contrari**: Oscar Piastri (PIA), Japanese Grand Prix 2023 (`2023-suzuka`), evento 9173-vsc-2 — indice combinato -0.6 (sotto la soglia di margine: condizioni statisticamente sfavorevoli a BOX), eppure +3 posizioni a 5 giri (verdetto GAINED).
  Fonte: `decisions[]` con `choice == "BOX"` e `combinedIndex` sotto la soglia di margine, massimo di `outcome.posDelta5`.

## 9. v3 — il motore di eventi

Numeri del catalogo dichiarativo (`data-layer/app/events/`, `docs/PROGETTAZIONE.md` sezione 5 e 6), generati dalla pipeline `build_events.py` e letti qui direttamente dai JSON esportati in `public/data/events/`, `public/data/facts/` e `public/data/races-index.json` — nessuno di questi numeri e' lo stesso della sezione 1-8 qui sopra (quelle sono il layer v2 delle neutralizzazioni, 46 gare 2023-2024).

### 9.1 Il catalogo, per famiglia (33 eventi distinti, 67 combinazioni evento+parametri)

| Famiglia | Eventi distinti |
|---|---:|
| Prime volte e carriere | 6 |
| Team | 5 |
| Neutralizzazioni (SC/VSC) | 5 |
| Griglia e risultato | 4 |
| Comando in pista | 4 |
| Gare anomale | 3 |
| Margine di vittoria | 2 |
| Cause di ritiro | 2 |
| Strategia (soste) | 2 |

Fonte: `public/data/events/index.json`, conteggio di `eventId` distinti per `famiglia`.

### 9.2 Copertura del dataset

- **1125 gare**, **26759 risultati**, **75 stagioni** (1950-2024).
  Fonte: `public/data/races-index.json` (numero di elementi, anni distinti) e `public/data/params.json` (`eventi.trappole.campiVuoti.numeroRisultati`, calcolato in `build_events.py` sul dataset completo).

### 9.3 I 10 eventi più rari

| Evento | Parametri | Occorrenze | Rarità | Finestra |
|---|---|---:|---:|---|
| Un pilota ha fatto almeno N soste | N=7 | 3/5940 | 0.051% | 2011-2024 |
| Vittoria partendo N° o peggio | N=20 | 1/1114 | 0.090% | 1950-2024 |
| Percentuale di ritiri sopra N% | N=85 | 1/1114 | 0.090% | 1950-2024 |
| Vittoria con margine oltre N minuti | N=5 | 1/1088 | 0.092% | 1950-2024 |
| Rimonta di almeno N posizioni | N=20 | 18/15518 | 0.116% | 1950-2024 |
| Vittoria al debutto assoluto | — | 2/688 | 0.291% | 1950-2024 |
| Margine di vittoria sotto N secondi | N=0.1 | 5/1088 | 0.460% | 1950-2024 |
| Podio partendo N° o peggio | N=20 | 20/3360 | 0.595% | 1950-2024 |
| Vittoria partendo N° o peggio | N=15 | 8/1114 | 0.718% | 1950-2024 |
| Vittoria con margine oltre N minuti | N=2 | 9/1088 | 0.827% | 1950-2024 |

Fonte: `public/data/events/index.json`, le 10 voci con `rarita` più bassa (occorrenze/denominatore).

### 9.4 Le 5 siccità più lunghe

| Evento | Parametri | Ultima occorrenza | Siccità |
|---|---|---|---|
| Vittoria con margine oltre N minuti | N=5 | 1958 Circuito da Boavista | 66 anni (1050 gare) |
| Tripletta 1-2-3 dello stesso team | — | 1961 Aintree | 63 anni (1026 gare) |
| Vittoria al debutto assoluto | — | 1961 Reims-Gueux | 63 anni (1027 gare) |
| Vittoria con margine oltre N minuti | N=2 | 1968 Nürburgring | 56 anni (956 gare) |
| Vittoria partendo N° o peggio | N=20 | 1983 Long Beach | 41 anni (750 gare) |

Fonte: `public/data/events/index.json`, le 5 voci con `siccitaAnniCorrente` più alta.

### 9.5 Il generatore di fatti notevoli

- **1113 gare su 1125** hanno almeno un fatto notevole (le altre 12 non hanno nessun evento del catalogo occorso, limite di copertura del catalogo — `docs/PROGETTAZIONE.md` sezione 10, rischio 2).
  Fonte: `public/data/facts/*.json`, conteggio dei file con `fatti` non vuoto.
- **Mediana di 6 fatti per gara** (sulle 1113 gare con almeno un fatto).
  Fonte: `public/data/facts/*.json`, mediana della lunghezza dell'array `fatti` sui file non vuoti.

### 9.6 Peso dei JSON esportati

- **3337.4 KB totali** (1161 file: `public/data/events/*.json`, `public/data/facts/*.json`, `public/data/races-index.json`, `public/data/params.json`).
  Fonte: somma di `Path.stat().st_size` sui file elencati, stesso conteggio stampato a fine esecuzione da `build_events.py`.

