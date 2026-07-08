# Chaos Discount — Roadmap con checklist (per Notion)

Regole rapide: un task = una sessione di Claude Code (Sonnet 5, reasoning
medio) aperta nella cartella `F1AnalyticsVisual`. Ogni task qui sotto ha la
sua checklist: si spunta ogni voce man mano, e il task è finito solo quando
sono spuntate tutte. Se un criterio non è soddisfatto, si continua nella
stessa sessione di Claude spiegando cosa non va, senza ricominciare.

Persone: **A** = dati/pipeline · **B** = viste principali · **C** = viste
secondarie e interazione.

---

## Avanzamento generale

- [ ] Fase 0 — Allineamento
- [ ] Fase 1 — De-risking dei dati ⚠ MILESTONE
- [ ] Fase 2 — Pipeline completa
- [ ] Fase 3 — Le viste
- [ ] Fase 4 — Coordinamento e metodologia
- [ ] Fase 5 — Storytelling e rifinitura

---

# Fase 0 — Allineamento (giorno 1)

## 0.1 — Tutti · Lettura condivisa

- [ ] A ha letto `docs/PROGETTAZIONE.md` per intero
- [ ] B ha letto `docs/PROGETTAZIONE.md` per intero
- [ ] C ha letto `docs/PROGETTAZIONE.md` per intero
- [ ] Deciso chi è A, chi è B, chi è C

Nessun prompt: si fa con gli occhi. Le decisioni prese nella specifica non
si ridiscutono nei prompt.

## 0.2 — A · Fotografia dello stato del repo

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] `docs/STATO.md` esiste
- [ ] Dice fino a quale gara arrivano i dati Kaggle 2024
- [ ] Distingue chiaramente cosa è mock e cosa è reale
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md (è la specifica del progetto). Poi esplora il
repository e scrivi in docs/STATO.md una fotografia onesta dello stato
attuale: (1) quali componenti frontend esistono e quali girano su dati mock
(cerca race-anatomy-mock.json e simili); (2) cosa fa oggi il data-layer
Python: quali script girano davvero, cosa c'è nel database
data-layer/race_dynamics.db, quali sessioni OpenF1 sono già state scaricate
in data-layer/data/raw; (3) quali CSV Ergast ci sono in data/raw e che
intervallo di anni copre races.csv (in particolare: fino a che gara arriva
il 2024?); (4) un elenco puntato di ciò che è da buttare, da tenere, da
riscrivere secondo la specifica. Non modificare nessun file di codice:
solo lettura e il nuovo file docs/STATO.md.
```

---

# Fase 1 — De-risking dei dati (settimana 1) ⚠ LA FASE PIÙ IMPORTANTE

Se questa fase fallisce, il progetto cambia forma. Va finita prima di
investire ore sulle viste.

## 1.1 — A · Riscrittura della metrica del costo pit stop ✅ COMPLETATO

Dipende da: 0.2

- [x] 0.2 completato
- [x] Prompt eseguito in una nuova sessione di Claude Code
- [x] I test unitari passano (output visto con i propri occhi)
- [x] La metrica legge i tempi giro dai CSV Ergast, non da OpenF1
- [x] Ogni pit riceve l'etichetta di contesto (GREEN, UNDER_VSC, ecc.)
- [x] `pit_duration` non è più usata come costo da nessuna parte
- [x] Diff letto, commit e push

**Nota (dopo la validazione 1.2)**: la formula qui sotto era corretta ma
incompleta. Sui giri sotto SC/VSC va usato come riferimento il ritmo del
gruppo in quel giro, non la baseline personale del pilota — altrimenti il
rallentamento imposto a tutti dalla Safety Car viene scambiato per costo
del pit stop. Il dettaglio, con i numeri della validazione, è in
`docs/PROGETTAZIONE.md` §5.1 (aggiornata) e nel codice
(`compute_field_reference_by_lap` in `effective_pit_loss.py`).

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, in particolare la sezione 5 (metriche). Il
modulo data-layer/app/metrics/effective_pit_loss.py oggi usa la pit_duration
di OpenF1 come proxy del costo del pit stop: è sbagliato, come spiegato
nella specifica (la durata in pit lane è uguale in verde e sotto Safety
Car). Riscrivilo così:

- Il costo effettivo di un pit stop al giro L per un pilota è:
  (tempo del giro L + tempo del giro L+1) - 2 * baseline del pilota,
  dove baseline = mediana dei tempi dei suoi giri "puliti" (senza pit stop
  e senza neutralizzazione attiva) in una finestra di ±5 giri attorno a L,
  escludendo i giri di entrata/uscita dai box. Se nella finestra ci sono
  meno di 3 giri puliti, allarga la finestra a tutto lo stint.
- I tempi giro arrivano dai CSV Ergast (data/raw/lap_times.csv), NON da
  OpenF1. OpenF1 serve solo per sapere in quali giri c'era SC o VSC
  (usa data-layer/app/metrics/neutralization_events.py).
- Il prezzo di listino (nominal pit loss) di una gara è la mediana dei
  costi effettivi dei pit fatti in condizioni verdi in quella gara; se sono
  meno di 4, segnalalo nel risultato con un flag low_confidence.
- Lo sconto (discount) è: prezzo di listino - costo effettivo.
- Ogni pit stop riceve anche l'etichetta di contesto definita nella sezione
  5.4 della specifica: GREEN, UNDER_VSC, UNDER_SC, JUST_BEFORE (pit in
  verde fino a 3 giri prima di un deployment), JUST_AFTER (entro 2 giri
  dalla fine), più il flag double_stack.

Mantieni i modelli Pydantic come interfaccia di output. Scrivi anche test
unitari con dati sintetici piccoli (una gara finta di 10 giri con una VSC)
che verificano: il calcolo della baseline, il costo effettivo, l'etichetta
di contesto, il caso JUST_BEFORE. Esegui i test e mostrami l'output.
```

