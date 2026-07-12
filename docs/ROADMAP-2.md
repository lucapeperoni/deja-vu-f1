# Box, box? — Roadmap del pivot (v2, per Notion)

Contesto: il progetto v1 ("Chaos Discount") è completo — pipeline validata
su 46 gare, tutte le viste implementate, storie, metodologia e numeri
(task fino a 5.3 della ROADMAP v1; le checkbox lì non sono aggiornate, fa
fede il git log). Questa roadmap copre SOLO i delta del pivot deciso il
12 luglio 2026 (vedi `docs/PROGETTAZIONE.md` §1-3 e §5.6).

Obiettivo: **tutto fatto per il prossimo ricevimento** — si porta il
progetto completo riorientato, le correzioni si fanno dopo sul feedback.

Regole invariate dalla v1: un task = una sessione di Claude Code aperta in
`F1AnalyticsVisual`; il task è finito solo con tutte le voci spuntate;
diff letto prima di ogni commit; mai accettare "dovrebbe funzionare".

Persone: **A** = dati/pipeline · **B** = viste principali · **C** = viste
secondarie, testi e storie.

---

## Avanzamento generale

- [ ] Fase P0 — Allineamento sul pivot
- [x] Fase P1 — Spike di de-risking ⚠ MILESTONE
- [ ] Fase P2 — Pipeline delta
- [ ] Fase P3 — Viste delta
- [ ] Fase P4 — Consolidamento per ricevimento ed esame

---

# Fase P0 — Allineamento (giorno 1)

## P0.1 — Tutti · Lettura della specifica v2

- [ ] A ha letto PROGETTAZIONE.md v2 (almeno §1-3, §5.6, tabella in §7)
- [ ] B ha letto le stesse sezioni
- [ ] C ha letto le stesse sezioni
- [ ] Confermati i ruoli A/B/C (o ridistribuiti)

Nessun prompt: si fa con gli occhi. Le decisioni del pivot (§3) non si
ridiscutono nei prompt.

---

# Fase P1 — Spike di de-risking (2-3 giorni) ⚠ LA FASE PIÙ IMPORTANTE

Come la Fase 1 della v1: se lo spike fallisce, si aggiusta il modello
PRIMA di industrializzare. Regola di famiglia: se i numeri non tornano,
STOP.

## P1.1 — A · Snapshot della decisione su una gara campione

Dipende da: P0.1

- [x] Prompt eseguito in una nuova sessione di Claude Code
- [x] La tabella pilota/snapshot/opzioni/scelta/esito è stata stampata
- [x] Sanity check rientro previsto: per chi ha boxato sotto SC, la
      posizione prevista è entro 1-2 posizioni da `posAfter` reale nella
      maggioranza dei casi (se no: STOP e capire perché) — dopo la
      correzione che proietta anche i rivali che boxano nella stessa
      finestra (non solo il pilota in esame), errore mediano 1.0
      posizione su 37 confronti nelle 3 gare-caso
- [x] I 6 LOCKED_OUT di Jeddah risultano "scelta forzata" con motivazione
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.6 (modello della decisione) e §3 (regole
del pivot: la pipeline esistente non si tocca, si costruisce sopra i JSON
già esportati). Scrivi data-layer/scripts/spike_decision_snapshot.py che,
per la gara 2024-jeddah (file public/data/races/2024-jeddah.json), per
ogni pilota e per la neutralizzazione SC dei giri 7-9 calcola:

1. lo snapshot al giro del deploy: posizione, gap avanti/dietro (dai
   tempi cumulati ms), età e mescola gomme (dagli outcomes), giri
   mancanti, soste già fatte;
2. l'opzione BOX: costo atteso (mediana degli effectiveLoss affidabili
   dei pit UNDER_SC di quell'evento; fallback: 15.5s, mediana campione)
   e posizione di rientro prevista (tempo cumulato + costo atteso,
   contando le auto che restano davanti);
3. la scelta reale (ha boxato nella finestra / no / era LOCKED_OUT =
   forzata) e l'esito (posDelta a 5 giri, già nei dati);
4. il confronto: per chi ha boxato, rientro previsto vs posAfter reale.

