# Stato del repository — fotografia onesta

Scritto leggendo il codice e i dati presenti, senza modificare nulla.
Serve come punto di partenza per la Fase 1 della roadmap (`docs/ROADMAP.md`).
Riferimento: `docs/PROGETTAZIONE.md`.

> **Aggiornamento**: questo documento è una fotografia del repository
> *prima* dei task 1.1 e 1.2. Il punto #1 della sezione 4 qui sotto
> ("da riscrivere in ordine di priorità: effective_pit_loss.py") è stato
> completato e validato su una gara vera — vedi `docs/ROADMAP.md` (task
> 1.1/1.2) e `docs/PROGETTAZIONE.md` §5.1 per lo stato attuale reale. Il
> resto della fotografia (frontend su dati incompleti, doppia pipeline,
> pagine rivalry da riconvertire) è ancora accurato.

---

## 1. Frontend: cosa esiste e cosa gira su dati veri o finti

Il sito è Next.js (app router) con queste pagine:

- `src/app/page.tsx` — home, oggi generica (da riscrivere come vista 6
  della specifica, task 3.6)
- `src/app/race/[id]/` — la pagina gara, il cuore del progetto:
  - `RaceAnatomyTimeline.tsx` — vista 1 (race trace)
  - `PitCostDumbbell.tsx` — vista 2 (sconti)
  - `OpportunityWindow.tsx` — vista 4 (matrice/finestra di opportunità)
  - `RaceAnatomyClient.tsx` — orchestratore delle tre viste sopra
  - `page.tsx` — carica il JSON della gara da `public/data/races/<id>.json`
- `src/app/rivalry/[id]/` — filone "rivalità tra compagni" (da riconvertire
  in vista 5, task 3.5): `DuelTimeline.tsx`, `RaceSlopeChart.tsx`
- `src/app/grid/` — `RivalryGridInteractive.tsx`, griglia di rivalità
- `src/app/rankings/` — classifiche
- `src/app/methodology/page.tsx` — pagina metodologia, oggi generica

**Punto importante: `race-anatomy-mock.json` non è più collegato a nessun
componente.** Ho cercato la stringa "mock" in tutto `src/` e non c'è alcun
riferimento: `page.tsx` legge sempre `public/data/races/<id>.json`, cioè
dati reali (ma incompleti, vedi sotto). Il file mock è materiale vecchio,
rimasto solo su disco — da eliminare quando si fa pulizia (task 3.5).

**Il dato reale che arriva alle viste oggi è quasi vuoto.** Ho aperto
`public/data/races/9102.json` (una gara con il maggior numero di pit
stop registrati): ogni pit stop ha `lapNumber: null`, `pitDuration: null`,
`neutralizationDiscount: null`; c'è solo `baselineCost: 20.0` fisso per
tutti. Non esiste alcuna lista `drivers` nel JSON: `page.tsx` la ricostruisce
a mano da `driverNumber`, inventando nomi placeholder (`Driver 4`) e colori
casuali via HSL. In pratica: **le viste della pagina gara oggi mostrerebbero
un grafico tecnicamente funzionante ma senza numeri veri dentro** — è
scheletro puro, non "dati mock" nel senso stretto, ma dati reali-a-metà,
raccolti ma non ancora elaborati.

Le pagine `rivalry`, `grid`, `rankings` invece hanno dati reali e completi
(vedi §2.2) perché si appoggiano al preprocess TypeScript sui CSV Ergast,
non al data-layer Python.

## 2. Cosa fa oggi il data-layer Python

### 2.1 Cosa gira davvero

Il data-layer (`data-layer/`, FastAPI + SQLAlchemy + SQLite) è collegato
solo a OpenF1, mai ai CSV Ergast. Script che esistono ed eseguono:

- `scripts/ingest_session.py`, `scripts/ingest_year.py` — scaricano da
  OpenF1 sessioni, messaggi di race control e pit stop, li salvano nel
  database e li mettono in cache su disco (`data-layer/data/raw/`, con
  manifesti in `data-layer/data/manifests/`)
- `scripts/export_frontend.py` — legge dal database, applica
  `neutralization_events.py` e `effective_pit_loss.py`, scrive i JSON in
  `public/data/races/` — è la funzione che oggi produce i file che
  `page.tsx` legge

### 2.2 Cosa c'è nel database (`data-layer/race_dynamics.db`)

| Tabella | Righe | Nota |
|---|---|---|
| sessions | 23 | tutte 2023, provenienza OpenF1 |
| race_control_messages | 1862 | i messaggi da cui si ricavano le finestre SC/VSC |
| pit_stops | 636 | **campo `pit_duration` sempre `NULL`** in tutte le righe controllate |
| laps | 0 | **vuota: mai popolata** |
| drivers | 0 | vuota |
| positions | 0 | vuota |
| intervals | 0 | vuota |
| meetings | 0 | vuota |

Conseguenza diretta sulla Fase 1 della roadmap: la riscrittura di
`effective_pit_loss.py` (task 1.1) richiede i tempi sul giro dai CSV Ergast
(`data/raw/lap_times.csv`), perché **OpenF1 in questo database non ha mai
avuto i lap times** e comunque `pit_duration` risulta sempre nullo anche per
i pit stop già scaricati. La correzione della metrica descritta nella
specifica non è solo "meglio": è l'unica via percorribile con i dati che
ci sono oggi.

