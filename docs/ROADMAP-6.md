# "È già successo?" — Roadmap "La ricerca" (il compositore di scenari)

Contesto: le roadmap R (riquadri) e T (fiume delle famiglie) hanno aggiunto modi
di **esplorare** il catalogo. Questa roadmap aggiunge la cosa che manca: un modo
di **interrogarlo in fretta**, guidato da uno scenario d'uso preciso.

**Lo scenario.** Un telecronista sta commentando una gara. Succede qualcosa. In
pochi secondi vuole ricomporre l'evento appena visto, sapere se è già successo,
quando, e — soprattutto — vedere i casi *quasi* identici capendo al volo cosa
cambia. Oggi il sito non lo permette: le tre viste di home rispondono a "cosa
c'è nel catalogo", il compositore risponde su **un** evento alla volta, e non
esiste modo di mettere insieme "vittoria da lontano" **+** "sotto Safety Car"
**+** "a Monza".

**Decisioni prese, non da rimettere in discussione a ogni prompt:**

- **Tutto è un "pezzo" (chip) tipizzato.** Cinque tipi: `evento`, `pilota`,
  `team`, `circuito`, `era`. L'ingresso è indifferente — si può partire dal
  soggetto o dall'evento, perché finiscono nella stessa lista di chip e nello
  stesso motore di match. Non si costruiscono due interfacce diverse.
- **Una barra di ricerca testuale in cima, il menu gerarchico sotto.** Il menu
  a macro-aree (stile "Comandi" di iOS: famiglia → evento → parametro) resta,
  ma solo per i chip di tipo `evento` e come modo di **scoprire** cosa si può
  chiedere. Chi sa cosa cerca digita. In diretta tre livelli di menu sono
  troppi: la ricerca testuale è la strada principale, non un extra.
- **La "similarità" NON è un punteggio opaco: è un conteggio di condizioni che
  reggono.** Con K chip, il risultato è una cascata: K su K (identico), K-1 su K
  (quasi, **con il nome del chip che salta scritto in chiaro**), K-2, ecc. Le
  "differenze" non vanno spiegate da noi: sono letteralmente il chip mancante.
  Questa è la difesa all'esame — nessun modello, nessuna black box, stessa
  filosofia descrittiva di tutto il progetto (vedi il fallimento di v2).
- **Se si mostra una percentuale, è una formula dichiarata in `params.json`**,
  accanto ai pesi della notevolezza: quota di condizioni soddisfatte pesate per
  la loro rarità (una condizione rara che regge vale più di una comune). Mai un
  numero che esce da un posto non ispezionabile.
- **Nessuna modifica alla pipeline Python, nessun file dati nuovo.** Verificato
  il 2026-09-01: ogni `public/data/events/<eventId>.json` contiene già, per ogni
  parametro, `occorrenzeDettaglio` con `raceId`, `anno`, `circuitRef`,
  `driverId`/`driverIds`, `constructorId`/`constructorIds`. Sono **17.208 tuple
  in 1,6 MB totali** su 33 eventi: l'intero indice sta in memoria nel browser e
  l'intersezione tra condizioni si fa incrociando `raceId` (e, dove ha senso,
  `driverId`). I soggetti esistono già: `drivers-index.json`,
  `constructors-index.json`, `circuits.json`.
- **Ambiguità "stessa gara" vs "stesso pilota": dedotta, ma dichiarata in una
  frase cliccabile.** Con due chip a livello pilota (`unita: "RISULTATO"`, 21
  eventi su 33) "A + B" può voler dire due cose molto diverse: *nella stessa
  gara* un pilota qualsiasi ha fatto A e un altro B, oppure *lo stesso pilota*
  ha fatto entrambe. Il sistema sceglie il default (stesso pilota, la lettura
  giornalisticamente più forte) ma lo **scrive in chiaro sopra il risultato**,
  con la parte cliccabile per ribaltarla. L'ambiguità non esiste se almeno un
  chip è a livello gara (`unita: "GARA"`).
- **La finestra di copertura si restringe a vista d'occhio.** Intersecare un
  chip Safety Car (2023-2024, 46 gare) con uno di griglia (1950-2024, 1114 gare)
  dà un denominatore reale di 46, non 1114. Il composer mostra la finestra che
  si accorcia **mentre** si aggiungono chip, non dopo. È la regola d'oro del
  progetto (ogni numero porta con sé la sua finestra, visibile e non in
  tooltip), qui applicata al punto in cui è più facile mentire.
- **L'output è visuale, mai una lista di risultati.** Vincolo d'esame: questo è
  un progetto di Visualizzazione delle Informazioni, e "motore di ricerca" può
  suonare come interrogazione a database. Nessuna schermata di questo flusso può
  restituire solo testo. La vista portante è **lo scaffale delle corrispondenze**
  (fase S3): x = tempo 1950-2024, y = quante condizioni reggono, un punto per
  occorrenza passata, colore = famiglia.
- **Diventa la home.** Le tre viste attuali (scala/riquadri/fiume) non si
  buttano — regola d'oro dei pivot di questo progetto: niente si butta —
  ma si spostano in un'area "Esplora il catalogo". La prima pagina diventa il
  compositore.
- **Colore = famiglia**, sempre, come ovunque nel progetto (`familyColor` in
  `src/lib/colors.ts`). La rarità va sulla posizione, mai sulla tinta.
- **D3 possiede l'SVG** (scale, assi, data join, transizioni dentro `useEffect`),
  React fa contenitore/stato — `D3Chart.tsx` come base. Il composer a chip è
  HTML/CSS puro: non disegna scale né assi, quindi non viola la regola del
  corso (stessa motivazione già accettata per `EventCardsGrid`).
- **Responsive dal primo prompt** (`ResizeObserver`, pattern di
  `RarityScale.tsx`), mai una costante `WIDTH` indovinata a mano.
- **Un task = un prompt**, nell'ordine dato. Si legge il diff prima di ogni
  commit. Si lavora su `main`, senza branch.

---

## Avanzamento generale

- [x] Fase S0 — Allineamento e piano dati (nessun codice)
- [x] Fase S1 — L'indice delle occorrenze e il motore di match (S1.1, S1.2 fatti)
- [x] Fase S2 — Il compositore a chip (S2.1, S2.2 fatti)
- [x] Fase S3 — Lo scaffale delle corrispondenze (S3.1 fatto e verificato)
- [x] Fase S4 — La frase in chiaro e la finestra che si restringe (S4.1 fatto)
- [x] Fase S5 — La nuova home e l'area "Esplora" (S5.1 fatto)
- [x] Fase S6 — Rifinitura, accessibilità, verifica finale (S6.1 fatto)

Ordine dei prompt: S0.1 → S1.1 → S1.2 → S2.1 → S2.2 → S3.1 → S4.1 → S5.1 → S6.1.
Prossimo: **roadmap chiusa.**

---

# Fase S0 — Allineamento e piano dati

## S0.1 — Lettura e piano  ✅ FATTO (1 set 2026)

Esito, **verificato a mano sui dati** — decisioni chiuse, non da ridiscutere:

- **Tre forme di `occorrenzeDettaglio`, più una quarta troncata.** La forma NON
  dipende da `unita` ma dalla forma del payload: singolo Result
  (`driverId`/`constructorId`), coppia (`driverId1`/`driverId2`…), lista
  (`driverIds`/`constructorIds`), e payload numerico puro (`valore`, nessun
  pilota). La quarta è il troncamento a 300 KB
  (`_occorrenza_essenziale`, `scripts/build_events.py:135-149`): oggi colpisce
  **solo `ritiro_per_causa_specifica`** (272 KB), che porta `{raceId, driverId}`
  e basta.
- **Tipo comune `NormalizedOccurrence`**: `raceId`, `anno`, `circuitRef`,
  `driverIds: number[]`, `constructorIds: number[]`, `raw`. Liste sempre, anche
  con un elemento; vuote se l'evento non ha soggetti. `anno`/`circuitRef` per le
  occorrenze troncate si risalgono da `races-index.json` via `raceId`.
