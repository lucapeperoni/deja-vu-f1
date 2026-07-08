# Chaos Discount — Documento di progettazione

Progetto per il corso di Visualizzazione delle Informazioni.
Gruppo di 3 studenti. Visualizzazione interattiva in D3.js su dati reali di Formula 1.

Ultimo aggiornamento: 8 luglio 2026. La fase di ideazione è conclusa:
questo documento è la specifica condivisa per l'implementazione.

---

## 1. L'idea in due righe

In Formula 1 un pit stop costa circa 20-25 secondi rispetto a chi resta in pista.
Quando entra la Safety Car (SC) o la Virtual Safety Car (VSC), tutti sono costretti
ad andare piano: chi si ferma ai box in quel momento paga molto meno.
È uno "sconto". Ma lo sconto non è disponibile per tutti: dipende da dove sei,
da quanto sono vecchie le tue gomme, dal traffico, da cosa fa il tuo compagno
di squadra. Il progetto visualizza questa disuguaglianza.

## 2. Domanda di ricerca

Le neutralizzazioni di gara (SC e VSC) creano opportunità strategiche uguali
per tutti, o premiano chi si trova nel posto giusto al giro giusto?
Quanto vale, in secondi e in posizioni, questa "lotteria"?

In pratica il progetto risponde a tre domande:

1. Quanto vale lo sconto? (in secondi, rispetto a un pit stop normale)
2. Chi può prenderlo e chi ne resta escluso?
3. La distribuzione è equa o casuale?

Attenzione a cosa il progetto NON è: non dimostriamo che "fermarsi sotto
Safety Car conviene". Quello lo sanno tutti, è banale, e il prof ha detto
esplicitamente di evitare progetti banali. Noi mostriamo una cosa che NON si
vede in TV né in classifica: chi aveva accesso allo sconto e chi no.

## 3. Decisioni prese (riunione di ideazione)

