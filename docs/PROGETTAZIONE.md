# Box, box? — Documento di progettazione (v2)

Progetto per il corso di Visualizzazione delle Informazioni.
Gruppo di 3 studenti. Visualizzazione interattiva in D3.js su dati reali di Formula 1.

Ultimo aggiornamento: 12 luglio 2026 — **pivot dopo il feedback del
professore** (v1 "Chaos Discount": il progetto descriveva un fenomeno ma
non individuava un problema né proponeva una soluzione). Le sezioni 1-3
sono riscritte per il nuovo frame; metriche (§5), pipeline (§6) e gran
parte delle viste (§7) restano valide e già implementate — vedi
`docs/ROADMAP-2.md` per il piano dei soli delta.

---

## 1. Il problema e la soluzione (l'idea in due righe)

**Il problema.** Quando entra una Safety Car (SC) o una Virtual Safety Car
(VSC), ogni muretto ha pochi secondi per rispondere alla chiamata radio
"box, box?": fermarsi adesso costa molto meno del normale (15,5s mediani
contro 22,5s in verde, misurato dalla nostra pipeline su 46 gare), ma si
rientra nel traffico; restare fuori conserva la posizione, con gomme più
vecchie e la scommessa di dover pagare prezzo pieno più avanti. La
decisione dipende da parametri che interagiscono (gap, gomme, piano soste,
cosa fanno gli altri) e da fuori — TV, timing screen, classifica — è
invisibile: si vede solo l'esito, mai le carte che il muretto aveva in
mano. Persino i top team la sbagliano (Ferrari a Monaco 2022, Mercedes ad
Abu Dhabi 2021).

**La soluzione.** Uno strumento di visualizzazione che, per ogni
neutralizzazione delle stagioni 2023-2024: (a) ricostruisce la decisione
com'era in quel momento, pilota per pilota, con le due opzioni
quantificate; (b) mostra la scelta fatta e com'è andata; (c) aggrega
~800 decisioni reali in una mappa empirica del "quando conviene fermarsi".

## 2. Domanda di ricerca

**Quando conviene fermarsi ai box durante una neutralizzazione?**

In pratica il progetto risponde a tre domande:

1. Che decisione aveva davanti ciascun pilota? (ricostruzione: opzioni
   BOX e STAY quantificate — §5.6)
2. Chi ha scelto bene e chi ha sbagliato? (verdetto retrospettivo:
   esito dopo 5 giri, confronto col "gemello")
3. Quali condizioni rendono conveniente fermarsi? (la mappa empirica
   su due stagioni di scelte vere)

Utente di riferimento e decisione supportata (richiesti dalle slide):
l'analista di strategia — o il tifoso che vuole giudicare il muretto —
che si chiede "il pilota X doveva fermarsi?".

Cosa il progetto NON è: non un modello predittivo né una simulazione
(fuori scopo per un corso di InfoViz e metodologicamente attaccabile).
La risposta al "quando conviene" emerge facendo parlare le scelte reali
e i loro esiti — che è esattamente il mestiere della visualizzazione
delle informazioni.

## 3. Decisioni prese

**Pivot di luglio 2026 (feedback del professore).** La v1 dimostrava che
"la lotteria esiste" (descrittivo, nessun problema da risolvere). Il
riorientamento trasforma lo stesso dataset e la stessa pipeline in uno
strumento di supporto alla decisione. Regole del pivot:

- **La pipeline validata non si tocca.** Il layer decisionale
  (`decision_snapshots`) si costruisce SOPRA i JSON già esportati: se il
  nuovo layer avesse problemi, il progetto v1 resta in piedi come rete
  di sicurezza.
- **Lo "sconto" (chaos discount) resta il concetto chiave ma viene
  declassato da tesi a metrica**: quantifica il costo dell'opzione BOX.
  Tutta la §5 resta valida così com'è.
