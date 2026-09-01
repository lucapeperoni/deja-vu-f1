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
- [ ] Fase S3 — Lo scaffale delle corrispondenze (la vista D3)
- [ ] Fase S4 — La frase in chiaro e la finestra che si restringe
- [ ] Fase S5 — La nuova home e l'area "Esplora"
- [ ] Fase S6 — Rifinitura, accessibilità, verifica finale

Ordine dei prompt: S0.1 → S1.1 → S1.2 → S2.1 → S2.2 → S3.1 → S4.1 → S5.1 → S6.1.

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
- [ ] Diff letto

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

## S3.1 — La vista D3

Dipende da: S1.2, S2.2

- [ ] Prompt eseguito
- [ ] `src/components/charts/ScaffaleCorrispondenze.tsx`: x = tempo 1950-2024
      (stessa scala e stesso stile di `QuandoStrip`), y = numero di chip
      soddisfatti (K in alto, 1 in basso), un punto per occorrenza, colore =
      famiglia
- [ ] La riga "K su K" è visivamente enfatizzata: è la risposta alla domanda
- [ ] Una riga vuota resta visibile e dichiarata ("mai successo"), non
      scompare: l'assenza è un'informazione
- [ ] Hover su un punto: anno, gara, e **quali chip saltano** in quel caso
- [ ] Click su un punto: porta alla scheda gara `/gara/[raceSlug]` esistente
- [ ] Responsive con `ResizeObserver` dal primo colpo
- [ ] Screenshot mostrato prima di dire che funziona
- [ ] Diff letto

---

# Fase S4 — La frase in chiaro e la finestra

## S4.1 — Dire sempre cosa si sta chiedendo

Dipende da: S3.1

- [ ] Prompt eseguito
- [ ] Sopra il risultato, una frase in italiano leggibile che riformula lo
      scenario ("**lo stesso pilota** è stato fregato dalla Safety Car **e** si
      è ritirato per il motore")
- [ ] La parte "lo stesso pilota" è cliccabile e diventa "nella stessa gara",
      ricalcolando tutto — e compare **solo** quando l'ambiguità esiste davvero
- [ ] La finestra di copertura intersecata è scritta accanto ai numeri, sempre
      visibile e mai in un tooltip; quando si restringe aggiungendo un chip, il
      cambiamento è percepibile (transizione, non un salto silenzioso)
- [ ] Diff letto

---

# Fase S5 — La nuova home

## S5.1 — Il compositore diventa la prima pagina

Dipende da: S4.1

- [ ] Prompt eseguito
- [ ] `src/app/page.tsx` mostra il compositore; le tre viste attuali si
      spostano in una route "Esplora" (`HomeCatalogView` invariato, solo
      spostato — non riscritto)
- [ ] `Header.tsx` aggiornato di conseguenza
- [ ] Nessun link rotto: verificate tutte le rotte esistenti (`/eventi/[id]`,
      `/gara/[slug]`, `/race/[id]`, `/methodology`)
- [ ] Il `sessionStorage` di `HomeCatalogView` continua a funzionare dopo lo
      spostamento
- [ ] Diff letto

---

# Fase S6 — Rifinitura e verifica

## S6.1 — Verifica finale

Dipende da: S5.1

- [ ] Prompt eseguito
- [ ] Tutto il flusso navigabile da tastiera, senza mouse (è lo scenario d'uso:
      chi ha fretta non prende il mouse)
- [ ] `npm run build` e `npm run lint` puliti
- [ ] Prova cronometrata dello scenario reale: dall'apertura della home a un
      risultato leggibile con 2 chip, **sotto i 15 secondi**
- [ ] `docs/PROGETTAZIONE.md` aggiornato con la nuova vista (task di Munzner,
      idioma, giustificazione della codifica)
- [ ] `docs/DOMANDE-ESAME.md` aggiornato con la domanda prevedibile: "non è
      solo un motore di ricerca su un database?" — e la risposta
- [ ] Diff letto
