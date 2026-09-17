# Regole del progetto e numeri di controllo

Le convenzioni che valgono per ogni modifica al codice, e i numeri che
devono restare veri. Chi apre un task legge questo file prima di scrivere.

---

## Le regole che non si negoziano

Se una consegna ne viola una, si corregge: non si discute.

- **Ogni numero porta con sé la sua finestra di copertura**, visibile a
  schermo e non dentro un tooltip. I dati coprono finestre diverse (griglia
  dal 1950, qualifiche dal 1994, pit stop dal 2011, Safety Car solo
  2023–2024): un numero senza la sua finestra è una bugia.
- **Niente scatole nere.** Il progetto è descrittivo: nessun modello,
  nessun punteggio che esce da un posto non ispezionabile. I pesi stanno
  dichiarati in `public/data/params.json`, mai come costanti nel codice.
  Due versioni precedenti del progetto sono state bocciate per aver
  sconfinato qui.
- **Dato mancante ≠ dato negativo.** "Non lo so" e "no" sono due risposte
  diverse e vanno tenute distinte fino allo schermo.
- **Il colore codifica la famiglia dell'evento, mai la rarità** (la rarità
  va sulla posizione). Palette in `src/lib/colors.ts`, nessuna tinta nuova.
  Nelle viste v4 il colore codifica **lo slot che cambia**; il rosso è solo
  la risposta esatta.
- **D3 possiede l'SVG** (scale, assi, data join, transizioni dentro un
  `useEffect`), React fa da contenitore. I componenti solo HTML/CSS non
  violano la regola: non disegnano assi né scale.
- **Responsive dal primo colpo** (`ResizeObserver`, come
  `RarityScale.tsx`), mai una larghezza fissa scritta a mano.
- **Ogni schermata del flusso di ricerca deve mostrare qualcosa**, non una
  lista di risultati. È un progetto di Visualizzazione delle Informazioni:
  se una vista restituisce solo testo, è fuori tema.

## Come si verifica una consegna

Il rapporto di chi ha svolto il task dice quasi sempre "tutto a posto".
Spesso è vero. Quando non lo era, i casi trovati erano tutti gravi:

- un motore che contava **60 occorrenze per 30 gare** (raddoppiava i fatti);
- una rarità sbagliata di **settanta volte**, perché il denominatore non
  teneva conto del circuito richiesto;
- un dato mancante trattato come "non è successo" invece che come "non lo
  so", proprio sull'evento più richiesto del progetto (la rimonta).

Nessuno di questi si vedeva dal rapporto. Si sono visti **rieseguendo i
conti**. Quindi, per ogni consegna:

- si rilegge il codice nuovo per intero, non il riassunto;
- si rieseguono i controlli a mano, con `python3` sui file in
  `public/data/` o con `npx ts-node` su uno script temporaneo;
- ci si chiede sempre **cosa il controllo non copriva** — è lì che si
  nascondono gli errori. Un test che confronta i totali non vede un campo
  sbagliato dentro le righe;
- se un numero non torna si corregge **prima** del commit, e lo si scrive
  nel messaggio di commit e nella roadmap. Se un numero è sbagliato, il
  numero è sbagliato: non è "una piccola nota".

## I numeri di controllo (regressione)

Questi sono verificati. Se una modifica futura li cambia è un bug, non un
miglioramento — a meno che non ci sia una ragione scritta.

- indice: **17.208 occorrenze**, **67 su 67** combinazioni evento×parametro
  con occorrenze, denominatore e rarità identici a
  `public/data/events/index.json`;
- **2.711** occorrenze senza pilota noto, **10.249** senza team;
- `doppietta` + `nessun_cambio_di_leader` → **30 risultati su 30 gare
  distinte**;
- `vittoria_da_griglia` N=10 + circuito Monza → **2 su 1016**;
- `vittoria_da_griglia` N=10 da solo → **37 su 1114**, fonte
  "precalcolato";
- un chip *team* → denominatore **"non calcolabile"**, mai un numero
  inventato;
- indice colonnare per il client: **≤ 200 KB** grezzi.

Gli script che li bloccano: `scripts/verify-s22.ts` (motore v3),
`scripts/verify-situazioni.ts` e `scripts/verify-parser.ts` (motore v4).

## Roadmap e commit

`docs/ROADMAP-7.md` è l'ultima roadmap chiusa; le precedenti restano come
storia. Quando una fase si chiude:

- le caselle da spuntare si sostituiscono con **l'esito reale**, compreso
  quello che è saltato fuori strada facendo e che nessuno aveva previsto;
- le decisioni prese si scrivono in modo che **non vadano ridiscusse**;
- se resta un dubbio, va segnato come **punto aperto** con scritto in quale
  fase va sciolto — e si scioglie prima di iniziare la fase che ci inciampa.

Si lavora su `main`, senza rami. Messaggi di commit in italiano, prima riga
breve con la fase tra parentesi (es. `Aggiunge il motore di match e il menu
a macro-aree (roadmap S1.2, S2.1)`), poi il corpo che spiega **perché**, non
cosa: in particolare ogni bug corretto, con il numero sbagliato e quello
giusto.

## Dove sta la roba

- `docs/PROGETTAZIONE-v4.md` — la specifica del progetto attuale
- `docs/ROADMAP-7.md` — la roadmap della v4; `ROADMAP-6` e precedenti sono
  storiche
- `docs/PROGETTAZIONE.md` — le giustificazioni per l'esame (Munzner ecc.)
- `docs/CATALOGO-EVENTI.md`, `NUMERI.md`, `DOMANDE-ESAME.md` — materiale
  d'esame
- `src/lib/` — i motori; `src/components/charts/` — le viste D3
- `public/data/` — tutti i dati precalcolati (nessun backend a runtime)
- `data-layer/` e `scripts/` — la pipeline Python
