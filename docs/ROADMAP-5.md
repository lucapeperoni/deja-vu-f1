# "È già successo?" — Roadmap "Nel tempo" (fiume delle famiglie)

> **Roadmap storica (v3, chiusa).** Il progetto attuale è la v4 "Déjà vu": `docs/PROGETTAZIONE-v4.md`. Il fiume delle famiglie descritto qui è in `/esplora`.

Contesto: dopo la roadmap R (vista a riquadri, `docs/ROADMAP-4.md`, chiusa), questo
secondo miglioramento nasce dal confronto tra il progetto e le slide del corso di
Visualizzazione delle Informazioni. Tra le tecniche viste (stream graph/ThemeRiver,
box/violin plot, small multiples, ecc.) se ne sono scelte due da portare nel
progetto: questa roadmap copre la prima, uno **stream graph** che mostra come
cambia nel tempo il *mix* di famiglie del catalogo eventi — una domanda che oggi
il sito non copre (la vista 1 risponde "quanto è raro", QuandoStrip nel
compositore risponde "quando è successo *questo* evento", nessuna vista risponde
"come si distribuiscono le famiglie di eventi lungo le stagioni").

**Decisioni prese, non da rimettere in discussione a ogni task:**

- **È una vista nuova a sé, non una modifica di QuandoStrip.** Uno stream graph
  ha senso solo con più serie impilate insieme (le famiglie); QuandoStrip mostra
  sempre UN evento alla volta nel compositore, quindi ci produrrebbe una fascia
  sola, degenere. QuandoStrip resta intatto a fare il suo lavoro (dettaglio +
  brush di un singolo evento/parametro).
- **Vive in home, come terza forma della vista 1** (accanto a "La scala della
  rarità" e "I riquadri", roadmap R3.1): stesso catalogo, tre modi di leggerlo.
  L'interruttore in `HomeCatalogView.tsx` passa da 2 a 3 opzioni.
- **Il colore codifica sempre la famiglia**, mai la quantità — stessa regola
  vincolante di `docs/PROGETTAZIONE.md` sezione 7, stessa palette già validata
  in `src/lib/colors.ts` (`FAMILY_LEGEND`, `familyColor`), nessuna nuova tinta.
- **Nessuna richiesta di rete nuova, nessuna modifica alla pipeline Python.** I
  dati grezzi ci sono già: ogni file `public/data/events/<eventId>.json` ha
  `perStagione` (occorrenze per anno) per il parametro di default. L'aggregazione
  per famiglia×anno si fa lato server in un componente Next.js che legge questi
  33 file già precalcolati — lo stesso pattern già usato in
  `src/app/eventi/[eventId]/page.tsx` per altre aggregazioni — non un nuovo
  script `data-layer/`.
- **D3 possiede l'intero `<svg>`** (scale, stack layout, area generator, data
  join, transizioni) dentro un unico `useEffect`, React tiene solo ref/stato di
  hover-tooltip — stessa convenzione di `RarityScale.tsx`.
- **Responsive fin dal primo task**, non una larghezza fissa da correggere
  dopo: `RarityScale.tsx` ha già il pattern giusto da riusare (misura il
  contenitore con `ResizeObserver`, niente costante `WIDTH` indovinata a mano —
  vedi commit "Riduce lo spazio nero sprecato ai lati").
- **Un task per volta**, nell'ordine qui sotto, nell'ordine dato. Si legge il diff prima di
  ogni commit. Si lavora su `main`, senza branch, salvo diversa indicazione tua.

---

## Avanzamento generale

- [x] Fase T0 — Allineamento e piano dati
- [x] Fase T1 — Il componente FamilyStream (dati finti, isolato)
- [x] Fase T2 — Dati reali (aggregazione famiglia×anno)
- [x] Fase T3 — Integrazione in home (interruttore a 3 vie)
- [x] Fase T4 — Interazione, rifinitura, verifica finale

Ordine dei task: T0.1 → T1.1 → T2.1 → T3.1 → T4.1.

---

# Fase T0 — Allineamento e piano dati

## T0.1 — Lettura e piano dati

