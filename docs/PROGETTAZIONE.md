# È già successo? — Documento di progettazione (v3)

> **Documento storico.** La versione attuale del progetto è la v4 "Déjà vu",
> descritta in `docs/PROGETTAZIONE-v4.md` (11 settembre 2026). Questo file resta
> come storia del pivot v3 e come riferimento per le viste ancora nel sito
> sotto `/esplora`, `/scenari`, `/eventi/[id]` e `/race/[id]`. La scheda gara
> descritta qui (vista 6, fatti ordinati per notevolezza) è stata sostituita:
> vedi PROGETTAZIONE-v4 §7.6. Numeri riallineati al motore il 14 settembre 2026.

Progetto per il corso di Visualizzazione delle Informazioni.
Gruppo di 3 studenti. Visualizzazione interattiva in D3.js su dati reali di
Formula 1.

Ultimo aggiornamento: 22 luglio 2026 — **secondo pivot dopo il ricevimento**.
La v2 ("Box, box?") aveva riorientato il progetto verso il supporto alla
decisione, ma il professore ha ripetuto l'obiezione della v1: il progetto
non risolve un problema. Il suo esempio testuale: *un giornalista che ha
bisogno al volo di un'informazione e la cerca sulla nostra soluzione — per
esempio quante volte e dove è successo un determinato evento*; e
l'avvertimento che la Safety Car da sola rischia di essere banale.

Le versioni precedenti non si buttano: la pipeline delle neutralizzazioni
2023-2024 diventa **una famiglia di eventi tra le altre** (§5.5, §12).

---

## 1. Il problema e la soluzione (l'idea in due righe)

**Il problema.** Durante e subito dopo una gara succede qualcosa che *sembra*
straordinario — una vittoria dal fondo della griglia, una volata decisa per
pochi millesimi, un doppio ritiro identico, una gara senza un solo cambio al
comando. Chi deve raccontarla (giornalista, commentatore, redattore sotto
scadenza) ha bisogno in pochi minuti di sapere **se è davvero raro, quante
volte è successo prima, dove e quando**. Oggi quell'informazione esiste ma è
inutilizzabile: Wikipedia e i siti di statistiche danno albi d'oro e record
già confezionati, non permettono di *comporre* la condizione che serve
adesso ("vittoria partendo oltre la decima piazza"), non normalizzano per
quante gare ha ospitato ogni circuito, e non dicono mai su quale finestra
temporale la risposta è valida. Il risultato pratico sono affermazioni
sbagliate dette in diretta, o interessanti e mai dette.

**La soluzione.** Uno strumento di interrogazione visuale su **75 stagioni
(1950-2024, 1125 gare)** che: (a) lascia comporre un evento con pochi
parametri e risponde **quante volte, dove, quando**, con la rarità
calcolata e la finestra di validità dichiarata; (b) mette l'evento in
contesto dentro la nuvola di tutti i risultati, così si vede *perché* è
raro; (c) data una gara, genera **da solo** i fatti notevoli, ordinati per
rarità, per chi non sa ancora cosa cercare.

## 2. Domanda di ricerca

**Quanto è raro quello che ho appena visto, e quando e dove era già
successo?**

In pratica il progetto risponde a tre domande:

1. Quante volte è successo questo evento, e su quale finestra di dati è
   lecito dirlo? (rarità e copertura — §5.1, §5.2)
2. Dove e quando è successo? (distribuzione nel tempo e sui circuiti,
   normalizzata — §5.3)
3. Cosa c'è di notevole in *questa* gara, che io non ho pensato di
   chiedere? (generatore di fatti per rarità — §5.4)

Utente di riferimento e decisione supportata (richiesti dalle slide):
il **giornalista sportivo sotto scadenza** — e, secondariamente, il tifoso
informato — che deve decidere **se un fatto merita di essere raccontato e
come inquadrarlo**. La decisione è editoriale, non sportiva: "questo è il
titolo, o è una banalità?".

Cosa il progetto NON è: non un modello predittivo, non una simulazione, non
un tentativo di spiegare *perché* un evento accade. È uno strumento
descrittivo di interrogazione — che è esattamente quello che il professore
ha indicato come sufficiente e appropriato.

## 3. Decisioni prese

**Pivot del 22 luglio 2026.** Regole:

- **Si allarga il perimetro a tutto Ergast (1950-2024).** Il vincolo
  2023-2024 esisteva solo perché OpenF1 serve per la Safety Car: cioè
  l'unico evento che il professore ha indicato come rischioso ci stava
  costando il 97% del dataset. Le neutralizzazioni restano, come famiglia
  con finestra ridotta.