Stampa una tabella leggibile e in fondo un riepilogo dell'errore di
previsione (mediana e casi peggiori). Non modificare la pipeline né i
JSON: solo lettura. Riporta la tabella e dimmi esplicitamente se il
rientro previsto funziona o no; non nascondere risultati strani.
```

## P1.2 — B · Prototipo brutto della mappa "quando conviene" ⚠ MILESTONE

Dipende da: P1.1 (per il formato dello snapshot)

- [x] Prompt eseguito in una nuova sessione di Claude Code
- [x] Lo scatter esiste con almeno 2 coppie di assi provate (7:
      margine-dietro×età-gomme, età-gomme×fase-gara, soste-fatte×
      età-gomme, margine-dietro×soste-fatte, margine-dietro×
      sorpassabilità, traffico×età-gomme, traffico×margine-dietro —
      `data-layer/data/spike_plots/`)
- [x] Su almeno una coppia di assi si vede una separazione tra decisioni
      che hanno pagato e no (anche imperfetta) — **riletta come: nessuna
      coppia mostra un confine visivo, ma l'indice combinato mostra una
      separazione di TENDENZA statisticamente reale (r=0,34-0,36,
      stabile su split del campione) — "dice qualcosa", non un confine.
      Accettata come soddisfatta in questa forma, v. DECISIONE sotto**
- [x] Scelta e verbalizzata la coppia di assi definitiva (aggiornare
      §5.6 se diversa da margine-dietro × età gomme) — **fatto: indice
      combinato (0,6 traffico + 0,4 margine dietro) su istogrammi
      sovrapposti, NON scatter a 2 assi puri. §5.6 aggiornato**
- [x] **MILESTONE: comunicato ad A e C che P2/P3 possono partire** — **sì, con la vista ridefinita (v. DECISIONE)**
- [ ] Diff letto, commit e push

**⚠ STOP scattato e risolto (regola di famiglia, Fase P1: "se i numeri
non tornano, STOP") — cronologia sotto, la DECISIONE finale è più giù.**
Prima esecuzione: `tyre_age` valorizzato solo sul 12% degli snapshot
(arricchito da `attach_tyre_info` solo per le 3 gare-caso — limite di
pipeline scoperto qui, non di questo spike). Risolto estendendo
l'arricchimento a tutte le gare con neutralizzazioni e rilanciando
`data-layer/scripts/build_all.py` (cambio additivo, verificato con diff
JSON: tocca solo `tyreAge`/`tyreCompound`/`compound`, nessun impatto su
costo/sconto/etichetta §5.1-5.4). Copertura ora 93% (604/646 snapshot).

Con la copertura piena, però, **nessuna delle 7 coppie di assi mostra
separazione visibile** tra BOX-guadagnato e BOX-perso. Coerente con
un'altra verifica già fatta su questi dati (`import_stints_all.py`):
l'età gomme del rivale non prediceva i giri di riscavalco (correlazione
~0 su 263 coppie). Qui il segnale manca anche nella direzione opposta
(la mia età gomme + il mio margine predicono se il MIO box paga).

**Aggiunte sorpassabilità e traffico (round 2, su richiesta).**
Sorpassabilità circuito (nuova, calcolata nello spike: media dei cambi
di posizione tra giri verdi consecutivi per circuito, media 2023+2024):
correlazione con l'esito ≈ -0,10, nessun segnale, come età gomme.
Traffico (quota del gruppo che si ferma nella stessa finestra, già
derivabile dai pit): correlazione **0,28** con l'esito a 5 giri tra chi
ha boxato — il più forte tra le 4 variabili testate (margine dietro
0,18; età gomme ed sorpassabilità ≈0). Conferma quantitativamente
l'intuizione dello spike Jeddah (P1.1): quando tanti si fermano insieme,
si "salvano" a vicenda. Ma anche nella coppia migliore provata (traffico
× margine dietro, punteggio di separazione 0,230, il più alto delle 7)
la nuvola resta troppo rumorosa per un confine visibile — un segnale
reale ma statistico, non ancora un asse "che si vede a occhio".

**Indice combinato provato (round 3).** 0,6 × z(traffico) + 0,4 ×
z(margine dietro), pesi dichiarati a mano (non ottimizzati sui dati,
n=133 è troppo poco per fidarsi di un fit). Correlazione con l'esito:
0,34-0,36, stabile su due metà casuali del campione (0,37 e 0,35) — non
è rumore. Le medie di chi guadagna (0,95) e chi perde (0,45) sull'indice
sono chiaramente diverse, ma le due distribuzioni si sovrappongono
pesantemente (`data-layer/data/spike_plots/h2_indice_combinato_distribuzione.png`):
è uno spostamento di tendenza statisticamente reale, non un confine
visivo netto.

**DECISIONE (presa, non più aperta).** Verificato anche contro la
letteratura esterna (deep learning/RL su questo stesso problema: nessuno
lo risolve con 2 variabili e uno scatter, serve molto più dei nostri
dati — conferma che il segnale debole non è un errore nostro, è la
natura del problema, v. `docs/PROGETTAZIONE.md` §5.6). Si procede così:

1. **Niente scatter con pretesa di confine netto.** La mappa "quando
   conviene" (P3.1) diventa un confronto di distribuzioni: istogrammi/
   densità sovrapposti dell'**indice combinato** (0,6 × z-score(traffico)
   + 0,4 × z-score(margine dietro), pesi dichiarati) per guadagnato vs
   perso.
2. Le 3 gare-caso e la scheda decisione **non cambiano**: lo snapshot
   per-evento di P1.1 resta preciso (errore mediano 1 posizione) e non
   dipende da questo problema — quello è il decisore vero, per caso
   singolo. L'indice combinato è un'euristica aggregata dichiarata nella
   scheda decisione ("vantaggio statistico stimato"), non una previsione.
3. P2.1 esporta anche `combinedIndex` (formula sopra) per ogni snapshot,
   non gli assi mai confermati.

P2/P3 partono su questa base (v. prompt aggiornati sotto e in P2.1/P3.1).

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.6. Estendi lo spike del task P1.1
(data-layer/scripts/spike_decision_snapshot.py, o un nuovo script che ne
riusa le funzioni) per calcolare gli snapshot di TUTTE le neutralizzazioni
di tutte le 46 gare (leggendo public/data/races/*.json), escludendo i
NOT_NEEDED. Poi genera 2-3 scatter statici di prova (matplotlib va bene,
è solo per noi, salvali in data-layer/data/spike_plots/): assi candidati
(a) margine sul gruppo dietro × età gomme, (b) età gomme × fase di gara,
(c) altre combinazioni sensate; forma = ha boxato / no, colore = esito a
5 giri (guadagnato/perso/pari). Obiettivo: capire su quali assi la
separazione si VEDE. Riporta quanti snapshot risultano, la distribuzione
scelta × esito, e la tua valutazione onesta di quale coppia di assi
funziona meglio (o se nessuna funziona: dillo, è la cosa più importante
da sapere adesso).
```

