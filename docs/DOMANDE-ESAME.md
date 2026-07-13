# Domande d'esame — risposte pronte (task P4.3)

Preparato per la prova generale del ricevimento (`docs/ROADMAP-2.md`,
P4.3): risposte a voce alle domande più prevedibili, verificate contro
`docs/PROGETTAZIONE.md` e `docs/NUMERI.md`. Da usare per allenarsi, non
da leggere parola per parola all'esame.

## "Problema → soluzione" in 2 minuti (§1)

Quando entra la Safety Car, il muretto ha pochi secondi per decidere:
fermarsi costa molto meno del normale (15,5s mediani contro 22,5s in
verde) ma si rientra nel traffico; restare fuori conserva la posizione,
ma con gomme vecchie e la scommessa di pagare prezzo pieno più avanti.
Da fuori (TV, timing screen) si vede solo l'esito, mai le carte che il
muretto aveva in mano — persino i top team la sbagliano (Ferrari Monaco
2022, Mercedes Abu Dhabi 2021). Lo strumento ricostruisce ~800 di queste
decisioni reali (2023-2024), quantifica le due opzioni come le vedeva il
muretto, mostra com'è andata, e le aggrega in una mappa empirica di
quando conviene fermarsi.

## "Come definite 'scelta giusta'?"

Delta di posizioni 5 giri dopo la fine della neutralizzazione:
guadagnato se sale di almeno 1 posizione, perso se ne perde almeno 1.
Nei casi-storia rafforziamo il verdetto col "gemello" — il compagno di
squadra, stessa macchina stesso muretto, che ha scelto l'opposto nella
stessa finestra.

## "Perché niente modello predittivo?"

Fuori scopo per un corso di InfoViz e metodologicamente attaccabile con
un campione di ~800 casi. Servirebbe simulare sorpassi e gap reali in
pista, cosa che i nostri dati (tempi per giro, non telemetria) non
permettono di ricostruire in modo difendibile. Facciamo parlare le
scelte reali e i loro esiti — è il mestiere della visualizzazione delle
informazioni, non del machine learning.

## "Perché non uno scatter con 2 assi?"

Lo spike P1.2 ha provato 7 coppie di variabili (margine dietro, età
gomme, fase di gara, soste fatte, sorpassabilità, traffico...): nessuna
mostra un confine visibile tra chi guadagna e chi perde. L'indice
combinato (0,6×traffico + 0,4×margine dietro, pesi proporzionali alla
correlazione individuale misurata) ha un segnale reale ma debole
(correlazione 0,34-0,36 con l'esito, stabile su due metà casuali del
campione) — dichiarare la tendenza è più onesto che disegnare un
confine che i dati non hanno. Confermato anche in letteratura (verifica
di sanità, non fonte del metodo): chi risolve questo problema usa
modelli molto più pesanti di 2 variabili (deep learning su telemetria,
F1-score 0,81; reinforcement learning con memoria temporale).

## Risposte v1 (§8, restano valide)

- **"Dov'è D3?"** — Tutti gli assi, le scale, il data join, le
  transizioni e il brush sono in D3 dentro un `useEffect`; React fa solo
  da contenitore, routing e gestione dello stato.
- **"Perché multiple line chart e non small multiples/horizon graph?"**
  — Il task è confrontare i piloti NELLO STESSO istante (il momento
  della neutralizzazione): servono le linee sovrapposte nello stesso
  grafico. Le alternative separano le serie e distruggono proprio il
  confronto che serve.
- **"Perché niente grafi?"** — I dati sono temporali e multivariati, non
  relazionali/a grafo: la scelta discende dalla task abstraction, non da
  una preferenza stilistica.

## Frase per il prof

"Abbiamo iterato il design sul suo feedback" — è il processo di design
iterativo previsto dal corso: la v1 (Chaos Discount) descriveva un
fenomeno, il pivot lo trasforma in uno strumento di supporto alla
decisione, sulla stessa pipeline e sugli stessi dati validati.

## Numeri di scorta, se li chiedono

- 46 gare, 42 neutralizzazioni, 1737 pit stop, 767 decisioni pilota×evento
  (121 NOT_NEEDED, 290 FORZATE, 646 decisioni reali). Fonte: `docs/NUMERI.md`.
- Errore mediano del rientro previsto: 1,0 posizioni (n=303, tutte le 46
  gare). Fonte: `docs/NUMERI.md` sezione 8.
- BOX guadagna il 28,9% delle volte in generale, 29,4% sopra la soglia
  di margine dell'indice combinato, 16,2% sotto. Fonte: `docs/NUMERI.md`
  sezione 8.