## 1.2 — A · Validazione sulla gara campione ⚠ MILESTONE ✅ SUPERATA

Dipende da: 1.1

- [x] 1.1 completato
- [x] Prompt eseguito in una nuova sessione di Claude Code
- [x] La tabella pilota/giro/etichetta/costo/sconto è stata stampata
- [x] I giri totali Ergast e OpenF1 coincidono (62 giri, Singapore GP 2023)
- [x] Pit in verde: costo 27-32 secondi — coerente (Singapore ha una pit
      lane molto lunga, il range "20-25s" della specifica era generico)
- [ ] Pit sotto VSC: sconto circa 8-12 secondi — **NON torna** (misto, per
      lo più leggermente negativo). Limite noto di granularità, da
      dichiarare in `/methodology` (task 4.2), vedi PROGETTAZIONE.md §5.1
- [x] Pit sotto SC: sconto positivo e coerente (+4/+17s su 14 casi), dopo
      aver corretto il riferimento usato nel calcolo (vedi nota sotto)
- [x] Diff letto, commit e push
- [x] **MILESTONE superata: comunicato a B e C che la Fase 2 può partire**

**Esito reale di questa validazione** (più articolato di un semplice
sì/no): la prima esecuzione ha mostrato numeri assurdi (sconti negativi di
60-100s sotto SC). Investigando sono stati trovati e corretti tre problemi,
non solo uno:

1. bug in `neutralization_events.py`: chiudeva le finestre SC/VSC troppo
   presto su bandiere "CLEAR" di settore scollegate dalla Safety Car;
2. bug nello stesso file introdotto durante il primo fix: "VIRTUAL SAFETY
   CAR DEPLOYED" contiene "SAFETY CAR DEPLOYED" come sottostringa, quindi
   ogni VSC veniva scambiata per una SC;
3. correzione metodologica in `effective_pit_loss.py`: per i giri sotto
   neutralizzazione il riferimento dev'essere il ritmo del gruppo in quel
   giro, non la baseline personale del pilota (§5.1 della specifica).

Con tutti e tre i fix, i pit sotto SC sono tornati coerenti; quelli sotto
VSC restano un limite noto, non un errore da rincorrere ora. La gara
campione usata (Singapore GP 2023, Ergast raceId 1113) è una candidata
forte anche per il task 2.2 (§9 della specifica).