**Un solo progetto, non due.** Nel repo c'è ancora il filone "rivalità tra
compagni di squadra" (il package si chiama ancora nemici-in-casa). Si tiene
UNA sola domanda di ricerca: quella della lotteria. Le pagine sulle rivalità
non si buttano: diventano una singola vista chiamata "stesso box, fortuna
diversa", cioè come due compagni di squadra vivono la stessa neutralizzazione
in modo opposto (uno si ferma gratis, l'altro aspetta il giro dopo).

**L'angolo che rende il progetto non banale** è misurare la disuguaglianza:
per ogni neutralizzazione, classifichiamo ogni pilota (ha sfruttato la
finestra / è stato fregato / era tagliato fuori / non gli serviva) e mostriamo
il quadro complessivo su due stagioni.

**Perimetro dati:** stagioni 2023 e 2024 complete (circa 45 gare) per le
statistiche aggregate, più 3 gare raccontate a fondo una per una.
Se il 2024 desse problemi coi dati, si ripiega sul solo 2023.

**Cose escluse di proposito:** la classifica controfattuale ("come sarebbe
finita senza Safety Car") è troppo attaccabile metodologicamente, al massimo
diventa una vista secondaria. La posizione fisica in pista al momento della
neutralizzazione richiederebbe dati di telemetria in più: fuori perimetro.

## 4. Dataset

Usiamo due fonti che si incastrano:

- **Ergast/Kaggle (i CSV in data/raw/)** — è il dataset principale richiesto
  dal corso. Ci dà: gare, piloti, team, risultati, i tempi di ogni giro di
  ogni pilota (lap_times) e i pit stop con giro e durata (pit_stops).
- **OpenF1 (API, già collegata nel data-layer)** — ci dà quello che a Ergast
  manca: QUANDO c'era Safety Car o VSC. I messaggi della direzione gara
  ("SAFETY CAR DEPLOYED", "ENDING"...) hanno il numero di giro, quindi
  l'aggancio con Ergast si fa per numero di giro, semplice.

OpenF1 copre solo dal 2023 in poi: è questo che fissa il perimetro 2023-2024.

## 5. Le metriche (il cuore del progetto)

### 5.1 Quanto costa davvero un pit stop

STATO: implementato e validato su una gara vera (task 1.1 e 1.2 della
roadmap). Quello che segue è il calcolo effettivamente in uso in
`data-layer/app/metrics/effective_pit_loss.py`, non più solo la proposta
iniziale.

Il costo di un pit stop NON è la durata in pit lane (la pit_duration di
OpenF1): quella è uguale in verde e sotto Safety Car, l'abbiamo verificato
sui dati veri (è sempre nulla nel data-layer, comunque). Lo sconto nasce da
un'altra cosa: mentre attraversi la pit lane, il "prezzo" dipende da quanto
stavano andando piano anche gli altri in quello stesso giro.

Per un pit al giro L, il costo effettivo è:

    costo effettivo = (giro di entrata L − riferimento(L))
                     + (giro di uscita L+1 − riferimento(L+1))

Il "riferimento" di un giro non è sempre lo stesso, e questa è la parte che
in fase di ideazione avevamo sbagliato:

- **se il giro è in condizioni normali**, il riferimento è la baseline
  personale del pilota: la mediana dei suoi giri puliti (senza pit, senza
  SC/VSC) in una finestra di ±5 giri, esclusi i giri di entrata/uscita di
  QUALSIASI suo pit stop nella gara; se restano meno di 3 giri puliti, la
  finestra si allarga ai confini dello stint (dal pit precedente al
  successivo);
- **se il giro è sotto una neutralizzazione (SC/VSC)**, il riferimento non
  è più la baseline personale, ma il ritmo del gruppo in quello stesso
  giro: la mediana dei tempi di chi ha percorso quel giro senza fermarsi
  (con almeno 3 piloti disponibili, altrimenti si ricade sulla baseline
  personale per mancanza di dati).

Perché questa distinzione è necessaria, e non un dettaglio: validando la
pipeline sulla gara campione (Gran Premio di Singapore 2023, vedi
`data-layer/scripts/validate_sample_race.py`) il calcolo con la sola
baseline personale dava sconti *negativi* di 60-100 secondi per i pit
sotto Safety Car — il contrario di quanto ci si aspetta. Il motivo: sotto
SC rallenta TUTTO il gruppo, non solo chi si ferma; confrontare il giro di
un pilota fermo ai box con il suo ritmo normale scambiava il rallentamento
imposto a tutti dalla Safety Car per costo del pit stop. Con il
riferimento "di gruppo" per i giri neutralizzati, sulla stessa gara i pit
sotto SC mostrano sconti coerenti (+4/+17 secondi, in linea con l'atteso).

Limite noto e non ancora risolto: per la Virtual Safety Car (finestre
molto brevi, 1-2 giri) i numeri restano meno puliti dello sconto sotto SC
piena. Ipotesi più probabile: l'allineamento per numero di giro intero non
cattura *in che punto del giro* è scattata la VSC — un pilota che entra ai
box può aver percorso quasi tutto il giro a ritmo verde e solo l'ultima
parte sotto VSC. È un limite di granularità dei dati, da dichiarare in
`/methodology` (task 4.2), non un bug da inseguire ora.

### 5.2 Il prezzo di listino

Il "prezzo di listino" di una gara è la mediana dei costi effettivi dei pit
fatti in condizioni normali (bandiera verde) in quella gara. Se sono meno di
4, si usa la mediana della stessa pista sulle due stagioni.

### 5.3 Lo sconto (chaos discount)

    sconto = prezzo di listino − costo effettivo di quel pit

Positivo: la neutralizzazione ti ha fatto risparmiare. Zero: prezzo pieno.
Negativo: hai pagato più del normale (es. traffico in corsia box).

Controllo di sanità mentale per la settimana 1: un pit in verde deve venire
sui 20-25 secondi, uno sotto VSC deve mostrare 8-12 secondi di sconto, sotto
SC anche di più. Se i numeri non tornano, è rotta la pipeline, non la F1.

### 5.4 Etichetta di ogni pit stop

Ogni pit stop riceve un'etichetta, che è anche il suo colore nei grafici:

- GREEN — pit normale, nessuna neutralizzazione
- UNDER_VSC / UNDER_SC — pit durante la neutralizzazione (gli sconti)
- JUST_BEFORE — pit in verde fino a 3 giri PRIMA della neutralizzazione:
  i "fregati", hanno pagato prezzo pieno per sfortuna
- JUST_AFTER — pit entro 2 giri dopo la fine
- più un flag double_stack se i due piloti dello stesso team si fermano
  nello stesso giro (il secondo perde tempo in coda al primo)

### 5.5 Esito di ogni pilota per ogni neutralizzazione

Per la "matrice della lotteria" (vedi viste): a ogni neutralizzazione, ogni
pilota finisce in una di queste categorie:

- EXPLOITED — si è fermato nella finestra: ha preso lo sconto
- FULL_PRICE — si era fermato nei 3 giri prima: fregato
- LOCKED_OUT — non poteva fermarsi: gomme troppo fresche (meno di 8 giri)
  oppure sarebbe rientrato dietro ad almeno 3 auto
- NOT_NEEDED — non aveva bisogno di fermarsi
- NEUTRAL — nessuna delle precedenti

Le soglie (8 giri, 3 auto) sono parametri dichiarati nella pagina
/methodology del sito, così nessuno ci può accusare di numeri magici.

## 6. Come arrivano i dati al sito

Una sola pipeline, quella Python del data-layer (che già parla con OpenF1).
Il preprocess TypeScript resta al massimo per le anagrafiche piloti/team.

Il flusso: i CSV Ergast e i messaggi race control di OpenF1 si uniscono per
numero di giro; si calcolano tempi cumulati, gap, etichette e sconti; si
esporta tutto in public/data/ come JSON statici:

- index.json — l'elenco delle gare per il selettore
- races/nome-gara.json — un file per gara (200-400 KB), con: info gara,
  finestre di neutralizzazione, e per ogni pilota i giri (tempo, posizione,
  gap), i pit (etichetta, costo, sconto, posizioni prima/dopo) e gli esiti
- aggregate.json — i dati per le viste d'insieme (tutti i pit delle due
  stagioni, la matrice multi-gara)

Niente backend: sito statico, si carica il JSON della gara quando serve.

## 7. Le viste

Struttura del sito: la home mostra la tesi sull'insieme delle gare
(overview), le pagine gara mostrano la prova nei 3 casi scelti (detail).

**Vista 1 — Race trace.** Il grafico principale della pagina gara.
Asse X: i giri. Asse Y: il distacco da un riferimento. Una linea per pilota.
Le finestre SC/VSC sono bande verticali gialle. I pit stop sono pallini sulla
linea, colorati con l'etichetta di §5.4. Qui SI VEDE la Safety Car che
compatta il gruppo e chi "salta" gli altri fermandosi gratis.
Un brush (selezione trascinando sull'asse dei giri) filtra le altre viste.
Parte dal componente esistente RaceAnatomyTimeline, oggi su dati finti.

**Vista 2 — Gli sconti.** Barre orizzontali, una per pit stop, ordinate:
a destra chi ha guadagnato secondi, a sinistra chi ha perso. Colore =
etichetta del pit. Risponde a "quanto vale lo sconto e chi l'ha preso".
Parte da PitCostDumbbell.

**Vista 3 — La classifica deformata.** Due colonne di nomi: posizioni al
momento della neutralizzazione e posizioni 3 giri dopo i pit. Linee che
collegano gli stessi piloti: chi si incrocia è salito o sceso per effetto
dell'evento. Si riadatta RaceSlopeChart (nato per le rivalità).

**Vista 4 — La matrice della lotteria.** Righe = piloti, colonne =
neutralizzazioni, ogni cella colorata con l'esito di §5.5. È la risposta
diretta alla domanda di ricerca. Ripetuta per tutte le gare del campione
diventa la vista d'insieme in home. Parte da OpportunityWindow.

**Vista 5 — Stesso box, fortuna diversa.** Confronto tra i due piloti dello
stesso team davanti alla stessa finestra (double stack incluso). Ricicla il
lavoro fatto sulle rivalità. Parte da DuelTimeline e dalle pagine rivalry.

**Vista 6 — La distribuzione degli sconti (home).** Tutti i pit stop
2023-2024 su un asse: prezzo pieno di qua, scontati di là. Dà il peso
statistico alla tesi. Da fare da zero.

Interazione comune: passando il mouse su un pilota, si evidenzia in tutte le
viste della pagina; click per bloccarlo; tooltip con i numeri.

Regola vincolante sul colore: il colore codifica SEMPRE l'etichetta del pit
(verde/VSC/SC/fregato), MAI il team. Unica eccezione: la vista 5, che ha un
interruttore per passare ai colori team. Se il colore significa due cose
insieme, il grafico diventa illeggibile.

Regola sul D3 (requisito del corso): D3 deve possedere l'SVG — scale, assi,
data join, transizioni e brush si fanno con D3 dentro un useEffect; React fa
solo da contenitore, routing e gestione dello stato. Da rispettare in tutti i
componenti e da dichiarare in relazione, perché all'esame chiederanno
"dov'è D3?".

## 8. Aggancio al corso (per la relazione e l'esame)

Il corso segue l'impianto di Munzner. Le slide chiedono di progettare secondo
il "nested model" (4 livelli) e di descrivere il progetto con la loro
terminologia. Ecco la traduzione, livello per livello, da riusare pari pari
in relazione:

**Domain situation** (chi usa il sistema e per decidere cosa): appassionati e
analisti F1; la decisione è verificare o smentire l'ipotesi "la lotteria
esiste". Le slide chiedono esplicitamente di restringersi a un tipo di utente
e una decisione: noi lo facciamo, e va detto.

**Data e task abstraction** (che dati e che operazioni): serie temporali per
pilota + eventi (pit, neutralizzazioni) + variabili derivate (gli sconti).
I task, nella tassonomia di Amar et al. vista a lezione: compute derived
value (lo sconto), characterize distribution (vista 6), find extremum (le
barre ordinate), find anomalies (i fregati e gli esclusi), filter e sort
(brush e ordinamenti), correlate (timing del pit contro sconto), compare
(compagni di squadra, gara contro gara).

**Visual encoding e interaction idioms** (come si disegna e come si
interagisce): marks = linee, barre, celle, segmenti; channels = posizione per
giri e distacchi, colore (hue) per l'etichetta categoriale, lunghezza per lo
sconto. L'interazione copre le sei categorie di Yi et al. viste a lezione:
select (click sul pilota), explore (selettore gara/evento), reconfigure
(riordino delle barre), encode (interruttore colori nella vista 5), filter
(brush), connect (brushing and linking tra le viste).

**Algorithm**: pipeline Python + rendering D3; dimensioni piccole
(20 piloti × 70 giri), nessun problema di prestazioni.

L'architettura del sito È il mantra di Shneiderman citato a lezione:
"overview first (home), zoom and filter (pagina gara, brush), then
details-on-demand (tooltip)".

Sul colore, con le parole della lezione 060: l'etichetta del pit è una
variabile nominale, quindi colormap categoriale (5 classi, sotto il limite di
distinguibilità, niente arcobaleno); lo sconto è una variabile quantitativa
con uno zero significativo, quindi colormap divergente, in coppia
colorblind-safe (blu/arancio, non rosso/verde).

Sulle serie temporali (lezione 100): all'esame chiederanno perché un multiple
line chart e non le alternative viste a lezione (small multiples, horizon
graph). Risposta pronta: il nostro task è confrontare i piloti NELLO STESSO
istante (il momento della neutralizzazione), e questo richiede le linee
sovrapposte nello stesso grafico; le alternative separano le serie e
distruggono proprio il confronto che ci serve.

Ultima cosa: metà corso (lezioni 150-250) è graph drawing e non c'entra col
progetto. Se lo chiedono: i nostri dati sono temporali e multivariati, non
relazionali/a grafo, e la scelta discende dalla task abstraction.

## 9. Le 3 gare-caso

Da confermare quando gira la pipeline (task 2.2), ma i tipi sono fissati:

1. una VSC breve a metà gara — la lotteria pura: contava solo essere nella
   finestra giusta
2. una Safety Car che compatta il gruppo e rimescola (candidate: Australia
   2023, Monza 2024). **Candidata forte già verificata**: il Gran Premio di
   Singapore 2023 (Ergast raceId 1113), usato come gara campione nel task
   1.2 — ha una SC pulita al giro 20-22 con 14 auto ai box nello stesso
   giro (un vero "tappo"), più una VSC ai giri 44-45. La selezione
   definitiva resta comunque al task 2.2.
3. una gara con double stack riuscito o fallito — alimenta la vista 5

In appendice: una gara senza neutralizzazioni come termine di paragone.

## 10. Rischi noti e come li gestiamo

1. ~~La metrica attuale è sbagliata (usa la durata in pit lane)~~ **RISOLTO**
   (task 1.1): riscritta secondo §5.1. Durante la validazione (task 1.2) è
   emerso un secondo problema, più sottile, ed è stato corretto anche
   quello — vedi il dettaglio in §5.1 sul riferimento "di gruppo" nei giri
   sotto neutralizzazione.
2. ~~L'aggancio Ergast-OpenF1 per numero di giro va validato~~ **VALIDATO**
   (task 1.2, gara campione: Singapore GP 2023, raceId 1113 / OpenF1
   session_key 9165). Aggancio più semplice del previsto: i messaggi di
   race control di OpenF1 includono già il numero di giro (`lap_number`),
   non serve ricostruirlo dall'orario di gara. Trovati e corretti anche due
   bug in `neutralization_events.py`: chiudeva le finestre SC/VSC troppo
   presto reagendo a bandiere "CLEAR" di settore scollegate dalla Safety
   Car, e scambiava l'inizio di una VSC per l'inizio di una SC (sottostringa
   del messaggio). Limite residuo non risolto: la granularità per giro
   intero rende gli sconti sotto VSC meno puliti di quelli sotto SC piena
   (vedi §5.1) — da dichiarare in `/methodology`, non da inseguire ora.
3. Il CSV Kaggle potrebbe non coprire tutto il 2024: le gare mancanti si
   scaricano da Jolpica, che ha lo stesso formato di Ergast. **Verificato
   (task 0.2)**: sia il 2023 (22 gare) sia il 2024 (24 gare) sono completi
   nel Kaggle già presente, nessuna integrazione necessaria per questo
   perimetro.
4. Oggi ci sono due pipeline dati (TypeScript e Python): si converge su
   quella Python. **Nota**: `data-layer/scripts/export_frontend.py` e
   `data-layer/app/api/routes/sessions.py` chiamano ancora la vecchia
   firma di `calculate_pit_cost` (quella basata su `pit_duration`) e oggi
   sono rotti: vanno riscritti nel task 2.1, non prima.
5. Col rischio React, D3 può ridursi a due scale: vale la regola
   "D3 possiede l'SVG" di §7.
6. Le soglie della categoria LOCKED_OUT (8 giri, 3 auto) sono arbitrarie:
   si dichiarano in /methodology con la motivazione.

## 11. Divisione del lavoro (proposta, 5 settimane)

Persona A — dati. Settimane 1-2: riscrive le metriche e valida sulla gara
campione, poi fa girare la pipeline su tutte le gare 2023-24. Settimane 3-4:
export dei JSON, selezione delle 3 gare-caso, aggregate.json. Settimana 5:
numeri per la relazione.

Persona B — viste principali. Settimane 1-2: race trace con dati veri.
Settimane 3-4: vista sconti e distribuzione in home. Settimana 5: rifiniture
e transizioni.

Persona C — viste e interazione. Settimane 1-2: matrice della lotteria.
Settimane 3-4: slope chart, vista compagni, hover e brush coordinati.
Settimana 5: racconto delle 3 gare-caso e layout.

Milestone di fine settimana 1 (quella che de-rischia tutto): lo sconto
calcolato sulla gara campione torna con gli ordini di grandezza attesi.
Se non torna, ci si ferma e si sistema la pipeline prima di andare avanti.
