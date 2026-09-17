# "È già successo?" — Roadmap vista 1 a riquadri (post E4)

> **Roadmap storica (v3, chiusa).** Il progetto attuale è la v4 "Déjà vu": `docs/PROGETTAZIONE-v4.md`. La vista a riquadri descritta qui è in `/esplora`.

Contesto: il progetto (v3, `docs/PROGETTAZIONE.md`) è chiuso e consegnato
(fasi E0→E4). Questa roadmap copre un solo miglioramento mirato, deciso
dopo la consegna: la home (vista 1, "la scala della rarità") resta
com'è, ma **si affianca** una seconda forma della stessa vista — una
griglia di riquadri, uno per evento, raggruppati per famiglia, ognuno
colorato e con una risposta già pronta più un piccolo controllo che
aggiorna il numero sul posto. Un interruttore in home fa scegliere tra
le due.

**Decisioni prese, non da rimettere in discussione a ogni task:**

- **Si affianca, non si sostituisce.** `RarityScale.tsx` (asse
  logaritmico) resta intatto; nasce un componente nuovo accanto, non una
  riscrittura.
- **Ogni riquadro non è il compositore.** Mostra la risposta di default
  (già in `public/data/events/index.json`, nessuna nuova richiesta di
  rete) e, se l'evento ha un parametro, pochi bottoni compatti (i valori
  precalcolati, es. N=5/10/15/20) che cambiano SOLO il numero e la
  finestra mostrati nel riquadro — non un grafico D3 dentro la card.
  L'analisi profonda (grafici, tabella occorrenze, mappa) resta nel
  compositore (vista 2): il riquadro ci porta con un link, non lo
  duplica.
- **Raggruppati per famiglia.** Sezioni per famiglia (stesso ordine e
  stessi colori di `FAMILY_LEGEND` in `src/lib/colors.ts`), dentro ogni
  sezione i riquadri ordinati per rarità (dal più comune al più raro),
  stessa convenzione di `dedupeToDefaultParams` già usata da
  `RarityScale`.
- **Il colore codifica la famiglia, mai la rarità** — stessa regola
  vincolante di sezione 7 di `PROGETTAZIONE.md`, vale anche qui.
- **Niente D3 dentro il riquadro.** Il riquadro è HTML/CSS + React puro
  (bottoni, testo): D3 resta per le viste che già lo usano. Non è una
  violazione della "regola sul D3" del corso, perché il riquadro non
  disegna assi/scale/data-join — è una card di testo con un piccolo
  stato locale.
- **Un task per volta**, nell'ordine qui sotto, nell'ordine dato. Si legge il diff
  prima di ogni commit (stessa regola delle roadmap precedenti). Si
  lavora su `main`, senza branch, salvo diversa indicazione tua.

---

## Avanzamento generale

- [x] Fase R0 — Allineamento e convenzioni
- [x] Fase R1 — Il componente EventCard
- [x] Fase R2 — La griglia raggruppata per famiglia
- [x] Fase R3 — L'interruttore in home
- [x] Fase R4 — Rifinitura, accessibilità, verifica finale

Ordine dei task: R0.1 → R1.1 → R1.2 → R2.1 → R3.1 → R4.1 → R4.2.

---

# Fase R0 — Allineamento e convenzioni

## R0.1 — Lettura e piano dei dati

Nessuna riga di codice in questo task: serve a leggere i file giusti e a
fissare per iscritto, prima di scrivere, da dove vengono i dati di ogni
riquadro (niente nuove richieste di rete).

- [x] Task svolto
- [x] Confermato che ogni riquadro usa solo dati già in
      `public/data/events/index.json` (una voce per ogni combinazione
      evento+parametro, già tutte precalcolate)
- [x] Confermata la lista di helper esistenti da riusare (non
      reimplementare): `formatBigAnswer`, `formatWindow`,
      `formatDrought`, `parameterSuffix`, `formatParameterValue`,
      `unitLabel`, `dedupeToDefaultParams`, `familyColor`, `familyLabel`,
      `FAMILY_LEGEND` (`src/lib/eventCatalog.ts`, `src/lib/colors.ts`)