Se i numeri non tornano: STOP. Non si va avanti, si sistema la pipeline.

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezioni 4, 5 e 10. Obiettivo: validare la
pipeline su UNA gara campione vera prima di industrializzare. Scegli una
gara 2023 con una neutralizzazione nota (se nel data-layer c'è già una
sessione OpenF1 scaricata, usa quella). Scrivi uno script
data-layer/scripts/validate_sample_race.py che:

1. carica i giri e i pit stop di quella gara dai CSV Ergast (data/raw/),
2. scarica (o legge dalla cache) i messaggi race control OpenF1 e ricava le
   finestre SC/VSC con i giri di inizio e fine,
3. verifica l'allineamento: il numero di giri totale della gara secondo
   Ergast e secondo OpenF1 deve coincidere; stampa un avviso se non torna,
4. calcola con il modulo effective_pit_loss riscritto: costo effettivo di
   ogni pit, prezzo di listino della gara, sconto e etichetta per ogni pit,
5. stampa una tabella leggibile: pilota, giro del pit, etichetta, costo
   effettivo, sconto.

Poi esegui lo script e confronta con gli ordini di grandezza attesi dalla
specifica: pit in verde circa 20-25 secondi di costo, pit sotto VSC con
8-12 secondi di sconto, sotto SC anche di più. Riporta la tabella e dimmi
esplicitamente se i numeri tornano o no, e se no, quale ipotesi hai su cosa
non va. Non nascondere risultati strani.
```

## 1.3 — B · Convenzione D3 e componente di prova

Dipende da: niente (parte subito, in parallelo a 1.1)

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] `npm run build` passa
- [ ] Nel componente non c'è JSX dentro l'SVG (tutto generato da D3)
- [ ] Il redraw è incrementale (niente selectAll('*').remove())
- [ ] La demo su /dev/chart-demo si vede
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezione 7 (regola sul D3). Nel progetto
Next.js, crea src/components/charts/D3Chart.tsx: un componente React di
esempio che stabilisce la convenzione per tutti i grafici del progetto:
React fa solo da contenitore (ref su un div/svg, gestione props e stato),
mentre TUTTO il disegno è D3 dentro useEffect: scale, assi, data join con
selection.join, transizioni, eventi. Il componente deve essere un semplice
line chart che riceve via props un array di serie {id, points:[{x,y}]} e
un'opzione di evidenziazione highlightedId, e ridisegna in modo incrementale
(niente svg.selectAll('*').remove() a ogni render). Scrivi in cima al file
un commento breve che spiega la convenzione. Aggiungi una pagina di prova
temporanea src/app/dev/chart-demo/page.tsx con dati finti per vederlo.
Esegui la build (npm run build) e verifica che passi.
```

---

# Fase 2 — Pipeline completa (settimana 2)

## 2.1 — A · Pipeline su tutte le gare 2023-2024

Dipende da: 1.2 (milestone superata)

- [ ] Milestone 1.2 superata
- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] `public/data/index.json` generato
- [ ] `public/data/races/` popolata (un JSON per gara)
- [ ] `public/data/aggregate.json` generato
- [ ] Nessun file di gara oltre ~500 KB
- [ ] Report finale letto: gare processate, saltate e perché
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezioni 5 e 6. La validazione sulla gara
campione è passata (vedi data-layer/scripts/validate_sample_race.py).
Ora industrializza: scrivi data-layer/scripts/build_all.py che per ogni
gara delle stagioni 2023 e 2024 presenti nei CSV Ergast:

1. scarica da OpenF1 i messaggi race control (con cache su disco in
   data-layer/data/raw per non riscaricare; rispetta un rate limit gentile,
   una richiesta al secondo),
2. ricava le finestre di neutralizzazione (tipo SC o VSC, giro inizio,
   giro fine),
3. calcola per ogni pilota: tempo cumulato per giro, gap dal leader per
   giro, race trace (gap da un riferimento = tempo medio del vincitore),
   e per ogni pit stop: costo effettivo, sconto, etichetta di contesto,
   posizione prima/dopo/dopo 3 e dopo 5 giri, flag double_stack,