- **La tesi della disuguaglianza non si butta**: diventa il capitolo
  "quando la scelta non ce l'hai" (LOCKED_OUT, JUST_BEFORE) — dentro il
  nuovo frame è più forte, perché mostra i limiti dello strumento.
- **Il controfattuale simulato resta escluso** (come in v1): il
  controfattuale ce lo dà il "gemello" — il pilota vicino in classifica,
  in condizioni simili, che ha scelto l'opposto. Il gemello perfetto è
  il compagno di squadra: stessa macchina, stesso muretto → la vista
  "stesso box, fortuna diversa" diventa l'esperimento naturale del
  progetto.
- **Un solo ricevimento, con tutto fatto**: si porta il progetto
  completo riorientato; le eventuali correzioni si fanno dopo, sul
  feedback.

**Perimetro dati:** invariato — stagioni 2023 e 2024 complete (46 gare,
42 neutralizzazioni, ~1700 pit stop), 3 gare raccontate a fondo.

**Cose escluse di proposito:** simulazioni di gara e modelli predittivi;
la classifica controfattuale; la posizione fisica in pista al momento
della neutralizzazione (servirebbe telemetria); i casi bagnato come
parametro (stravolgono i riferimenti — limite dichiarato); il punto del
giro in cui scatta la neutralizzazione (limite di granularità già noto,
§5.1).

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

### 5.1bis Due problemi emersi eseguendo la pipeline su tutte le 46 gare (task 2.1)

