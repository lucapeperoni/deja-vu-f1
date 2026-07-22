# "È già successo?" — Roadmap del pivot v3

Contesto: dopo il ricevimento del 22 luglio 2026 il progetto cambia frame
(vedi `docs/PROGETTAZIONE.md` v3 e `docs/CATALOGO-EVENTI.md`). La pipeline
v2 delle neutralizzazioni resta viva come una famiglia del catalogo: non si
riscrive e non si butta.

Regole invariate dalle roadmap precedenti:

- **un task = una sessione di Claude Code** aperta in `F1AnalyticsVisual`;
- il task è finito solo con **tutte** le caselle spuntate;
- **il diff si legge prima di ogni commit**;
- mai accettare "dovrebbe funzionare": ogni task ha una verifica eseguibile;
- se i numeri non tornano, **STOP** e si capisce perché prima di andare
  avanti.

Persone: **A** = dati e motore di eventi · **B** = viste principali ·
**C** = viste secondarie, testi e metodologia.

---

## Avanzamento generale

- [ ] Fase E0 — Allineamento e pulizia (mezza giornata)
- [ ] Fase E1 — Spike del motore di eventi ⚠ **MILESTONE, la fase che de-rischia tutto**
- [ ] Fase E2 — Catalogo completo e pipeline
- [ ] Fase E3 — Viste
- [ ] Fase E4 — Consolidamento, metodologia, esame

Ordine dei prompt: E0.1 → E1.1 → E1.2 → E2.1 → E2.2 → E2.3 → E3.1 → E3.2 →
E3.3 → E3.4 → E3.5 → E3.6 → E4.1 → E4.2 → E4.3.
E3.2/E3.3/E3.4 possono andare in parallelo su persone diverse **solo dopo**
che E3.1 ha fissato le convenzioni comuni.

---

# Fase E0 — Allineamento e pulizia

## E0.1 — Tutti · Lettura

Task senza prompt: la lettura si fa con gli occhi. I documenti del pivot
sono già committati su `main` (commit `4267f5a`).

- [ ] A, B, C hanno letto `docs/PROGETTAZIONE.md` v3 §1-3, §5, §7
- [ ] A, B, C hanno letto `docs/CATALOGO-EVENTI.md` (almeno §0, §11, §12)
- [ ] Confermati i ruoli A/B/C

**Nota sul flusso di lavoro: si lavora direttamente su `main`, niente
branch.** Ogni task committa e pusha su `main` a lavoro finito e
verificato. La regola "il diff si legge prima di ogni commit" vale a
maggior ragione: senza branch non c'è una rete di sicurezza a valle.

---

# Fase E1 — Spike del motore di eventi ⚠ LA FASE PIÙ IMPORTANTE

Obiettivo: dimostrare su 6 eventi che il motore dichiarativo funziona e che
i conteggi coincidono con quelli già verificati a mano nel catalogo. Se lo
spike fallisce, si aggiusta il modello **prima** di industrializzare.

## E1.1 — A · Il motore su 6 eventi, con le trappole applicate

Dipende da: E0.1

- [x] Prompt eseguito in una nuova sessione
- [x] Lo script gira e stampa la tabella dei 6 eventi
- [x] I conteggi coincidono con `docs/CATALOGO-EVENTI.md` **una volta
      applicate le trappole** (le differenze rispetto ai numeri grezzi del
      catalogo sono spiegate, non nascoste: il catalogo è stato calcolato
      *senza* filtri) — 4/6 eventi tornano esatti applicando solo le
      trappole (vittoria da griglia, margine, prima vittoria, nessun
      cambio di leader). Per gli altri 2 ("meno di N classificati",
      "doppio ritiro per la stessa causa") le trappole da sole non
      bastavano: ho trovato un **bug nel documento originale** stesso
      (Monaco 1996 è già in §3 come "19 ritiri su 22" ma la riga
      "classificati" lo ignora) e adottato i numeri del motore, spiegati
      e verificati caso per caso in `docs/CATALOGO-EVENTI.md` §3 e §4.
      Nessun numero è stato aggiustato a occhio.
- [x] Il filtro Indianapolis è verificabile: attivandolo e disattivandolo
      il conteggio della "rimonta più grande" cambia — aggiunto come
      settimo mini-check indipendente in `scripts/spike_events.py`
      (`_check_filtro_indy500_su_rimonta`, non un evento del catalogo).
      Con l'Indy 500 il record è **1957 Indianapolis 500, +30 posizioni**
      (griglia 32 → arrivo 2), esattamente il caso citato in
      `PROGETTAZIONE.md` §5.6; senza, il record scende a **1954 British
      Grand Prix, +26 posizioni**. Il filtro cambia il record, come
      atteso.