**Specifica del task:**

```
Leggi src/app/page.tsx, src/components/charts/RarityScale.tsx e
src/lib/eventCatalog.ts per intero, e docs/PROGETTAZIONE.md sezione 7
(le regole su colore e D3) e sezione 5.2 (finestra sempre insieme al
numero).

Non scrivere ancora codice. Dimmi:
1. Conferma che public/data/events/index.json ha già, per ogni
   combinazione evento+parametro, occorrenze/denominatore/rarita/
   ultimaOccorrenza/siccitaGareCorrente/siccitaAnniCorrente/annoDa/annoA
   — cioè che un riquadro con un controllo a bottoni per il parametro
   può cambiare risposta SENZA fare nessuna richiesta di rete, solo
   leggendo array già in memoria lato client.
2. Elenca gli helper di src/lib/eventCatalog.ts e src/lib/colors.ts che
   il nuovo componente deve riusare invece di reimplementare
   (formatBigAnswer, formatWindow, formatDrought, parameterSuffix,
   unitLabel, familyColor, familyLabel, FAMILY_LEGEND, dedupeToDefaultParams).
3. Proponi la struttura dati TypeScript per raggruppare gli eventi per
   famiglia (una Map<famiglia, CatalogEventEntry[]> o simile), ordinata
   per rarità dentro ogni famiglia — senza ancora scriverla nei file.

Non toccare nessun file in questo task: è solo un allineamento.
```

---

# Fase R1 — Il componente EventCard

## R1.1 — La card di un singolo evento

Dipende da: R0.1

- [x] Task svolto
- [x] `EventCard` mostra: nome evento (+ suffisso parametro corrente),
      famiglia (colore), risposta grande (`formatBigAnswer`), finestra
      (`formatWindow`), siccità se presente (`formatDrought`)
- [x] Se l'evento ha un parametro, appaiono bottoni compatti per i valori
      disponibili (`parametriDisponibili`); cliccarne uno cambia SOLO il
      testo dentro la card (stato locale React, nessun D3, nessuna
      richiesta di rete) — verificato passando da N=5 a N=20 e
      controllando che risposta/finestra si aggiornino
- [x] Un link/pulsante "Apri nel compositore →" porta a
      `/eventi/<eventId>` con il parametro corrente in query string
      (stessa convenzione già usata altrove nel sito per il deep link)
- [x] Card verificata isolata (anche solo in `/dev/chart-demo` o una
      pagina di prova) prima di passare a R2
- [x] Diff letto

**Specifica del task:**

```
Leggi docs/PROGETTAZIONE.md sezione 7 e src/lib/eventCatalog.ts.

Crea src/components/EventCard.tsx: un riquadro React puro (niente D3,
niente useEffect su un <svg>) per UN evento del catalogo.

Riceve come prop tutte le varianti (combinazioni parametro) di un
eventId già filtrate dal chiamante (stesso array che oggi popola
index.json per quell'eventId) — non deve leggere file, solo props.

Mostra:
- nome dell'evento + parametro corrente (parameterSuffix)
- una striscia o bordo colorato con familyColor(famiglia)
- la risposta grande con formatBigAnswer
- la finestra con formatWindow, sempre visibile (mai solo nel hover)
- la siccità con formatDrought, se non è null

Se l'evento ha parametri (parametriDisponibili non vuoto), mostra un
gruppo di bottoni piccoli, uno per valore disponibile (es. 5/10/15/20).
Cliccare un bottone aggiorna SOLO lo stato locale del componente
(useState per l'indice della variante selezionata) e ridisegna i testi
sopra con i valori di quella variante — non richiede nulla al server,
i dati di tutte le varianti sono già nelle props.

In fondo, un link a /eventi/<eventId>?<paramKey>=<valoreCorrente> con
testo "Apri nel compositore →" (stesso stile del link già usato in
CompositoreClient.tsx per i link alle occorrenze).

Verifica visivamente il componente (anche temporaneamente dentro
src/app/dev/chart-demo o una pagina di prova), prova il cambio di
parametro cliccando i bottoni, e mostrami uno screenshot prima di dirmi
che funziona.
```