---

# Fase P2 — Pipeline delta (A, in parallelo a P3 dopo la milestone)

## P2.1 — A · Modulo decision_snapshots nella pipeline

Dipende da: P1.2 (milestone)

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] `races/*.json` contengono il blocco `decisions` per ogni evento
- [ ] `aggregate.json` (o `decisions.json`) contiene tutti gli snapshot
- [ ] `params.json` aggiornato con le nuove soglie/costanti
- [ ] Nessun file di gara oltre ~500 KB
- [ ] I valori di Jeddah coincidono con lo spike P1.1
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.6 e §6, e gli spike validati in
data-layer/scripts/spike_decision_snapshot.py (snapshot per evento) e
spike_decision_map.py (traffico, sorpassabilità, indice combinato —
DECISIONE presa in §5.6: niente scatter a 2 assi, la mappa usa l'indice
combinato). Industrializza: crea
data-layer/app/metrics/decision_snapshots.py con le funzioni dello spike
(testate con dati sintetici piccoli, come effective_pit_loss) e integralo
in build_all.py SENZA modificare i calcoli esistenti. Per ogni pilota ×
neutralizzazione esporta nel JSON di gara un record decision:
{eventId, driverId, snapshot: {pos, gapAhead, gapBehind, tyreAge,
compound, lapsRemaining, stopsDone, stopsTypical, trafficFraction},
boxOption: {expectedLoss, predictedRejoinPos, freshTyreDeltaPerLap},
choice: BOX|STAY|FORCED, outcome: {posDelta5, verdict:
GAINED|LOST|NEUTRAL}, combinedIndex: number|null, notNeeded: bool}.
Definizioni operative (mettile in params.json, non hardcoded): choice =
BOX se il pilota ha un pit con context UNDER_SC o UNDER_VSC in
quell'evento; un pit JUST_AFTER conta come STAY (ha scelto di
aspettare); FORCED se l'esito v1 era LOCKED_OUT. verdict: GAINED se
posDelta5 >= +1, LOST se <= -1, NEUTRAL se 0 o non calcolabile.
trafficFraction = quota dei piloti coinvolti nell'evento che hanno
boxato in quella finestra (v. spike_decision_map.py, funzione
compute_event_snapshots). combinedIndex = 0,6 × z-score(trafficFraction)
+ 0,4 × z-score(gapBehind), calcolato sulla popolazione di TUTTI gli
snapshot non-NOT_NEEDED (stessa formula/pesi dello spike, dichiarali in
params.json come COMBINED_INDEX_WEIGHTS), null se manca uno dei due
input. freshTyreDeltaPerLap = stima semplice del vantaggio in s/giro
delle gomme fresche dai giri verdi della stessa gara (regressione grezza
tempo vs età gomma, null se il campione è troppo piccolo — dichiarane la
soglia in params.json). In aggregate.json aggiungi la lista completa
degli snapshot (campi minimi per la mappa della home, incluso
combinedIndex). Aggiungi i parametri di contesto circuito in index.json
o in un nuovo circuits.json: prezzo di listino della pista,
sorpassabilità (media cambi posizione in giri verdi per circuito, v.
spike_decision_map.py funzione race_overtakability — nota: nello spike
non ha mostrato segnale utile per l'indice, resta comunque utile come
filtro/contesto dichiarato), caoticità (n. neutralizzazioni per pista
nel campione). Tutte le nuove costanti in params.json. Riesegui la
pipeline su tutte le 46 gare e riporta: dimensioni file, n. snapshot
totali, e verifica che i valori di Jeddah coincidano con lo spike E che
la correlazione combinedIndex/posDelta5 sui BOX guadagnato/perso sia
vicina a quella dello spike (0,34-0,36) — se si scosta molto, capire
perché prima di andare avanti.
```

## P2.2 — A · Verifica dell'aggregato (non solo il report)

Dipende da: P2.1

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Distribuzione scelta × esito stampata e plausibile
- [ ] Nessun snapshot con valori assurdi (gap negativi enormi, età gomme
      impossibili, rientri previsti fuori griglia)
- [ ] I casi anomali trovati sono spiegati o esclusi con flag dichiarato
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Lezione imparata nella v1 (ROADMAP v1, esito task 2.1): mai fidarsi del
report a schermo, controllare l'aggregato. Scrivi ed esegui
data-layer/scripts/validate_decisions.py che legge gli snapshot esportati
al task P2.1 e stampa: distribuzione scelta × esito; istogrammi grezzi
(testuali va bene) di gapBehind, tyreAge, predictedRejoinPos; i 10 casi
più estremi per ciascun campo con gara e pilota, da giudicare a mano;
conteggio dei record con campi mancanti e perché. Se trovi valori
impossibili, investiga la causa e proponi la correzione (escludere con
flag dichiarato, come fatto per lowConfidence, non correggere in
silenzio). Riporta tutto, anche quello che non torna.
```