- [x] La tassonomia dei ritiri è verificabile: i 1025 "Did not qualify"
      non finiscono tra i ritiri (mappati a `NON_QUALIFICATO`, esclusi da
      `doppio_ritiro_stessa_causa` e da ogni conteggio di "ritiro")
- [ ] Diff letto, commit e push — non ancora fatto in questa sessione

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.1, §5.2 e §5.6, e docs/CATALOGO-EVENTI.md.

Scrivi data-layer/app/events/ come nuovo modulo Python (accanto a
app/metrics/, senza toccarlo):

1. loader.py — carica i CSV di data/raw/ (races, results, circuits,
   drivers, constructors, status) in strutture in memoria. Applica le
   normalizzazioni delle trappole di PROGETTAZIONE §5.6:
   - flag is_indy500 sulle gare a Indianapolis dal 1950 al 1960 (le altre
     gare a Indianapolis, 2000-2003, NON sono Indy 500: sono il GP degli
     Stati Uniti e restano incluse);
   - tassonomia dello status in 5 categorie: CLASSIFICATO,
     NON_QUALIFICATO, NON_PARTITO, RITIRO_TECNICO, RITIRO_INCIDENTE.
     Mappa esplicitamente tutti i 139 statusId, non con euristiche sulle
     stringhe; le categorie devono essere ispezionabili;
   - grid == 0 normalizzato come partenza dalla pit lane (categoria a sé,
     non posizione 0);
   - campi vuoti ("\N") come None, mai come 0.

2. registry.py — la definizione dichiarativa di un evento: id, nome
   italiano, famiglia, unità di osservazione (GARA / RISULTATO /
   TEAM_GARA), funzione predicato, parametri con la loro griglia di
   valori, finestra di copertura (anno_da, anno_a) e peso editoriale 0-1.
   Un decoratore @evento registra le definizioni.

3. catalog.py — sei eventi di famiglie diverse, per provare il modello:
   - vittoria partendo N° o peggio (parametro N ∈ {5,10,15,20})
   - margine di vittoria sotto N secondi (N ∈ {0.1, 0.5, 1, 2})
   - meno di N piloti classificati (N ∈ {6,8,10})
   - doppio ritiro dello stesso team per la stessa causa
   - prima vittoria in carriera
   - gara senza nessun cambio di leader in pista (finestra 1996+,
     richiede lap_times)

4. engine.py — valuta un evento su tutte le unità della sua finestra e
   restituisce occorrenze + denominatore + rarità.

Poi scrivi data-layer/scripts/spike_events.py che stampa, per ognuno dei
6 eventi e per ogni valore dei parametri: nome, finestra, occorrenze,
denominatore, rarità, ultima occorrenza, circuito con più occorrenze.

Confronta i risultati con i numeri di docs/CATALOGO-EVENTI.md e dimmi
esplicitamente quali coincidono e quali no. Dove non coincidono, la causa
attesa è l'applicazione delle trappole (il catalogo è stato calcolato
senza filtri): verificalo caso per caso e spiegamelo. Se una differenza
NON è spiegabile con le trappole, fermati e dimmelo invece di aggiustare
i numeri.
```

## E1.2 — A · Rarità, siccità e notevolezza su una gara vera

Dipende da: E1.1

- [ ] Prompt eseguito
- [ ] Per almeno 3 gare di anni diversi il sistema stampa i fatti notevoli
      ordinati
- [ ] I fatti prodotti sono **veri e non ovvi**: controllati a mano uno per
      uno su almeno una gara
- [ ] Se il generatore produce solo banalità con 6 eventi, è atteso — la
      decisione se serve più segnale è presa qui, non a E3
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.3 e §5.4.

Estendi data-layer/app/events/ con:
- metrics.py: per ogni evento, occorrenze per stagione, occorrenze e tasso
  per circuito (tasso = occorrenze / gare ospitate da quel circuito nella
  finestra), siccità corrente in gare e in anni dall'ultima occorrenza;
- notability.py: il punteggio di notevolezza di PROGETTAZIONE §5.4, con i
  tre pesi come costanti dichiarate in cima al file (non sparse nel
  codice) e una funzione che, data una gara, restituisce i suoi eventi
  occorsi ordinati per notevolezza.

Scrivi data-layer/scripts/spike_facts.py che stampa i fatti notevoli per
tre gare di epoche diverse (una anni '50-'60, una anni '90, una 2024, a
tua scelta motivata) e per la gara più recente del dataset.

Poi dimmi, con onestà: i fatti prodotti sono interessanti o banali? Con
soli 6 eventi nel catalogo mi aspetto che siano poveri — voglio sapere se
il problema è il numero di eventi o la formula del punteggio.
```