## R1.2 — Rifinitura interazione e stati limite

Dipende da: R1.1

- [x] Task svolto
- [x] Eventi SENZA parametro (parametriDisponibili vuoto) non mostrano
      bottoni fantasma e la card resta comunque ben proporzionata
      rispetto a quelle con bottoni (griglia non deve "saltare")
- [x] La famiglia "neutralizzazioni" mostra comunque la sua finestra
      2023-2024 diversa dalle altre, ben visibile (stessa regola
      vincolante di sezione 5.2: le finestre diverse non si confondono)
- [x] Stato hover/focus sui bottoni e sulla card verificato (tastiera
      inclusa: tab per navigare i bottoni, invio per attivarli)
- [x] Diff letto

**Specifica del task:**

```
Leggi src/components/EventCard.tsx che hai appena scritto.

Rifinisci questi casi limite, verificandoli nel browser uno per uno:
1. Un evento senza parametri (es. "vittoria al debutto assoluto"): la
   card non deve avere uno spazio vuoto dove andrebbero i bottoni, e
   deve restare alta uguale alle altre card della stessa griglia (usa
   un min-height o un placeholder invisibile, quello che rende la
   griglia più pulita).
2. Un evento della famiglia "neutralizzazioni" (finestra 2023-2024):
   verifica che la finestra mostrata sia inequivocabilmente diversa
   da quella di un evento 1950-2024 nella stessa griglia — stessa
   riga di PROGETTAZIONE.md sezione 5.2 già rispettata da RarityScale.
3. Accessibilità da tastiera: i bottoni dei parametri sono elementi
   <button> veri (non <div onClick>), il focus è visibile, e l'ordine
   di tab è quello naturale.

Mostrami screenshot dei tre casi.
```

---

# Fase R2 — La griglia raggruppata per famiglia

## R2.1 — EventCardsGrid

Dipende da: R1.2

- [x] Task svolto
- [x] Una sezione per famiglia, nello stesso ordine di `FAMILY_LEGEND`,
      con intestazione che usa `familyLabel`/`familyColor`
- [x] Dentro ogni sezione, le card ordinate per rarità (dal più comune
      al più raro), stesso criterio di `RarityScale`
- [x] Layout responsive: griglia a più colonne su schermi larghi, una
      colonna su mobile — verificato ridimensionando la finestra del
      browser (o `resize_window`), non solo a una risoluzione
- [x] Nessuna richiesta di rete aggiuntiva oltre a quella che oggi
      carica `index.json` in `src/app/page.tsx`
- [x] Diff letto

**Specifica del task:**

```
Leggi src/app/page.tsx (come legge e passa gli eventi oggi a
RarityScale) e src/lib/colors.ts (FAMILY_LEGEND, familyColor,
familyLabel).

Crea src/components/EventCardsGrid.tsx: raggruppa gli eventi (stesso
array CatalogEventEntry[] già letto in page.tsx) per famiglia, nello
stesso ordine di FAMILY_LEGEND. Per ogni famiglia disegna un'intestazione
di sezione (nome famiglia + il suo colore) e sotto una griglia CSS
(grid o flex-wrap) di EventCard, una per eventId, ordinate per rarità
crescente (dal più comune al più raro) dentro la sezione.

Ogni EventCard riceve tutte le sue varianti di parametro (filtra
l'array completo per eventId, non serve un secondo file).

Layout responsive: più colonne su schermi larghi, una colonna su
mobile. Verifica ridimensionando la finestra del browser (desktop e
mobile) e mostrami entrambi gli screenshot.
```

---

# Fase R3 — L'interruttore in home

## R3.1 — Toggle scala / riquadri

Dipende da: R2.1

- [x] Task svolto
- [x] Un interruttore ben visibile in home fa scegliere tra "La scala
      della rarità" (RarityScale, esistente) e "I riquadri"
      (EventCardsGrid, nuovo)
- [x] La scelta è solo stato client (nessuna nuova route necessaria),
      di default resta la vista esistente (RarityScale) finché l'utente
      non sceglie l'altra — non cambiare il comportamento di default di
      chi apre il sito per la prima volta
