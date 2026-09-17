# Déjà vu — l'hai già visto?

Progetto per il corso di **Visualizzazione delle Informazioni**.
Uno strumento di interrogazione visuale su 75 stagioni di Formula 1:
**1950–2024, 1125 gare, 26.759 risultati, 589.081 tempi sul giro.**

Un telecronista descrive con una frase il fatto che ha appena visto —
*Hamilton · vince partendo 10° o peggio · a Monza · sempre* — e Déjà vu
risponde **quante volte è già successo, su quante**, dicendo sempre su quale
finestra di dati quel numero vale, e mostra i casi che gli somigliano
**cambiando uno slot alla volta**, con il nome dello slot che cambia scritto
accanto.

Nessun modello, nessun punteggio di similarità opaco: ogni numero è un
conteggio, ogni "simile" è una condizione allentata in modo dichiarato.

```bash
npm install && npm run dev
```

Poi <http://localhost:3000>. Il sito è **statico**: i dati sono già in
`public/data/`, non serve nessun backend.

---

## Indice

1. [Il problema e l'utente](#1-il-problema-e-lutente)
2. [Il modello: la situazione a quattro slot](#2-il-modello-la-situazione-a-quattro-slot)
3. [I déjà vu: il reticolo dei rilassamenti](#3-i-déjà-vu-il-reticolo-dei-rilassamenti)
4. [La regola d'oro: ogni numero porta la sua finestra](#4-la-regola-doro-ogni-numero-porta-la-sua-finestra)
5. [I dati e le fonti](#5-i-dati-e-le-fonti)
6. [Architettura](#6-architettura)
7. [Le pagine](#7-le-pagine)
8. [Le viste e perché sono fatte così](#8-le-viste-e-perché-sono-fatte-così)
9. [Colore e identità visiva](#9-colore-e-identità-visiva)
10. [Struttura del repository](#10-struttura-del-repository)
11. [Come si esegue, si rigenera, si verifica](#11-come-si-esegue-si-rigenera-si-verifica)
12. [Limiti dichiarati](#12-limiti-dichiarati)
13. [Storia del progetto: v1 → v4](#13-storia-del-progetto-v1--v4)
14. [Documenti](#14-documenti)

---

## 1. Il problema e l'utente

**Utente.** Il telecronista o il giornalista di Formula 1 **in diretta**. Ha
davanti un fatto appena accaduto e pochi secondi per decidere se dirlo e come
inquadrarlo: *è la prima volta? quando era già successo? è successo a lui
altrove, o qui ad altri?*

**Problema.** Albi d'oro, siti di statistiche e Wikipedia danno record **già
confezionati**. Non permettono di *comporre* la condizione che serve adesso,
non dicono su quale finestra di dati la risposta vale, e non mostrano i casi
*quasi* uguali — che sono esattamente quelli che fanno il racconto: «non era
mai successo a Monza, ma lui l'aveva già fatto due volte altrove».

**Decisione supportata.** Editoriale: *questo fatto merita di essere detto, e
con quale frase?* Non predittiva, non causale, puramente descrittiva.

**Domanda di ricerca.** *Quello che ho appena visto è già successo? Dove,
quando, a chi — e cosa cambia nei casi che gli somigliano?*

## 2. Il modello: la situazione a quattro slot

Una **situazione** è una frase con quattro slot:

| Slot | Contenuto | Vuoto significa |
|---|---|---|
| **Chi** | un pilota, oppure un team | chiunque |
| **Cosa** | uno o più *fatti* (obbligatorio, almeno uno) | — |
| **Dove** | un circuito, oppure un paese | ovunque |
| **Quando** | un anno, un decennio, o un'era regolamentare | sempre |

La situazione è **un predicato**: ogni slot pieno è una condizione. Il motore
la valuta contro l'universo delle unità (il risultato pilota×gara, oppure la
gara) e restituisce **N volte su M**, dove M è l'universo ristretto agli slot
di contesto — le gare a Monza sono 74, non 1114 — e alla finestra di copertura
dei campi coinvolti.

### I fatti

Un **fatto** è un predicato con al più un parametro, valutato su una colonna
della tabella dei risultati o della tabella delle gare. Non è precalcolato per
valore: si calcola sul momento, in memoria, nel browser.

Il vocabolario ([`src/lib/situazioni/fatti.ts`](src/lib/situazioni/fatti.ts))
conta **48 fatti** — 37 sul risultato, 11 sulla gara — divisi in **9 famiglie**:
come finisce · come parte · se non finisce · qualifica e giro veloce · contro
il compagno · momenti di carriera · cosa fa in gara · soste · com'è la gara.

Alcuni esempi, con la finestra di dati da cui dipendono:

| Fatto | Parametro | Finestra |
|---|---|---|
| vince / sul podio / a punti | — | 1950–2024 |
| arriva P / P o meglio / P o peggio | P | 1950–2024 |
| parte dalla pole / dalla pit lane / P o peggio | P | 1950–2024 |
| guadagna almeno N posizioni / ne perde almeno N | N | 1950–2024 |
| si ritira / per incidente / per guasto / entro il giro L | L | 1950–2024 |
| primo GP, vince al debutto, prima vittoria, primo podio | — | 1950–2024 |
| batte il compagno / battuto dal compagno | — | 1950–2024 |
| in qualifica P o peggio | P | **1994–2024** |
| guadagna almeno N posizioni al via | N | **1996–2024** |
| al comando al giro L / guida almeno N giri / rimonta al podio | L, N, P | **1996–2024** |
| giro veloce | — | **2004–2024** |
| fa N soste / sosta al giro L o prima | N, L | **2011–2024** |
| almeno N neutralizzazioni (Safety Car, VSC) | N | **2023–2024** |

I fatti sulla gara — doppietta, tripletta, nessun cambio di leader, almeno N
leader diversi, cambio di leader all'ultimo giro, meno di N classificati,
nessun ritiro, almeno N ritiri, margine sotto/sopra S secondi,
neutralizzazioni — sono il vocabolario della v3 riletto dentro lo schema nuovo.

Una situazione può contenere più fatti sul risultato (che si applicano allo
stesso pilota, nella stessa gara) e più fatti sulla gara (contesto). Così
l'ambiguità «stesso pilota o stessa gara?» **sparisce per costruzione**.

## 3. I déjà vu: il reticolo dei rilassamenti

I "casi simili" non escono da un punteggio opaco. Ogni slot pieno si può
**allentare** in un modo dichiarato, uno scalino alla volta:

| Slot | Allentamento di grado 1 | Grado 2 |
|---|---|---|
| Chi = pilota | chiunque | — |
| Chi = team | chiunque | — |
| Dove = circuito | lo stesso paese | ovunque |
| Quando = anno | lo stesso decennio | sempre |
| Cosa, parametro numerico | ±1 (es. «partito 9°–11°») | ±2 |
| Cosa, fatto in più | si toglie il fatto | — |

> «Lo stesso team» non è un allentamento di *chi = pilota*: un pilota cambia
> team nel tempo, quindi il legame sarebbe ambiguo. Un solo grado, dichiarato.

Il risultato è un **reticolo**: al vertice la situazione esatta (distanza 0),
poi tutte le situazioni con un solo slot allentato, poi quelle con due (al
massimo due slot toccati). La distanza è **un conteggio di allentamenti**, con
pesi dichiarati in `public/data/params.json` — allentare *chi* pesa più di
allentare *quando*, perché un pilota è più specifico di un decennio.

I gruppi che l'utente vede, in ordine:

1. **Uguale** — tutti gli slot reggono
2. **Stesso fatto, altro pilota** (o team)
3. **Stesso fatto, altro circuito**
4. **Stesso fatto, altra epoca**
5. **Quasi** — parametro numerico entro la tolleranza dichiarata
6. **Più lontani** — due allentamenti insieme

Un gruppo vuoto **si disegna lo stesso**, con scritto «mai successo»: il *mai*
è la risposta più preziosa per chi commenta, nasconderla sarebbe un errore.

**Il punto di metodo:** le differenze non le spieghiamo noi — *sono
letteralmente lo slot che cambia*, e il nome dello slot è scritto accanto a
ogni gruppo e codificato dal suo colore.

## 4. La regola d'oro: ogni numero porta la sua finestra

Il denominatore M si costruisce così:

1. l'universo dell'unità, **Indy 500 esclusa** (gare: 1114; risultati: 26.354),
   ristretto a
2. gli slot di contesto (*dove*, *quando*, *chi*), ristretto a
3. l'**intersezione delle finestre** dei fatti coinvolti — un fatto sulle soste
   porta tutto a 2011–2024 — ristretto a
4. le righe in cui ogni fatto è **valutabile**.

Il punto 4 è il più importante. Un fatto risponde **vero, falso o null** (dato
mancante): le righe null **escono dal denominatore e si contano a parte**. Per
questo un fatto che usa griglia e arrivo lavora di fatto sui 15.518 risultati
in cui entrambi sono noti, non su 26.354.

> **Dato mancante ≠ dato negativo.** «Non lo so» e «no» sono due risposte
> diverse, e restano distinte fino allo schermo.

L'unità in cui M si legge dipende dalla domanda (la regola è in cima a
[`motore.ts`](src/lib/situazioni/motore.ts)): con *chi* = pilota sono «gare del
pilota»; con *chi* = team «risultati del team»; senza *chi*, con un fatto che
in una gara può reggere per una riga sola (vince, pole, giro veloce) sono
«gare», altrimenti «risultati»; con soli fatti sulla gara, «gare».

La finestra **si stampa accanto al numero, sempre, mai dentro un tooltip**, e
la linea del tempo la mostra come banda: ciò che è fuori finestra è grigio —
*non sappiamo*, non *non è successo*.

### Le cinque trappole dei dati

Documentate per esteso in `/methodology`:

1. **Indy 500 (1950–1960)** è negli archivi Ergast ma non è un GP di F1:
   presente nelle tabelle, marcata, **esclusa da ogni denominatore**.
2. **Ritiro ≠ non partito.** La tassonomia degli status Ergast (139 cause)
   distingue incidente, guasto, non qualificato, non partito.
3. **Campi vuoti.** `\N` diventa `null`, **mai 0**.
4. **Griglia 0** significa partenza dalla pit lane, non «prima posizione».
5. **I punti non sono comparabili** tra epoche: i sistemi di punteggio sono
   cambiati più volte, quindi «a punti» è un fatto, il totale punti non lo è.

## 5. I dati e le fonti

| Fonte | Cosa dà | Copertura |
|---|---|---|
| **Ergast / F1DB** (CSV in `data/raw/`) | gare, risultati, griglie, qualifiche, tempi sul giro, pit stop, status | 1950–2024 |
| **OpenF1** (API) | Safety Car e Virtual Safety Car | 2023–2024, 46 gare |
| **Natural Earth** 1:110m | contorno delle terre emerse per la mappa | — |

Le finestre di copertura **dentro** Ergast non sono uniformi, ed è la ragione
per cui la regola d'oro esiste: griglia dal 1950, qualifiche dal 1994, tempi
sul giro dal 1996, rank del giro veloce dal 2004, pit stop dal 2011.

## 6. Architettura

Sito **statico**, nessun backend a runtime. Tre stadi:

```
  CSV Ergast + API OpenF1
           │
           ▼   pipeline Python offline (data-layer/scripts/)
  JSON colonnari precalcolati in public/data/
           │
           ▼   motore TypeScript puro (src/lib/situazioni/)
  valutazione e reticolo, nel browser, ~1 ms
           │
           ▼   viste D3 (src/components/charts/)
  la pagina
```

### Le tabelle spedite al browser

| File | Contenuto | Peso |
|---|---|---|
| `situazioni/risultati.json` | 26.759 righe × 21 colonne (colonnare) | 1.858 KB grezzi, **177 KB gzip** |
| `situazioni/gare.json` | 1125 gare: contesto di gara | 17 KB gzip |
| `situazioni/dizionari.json` | 861 piloti, 211 team, 77 circuiti con sinonimi | 26,5 KB gzip |
| `situazioni/status.json` | 139 cause di ritiro (133 tradotte in italiano) | — |
| `situazioni/tracce/<raceId>.json` | posizioni giro per giro, 544 gare (1996+) | 2,7 MB totali, **a richiesta** |

Le colonne **derivabili** non si spediscono: GP in carriera, vittorie/podi/pole
prima della gara, vittorie sul circuito, ordine del compagno di squadra. Il
motore le ricalcola alla decodifica — meno banda, stessa informazione.

**Prestazioni misurate:** decodifica delle tabelle 20 ms, una valutazione
~1 ms, un reticolo completo (15 gruppi) 12–14 ms. Nessuna richiesta al server
quando si preme un tasto.

### Il motore

[`src/lib/situazioni/`](src/lib/situazioni/) è **TypeScript puro**, senza
dipendenze da React né da Next: si può eseguire da riga di comando, ed è
esattamente ciò che fanno gli script di verifica.

| File | Ruolo |
|---|---|
| `fatti.ts` | i 48 fatti: predicato, parametro, colonne, finestra, sinonimi |
| `motore.ts` | valuta una situazione: N su M, la finestra, l'unità di lettura |
| `reticolo.ts` | costruisce i gruppi allentando gli slot |
| `parser.ts` | testo libero → slot, deterministico, a dizionari |
| `tabelle.ts` | decodifica le tabelle colonnari e ricalcola le derivate |
| `schedaGara.ts` | estrae una singola gara per la sua scheda |

## 7. Le pagine

| Indirizzo | Cosa c'è |
|---|---|
| `/` | **Déjà vu**: la frase a slot, la risposta, la linea dei déjà vu, i ritratti, la mappa |
| `/gara/<anno>-<circuito>` | la scheda di una gara, per tutte e 1125 |
| `/gare` | l'elenco delle gare per stagione, con ricerca e completamento a Tab |
| `/esplora` | le viste del catalogo v3: scala della rarità, riquadri per famiglia, fiume delle famiglie |
| `/scenari`, `/eventi/<id>` | il compositore a chip v3 e le schede evento |
| `/race/<id>` | il capitolo neutralizzazioni (v2, 46 gare 2023–2024) |
| `/methodology` | come si calcolano i numeri, le finestre, le cinque trappole |

## 8. Le viste e perché sono fatte così

Il mantra di Shneiderman, applicato: la **frase** è l'*overview* della domanda;
la **linea del tempo** è l'*overview* della risposta; i **gruppi** filtrano; il
**ritratto** è il *detail on demand*.

### 8.1 La frase (input) — HTML/CSS

**Cosa:** quattro slot in linea, che si leggono come una frase italiana.
**Perché:** in diretta non c'è tempo per tre livelli di menu; la frase è già il
modo in cui il telecronista *pensa* il fatto, e rileggerla è il controllo di
aver chiesto la cosa giusta.
**Come:** ogni slot apre un menu con completamento e mostra **tutte** le
scelte, con le intestazioni di gruppo appiccicate in alto mentre si scorre. Lo
slot *Cosa* fa eccezione: 48 fatti in una lista sola non si leggono, quindi si
apre sulle nove famiglie e scende — ma appena si scrive, i due livelli
spariscono e si cerca in tutto il vocabolario. Il cammino più lungo resta di
due clic; chi digita ne fa zero.

Sopra c'è **una barra di testo libero**: `hamilton vince monza dalla decima`
riempie i quattro slot. Il parser è **deterministico, a dizionari** (cognomi,
circuiti, verbi, ordinali). Nessun modello, nessun LLM: le regole si leggono in
un file, e l'utente vede gli slot riempirsi e corregge con un click quello
sbagliato.

*Non è una vista D3 e non pretende di esserlo: non ha scale né assi.*

### 8.2 La risposta — tipografia

**Cosa:** un numero grande («2 volte su 74 gare a Monza»), la finestra, e la
frase in chiaro riletta dal motore.
**Perché:** è l'unica cosa che si legge in tre secondi.
**Come:** il numero è **rosso solo qui**. Nel resto della pagina il rosso non
compare: il colore d'accento ha un solo significato, la risposta esatta.

### 8.3 La linea dei déjà vu — vista portante, D3

**Cosa:** x = tempo 1950–2024; una riga per gruppo; un punto per occorrenza.
**Colore = lo slot che cambia** (variabile nominale). La riga «uguale» sta in
alto, enfatizzata; i gruppi a due allentamenti sono fusi in un'ultima riga
grigia. Una banda grigia segna dove i dati non arrivano.
**Perché:** risponde a «quando» e «quanto è lontano» con una sola occhiata. La
posizione verticale codifica la distanza (ordinale), il colore la natura della
differenza (nominale). **La rarità sta sulla posizione, mai sulla tinta.**
**Come:** D3 possiede l'SVG — scale, assi, data join, brush sul tempo. Quando
uno slot cambia, i punti **migrano** tra le righe invece di ridisegnarsi: si
vede *cosa* un allentamento sposta. Hover: anno, gara, pilota, e lo slot che
cambia in chiaro. Click: apre la scheda della gara. Il brush sbiadisce i punti
fuori periodo e ogni riga scrive «k nel periodo · n su m» — ma il denominatore
resta quello della finestra piena: **il brush esplora, per cambiare l'universo
si usa lo slot Quando** (scelta dichiarata sotto la vista).

### 8.4 I dove — mappa, D3

**Cosa:** i circuiti in cui la situazione è capitata, con il tasso normalizzato
per quante gare ha ospitato ognuno.
**Perché:** «è successo, ma non qui» ha bisogno di una mappa; la
normalizzazione evita il trabocchetto «Monza ha più casi perché ha più gare».
**Come:** proiezione equirettangolare adattata ai circuiti, contorno Natural
Earth. Raggio = conteggio grezzo; colore = scala sequenziale sulla metrica
scelta — **è l'unica vista in cui il colore è sequenziale**. Interruttore
conteggio ↔ tasso, alternativa a barre ordinate. Cliccando un circuito lo slot
*Dove* si riempie e tutta la pagina si aggiorna.

### 8.5 Il ritratto dell'occorrenza — small multiples, D3

**Cosa:** per ogni occorrenza, la traccia della posizione giro per giro del
pilota (1996+), con griglia e arrivo evidenziati. Per le gare senza tempi sul
giro, solo griglia → arrivo.
**Perché:** il telecronista non vuole solo «è successo nel 2020», vuole vedere
*come*: Gasly a Monza 2020 — partito 10°, 15° al giro 20, primo dal giro 28
dopo la bandiera rossa.
**Come:** small multiples a **scale condivise** (y = posizione 1..20, oltre la
20ª si resta sul bordo; x = giro normalizzato 0–100%), così affiancarli è già
il confronto. I dati arrivano dal file per gara, a richiesta. Ogni ritratto è
un link vero (`<a href>`): funziona anche prima dell'idratazione.

### 8.6 La scheda gara

**Cosa:** testata (circuito, data, giri, al via, classificati, ritiri); podio
con casella di partenza e distacco; pole e giro veloce; «la gara in numeri»;
**la gara giro per giro** (D3, tracce 1996+, podio in evidenza e le altre linee
grigie); **griglia → arrivo** (slopegraph, per tutte le gare); ordine d'arrivo
completo; «quel giorno, per la prima volta» (debutti, prime vittorie, primi
podi, prime pole); e **«l'hai già visto?»**, domande già scritte negli slot che
riaprono la home con la frase compilata.
**Perché:** è il dettaglio a richiesta di un caso, ed è la porta d'ingresso per
chi non sa ancora cosa chiedere.
**Come:** pagina server che estrae una sola gara dalle tabelle
(`schedaGara.ts`, puro) e manda al browser una ventina di righe. Cause di
ritiro in italiano da `status.json`.

### 8.7 Interazione e task

Secondo la tassonomia di **Yi et al.**: *Select* (click su punto, ritratto,
circuito) · *Explore* (brush sul tempo) · *Reconfigure* (mappa ↔ barre) ·
*Encode* (conteggio ↔ tasso; il colore per slot invece è **fisso, senza
interruttore**: la coerenza vale più della scelta) · *Abstract/Elaborate*
(frase → linea → ritratto → scheda gara) · *Filter* (ogni slot è un filtro) ·
*Connect* (frase, linea, mappa e ritratti condividono il colore; la scheda gara
riapre la home con la frase compilata).

Task di **Amar et al.**: *retrieve value* (N su M), *filter* (gli slot), *find
extremum* («la rimonta più lunga»), *characterize distribution* (la linea dei
déjà vu), *cluster* (i gruppi del reticolo), *correlate* (griglia × arrivo, in
`/esplora`).

## 9. Colore e identità visiva

- **Fondo scuro**, blu-nero `#0B0C10` — non nero puro — pannelli `#14161C`,
  testo `#ECEDEF`, secondario `#8A8F9C`. È la grafica da regia televisiva: il
  contesto d'uso reale.
- **Rosso corsa `#E10600` con un solo significato:** la risposta esatta e il
  gruppo «uguale». Mai su bottoni, mai su link, mai su titoli.
- **Colore degli slot** (nominale, palette Tol *muted*, validata per
  daltonismo): chi = `#44AA99`, dove = `#88CCEE`, quando = `#CC6677`,
  cosa = `#B8B04A`. Lo stesso colore sullo slot nella frase, sulla riga nella
  linea dei déjà vu, sul bordo del ritratto: **il colore lega la differenza al
  suo slot**, in tutte le viste.
- **Tipografia:** Barlow Condensed per titoli e numeri (le cifre condensate dei
  tabelloni di gara), Inter per il testo, cifre tabulari dove ci sono colonne.
- **Layout:** una colonna, 1100 px. La frase è l'apertura, non un titolo
  gigante. Bordi e riempimenti solo dove separano un oggetto.
- **Movimento:** una sola animazione con un significato — la migrazione dei
  punti tra le righe quando uno slot cambia. `prefers-reduced-motion` la spegne.

## 10. Struttura del repository

```
data/raw/                      CSV Ergast (la fonte)
data-layer/                    pipeline Python offline
  scripts/build_situazioni.py    tabelle v4      → public/data/situazioni/
  scripts/build_events.py        catalogo v3     → public/data/events/, facts/
  scripts/build_all.py           neutralizzazioni v2 → public/data/races/
  scripts/ingest_year.py         scarico OpenF1 (Safety Car, VSC)
  app/events/                    motore del catalogo v3
  app/metrics/                   metriche v2 (pit loss, neutralizzazioni)
  tests/                         pytest sulla pipeline
public/data/                   JSON statici letti dal sito (nessun backend)
  situazioni/                    le tabelle della v4
  events/, facts/                il catalogo v3
  races/                         le 46 gare del capitolo neutralizzazioni
  params.json                    i pesi del reticolo, dichiarati fuori dal codice
src/lib/situazioni/            il motore v4 (TypeScript puro)
src/lib/                       motore v3 (scenarioEngine), colori, catalogo
src/components/situazioni/     la frase a slot e la pagina Déjà vu
src/components/charts/         le viste D3
src/components/gara/           le viste della scheda gara
src/app/                       le pagine (Next.js App Router)
scripts/verify-*.ts            i numeri attesi del motore e del parser
docs/                          progettazione, roadmap, numeri, materiale d'esame
```

## 11. Come si esegue, si rigenera, si verifica

### Il sito

```bash
npm install
npm run dev
```

Build di produzione e lint:

```bash
npm run build && npm run lint
```

### Rigenerare i dati

I JSON in `public/data/` sono già nel repository: questo passo serve solo se si
toccano i CSV o la pipeline.

```bash
cd data-layer
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python scripts/build_situazioni.py
```

### Le verifiche

Ogni fase del progetto ha i suoi **numeri attesi scritti dentro uno script**,
calcolati prima a mano in Python sui CSV e poi confrontati con quello che
restituisce il TypeScript. Se un numero cambia, è un bug: ci si ferma.

```bash
npx ts-node --compilerOptions '{"module":"commonjs","moduleResolution":"node","target":"es2020","esModuleInterop":true}' scripts/verify-situazioni.ts
```

`scripts/verify-parser.ts` (il parser della frase) e `scripts/verify-s22.ts`
(il motore v3) si eseguono allo stesso modo; la riga esatta è in testa a ogni
file. I test della pipeline Python sono in `data-layer/tests/`, con `pytest`.

I numeri di controllo e le regole che ogni modifica deve rispettare stanno in
[`docs/REGOLE-PROGETTO.md`](docs/REGOLE-PROGETTO.md).

## 12. Limiti dichiarati

Il progetto **non predice, non spiega, non giudica**. Oltre a questo:

- **Le qualifiche non distinguono Q1/Q2/Q3:** la tabella porta solo la
  posizione finale.
- **Il margine di vittoria è in secondi interi:** «vinta con meno di un
  decimo» non si può chiedere.
- **Le neutralizzazioni coprono solo 2023–2024** (46 gare): è la finestra di
  OpenF1, e il fatto la dichiara.
- **I ritratti giro per giro partono dal 1996:** prima non ci sono tempi sul
  giro. Per le gare precedenti si mostra solo griglia → arrivo.
- **«Lo stesso team» non è un allentamento di *chi*:** un pilota cambia team
  nel tempo, il legame sarebbe ambiguo.
- **L'ordine dei gruppi del reticolo** dipende da pesi scelti da noi (in
  `params.json`, ispezionabili): è l'assunzione più debole del progetto, ed è
  per questo che sta in un file di dati e non nel codice.
- **Indy 500 1950–1960** è nelle tabelle ma fuori da ogni denominatore.

## 13. Storia del progetto: v1 → v4

Il progetto ha cambiato inquadramento tre volte, ogni volta dopo un ricevimento.
Niente è stato buttato: ogni versione è stata riletta dentro la successiva ed è
ancora raggiungibile nel sito.

| | Nome | Idea | Dove vive oggi |
|---|---|---|---|
| **v1** | *Chaos Discount* | il costo di un pit stop sotto neutralizzazione | assorbita nella v2 |
| **v2** | *Box, box?* | anatomia della gara e finestre di opportunità | `/race/<id>`, 46 gare 2023–2024 |
| **v3** | *È già successo?* | catalogo di 33 eventi precalcolati, rarità, chip | `/esplora`, `/scenari`, `/eventi/<id>` |
| **v4** | **Déjà vu** | dal catalogo **ai dati**: frase a slot, reticolo | la home e tutto il resto |

**Perché la v4.** La v3 rispondeva alla domanda giusta con il vocabolario
sbagliato: si poteva scegliere solo tra 33 eventi confezionati, e non si poteva
dire la cosa più semplice che capita davanti a un telecronista — *questo
pilota, partito quinto, è arrivato secondo a Monza*. La ricerca costruita sopra
quel catalogo, con il vincolo «nessun dato nuovo», era diventata un compositore
di etichette, non un motore che ricostruisce un fatto. La v4 sposta il centro
di gravità sui dati: il fatto si descrive con una frase, si valuta sul momento
sulla tabella dei risultati, e i casi simili si ottengono allentando uno slot
alla volta.

## 14. Documenti

| File | Contenuto |
|---|---|
| [`docs/PROGETTAZIONE-v4.md`](docs/PROGETTAZIONE-v4.md) | la specifica attuale: problema, modello, viste, colore |
| [`docs/NUMERI.md`](docs/NUMERI.md) | ogni numero citato, con la sua fonte e come ricalcolarlo (§10 per la v4) |
| [`docs/REGOLE-PROGETTO.md`](docs/REGOLE-PROGETTO.md) | le regole non negoziabili e i numeri di regressione |
| [`docs/ROADMAP-7.md`](docs/ROADMAP-7.md) | come è stata costruita la v4, fase per fase, con gli esiti reali |
| [`docs/DOMANDE-ESAME.md`](docs/DOMANDE-ESAME.md) | le domande probabili e le risposte |
| [`docs/CATALOGO-EVENTI.md`](docs/CATALOGO-EVENTI.md) | i 33 eventi della v3 e la loro definizione |
| [`docs/PROGETTAZIONE.md`](docs/PROGETTAZIONE.md), [`docs/ROADMAP.md`](docs/ROADMAP.md) → `ROADMAP-6` | la storia delle versioni v1–v3 |

---

**Stack:** Next.js 16 (App Router), React 19, D3.js 7, TypeScript 5,
Tailwind 4; Python 3.12 con pandas per la pipeline.

**Dati:** Ergast (1950–2024) · OpenF1 (Safety Car e VSC, 2023–2024) ·
Natural Earth (contorni).

**Autori:** Luca Peperoni, Emilio Falco — Università degli Studi Roma Tre,
corso di Visualizzazione delle Informazioni.