- **L'unità di lavoro non è più la gara ma l'evento.** Il sistema è un
  motore di eventi dichiarativi: ogni evento è un predicato + una finestra
  di copertura + una descrizione in italiano. Aggiungere un evento deve
  costare poche righe, non un componente nuovo.
- **La rarità si dichiara sempre insieme alla sua finestra.** "Mai successo
  prima" significa "mai da quando il dato esiste". È la regola che
  trasforma un limite dei dati in una garanzia di onestà, ed è il cuore
  della pagina metodologia.
- **Niente numeri grezzi dove serve un tasso.** Un circuito che ha ospitato
  70 gare avrà più occorrenze di uno che ne ha ospitate 8: si mostra
  sempre anche il tasso per gara ospitata.
- **La pipeline v2 non si tocca.** `build_all.py` e i suoi JSON restano;
  il motore di eventi è un layer nuovo che gli sta accanto, non sopra. Se
  il layer nuovo avesse problemi, il progetto v2 resta in piedi.
- **Le viste già implementate si riusano dove il task lo giustifica**, non
  per affezione: la race trace e la matrice sopravvivono dentro il capitolo
  delle neutralizzazioni (§7, vista 7).

**Perimetro dati:** 1950-2024, 1125 gare, 26.759 risultati, 862 piloti,
77 circuiti, 105 cause di ritiro effettivamente usate. Finestre ridotte per
alcune famiglie (§5.2).

**Cose escluse di proposito:** qualunque modello predittivo o causale; il
confronto diretto tra piloti di ere diverse in termini di "chi era più
forte" (i dati non lo reggono); la ricostruzione di eventi non presenti nei
dati (bandiere rosse prima del 2023, penalità, meteo); l'integrazione con
fonti testuali (cronache, comunicati).

## 4. Dataset

- **Ergast/Kaggle (i CSV in `data/raw/`)** — è il dataset principale
  richiesto dal corso e ora è **la fonte primaria del progetto**: 14
  tabelle, 1950-2024. Da qui vengono tutti gli eventi del catalogo.
- **OpenF1 (API, già collegata nel data-layer)** — resta la fonte delle
  finestre SC/VSC, 2023-2024, per la sola famiglia "neutralizzazioni".

Il catalogo concreto degli eventi verificati sui dati, con i conteggi reali,
è in **`docs/CATALOGO-EVENTI.md`** — documento fratello di questo, prodotto
scavando nei CSV prima di scrivere una riga di codice.

## 5. Le metriche (il cuore del progetto)

### 5.1 Che cos'è un evento

Un evento è un **predicato dichiarativo** valutato su un'unità di
osservazione. Le unità sono tre:

- **gara** (es. "meno di 8 classificati", "nessun cambio di leader");
- **risultato pilota×gara** (es. "vittoria partendo 10° o peggio",
  "ritiro per causa X");
- **coppia team×gara** (es. "doppio ritiro per la stessa causa").

Ogni evento è definito da: identificatore, nome in italiano, famiglia,
unità di osservazione, funzione predicato, eventuali **parametri**
(la soglia N di "partendo N° o peggio"), finestra di copertura, e una
frase di descrizione che compare nell'interfaccia. La definizione vive in
un unico file Python; il frontend non sa nulla di come si calcola.

### 5.2 Rarità e finestra di copertura

Per ogni evento:

    rarità = occorrenze / unità osservabili nella finestra di copertura

La finestra non è una scelta editoriale, è imposta dai dati:

| Dati | Copertura | Gare | Cosa abilita |
|---|---|---|---|
| `results`, `races`, `status`, standings | **1950-2024** | 1125 | griglia, arrivo, punti, ritiri, classifiche |
| `qualifying` (Q1/Q2/Q3) | 1994-2024 | 494 | eventi di qualifica dettagliati |
| `lap_times` | 1996-2024 | 544 | comando in pista, cambi di leader |
| `results.rank` (giro veloce) | 2004-2024 | 412 | hat-trick, giro veloce |
| `pit_stops` | 2011-2024 | 285 | numero di soste, strategie |
| OpenF1 (SC/VSC) | 2023-2024 | 46 | neutralizzazioni |

**Regola vincolante:** ogni numero mostrato nell'interfaccia porta con sé la
sua finestra, sempre visibile (non in un tooltip nascosto). Un evento che
vale su 285 gare e uno che vale su 1125 non si confrontano: l'interfaccia
deve impedire visivamente il confronto scorretto.

### 5.3 Distribuzione nel tempo e nello spazio

Per ogni evento si calcolano:

- **quando**: occorrenze per stagione, più la **siccità corrente** (gare o
  anni trascorsi dall'ultima occorrenza) — la metrica più giornalistica di
  tutte: "non succedeva dal 1961";
- **dove**: occorrenze per circuito **e** tasso per gara ospitata. I
  circuiti hanno `lat`/`lng` in `circuits.csv`, quindi la vista "dove" può
  essere geografica;
- **chi**: pilota, costruttore, nazionalità coinvolti, per il drill-down.

### 5.4 Il punteggio di notevolezza (il generatore automatico)

Data una gara, il motore valuta **tutti** gli eventi del catalogo e
restituisce quelli occorsi, ordinati per notevolezza:

    notevolezza = w1 · (1 − rarità normalizzata)
                + w2 · siccità normalizzata
                + w3 · peso editoriale dell'evento

I tre pesi sono dichiarati a mano e scritti in `params.json` (come già si fa
in v2 per le soglie): la rarità pura premierebbe sempre gli eventi assurdi e
irrilevanti, la siccità da sola premierebbe i ritorni banali, il peso
editoriale (0-1, assegnato una volta per evento nel catalogo) tiene conto
del fatto che "prima vittoria in carriera" interessa più di "quinto posto
partendo settimo". **Non è un modello**: è una regola di ordinamento
trasparente e ispezionabile, e va presentata così — è la differenza tra uno
strumento onesto e una scatola nera.

### 5.5 La famiglia "neutralizzazioni" (eredità della v2)

Tutta la §5 della v2 — costo effettivo del pit stop, prezzo di listino,
sconto, etichette dei pit, esiti pilota×evento — resta valida e diventa il
motore di una singola famiglia del catalogo, con finestra 2023-2024 (46
gare). Il testo integrale è conservato in **§12** per la relazione e per
l'esame. Eventi interrogabili di questa famiglia: "pit stop sotto Safety
Car", "pilota escluso dalla finestra (LOCKED_OUT)", "double stack",
"gara con almeno N neutralizzazioni".

### 5.6 Le trappole nei dati (che diventano contenuto)

Cinque problemi reali trovati scavando (dettagli e numeri in
`docs/CATALOGO-EVENTI.md` §11). Non sono ostacoli: sono il contenuto della
pagina `/methodology` e la prova che il gruppo ha guardato i dati.

1. **Indianapolis 500.** 19 gare a Indianapolis nel dataset, di cui
   1950-1960 sono la 500 Miglia: contava per il mondiale ma non era una
   gara di Formula 1. Inquina i record (la "rimonta più grande di sempre"
   risulta Indy 1957, 30 posizioni). Filtro esplicito, attivo di default,
   disattivabile dall'utente con una spiegazione.
2. **"Ritiro" ≠ "non partito".** In `status` ci sono 1025 *Did not
   qualify*, 331 *Did not prequalify*, 248 *Withdrew*. Contati come ritiri
   gonfiano ogni statistica di affidabilità degli anni '80-'90. Tassonomia
   esplicita: non-qualificato / non-partito / ritiro tecnico / ritiro per
   incidente / classificato.
3. **Campi vuoti.** `position` vuoto nel 41% dei risultati (i non
   classificati), `time`/`milliseconds` nel 71%, giro veloce nel 69%
   (esiste solo dal 2004). Ogni evento deve dichiarare da quali campi
   dipende, e le unità con campo mancante escono dal denominatore, non
   contate come "non è successo".
4. **`grid = 0`** significa partenza dalla pit lane, non "posizione zero":
   va normalizzato a "ultimo + 1" o trattato come categoria a sé.
5. **Punti non comparabili tra ere.** Il sistema di punteggio è cambiato
   più volte: confronti in punti solo dentro la stessa era, o normalizzati.

## 6. Come arrivano i dati al sito

Nessun backend, sito statico: come in v2, tutto è precalcolato in JSON.
Si aggiunge una pipeline accanto a quella esistente.

**Nuovo: `data-layer/scripts/build_events.py`.** Legge i CSV Ergast (e, per
la famiglia neutralizzazioni, i JSON già prodotti da `build_all.py`), valuta
ogni evento del catalogo su tutte le unità della sua finestra, e scrive:

- **`public/data/events/index.json`** — il catalogo: per ogni evento id,
  nome, famiglia, unità, parametri disponibili, finestra di copertura,
  occorrenze totali, denominatore, rarità, siccità corrente, peso
  editoriale. È il file che alimenta la home e il compositore.
- **`public/data/events/<eventId>.json`** — un file per evento: l'elenco
  completo delle occorrenze (gara, anno, circuito, piloti/team coinvolti,
  valore della grandezza misurata), le serie per stagione e per circuito
  già aggregate. Budget: sotto i 300 KB (l'evento più numeroso, "doppio
  ritiro", ha 2964 occorrenze).
- **`public/data/facts/<anno>-<circuitRef>.json`** — per ogni gara, i fatti
  notevoli già ordinati (§5.4), con il rimando all'evento di origine.
- **`public/data/races-index.json`** — l'elenco delle 1125 gare per il
  selettore e per la vista di contesto.
- **`public/data/params.json`** — esteso: soglie, pesi della notevolezza,
  regole delle trappole (§5.6). Lo legge `/methodology`.

Gli eventi con parametro (soglia N) si precalcolano su una griglia di valori
dichiarata nel catalogo (es. N ∈ {3, 5, 10, 15, 20}): niente calcolo lato
client sui CSV, che sono 17 MB solo per `lap_times`.

## 7. Le viste

Struttura del sito dopo la roadmap S (`docs/ROADMAP-6.md`), coerente col
mantra di Shneiderman: la **home** è il **compositore di scenari** (comporre
una condizione e vederla nel tempo — overview + zoom and filter sullo stesso
schermo), l'**area `/esplora`** raccoglie le viste di panoramica sul catalogo
(la scala della rarità, i riquadri, il fiume delle famiglie), la **scheda
evento** e la **scheda gara** danno i dettagli (details-on-demand).

**Il pivot della roadmap S — la home non è più la scala della rarità.** Le
tre viste di panoramica rispondevano a "cosa c'è nel catalogo"; il compositore
di un evento singolo rispondeva su **un** predicato alla volta. Mancava il
modo di interrogare in fretta guidati da uno scenario preciso — "vittoria da
lontano **+** sotto Safety Car **+** a Monza". Quella è ora la prima pagina.
Regola d'oro dei pivot di questo progetto: **niente si butta** — le viste di
panoramica si spostano in `/esplora`, non spariscono.

| # | Vista | Dove | Ruolo |
|---|---|---|---|
| 0 | **Il compositore di scenari** (home, `/`) | `/` | comporre K condizioni (chip tipizzati) e leggerle nel tempo: barra di ricerca + riga dei chip + **lo scaffale delle corrispondenze** |
| 0b | Lo scaffale delle corrispondenze | `/` (dentro il compositore) | la vista portante della home: x = tempo 1950-2024, y = quante condizioni reggono (da K a 1), un punto per occorrenza passata, colore = famiglia |
| 1 | La scala della rarità | `/esplora` | overview: tutti gli eventi del catalogo ordinati per rarità, con la finestra dichiarata |
| 2 | I riquadri e il fiume delle famiglie | `/esplora` | le altre due viste di panoramica del catalogo (roadmap R e T) |
| 3 | Quando: la striscia storica | `/esplora` | 75 stagioni, occorrenze e siccità |
| 4 | Dove: la mappa dei circuiti | `/esplora` | occorrenze e **tasso** per gara ospitata |
| 5 | Il piano griglia × arrivo | `/esplora` | il contesto: 26.759 risultati come nuvola, l'evento evidenziato |
| 6 | La scheda gara | `/gara/[slug]` | i fatti notevoli auto-generati, ordinati per rarità |
| 7 | Il capitolo neutralizzazioni | `/race/[id]` | la famiglia 2023-2024 con race trace e matrice — **già implementato** (v2) |

**Vista 0 — Il compositore di scenari (la home).** Una barra di ricerca in
cima cerca **insieme** sui cinque tipi di chip (`evento`, `pilota`, `team`,
`circuito`, `era`); i chip scelti si accumulano in una riga, ognuno rimovibile,
i chip evento restano modificabili nei parametri. Il menu a macro-aree
(famiglia → evento → parametro) resta raggiungibile come modo di **scoprire**
cosa si può chiedere, ma la strada principale è digitare. Sopra lo scaffale una
**frase in chiaro** riformula lo scenario ("Lo stesso pilota: prima vittoria e
prima pole, a Monza"), con il prefisso del join cliccabile quando l'ambiguità
"stesso pilota / stessa gara" è reale. La **finestra di copertura intersecata**
e il **denominatore composto** stanno scritti accanto alla vista, mai in un
tooltip, e la finestra si accorcia a vista d'occhio mentre si aggiungono chip.
Tutto è navigabile da tastiera (è lo scenario d'uso: un telecronista con pochi
secondi non prende il mouse).

**Vista 0b — Lo scaffale delle corrispondenze.** È la risposta visuale a "è
già successo?", e sostituisce qualunque lista di risultati. **Encoding:**
- **x = posizione**: l'anno dell'occorrenza sulla stessa scala lineare
  1950-2024 di `QuandoStrip` (tick `d3.format("d")`);
- **y = posizione**: quante delle K condizioni reggono in quel caso — una
  riga per livello, da **K su K** in alto (identico) a **1 su K** in basso.
  La rarità del match sta **qui, sulla posizione**, non sul colore;
- **un punto per occorrenza passata**, con jitter verticale deterministico
  dal `raceId` dentro la banda della riga;
- **colore = famiglia** dell'evento (`familyColor`), nominale, sempre — mai
  la rarità, mai il punteggio (regola vincolante del progetto);
- la riga **K su K** è enfatizzata con sfondo e bordo rossi
  (`STORY_ACCENT_COLOR`): è la riga che risponde alla domanda. Una riga vuota
  **resta disegnata** con scritto "mai successo" — l'assenza è informazione;
- **hover** su un punto → anno, gara, e **quali chip saltano** in quel caso
  (`chipsMissed` + `chipsNonValutabili`, con la label in chiaro: la
  "differenza" non la spieghiamo noi, è il nome del chip mancante);
- **click** su un punto → `/gara/<slug>`. Sotto lo scaffale, una lista HTML
  compatta dei casi "K su K" con gli stessi link `/gara/<slug>` è la via
  equivalente da tastiera (i cerchi SVG, disegnati da D3, non sono
  focalizzabili — il fallback è HTML separato, la regola D3 resta intatta).

**Viste 1-5 — sezioni di `/esplora`.** Le viste di panoramica del catalogo
(la scala della rarità e, dalle roadmap R e T, i riquadri e il fiume delle
famiglie), più le viste "quando/dove/griglia×arrivo" su un evento singolo,
vivono ora sotto `/esplora`. Il loro contenuto non cambia (`HomeCatalogView`
e i suoi figli sono stati solo spostati); cambia solo l'inquadramento — non
sono più la home, ma il modo di **scorrere** il catalogo quando non si ha in
mente uno scenario preciso. Le descrizioni di dettaglio restano qui sotto.

**Vista 3 — Quando.** Asse X: le 75 stagioni. Le occorrenze come segni sulla
striscia; sopra, il conteggio per stagione. La **siccità** è resa come lo
spazio vuoto tra i segni: il vuoto di 63 anni della tripletta 1-2-3 si vede
prima di leggerlo. Brush sull'asse anni che filtra le altre viste.

**Vista 4 — Dove.** I 77 circuiti sulle loro coordinate reali. Due
codifiche commutabili (interruttore = idiom *encode* di Yi et al.):
conteggio grezzo e tasso per gara ospitata — e il passaggio tra le due
ribalta la classifica, che è di per sé una lezione di lettura dei dati.
Alternativa a barre ordinate sempre disponibile, perché la mappa è bella ma
la barra è precisa.

**Vista 5 — Il piano griglia × arrivo.** I 15.518 risultati con griglia e
arrivo noti (su 26.759) come nuvola densa (posizione di partenza × posizione di arrivo); le occorrenze
dell'evento selezionato si illuminano. Serve a rispondere alla domanda che
viene subito dopo "quante volte?": **perché** è raro. Le 37 vittorie partendo
dalla decima piazza o peggio si vedono come una manciata di punti in un angolo
quasi vuoto.

**Vista 6 — La scheda gara.** Si sceglie una gara tra le 1125 e il sistema
mostra i suoi fatti notevoli ordinati per notevolezza (§5.4), ognuno con
rarità, finestra e link all'evento. È la vista che risponde all'esempio
letterale del professore, e la più facile da dimostrare a voce all'esame:
si apre una gara a caso e il sistema dice qualcosa di vero e non ovvio.

**Vista 7 — Il capitolo neutralizzazioni.** Le viste v2 già implementate
(race trace, sconti, matrice, compagni di squadra) diventano il
approfondimento della famiglia SC/VSC, con la sua finestra dichiarata di 46
gare. Non si riscrive nulla: si reinquadra con un'intestazione onesta.

Interazione comune: hover per evidenziare, click per bloccare, tooltip con i
numeri e sempre la finestra di copertura.

**Regola vincolante sul colore:** il colore codifica la **famiglia**
dell'evento (variabile nominale, poche classi, colormap categoriale
colorblind-safe), mai la rarità — che è quantitativa e va sulla posizione.
L'unica codifica quantitativa in colore ammessa è il tasso per circuito
nella vista 4 (colormap sequenziale).

**Regola sul D3 (requisito del corso):** D3 possiede l'SVG — scale, assi,
data join, transizioni e brush dentro un `useEffect`; React fa da
contenitore, routing e stato. Vale per tutti i componenti nuovi; il
componente esistente `D3Chart.tsx` resta la base.

## 8. Aggancio al corso (per la relazione e l'esame)

Impianto di Munzner, nested model a 4 livelli:

**Domain situation.** Utente: il giornalista sportivo sotto scadenza (e il
tifoso informato). Decisione supportata: *questo fatto merita di essere
raccontato, e come lo inquadro?* Il problema è concreto e verificabile: la
verifica di rarità oggi richiede minuti e fonti che non si incrociano; il
sistema la porta a secondi, con la finestra di validità esplicita.

**Data e task abstraction.** Dati: tabelle di risultati (item con attributi
categoriali, ordinali e quantitativi) + serie temporali + attributi
geografici dei circuiti. Task, nella tassonomia di Amar et al.:
**retrieve value** ("quante volte?"), **filter** (il compositore),
**compute derived value** (rarità, siccità, notevolezza), **characterize
distribution** (le occorrenze nel tempo), **find extremum** (il margine più
stretto, la siccità più lunga), **find anomalies** (gli eventi occorsi una
volta sola), **sort** (la scala della rarità), **cluster** (le famiglie),
**correlate** (griglia × arrivo).

*Lo scaffale delle corrispondenze (home)* aggiunge un uso preciso della
tassonomia di Amar et al.: è **retrieve value** ("quante volte è successo
tutto insieme?", la riga K su K), **characterize distribution** (dove cadono
i casi nei 75 anni, e la siccità come spazio vuoto tra i punti), e soprattutto
un **query by example a soglia esplicita** — la cascata K / K-1 / K-2 non è un
ranking di similarità opaco ma un conteggio di quante condizioni-esempio
reggono, con la soglia (il livello della cascata) leggibile sull'asse y e la
differenza scritta in chiaro come nome del chip che salta. Non c'è **compute
derived value** nascosto: nessun punteggio, nessun modello.

**Visual encoding e interaction idioms.** Marks: punti, segmenti, barre,
celle, linee. Channels: posizione (rarità, anni, griglia×arrivo — il canale
più preciso, riservato alle quantità che contano), lunghezza (conteggi),
colore hue (famiglia, nominale), colore saturazione (tasso, sequenziale),
dimensione (occorrenze per circuito). Le sei categorie di Yi et al. sono
tutte coperte: **select** (click sull'evento), **explore** (selettore gara,
pan sulla mappa), **reconfigure** (ordinamento della scala), **encode**
(interruttore conteggio/tasso nella vista 4), **abstract/elaborate**
(tooltip e drill-down alla gara), **filter** (i parametri del compositore,
il brush sugli anni), **connect** (brushing and linking tra viste 3-4-5).

Sullo scaffale della home gli idiom di Yi et al. in gioco sono due, netti:
**filter** — aggiungere o togliere un chip ricompone lo scenario e
ridistribuisce i punti tra i livelli della cascata; **connect** — un punto (o
la voce equivalente nella lista da tastiera) porta alla scheda gara di quel
caso. Nessuna codifica quantitativa in colore: la rarità del match resta sulla
**posizione** (l'asse y della cascata), il colore è **solo la famiglia**
dell'evento — la stessa regola vincolante di tutto il progetto.

**Algorithm.** Precalcolo Python offline, rendering D3 su JSON statici. Il
caso più pesante (26.759 punti nella vista 5) è gestibile in SVG; se non lo
fosse, canvas per la nuvola e SVG per gli assi e l'evidenziazione — decisione
da prendere in fase P3 con misura alla mano, non a priori.

Sul colore (lezione 060): famiglia = nominale → colormap categoriale entro
il limite di distinguibilità; tasso = quantitativo senza zero significativo
→ sequenziale, colorblind-safe.

Sulle serie temporali (lezione 100): la vista 3 è una striscia di eventi
puntuali, non una serie continua — la scelta va motivata all'esame proprio
così (gli eventi sono rari e discreti, una linea suggerirebbe continuità
che non esiste).

Perché non un grafo (lezioni 150-250): i dati sono tabellari, temporali e
geografici, non relazionali; la scelta discende dalla task abstraction.

## 9. I casi dimostrativi

Non più "3 gare-caso" ma **tre dimostrazioni da 30 secondi** per il
ricevimento e per l'esame, scelte perché coprono i tre modi di usare lo
strumento:

1. **La domanda mirata** (vista 2): *"quante volte si è vinto partendo
   10° o peggio?"* → 37 su 1114, l'ultima San Paolo 2024
   (Verstappen dalla 17ª). Poi si alza la
   soglia a 15 (8 volte) e a 20 (una sola volta, Watson a Long Beach 1983): la
   rarità che si vede muovendo uno slider. (Le prime stime, 40 su 1125 e 9
   a soglia 15, contavano anche la 500 Miglia: `docs/CATALOGO-EVENTI.md`.)
2. **La domanda che non sapevi di avere** (vista 6): si apre una gara e si
   legge il fatto più notevole che il sistema ha trovato da solo.
3. **Il limite dichiarato** (vista 1 + `/methodology`): due eventi con
   rarità simile ma finestre diverse, e perché non si possono confrontare.
   È la dimostrazione che il progetto sa cosa non può dire — la risposta
   pronta alla domanda più pericolosa dell'esame.

Fatti già verificati sui dati, disponibili come materiale per le demo (fonte:
`docs/CATALOGO-EVENTI.md`): margine sotto un decimo 5 volte in 75 anni (la
più stretta Monza 1971, 0,010s); vittoria conquistata solo all'ultimo giro
6 volte dal 1996, l'ultima Abu Dhabi 2021; tripletta 1-2-3 ferma al 1961;
38 cause di ritiro con 5 o meno occorrenze in 75 anni; gli americani non
vincono dal 1978.

## 10. Rischi noti e come li gestiamo

1. **"È solo un motore di ricerca di curiosità".** È il rischio principale
   e si combatte con tre cose, tutte già nel progetto: la rarità
   quantificata (non l'aneddoto), la finestra dichiarata (non l'assoluto
   vago), il generatore automatico (non solo ricerca ma proposta). Da
   dichiarare in apertura, non da nascondere.
2. **Il catalogo troppo piccolo.** Se gli eventi implementati sono 5, la
   vista 1 è vuota e il generatore banale. Soglia minima: **20 eventi in
   almeno 5 famiglie** entro la fase E2, tutti già verificati in
   `docs/CATALOGO-EVENTI.md`.
3. **Le trappole dei dati (§5.6) trattate come dettagli.** Se il filtro
   Indy non c'è, il primo record che il professore controlla è sbagliato.
   Il filtro è un requisito della fase E1, non una rifinitura.
4. **Il peso della vista 5** (26.759 punti in SVG). Da misurare in E3, con
   il piano B (canvas) già deciso.
5. **La dispersione**: 75 anni di dati invitano a fare tutto. Il perimetro
   è il catalogo, e il catalogo si chiude alla fine di E2.
6. **Il lavoro v2 dimenticato.** La famiglia neutralizzazioni va davvero
   collegata (vista 7), altrimenti settimane di lavoro validato spariscono
   dalla relazione. Task esplicito in E3.
7. **Codice morto ereditato**: `export_frontend.py` e
   `app/api/routes/sessions.py` chiamano ancora la vecchia firma di
   `calculate_pit_cost` e sono rotti (eredità v2, rischio #4 di allora).
   Da rimuovere in E4.

## 11. Divisione del lavoro

Persona **A** — dati e motore di eventi: catalogo, `build_events.py`,
trappole, rarità e notevolezza, numeri per la relazione.

Persona **B** — viste principali: scala della rarità (1), compositore (2),
piano griglia×arrivo (5).

Persona **C** — viste secondarie e racconto: striscia storica (3), mappa
(4), scheda gara (6), reinquadramento del capitolo neutralizzazioni (7),
`/methodology`, testi.

Milestone che de-rischia tutto (fine fase E1): il motore valuta 6 eventi
di famiglie diverse e i conteggi coincidono con quelli di
`docs/CATALOGO-EVENTI.md`, **con le trappole applicate**. Se non
coincidono, ci si ferma e si sistema prima di andare avanti.

---

## 12. Appendice — la metrica delle neutralizzazioni (eredità v2)

Questa sezione conserva integralmente il modello della v2, che resta valido
e implementato: alimenta la famiglia "neutralizzazioni" del catalogo (§5.5)
e la vista 7. Serve per la relazione e per l'esame; non è materiale morto.

### 12.1 Quanto costa davvero un pit stop

Il costo di un pit stop non è la durata in pit lane. Per un pit al giro L:

    costo effettivo = (giro di entrata L − riferimento(L))
                     + (giro di uscita L+1 − riferimento(L+1))

Il riferimento cambia secondo le condizioni: in condizioni normali è la
**baseline personale** del pilota (mediana dei suoi giri puliti in una
finestra di ±5 giri, esclusi i giri di entrata/uscita di qualsiasi suo pit,
con allargamento allo stint se restano meno di 3 giri); sotto
neutralizzazione è il **ritmo del gruppo** in quello stesso giro (mediana di
chi ha percorso quel giro senza fermarsi, minimo 3 piloti).

Questa distinzione non è un dettaglio: con la sola baseline personale, la
validazione su Singapore 2023 dava sconti negativi di 60-100 secondi per i
pit sotto Safety Car, perché sotto SC rallenta tutto il gruppo e il calcolo
scambiava il rallentamento imposto a tutti per costo del pit.

Due correzioni trovate facendo girare la pipeline su tutte le 46 gare:
le **bandiere rosse** gonfiavano il costo a migliaia di secondi (152 giri su
46 gare superano i 240 secondi, in 8 gare con bandiera rossa documentata) —
risolto escludendo dal calcolo del tempo, ma non della posizione, i giri
sopra `MAX_PLAUSIBLE_LAP_MS = 240000`; e i pit **senza riferimento di gruppo
affidabile** (quando quasi tutti si fermano insieme restano meno di 3 piloti
puliti) ora si **scartano** invece di ripiegare sulla baseline personale —
110 pit su 1737 (6,3%), con flag `lowConfidence`. Dopo la correzione la
mediana sotto SC scende a 15,5s contro i 22,5s del verde: lo sconto atteso.
Limite dichiarato e non risolto: sotto VSC (finestre di 1-2 giri) i numeri
restano meno puliti, perché l'allineamento per giro intero non cattura in
che punto del giro è scattata la neutralizzazione.

### 12.2 Prezzo di listino, sconto, etichette

**Prezzo di listino** di una gara: mediana dei costi effettivi dei pit in
bandiera verde di quella gara (se meno di 4, mediana della stessa pista
sulle due stagioni). **Sconto** = prezzo di listino − costo effettivo.

**Etichetta di ogni pit** (che è anche il suo colore): GREEN, UNDER_VSC,
UNDER_SC, JUST_BEFORE (fino a 3 giri prima: i "fregati"), JUST_AFTER (entro
2 giri dopo), più il flag `double_stack`.

**Esito di ogni pilota per ogni neutralizzazione:** EXPLOITED, FULL_PRICE,
LOCKED_OUT (gomme sotto gli 8 giri o rientro dietro ad almeno 3 auto),
NOT_NEEDED, NEUTRAL. Le soglie (8 giri, 3 auto) sono parametri dichiarati in
`/methodology`.

### 12.3 Il modello della decisione e il suo esito negativo

La v2 aveva costruito uno **snapshot della decisione** per pilota ×
neutralizzazione (posizione, gap, età e mescola gomme, soste fatte, quota
del gruppo che si ferma, sorpassabilità e caoticità del circuito) e le due
opzioni quantificate (BOX: costo atteso e posizione di rientro prevista;
STAY: posizione conservata e costo differito).

**Risultato onesto dello spike, da conservare:** nessuna coppia di assi
mostra una separazione visibile tra decisioni che hanno pagato e no. Le
correlazioni misurate con l'esito a 5 giri: traffico 0,28, margine dietro
0,18, età gomme ≈ 0, sorpassabilità −0,10. Un indice combinato con pesi
dichiarati (0,6 × z(traffico) + 0,4 × z(margine dietro)) arriva a 0,34-0,36,
stabile su due metà casuali del campione, con distribuzioni di medie diverse
(0,95 vs 0,45) ma fortemente sovrapposte. La verifica in letteratura
conferma che chi risolve davvero questo problema usa deep learning su
telemetria o reinforcement learning: due variabili e un grafico 2D non
bastano, ed è corretto dirlo invece di fingere un confine che non c'è.

Nel frame della v3 questo risultato negativo **non è più un problema**: era
fatale quando la tesi del progetto era "ti aiutiamo a decidere", non lo è
per uno strumento descrittivo che lo riporta come limite misurato. È anzi
un'ottima risposta all'esame sulla differenza tra descrivere e predire.

### 12.4 Pipeline v2 (invariata)

`data-layer/scripts/build_all.py` produce, per le 46 gare 2023-2024:
`public/data/index.json`, `races/<anno>-<circuitRef>.json` (~100-135 KB),
`aggregate.json` (389 KB, 1658 pit), `params.json`. L'aggancio
Ergast↔OpenF1 avviene per data (tolleranza ±1 giorno) e per numero di giro
(i messaggi di race control di OpenF1 includono già `lap_number`).