**Le bandiere rosse gonfiano il costo a migliaia di secondi — RISOLTO.**
In `lap_times.csv` alcuni giri durano diverse migliaia di secondi: sono
bandiere rosse, il tempo del giro include l'intera sospensione della gara,
non è un giro di corsa vero. Il sistema oggi non modella le bandiere rosse
come evento (solo SC/VSC), quindi se un pit stop cade proprio su uno di
questi giri il suo costo effettivo esplodeva a livelli assurdi (osservato:
sconti fino a -2561s / +2464s sull'aggregato delle due stagioni). Verificato
sui dati: 152 giri su 46 gare superano i 240 secondi (4 minuti), soglia
ben separata dal giro più lento plausibile anche sotto Safety Car pesante
(230s osservati). Questi giri corrispondono esattamente a 8 gare con
bandiere rosse realmente documentate nel 2023-2024 (tra cui Australia 2023,
Messico 2023, San Paolo 2023 e 2024, Giappone 2024, Monaco 2024).

Correzione applicata in `build_all.py` (`MAX_PLAUSIBLE_LAP_MS = 240000`):
i giri con tempo sopra soglia sono esclusi dal calcolo del tempo/costo
(il pit che ci cade sopra risulta con costo non calcolabile, `None`,
invece che assurdo), ma **non** dalla posizione — la classifica in quel
giro resta un dato valido anche quando il tempo non lo è. Limite noto da
dichiarare in `/methodology`: le gare con bandiera rossa non sono
modellate come evento a sé, i giri coinvolti sono trattati come dati
mancanti.

**Un residuo di sconti estremi in gare "caotiche" — RISOLTO (verificando la
home, task 3.6): i pit senza riferimento affidabile ora si scartano invece
di calcolarsi male.** Il problema era sempre lo stesso individuato sopra:
il riferimento "di gruppo" per i giri sotto neutralizzazione richiede
almeno `FIELD_REFERENCE_MIN_SAMPLES` (3) piloti che in quel giro non si
sono fermati. Quando **quasi tutti si fermano insieme** (pit di massa
sotto una SC pesante — è proprio il momento in cui conviene farlo) restano
meno di 3 piloti "puliti", e il vecchio codice ripiegava silenziosamente
sulla baseline personale del pilota: esattamente l'errore che il
riferimento di gruppo esiste per evitare, e che gonfiava il costo a
centinaia di secondi (osservato: Qatar 2024, giri 35-36, 150-180s di
"costo" per un pit stop).

Prova concreta trovata verificando la home (vista 6): su 42 finestre di
neutralizzazione dell'intero campione, 5 avevano meno di 3 piloti liberi
in almeno un giro: bastava a spiegare perché la mediana dei pit sotto SC
(26,0s) risultava più ALTA di quella dei pit in verde (22,5s) — il
contrario della tesi del progetto.

Correzione applicata in `effective_pit_loss.py`: quando il riferimento di
gruppo manca per un giro sotto neutralizzazione, il pit stop viene
**scartato** (`effective_pit_loss_seconds = None`, `discount_seconds =
None`) invece di calcolato sulla baseline personale; il nuovo campo
`missing_field_reference` (propagato come `lowConfidence` nei JSON)
segnala il perché. 110 pit stop su 1737 (6,3%, quasi tutti sotto Safety
Car piena: 109/251, contro 1/82 sotto VSC — coerente con VSC che rallenta
il gruppo molto meno) sono ora esclusi dal calcolo invece di avere un
numero sbagliato. Dopo la correzione, la mediana sotto Safety Car scende a
15,5s (sotto i 22,5s del verde, lo sconto atteso), quella sotto VSC resta
vicina al verde (23,1s) — coerente col limite di granularità già
dichiarato sopra (finestre VSC troppo brevi per allinearle bene al singolo
giro).

Non è più un limite "da dichiarare e basta": i numeri che restano nel
grafico ora sono tutti calcolati in modo affidabile. Il limite di
granularità della VSC (paragrafo precedente) resta invece dichiarato in
`/methodology`, perché quello è un problema di risoluzione dei dati non
risolvibile scartando pit stop.

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

### 5.6 Il modello della decisione (il layer del pivot)

Per ogni pilota × neutralizzazione, uno **snapshot della decisione**
calcolato al giro del deploy. È il cuore concettuale nuovo; tutto il
resto della §5 gli fa da fondamenta.

**Cosa vede il muretto (input).** Tutti derivabili dai dati già
esportati, verificato sui JSON reali:

- posizione e gap con chi sta davanti/dietro (dai tempi cumulati `ms`
  per giro);
- età e mescola gomme (già nei campi `tyreAge` / `tyreCompound` degli
  outcomes);
- giri mancanti / fase di gara;
- soste già fatte vs soste tipiche di quella gara — il pit "gratis" è
  tale solo se quella sosta andava comunque fatta; se il piano era già
  completo, è uno stop in più e lo sconto non lo copre quasi mai;
- cosa fanno gli altri: quota del gruppo che si ferma in quel giro,
  ordine nel double stack (flag già in pipeline);
- contesto circuito: prezzo di listino della pista (§5.2, già
  calcolato), **sorpassabilità** (nuovo: media dei cambi di posizione in
  giri verdi per circuito, dai nostri stessi dati — la stessa decisione
  vale l'opposto a Monaco e a Monza) e **caoticità** (frequenza storica
  di SC/VSC per pista: la scommessa "arriverà un'altra Safety Car" —
  stima grezza su 2 stagioni, da dichiarare come tale).

**Le due opzioni, quantificate:**

- **BOX** — costo atteso = perdita effettiva scontata (mediana
  dell'evento, o del campione se l'evento ha pochi pit affidabili);
  **posizione di rientro prevista** = riposizionamento sul tempo
  cumulato + costo atteso (si contano le auto che restano davanti);
  beneficio = gomme fresche (delta di passo stimato dai giri verdi
  della stessa gara, versione semplice).
- **STAY** — posizione conservata, gomme invariate; costo differito =
  prezzo pieno (§5.2) se serve ancora una sosta, con la scommessa
  implicita su un'altra neutralizzazione (parametro caoticità).

**Il verdetto (retrospettivo):** scelta (BOX / STAY / FORZATA, quando
l'esito v1 era LOCKED_OUT) × esito (delta posizioni dopo 5 giri, già in
pipeline: guadagnato / perso / pari). Nei casi-storia il verdetto si
rafforza col confronto col gemello (definito in §3).

**Decisione presa (dopo lo spike P1.2, v. STATO sotto): niente scatter
con la pretesa di un confine netto.** La mappa "quando conviene" diventa
un confronto di **distribuzioni**: l'indice combinato (0,6 × traffico +
0,4 × margine dietro, entrambi z-score, pesi dichiarati) per chi ha
guadagnato vs chi ha perso, come istogrammi/densità sovrapposti (non
scatter a punti). Mostra onestamente quello che c'è nei dati: le due
popolazioni hanno medie diverse (0,95 vs 0,45) ma si sovrappongono
molto — un vantaggio statistico reale, non una certezza. Motivazione
dichiarabile all'esame: è coerente con la letteratura sull'argomento
(v. STATO sotto), che per fare meglio di una correlazione debole usa
modelli molto più pesanti (deep learning, reinforcement learning con
memoria temporale) — 2 variabili e un grafico 2D non bastano per un
confine netto, ed è onesto dirlo invece di fingere un confine che non
c'è. I piloti NOT_NEEDED restano esclusi dalla mappa ma visibili nella
matrice. L'indice combinato è anche un campo dichiarato della scheda
decisione (tooltip): non "previsione", ma "vantaggio statistico
stimato" — coerente con l'idea del progetto (§3) che lo strumento aiuta
la decisione, non la sostituisce.

