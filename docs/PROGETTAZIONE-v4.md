# Déjà vu — Documento di progettazione (v4)

Progetto per il corso di Visualizzazione delle Informazioni. Gruppo di 3.
Visualizzazione interattiva in D3.js su dati reali di Formula 1 (Ergast,
1950-2024, 1125 gare, 26.759 risultati, 589.081 tempi sul giro).

Data: 11 settembre 2026, allineato al codice il 14 settembre 2026 (dopo le
rifiniture D7.2–D7.8 di `docs/ROADMAP-7.md`). Questa versione **sostituisce**
la v3 ("È già successo?") nel concetto, nell'interfaccia e nel nome. I dati,
la pipeline e le viste v3 non si buttano (regola d'oro del progetto): vengono
riletti dentro lo schema nuovo, spiegato in §10.

---

## 1. Perché una v4

La v3 rispondeva alla domanda giusta ("quante volte e dove è successo?") con il
vocabolario sbagliato. Il telecronista poteva scegliere solo tra **33 eventi
precalcolati** ("Vittoria partendo dalla N° posizione o peggio", "Doppietta")
e non poteva dire la cosa più semplice che gli capita davanti: *questo pilota,
partito quinto, è arrivato secondo a Monza*. La ricerca (roadmap S) era stata
costruita sopra quel catalogo, con la regola "nessun dato nuovo": è diventata
un compositore di etichette, non un motore che ricostruisce un fatto.

La v4 sposta il centro di gravità **dal catalogo ai dati**: il fatto si
descrive con una frase a slot, si valuta sul momento sulla tabella dei
risultati, e i casi simili si ottengono allentando uno slot alla volta, in
modo dichiarato. Il catalogo dei 33 eventi resta, come vocabolario dei fatti a
livello di gara.

## 2. Il problema, l'utente, la decisione

**Utente.** Il telecronista o il giornalista di Formula 1 in diretta. Ha
davanti un fatto appena accaduto e **pochi secondi** per decidere se dirlo e
come inquadrarlo: "è la prima volta?", "quando era già successo?", "è successo
a lui altrove, o qui ad altri?".

**Problema.** Le fonti esistenti (albi d'oro, siti di statistiche, Wikipedia)
danno record già confezionati: non permettono di *comporre* la condizione che
serve adesso, non dicono su quale finestra di dati la risposta vale, e non
mostrano i casi *quasi* uguali, che sono quelli che fanno il racconto ("non era
mai successo a Monza, ma lui l'aveva già fatto due volte altrove").

**Decisione supportata.** Editoriale: *questo fatto merita di essere detto, e
con quale frase?* Non predittiva, non causale. Puramente descrittiva.

**Domanda di ricerca.** *Quello che ho appena visto è già successo? Dove,
quando, a chi — e cosa cambia nei casi che gli somigliano?*

## 3. Il modello concettuale: la situazione

Una **situazione** è una frase con quattro slot:

| Slot | Contenuto | Vuoto significa |
|---|---|---|
| **Chi** | un pilota, oppure un team | chiunque |
| **Cosa** | uno o più *fatti* (§4) | — (obbligatorio, almeno uno) |
| **Dove** | un circuito, oppure un paese | ovunque |
| **Quando** | un anno, un decennio, o un'era regolamentare | sempre |

Esempio: *Hamilton · vince partendo 10° o peggio · a Monza · sempre*.

La situazione è **un predicato**: ogni slot pieno è una condizione. Il motore
la valuta contro l'universo delle unità (risultato pilota×gara, oppure gara) e
restituisce un conteggio: **N volte su M**, dove M è l'universo ristretto agli
slot di contesto (le gare a Monza sono 74, non 1114) e alla finestra di
copertura dei campi coinvolti (§5).

### 3.1 I déjà vu: la similarità come reticolo di rilassamenti

I "casi simili" non escono da un punteggio opaco. Ogni slot pieno si può
**allentare** in un modo dichiarato, uno scalino alla volta:

| Slot | Allentamento di grado 1 | Grado 2 |
|---|---|---|
| Chi = pilota | chiunque (un solo grado: "lo stesso team" è ambiguo, un pilota cambia team nel tempo — deciso in D2.2) | — |
| Chi = team | chiunque | — |
| Dove = circuito | lo stesso paese | ovunque |
| Quando = anno | lo stesso decennio | sempre |
| Cosa, parametro numerico | ±1 (es. "partito 9°-11°") | ±2 |
| Cosa, fatto in più | si toglie il fatto | — |

Il risultato è un reticolo: al vertice la situazione esatta (distanza 0), poi
tutte le situazioni con un solo slot allentato, poi con due (al massimo due
slot toccati; "togliere un fatto" si fa solo da solo, perché combinato con
altro produce gruppi senza significato — regole fissate in D2.2 leggendo il
primo output reale). La distanza è **un conteggio di allentamenti**, con pesi dichiarati in
`params.json` (allentare "chi" pesa più di allentare "quando": un pilota è più
specifico di un decennio). È la stessa filosofia difesa in v3, resa esplicita
per slot invece che per chip: le differenze non le spieghiamo noi, **sono
letteralmente lo slot che cambia**, e il nome dello slot è scritto accanto a
ogni gruppo.

Gruppi che l'utente vede, nell'ordine:

1. **Uguale** — tutti gli slot reggono.
2. **Stesso fatto, altro pilota** (o team) — "chi" allentato.
3. **Stesso fatto, altro circuito** — "dove" allentato.
4. **Stesso fatto, altra epoca** — "quando" allentato.
5. **Quasi** — parametro numerico entro la tolleranza dichiarata.
6. Combinazioni di due allentamenti, in un solo gruppo "più lontani".

Il gruppo vuoto **si disegna** ("mai successo"), non si nasconde: il "mai" è la
risposta più preziosa per chi commenta.

## 4. I fatti: il vocabolario del motore

Un fatto è un predicato con al più un parametro, valutato su una colonna della
**tabella dei risultati** (una riga per pilota×gara) o della **tabella delle
gare**. Non è precalcolato per valore: si calcola sul momento, in memoria, nel
browser (§6). Ogni fatto dichiara la finestra dei campi da cui dipende.

Il vocabolario implementato (`src/lib/situazioni/fatti.ts`) conta **48
fatti**: 37 sul risultato e 11 sulla gara, divisi in 9 famiglie (come finisce,
come parte, se non finisce, qualifica e giro veloce, contro il compagno,
momenti di carriera, cosa fa in gara, soste, com'è la gara). Le tabelle qui
sotto ne danno i tipi, non l'elenco completo: fa fede il file.

**Fatti sul risultato (unità: pilota×gara):**

| Fatto | Parametro | Colonne | Finestra |
|---|---|---|---|
| vince / sul podio / a punti | — | arrivo | 1950-2024 |
| arriva P / arriva P o meglio / P o peggio | P | arrivo | 1950-2024 |
| parte P / P o meglio / P o peggio / dalla pole / dalla pit lane / prima fila | P | griglia | 1950-2024 |
| guadagna almeno N posizioni / perde almeno N | N | griglia, arrivo | 1950-2024 |
| si ritira / per incidente / per guasto (tassonomia v3) / entro il giro L / non prende il via | L | stato, giri | 1950-2024 |
| va a punti / al GP numero N in carriera | N | punti, contatori di carriera | 1950-2024 |
| giro veloce | — | rank giro veloce | 2004-2024 |
| batte il compagno / battuto dal compagno | — | arrivo compagno | 1950-2024 |
| primo GP / vince al debutto / prima vittoria / primo podio / prima pole | — | contatori di carriera | 1950-2024 |
| guadagna almeno N posizioni al via | N | posizione dopo il giro 1 | 1996-2024 |
| al comando al giro L / guida almeno N giri / vince senza mai guidare prima dell'ultimo giro | L, N | posizioni per giro | 1996-2024 |
| rimonta dalla posizione P (peggiore in gara) al podio | P | posizioni per giro | 1996-2024 |
| fa N soste / sosta al giro L o prima | N, L | soste | 2011-2024 |
| in qualifica P o peggio (Q1/Q2 non distinte: la tabella porta solo la posizione finale) | P | qualifiche | 1994-2024 |

**Fatti sulla gara (unità: gara)** — qui rientrano i 33 eventi v3, riletti:
doppietta, tripletta, nessun cambio di leader, almeno N leader diversi,
cambio di leader all'ultimo giro, meno di N classificati, nessun ritiro,
almeno N ritiri, margine sotto S secondi, margine sopra S secondi, almeno N
neutralizzazioni (2023-2024). Sono 11. Il parametro S è in secondi interi: "vinta
con meno di un decimo" non si può chiedere (limite dichiarato).

Una situazione può contenere più fatti sul risultato (si applicano allo stesso
pilota, nella stessa gara) e più fatti sulla gara (contesto). L'ambiguità
"stesso pilota / stessa gara" della v3 **sparisce per costruzione**: i fatti
sul risultato sono sempre sullo stesso "chi", quelli sulla gara sono sempre
contesto.

## 5. La regola d'oro: ogni numero porta la sua finestra

Ereditata dalla v3 e resa più severa. Il denominatore M è:

- l'universo dell'unità, Indy 500 esclusa (gare: 1114; risultati: 26.354),
  ristretto a
- gli slot di contesto (dove, quando, chi), ristretto a
- l'**intersezione delle finestre** dei fatti coinvolti (un fatto sulle soste
  porta tutto a 2011-2024), ristretto a
- le righe in cui ogni fatto è **valutabile**: un fatto risponde vero, falso o
  null (dato mancante), e le righe null escono dal denominatore e si contano a
  parte. Per questo un fatto che usa griglia e arrivo lavora di fatto sui
  15.518 risultati in cui entrambi sono noti.

L'unità in cui M si legge (decisa in D2.1, in cima a `motore.ts`): con chi =
pilota "gare del pilota"; con chi = team "risultati del team"; senza chi e con
un fatto che in una gara regge per una riga sola (vince, pole, giro veloce)
"gare"; senza chi altrimenti "risultati"; con soli fatti sulla gara "gare".

La finestra si stampa accanto al numero, sempre, mai in tooltip, e la barra
del tempo (§7.3) la mostra come banda: ciò che è fuori finestra è grigio,
"non sappiamo", non "non è successo". Le cinque trappole dei dati v3 (Indy
500, ritiro ≠ non partito, campi vuoti, griglia 0, punti non comparabili)
restano in vigore, documentate in /metodologia.

## 6. Architettura dati

Sito statico, nessun backend a runtime. La pipeline Python produce due tabelle
colonnari (stesso schema di `results-plane.json`) più i dizionari:

- `situazioni/risultati.json`: 26.759 righe × 21 colonne spedite (gara per
  differenza, pilota, team, griglia, pit lane, arrivo, ordine, categoria di
  stato, statusId, giri, rank del giro veloce, distacco in decimi, posizione
  dopo il giro 1, giri al comando, primo giro al comando, posizione
  peggiore/migliore, soste, giro della prima sosta, posizione in qualifica,
  punti). **Misurato: 1.858 KB grezzi, 177 KB gzip** (la stima iniziale era
  ~80 KB). Le colonne *derivabili* — GP in carriera, vittorie/podi/pole prima
  della gara, vittorie sul circuito prima, ordine del compagno — non si
  spediscono: il motore le ricalcola alla decodifica (D1.1).
- `situazioni/gare.json`: 1125 righe (anno, round, circuito, paese, Indy,
  partiti, classificati, ritiri, doppietta, tripletta, margine, cambi di
  leader, leader diversi, cambio all'ultimo giro, neutralizzazioni), 17 KB gzip.
- `situazioni/tracce/<raceId>.json`: posizioni per giro di tutti i piloti di
  una gara (544 gare, 1996+, 2,7 MB in tutto), caricato **a richiesta** per il
  ritratto (§7.5) e per il giro per giro della scheda gara (§7.6).
- `situazioni/dizionari.json`: 861 piloti, 211 team, 77 circuiti con sinonimi
  per il parser (§7.1), 26,5 KB gzip.
- `situazioni/status.json`: le 139 cause di ritiro Ergast in italiano (133
  tradotte), per la scheda gara.

Prestazioni misurate: decodifica 20 ms, una valutazione ~1 ms, un reticolo
(15 gruppi) 12-14 ms.

Il motore (`src/lib/situazioni/`) è TypeScript puro, nel browser: filtra le
colonne, conta, costruisce il reticolo. Uno script di verifica con conteggi
fatti a mano in Python (come `verify-s22.ts` in v3) è parte della consegna:
ogni fase della roadmap ha i suoi numeri attesi scritti nel codice.

## 7. Le viste (what / why / how, Munzner)

Mantra di Shneiderman: la frase è l'*overview* della domanda; la linea del tempo
è l'*overview* della risposta; i gruppi filtrano; il ritratto è il *detail on
demand*.

### 7.1 La frase (input)

**Cosa:** quattro slot in linea, che si leggono come una frase italiana.
**Perché:** in diretta non c'è tempo per tre livelli di menu; la frase è già il
modo in cui il telecronista pensa il fatto, e rileggerla è il controllo che ha
chiesto la cosa giusta.
**Come:** HTML/CSS (nessuna scala, nessun asse: non è una vista D3). Ogni slot
apre un menu con completamento; il parametro numerico si digita nello slot
("10° o peggio"). Il menu mostra **tutte** le scelte, non le prime dodici:
intestazioni di gruppo appiccicate in alto mentre si scorre (Circuiti/Paesi,
Ere/Decenni/Stagioni, Piloti/Team, con "mostra tutti" per gli elenchi da
centinaia di nomi). Lo slot "Cosa" fa eccezione con **due passaggi**: 48 fatti
in una lista sola non si leggono, quindi il menu si apre sulle nove famiglie
("Come finisce", "Se non finisce", "Soste"…) e scende dentro quella scelta —
ma appena si scrive i due livelli spariscono e si cerca in tutto il
vocabolario, perché chi sa già la parola non deve indovinare la famiglia. Il
principio di partenza ("in diretta non c'è tempo per tre livelli di menu")
regge: il cammino più lungo resta di due clic, e chi digita ne fa zero. Sopra, **una barra di testo libero** che riempie gli slot con
un parser deterministico a dizionari (cognomi, circuiti, verbi, ordinali:
"hamilton vince monza dalla decima" → i quattro slot). Nessun modello, nessun
LLM: le regole sono leggibili in un file. L'utente vede gli slot riempirsi e
corregge quello sbagliato con un click.

### 7.2 La risposta

**Cosa:** un numero grande ("2 volte su 74 gare a Monza"), la finestra, e la
frase in chiaro riletta dal motore.
**Perché:** è l'unica cosa che si legge in tre secondi.
**Come:** tipografia; il numero è rosso solo qui, nel resto della pagina il
rosso non compare (il colore d'accento ha un solo significato: la risposta
esatta).

### 7.3 La linea dei déjà vu (vista portante, D3)

**Cosa:** x = tempo 1950-2024; una riga per gruppo (§3.1); un punto per
occorrenza. Colore = **lo slot che cambia** (variabile nominale: rosso per
"uguale", poi chi, dove, quando, cosa; i gruppi a due allentamenti sono fusi in
un'ultima riga grigia "cambiano due slot"). La riga "uguale" in alto,
enfatizzata; una riga vuota resta disegnata con la scritta "mai successo". La
banda grigia fuori finestra dice dove i dati non arrivano.
**Perché:** risponde a "quando" e "quanto è lontano" con una sola occhiata;
la posizione verticale codifica la distanza (ordinale), il colore la natura
della differenza (nominale). La rarità è sulla posizione, mai sulla tinta
(regola v3 confermata).
**Come:** D3 possiede l'SVG (scale, assi, data join, brush sul tempo,
transizioni quando uno slot cambia: i punti *migrano* tra le righe invece di
ridisegnarsi, così si vede cosa un allentamento sposta). Hover: anno, gara,
pilota, e lo slot che cambia in chiaro. Click: apre la scheda della gara
(§7.6). Brush: i punti fuori dal periodo sbiadiscono e ogni riga scrive "k nel
periodo · n su m"; il denominatore resta quello della finestra piena (scelta
dichiarata sotto la vista: il brush esplora, per cambiare l'universo si usa lo
slot Quando). Jitter verticale deterministico dentro la riga; x esatto.

### 7.4 I dove (D3, geografica)

**Cosa:** i circuiti in cui la situazione è capitata, con il tasso
normalizzato per quante gare ha ospitato ognuno.
**Perché:** "è successo ma non qui" ha bisogno di una mappa; la
normalizzazione evita il trabocchetto "Monza ha più casi perché ha più gare".
**Come:** riuso di `DoveMappa.tsx` (v3) collegata al reticolo: cliccando un
circuito lo slot "dove" si riempie e la frase si aggiorna. Contorno delle terre
emerse (Natural Earth 1:110m, `world-land.json`) sotto una proiezione
equirettangolare adattata ai circuiti; alternativa a barre ordinate;
interruttore conteggio ↔ tasso. Raggio = conteggio grezzo, colore = scala
sequenziale sulla metrica scelta: è l'unica vista dove il colore è
sequenziale, come già dichiarato in v3.

### 7.5 Il ritratto dell'occorrenza (D3, small multiples)

**Cosa:** per ogni occorrenza, la traccia della posizione giro per giro del
pilota (1996+), con griglia e arrivo evidenziati; per le gare senza tempi sul
giro, solo griglia → arrivo.
**Perché:** il telecronista non vuole solo "è successo nel 2020": vuole vedere
*come* (Gasly a Monza 2020: partito 10°, 15° al giro 20, primo dal giro 28
dopo la bandiera rossa). I ritratti affiancati sono il confronto: stesse scale,
stessa forma.
**Come:** small multiples con scale condivise (y = posizione 1..20, le
posizioni oltre la 20ª restano sul bordo; x = giro normalizzato 0-100%); i dati
arrivano dal file per gara a richiesta. Ogni ritratto è un link vero
(`<a href>`) alla scheda gara, così funziona anche prima dell'idratazione.

### 7.6 La scheda gara (riscritta in D7.7)

**Cosa:** per una gara qualsiasi delle 1125: testata (circuito, data, giri, al
via, classificati, ritiri), podio con casella di partenza e distacco, pole e
giro veloce, "la gara in numeri" (margine, ritiri, piloti e cambi al comando,
soste medie, safety car), **la gara giro per giro** (D3, tracce 1996+, podio in
evidenza e le altre linee grigie), **griglia → arrivo** (slopegraph, per tutte
le gare), ordine d'arrivo completo, "quel giorno, per la prima volta" (debutti,
prime vittorie, primi podi, prime pole), e **"l'hai già visto?"**: domande già
scritte negli slot che riaprono la home con la frase compilata. Link al
capitolo neutralizzazioni per le 46 gare 2023-2024.
**Perché:** dettaglio a richiesta di un caso, e ingresso per chi non sa cosa
chiedere. La prima versione mostrava i fatti notevoli del catalogo v3
(statistiche globali ordinate per notevolezza) e non diceva nemmeno chi avesse
vinto: sostituita. Il generatore v3 resta nella pipeline
(`public/data/facts/`) ma nessuna pagina ne mostra più l'output.
**Come:** pagina server che estrae una sola gara dalle tabelle delle situazioni
(`schedaGara.ts`, puro) e manda al browser una ventina di righe. Il giro per
giro è D3; lo slopegraph è SVG scritto da React (due colonne di posizioni e
segmenti, nessuna scala da gestire né transizione: stessa deroga dei riquadri
v3). Cause di ritiro in italiano da `status.json`.

### 7.7 Esplora (esistente)

Le tre viste v3 (scala della rarità, riquadri per famiglia, fiume delle
famiglie) restano in /esplora come panoramica del vocabolario dei fatti sulla
gara. Nessuna modifica. Da /esplora si raggiungono anche il compositore a chip
v3 (`/scenari`) e le schede evento (`/eventi/[id]`).

### 7.8 Le gare (D7.8)

`/gare`: una stagione alla volta (anno nell'indirizzo), ogni riga con data e
vincitore, ricerca su gara, circuito, paese, anno, vincitore e team in tutte
le stagioni, con completamento della parola a Tab. È navigazione, non una
visualizzazione: HTML, niente D3.

## 8. Interazione (Yi et al.) e task (Amar et al.)

- *Select*: click su punto/ritratto/circuito. *Explore*: brush sul tempo.
  *Reconfigure*: mappa ↔ barre; l'ordine dei gruppi segue la distanza (pesi in
  `params.json`), ed è l'intento più debole della v4. *Encode*: conteggio ↔
  tasso sulla mappa; il colore per slot invece è fisso, senza interruttore (la
  coerenza vale più della scelta). *Abstract/Elaborate*: frase → linea →
  ritratto → scheda gara. *Filter*: ogni slot è un filtro; la mappa filtra
  "dove". *Connect*: la frase, la linea, la mappa e i ritratti sono collegati
  (colore condiviso, clic sulla mappa che riempie Dove), e la scheda gara
  riapre la home con la frase compilata.
- Task: *retrieve value* (N su M), *filter* (slot), *find extremum* ("la
  rimonta più lunga"), *characterize distribution* (la linea dei déjà vu),
  *cluster* (i gruppi del reticolo), *correlate* (griglia × arrivo, in
  /esplora).

## 9. Identità visiva

Nome: **Déjà vu**. Sottotitolo: *l'hai già visto? — 75 stagioni di Formula 1*.
Il nome dice esattamente cosa fa lo strumento e sopravvive alla traduzione.

- **Fondo scuro** (grafica da regia televisiva, contesto d'uso reale), ma
  blu-nero (#0B0C10), non nero puro; pannelli #14161C; testo #ECEDEF; testo
  secondario #8A8F9C.
- **Rosso corsa (#E10600) con un solo significato:** la risposta esatta e il
  gruppo "uguale". Mai su bottoni, mai su link, mai su titoli.
- **Colore degli slot** (nominale, palette Tol "muted" già validata in v3 per
  daltonismo): chi = verde acqua #44AA99, dove = ciano #88CCEE, quando = rosa
  antico #CC6677, cosa = oliva chiaro #B8B04A (l'oliva Tol #999933 aveva
  contrasto 4,2:1 sul fondo scuro, schiarito in D7.1). Lo stesso colore sullo slot nella
  frase, sulla riga nella linea dei déjà vu, sul bordo del ritratto: **il
  colore lega la differenza al suo slot** in tutte le viste. Le famiglie v3
  restano colorate a modo loro solo in /esplora.
- **Tipografia:** Barlow Condensed (titoli e numeri, già nel progetto: le cifre
  condensate sono quelle dei tabelloni di gara), Inter per il testo, cifre
  tabulari ovunque ci sono colonne.
- **Layout:** una colonna, 1100 px; la frase è l'apertura (non un titolo
  gigante); risposta; linea dei déjà vu a tutta larghezza; gruppi con i
  ritratti sotto; mappa in fondo. Niente card ovunque: bordi e riempimenti
  solo dove separano un oggetto (il ritratto).
- **Movimento:** una sola animazione con significato, la migrazione dei punti
  tra righe quando uno slot cambia. `prefers-reduced-motion` la spegne.

## 10. Cosa resta della v3 e come

| v3 | v4 |
|---|---|
| 33 eventi precalcolati | fatti sulla gara, dentro lo slot "cosa" |
| chip evento/pilota/team/circuito/era | slot chi/cosa/dove/quando |
| cascata K su K | reticolo di rilassamenti per slot |
| scaffale delle corrispondenze | linea dei déjà vu (righe = gruppi, colore = slot) |
| scala/riquadri/fiume | /esplora, invariati |
| mappa dei circuiti | §7.4, collegata alla frase |
| scheda gara con fatti notevoli (notevolezza) | §7.6, riscritta: racconta la gara dalle tabelle v4; il generatore v3 resta nella pipeline ma non si mostra |
| compositore a chip | /scenari, invariato |
| capitolo neutralizzazioni 2023-2024 | fatto sulla gara con finestra 2023-2024, e /race/[id] invariato |
| regola della finestra, 5 trappole, D3 possiede l'SVG | invariate |

## 11. Cosa il progetto non è

Non predice, non spiega, non giudica. Non usa modelli: ogni numero è un
conteggio e ogni "simile" è uno slot allentato con il nome scritto accanto.
Non copre ciò che i dati non coprono, e lo dice sullo schermo.