---

# Fase E2 — Catalogo completo e pipeline

## E2.1 — A · Il catalogo a 20+ eventi

Dipende da: E1.2

- [ ] Prompt eseguito
- [ ] Almeno **20 eventi** in almeno **5 famiglie** (soglia di
      PROGETTAZIONE §10, rischio 2)
- [ ] Ogni evento dichiara la sua finestra e i campi da cui dipende
- [ ] Esiste un test che confronta i conteggi con `CATALOGO-EVENTI.md`
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/CATALOGO-EVENTI.md per intero: contiene i conteggi già
verificati a mano di tutti gli eventi candidati.

Porta data-layer/app/events/catalog.py da 6 a almeno 20 eventi, coprendo
queste famiglie (i numeri attesi sono nel catalogo):

- GRIGLIA_E_RISULTATO: vittoria da N° o peggio, podio da N° o peggio,
  nessuno dei primi 3 in griglia sul podio, pole finita con un ritiro
- MARGINE: vittoria sotto N secondi, vittoria oltre N minuti
- GARA_ANOMALA: meno di N classificati, nessun ritiro, % ritiri sopra N
- TEAM: doppietta, tripletta, doppio ritiro, doppio ritiro stessa causa,
  prima vittoria assoluta di un costruttore
- CARRIERA: prima vittoria, primo podio, prima pole, vittoria al debutto,
  podio al debutto, prima vittoria del pilota su quel circuito
- RITIRI: ritiro per una causa specifica (parametro = la causa, con la
  tassonomia di E1.1), causa che non si vede da più di N anni
- COMANDO (1996+): nessun cambio di leader, almeno N piloti diversi al
  comando, vittoria conquistata all'ultimo giro, rimonta di almeno N
  posizioni
- STRATEGIA (2011+): vincitore con almeno N soste, pilota con almeno N
  soste

Per ogni evento aggiungi il peso editoriale 0-1 e una frase di
descrizione in italiano per l'interfaccia.

Scrivi anche data-layer/tests/test_catalog.py che verifica i conteggi
attesi per almeno 12 eventi, con i numeri presi da docs/CATALOGO-EVENTI.md
(tenendo conto delle trappole applicate). I test devono passare.
```

## E2.2 — A · `build_events.py` e l'export dei JSON

Dipende da: E2.1

- [ ] Prompt eseguito
- [ ] I file di `public/data/events/` esistono e rispettano il budget di
      300 KB per evento
- [ ] `public/data/facts/` copre tutte le 1125 gare
- [ ] `params.json` esteso, senza rompere quello che `/methodology` già legge
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §6.

Scrivi data-layer/scripts/build_events.py che, usando app/events/, produce:
- public/data/events/index.json (il catalogo con rarità, finestra,
  siccità, peso editoriale)
- public/data/events/<eventId>.json (occorrenze complete + serie per
  stagione + serie per circuito con conteggio E tasso)
- public/data/facts/<anno>-<circuitRef>.json (fatti notevoli per gara)
- public/data/races-index.json (le 1125 gare per il selettore)
- estende public/data/params.json con pesi e regole delle trappole,
  SENZA rimuovere le chiavi che già ci sono (le legge /methodology).

Vincoli: gli eventi parametrici si precalcolano sulla griglia di valori
dichiarata nel catalogo; nessun file sopra i 300 KB (se un evento sfora,
tronca l'elenco occorrenze ai campi essenziali e dimmelo); build_all.py
NON si tocca e i suoi output NON si sovrascrivono.

Alla fine stampa un riepilogo: numero di eventi esportati, peso totale
della cartella, i 5 file più pesanti, e quante gare hanno almeno un fatto
notevole.
```

## E2.3 — A + C · La famiglia neutralizzazioni dentro il catalogo

Dipende da: E2.2

- [ ] Prompt eseguito
- [ ] Gli eventi SC/VSC compaiono nel catalogo con finestra 2023-2024
- [ ] La rarità di questi eventi NON è confrontabile con quella degli altri
      e l'output lo rende evidente
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.5 e §12.