- [x] Testo introduttivo della sezione aggiornato per spiegare che sono
      due modi di vedere lo stesso catalogo, non due cataloghi diversi
- [x] Verificato nel browser: passaggio avanti e indietro tra le due
      viste senza errori console, hover/tooltip di RarityScale ancora
      funzionanti dopo il passaggio
- [x] `npm run build` e `npm run lint` puliti
- [x] Diff letto

**Specifica del task:**

```
Leggi src/app/page.tsx e i due componenti RarityScale.tsx ed
EventCardsGrid.tsx.

Aggiungi in src/app/page.tsx un interruttore (due pulsanti o un
segmented control, stile coerente col resto del sito) che scelga quale
delle due viste mostrare sotto il testo introduttivo: "La scala della
rarità" (RarityScale, il default per chi apre il sito la prima volta)
oppure "I riquadri" (EventCardsGrid). È solo stato React locale
(useState), non serve una route o querystring nuova.

Aggiorna il paragrafo introduttivo della sezione perché spieghi che
sono due modi di leggere lo stesso catalogo di eventi, non due cataloghi
diversi.

Verifica nel browser: passa da una vista all'altra più volte, controlla
che non ci siano errori in console e che RarityScale (tooltip, hover,
click sugli eventi) funzioni ancora esattamente come prima. Fai girare
npm run build e npm run lint e sistema quello che esce. Mostrami
screenshot di entrambe le viste.
```

---

# Fase R4 — Rifinitura, accessibilità, verifica finale

## R4.1 — Passata di qualità

Dipende da: R3.1

- [x] Task svolto
- [x] Contrasto testo/sfondo verificato per tutti i colori di famiglia
      usati nelle intestazioni (non solo a occhio: controllo dei valori)
- [x] Nessun evento del catalogo manca dalla griglia a riquadri (stesso
      numero di eventId distinti di RarityScale)
- [x] Le 4-5 domande da esame più prevedibili su questa vista hanno una
      risposta pronta (perché due viste per lo stesso catalogo, perché
      niente D3 nelle card, dove sta l'analisi profonda)
- [x] Diff letto, commit e push

**Specifica del task:**

```
Ultimo giro per la vista a riquadri. Fai queste cose e mostrami il diff
prima di ogni commit:

1. Controlla il contrasto testo/sfondo di ogni colore di famiglia
   (src/lib/colors.ts) usato nelle intestazioni di sezione e nei bordi
   delle card: deve restare leggibile su sfondo scuro.
2. Verifica che il numero di eventId distinti mostrati in
   EventCardsGrid coincida esattamente con quello di RarityScale (33,
   o quanti sono nel catalogo in quel momento) — nessun evento perso
   nel raggruppamento per famiglia.
3. Fai girare npm run build e npm run lint un'ultima volta.
4. Prepara mentalmente (non serve scriverle da nessuna parte a meno che
   te lo chieda) le risposte a: "perché due viste diverse per lo stesso
   catalogo?", "perché i riquadri non hanno grafici D3?", "dove faccio
   l'analisi vera di un evento?" — devono discendere naturalmente dalle
   decisioni già prese in questa roadmap (overview leggera + compositore
   per l'analisi).
```

## R4.2 — (facoltativo) Filtro famiglia sopra la griglia

Dipende da: R4.1, solo se vuoi anche potere nascondere/isolare famiglie

- [x] Task svolto, solo se richiesto esplicitamente
- [x] Pulsanti per famiglia sopra la griglia (stesso stile del
      hover-per-evidenziare già usato nella legenda di RarityScale, ma
      qui filtra invece di solo evidenziare)
- [x] Nessuna famiglia nascosta di default all'apertura della pagina

**Specifica del task:**

```
Leggi src/components/EventCardsGrid.tsx.

Aggiungi sopra la griglia un filtro per famiglia: pulsanti (uno per
famiglia, stile coerente con la legenda di RarityScale) che quando
cliccati nascondono le altre famiglie invece di limitarsi a
evidenziarle. Nessuna famiglia nascosta di default. Verifica nel
browser e mostrami uno screenshot con un filtro attivo.
```