4. calcola gli esiti pilota-per-evento della sezione 5.5 (EXPLOITED,
   FULL_PRICE, LOCKED_OUT con soglie 8 giri gomma e 3 auto, NOT_NEEDED,
   NEUTRAL) — le soglie come costanti configurabili in un unico punto,
5. esporta in public/data/: index.json (elenco gare con anno, nome, numero
   di neutralizzazioni, flag "interessante"), races/<anno>-<slug>.json
   (uno per gara, schema della sezione 6 della specifica) e aggregate.json
   (tutti i pit di tutte le gare con sconto ed etichetta, più la matrice
   esiti pilota x evento x gara).

Se una gara 2024 manca dai CSV Kaggle, saltala e scrivila in un report
finale (le integreremo da Jolpica dopo). Alla fine esegui la pipeline
completa e riportami: quante gare processate, quante saltate e perché,
quante neutralizzazioni totali trovate, dimensione dei file generati.
```

## 2.2 — A · Selezione delle 3 gare-caso

Dipende da: 2.1

- [ ] 2.1 completato
- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] La classifica delle gare per interesse è stata stampata
- [ ] Scelta la gara tipo "VSC breve a metà gara"
- [ ] Scelta la gara tipo "SC che rimescola"
- [ ] Scelta la gara tipo "double stack"
- [ ] Scelta la gara di controllo senza neutralizzazioni
- [ ] Sezione 9 di PROGETTAZIONE.md aggiornata con le scelte
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezione 9. Usando i dati generati in
public/data/ (index.json, races/*.json, aggregate.json), scrivi uno script
data-layer/scripts/select_case_races.py che ordina le gare 2023-2024 per
"interesse narrativo" secondo questi criteri: (a) presenza di una VSC breve
a metà gara con almeno 3 pit stop nella finestra; (b) presenza di una SC
con almeno 5 posizioni totali rimescolate tra il giro del deployment e 3
giri dopo la fine del ciclo di soste; (c) presenza di un double stack;
(d) varianza degli sconti nella gara. Lo script stampa una classifica con
i valori dei criteri per gara. Eseguilo e proponimi una terna di gare che
copre i tre tipi richiesti dalla sezione 9 della specifica (una per tipo),
più una gara di controllo senza neutralizzazioni. Aggiorna la sezione 9
di docs/PROGETTAZIONE.md con le gare scelte e il perché.
```

---

# Fase 3 — Le viste (settimane 2-4)

Le viste 3.1 e 3.2 possono partire su dati mock conformi allo schema JSON
della specifica; si collegano ai dati veri appena la 2.1 è finita.

## 3.1 — B · Race trace (vista principale)

Dipende da: 1.3 · dati veri da 2.1

- [ ] 1.3 completato
- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok e vista provata su una gara vera
- [ ] Si vede la SC che "compatta" le linee
- [ ] I colori dei pit vengono da `src/lib/colors.ts`
- [ ] Il brush sui giri funziona ed emette l'intervallo al padre
- [ ] Hover/click evidenziano il pilota, etichette a fine linea
- [ ] Il mock non è più usato in questa vista
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezioni 6 e 7 (vista 1 e regole su colore e
D3), e guarda la convenzione in src/components/charts/D3Chart.tsx.
Riscrivi src/app/race/[id]/RaceAnatomyTimeline.tsx perché diventi la race
trace vera, alimentata dal JSON di gara in public/data/races/ (schema nella
sezione 6 della specifica):

- asse X: giri; asse Y: race trace (campo trace di ogni giro), una linea
  per pilota;
- bande verticali gialle per le finestre SC/VSC (due luminosità: più chiara
  la VSC, più scura la SC), con etichetta del tipo e dei giri;
- marker circolari sui pit stop, colorati per etichetta di contesto con
  questa scala fissa da definire in src/lib/colors.ts ed esportare per
  tutte le viste: GREEN, UNDER_VSC, UNDER_SC, JUST_BEFORE, JUST_AFTER
  (scegli 5 colori categoriali distinguibili e colorblind-safe, niente
  rosso/verde insieme);
- linee grigie e sottili di default; hover su una linea o sul nome del
  pilota la evidenzia (spessore e colore pieno) e mostra un tooltip con
  pilota, giro, gap; click blocca/sblocca l'evidenziazione;