---

# Fase P3 — Viste delta (B e C, dopo la milestone P1.2)

## P3.1 — B · Home: la mappa del "quando conviene"

Dipende da: P2.1

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok, mappa visibile su dati veri
- [ ] Due distribuzioni sovrapposte (guadagnato/perso) su combinedIndex,
      NON uno scatter a 2 assi (decisione presa, v. §5.6)
- [ ] Le medie delle due distribuzioni sono marcate ed etichettate; il
      testo dichiara onestamente che si sovrappongono (niente confine
      finto)
- [ ] Filtri/small multiples per almeno un parametro di contesto
      (sorpassabilità della pista)
- [ ] Il beeswarm v1 resta come sezione di supporto sotto la mappa
- [ ] Click/hover su un punto porta alla gara, tooltip = scheda decisione breve
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.6 (in particolare la DECISIONE presa dopo
lo spike P1.2: niente scatter a 2 assi, il segnale è reale ma debole
— traffico+margine combinati, r=0,34-0,36, distribuzioni che si
sovrappongono) e §7 (tabella pivot, vista 6), e la convenzione D3 in
src/components/charts/D3Chart.tsx (D3 possiede l'SVG, React solo
contenitore). Riscrivi la parte alta della home (src/app/page.tsx): il
grafico principale diventa la "mappa del quando conviene", alimentata
dagli snapshot in aggregate.json (campo combinedIndex, task P2.1):
istogrammi o densità (KDE semplice va bene) SOVRAPPOSTI di
combinedIndex, una serie per chi ha guadagnato posizioni e una per chi
ne ha perse (solo scelta BOX, NOT_NEEDED esclusi), palette colorblind-
safe da src/lib/colors.ts. Marca le medie delle due distribuzioni con
una linea verticale ed etichetta il numero. Testo esplicito sotto il
grafico che dichiara cosa si vede: un vantaggio statistico reale ma
modesto (le due popolazioni si sovrappongono), non una regola netta —
è la tesi del progetto (il muretto scommette, non prevede con
certezza), non un limite da nascondere. Aggiungi un filtro/toggle per
piste sorpassabili vs no (dai parametri circuito) che ridisegna le due
distribuzioni sul sottoinsieme filtrato. Hover: mini scheda decisione
(pilota, gara, gap, gomme, scelta, esito) se si passa sopra un bin/punto
con dettaglio; click porta alla pagina gara di un caso rappresentativo.
Il beeswarm attuale NON si elimina: scende sotto, con titolo tipo
"quanto costa fermarsi: il prezzo dell'opzione BOX". Aggiorna claim e
testi hero al nuovo frame problema→soluzione (§1), inclusa la frase che
descrive la mappa (non chiamarla "previsione", chiamarla "tendenza
statistica"). Build e verifica.
```

## P3.2 — C · Slope chart a tre colonne (il momento della scelta)

Dipende da: P2.1

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok, provato su Jeddah 2024
- [ ] Colonna centrale = rientro previsto, visivamente distinta (es.
      tratteggiata) e spiegata in un sottotitolo
- [ ] La distanza previsione/realtà si legge a colpo d'occhio
- [ ] Hover coordinato invariato
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.6 e §7 (tabella pivot, vista 3). Estendi
src/app/race/[id]/EventSlopeChart.tsx da 2 a 3 colonne usando il blocco
decisions del JSON di gara: sinistra = posizioni al giro del deploy;
centro = posizione di rientro PREVISTA per chi ha boxato (chi non ha
boxato mantiene la posizione, linea dritta); destra = posizioni reali
dopo (come oggi). Il segmento previsione→realtà è il racconto: rendilo
leggibile (es. segmento sinistra→centro tratteggiato "previsto", centro→
destra pieno "successo davvero"). Colori coerenti con la palette esiti.
Sottotitolo breve che spiega la colonna centrale in italiano. Mantieni
selettore evento e hover coordinato. Tutto D3 dentro useEffect. Build e
prova su 2024-jeddah (14 box, 6 forzati: il caso più leggibile).
```

## P3.3 — C · Matrice scelta × esito + scheda decisione

Dipende da: P2.1 · in parallelo a P3.2

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok
- [ ] Celle rietichettate (scelta × esito, FORCED distinto)
- [ ] Tooltip = scheda decisione completa (§5.6)
- [ ] Le categorie v1 restano disponibili (toggle o testo nel tooltip)
      per il capitolo disuguaglianza
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.6 (inclusa la DECISIONE sull'indice
combinato dopo lo spike P1.2) e §7 (tabella pivot, vista 4).
Aggiorna src/app/race/[id]/OpportunityWindow.tsx: le celle si colorano
per scelta × esito dal blocco decisions (BOX-guadagnato, BOX-perso,
STAY-guadagnato, STAY-perso, FORCED, NOT_NEEDED attenuato), palette in
src/lib/colors.ts coerente con la mappa della home. Il tooltip diventa
la scheda decisione: cosa vedeva il muretto (gap, gomme, soste fatte),
le due opzioni quantificate (costo BOX e rientro previsto — QUESTO è
preciso, errore mediano 1 posizione, v. spike P1.1), scelta ed esito, in
italiano discorsivo (es. "aveva 19s di margine e gomme di 22 giri: si è
fermato, previsto P6, rientrato P7, dopo 5 giri P5"). Aggiungi il campo
combinedIndex come riga separata e chiaramente distinta dal rientro
previsto, es. "vantaggio statistico stimato: sopra/sotto la media di chi
di solito guadagna" (mai la parola "previsione" per questo campo — è
un'euristica aggregata, non uno snapshot preciso come il rientro
previsto). La vecchia lettura v1 (EXPLOITED/LOCKED_OUT...) resta
raggiungibile: o un toggle "vista opportunità" o una riga nel tooltip.
Hover coordinato invariato. Build e prova su una gara con più eventi
(2023-albert_park).
```

## P3.4 — C · Storie e testi riorientati

Dipende da: P3.1, P3.2, P3.3

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok
- [ ] Le storie delle 3 gare-caso parlano di decisioni (chi doveva
      fermarsi, chi ha sbagliato), con numeri verificati sui dati
- [ ] La vista 5 ha il sottotitolo "esperimento naturale" e i testi
      parlano di scelte del muretto
- [ ] Nessun testo del sito dice più che la tesi è "la lotteria":
      la disuguaglianza è presentata come "quando la scelta non ce l'hai"
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §1-3 (nuovo frame), §5.6 e §9 (gare-caso).
Passa in rassegna tutti i testi del sito (home, pagine gara, StoryPanel,
public/data/stories.json, TeammateMirror) e riorientali al frame
problema→soluzione: il sito risponde a "quando conviene fermarsi?" e
"il pilota X doveva fermarsi?". Riscrivi le annotazioni delle 3 gare-caso
come storie di decisione usando i dati veri del blocco decisions
(verifica ogni numero prima di scriverlo, non inventare): Bahrain 2023 =
un solo momento, sei muretti, sei scelte; Jeddah 2024 = 14 potevano e 6
no; Australia 2023 = la decisione doppia del double stack. La vista
"stesso box, fortuna diversa" va presentata come esperimento naturale
(stessa macchina, stesso muretto, scelte opposte). La parola "lotteria"
può restare solo nel capitolo "quando la scelta non ce l'hai". Build e
rilettura completa dei testi.
```

## P3.5 — B · Passata di qualità sulle viste nuove

Dipende da: P3.1, P3.2, P3.3, P3.4

La v1 ha già passato il task 5.2 (qualità visiva e accessibilità), ma
mappa, slope a 3 colonne, matrice rietichettata e scheda decisione sono
nate DOPO quella passata: va ripetuta solo sui delta.

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] L'elenco dei problemi trovati esiste (se è vuoto, insospettirsi)
- [ ] Tutti i colori nuovi vengono da colors.ts, palette scelta/esito
      verificata per protanopia/deuteranopia e coerente tra home e matrice
