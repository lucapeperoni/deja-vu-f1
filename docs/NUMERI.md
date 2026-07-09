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

_Una VSC, una sola finestra: la lotteria allo stato puro_

- **1 sola neutralizzazione** in tutta la gara (VSC, giri 41-42) — la lotteria si gioca in un solo momento. Fonte: `neutralizations` nel file di gara.
- **6 pit stop** nella finestra, contro un prezzo di listino di 23.6s. Fonte: `drivers[].pits[]` filtrati per `eventId == "7953-vsc-1"`.
- Il miglior colpo: **GAS** paga 18.1s (+5.5s di sconto). Fonte: stesso array, campo `discount`.

### Saudi Arabian Grand Prix 2024 (`2024-jeddah`)

_Una Safety Car, uno split netto: chi può e chi no_

- **Safety Car ai giri 7-9**, prezzo di listino 20.9s. Fonte: `neutralizations` e `race.nominalPitLoss`.
- Split netto: **14 EXPLOITED contro 6 LOCKED_OUT** su 20 esiti registrati per l'evento. Fonte: `drivers[].outcomes[]` filtrati per `eventId`, conteggio per `category`.
- Il miglior colpo: **OCO** paga 8.1s (+12.8s di sconto) su 14 pit nella finestra.

### Australian Grand Prix 2023 (`2023-albert_park`)

_Tre neutralizzazioni, due lotterie opposte_

- **3 neutralizzazioni** nella stessa gara con esiti opposti: sul primo SC (giri 1-3) 5 EXPLOITED contro 14 LOCKED_OUT; sul secondo SC (giri 7-18) si ribalta: 18 EXPLOITED contro 1 LOCKED_OUT.
  Fonte: `drivers[].outcomes[]` filtrati per ciascun `eventId`.
- **42 pit stop in double stack**, distribuiti su **8 team diversi** — non concentrati su una sola squadra.
  Fonte: `drivers[].pits[]`, campo `doubleStack`, raggruppati per `team`.