- etichette dei piloti direttamente a fine linea, non in una legenda;
- brush orizzontale D3 sull'asse dei giri che emette l'intervallo
  selezionato verso il componente padre (callback in props);
- tutto il disegno con D3 dentro useEffect, React solo contenitore.

Aggiorna la pagina src/app/race/[id]/page.tsx per caricare il JSON vero
della gara dall'id nell'URL. Elimina l'uso di race-anatomy-mock.json in
questa vista. Esegui la build e verifica su una delle gare generate.
```

## 3.2 — C · Matrice della lotteria

Dipende da: 1.3 · dati da 2.1

- [ ] 1.3 completato
- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok e matrice provata su una gara vera
- [ ] I 5 colori degli esiti sono in `src/lib/colors.ts`
- [ ] I tooltip spiegano l'esito in italiano
- [ ] Hover sulla riga emette il pilota via callback
- [ ] Legenda compatta presente
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezioni 5.5, 6 (vista 4) e 7 (regole colore e
D3), e la convenzione in src/components/charts/D3Chart.tsx. Riscrivi
src/app/race/[id]/OpportunityWindow.tsx perché diventi la "matrice della
lotteria" della singola gara: righe = piloti (ordinati per posizione al
momento dell'evento), colonne = neutralizzazioni della gara, celle
colorate per esito (EXPLOITED, FULL_PRICE, LOCKED_OUT, NOT_NEEDED,
NEUTRAL — dati nel campo outcomes del JSON di gara). Definisci i 5 colori
degli esiti in src/lib/colors.ts accanto a quelli dei contesti pit (palette
coerente: esiti positivi/negativi/neutri riconoscibili a colpo d'occhio,
colorblind-safe). Ogni cella: tooltip con la spiegazione in italiano
dell'esito (es. "escluso: gomme montate da 4 giri") e, se c'è, il delta
posizioni. Hover su una riga evidenzia il pilota (callback verso il padre,
stesso meccanismo della race trace). Legenda compatta sotto la matrice.
Tutto D3 dentro useEffect. Esegui la build e prova su una gara vera.
```

## 3.3 — B · Vista degli sconti

Dipende da: 3.1 (per il contratto del brush)

- [ ] 3.1 completato
- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok e vista provata su una gara vera
- [ ] Barre ordinate per valore, zero al centro
- [ ] Il filtro dall'intervallo del brush funziona
- [ ] Colori condivisi da `colors.ts`, prezzo di listino mostrato
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezioni 5.3, 6 (vista 2) e 7. Riscrivi
src/app/race/[id]/PitCostDumbbell.tsx come grafico a barre orizzontali
divergenti degli sconti: una barra per pit stop della gara, asse X in
secondi con lo zero al centro (sconto positivo a destra, negativo a
sinistra), barre ordinate per valore, colore = etichetta di contesto del
pit (scala condivisa da src/lib/colors.ts), etichetta con sigla pilota e
valore arrotondato a un decimale. Un piccolo riferimento testuale in alto:
"prezzo di listino di questa gara: X s" (campo nominalPitLoss). Tooltip
con giro, costo effettivo, sconto, posizioni prima/dopo. Hover evidenzia
il pilota via callback come nelle altre viste. Se il componente riceve
dal padre un intervallo di giri (dal brush della race trace), mostra solo
i pit in quell'intervallo, con transizione D3. Tutto D3 dentro useEffect.
Build e prova su una gara vera.
```

## 3.4 — C · Classifica deformata (slope chart)

Dipende da: 3.2 (palette esiti) · dati da 2.1

- [ ] 3.2 completato
- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok e vista provata su una gara vera
- [ ] Il selettore di evento funziona (se la gara ne ha più di uno)
- [ ] Chi sale e chi scende si distingue a colpo d'occhio
- [ ] Hover coordinato via callback
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezione 6 (vista 3) e 7. Nel repo esiste
src/app/rivalry/[id]/RaceSlopeChart.tsx nato per un'altra idea: riadattalo
(spostandolo in src/app/race/[id]/EventSlopeChart.tsx) perché mostri, per
UNA neutralizzazione selezionata: colonna sinistra = posizioni dei piloti
al giro del deployment, colonna destra = posizioni 3 giri dopo la fine del
ciclo di soste, linee che collegano lo stesso pilota. Linee quasi
orizzontali in grigio; chi guadagna posizioni in un colore, chi ne perde
in un altro (coerenti con la palette esiti di src/lib/colors.ts), spessore
proporzionale ai posti guadagnati/persi. Se la gara ha più neutralizzazioni,
un selettore piccolo (bottoni "VSC giro 14" / "SC giro 41") sopra il
grafico. Hover evidenzia il pilota via callback. Tutto D3 dentro useEffect.
Build e prova su una gara vera.
```