Aggiungi al catalogo la famiglia NEUTRALIZZAZIONI, che legge i JSON già
prodotti da build_all.py in public/data/ (non ricalcola nulla, non tocca
la pipeline v2):
- gara con almeno N neutralizzazioni
- pit stop sotto Safety Car / sotto VSC
- pilota escluso dalla finestra (LOCKED_OUT)
- pit in double stack
- pilota "fregato" (JUST_BEFORE)

Finestra dichiarata: 2023-2024, 46 gare. Verifica che i conteggi
coincidano con quelli già noti della v2 (1658 pit nell'aggregate, 42
neutralizzazioni) e che build_events.py li esporti come tutti gli altri.
```

---

# Fase E3 — Viste

## E3.1 — B · Fondamenta comuni e vista 1 (la scala della rarità)

Dipende da: E2.2

- [ ] Prompt eseguito
- [ ] La home mostra tutti gli eventi del catalogo, ordinati per rarità
- [ ] La finestra di copertura è **visibile**, non solo scritta
- [ ] Verificata nel browser: nessun errore in console, click su un evento
      porta al compositore
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §7 (in particolare le regole su colore e D3) e
node_modules/next/dist/docs/ per le API di questa versione di Next.

Riscrivi src/app/page.tsx come "la scala della rarità": legge
public/data/events/index.json e disegna tutti gli eventi del catalogo su
un asse di rarità logaritmico, dal più comune al più raro. Il colore
codifica la FAMIGLIA (categoriale, colorblind-safe); la finestra di
copertura è codificata visivamente accanto a ogni evento, così che un
evento valido su 285 gare non sembri confrontabile con uno valido su 1125.
Click su un evento → /eventi/<eventId>.

Fissa qui le convenzioni che useranno tutte le viste successive (le altre
persone partiranno da queste): la palette per famiglia in src/lib/, il
tipo TypeScript del catalogo, il componente di caricamento dei JSON, il
formato del tooltip (che mostra SEMPRE la finestra).

D3 possiede l'SVG: scale, assi, data join e transizioni dentro useEffect,
React fa solo da contenitore. Parti dal componente esistente
src/components/charts/D3Chart.tsx.

Verifica nel browser con gli strumenti di preview prima di dirmi che
funziona, e mostrami uno screenshot.
```

## E3.2 — B · Vista 2, il compositore di eventi

Dipende da: E3.1

- [ ] Prompt eseguito
- [ ] Muovendo il parametro la risposta si aggiorna in transizione
- [ ] La risposta grande ("40 volte su 1125 gare, 3,6%") è leggibile a
      distanza — è la vista che si mostra al ricevimento
- [ ] Verificata nel browser
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §7 vista 2.

Crea src/app/eventi/[eventId]/ : il compositore. Legge
public/data/events/<eventId>.json e mostra:
- il selettore di famiglia ed evento;
- i parametri dell'evento come slider sui valori precalcolati (NON
  interpolare: si passa da un valore precalcolato all'altro);
- la risposta grande: "N volte su M <unità> (X%)", l'ultima occorrenza, la
  siccità ("non succedeva dal ..."), e la finestra di copertura;
- l'elenco delle occorrenze in tabella, ordinabile, con link alla gara.

Le viste 3, 4 e 5 verranno agganciate qui dalle altre persone: predisponi
il layout e lo stato condiviso (evento corrente + valore dei parametri +
eventuale filtro anni), ma non implementarle.

Transizione D3 sul cambio di parametro: si deve VEDERE la rarità che
cambia passando da soglia 10 (40 volte) a 15 (9 volte) a 20 (1 volta).

Verifica nel browser e mostrami uno screenshot.
```

## E3.3 — C · Vista 3 (quando) e vista 4 (dove)

Dipende da: E3.2

- [ ] Prompt eseguito
- [ ] La siccità si legge come spazio vuoto sulla striscia degli anni
- [ ] L'interruttore conteggio/tasso nella mappa ribalta la classifica e la
      cosa è evidente
- [ ] Il brush sugli anni filtra la mappa e la tabella
- [ ] Verificata nel browser
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §7 viste 3 e 4, e §5.3.

Dentro la pagina /eventi/[eventId] aggiungi due componenti D3:

1. QuandoStrip.tsx — le 75 stagioni sull'asse X, le occorrenze
   dell'evento come segni. Lo spazio vuoto tra i segni È la siccità e
   deve leggersi a colpo d'occhio. Brush sull'asse anni che filtra la
   mappa e la tabella delle occorrenze.

2. DoveMappa.tsx — i circuiti sulle loro coordinate reali (lat/lng da
   circuits.csv, già nei JSON esportati). Interruttore tra conteggio
   grezzo e tasso per gara ospitata (idiom "encode" di Yi et al.), con
   una riga di testo che spiega perché la classifica cambia. Offri anche
   la vista a barre ordinate come alternativa commutabile.

Rispetta le convenzioni fissate in E3.1 (palette, tooltip con finestra,
D3 possiede l'SVG). Verifica nel browser e mostrami gli screenshot.
```