- **Terzo stato obbligatorio: `non valutabile`.** Le occorrenze troncate perdono
  `constructorId`, quindi un chip `team` su `ritiro_per_causa_specifica` non è
  "non regge": è **non determinabile**. Un chip che non si può valutare NON va
  contato come fallito — falserebbe la cascata K/K-1 dicendo una cosa falsa in
  silenzio. La normalizzazione deve distinguere *campo assente* da *campo vuoto*,
  e la UI lo dichiara.
- **Denominatore composto, regola in tre casi** (motivo: `engine.py:62` calcola
  `denominatore = len(osservazioni(dataset))`, cioè un universo **specifico per
  evento** con le sue esclusioni — due eventi con stessa unità e stessa finestra
  possono avere denominatori diversi):
  1. **Un solo chip evento, niente che restringa** → si usa il `denominatore`
     già precalcolato. Stesso numero della scheda evento, per costruzione.
  2. **Più chip / contesto ristretto** → si ricalcola con la proxy più fedele
     per l'unità più stretta coinvolta, ed è un **limite superiore onesto**, non
     il numero esatto. Va dichiarato in UI che viene dalla proxy.
     - `GARA` → `races-index.json` con `isIndy500 === false` = **1114 gare**
       (verificato: coincide con il denominatore di `vittoria_da_griglia`; ma
       `doppietta` è 1113, quindi la proxy sovrastima di 1 dove l'evento ha
       esclusioni proprie).
     - `RISULTATO` → `results-plane.json` con `griglia` e `arrivo` non nulli =
       **15.518 su 26.354** (verificato: coincide esatto con
       `rimonta_almeno_n_posizioni`).
  3. **`TEAM_GARA` con contesto ristretto → "non calcolabile", dichiarato.**
     Nessun file pubblico porta l'universo coppie team×gara (`doppio_ritiro` ha
     denominatore 11.422, non ricostruibile da `results-plane.json`, che non ha
     `constructorId`). Si dice, non si inventa.
- **`results-plane.json` è colonnare, non un array di righe**: quattro array
  paralleli `{griglia, arrivo, raceId, driverId}` da 26.354 elementi. Si scorre
  per indice.
- **Tipi TypeScript concordati**: `Chip` (unione discriminata sui 5 tipi),
  `ScenarioIndexEntry` (= `NormalizedOccurrence` + `eventId`, `parametri`,
  `famiglia`, `unita`), `ChipMatchResult` (`entry`, `chipsHeld`, `chipsMissed`,
  **`chipsNonValutabili`**, `score`), `ScenarioResult` (`byScore`,
  `finestraIntersecata`, `denominatoreComposto: {valore, fonte:
  "precalcolato" | "proxy" | "non_calcolabile"}`, `joinMode`, `joinModeDedotto`).
- **Confermato: nessuna modifica a `data-layer/` o `scripts/`.** Un roster
  `raceId × driverId × constructorId` risolverebbe il caso 3, ma è fuori scope.

- [x] Prompt eseguito

# Fase S1 — L'indice delle occorrenze e il motore di match

## S1.1 — L'indice in memoria  ✅ FATTO (1 set 2026)

`src/lib/scenarioIndex.ts`: legge lui stesso i 33 file + `races-index.json`,
normalizza le 17.208 occorrenze e mette il risultato in cache a livello di
modulo (nessuna pagina esistente legge già tutte le `occorrenzeDettaglio`,
quindi non c'era un chiamante naturale da cui estrarre i dati a monte come fa
`familyTimeline.ts`).

- [x] Controllo di correttezza: **67 su 67** combinazioni evento×parametro con
      occorrenze, denominatore e rarità identici a `index.json`. Zero `NaN`.
- [x] Occorrenze troncate di `ritiro_per_causa_specifica` ricostruite via
      `races-index.json`.

**Due cose scoperte strada facendo, che S0.1 non aveva visto:**

1. **`driverId` è una stringa numerica** (`"832"`) in 4 eventi ereditati dalla
   pipeline v2 (`pilota_fregato`, `pit_double_stack`,
   `pit_sotto_neutralizzazione`, `pilota_locked_out`). Con un controllo
   `typeof === "number"` finivano in silenzio nel ramo "nessun soggetto".
   Normalizzati con `Number()`.

2. **La regola del "non valutabile" decisa in S0.1 era troppo stretta.** Non è
   vero che solo `ritiro_per_causa_specifica` perde dei soggetti: **4 eventi di
   unità `RISULTATO` non hanno alcun pilota nelle occorrenze** —
   `rimonta_almeno_n_posizioni` (1990), `pilota_con_almeno_n_soste` (550),
   `causa_non_vista_da_anni` (86), `vincitore_con_almeno_n_soste` (85). Con la
   costante `TRUNCATED_EVENT_ID` scritta a mano, un chip "pilota" su una
   *rimonta* avrebbe risposto "non regge" invece di "non lo so" — la bugia
   silenziosa esatta che il terzo stato doveva impedire, e per giunta su uno
   degli eventi più richiesti da un telecronista.

   **Regola corretta, ora nel codice:** soggetto assente + unità che lo implica
   = **perso** (`undefined`, non valutabile); soggetto assente + unità che non
   lo implica = **genuinamente vuoto** (`[]`). `RISULTATO` e `TEAM_GARA`
   implicano pilota e team, `GARA` nessuno dei due.

   Totali risultanti, verificati: **2.711 occorrenze senza pilota**, **10.249
   senza team** (le 4 sopra + `ritiro_per_causa_specifica` + i 4 eventi di pit
   stop, che hanno il pilota ma mai il team), su 17.208.

**Punto chiuso (1 set 2026), era aperto per S2.2:** l'indice serializzato pesa **4,1 MB**
con `raw`, **2,9 MB** senza. Troppo per spedirlo al client così com'è, e la
ricerca deve essere istantanea. Le strade: una codifica compatta colonnare
(come fa già `results-plane.json`), oppure tenere il match sul server. Da
risolvere prima di scrivere la ricerca, non dopo. Nota collegata: sia
`scenarioIndex.ts` sia `scenarioMatch.ts` usano `fs`, quindi sono **solo
server**. Oggi `EventPicker.tsx` (client) importa da `scenarioMatch` solo un
`type`, che sparisce in compilazione — ma basta un import di valore da un
componente client per rompere la build. Da sistemare insieme al peso.

- [x] Prompt eseguito
- [x] Diff letto

## S1.2 — Il motore di match a cascata  ✅ FATTO (1 set 2026)

`src/lib/scenarioMatch.ts`. Il pool di occorrenze candidate è l'unione delle
occorrenze proprie dei chip evento (mai l'intero indice: un chip circuito da
solo non identifica "cosa è successo"). Pesi della similarità in
`params.json` → `eventi.pesiChipContesto`, nessuna costante nel TypeScript.

- [x] Cascata K → 1, con `chipsHeld` / `chipsMissed` / `chipsNonValutabili`
- [x] `joinMode` dedotta ("stesso pilota" solo se tutti i chip evento sono
      RISULTATO) e restituita insieme al default dedotto, per la frase di S4
- [x] Finestra intersecata (verificato: evento di griglia + evento di
      neutralizzazioni → crolla a 2023-2024)
- [x] Livelli `byScore` sempre presenti anche vuoti, così S3 può disegnare una
      riga vuota dichiarata invece di dedurla dall'assenza

**Due bug di conteggio trovati rileggendo il diff, corretti prima del commit:**

1. **Doppio conteggio.** Due chip evento che capitano nella stessa gara
   mettevano nel pool due occorrenze distinte, che nel mondo reale sono un
   fatto solo: `doppietta` + `nessun_cambio_di_leader` dava **60 risultati per
   30 gare**. Il sito avrebbe detto "è successo 60 volte" — cioè avrebbe
   sbagliato l'unico numero che la tesi promette di dare giusto. Ora il pool si
   deduplica sull'unità del join (la gara, o il pilota in quella gara) e le
   copie si fondono: un chip regge se lo prova anche una sola copia, e
   "non valutabile" batte "salta" (un dato che manca non è una smentita).
   Le occorrenze senza pilota noto restano separate invece di essere fuse a
   indovinare.