Nessuna riga di codice in questo task: serve a confermare da dove vengono i
dati e con che struttura, prima di scrivere il componente.

- [x] Task svolto
- [x] Confermato che `perStagione` (occorrenze per anno) esiste per il
      parametro di default di ogni evento, in ciascuno dei 33 file
      `public/data/events/<eventId>.json`
- [x] Confermato l'elenco di helper esistenti da riusare:
      `dedupeToDefaultParams`, `FAMILY_LEGEND`, `familyColor`, `familyLabel`
      (`src/lib/eventCatalog.ts`, `src/lib/colors.ts`)
- [x] Proposta la struttura dati TypeScript per il grafico (es.
      `{ anno: number; famiglia: string; occorrenze: number }[]`, o una
      struttura già pronta per `d3.stack`), senza ancora scriverla nei file

**Specifica del task:**

```
Leggi src/components/charts/QuandoStrip.tsx per intero (è il riferimento più
vicino: asse temporale 1950-2024, brush, convenzione D3 del progetto), e
src/lib/eventCatalog.ts, src/lib/colors.ts, src/app/page.tsx.

Leggi anche un file eventi a caso, es. public/data/events/pole_finita_con_ritiro.json,
e conferma la forma esatta di perParametro[i].perStagione (anno -> occorrenze)
per il parametro di default.

Non scrivere ancora codice. Dimmi:
1. Conferma che per costruire uno stream graph "famiglia x anno" bastano i 33
   file public/data/events/<eventId>.json già esistenti (uno per eventId di
   dedupeToDefaultParams), sommando perStagione del parametro di default per
   ogni evento dentro la sua famiglia — nessun nuovo file, nessuna modifica a
   data-layer/scripts/build_events.py.
2. Proponi la struttura dati TypeScript che il componente D3 riceverà come
   prop (pensa a cosa serve a d3.stack: una riga per anno, una colonna per
   famiglia), e dove la calcoleresti (in un file src/lib/ dedicato o dentro
   page.tsx), senza ancora scriverla nei file.
3. Conferma che il colore di ogni fascia userà familyColor (stessa palette di
   RarityScale/EventCardsGrid), mai una scala quantitativa.

Non toccare nessun file in questo task: è solo un allineamento.
```

---

# Fase T1 — Il componente FamilyStream (dati finti, isolato)

## T1.1 — Lo stream graph D3

Dipende da: T0.1

- [x] Task svolto
- [x] `FamilyStream.tsx` disegna uno stream/stacked area chart con `d3.stack` +
      `d3.area` (curva morbida, es. `curveBasis` o `curveMonotoneX`), un livello
      per famiglia, colore `familyColor`, asse X anni 1950-2024
- [x] Larghezza del grafico misurata dal contenitore reale (`ResizeObserver`,
      stesso pattern di `RarityScale.tsx`) fin da subito, non una costante fissa
- [x] Legenda sotto il grafico (stesso stile della legenda di `RarityScale`),
      hover su una voce evidenzia quella fascia e attenua le altre
- [x] Tooltip on hover con anno, famiglia, numero di occorrenze in quell'anno
      (stesso componente `ChartTooltip` già usato altrove)
- [x] Verificato isolato con dati finti (es. `src/app/dev/family-stream-demo`),
      screenshot mostrato prima di dire che funziona
- [x] Diff letto

**Specifica del task:**