## E3.4 — B · Vista 5, il piano griglia × arrivo

Dipende da: E3.2

- [ ] Prompt eseguito
- [ ] Tutti i risultati con griglia e arrivo validi sono nella nuvola
- [ ] Le occorrenze dell'evento selezionato si illuminano
- [ ] Prestazioni misurate: se l'SVG non regge, si passa a canvas (piano B
      già deciso in PROGETTAZIONE §10, rischio 4) — la misura va riportata
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §7 vista 5 e §10 rischio 4.

Crea il componente GrigliaArrivo.tsx dentro /eventi/[eventId]: nuvola
densa di tutti i risultati (posizione di partenza × posizione di arrivo),
con le occorrenze dell'evento selezionato evidenziate. Serve a mostrare
PERCHÉ un evento è raro: le vittorie da oltre la decima piazza devono
apparire come pochi punti in un angolo quasi vuoto.

I risultati vanno esportati come file dedicato da build_events.py se non
c'è già (chiedimelo prima di aggiungere un file oltre i 300 KB): servono
solo griglia, arrivo, anno, gara.

Misura il tempo di rendering e il peso del DOM. Se l'SVG non regge,
passa a canvas per la nuvola tenendo SVG per assi ed evidenziazione, e
riportami i numeri misurati prima e dopo.

Verifica nel browser e mostrami uno screenshot.
```

## E3.5 — C · Vista 6, la scheda gara

Dipende da: E2.2

- [ ] Prompt eseguito
- [ ] Si sceglie una gara qualsiasi tra le 1125 e compaiono i fatti notevoli
- [ ] Ogni fatto porta rarità, finestra e link all'evento
- [ ] Provata su 5 gare a caso: nessun fatto falso, nessuna banalità in
      cima
- [ ] Verificata nel browser
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §7 vista 6 e §5.4.

Crea src/app/gara/[raceSlug]/ : la scheda gara. Selettore su tutte le
1125 gare (anno + nome, ricerca testuale), e per la gara scelta mostra i
fatti notevoli letti da public/data/facts/<slug>.json, ordinati per
notevolezza, ognuno con: la frase in italiano, quante volte è successo,
la finestra, la siccità, il link all'evento nel compositore.

Se la gara è una delle 46 con dati di neutralizzazione, mostra in fondo
il rimando al capitolo neutralizzazioni (le viste v2 esistenti).

Poi apri 5 gare a caso e controlla i fatti uno per uno: dimmi se ne trovi
di falsi o di banali in cima alla lista. Non aggiustare i pesi da solo —
riportami il problema.
```

## E3.6 — C · Vista 7, il capitolo neutralizzazioni reinquadrato

Dipende da: E3.5

- [ ] Prompt eseguito
- [ ] Le viste v2 sono raggiungibili e hanno un'intestazione che dichiara
      la finestra di 46 gare
- [ ] Nessuna vista v2 è stata riscritta
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.5, §7 vista 7 e §12.

Le viste della v2 (race trace, sconti, matrice, compagni di squadra) sono
già implementate sotto src/app/race/. NON riscriverle. Fai solo questo:

1. spostale/raggiungile come "capitolo neutralizzazioni", con
   un'intestazione che dichiara apertamente: finestra 2023-2024, 46 gare,
   fonte OpenF1, e perché questa famiglia ha una copertura diversa dal
   resto del sito;
2. collega il capitolo dalla scheda gara (E3.5) e dagli eventi della
   famiglia NEUTRALIZZAZIONI nel compositore;
3. aggiungi una riga che spiega il limite noto della VSC (§12.1).

