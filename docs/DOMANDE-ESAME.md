# Domande d'esame — risposte pronte (frame v3, task E4.3)

Aggiornato al pivot v3 ("È già successo?", `docs/PROGETTAZIONE.md`).
Risposte a voce alle domande più prevedibili, verificate contro
`docs/PROGETTAZIONE.md` e `docs/NUMERI.md`. Da usare per allenarsi, non
da leggere parola per parola all'esame. Le risposte sul layer v2
(neutralizzazioni) restano in fondo: quella pipeline non si è toccata,
è diventata una famiglia del catalogo (vista 7).

## "Che problema risolve?"

Durante e subito dopo una gara succede qualcosa che *sembra*
straordinario — una vittoria dal fondo della griglia, una volata decisa
per pochi millesimi. Chi deve raccontarla (giornalista sotto scadenza,
commentatore) ha bisogno in pochi minuti di sapere se è davvero raro,
quante volte è successo prima, dove e quando. Oggi quell'informazione
esiste ma è inutilizzabile: Wikipedia e i siti di statistiche danno
albi d'oro già confezionati, non permettono di *comporre* la condizione
che serve adesso ("vittoria partendo oltre la decima piazza"), non
normalizzano per quante gare ha ospitato ogni circuito, e non dicono mai
su quale finestra temporale la risposta è valida. Il nostro strumento
risponde **quante volte, dove, quando**, con la rarità calcolata e la
finestra di validità dichiarata — in secondi, non in minuti passati a
incrociare fonti che non si parlano tra loro.

## "Perché descrittivo e non predittivo?"

Lo strumento non è, e non vuole essere, un modello: è un motore
d'interrogazione su dati storici. Anche il generatore automatico di
fatti notevoli (il punteggio di notevolezza, §5.4) è dichiarato
esplicitamente come **una regola di ordinamento trasparente e
ispezionabile**, non un modello — i tre pesi (0,4 rarità, 0,3 siccità,
0,3 peso editoriale) sono scelti a mano e scritti in chiaro in
`params.json`, non ottimizzati su un campione. Andare oltre (spiegare
*perché* un evento accade, o prevedere il prossimo) richiederebbe
ipotesi causali che i dati (risultati, non telemetria) non permettono
di verificare in modo difendibile — è la stessa lezione già imparata
nel layer v2 (vedi il risultato negativo dello spike sulla decisione,
in fondo).

## "Come fate a dire che è raro?"

    rarità = occorrenze / unità osservabili nella finestra di copertura

Ogni evento del catalogo è un predicato valutato su tutte le unità
osservabili (gara, risultato pilota×gara, o coppia team×gara) della sua
finestra. Non è un giudizio soggettivo: è un conteggio su tutti i dati
disponibili, con il denominatore dichiarato insieme al numero — mai un
numero "nudo".

## "Perché le finestre sono diverse?"