```
Leggi docs/PROGETTAZIONE.md sezione 7 (regole su colore e D3) e
src/components/charts/RarityScale.tsx per intero (è il riferimento per il
pattern responsive con ResizeObserver e per come si struttura un componente
D3 di questo progetto).

Crea src/components/charts/FamilyStream.tsx: uno stream graph con d3.stack e
d3.area (curva morbida), un livello per famiglia del catalogo eventi, colore
familyColor per ciascuna. Asse X: anni 1950-2024. Nessun asse Y esplicito se
usi un offset wiggle/silhouette (va bene anche un semplice stacked "zero" con
asse Y se preferisci più leggibilità dei valori assoluti — scegli tu e
motiva la scelta in un commento).

La larghezza del grafico va misurata dal contenitore reale con un
ResizeObserver, esattamente come già fa RarityScale.tsx (niente costante
WIDTH fissa: abbiamo già dovuto correggere quell'errore una volta in
RarityScale, non ripeterlo qui).

Sotto il grafico, una legenda (stesso stile di quella in fondo a
RarityScale.tsx): hover su una famiglia evidenzia quella fascia e attenua le
altre. Al passaggio del mouse su una fascia, un tooltip (riusa
ChartTooltip.tsx) mostra anno, nome famiglia, numero di occorrenze.

Riceve come prop dati già pronti: { anno: number; famiglia: string;
occorrenze: number }[] (o la struttura che hai proposto nel task T0.1).

Per ora usa dati finti plausibili (varie famiglie, 1950-2024, valori a
piacere) in una pagina di prova temporanea src/app/dev/family-stream-demo,
stessa convenzione delle demo già esistenti (src/app/dev/event-card-demo
ecc.). Verifica nel browser hover/tooltip/legenda e ridimensionando la
finestra, mostrami gli screenshot prima di dirmi che funziona.
```

---

# Fase T2 — Dati reali (aggregazione famiglia×anno)

## T2.1 — Dalla pipeline già esistente al grafico

Dipende da: T1.1

- [x] Task svolto
- [x] Funzione/loader che legge i 33 file `public/data/events/<eventId>.json`
      (uno per eventId di `dedupeToDefaultParams`), estrae `perStagione` del
      parametro di default, e aggrega per famiglia×anno nella struttura decisa
      in T0.1
- [x] Nessuna richiesta di rete lato client: l'aggregazione avviene server-side
      (component `async function`, `fs.readFileSync`), stesso pattern già usato
      in `src/app/eventi/[eventId]/page.tsx`
- [x] `FamilyStream` collegato ai dati reali al posto dei dati finti nella
      pagina di prova
- [x] Verificato che la somma delle occorrenze per famiglia nel grafico
      coincida con `occorrenze` del catalogo per quella famiglia (nessun anno
      perso, nessun doppio conteggio)
- [x] Diff letto

**Specifica del task:**

```
Leggi src/app/eventi/[eventId]/page.tsx (come legge più file JSON e aggrega
lato server) e src/components/charts/FamilyStream.tsx che hai appena scritto.

Scrivi la funzione che aggrega i dati reali: per ogni eventId di
dedupeToDefaultParams(catalog), leggi public/data/events/<eventId>.json,
prendi perParametro[0].perStagione (il parametro di default) e somma le
occorrenze per famiglia e anno nella struttura che FamilyStream si aspetta.
Metti la funzione in un file dedicato (es. src/lib/familyTimeline.ts) o dentro
la pagina di prova, a tua scelta, purché resti server-side (nessuna richiesta
di rete dal browser).

Aggiorna src/app/dev/family-stream-demo per usare i dati reali invece di
quelli finti.

Verifica con uno script o un log temporaneo che la somma delle occorrenze nel
grafico, per ogni famiglia, coincida con la somma di "occorrenze" nel
catalogo (public/data/events/index.json) per quella famiglia — nessun anno
perso, nessun evento doppio-contato. Mostrami il risultato di questa verifica
prima di procedere, poi uno screenshot del grafico con i dati veri.
```

---

# Fase T3 — Integrazione in home (interruttore a 3 vie)

## T3.1 — Terza opzione nel toggle

Dipende da: T2.1

- [x] Task svolto
- [x] `HomeCatalogView.tsx` passa da un interruttore a 2 vie a 3 vie: "La scala
      della rarità" (default), "I riquadri", e la nuova vista — "Il fiume
      delle famiglie" (nome scelto per coerenza stilistica con le altre due
      etichette)
- [x] La persistenza già esistente (`sessionStorage` + `useSyncExternalStore`,
      roadmap R3.1) si estende alle 3 opzioni senza perdere la scelta tornando
      indietro dal compositore (stesso bug già risolto una volta, non
      ripresentarlo) — verificato esplicitamente
- [x] Il paragrafo introduttivo della sezione aggiornato per spiegare le tre
      letture dello stesso catalogo, non tre cataloghi diversi