### 2.3 Sessioni OpenF1 già scaricate in cache

`data-layer/data/raw/` contiene cache per **23 sessioni di gara, tutte del
2023** (nessuna del 2024): sessioni con solo `race_control` scaricato
(9 gare: 7779, 7787, 7953, 9070, 9078, 9086, 9094, 9118, più la lista
sessioni dell'anno) e sessioni con `race_control` **e** `pit` scaricati
(14 gare: 9102, 9110, 9126, 9133, 9141, 9149, 9157, 9158, 9165, 9173, 9181,
9189, 9197, 9213, 9221). Il 2024 va scaricato da zero.

## 3. CSV Ergast: copertura

`data/raw/` contiene le 14 tabelle standard del dataset Ergast/Kaggle
(races, circuits, drivers, constructors, results, qualifying, lap_times,
pit_stops, driver_standings, constructor_standings, constructor_results,
sprint_results, status, seasons). File più pesante: `lap_times.csv`
(~17.6 MB, la spina dorsale della metrica corretta).

**`races.csv` copre fino al 2024 compreso**, con la stagione 2024
**completa: tutti e 24 i Gran Premi**, dal Bahrain (round 1, raceId 1121)
ad Abu Dhabi (round 24, raceId 1144). Anche il 2023 è completo con 22 gare.
Niente da integrare da Jolpica per questi due anni: il rischio #3 elencato
nella specifica (§10) non si è materializzato, il perimetro 2023-2024 è
coperto interamente dal Kaggle già presente.

Da verificare in Fase 1 (non ancora controllato in questa fotografia):
se `lap_times.csv` e `pit_stops.csv` sono popolati con la stessa
completezza per tutte le gare 2023-2024, o se mancano righe per gare
specifiche.

## 4. Cosa buttare, cosa tenere, cosa riscrivere

**Da buttare (quando si arriva al task che le tocca):**
- `public/data/race-anatomy-mock.json` — non referenziato da nessun
  componente, materiale morto
- `src/app/rivalry/`, `src/app/grid/`, `src/app/rankings/` — da rimuovere
  al task 3.5, dopo aver riciclato `DuelTimeline.tsx` e `RaceSlopeChart.tsx`
  nelle viste 5 e 3
- di conseguenza, quando non più referenziati: `public/data/
  season-rivalries.json`, `race-comparisons.json` e le funzioni di
  `src/lib/data.ts` che li leggono

**Da tenere così com'è:**
- tutti i CSV Ergast in `data/raw/` — coprono il perimetro richiesto
- la cache OpenF1 2023 in `data-layer/data/raw/` e i relativi manifesti —
  evitano di riscaricare quelle 23 sessioni
- `neutralization_events.py` — non ancora ispezionato riga per riga in
  questa fotografia, ma il suo compito (ricavare le finestre SC/VSC dai
  messaggi di race control) resta valido nell'architettura della specifica;
  la Fase 1 lo userà così com'è nello script di validazione (task 1.2)
- `src/app/methodology/page.tsx`, `Header.tsx` — struttura riusabile,
  contenuto da riscrivere (task 4.2)

**Da riscrivere, in ordine di priorità:**
1. `data-layer/app/metrics/effective_pit_loss.py` — oggi usa
   `pit_duration` (sempre nullo) come proxy del costo; va riscritto secondo
   §5.1 della specifica leggendo i tempi giro da `data/raw/lap_times.csv`
   (task 1.1, **bloccante per tutto il resto**)
2. `data-layer/scripts/export_frontend.py` — oggi esporta pit stop con
   campi nulli; andrà sostituito/esteso dalla pipeline unica descritta
   nella specifica §6 (`build_all.py`, task 2.1), che deve anche leggere
   Ergast e non solo OpenF1
3. `RaceAnatomyClient.tsx` — la ricostruzione posticcia della lista
   `drivers` da `driverNumber` va eliminata quando il JSON di gara conterrà
   davvero i piloti (nome, team) come da schema §6 della specifica
4. `scripts/preprocess.ts` (275 righe) e `src/lib/data.ts` (110 righe) — da
   valutare se tenerli solo per le anagrafiche piloti/team (come previsto
   dalla specifica) o eliminarli quando la vista 5 non dipenderà più dal
   loro output

## 5. In una frase

Il progetto ha un'architettura frontend già coerente con la specifica
(le pagine e i nomi dei componenti corrispondono quasi 1:1 alle viste
1, 2, 3, 4, 5 del documento di progettazione), ma **il collegamento dati
è rotto a monte**: il data-layer parla solo con OpenF1, non ha mai letto
un CSV Ergast, e il campo che dovrebbe misurare il costo del pit stop è
sempre nullo. La Fase 1 della roadmap (riscrivere la metrica leggendo
`lap_times.csv`, poi validare su una gara campione) non è un'ottimizzazione:
è la condizione perché qualunque vista mostri un numero vero.