STATO spike P1.2 (`data-layer/scripts/spike_decision_map.py`): eseguito
su tutte le neutralizzazioni delle 46 gare, 646 snapshot pilota×evento
(NOT_NEEDED escluso). Prima condizione necessaria: `tyreAge`/
`tyreCompound` (usati anche qui, non solo nei tooltip) erano arricchiti
da `attach_tyre_info` **solo per le 3 gare-caso** — copertura 12% sul
totale. Risolto estendendo l'arricchimento a ogni gara con almeno una
neutralizzazione (non tocca costo effettivo/sconto/etichetta, §5.1-5.4,
resta un campo puramente descrittivo) e rilanciando `build_all.py`:
copertura ora 93%.

Con la copertura piena, però, **nessuna delle coppie di assi provate
mostra una separazione visibile** tra decisioni BOX che hanno pagato e
no (margine dietro × età gomme, età gomme × fase di gara, soste fatte ×
età gomme, margine dietro × soste fatte — grafici in
`data-layer/data/spike_plots/`). È coerente con un'altra verifica già
fatta sui questi dati (`data-layer/scripts/import_stints_all.py`):
l'età gomme del rivale non prediceva i giri per riscavalcarlo
(correlazione ~0 su 263 coppie); qui il segnale manca anche nella
direzione "la mia età gomme e il mio margine predicono se il MIO box
paga".