Verifica nel browser che tutte le viste v2 funzionino ancora esattamente
come prima e mostrami gli screenshot.
```

---

# Fase E4 — Consolidamento

## E4.1 — C · La pagina metodologia

Dipende da: E3.6

- [ ] Prompt eseguito
- [ ] Le 5 trappole di §5.6 sono spiegate con i numeri veri
- [ ] I pesi della notevolezza sono dichiarati e presi da `params.json`
- [ ] Verificata nel browser
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.2, §5.4, §5.6 e docs/CATALOGO-EVENTI.md §11.

Riscrivi src/app/methodology/page.tsx per il frame v3. Deve contenere,
con i numeri veri letti da public/data/params.json (mai riscritti a mano):

1. come si calcola la rarità e perché ogni numero porta la sua finestra;
2. la tabella delle finestre di copertura per famiglia;
3. le cinque trappole nei dati, ognuna con il numero reale (le 11 Indy
   500, i 1025 Did not qualify, il 41% di position vuoto, grid=0, i punti
   non comparabili tra ere) e cosa fa il sistema per gestirle;
4. i pesi del punteggio di notevolezza, dichiarati esplicitamente, con la
   frase che chiarisce che è una regola di ordinamento e non un modello;
5. l'eredità v2: la metrica del costo del pit e il suo limite VSC, e il
   risultato negativo dello spike sulla decisione (§12.3) riportato come
   limite misurato.

Tieni la parte già scritta che resta valida invece di ricominciare da zero.
```

## E4.2 — A · I numeri per la relazione

Dipende da: E4.1

- [ ] Prompt eseguito
- [ ] `docs/NUMERI.md` aggiornato con la sezione v3
- [ ] Ogni numero è riproducibile da uno script, nessuno scritto a mano
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/NUMERI.md e data-layer/scripts/report_numbers.py.

Estendi report_numbers.py con una sezione v3 che stampa tutti i numeri
che serviranno nella relazione e all'esame: numero di eventi nel
catalogo per famiglia, copertura (gare, risultati, anni), i 10 eventi
più rari con le loro finestre, le 5 siccità più lunghe, quante gare
hanno almeno un fatto notevole e la mediana dei fatti per gara, peso
totale dei JSON esportati.

Aggiorna docs/NUMERI.md con l'output. Regola: nessun numero scritto a
mano, tutti riproducibili rilanciando lo script.
```

## E4.3 — Tutti · Pulizia e prova generale

Dipende da: E4.2

- [ ] Prompt eseguito
- [ ] Codice morto rimosso (`export_frontend.py`,
      `app/api/routes/sessions.py`, `race-anatomy-mock.json` se ancora
      presente)
- [ ] `npm run build` e `npm run lint` puliti
- [ ] `docs/DOMANDE-ESAME.md` aggiornato al frame v3
- [ ] Le tre demo da 30 secondi (PROGETTAZIONE §9) provate a voce da tutti e
      tre
- [ ] Diff letto, commit e push su `main`

**Prompt da copiare:**

```
Ultimo giro. Fai queste cose e mostrami il diff prima di ogni commit:

1. Rimuovi il codice morto ereditato dalla v2: data-layer/scripts/
   export_frontend.py e data-layer/app/api/routes/sessions.py chiamano la
   vecchia firma di calculate_pit_cost e sono rotti; public/data/
   race-anatomy-mock.json se esiste ancora. Verifica che nulla li
   importi prima di cancellarli.
2. Fai girare npm run build e npm run lint e sistema quello che esce.
3. Fai girare la pipeline completa da zero (build_all.py, poi
   build_events.py) e verifica che il sito funzioni con i JSON
   rigenerati.
4. Aggiorna docs/DOMANDE-ESAME.md al frame v3: le domande attese sono
   cambiate. Aggiungi in particolare le risposte pronte a: "che problema
   risolve?", "perché descrittivo e non predittivo?", "come fate a dire
   che è raro?", "perché le finestre sono diverse?", "dov'è D3?", "cosa
   NON può dire il vostro strumento?".
```

---

## Cosa mostrare al prossimo ricevimento

In quest'ordine, tre minuti in tutto:

1. **La domanda mirata** — si apre il compositore, si chiede "vittoria
   partendo oltre la decima piazza": 40 volte su 1125 gare, l'ultima San
   Paolo 2024. Si alza la soglia a 15, poi a 20: 9 volte, poi una sola. La
   rarità che si vede muovendo uno slider.
2. **La domanda che non sapevi di avere** — si apre una gara a caso e il
   sistema propone da solo il suo fatto più notevole.
3. **Il limite dichiarato** — due eventi con rarità simile ma finestre
   diverse, e perché non si possono confrontare.

La frase da dire per prima, prima di toccare il mouse: *"il problema è che
verificare se un fatto è raro richiede minuti e fonti che non si incrociano;
noi lo facciamo in secondi e diciamo sempre su quali dati vale."*