## 3.5 — C · Stesso box, fortuna diversa

Dipende da: 3.2 · dati da 2.1

- [ ] 3.2 completato
- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok e vista provata su una gara vera
- [ ] I double stack sono evidenziati con chi è passato per primo
- [ ] L'interruttore contesto/team funziona (default: contesto)
- [ ] Pagine rivalry, grid e rankings rimosse, nessun link rotto
- [ ] JSON orfani rimossi da public/data
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezioni 3 e 6 (vista 5). Il filone "rivalità
tra compagni" va riconvertito in una singola vista dentro la pagina gara:
"stesso box, fortuna diversa". Crea src/app/race/[id]/TeammateMirror.tsx:
per ogni team con almeno un pit durante o vicino a una neutralizzazione,
una riga con i due compagni affiancati a specchio: per ciascuno, etichetta
del pit, sconto ottenuto (mini-barra), esito, delta posizioni; evidenzia i
double stack (stesso giro) con un connettore tra i due e l'indicazione di
chi è passato per primo. Questa è l'UNICA vista dove è ammesso il colore
team: metti un interruttore locale "colora per contesto / colora per team"
(default: contesto). Poi rimuovi le pagine src/app/rivalry, src/app/grid e
src/app/rankings e ogni link a esse: il progetto ha una sola domanda di
ricerca. Elimina anche i JSON in public/data non più usati da nessuno
(verifica prima con una ricerca degli import). Build pulita senza
riferimenti rotti.
```

## 3.6 — B · Home: la distribuzione degli sconti

Dipende da: 2.1

- [ ] 2.1 completato
- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok
- [ ] Le due nuvole (pit verdi vs pit scontati) sono visibilmente separate
      → se NON lo sono, segnalarlo ad A: è un problema di dati
- [ ] Click su un punto porta alla pagina della sua gara
- [ ] Griglia delle gare presente, gare-caso in evidenza
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezioni 6 (vista 6) e 8 (arco narrativo in 3
atti: prezzo di listino, sconto, lotteria). Riscrivi la home
src/app/page.tsx come apertura del racconto, alimentata da
public/data/aggregate.json:

1. in alto il claim del progetto e il "prezzo di listino" tipico (mediana
   dei pit in verde su tutto il campione), come numero grande;
2. la vista principale: distribuzione di TUTTI i pit stop 2023-2024 su un
   asse orizzontale del costo effettivo (dot plot / beeswarm con D3,
   force collide semplice), punti colorati per etichetta di contesto
   (src/lib/colors.ts); si deve vedere la nuvola dei pit verdi intorno al
   prezzo pieno e la nuvola dei pit sotto SC/VSC spostata verso il basso
   costo; tooltip con gara, pilota, sconto; click su un punto porta alla
   pagina della sua gara;
3. sotto, la griglia delle gare (da index.json): card con nome, anno,
   numero di neutralizzazioni, link a /race/<id>; le 3 gare-caso in
   evidenza.

Testi in italiano, tono sobrio. Tutto il disegno D3 dentro useEffect.
Build e verifica.
```

---

# Fase 4 — Coordinamento e metodologia (settimana 4)

## 4.1 — C · Brushing and linking tra le viste

Dipende da: 3.1, 3.2, 3.3, 3.4, 3.5