- [ ] Forma BOX/STAY distinguibile anche in bianco e nero
- [ ] Leggibile a 1280px, dignitoso a 768px; hover senza scatti
- [ ] Build ok, diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §7 (regole su colore e D3). Fai una passata
di qualità SOLO sulle viste toccate dal pivot: la mappa del quando
conviene (home), lo slope a 3 colonne, la matrice scelta × esito e la
scheda decisione nei tooltip. Verifica: (1) tutti i colori da
src/lib/colors.ts, la palette esiti identica tra home e matrice, nessuna
vista dove il colore significa due cose; (2) palette simulata per
protanopia/deuteranopia; (3) la codifica forma BOX/STAY deve reggere
anche senza colore; (4) etichette dirette dove possibile, font >= 11px,
numeri a 1 decimale, tooltip con lo stesso componente delle altre viste;
(5) leggibilità a 1280px e degradazione dignitosa a 768px; (6) hover
senza jank. Elenca prima i problemi trovati, poi applica le correzioni,
poi build.
```

---

# Fase P4 — Consolidamento per ricevimento ed esame

## P4.1 — B · Metodologia aggiornata

Dipende da: P2.1, P2.2

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] Build ok
- [ ] Il modello della decisione è spiegato per un lettore non tecnico
- [ ] Soglie e costanti lette da params.json, non scritte a mano
- [ ] Nuovi limiti dichiarati (rientro previsto = stima; indice
      combinato = tendenza statistica non predizione, con la
      correlazione misurata dichiarata; caoticità su 2 stagioni;
      NOT_NEEDED esclusi dalla mappa; casi bagnato)
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §5.6 (inclusa la DECISIONE su indice
combinato e mappa a distribuzioni) e la pagina attuale
src/app/methodology/page.tsx. Aggiungi/aggiorna: (1) come ricostruiamo
lo snapshot della decisione e le due opzioni (a parole, con un piccolo
diagramma SVG statico del rientro previsto); (2) come definiamo "scelta
giusta" (esito a 5 giri + confronto col gemello) e perché NON facciamo
simulazioni controfattuali; (3) l'indice combinato della mappa "quando
conviene": formula (0,6 × traffico + 0,4 × margine dietro, z-score),
perché questi pesi (proporzionali alla correlazione individuale
misurata) e perché è dichiarato come tendenza statistica (correlazione
0,34-0,36 con l'esito) e non come previsione — spiega anche perché non
uno scatter con 2 assi puri (nessuna coppia mostrava un confine visibile
nello spike P1.2, v. §5.6); (4) i nuovi parametri di contesto
(sorpassabilità, caoticità) con le loro formule, notando che la
sorpassabilità circuito NON è entrata nell'indice (nessun segnale
trovato) e resta solo un filtro di contesto; (5) i nuovi limiti: rientro
previsto = stima con errore misurato (cita l'errore mediano dallo spike
P1.1), indice combinato = tendenza non certezza (cita la correlazione),
caoticità stimata su sole 2 stagioni, NOT_NEEDED esclusi dalla mappa,
gare bagnate non trattate a parte. Tutte le soglie da params.json. I
limiti v1 già dichiarati restano. Build.
```