Perché i dati stessi sono diversi: `results`/`races`/`status` coprono
1950-2024 (1114 gare, esclusa l'Indianapolis 500 storica), ma
`qualifying` dettagliata esiste solo dal 1994, `lap_times` dal 1996,
il giro veloce in `results.rank` dal 2004, `pit_stops` dal 2011, i dati
di Safety Car/Virtual Safety Car (OpenF1) solo per 2023-2024. La
finestra non è una scelta editoriale, è imposta dai dati. Regola
vincolante del progetto: **ogni numero mostrato porta con sé la sua
finestra**, sempre visibile — un evento valido su 46 gare e uno valido
su 1114 non si confrontano, e l'interfaccia lo rende visivamente
evidente (vista 1, la scala della rarità) invece di lasciarlo scritto
in piccolo.

## "Cosa NON può dire il vostro strumento?"

Cinque cose, dichiarate apertamente invece che nascoste:

1. Non fa previsioni né spiega le cause di un evento — è descrittivo,
   non predittivo (vedi sopra).
2. Non confronta piloti di ere diverse in termini di "chi era più
   forte": i punti sono cambiati sistema più volte (trappola 5, §5.6),
   un confronto diretto sarebbe scorretto senza normalizzazione.
3. Non ricostruisce eventi assenti dai dati: bandiere rosse prima del
   2023, penalità, meteo — non ci sono nei CSV Ergast né in OpenF1 prima
   di quella finestra.
4. Non sa dirti "perché" oltre alla correlazione con le trappole note:
   es. per "vittoria conquistata all'ultimo giro" il motore trova 12
   occorrenze 1996-2024 contro le 6 curate a mano nel documento di
   lavoro — un residuo non risolto, riportato in
   `docs/CATALOGO-EVENTI.md` §13 invece che nascosto.
5. Eredità v2: non simula la gara controfattuale ("cosa sarebbe successo
   se avesse scelto STAY invece di BOX") — richiederebbe modellare
   sorpassi e gap reali in pista, cosa che tempi-per-giro (non
   telemetria) non permettono di ricostruire in modo difendibile.

## "Dov'è D3?"

Tutti gli assi, le scale, il data join, le transizioni e il brush sono
in D3 dentro un `useEffect`; React fa solo da contenitore, routing e
gestione dello stato — vale per le sette viste (scala della rarità,
compositore, quando/dove, griglia×arrivo, scheda gara, capitolo
neutralizzazioni) allo stesso modo.

## "Perché non uno scatter con 2 assi?" (eredità v2)

Domanda specifica sulla mappa "quando conviene fermarsi" del layer v2,
non sul motore di eventi v3 (che non ha un problema di questo tipo: la
sua unica codifica quantitativa in posizione è la rarità stessa). Lo
spike P1.2 ha provato 7 coppie di variabili (margine dietro, età gomme,
fase di gara, soste fatte, sorpassabilità, traffico...): nessuna mostra
un confine visibile tra chi guadagna e chi perde. L'indice combinato
(0,6×traffico + 0,4×margine dietro, pesi proporzionali alla correlazione
individuale misurata) ha un segnale reale ma debole (correlazione
0,34-0,36 con l'esito, stabile su due metà casuali del campione) —
dichiarare la tendenza è più onesto che disegnare un confine che i dati
non hanno.

## Frase per il prof

"Il problema è che verificare se un fatto è raro richiede minuti e
fonti che non si incrociano; noi lo facciamo in secondi e diciamo
sempre su quali dati vale." Se chiede del pivot: la v1/v2 (Chaos
Discount, "Box, box?") avevano un'idea valida ma non rispondevano a un
problema concreto secondo il suo stesso feedback — il pivot non butta
quel lavoro, lo reinquadra come una famiglia del catalogo tra le altre
(vista 7), con la sua finestra dichiarata.

## Numeri di scorta — v3 (motore di eventi)

Fonte: `docs/NUMERI.md` sezione 9.

- 33 eventi distinti in 9 famiglie, 67 combinazioni evento+parametri.
- Copertura: 1125 gare, 26.759 risultati, 75 stagioni (1950-2024).
- L'evento più raro: "un pilota ha fatto almeno 7 soste", 3 volte su
  5940 (0,051%), finestra 2011-2024.
- La siccità più lunga: "vittoria con margine oltre 5 minuti", ferma dal
  1958 (66 anni, 1050 gare).
- 1113 gare su 1125 hanno almeno un fatto notevole generato in
  automatico, mediana 6 fatti per gara.
- Le cinque trappole nei dati, coi numeri reali: 11 gare Indianapolis
  500 (1950-1960) escluse dalla finestra; 1025 "Did not qualify" mai
  contati come ritiro; 40,9% dei risultati con `position` vuoto (i non
  classificati) escluso dal denominatore, non contato come "non
  successo"; `grid = 0` normalizzato a partenza dalla pit lane, non
  posizione zero; punti non comparabili tra ere di regolamento diverse.

## Numeri di scorta — eredità v2 (neutralizzazioni, 46 gare 2023-2024)

Fonte: `docs/NUMERI.md` sezioni 1-8.

- 46 gare, 42 neutralizzazioni, 1737 pit stop, 767 decisioni pilota×evento
  (121 NOT_NEEDED, 290 FORZATE, 646 decisioni reali).
- Errore mediano del rientro previsto: 1,0 posizioni (n=303, tutte le 46
  gare).
- BOX guadagna il 28,9% delle volte in generale, 29,4% sopra la soglia
  di margine dell'indice combinato, 16,2% sotto.
