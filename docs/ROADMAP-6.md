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

- [ ] Fase S0 — Allineamento e piano dati (nessun codice)
- [ ] Fase S1 — L'indice delle occorrenze e il motore di match (lato client)
- [ ] Fase S2 — Il compositore a chip (ricerca + menu a macro-aree)
- [ ] Fase S3 — Lo scaffale delle corrispondenze (la vista D3)
- [ ] Fase S4 — La frase in chiaro e la finestra che si restringe
- [ ] Fase S5 — La nuova home e l'area "Esplora"
- [ ] Fase S6 — Rifinitura, accessibilità, verifica finale

Ordine dei prompt: S0.1 → S1.1 → S1.2 → S2.1 → S2.2 → S3.1 → S4.1 → S5.1 → S6.1.

---

# Fase S0 — Allineamento e piano dati

## S0.1 — Lettura e piano

Nessuna riga di codice: serve a fissare le strutture dati prima di scriverle,
e a decidere le due cose che ancora non sono decise (il denominatore composto e
la forma dell'indice).

- [ ] Prompt eseguito
- [ ] Confermata la forma esatta di `occorrenzeDettaglio` per tutte e tre le
      unità (`RISULTATO`, `GARA`, `TEAM_GARA`) e le differenze di chiave tra
      loro (`driverId` singolo vs `driverIds`/`driverId1`+`driverId2`)
- [ ] Deciso **come si calcola il denominatore di uno scenario composto**
      (proposta di partenza: gare nella finestra intersecata da
      `races-index.json` per gli scenari a livello gara; risultati nella stessa
      finestra per quelli a livello pilota — ma va confermato leggendo come
      `engine.py` calcola oggi `denominatore`, per non dare due numeri diversi
      per la stessa domanda)
- [ ] Proposte le strutture TypeScript: il chip (unione discriminata sui 5
      tipi), l'indice delle occorrenze, il risultato di un match
- [ ] Confermato che nessun file in `data-layer/` o `scripts/` va toccato

**Prompt da copiare:**

```
Leggi per intero: src/lib/eventCatalog.ts, src/lib/colors.ts,
src/app/eventi/[eventId]/page.tsx, src/components/charts/QuandoStrip.tsx,
e data-layer/app/events/engine.py (in particolare come calcola "denominatore"
e "rarita" per le tre unita RISULTATO / GARA / TEAM_GARA).

Guarda anche la forma di occorrenzeDettaglio in tre file diversi, uno per
unita: public/data/events/vittoria_da_griglia.json (RISULTATO),
public/data/events/doppietta.json (GARA),
public/data/events/doppio_ritiro.json (TEAM_GARA).

Non scrivere codice. Dimmi:

1. La forma esatta di occorrenzeDettaglio per ciascuna delle tre unita, e come
   normalizzarle in UN tipo comune che porti sempre: raceId, anno, circuitRef,
   e la lista dei piloti e dei team coinvolti (liste, anche quando ce n'e' uno
   solo).

2. Come calcolare il denominatore di uno scenario composto da piu chip, in modo
   COERENTE con quello che engine.py gia' fa per un evento singolo (non
   vogliamo che la stessa domanda dia due numeri diversi a seconda della
   pagina). Dimmi da dove prendi il conteggio delle unita nella finestra
   intersecata.

3. Le strutture TypeScript che proponi: il tipo Chip (unione discriminata sui
   5 tipi evento/pilota/team/circuito/era), l'indice in memoria, e il tipo del
   risultato di un match (che deve poter dire, per ogni occorrenza trovata,
   QUALI chip reggono e QUALI no).

4. Conferma che tutto si fa leggendo i file gia' presenti in public/data/,
   senza toccare data-layer/ ne' scripts/build_events.py.
```

---

# Fase S1 — L'indice delle occorrenze e il motore di match

## S1.1 — L'indice in memoria

Dipende da: S0.1

- [ ] Prompt eseguito
- [ ] `src/lib/scenarioIndex.ts` costruisce, dai file eventi già esistenti, un
      indice normalizzato delle occorrenze (una riga per occorrenza, chiavi
      `raceId` / piloti / team / circuito / anno)
- [ ] L'indice è costruito **lato server** in un componente Next.js (stesso
      pattern di `src/lib/familyTimeline.ts`) e passato al client già pronto,
      oppure caricato una volta sola: scegliere e motivare in un commento
- [ ] Verificato con un conteggio: per un evento singolo con un solo chip, il
      motore deve restituire **esattamente** le occorrenze e la rarità già
      scritte in `index.json` (se differisce, è un bug del motore, non del dato)
- [ ] Diff letto

**Prompt da copiare:**