## P4.2 — A · Numeri v2 per relazione e ricevimento

Dipende da: P2.2, P3.4

- [ ] Prompt eseguito in una nuova sessione di Claude Code
- [ ] `docs/NUMERI.md` aggiornato con la sezione v2
- [ ] Ogni numero indica file e regola di provenienza
- [ ] I numeri coincidono con quelli citati nelle storie (P3.4)
- [ ] Diff letto, commit e push

**Prompt da copiare:**

```
Leggi docs/PROGETTAZIONE.md §2 e §5.6, e docs/NUMERI.md attuale. Estendi
data-layer/scripts/report_numbers.py con la sezione "v2 — la decisione":
quante decisioni nel campione (e quante escluse come NOT_NEEDED o
FORCED); in che percentuale BOX ha guadagnato posizioni, complessivamente
e nelle condizioni della mappa (es. sopra/sotto la soglia di margine);
lo stesso per STAY; errore mediano del rientro previsto; il caso più
clamoroso di scelta sbagliata e quello di scelta perfetta (gara, pilota,
numeri); i 2-3 numeri per ciascuna gara-caso nella lettura decisionale.
Per ogni numero: file e regola di calcolo, così è difendibile all'esame.
Esegui e aggiorna docs/NUMERI.md.
```

## P4.3 — Tutti · Prova generale per il ricevimento (a voce, senza prompt)

