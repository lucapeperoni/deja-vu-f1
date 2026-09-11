# Déjà vu — Documento di progettazione (v4)

Progetto per il corso di Visualizzazione delle Informazioni. Gruppo di 3.
Visualizzazione interattiva in D3.js su dati reali di Formula 1 (Ergast,
1950-2024, 1125 gare, 26.759 risultati, 589.081 tempi sul giro).

Data: 11 settembre 2026. Questa versione **sostituisce** la v3 ("È già
successo?") nel concetto, nell'interfaccia e nel nome. I dati, la pipeline e
le viste v3 non si buttano (regola d'oro del progetto): vengono riletti dentro
lo schema nuovo, spiegato in §9.

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

**Fatti sul risultato (unità: pilota×gara):**

| Fatto | Parametro | Colonne | Finestra |
|---|---|---|---|
| vince / sul podio / a punti | — | arrivo | 1950-2024 |
| arriva P / arriva P o meglio / P o peggio | P | arrivo | 1950-2024 |
| parte P / P o meglio / P o peggio / dalla pole / dalla pit lane / prima fila | P | griglia | 1950-2024 |
| guadagna almeno N posizioni / perde almeno N | N | griglia, arrivo | 1950-2024 |
| si ritira / per causa X (tassonomia v3) / al giro L o prima | X, L | stato, giri | 1950-2024 |
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
vittoria all'ultimo giro, meno di N classificati, nessun ritiro, margine
sotto S secondi, almeno N neutralizzazioni (2023-2024), ecc.

Una situazione può contenere più fatti sul risultato (si applicano allo stesso
pilota, nella stessa gara) e più fatti sulla gara (contesto). L'ambiguità
"stesso pilota / stessa gara" della v3 **sparisce per costruzione**: i fatti
sul risultato sono sempre sullo stesso "chi", quelli sulla gara sono sempre
contesto.

## 5. La regola d'oro: ogni numero porta la sua finestra

Ereditata dalla v3 e resa più severa. Il denominatore M è:

- l'universo dell'unità (risultati con griglia e arrivo noti: 15.518; gare non
  Indy 500: 1114), ristretto a
- gli slot di contesto (dove, quando, chi), ristretto a
- l'**intersezione delle finestre** dei fatti coinvolti (un fatto sulle soste
  porta tutto a 2011-2024).

La finestra si stampa accanto al numero, sempre, mai in tooltip, e la barra
del tempo (§7.3) la mostra come banda: ciò che è fuori finestra è grigio,
"non sappiamo", non "non è successo". Le cinque trappole dei dati v3 (Indy
500, ritiro ≠ non partito, campi vuoti, griglia 0, punti non comparabili)
restano in vigore, documentate in /metodologia.

## 6. Architettura dati

Sito statico, nessun backend a runtime. La pipeline Python produce due tabelle
colonnari (stesso schema di `results-plane.json`) più i dizionari:

- `situazioni/risultati.json`: 26.759 righe × ~24 colonne (gara, pilota,
  team, griglia, arrivo, ordine, stato, giri, giro veloce, posizione dopo giro
  1, giri al comando, primo giro al comando, posizione peggiore/migliore in
  gara, soste, posizione in qualifica, arrivo del compagno, numero GP in
  carriera, vittorie/podi/pole fin lì). Stima: 300-400 KB grezzi, ~80 KB
  compressi.
- `situazioni/gare.json`: 1125 righe × ~15 colonne (anno, round, circuito,
  paese, classificati, ritiri, cambi di leader, margine, doppietta, ...).
- `situazioni/tracce/<raceId>.json`: posizioni per giro di tutti i piloti di
  una gara (1996+), caricato **a richiesta** per il ritratto (§7.5).
- dizionari piloti/team/circuiti con sinonimi per il parser (§7.1).

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
("10° o peggio"). Sopra, **una barra di testo libero** che riempie gli slot con
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
occorrenza. Colore = **lo slot che cambia** (variabile nominale, 5 valori:
nessuno, chi, dove, quando, cosa). La riga "uguale" in alto, enfatizzata;
una riga vuota resta disegnata con la scritta "mai successo". La banda grigia
fuori finestra dice dove i dati non arrivano.
**Perché:** risponde a "quando" e "quanto è lontano" con una sola occhiata;
la posizione verticale codifica la distanza (ordinale), il colore la natura
della differenza (nominale). La rarità è sulla posizione, mai sulla tinta
(regola v3 confermata).
**Come:** D3 possiede l'SVG (scale, assi, data join, brush sul tempo,
transizioni quando uno slot cambia: i punti *migrano* tra le righe invece di
ridisegnarsi, così si vede cosa un allentamento sposta). Hover: anno, gara,
pilota, e lo slot che cambia in chiaro. Click: apre il ritratto (§7.5).
Brush: restringe la finestra e aggiorna i conteggi, che restano visibili.