- [x] Verificato nel browser: passaggio tra le tre viste più volte, nessun
      errore console, le altre due viste continuano a funzionare come prima
- [x] `npm run build` e `npm run lint` puliti
- [x] Diff letto

**Specifica del task:**

```
Leggi src/components/HomeCatalogView.tsx e src/app/page.tsx.

Aggiungi la terza opzione al segmented control esistente: "Nel tempo" (o un
nome che ti sembra più coerente con "La scala della rarità" e "I riquadri" —
proponilo), che mostra FamilyStream con i dati reali (stessa funzione di
aggregazione di T2.1, chiamata da page.tsx insieme a catalog/events già
letti).

La persistenza in sessionStorage (useSyncExternalStore, roadmap R3.1) deve
continuare a funzionare con 3 valori invece di 2: verifica esplicitamente
che tornando indietro dal compositore dopo aver scelto "Nel tempo" la home
resti su quella vista, esattamente come già succede per "I riquadri" (stesso
bug, stessa soluzione, non un caso nuovo).

Aggiorna il paragrafo introduttivo della sezione per spiegare le tre letture
dello stesso catalogo di eventi.

Verifica nel browser: passa tra le tre viste più volte, controlla che non ci
siano errori in console e che RarityScale (tooltip/hover) ed EventCardsGrid
(filtro famiglia) funzionino ancora esattamente come prima. Fai girare npm
run build e npm run lint e sistema quello che esce. Mostrami screenshot delle
tre viste.
```

---

# Fase T4 — Interazione, rifinitura, verifica finale

## T4.1 — Passata di qualità

Dipende da: T3.1

- [x] Task svolto
- [x] Decisione esplicita presa (e motivata in un commento) su hover-evidenzia
      (come la legenda di `RarityScale`) vs click-isola-famiglia (come il
      filtro di `EventCardsGrid`) per la legenda di `FamilyStream` — scelto
      click-isola, motivato in codice; il click funziona anche direttamente
      sulla fascia nel grafico, non solo sulla legenda
- [x] Contrasto verificato per le fasce sottili delle famiglie già note come
      critiche (indigo `griglia_e_risultato`, vinaccia `team` — stesso
      problema già risolto in roadmap R4.1): bordo bianco translucido
      aggiunto a ogni fascia (stessa tecnica di R4.1)
- [x] Tooltip e legenda accessibili da tastiera (stesso standard di
      `EventCard`: elementi `<button>` veri, `aria-pressed`, focus visibile
      confermato via screenshot — attivazione Invio/Spazio non verificabile
      nel browser automatizzato di test, limite dell'ambiente non del codice)
- [x] Responsive verificato a tre risoluzioni (mobile, laptop ~1280px, monitor
      largo ~2000px), nessun overflow di pagina
- [x] `npm run build` e `npm run lint` puliti, commit e push

**Specifica del task:**

```
Ultimo giro per "Nel tempo". Fai queste cose e mostrami il diff prima di ogni
commit:

1. Decidi (e motiva in un commento nel codice) se la legenda di FamilyStream
   deve solo evidenziare al hover (come RarityScale) o isolare la famiglia al
   click (come il filtro di EventCardsGrid) — scegli quella che ha più senso
   per capire l'andamento di UNA famiglia nel tempo, e implementala se non
   l'avevi già fatto in T1.1.
2. Verifica il contrasto delle fasce più sottili, in particolare per le
   famiglie già segnalate come critiche in roadmap R4.1 (griglia_e_risultato,
   team): se una fascia troppo sottile diventa illeggibile, applica la stessa
   tecnica già usata lì (bordo chiaro) o proponi un'alternativa.
3. Verifica l'accessibilità da tastiera di legenda e tooltip.
4. Verifica la responsività ridimensionando il browser (mobile, laptop
   1280px, monitor largo 2000px) — nessun overflow di pagina, il grafico deve
   riempire il contenitore reale in ogni caso (stesso pattern ResizeObserver
   già usato).
5. Fai girare npm run build e npm run lint un'ultima volta.

Mostrami screenshot delle tre risoluzioni prima di committare.
```