Aggiunte due variabili di §5.6 non ancora provate: **sorpassabilità**
del circuito (nuova, calcolata nello spike: media dei cambi di
posizione tra giri verdi consecutivi, per circuito, media sulle 2
stagioni) e **traffico** (quota del gruppo che si ferma nella stessa
finestra, già derivabile dai pit esistenti). Sorpassabilità non aggiunge
nulla (correlazione con l'esito ≈ -0.10, come età gomme). Il traffico
invece un segnale reale ce l'ha: correlazione 0,28 con l'esito a 5 giri
tra chi ha boxato (contro 0,18 del margine dietro, ≈0 per età gomme e
sorpassabilità) — coerente con quanto osservato a mano sullo spike
Jeddah (P1.1): quando tanti si fermano insieme nella stessa finestra,
si "salvano" a vicenda. Il problema: 0,28 è un segnale reale ma debole
— anche nella coppia migliore provata (traffico × margine dietro) la
nuvola dei punti resta troppo rumorosa per un confine visibile, non solo
per il centroide.

**Indice combinato (round 3, su richiesta).** Pesi dichiarati a mano
(non ottimizzati sui dati, per non rischiare overfitting su soli 133
casi BOX guadagnato/perso): 0,6 × z-score(traffico) + 0,4 ×
z-score(margine dietro) — pesi in proporzione alla correlazione
individuale misurata (0,28 e 0,18). Risultato: correlazione con l'esito
**0,34-0,36**, verificata stabile su due metà casuali del campione
(0,37 e 0,35). Le distribuzioni di chi guadagna e chi perde, sull'indice
combinato, hanno medie chiaramente diverse (0,95 vs 0,45) ma **si
sovrappongono pesantemente** (grafico
`data-layer/data/spike_plots/h2_indice_combinato_distribuzione.png`):
non è un confine, è uno spostamento di tendenza.

**Ricerca esterna (verifica di sanità, non citata come fonte del
metodo):** nessun lavoro accademico trovato risolve questo problema con
2 variabili e uno scatter — chi ci prova usa deep learning su
telemetria (F1-score 0,81, CI 95% [0,79-0,83]) o reinforcement learning
con memoria temporale, e nota esplicitamente che lo stato istantaneo
(gap, gomme) da solo non basta. Conferma che il segnale debole trovato
qui non è un errore del nostro spike ma la natura del problema — utile
per rispondere a "perché non un confine netto?" in sede d'esame.

**Cosa NON abbiamo più bisogno di decidere**: la scelta sopra chiude la
questione aperta durante lo spike (P1.2 in `docs/ROADMAP-2.md`) — P2/P3
possono partire con l'indice combinato, non con margine×età-gomme.

## 6. Come arrivano i dati al sito

STATO: implementato (task 2.1), eseguito su tutte le 46 gare 2023-2024.
0 gare saltate, 42 neutralizzazioni catturate. Quello che segue è la
pipeline reale (`data-layer/scripts/build_all.py`), non solo il progetto.

Una sola pipeline, quella Python del data-layer (che parla sia con i CSV
Ergast sia con OpenF1). Il preprocess TypeScript resta solo per le
anagrafiche piloti/team delle pagine non ancora riconvertite.

Il flusso: per ogni gara, la sessione di gara OpenF1 corrispondente si
trova per data (con tolleranza di ±1 giorno: le gare in notturna, es. Las
Vegas, hanno una data UTC diversa dalla data "nominale" di Ergast); i
messaggi di race control danno le finestre SC/VSC già in numero di giro
(OpenF1 lo fornisce direttamente, non va ricostruito); si calcolano tempi
cumulati, gap, race trace, costi ed etichette dei pit, e gli esiti
pilota-per-evento; si esporta tutto in public/data/ come JSON statici:

- **index.json** — l'elenco delle gare (id/slug, anno, nome, circuito,
  numero di neutralizzazioni, flag "interessante" preliminare) per il
  selettore. Oggi 10 KB per 46 gare.
- **races/&lt;anno&gt;-&lt;circuitRef&gt;.json** (es. `2023-marina_bay.json`)
  — un file per gara, ~100-135 KB reali (sotto il budget dei 500 KB): info
  gara (incluso `excludedAnomalousLaps`, il conteggio dei giri scartati
  per bandiera rossa, vedi §5.1bis), finestre di neutralizzazione, e per
  ogni pilota i giri (posizione, tempo cumulato, gap dal leader, race
  trace), i pit (etichetta, costo effettivo, sconto, posizioni prima/dopo/
  dopo 3/dopo 5 giri, double stack) e gli esiti per ogni evento della gara
  (categoria ed eventuale delta di posizioni).
- **aggregate.json** — tutti i pit delle due stagioni (1658 nel campione
  attuale) con etichetta e sconto, più la matrice esiti pilota × evento ×
  gara. 389 KB.