- [ ] La demo regge: home (mappa) → gara-caso (scheda decisione, slope a
      3 colonne) → "quando la scelta non ce l'hai" → metodologia
- [ ] Tutti sanno dire in 2 minuti problema → soluzione (§1)
- [ ] Tutti sanno rispondere a: "come definite 'scelta giusta'?"
- [ ] Tutti sanno rispondere a: "perché niente modello predittivo?"
- [ ] Tutti sanno rispondere a: "perché non uno scatter con 2 assi?" (lo
      spike P1.2 non ha trovato nessuna coppia con un confine visibile;
      l'indice combinato traffico+margine ha un segnale reale ma debole,
      r=0,34-0,36 — dichiarare la tendenza è più onesto che inventare un
      confine che i dati non hanno; verificato anche in letteratura che
      il problema, in generale, richiede modelli molto più pesanti di 2
      variabili, v. §5.6)
- [ ] Restano pronte le risposte v1: "dov'è D3?", "perché multiple line
      chart?", "perché niente grafi?" (PROGETTAZIONE §8)
- [ ] Preparata la frase per il prof: "abbiamo iterato il design sul suo
      feedback" — è il processo di design iterativo del corso

---

# Riepilogo dipendenze

```
P0.1 → P1.1 → P1.2 ══ MILESTONE ══→ P2.1 → P2.2
P2.1 → P3.1 (B) · P3.2, P3.3 (C) → P3.4 → P3.5 (B)
P2.2 + P3.5 → P4.1, P4.2 → P4.3
```

Stima: P0+P1 in 2-3 giorni, P2 e P3 in parallelo in 1-2 settimane,
P4 in 2-3 giorni. Con 3 settimane si arriva al ricevimento comodi.

Fuori roadmap ma da non dimenticare: la **relazione scritta** — i numeri
li produce P4.2, ma il testo della relazione va scritto a parte (la
traduzione nel lessico del corso è già pronta in PROGETTAZIONE §8).