2. **Il denominatore ignorava i chip di contesto.** Restringeva solo per anno,
   non per circuito/pilota: "vittoria dalla 10° **a Monza**" dava 2 su 15.518
   (**0,013%**) invece di 2 su 1016 (**0,20%**) — sbagliato di ~70 volte, ed
   era già la decisione di S0.1, solo non implementata. Ora `countRaces...` /
   `countResults...` intersecano anche circuito e pilota; **con un chip team il
   denominatore diventa "non calcolabile"** e lo dichiara, perché
   `results-plane.json` non porta `constructorId` (S0.1, caso 3).

Controprove dopo la correzione: 30 risultati / 30 gare distinte; Monza 2 su
1016; chip team → `non_calcolabile`; un chip solo → 37 su 1114, identico a
`index.json`.

- [x] Prompt eseguito
- [x] Diff letto

# Fase S2 — Il compositore a chip

## S2.1 — Il menu a macro-aree  ✅ FATTO (1 set 2026)

`src/components/scenario/EventPicker.tsx` + demo isolata in
`src/app/dev/event-picker-demo/`.

- [x] Una colonna che scende di livello (famiglia → evento → parametro) con
      briciola di pane, mai due colonne affiancate da tenere sincronizzate
- [x] Rarità e finestra mostrate a ogni livello, prima della scelta
- [x] I 14 eventi parametrici scendono al terzo livello, gli altri emettono
      subito; il chip emesso ha già la forma `EventoChip` di `scenarioMatch.ts`
- [x] Verificato nella demo isolata, screenshot mostrato
- [x] Diff letto

## S2.2 — La barra di ricerca e la riga dei chip  ✅ FATTO (1 set 2026)

Dipende da: S2.1

**Decisione presa prima di scrivere il codice: l'indice va al client, in forma
colonnare.** I 2,9 MB misurati in S1.1 erano quasi tutti nomi di campo ripetuti
17.208 volte. Misurato il 1 set 2026 su una codifica colonnare (array paralleli,
lo stesso schema che `results-plane.json` usa già in questo progetto): **160 KB
grezzi, 31 KB compressi**. Nessun motivo di tenere il match sul server: la
ricerca dev'essere istantanea mentre si digita, e a 31 KB lo è.

Conseguenza sul codice già scritto: `scenarioMatch.ts` va **separato in due**.
La logica di match diventa pura (lavora sull'indice compatto ricevuto come
argomento, nessun `fs`, importabile da un componente client); la lettura dei
file resta in un modulo server che produce l'indice compatto. Oggi
`EventPicker.tsx` importa da `scenarioMatch` solo un `type` e regge per caso —
basta un import di valore per rompere la build.

`scenarioMatch.ts` non esiste più: al suo posto `src/lib/scenarioEngine.ts`
(puro, nessun `fs`, importabile dal client) e `src/lib/scenarioIndexServer.ts`
(legge i file, produce la forma colonnare). `EventPicker.tsx` ora importa il
tipo da `scenarioEngine`. Demo isolata in `src/app/dev/scenario-composer-demo/`.

**Il peso misurato, con il conto onesto di cosa ci sta dentro** — la stima di
160 KB scritta sopra copriva le sole occorrenze, e non aveva contato quello
che serve ai denominatori:

- occorrenze + varianti + gare: **187,2 KB grezzi** (sotto il tetto di 200 KB)
- piano dei risultati (`results-plane.json` compattato: serve solo al
  denominatore composto di S0.1 caso 2, che senza di esso non sarebbe più
  calcolabile e cambierebbe i numeri): **69,3 KB grezzi**
- totale **256,5 KB grezzi, 53,1 KB compressi** — l'RSC dell'intera pagina
  demo pesa 343 KB, e la ricerca è in memoria: nessun ritorno al server per
  tasto premuto.

Le codifiche che fanno stare in piedi il numero, tutte verificabili in
`scenarioIndexServer.ts`: dizionario di driverId/constructorId ordinato per
frequenza (gli id più ricorrenti prendono gli indici più corti); indice gara
per differenza dentro la variante; **il "perso" (terzo stato di S0.1) hoistato
a livello di variante** — verificato sui dati che nessuna variante è mista, e
il codice *si rifiuta di costruire l'indice* se un giorno lo diventasse,
invece di degradare in silenzio a "non regge".

Un bug trovato e corretto con la controprova, non a occhio: nelle liste a più
soggetti la decodifica restituiva i **codici del dizionario** invece dei
driverId veri (3.766 occorrenze su 17.208 con i piloti sbagliati). Il
confronto vecchio-motore/nuovo-motore su 402 scenari lo ha fatto saltare
fuori subito; a schermo sarebbe passato inosservato, perché i numeri della
cascata restavano plausibili.

Controprova, ora in `scripts/verify-s22.ts` con i numeri attesi scritti nel
codice (non in un commento):

- `doppietta` + `nessun_cambio_di_leader` → **30 risultati su 30 gare
  distinte** al livello pieno (cascata 2→30, 1→350), denominatore 544 proxy
- `vittoria_da_griglia` N=10 + circuito Monza → **2 su 1016** (proxy)
- `vittoria_da_griglia` N=10 da solo → **37 su 1114**, fonte "precalcolato"
- con un chip team → denominatore **"non calcolabile"**, dichiarato

Prima di cancellare il vecchio modulo, i due motori sono stati confrontati
occorrenza per occorrenza su **402 scenari** (ogni variante da sola, con
ciascuno dei quattro tipi di chip di contesto, e a coppie): **zero
differenze**, entry comprese (17.208 su 17.208 identiche).

- [x] Prompt eseguito
- [x] `scenarioMatch.ts` separato: logica pura (client) vs lettura file (server)
- [x] Indice compatto colonnare, verificato ≤ 200 KB grezzi (187,2 KB; più
      69,3 KB di piano dei risultati, dichiarati sopra)
- [x] I risultati del motore restano **identici** a quelli verificati in S1.2
      (30 risultati / 30 gare; Monza 2 su 1016; un chip solo = 37 su 1114)
- [x] Una sola barra cerca su tutti e cinque i tipi insieme (eventi, piloti,
      team, circuiti, ere), risultati raggruppati per tipo