- **params.json** — le soglie dichiarate della pipeline (età minima gomme,
  auto minime per il traffico, finestre di baseline, ecc.), lette da qui
  dalla pagina `/methodology` (task 4.2) invece di essere riscritte a mano.

Niente backend: sito statico, si carica il JSON della gara quando serve.

## 7. Le viste

Struttura del sito: la home mostra la risposta aggregata al "quando
conviene" (overview), le pagine gara ricostruiscono le decisioni nei
3 casi scelti (detail).

**Riorientamento delle viste (pivot v2).** Le descrizioni sotto restano
la base implementata; questa tabella dice cosa cambia per ciascuna:

| Vista (v1, implementata) | Nel pivot diventa |
|---|---|
| 1 — Race trace | Invariata: è il "replay" di contesto, con brush |
| 2 — Barre degli sconti | Invariata ma riframata: quantifica il costo dell'opzione BOX (sotto SC vs in verde) |
| 3 — Slope chart | **Il momento della scelta**: si aggiunge una colonna centrale — posizioni al deploy → *rientro previsto se boxi* (calcolo §5.6) → posizioni reali dopo. La distanza tra previsione e realtà È il racconto |
| 4 — Matrice della lotteria | **Matrice scelta × esito**: stessi dati, etichette nuove (si è fermato/no × guadagnato/perso; LOCKED_OUT → "scelta forzata"). Tooltip arricchito con la scheda decisione |
| 5 — Stesso box, fortuna diversa | Invariata, promossa a **esperimento naturale** (il gemello perfetto, §3) |
| 6 — Distribuzione sconti (home) | **La mappa del "quando conviene"**: NON uno scatter — istogrammi/densità sovrapposti dell'indice combinato (§5.6) per guadagnato vs perso, così com'è deciso dopo lo spike P1.2 (nessun confine netto trovato con 2 assi puri, v. §5.6). Il beeswarm attuale scende a sezione di supporto ("quanto costa l'opzione BOX") |

In più: la **scheda decisione** (§5.6) come pannello/tooltip ricco nella
pagina gara, e le storie delle 3 gare-caso riscritte come storie di
decisione.

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

**Domain situation** (chi usa il sistema e per decidere cosa): l'analista
di strategia — o il tifoso che vuole giudicare il muretto — e la decisione
supportata è "il pilota X doveva fermarsi?". Le slide chiedono
esplicitamente di restringersi a un tipo di utente e una decisione: il
pivot rende questa risposta molto più netta della v1 ("verificare che la
lotteria esiste"), e all'esame va rivendicato: il progetto individua un
problema (la decisione box/no-box è illeggibile e costosa da sbagliare)
e propone una soluzione (lo strumento che la ricostruisce e la mappa).

**Data e task abstraction** (che dati e che operazioni): serie temporali per
pilota + eventi (pit, neutralizzazioni) + variabili derivate (sconti,
snapshot della decisione, verdetti). I task, nella tassonomia di Amar et
al. vista a lezione: compute derived value (sconto, rientro previsto),
characterize distribution (la mappa del quando conviene), find extremum (le
barre ordinate, le scelte più costose), find anomalies (i fregati, gli
esclusi, le scelte controcorrente), filter e sort (brush, filtri della
mappa), correlate (condizioni della decisione contro esito — il task
centrale del pivot), compare (compagni di squadra/gemelli, gara contro
gara).

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

STATO: scelte (task 2.2), con `data-layer/scripts/select_case_races.py`
che ordina le 46 gare 2023-2024 per interesse narrativo su 4 criteri
(punteggio VSC a metà gara, punteggio SC-che-rimescola, presenza di double
stack, varianza degli sconti). Prima di accettare la proposta meccanica
dello script, ogni gara candidata è stata controllata a mano per escludere
che i punteggi alti fossero gonfiati da ritiri/incidenti invece che da
vera strategia di pit — in tutte e tre le gare scelte il campo è arrivato
al completo classificato, il rimescolamento è genuina strategia.

1. **VSC breve a metà gara — Bahrain 2023.** Un'unica VSC isolata (unica
   neutralizzazione dell'intera gara), con 6 pit stop nella finestra: la
   lotteria pura, un solo momento, senza altri eventi a complicare la
   lettura. Preferita a un'alternativa con punteggio più alto (Cina 2024,
   14 pit in finestra) perché quella gara ha 3 eventi consecutivi
   (1 VSC + 2 SC): più ricca ma meno adatta a raccontare l'archetipo
   "un solo momento, contava solo essere lì" in modo pulito. Cina 2024
   resta un'ottima candidata come quinta gara "bonus" se in futuro serve
   un caso più caotico.