```
Crea src/lib/scenarioIndex.ts seguendo le strutture concordate in S0.1.

Deve costruire un indice normalizzato di tutte le occorrenze dei 33 eventi
(parametro di default + parametri alternativi), leggendo i file
public/data/events/<eventId>.json gia' esistenti. Guarda
src/lib/familyTimeline.ts come riferimento per come questo progetto aggrega
quei file lato server.

Requisito di correttezza non negoziabile: con UN SOLO chip evento, il numero di
occorrenze e la rarita' calcolati da questo indice devono coincidere ESATTAMENTE
con "occorrenze", "denominatore" e "rarita" gia' scritti in
public/data/events/index.json per quell'evento e quel parametro. Scrivi un
controllo che lo verifichi su tutti e 33 gli eventi e mostrami l'esito prima di
dire che funziona. Se qualcosa non torna, fermati e dimmi cosa.

Non toccare data-layer/ ne' scripts/.
```

## S1.2 — Il motore di match a cascata

Dipende da: S1.1

- [ ] Prompt eseguito
- [ ] `src/lib/scenarioMatch.ts`: dati K chip, restituisce le occorrenze
      raggruppate per **numero di chip soddisfatti** (K, K-1, … 1), e per
      ciascuna occorrenza l'elenco dei chip che reggono e di quelli che saltano
- [ ] Implementata la regola "stesso pilota" / "stessa gara" come parametro
      esplicito della funzione, con il default dedotto come da decisioni sopra
- [ ] Calcolata la **finestra di copertura intersecata** e il denominatore
      composto secondo la decisione di S0.1
- [ ] Calcolata la percentuale di similarità con i pesi letti da `params.json`
      (nessun peso scritto a mano nel codice TypeScript)
- [ ] Verificato su almeno tre scenari a mano, con i numeri mostrati
- [ ] Diff letto

**Prompt da copiare:**

```
Crea src/lib/scenarioMatch.ts sopra l'indice di S1.1.

Firma: dati K chip (evento/pilota/team/circuito/era) e la modalita' di join
("stessa gara" | "stesso pilota"), restituisce le occorrenze raggruppate per
quanti chip soddisfano: K su K, K-1 su K, ... fino a 1. Per ogni occorrenza
deve dire QUALI chip reggono e QUALI saltano, perche' la UI mostrera' il nome
del chip mancante come "differenza".

La modalita' di join ha un default dedotto: "stesso pilota" se TUTTI i chip
evento sono di unita' RISULTATO, altrimenti "stessa gara" (con almeno un chip
di unita' GARA l'ambiguita' non esiste). La funzione deve restituire anche
quale default ha dedotto, perche' la UI lo scrivera' in chiaro.

Calcola inoltre: la finestra di copertura INTERSECATA tra i chip (il minimo
annoDa e il massimo annoA che valgono per tutti), il denominatore composto
secondo la decisione presa in S0.1, e una percentuale di similarita' = quota
dei chip soddisfatti pesati per la loro rarita'. I pesi vanno letti da
public/data/params.json (aggiungi la voce sotto "eventi", accanto a
pesiNotevolezza): NON scrivere costanti numeriche nel codice TypeScript.

Verifica a mano tre scenari e mostrami i numeri:
- "vittoria partendo 10 o peggio" + "a Monza"
- "vittoria partendo 10 o peggio" + un chip di neutralizzazioni (2023-2024):
  qui la finestra intersecata deve crollare a 46 gare, mostrami che succede
- tre chip insieme, di cui almeno uno che non fa match con nessuno (il caso
  "mai successo", che deve dare 0 su K esatti ma dei K-1)
```

---

# Fase S2 — Il compositore a chip

## S2.1 — Il menu a macro-aree

Dipende da: S1.2

- [ ] Prompt eseguito
- [ ] `src/components/scenario/EventPicker.tsx`: navigazione gerarchica
      famiglia (9) → evento → parametro, stile "Comandi" iOS — una colonna che
      scende di livello, con la briciola di pane per tornare su
- [ ] Ogni voce mostra già la sua rarità e la sua finestra (chi sceglie deve
      sapere cosa sta scegliendo prima di sceglierlo)
- [ ] Selezionare una voce **emette un chip**, non naviga da nessuna parte
- [ ] Verificato in isolamento in `src/app/dev/`, screenshot mostrato
- [ ] Diff letto

## S2.2 — La barra di ricerca e la riga dei chip

Dipende da: S2.1

- [ ] Prompt eseguito
- [ ] Una sola barra cerca su tutti e cinque i tipi insieme (eventi, piloti,
      team, circuiti, ere), risultati raggruppati per tipo, tastiera funzionante
      (frecce + invio, senza mouse)
- [ ] I chip scelti si accumulano in una riga sopra il risultato, ognuno
      rimovibile; i chip `evento` restano modificabili nei parametri
- [ ] Il menu di S2.1 è raggiungibile da lì, come alternativa alla digitazione
- [ ] Diff letto

---

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