- [ ] Tutte le viste della pagina gara completate
- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok
- [ ] Hover su un pilota in QUALSIASI vista lo evidenzia in TUTTE
- [ ] Il brush della trace filtra la vista sconti
- [ ] Il selettore evento sincronizza slope e matrice
- [ ] L'hover è fluido: nessun ridisegno completo dell'SVG
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezioni 6 (interazione comune) e 8 (categorie
di Yi: select, connect). Nella pagina src/app/race/[id]/ le viste esistono
ma vanno coordinate. In RaceAnatomyClient.tsx (o creando un context
leggero) centralizza questo stato condiviso: pilota evidenziato (hover),
pilota bloccato (click), intervallo di giri dal brush della race trace,
evento di neutralizzazione selezionato. Collega tutte le viste della
pagina (race trace, sconti, slope, matrice, compagni): hover su un pilota
in QUALSIASI vista lo evidenzia in TUTTE (linea spessa nella trace, barra
piena e le altre attenuate negli sconti, riga marcata nella matrice, linea
marcata nello slope); il brush della trace filtra la vista sconti; il
selettore evento sincronizza slope e matrice. Le transizioni di
evidenziazione sono D3 (attributi), non re-render React dell'intero SVG:
verifica che l'hover non causi il ridisegno completo. Build e prova.
```

## 4.2 — B · Pagina metodologia

Dipende da: 2.1

- [ ] 2.1 completato
- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok
- [ ] Un compagno di corso esterno la legge e capisce le regole
- [ ] Le soglie vengono dalla config della pipeline, non scritte a mano
- [ ] I limiti noti sono dichiarati
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezioni 5 e 10. Riscrivi
src/app/methodology/page.tsx in italiano, per un lettore non tecnico:
(1) come calcoliamo il costo effettivo di un pit stop (la formula spiegata
a parole, con un piccolo diagramma statico anche solo in SVG: giro di
entrata + giro di uscita confrontati con i giri normali); (2) cos'è il
prezzo di listino e perché usiamo la mediana; (3) le etichette dei pit e
gli esiti della lotteria con le regole esatte; (4) le soglie dichiarate
(8 giri di gomma, 3 auto al rientro per LOCKED_OUT, 3 giri per
JUST_BEFORE, 2 per JUST_AFTER) e il perché di quei valori; (5) i limiti
noti: baseline su poche osservazioni in gare con pochi pit verdi,
allineamento per numero di giro tra Ergast e OpenF1, il fatto che non
modelliamo il traffico dopo il rientro se non con la soglia delle 3 auto.
Le soglie NON vanno scritte a mano nel testo: leggile dalla stessa
costante/config usata dalla pipeline se raggiungibile, altrimenti da un
piccolo JSON generato dalla pipeline in public/data/params.json (in quel
caso chiedi ad A di aggiungerlo, o aggiungilo tu in build_all.py). Build.
```

---

# Fase 5 — Storytelling e rifinitura (settimana 5)

## 5.1 — C · Le 3 gare-caso raccontate

Dipende da: 4.1, 2.2

- [ ] 4.1 e 2.2 completati
- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok e provato su una gara-caso
- [ ] I numeri citati nei testi corrispondono ai dati (verificato a mano
      su almeno 2 annotazioni)