### 7.4 I dove (D3, geografica)

**Cosa:** i circuiti in cui la situazione è capitata, con il tasso
normalizzato per quante gare ha ospitato ognuno.
**Perché:** "è successo ma non qui" ha bisogno di una mappa; la
normalizzazione evita il trabocchetto "Monza ha più casi perché ha più gare".
**Come:** riuso di `DoveMappa.tsx` (v3) collegata al reticolo: cliccando un
circuito lo slot "dove" si riempie e la frase si aggiorna. È l'unica vista dove
il colore è sequenziale (tasso), come già dichiarato in v3.

### 7.5 Il ritratto dell'occorrenza (D3, small multiples)

**Cosa:** per ogni occorrenza, la traccia della posizione giro per giro del
pilota (1996+), con griglia e arrivo evidenziati; per le gare senza tempi sul
giro, solo griglia → arrivo.
**Perché:** il telecronista non vuole solo "è successo nel 2020": vuole vedere
*come* (Gasly a Monza 2020: decimo per 18 giri, poi la bandiera rossa, poi
primo). I ritratti affiancati sono il confronto: stesse scale, stessa forma.
**Come:** small multiples con scale condivise (y = posizione 1..20, x = giro
normalizzato 0-100%); i dati arrivano dal file per gara a richiesta. Click sul
ritratto → scheda gara.

### 7.6 La scheda gara (esistente, riletta)

Data una gara, i fatti notevoli generati in automatico, ordinati per
notevolezza (v3). Ogni fatto è ora **una situazione già compilata**: click →
la frase si riempie e si torna al motore. È l'ingresso per chi non sa cosa
chiedere.

### 7.7 Esplora (esistente)

Le tre viste v3 (scala della rarità, riquadri per famiglia, fiume delle
famiglie) restano in /esplora come panoramica del vocabolario dei fatti sulla
gara. Nessuna modifica.

## 8. Interazione (Yi et al.) e task (Amar et al.)

- *Select*: click su punto/ritratto. *Explore*: brush sul tempo. *Reconfigure*:
  l'ordine dei gruppi segue la distanza; i pesi sono in `params.json`.
  *Encode*: il colore per slot è fisso, non c'è un interruttore (la coerenza
  vale più della scelta). *Abstract/Elaborate*: frase → linea → ritratto →
  scheda gara. *Filter*: ogni slot è un filtro; la mappa filtra "dove".
  *Connect*: la frase, la linea, la mappa e i ritratti sono collegati in
  entrambe le direzioni (brushing & linking).
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
  antico #CC6677, cosa = oliva #999933. Lo stesso colore sullo slot nella
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
| scheda gara con fatti | §7.6, ogni fatto è una situazione cliccabile |
| capitolo neutralizzazioni 2023-2024 | fatti sulla gara con finestra 2023-2024 |
| regola della finestra, 5 trappole, D3 possiede l'SVG | invariate |

## 11. Cosa il progetto non è

Non predice, non spiega, non giudica. Non usa modelli: ogni numero è un
conteggio e ogni "simile" è uno slot allentato con il nome scritto accanto.
Non copre ciò che i dati non coprono, e lo dice sullo schermo.