2. **Safety Car che compatta il gruppo e rimescola — Arabia Saudita 2024
   (Jeddah).** SC ai giri 7-9: 14 piloti hanno sfruttato la finestra
   (EXPLOITED), 6 ne sono rimasti esclusi (LOCKED_OUT) — uno split netto,
   esattamente la tensione "chi può e chi non può" al centro della domanda
   di ricerca.
3. **Double stack riuscito o fallito — Australia 2023 (Albert Park).**
   Gara con 3 eventi di neutralizzazione (2 SC + 1 VSC) ed esiti opposti
   tra un evento e l'altro (14 LOCKED_OUT/5 EXPLOITED sul primo SC, poi
   18 EXPLOITED/1 LOCKED_OUT sul secondo). 42 pit stop in double stack,
   distribuiti su 8 team diversi (non un artefatto concentrato su una
   sola squadra): la gara più ricca del campione per la vista 5.

In appendice: **Monaco 2023** come gara di controllo — zero
neutralizzazioni nell'intera gara, termine di paragone per il prezzo di
listino "puro".

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
   (task 0.2 e 2.1)**: sia il 2023 (22 gare) sia il 2024 (24 gare) sono
   completi nel Kaggle già presente; la pipeline (task 2.1) ha processato
   tutte e 46 le gare senza scarti, nessuna integrazione Jolpica necessaria
   per questo perimetro.
4. Oggi ci sono due pipeline dati (TypeScript e Python): si converge su
   quella Python (ora `build_all.py`, task 2.1 completato). **Nota**:
   `data-layer/scripts/export_frontend.py` e
   `data-layer/app/api/routes/sessions.py` chiamano ancora la vecchia
   firma di `calculate_pit_cost` (quella basata su `pit_duration`) e sono
   **ancora rotti** — `build_all.py` è il loro sostituto, ma questi due
   file non sono stati toccati. Non sono più usati da nessuna pipeline
   attiva; da rimuovere quando si collega il frontend ai dati veri
   (task 3.x), per non lasciare codice morto che confonde.
5. Col rischio React, D3 può ridursi a due scale: vale la regola
   "D3 possiede l'SVG" di §7.
6. Le soglie della categoria LOCKED_OUT (8 giri, 3 auto) sono arbitrarie:
   si dichiarano in /methodology con la motivazione.
7. **Nuovo (trovato al task 2.1), RISOLTO**: le bandiere rosse fanno
   esplodere il costo del pit stop a migliaia di secondi se un pit cade sul
   giro sospeso. Corretto escludendo i giri con tempo sopra i 240 secondi
   dal calcolo del tempo (non dalla posizione). Dettaglio in §5.1bis.
8. **Nuovo (trovato al task 2.1), NON risolto, limite dichiarato**: il 9,2%
   dei pit stop mostra ancora sconti estremi, concentrati in poche gare con
   pit di massa o partenze sotto neutralizzazione (il campione per il
   riferimento "di gruppo" si assottiglia o diventa fuorviante). Da
   dichiarare in `/methodology`, non da inseguire ora. Dettaglio in §5.1bis.

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