- [ ] La navigazione tappa-per-tappa evidenzia piloti e imposta il brush
- [ ] Le gare senza storia funzionano come prima
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezioni 8 (arco narrativo) e 9 (gare scelte).
Per le 3 gare-caso indicate nella sezione 9, aggiungi alle pagine gara un
livello narrativo: un file public/data/stories.json con, per ogni gara-caso,
2-4 annotazioni {lap, titolo, testo breve in italiano} (es. "giro 14: la
VSC apre la finestra: Sainz e Perez si fermano quasi gratis"). Scrivi tu i
testi leggendo i dati veri dei JSON di gara: verifica i numeri prima di
scriverli, non inventare. Nella pagina gara, se la gara ha una storia,
mostra le annotazioni come marcatori numerati sulla race trace e un
pannello laterale/superiore che scorrendo le tappe evidenzia i piloti
coinvolti e imposta il brush sull'intervallo di giri rilevante
(riusa lo stato condiviso di RaceAnatomyClient). Le gare senza storia
funzionano come prima. Build e prova su una gara-caso.
```

## 5.2 — B · Passata di qualità visiva e accessibilità

Dipende da: tutte le viste, 4.1

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] L'elenco dei problemi trovati esiste (se è vuoto, insospettirsi)
- [ ] Tutti i colori vengono da `colors.ts`
- [ ] Palette verificata per protanopia/deuteranopia
- [ ] Leggibile a 1280px, dignitoso a 768px
- [ ] Hover senza scatti sulla pagina gara
- [ ] Build ok, diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md, sezioni 7 e 8 (regole su colore e
leggibilità). Fai una passata di qualità su tutte le viste: (1) verifica
che TUTTI i colori vengano da src/lib/colors.ts e che nessuna vista usi il
colore per due significati; (2) simula i due tipi principali di daltonismo
(protanopia/deuteranopia — puoi generare versioni simulate della palette e
valutarne il contrasto) e se due categorie risultano indistinguibili
proponi e applica una palette corretta; (3) etichette: niente legende dove
si può etichettare direttamente, font non sotto i 11px, numeri arrotondati
a 1 decimale; (4) tooltip coerenti (stesso componente ovunque);
(5) responsive: le viste devono restare leggibili a 1280px e degradare con
dignità a 768px; (6) performance: hover senza jank sulla pagina gara con
20 piloti. Elenca prima cosa hai trovato, poi applica le correzioni,
poi build.
```

## 5.3 — A · Numeri e materiali per la relazione

Dipende da: 2.1, 2.2

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] `docs/NUMERI.md` esiste
- [ ] Ogni numero indica file e regola di provenienza
- [ ] I numeri delle gare-caso coincidono con le storie della 5.1
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md per intero. Scrivi uno script
data-layer/scripts/report_numbers.py che calcola da public/data/ i numeri
chiave da citare in relazione e presentazione, e li salva in
docs/NUMERI.md in forma leggibile: quante gare e quante neutralizzazioni
nel campione; prezzo di listino mediano; sconto mediano sotto VSC e sotto
SC; quanti pit JUST_BEFORE (i "fregati") e quanto hanno perso in mediana;
distribuzione degli esiti della lotteria in percentuale; il caso singolo
più estremo di sconto e il caso più sfortunato; per le 3 gare-caso, i 2-3
numeri che sostengono la loro storia. Per ogni numero indica da quale file
e con quale regola è stato calcolato, così è difendibile all'esame.
Esegui e mostrami docs/NUMERI.md.
```

## 5.4 — Tutti · Prova generale (a voce, senza prompt)

- [ ] La demo regge il percorso home → gara-caso → interazioni → metodologia
- [ ] Tutti sanno rispondere a: "perché multiple line chart e non small
      multiples?"
- [ ] Tutti sanno rispondere a: "dov'è D3?"
- [ ] Tutti sanno rispondere a: "come definite LOCKED_OUT?"
- [ ] Tutti sanno rispondere a: "perché niente grafi?"
- [ ] Pagina /dev/chart-demo rimossa prima della consegna

(Le risposte sono nella sezione 8 di PROGETTAZIONE.md.)

---

# Riepilogo dipendenze

```
0.2 → 1.1 → 1.2 ══ MILESTONE ══→ 2.1 → 2.2
1.3 (parallelo) → 3.1 → 3.3
2.1 → 3.2 → 3.4, 3.5
2.1 → 3.6, 4.2
3.1-3.5 → 4.1 → 5.1
2.2 → 5.1, 5.3
tutto → 5.2 → 5.4
```

# Consigli d'uso di Claude Code

- Aprire Claude Code sempre nella cartella `F1AnalyticsVisual`.
- Un prompt per sessione; se il risultato non va, correggere nella stessa
  sessione spiegando cosa non torna.
- Non accettare mai "dovrebbe funzionare": i prompt chiedono già di
  eseguire build e test, pretendere l'output.
- Prima del commit: leggere il diff. Se qualcosa non si capisce, chiedere
  a Claude di spiegarlo — all'esame il codice va difeso.
- Se un task tocca file su cui lavora un altro (vedi dipendenze),
  coordinarsi prima su chi pusha per primo.