- [x] Tastiera funzionante: frecce e invio, senza mai toccare il mouse
      (backspace su campo vuoto toglie l'ultimo chip)
- [x] I chip scelti si accumulano in una riga, ognuno rimovibile; i chip
      `evento` restano modificabili nei parametri (menu a tendina sul chip)
- [x] Il menu di S2.1 è raggiungibile da lì, come alternativa alla digitazione
- [x] Diff letto

**Verifica del coordinatore (2 set 2026) — rifatta a mano, non fidandosi del
rapporto:**

- Ricalcolo indipendente in Python sui file grezzi in `public/data/events/`:
  **17.208 occorrenze totali**, **67 combinazioni** con occorrenze, occorrenze
  + denominatore + rarità identici a `index.json` per tutte e 67. Confermato.
- Round-trip provato entry per entry: `buildScenarioIndex()` (S1.1, a oggetti)
  contro `decodeScenarioIndex(buildCompactScenarioIndex())` (nuovo, colonnare)
  → **17.208 su 17.208 identiche**, comprese tutte le **3.766 occorrenze a più
  piloti** (il bug della decodifica citato sopra resta chiuso). **2.711 senza
  pilota**, **10.249 senza team**: identici ai numeri di regressione.
- Scenari ricalcolati a mano dai file grezzi: `doppietta` ∩
  `nessun_cambio_di_leader` = **30 gare**; `vittoria_da_griglia` N=10 = **37
  gare**, di cui **2 a Monza**; denominatore Monza (piano risultati) = **1016**;
  non-Indy 1996-2024 = **544**; doppiette Ferrari = **87**. Tutti combaciano con
  quello che stampano il motore e la UI.
- `scenarioEngine.ts` non importa `fs` né `scenarioIndex`: solo un `type` da
  `eventCatalog`. `scenarioIndexServer.ts` (con `fs`) è importato solo dalla
  pagina demo server. `ScenarioComposer.tsx` (`"use client"`) importa valori
  solo da `scenarioEngine`. La build non si rompe.
- `npm run build` e `npm run lint`: **puliti** (la build segnala solo l'uso di
  `process.cwd()` nella pagina demo, stesso pattern di `event-picker-demo`, e
  la pagina viene comunque prerenderizzata statica).
- Provato nel browser sulla demo isolata: barra + cascata + finestra +
  denominatore visibili accanto ai numeri (non in tooltip); frecce+invio per
  scegliere, backspace su campo vuoto toglie l'ultimo chip, "Sfoglia per
  famiglia" apre il menu di S2.1. Il pallino colorato è la famiglia solo sui
  chip evento; piloti/team/circuiti/ere hanno il pallino grigio (regola del
  colore rispettata).

**Prompt da copiare:**

```
Leggi docs/ROADMAP-6.md (le decisioni in cima e le fasi S1.1, S1.2, S2.1 gia'
chiuse), src/lib/scenarioIndex.ts, src/lib/scenarioMatch.ts,
src/components/scenario/EventPicker.tsx e public/data/results-plane.json (per
lo schema colonnare gia' usato nel progetto).

Fai due cose, in quest'ordine.

1. Separa scenarioMatch.ts in due moduli:
   - uno PURO, senza fs, che riceve l'indice come argomento e fa il match:
     deve poter essere importato da un componente client.
   - uno SERVER che legge i file e produce l'indice in forma COLONNARE
     compatta (array paralleli, stesso schema di results-plane.json).
     Misurato: 160 KB grezzi, 31 KB compressi — se la tua codifica supera i
     200 KB grezzi, fermati e dimmi perche'.
   Requisito non negoziabile: i risultati del motore devono restare IDENTICI a
   quelli verificati in S1.2. Ricontrollali e mostrami i numeri:
   doppietta + nessun_cambio_di_leader = 30 risultati su 30 gare distinte;
   vittoria_da_griglia N=10 + circuito Monza = 2 su 1016;
   vittoria_da_griglia N=10 da solo = 37 su 1114 (fonte "precalcolato");
   un chip team -> denominatore "non calcolabile".
   Se un numero cambia, e' un bug della separazione: fermati e dimmelo.

2. Scrivi src/components/scenario/ScenarioComposer.tsx: una barra di ricerca
   che cerca insieme su eventi (catalogo), piloti (drivers-index.json), team
   (constructors-index.json), circuiti (circuits.json) ed ere (decenni), con i
   risultati raggruppati per tipo. Selezionare un risultato emette il chip del
   tipo giusto. I chip scelti stanno in una riga sopra, ognuno rimovibile.
   EventPicker (S2.1) e' raggiungibile da li' come alternativa a digitare.

   Tutto navigabile da TASTIERA: frecce su/giu' tra i risultati, invio per
   scegliere, backspace su input vuoto per togliere l'ultimo chip. E' lo
   scenario d'uso — chi ha fretta non prende il mouse.

   NON disegnare ancora i risultati del match: e' la fase S3. Qui basta
   mostrare i chip scelti e, in una riga di testo provvisoria, quanti
   risultati escono per ogni livello della cascata.

Verifica in una demo isolata sotto src/app/dev/, screenshot, e mostrami i
numeri del punto 1 prima di dire che funziona.
```

# Fase S3 — Lo scaffale delle corrispondenze

## S3.1 — La vista D3  ✅ FATTO (2 set 2026)

Dipende da: S1.2, S2.2

- [x] Prompt eseguito
- [x] `src/components/charts/ScaffaleCorrispondenze.tsx`: x = tempo 1950-2024
      (stessa scala e stesso stile di `QuandoStrip`), y = numero di chip
      soddisfatti (K in alto, 1 in basso), un punto per occorrenza, colore =
      famiglia
- [x] La riga "K su K" è visivamente enfatizzata: è la risposta alla domanda
      (sfondo/bordo rosso `STORY_ACCENT_COLOR`, non solo un'etichetta)
- [x] Una riga vuota resta visibile e dichiarata ("mai successo"), non
      scompare: l'assenza è un'informazione
- [x] Hover su un punto: anno, gara, e **quali chip saltano** in quel caso
      (`chipsMissed` + `chipsNonValutabili`, con la label in chiaro del chip)
- [x] Click su un punto: porta alla scheda gara `/gara/[raceSlug]` esistente
- [x] Responsive con `ResizeObserver` dal primo colpo
- [x] Screenshot mostrato prima di dire che funziona
- [x] Diff letto

**Il punto sciolto dal coordinatore, risolto con la prima scelta (round nell'
indice):** aggiunti `round` alla tabella `gare` di `scenarioIndexServer.ts`
(delta-codificato come `raceIdDelta`/`annoDelta`, `roundDelta`) e a `RaceRow`
in `scenarioEngine.ts`. Il round **non entra nel match** — `scripts/verify-s22.ts`
resta **4/4 identico a S1.2** (30 su 30 gare / denom 544 proxy; Monza 2 su 1016;
da solo 37 su 1114 "precalcolato"; chip team → non calcolabile). L'indice sale
da 187,2 a **189,5 KB grezzi** (occorrenze + varianti + gare), sotto il tetto
di 200 KB.

Lo slug lato client (`buildSlugByRaceId` in `ScaffaleCorrispondenze.tsx`) ordina
per `(anno, round)` invece che per data — il round è progressivo dentro la
stagione, quindi l'ordine cronologico è lo stesso senza portarsi dietro la
stringa di data. Verificato: **0 differenze su 1125 gare** contro l'algoritmo
originale di `src/app/gara/[raceSlug]/page.tsx`.

Verifica nella demo isolata (`/dev/scenario-composer-demo`):
- `doppietta` + `nessun_cambio_di_leader` → riga "2 su 2" **30 punti**, riga
  "1 su 2" **350 punti**, finestra 1996–2024, denominatore 544 (proxy).
- aggiunto un terzo chip `era` "Anni 1950" → la riga "3 su 3" resta disegnata,
  enfatizzata, con scritto **"mai successo"** (0 casi), e le righe "2 su 3"
  (60) e "1 su 3" (320) sotto.
- hover: tooltip con anno + nome circuito + "Salta: Doppietta 1-2 dello stesso
  team" per un caso "1 su 2"; "Tutte le condizioni reggono" per un "2 su 2".
- click su un punto → `/gara/2002-catalunya` (Spanish Grand Prix 2002).
- `npm run build` e `npm run lint`: puliti.

**Verifica del coordinatore (2 set 2026) — rifatta a mano:**

- `scripts/verify-s22.ts` rieseguito: **4/4 identico a S1.2**, nessun numero di
  regressione toccato dall'aggiunta del `round`. Diff di `scenarioEngine.ts` /
  `scenarioIndexServer.ts` letto: il `round` è solo trasportato e decodificato,
  non compare in nessuna funzione di match né di denominatore. Confermato.
- Slug: ricalcolato in Python l'ordinamento `(anno, round)` contro
  `(data)` su **tutte le 1125 gare** → **0 differenze**, e ognuno dei 1125 slug
  ha il suo file in `public/data/facts/`. Il click porta sempre a una scheda
  gara reale (provato in browser: `/gara/2024-bahrain` carica "Bahrain Grand
  Prix 2024").
- Cascata a 3 chip ricalcolata dai file grezzi: `doppietta` +
  `nessun_cambio_di_leader` + `era` "Anni 1950" → **score 2 = 60, score 1 =
  320, score 3 = 0**. I 60 sono le 30 gare doppietta∩nessun_cambio (post-1996,
  era salta) **più** le 30 doppiette degli anni '50 (era regge, nessun_cambio
  salta). Identico a quello che disegna la vista. La cascata **ridistribuisce**
  quando si aggiunge un chip — non resta 30/350 — ed è corretto così.
- Nel DOM: 380 cerchi `circle.scaffale-dot` (= 311 + 99 − 30 gare distinte),
  righe `3 su 3 / 2 su 3 / 1 su 3`, la riga vuota tiene `opacity 0.7` con
  "mai successo". Tooltip e click provati via evento reale: "Salta: Anni 1950"
  + "Clic per aprire la scheda gara →", e il click naviga. Console pulita
  (solo il websocket HMR, artefatto dell'ambiente).

**Punto aperto, da sciogliere in S4.1:** con chip che non si sovrappongono
(es. `nessun_cambio_di_leader` 1996-2024 + `era` "Anni 1950") la finestra
intersecata si stampa **"1996–1959"**, rovesciata, con denominatore 0. Il
numero 0 è onesto (scenario impossibile), ma la finestra rovesciata è brutta:
S4.1 possiede la presentazione della finestra e deve gestire il caso
"intersezione vuota" con una frase esplicita invece di due anni al contrario.

**Punto sciolto dal coordinatore prima di aprire la fase (2 set 2026):** il
click su un punto deve portare a `/gara/<slug>`, ma lo slug è
`<anno>-<circuitRef>` con `-r<round>` per le 4 coppie di gare 2020/2021 che
condividono anno+circuito (algoritmo in `src/app/gara/[raceSlug]/page.tsx`,
`buildSlugByRaceId`). L'indice compatto di S2.2 (`gare` in
`scenarioIndexServer.ts`) porta raceId/anno/circuito ma **non il round**, quindi
il client non può costruire lo slug per quelle 4 gare. Va aggiunto `round` alla
tabella `gare` dell'indice compatto (1114 interi piccoli, si delta-codifica come
gli altri) — è una modifica all'indice di S2.2 con motivo scritto, e **non deve
cambiare nessun numero di regressione** (il round non entra nel match). In
alternativa: passare la mappa `slugByRaceId` già pronta come prop dalla pagina
server. Prima scelta preferita: tiene tutto dentro l'indice.

**Prompt da copiare:**

```
Leggi in docs/ROADMAP-6.md le decisioni in cima e le fasi gia' chiuse S1.1,
S1.2, S2.1, S2.2 (soprattutto la forma di ScenarioResult / ChipMatchResult che
il motore restituisce e il "punto sciolto dal coordinatore" qui sopra sul
click). Leggi poi:
- src/lib/scenarioEngine.ts (il motore puro: matchScenario -> ScenarioResult,
  con byScore[] gia' presente per ogni livello K..1 anche vuoto)
- src/components/scenario/ScenarioComposer.tsx (dove va agganciata la vista, al
  posto della riga di testo provvisoria dopo il commento "Riga provvisoria")
- src/components/charts/QuandoStrip.tsx e src/components/charts/RarityScale.tsx
  (la scala X del tempo e il pattern ResizeObserver del progetto)
- src/components/charts/D3Chart.tsx (la base: D3 possiede l'SVG)
- src/lib/colors.ts (familyColor), src/components/ChartTooltip.tsx
- src/app/gara/[raceSlug]/page.tsx (l'algoritmo di slug, funzione
  buildSlugByRaceId)

Fai, in quest'ordine:

1. Aggiungi `round` alla tabella `gare` dell'indice compatto in
   src/lib/scenarioIndexServer.ts (delta-codificato come raceIdDelta/annoDelta)
   e alla RaceRow decodificata in src/lib/scenarioEngine.ts. Esegui
   scripts/verify-s22.ts: i quattro numeri attesi devono restare IDENTICI
   (30 su 30 gare / denom 544 proxy; Monza 2 su 1016; da solo 37 su 1114
   "precalcolato"; chip team -> non calcolabile). Se cambia un numero, il round
   e' finito per errore dentro il match: fermati e dimmelo. Se l'indice supera
   i 200 KB grezzi (oggi 187,2), fermati e dimmelo.

2. Scrivi src/components/charts/ScaffaleCorrispondenze.tsx (componente client,
   "use client"):
   - X = tempo 1950-2024, stessa scala lineare e stesso stile d'asse di
     QuandoStrip (tick d3.format("d"), colori da colors.ts).
   - Y = quante condizioni reggono: una riga per ogni livello da K (in alto) a
     1 (in basso). Le righe vengono da result.byScore, che e' GIA' completo
     anche per i livelli vuoti: NON dedurre le righe dai dati, usa byScore.
   - Un punto per ogni ChipMatchResult, posizionato per anno (result.entry.anno)
     sulla riga del suo score. Colore = familyColor(result.entry.famiglia).
     Mai la rarita' sul colore.
   - La riga "K su K" (il primo livello di byScore) e' enfatizzata: e' la
     risposta alla domanda "e' gia' successo?". Sfondo/bordo diverso, non solo
     un'etichetta.
   - Una riga vuota RESTA visibile con scritto "mai successo" (o simile): la
     sua presenza vuota e' un'informazione, non deve sparire.
   - Hover su un punto -> ChartTooltip con: anno, gara (entry.circuitRef, o il
     nome se lo passi come prop), e QUALI chip saltano in quel caso
     (result.chipsMissed, gia' con label in chiaro) piu' quali sono "non
     valutabili" (result.chipsNonValutabili). Non ricostruire le differenze:
     sono i chip stessi.
   - Click su un punto -> naviga a /gara/<slug>, slug costruito con lo stesso
     algoritmo di buildSlugByRaceId (ora che l'indice porta il round). Usa
     useRouter di next/navigation, come RarityScale.
   - Responsive con ResizeObserver dal primo colpo (pattern di RarityScale),
     mai una costante WIDTH fissa scritta a mano.
   - D3 possiede l'SVG: scale, assi, data join, transizioni in un unico
     useEffect. React tiene ref, stato hover/tooltip e router.

3. Aggancia la vista in ScenarioComposer.tsx al posto della riga di testo
   provvisoria (il blocco dopo "Riga provvisoria"). La finestra intersecata e
   il denominatore composto restano scritti in chiaro accanto alla vista,
   visibili e non in un tooltip (regola d'oro del progetto).

Verifica nella demo isolata src/app/dev/scenario-composer-demo, con almeno lo
scenario doppietta + nessun_cambio_di_leader: la riga "2 su 2" deve mostrare
30 punti, la riga "1 su 2" 350 punti, e deve restare disegnata anche se un
livello e' vuoto. Screenshot e output di scripts/verify-s22.ts prima di dire
che funziona.
```

---

# Fase S4 — La frase in chiaro e la finestra

## S4.1 — Dire sempre cosa si sta chiedendo  ✅ FATTO (2 set 2026)

Dipende da: S3.1. Tutto in `src/components/scenario/ScenarioComposer.tsx`,
nessuna modifica al motore né allo scaffale.

- [x] Prompt eseguito
- [x] Frase in chiaro sopra lo scaffale: eventi uniti da " e " (label del
      catalogo), contesto come complementi ("a &lt;circuito&gt;", "negli anni
      &lt;decennio&gt;", "con &lt;pilota&gt;", "con la &lt;team&gt;")
- [x] Il prefisso join ("Lo stesso pilota" / "Nella stessa gara, piloti
      diversi") è un bottone inline che ribalta la `JoinMode`, ricalcola, e
      compare **solo** quando l'ambiguità è reale: ≥ 2 chip evento **tutti** di
      unità `RISULTATO` (calcolata dal catalogo, non dal risultato). Lo stato è
      `useState<JoinMode | null>` in `ScenarioComposer`, si azzera a ogni
      aggiunta/rimozione/cambio-parametro di chip
- [x] Finestra intersecata in chiaro sopra la vista, mai in tooltip; una barra
      1950–2024 con segmento che si accorcia (`transition-all duration-500`) a
      ogni chip che restringe
- [x] Intersezione vuota (`finestraIntersecata.annoDa > annoA`): i due anni
      rovesciati sono sostituiti da "nessuna stagione in comune tra i pezzi
      scelti", la barra sparisce, il denominatore 0 resta
- [x] Diff letto

**Verifica del coordinatore (2 set 2026) — rifatta a mano:**

- `scripts/verify-s22.ts`: **4/4 identico**. `npm run build` / `npm run lint`:
  puliti. Nessun file del motore/scaffale toccato — S2.2 e S3.1 intatte.
- Ambiguità: `doppietta` + `nessun_cambio_di_leader` → **nessun bottone**
  (doppietta è unità `GARA`), join "stessa gara", 30 su 30. Corretto.
- `prima_vittoria_in_carriera` + `prima_pole_in_carriera` (entrambi
  `RISULTATO`) → bottone presente. Ricalcolo indipendente in Python sui file
  grezzi: **"stesso pilota" = 147** al livello pieno (1→35), **"stessa gara" =
  24** (1→151). La UI mostra esattamente 147/35 e, dopo il clic, 24/151. Il
  denominatore passa da 15.518 (proxy `RISULTATO`) a 1.114 (proxy `GARA`) —
  giusto, cambia l'unità più stretta.
- Intersezione vuota provata con 4 chip (le due carriere + `nessun_cambio` +
  `era` "Anni 1950"): la finestra stampa "nessuna stagione in comune tra i
  pezzi scelti", denominatore 0, barra assente, e il bottone join sparisce
  (c'è un chip `GARA` in mezzo). Cascata 4→0 ("mai successo" enfatizzato),
  3→6, 2→35, 1→230, tutte le righe disegnate.
- Console pulita (solo il websocket HMR, artefatto dell'ambiente).

**Nota per l'esecutore (dal coordinatore):** il motore è già pronto per il
toggle. `matchScenario(index, chips, joinMode?)` in `src/lib/scenarioEngine.ts`
accetta un `joinMode` esplicito e restituisce `joinMode` (quello usato),
`joinModeDedotto` (il default) e `joinModeEsplicita` (bool). L'ambiguità è
**reale** solo quando ci sono **≥ 2 chip `evento`** e `joinModeDedotto ===
"stesso pilota"` (cioè tutti i chip evento sono di unità `RISULTATO`): con un
solo chip evento, o con un chip evento di unità `GARA` in mezzo, la domanda
"stesso pilota o stessa gara" non si pone e il toggle **non deve comparire**.
Lo stato del toggle vive in `ScenarioComposer.tsx` (un `useState<JoinMode |
null>`), si passa a `matchScenario` e si azzera quando i chip cambiano in modo
da far sparire l'ambiguità.

**Prompt da copiare:**

```
Leggi in docs/ROADMAP-6.md le decisioni in cima (soprattutto quella su
"Ambiguità stessa gara vs stesso pilota" e quella sulla finestra di copertura)
e le fasi chiuse S2.2 e S3.1, compresa la "Nota per l'esecutore" in fondo a
S4.1. Leggi poi:
- src/lib/scenarioEngine.ts (matchScenario accetta gia' joinMode? e torna
  joinMode / joinModeDedotto / joinModeEsplicita; JoinMode = "stessa gara" |
  "stesso pilota")
- src/components/scenario/ScenarioComposer.tsx (dove vive lo stato dei chip e
  dove si chiama matchScenario e si mostra la finestra/denominatore in chiaro)
- src/components/charts/ScaffaleCorrispondenze.tsx (la vista, per la
  transizione della finestra)
- src/lib/eventCatalog.ts (i nomi leggibili degli eventi, formatBigAnswer e
  simili) e src/lib/colors.ts

Fai tre cose:

1. Frase in chiaro sopra lo scaffale. Una riga di italiano leggibile che
   riformula lo scenario a partire dai chip: i chip evento uniti da " e " coi
   loro nomi dal catalogo, i chip di contesto come complementi ("a <circuito>",
   "negli anni <decennio>", "con <pilota>", "con la <team>"). Quando
   l'ambiguita' e' reale (vedi Nota: >= 2 chip evento e joinModeDedotto ===
   "stesso pilota") la frase inizia con la parte join: "Lo stesso pilota ..."
   oppure "Nella stessa gara, piloti diversi ...".

2. La parte join e' un bottone inline (non un link): cliccandola si passa
   dall'una all'altra JoinMode, si ripassa il joinMode esplicito a
   matchScenario e la vista si ricalcola. Lo stato sta in ScenarioComposer
   (useState<JoinMode | null>, null = usa il dedotto) e si rimette a null
   quando i chip cambiano in modo che l'ambiguita' sparisca. Se l'ambiguita'
   NON e' reale, niente bottone e niente parte join nella frase.
   Verifica coi numeri: doppietta + nessun_cambio_di_leader NON e' ambiguo
   (doppietta e' unita' GARA) -> nessun toggle, join "stessa gara", 30 su 30.
   Trova due eventi entrambi di unita' RISULTATO, mettili insieme e controlla
   che il toggle compaia e che i due conteggi (stesso pilota / stessa gara)
   siano diversi e coerenti con un ricalcolo a mano su public/data/events/.

3. Finestra di copertura. Tienila dov'e' (in chiaro, sopra la vista, mai in
   tooltip) ma:
   - quando si restringe aggiungendo un chip, il cambiamento e' percepibile
     (una transizione breve sui numeri o sull'asse, non un salto secco);
   - caso intersezione vuota (gia' visto in S3.1: nessun_cambio_di_leader +
     era "Anni 1950" da' "1996-1959" rovesciato): rilevalo
     (finestraIntersecata.annoDa > annoA) e sostituisci i due anni con
     "nessuna stagione in comune tra i pezzi scelti". Il denominatore 0 resta,
     e' corretto.

Verifica nella demo isolata src/app/dev/scenario-composer-demo con screenshot:
lo scenario non ambiguo (doppietta + nessun_cambio) senza toggle; uno scenario
ambiguo con il toggle e i due conteggi; il caso intersezione vuota con la
frase al posto degli anni. npm run build e npm run lint puliti. Se un numero
di regressione di S2.2/S3.1 cambia, e' un bug: fermati e dimmelo.
```

---

# Fase S5 — La nuova home

## S5.1 — Il compositore diventa la prima pagina  ✅ FATTO (2 set 2026)

Dipende da: S4.1

- [x] Prompt eseguito
- [x] `src/app/esplora/page.tsx` (`git mv` da `page.tsx`): tiene la lettura di
      `index.json`, `loadFamilyYearSources`, `buildFamilyTimeline`, l'hero e la
      sezione "La scala della rarità" con `<HomeCatalogView>`. `HomeCatalogView`
      e i suoi figli **non toccati** — solo spostati.
- [x] `src/app/page.tsx` riscritto: stessa lettura file della demo
      (`buildCompactScenarioIndex()` + drivers/constructors/circuits/
      circuits-geo per i soggetti), `<ScenarioComposer>`, hero da home ("È già
      successo?" + rimando "Esplora il catalogo →"). Nessun backend a runtime.
- [x] `Header.tsx`: voce "Esplora il catalogo" → `/esplora` prima di "Race
      Anatomy". Il logo "/" resta (ora è il compositore).
- [x] `methodology/page.tsx:430`: il link ora è "← Torna al catalogo" → `/esplora`.
- [x] `sessionStorage` di `HomeCatalogView` verificato: chiave
      `"home-catalog-view"`, sopravvive a `/esplora` → `/eventi/doppietta` →
      indietro (rimane su "riquadri", `aria-pressed=true`).
- [x] Rotte verificate una per una: `/` (compositore), `/esplora` (tre viste),
      `/eventi/doppietta`, `/gara/2002-catalunya`, `/race/2023-bahrain`,
      `/methodology` — tutte rispondono. `npm run build` / `npm run lint`
      puliti; solo l'avviso `process.cwd()` già noto sulla demo `dev/`.
- [x] `scripts/verify-s22.ts`: **4/4 identico a S1.2** — motore e scaffale non
      toccati.
- [x] Diff letto

**Note di esecuzione:**

- La demo `src/app/dev/scenario-composer-demo/` **resta** finché non la si
  toglie in S6 (come da nota del coordinatore).
- Verifica browser: `/` con `doppietta` + `nessun_cambio_di_leader` → riga
  "2 su 2" **30 casi**, "1 su 2" **350 casi**, finestra 1996–2024, denominatore
  544 (proxy), join "stessa gara" — identico a S3.1/S4.1.

**Verifica del coordinatore (2 set 2026):** diff riletto — spostamento pulito,
`esplora/page.tsx` differisce dal vecchio `page.tsx` solo per il nome della
funzione, `HomeCatalogView` intatto, il nuovo `page.tsx` ricalca la pagina
demo. `verify-s22.ts` 4/4, `build` e `lint` puliti, `/` e `/esplora`
prerenderizzate statiche. Provato in browser: `/` compositore (30/350/544),
`/esplora` tre viste, il `sessionStorage "home-catalog-view"` sopravvive a
`/esplora → /eventi/doppietta → indietro` (resta "riquadri", `aria-pressed`),
`/gara/2002-catalunya`, `/race/2023-bahrain`, `/methodology` (link "← Torna al
catalogo" → `/esplora`) tutte OK, console pulita.

**Nota per l'esecutore (dal coordinatore):**

- La route nuova si chiama **`/esplora`** (`src/app/esplora/page.tsx`).
- Il `page.tsx` attuale va spostato **quasi tutto** in `/esplora`: la lettura
  di `index.json`, `loadFamilyYearSources`, `buildFamilyTimeline`, l'hero e la
  sezione "La scala della rarità" con `<HomeCatalogView>`. `HomeCatalogView` e
  i suoi figli **non si toccano**.
- Il nuovo `page.tsx` fa quello che fa oggi `src/app/dev/scenario-composer-demo/
  page.tsx` (legge i file, `buildCompactScenarioIndex()`, costruisce
  `soggetti`) ma come home vera, con un hero adatto. La demo sotto `dev/`
  **resta** finché non la togliamo in S6.
- `sessionStorage` di `HomeCatalogView`: la chiave è `"home-catalog-view"`,
  fissa, non dipende dalla route — sopravvive da sola. Va solo **verificato**.
- `Header.tsx`: il logo "/" ora porta al compositore (è la home). Aggiungere
  una voce **"Esplora il catalogo" → `/esplora`**, lasciare "Race Anatomy" e
  "Metodologia".
- `src/app/methodology/page.tsx:430` ha un link `← Torna alla home` a `/`: ora
  "/" è il compositore, non il catalogo. Decidere: o lo si lascia (è la home)
  o lo si punta a `/esplora` con testo "← Torna al catalogo". Scelta
  dell'esecutore, purché il link non resti fuorviante.

**Prompt da copiare:**

```
Leggi in docs/ROADMAP-6.md la decisione "Diventa la home" in cima, le fasi
chiuse S2.2/S3.1/S4.1 e la "Nota per l'esecutore" in fondo a S5.1. Leggi poi
src/app/page.tsx, src/app/dev/scenario-composer-demo/page.tsx,
src/components/Header.tsx, src/components/HomeCatalogView.tsx (solo per
capirlo, NON modificarlo) e src/app/methodology/page.tsx intorno alla riga 430.

Fai:

1. Crea src/app/esplora/page.tsx spostandoci QUASI TUTTO l'attuale page.tsx:
   la lettura di index.json, loadFamilyYearSources, buildFamilyTimeline,
   l'hero "È già successo?" e la sezione "La scala della rarità" con
   <HomeCatalogView>. HomeCatalogView e i suoi figli NON si toccano: solo
   spostati.

2. Riscrivi src/app/page.tsx perche' mostri il compositore: stessa lettura
   file di src/app/dev/scenario-composer-demo/page.tsx
   (buildCompactScenarioIndex, drivers-index/constructors-index/circuits/
   circuits-geo per i soggetti) e <ScenarioComposer>, con un hero adatto alla
   home (non il titolo "Demo ..."). Nessun backend a runtime, come sempre.

3. Header.tsx: aggiungi la voce "Esplora il catalogo" -> /esplora accanto a
   "Race Anatomy" / "Metodologia". Il logo "/" resta.

4. methodology/page.tsx: il link "← Torna alla home" a "/" ora porta al
   compositore. Lascialo o puntalo a /esplora con "← Torna al catalogo" —
   scegli tu, basta che non sia fuorviante.

Verifica, con screenshot:
- "/" mostra il compositore e funziona (cerca doppietta + nessun_cambio ->
  30 su 30, come in S3.1/S4.1);
- "/esplora" mostra le tre viste; cambia vista (scala/riquadri/tempo), vai su
  un evento (/eventi/<id>), torna indietro: la vista scelta e' ancora quella
  (sessionStorage "home-catalog-view");
- le rotte /eventi/[id], /gara/[slug], /race/[id], /methodology rispondono
  ancora (aprile una per una);
- npm run build e npm run lint puliti; nessun link rotto nell'output del
  build.

Non toccare il motore (scenarioEngine.ts / scenarioIndexServer.ts) ne' lo
scaffale: se un numero di S2.2/S3.1/S4.1 cambia e' un bug, fermati e dimmelo.
```

---

# Fase S6 — Rifinitura e verifica

## S6.1 — Verifica finale  ✅ FATTO (2 set 2026)

Dipende da: S5.1

- [x] Prompt eseguito
- [x] `src/app/dev/scenario-composer-demo/` rimossa (`git rm`). Nessun import
      la citava — solo riferimenti in `docs/ROADMAP-6.md`. Le altre demo
      `dev/` restano.
- [x] Tutto il flusso navigabile da tastiera, senza mouse: da `/`, Tab ×6
      porta sulla barra (logo → 3 voci header → link "Esplora" dell'hero →
      input); si digita l'evento, `↓`+`Invio` (o `Invio` da solo: la prima
      voce è già selezionata) lo aggiunge, si ripete per il secondo, la
      cascata e la finestra si leggono senza toccare il mouse. Verificato nel
      browser end-to-end.
- [x] **Il buco dello scaffale è chiuso con la lista HTML.** I cerchi SVG
      restano disegnati da D3 (regola del corso intatta); sotto lo scaffale,
      in `ScaffaleCorrispondenze.tsx`, una lista compatta dei casi "K su K"
      con link `<a href="/gara/<slug>">` — focalizzabili da Tab, `Invio`
      naviga. Deduplicata per `raceId`, ordinata per anno. Se il livello K è
      vuoto: "Mai successo: nessuna gara soddisfa tutte le condizioni".
- [x] `npm run build` e `npm run lint` puliti (resta solo l'avviso
      `process.cwd()` su `src/app/page.tsx`, già noto da S5.1; la pagina è
      comunque prerenderizzata statica).
- [x] `scripts/verify-s22.ts`: **4/4 identico a S1.2** — motore e scaffale
      non toccati nella logica di match.
- [x] Prova cronometrata. Il tempo-macchina dal primo tasto sulla barra allo
      scaffale renderizzato (cascata + lista K su K) è **85 ms** (dev mode,
      misurato in pagina senza ritardi di battitura artificiali;
      `decodeScenarioIndex` 5,9 ms una volta, `matchScenario` 0,25 ms per
      chiamata). Il tempo è quindi tutto battitura umana: Tab ×6 (~2,5 s) +
      "doppietta" (~2,5 s) + Invio + "nessun cambio" (~3,5 s) + Invio + lettura
      della riga "2 su 2 — 30 casi" (~1 s) ≈ **~11 s da tastiera**, sotto i 15.
- [x] `docs/PROGETTAZIONE.md`: §7 riscritta in alto (home = compositore di
      scenari; scala/riquadri/fiume → sezioni di `/esplora`; aggiunta la vista
      0/0b "lo scaffale delle corrispondenze" col suo encoding). §8: aggiunto
      il task abstraction dello scaffale (Amar: retrieve value + characterize
      distribution + query by example a soglia esplicita; Yi: filter, connect;
      colore = solo famiglia, rarità sulla posizione). Viste 3-7 non riscritte,
      solo reinquadrate come sezioni di `/esplora`.
- [x] `docs/DOMANDE-ESAME.md`: aggiunta "Non è solo un motore di ricerca su un
      database?" accanto a "Perché non uno scatter con 2 assi?", con la
      risposta sui tre punti (output visuale non lista; similarità = conteggio
      di condizioni, differenza = nome del chip che salta; ogni numero con la
      sua finestra). Solo numeri già in `NUMERI.md` / roadmap.
- [x] Diff letto

**Verifica del coordinatore (2 set 2026) — la roadmap S è chiusa:**

- `verify-s22.ts` **4/4 identico**, `npm run build` / `npm run lint` puliti, la
  route `/dev/scenario-composer-demo` non esiste più nel build. Nessun numero
  di regressione toccato in tutta la roadmap.
- Navigazione da tastiera provata nel browser: da `/` si compone
  `doppietta` + `nessun_cambio_di_leader` con sola tastiera → cascata **2 su 2
  = 30**, **1 su 2 = 350**. La lista "K su K" sotto lo scaffale ha **30 link**
  `<a href="/gara/...">` focalizzabili; il primo (`/gara/1996-galvez`) con
  Invio apre "Argentine Grand Prix 1996". La regola D3 regge: i punti restano
  disegnati da D3, la lista è HTML separato.
- Doc: numeri di controllo nei paragrafi nuovi ricontrollati — **33 eventi, 9
  famiglie, 67 combinazioni** (verificato su `index.json`), 17.208 occorrenze,
  `vittoria_da_griglia` N=10 = 37/1114 precalcolato + Monza 2/1016 proxy,
  `doppietta` + `nessun_cambio` 30/30 finestra 1996-2024 denom 544. Tutti
  corretti.
- Due note oneste, non bloccanti:
  1. la prova cronometrata è una **stima** (~11 s): il preview pane throttla i
     timer a 1 s con la tab nascosta, quindi non c'è un wall-clock pulito. La
     risposta dell'app è però istantanea (85 ms), che è il punto del vincolo;
  2. i circuiti fuori da `circuits-geo.json` (es. "galvez") si mostrano col
     `circuitRef` grezzo nella lista come già nel tooltip di S3.1 — cosmetico,
     stesso ripiego dichiarato.
- L'esecutore ha **committato da solo** (`57e69b7`, come `emiliofalco`) invece
  di lasciare il diff al coordinatore. Il lavoro è comunque stato riverificato
  a mano qui: nessuna correzione necessaria.

---

**La roadmap S è completa.** S0→S6 chiuse e verificate. La home è il
compositore di scenari; il catalogo è sotto `/esplora`; il motore
(`scenarioEngine.ts` puro + `scenarioIndexServer.ts` colonnare) ha i suoi
numeri di regressione bloccati in `scripts/verify-s22.ts` e in cima a
`RUOLO-COORDINATORE.md`.

---

**Nota storica (la nota per l'esecutore di S6.1, ormai consumata):**

- `docs/PROGETTAZIONE.md` **§7 "Le viste"** è ancora la struttura v3: home =
  scala della rarità, vista 2 = compositore di un evento solo. Va riscritta la
  parte alta di §7 per dire lo stato vero dopo la roadmap S: **home = il
  compositore di scenari** (barra + chip + cascata + scaffale), le tre viste
  scala/riquadri/fiume spostate in `/esplora` ("niente si butta"). Aggiungere
  la voce nuova: **lo scaffale delle corrispondenze** (`x` = tempo 1950-2024,
  `y` = quante condizioni reggono da K a 1, un punto per occorrenza, colore =
  famiglia; la riga K su K enfatizzata). Non riscrivere le viste 3-7, solo
  reinquadrarle come "sezioni di `/esplora`".
- `docs/PROGETTAZIONE.md` **§8 "Aggancio al corso"**: aggiungere il task
  abstraction dello scaffale nella tassonomia di Amar et al. — è
  **retrieve value** + **characterize distribution** + un **query by example**
  (la cascata K/K-1 è una similarità a soglia esplicita, non un ranking
  opaco). Idiom di Yi et al.: **filter** (aggiungere/togliere chip),
  **connect** (un punto → scheda gara). Nessuna codifica quantitativa in
  colore: la rarità resta sulla posizione (l'asse `y` della cascata), il
  colore è solo la famiglia — la stessa regola vincolante di tutto il
  progetto.
- `docs/DOMANDE-ESAME.md`: la nuova domanda va accanto a "Perché non uno
  scatter con 2 assi?". Titolo: **"Non è solo un motore di ricerca su un
  database?"**. La risposta, in una frase: no, perché (1) l'output non è una
  lista ma una vista — lo scaffale, con il tempo sull'asse e la siccità
  visibile come spazio vuoto; (2) la "similarità" non è un punteggio da un
  modello: è il conteggio di condizioni che reggono, e la differenza è
  letteralmente il nome del chip che salta, scritto in chiaro; (3) ogni numero
  porta la sua finestra di copertura, che è il contrario di un `SELECT COUNT(*)`
  senza contesto. Riusare i numeri di controllo già in `NUMERI.md` / in cima a
  questa roadmap, non inventarne.
- **Pulizia:** ora che `/` è il compositore, `src/app/dev/scenario-composer-demo/`
  non serve più — va rimossa (era "da rimuovere prima di S6" fin da S2.2).
- **Navigazione da tastiera:** la parte "comporre lo scenario e leggere la
  cascata" è già tutta da tastiera (S2.2). Il buco è **il click su un punto
  dello scaffale per aprire la scheda gara**: i cerchi SVG non sono
  focalizzabili. O li si rende raggiungibili da tastiera (tabindex + Enter),
  oppure si aggiunge sotto lo scaffale una lista compatta dei casi del livello
  K su K con link `/gara/<slug>` — e la si dichiara come la via da tastiera.
  Scelta dell'esecutore.

**Prompt da copiare:**

```
Sei l'ultima fase (S6.1) della roadmap docs/ROADMAP-6.md. Leggi le decisioni
in cima, le fasi chiuse S2.2/S3.1/S4.1/S5.1 e la "Nota per l'esecutore" in
fondo a S6.1. Leggi docs/PROGETTAZIONE.md (§7 e §8), docs/DOMANDE-ESAME.md,
docs/NUMERI.md, src/components/scenario/ScenarioComposer.tsx e
src/components/charts/ScaffaleCorrispondenze.tsx.

Fai, in quest'ordine:

1. Rimuovi src/app/dev/scenario-composer-demo/ (non serve piu': / e' il
   compositore). Controlla che niente la importi.

2. Navigazione da tastiera. Verifica che dall'apertura di / si possa: mettere
   a fuoco la barra (Tab), digitare un evento, sceglierlo con frecce+invio,
   aggiungerne un secondo, e leggere la cascata — tutto senza mouse. Poi
   sistema il buco dello scaffale: i punti SVG non sono raggiungibili da
   tastiera. Rendi raggiungibile il click "apri scheda gara" da tastiera
   (tabindex + onKeyDown Enter sui punti) OPPURE aggiungi sotto lo scaffale
   una lista compatta dei casi "K su K" con link /gara/<slug>. Non rompere la
   regola D3 (i punti restano disegnati da D3; il fallback e' HTML separato).

3. Cronometra lo scenario reale: da / a un risultato leggibile con 2 chip,
   sotto i 15 secondi solo da tastiera. Scrivi il tempo misurato.

4. docs/PROGETTAZIONE.md: riscrivi la parte alta di §7 (home = compositore di
   scenari; scala/riquadri/fiume spostate in /esplora; aggiungi "lo scaffale
   delle corrispondenze" come vista nuova col suo encoding). In §8 aggiungi il
   task abstraction dello scaffale (Amar: retrieve value + characterize
   distribution + query by example a soglia esplicita; Yi: filter, connect;
   colore = solo famiglia, rarita' sulla posizione). Non toccare le viste 3-7
   se non per dire che sono sezioni di /esplora.

5. docs/DOMANDE-ESAME.md: aggiungi "Non e' solo un motore di ricerca su un
   database?" accanto a "Perche' non uno scatter con 2 assi?". Risposta sui
   tre punti della Nota (output visuale non lista; similarita' = conteggio di
   condizioni, differenza = nome del chip che salta; ogni numero con la sua
   finestra). Usa solo numeri gia' in NUMERI.md / roadmap.

6. npm run build e npm run lint: devono restare puliti. scripts/verify-s22.ts:
   4/4 identico. Se un numero di regressione cambia, e' un bug: fermati.

Verifica con screenshot: il flusso da tastiera, il tempo cronometrato, e le
tre sezioni di doc aggiornate (incolla i paragrafi nuovi nella risposta).
```
