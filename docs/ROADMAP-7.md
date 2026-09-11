# Déjà vu — Roadmap D (la v4: dal catalogo ai dati)

Riferimento concettuale: `docs/PROGETTAZIONE-v4.md`. Mockup della pagina
risultato: `docs/mockup-dejavu.html` (numeri reali, calcolati a mano dai CSV
l'11 settembre 2026).

**Decisioni prese, non da rimettere in discussione a ogni prompt:**

- **La pipeline Python si tocca.** La regola "nessun dato nuovo" della roadmap
  S è la causa del fallimento della ricerca v3: si abroga. Le tabelle nuove
  stanno in `public/data/situazioni/`, colonnari, e la pipeline che le genera
  è `data-layer/scripts/build_situazioni.py`.
- **Il motore lavora nel browser** sulla tabella dei risultati (26.759 righe).
  Nessuna richiesta al server per tasto premuto. Tetto di peso compresso:
  150 KB, ridiscusso e portato a 200 KB in D1.1 (motivo scritto lì).
- **Ogni fase ha i numeri attesi scritti nel codice** di uno script di
  verifica (`scripts/verify-situazioni.ts`), calcolati a mano in Python prima
  di scrivere il TypeScript. Se un numero cambia, è un bug: ci si ferma.
- **Il colore codifica lo slot che cambia** (chi/dove/quando/cosa) in tutte le
  viste nuove; il rosso è solo la risposta esatta. Le palette v3 restano in
  /esplora.
- **D3 possiede l'SVG**, React fa contenitore e stato. La frase a slot è
  HTML/CSS (non disegna scale).
- **Un task = un prompt**, nell'ordine dato. Diff letto prima di ogni commit.
  Si lavora su `main`.
- **Niente si butta:** le viste v3 restano raggiungibili da /esplora; il
  capitolo neutralizzazioni resta sotto /race/[id].

---

## Avanzamento

- [x] D0 — Progettazione (questo documento, PROGETTAZIONE-v4, mockup)  ✅ FATTO (11 set 2026)
- [x] D1 — Le tabelle delle situazioni (pipeline Python)  ✅ FATTO (11 set 2026)
- [x] D2 — Il motore: fatti, slot, finestra, reticolo (TypeScript puro)  ✅ FATTO (11 set 2026)
- [x] D3 — La frase a slot e il parser di testo  ✅ FATTO (11 set 2026)
- [x] D4 — La linea dei déjà vu (D3)  ✅ FATTO (11 set 2026)
- [x] D5 — I ritratti (small multiples) e la mappa collegata  ✅ FATTO (11 set 2026)
- [x] D6 — La nuova home, il nome, la scheda gara riletta, /esplora  ✅ FATTO (11 set 2026)
- [x] D7 — Accessibilità, verifica finale, documenti d'esame  ✅ FATTO (11 set 2026)

Ordine dei prompt: D1.1 → D1.2 → D2.1 → D2.2 → D3.1 → D3.2 → D4.1 → D5.1 →
D5.2 → D6.1 → D7.1, poi le rifiniture su segnalazione di Luca (D7.2, D7.3).
**Roadmap chiusa l'11 settembre 2026.**

---

# Fase D1 — Le tabelle delle situazioni

## D1.1 — `risultati.json` e `gare.json`

`data-layer/scripts/build_situazioni.py` legge i CSV Ergast in `data/raw/`
e scrive `public/data/situazioni/risultati.json` e `gare.json`, colonnari.

Colonne di `risultati` (una riga per riga di `results.csv`, Indy 500 1950-60
marcate ma presenti): `raceId`, `driverId`, `constructorId`, `griglia`
(null se \N; 0 = pit lane, distinto), `arrivo` (null se non classificato),
`ordine`, `statoCat` (le 5 categorie v3), `statusId`, `giri`, `giroVeloceRank`,
`punti`, `msDalVincitore`, `posDopoGiro1`, `giriAlComando`, `primoGiroAlComando`,
`posPeggiore`, `posMigliore`, `soste`, `giroPrimaSosta`, `posQualifica`,
`arrivoCompagno`, `gpInCarriera`, `vittoriePrima`, `podiPrima`, `polePrima`,
`vittorieSuCircuitoPrima`. Colonne derivate dai tempi sul giro / soste /
qualifiche sono `null` fuori finestra, **mai 0**.

Colonne di `gare`: `raceId`, `anno`, `round`, `circuitRef`, `paese`, `indy`,
`partiti`, `classificati`, `ritiri`, `cambiDiLeader`, `leaderDiversi`,
`margineMs`, `doppietta`, `tripletta`, `vittoriaUltimoGiro`, `neutralizzazioni`
(2023-2024, null altrove).

Verifica obbligatoria (Python, stampata dallo script): vittorie da griglia
≥10 = **37 su 1114**; a Monza = **2 su 74**; Hamilton = 2 (2018 Hockenheim,
2021 Interlagos); risultati con griglia e arrivo noti = **15.518**.

- [x] Prompt eseguito (11 set 2026)
- [x] Peso grezzo e compresso dichiarato
- [x] Diff letto

**Esito D1.1 (11 set 2026).** `data-layer/scripts/build_situazioni.py` →
`public/data/situazioni/risultati.json` e `gare.json`. Verifica interna allo
script, tutta verde: 37 su 1114; Monza 2 (1971, 2020); Hamilton 2 (2018,
2021); 15.518 risultati con griglia e arrivo; 18 gare di Hamilton a Monza;
Gasly Monza 2020 al comando dal giro 28.

**Peso: 1.858 KB grezzi, 177 KB gzip** per `risultati.json` (+ 17 KB gzip per
`gare.json`). Sopra il tetto di 150 KB scritto in cima: decisione presa, non
rimandata. Misurato colonna per colonna: metà del peso iniziale (275 KB)
veniva da colonne **derivabili** dal resto della tabella con una passata
cronologica — i contatori di carriera (gpInCarriera, vittoriePrima,
podiPrima, polePrima, vittorieSuCircuitoPrima) e l'ordine del compagno.
Tolte dal file e dichiarate in `derivate`: il motore le ricalcola alla
decodifica, e D2.1 le confronta con questi numeri attesi:
Gasly a Monza 2020 (raceId 1038, driverId 842) → gpInCarriera 55,
vittoriePrima 0, podiPrima 1, polePrima 0, vittorieSuCircuitoPrima 0,
ordineCompagno 9; Hamilton stessa gara → 258, 89, 157, 93, 5, 5;
Hamilton in totale 356 GP e 105 vittorie, 5 a Monza; 3 vittorie al debutto
in tutta la storia. Le colonne rimaste sono tutte primarie (pilota, team,
griglia, stato, giri, soste, qualifica): scendere sotto 150 KB avrebbe
richiesto dizionari opachi per ~20 KB, non ne vale la leggibilità. Il tetto
per D2.2 (indice + tabelle) diventa **200 KB gzip**.

Altre codifiche dichiarate nel file: righe ordinate per (raceId, ordine)
con raceId per differenza; distacco dal vincitore in decimi di secondo;
null mai 0; colonne fuori finestra null (finestre per colonna in
`meta.finestre`).

## D1.2 — Le tracce per gara e i dizionari

`public/data/situazioni/tracce/<raceId>.json` (1996+): per ogni pilota le
posizioni per giro, colonnare. `public/data/situazioni/dizionari.json`:
piloti (id, nome, cognome, anni di attività, sinonimi), team (con i nomi
storici), circuiti (con paese e nomi comuni: "Monza", "Spa", "Silverstone"),
fatti (id, etichetta, parametro, colonne, finestra, sinonimi per il parser).

- [x] Prompt eseguito (11 set 2026)
- [x] Diff letto

**Esito D1.2.** Nella stessa pipeline (`build_situazioni.py`), non in uno
script a parte: un comando produce tutto. `tracce/<raceId>.json`: **544
gare** (1996-2024), 2,7 MB totali ma caricate una alla volta a richiesta;
null nei giri non completati, mai 0. `dizionari.json`: 861 piloti, 211
team, 77 circuiti, **26,5 KB gzip**. Piloti e team ordinati per anno di
ultima attività e poi per numero di gare: "hamilton" trova Lewis prima di
Duncan senza euristiche nel client (era uno dei difetti visibili della
v3). Circuiti con sinonimi scritti a mano in `SINONIMI_CIRCUITI` (Monza,
Spa, Interlagos, COTA, Montecarlo…) più la località di Ergast.
**Deviazione dichiarata:** il vocabolario dei *fatti* non sta nel JSON —
i fatti sono predicati, cioè codice, e vivono nel motore TypeScript
(D2.1) con i loro sinonimi accanto, così parser e motore leggono la
stessa lista. Verifiche nello script: Monza 2020 ha 53 giri, Gasly è 15°
al giro 20 e 1° al giro 28; Monza ha ospitato 74 gare.

# Fase D2 — Il motore

## D2.1 — Fatti, slot, conteggio, finestra

`src/lib/situazioni/motore.ts` (puro, nessun `fs`): decodifica le tabelle,
valuta una situazione → `{n, m, finestra, occorrenze[]}`. La finestra è
l'intersezione delle finestre dei fatti; il denominatore è l'universo
ristretto a chi/dove/quando e alla finestra. `scripts/verify-situazioni.ts`
con i numeri di D1.1.

- [x] Prompt eseguito (11 set 2026)
- [x] verify-situazioni: tutti i numeri attesi
- [x] Diff letto

**Esito D2.1.** Quattro moduli in `src/lib/situazioni/`: `tabelle.ts`
(decodifica + derivate, puro), `fatti.ts` (il vocabolario: **45 fatti**, 34
sul risultato e 11 sulla gara, ognuno con colonne, sinonimi e tre esiti
vero/falso/non valutabile), `motore.ts` (`valuta(tabelle, situazione)` →
n, m, unità del denominatore, finestra con la colonna che la stringe,
occorrenze), `tabelleServer.ts` (solo `fs`). Prestazioni misurate: decodifica
20 ms, una valutazione su tutta la tabella **0,8 ms** — il match mentre si
digita è gratis.

Regola del denominatore, decisa qui e scritta in cima a `motore.ts`: con
chi = pilota si legge "su N gare del pilota"; senza chi, se un fatto è
`unico` per gara (vince, pole, giro veloce) si legge "su N gare" (37 su
1114 come in v3), altrimenti "su N risultati"; soli fatti di gara → "gare".
Le righe in cui un fatto risponde null escono dal denominatore e si
contano a parte (`nonValutabili`), mai come "non è successo".

`scripts/verify-situazioni.ts`, tutto verde: derivate identiche alla
pipeline (Gasly e Hamilton a Monza 2020, 356 GP di Hamilton); 37/1114;
Monza 2/74 (1971, 2020); Hamilton 2/356 (2018, 2021); Hamilton a Monza
0/18; Hamilton vince 105/356 e 5/18 a Monza; **regressione v3: doppietta +
nessun cambio di leader = 30 su 544, finestra 1996 limitata da
`cambiDiLeader`**; soste ≥3 stringe a 2011-2024 (286 gare) e con "anni
1970" la finestra è dichiarata vuota; Gasly al comando entro il giro 28 sì,
27 no. Una attesa corretta strada facendo: "vince al debutto" in Python
faceva 3 perché contava Parsons alla 500 Miglia 1950; il motore esclude
Indy (trappola 1) e risponde 2 (Farina 1950, Baghetti 1961) — giusto lui.

## D2.2 — Il reticolo dei déjà vu

`src/lib/situazioni/reticolo.ts`: dato il risultato esatto, produce i gruppi
(§3.1 di PROGETTAZIONE-v4) allentando uno slot alla volta, poi due; pesi da
`params.json` → `situazioni.pesiAllentamento`. Deduplicazione: un'occorrenza
compare nel gruppo più vicino in cui regge, una volta sola. Numeri attesi per
*Hamilton · vince da 10° o peggio · a Monza*: uguale **0**; altro pilota a
Monza **2**; Hamilton altrove **2**; chiunque ovunque **37**.

- [x] Prompt eseguito (11 set 2026)
- [x] Diff letto

**Esito D2.2.** `src/lib/situazioni/reticolo.ts`: `costruisciReticolo(tab,
situazione, pesi, ctx)` → gruppo esatto + gruppi a distanza crescente, ogni
occorrenza una volta sola nel gruppo più vicino (`nuove`). Pesi in
`params.json → situazioni.pesiAllentamento` (chi 1, dove 0.8, stesso paese
0.4, quando 0.5, stesso decennio 0.25, parametro 0.6 per grado, togliere
un fatto 0.9); la pipeline li scrive se mancano. Ogni fatto parametrico
dichiara la DIREZIONE in cui il parametro si allenta (`allenta`: giu / su /
intorno) e il motore accetta `tolleranza` sul fatto scelto.

Due regole decise leggendo il primo output, non a tavolino:
1. il tetto non è sulla somma dei gradi ma sul **numero di slot toccati**
   (2): con il tetto sui gradi, "chiunque ovunque" (chi + "un altro
   circuito", grado 2 dopo "stesso paese") non veniva generato;
2. **togliere un fatto si fa solo da solo** (`soloDaSolo`): combinato con
   altro produceva gruppi senza significato ("senza vince + un altro
   pilota" = 1017 righe, cioè tutti quelli partiti da 10° o peggio a
   Monza) e, con due rimozioni, una situazione senza fatti.

Verifica (`verify-situazioni.ts`, tutta verde) su *Hamilton · vince da 10°
o peggio · a Monza*: esatto 0/18; un altro pilota **2/74** (1971, 2020); un
altro circuito **2/356** (2018, 2021); un altro circuito in Italia 0/23;
chiunque ovunque **37/1114 di cui 33 nuove**; da 9° o peggio 0; ordine per
distanza crescente; zero occorrenze ripetute. 15 gruppi in **14 ms**.
Deviazione da PROGETTAZIONE-v4 §3.1: l'allentamento "chi = pilota → lo
stesso team" non c'è (un pilota cambia team nel tempo, "stesso team"
sarebbe ambiguo): chi → chiunque, un grado solo. Da aggiornare in §3.1 a
fine roadmap. Nota per D3/D6: i paesi in `gare.paese` sono in inglese
("Italy"): serve una traduzione in chiaro nella UI.

# Fase D3 — La frase

## D3.1 — La frase a slot

`src/components/situazioni/Frase.tsx`: quattro slot in linea, menu con
completamento per slot, parametro numerico digitabile, tastiera completa.
Il colore dello slot è quello di `src/lib/colors.ts` → `SLOT_COLORS`.
Demo isolata in `src/app/dev/frase-demo/`.

- [x] Prompt eseguito (11 set 2026)
- [x] Diff letto

**Esito D3.1.** `src/components/situazioni/Frase.tsx` (client, controllato:
`value`/`onChange`), `SLOT_COLORS`/`SLOT_LABELS` in `src/lib/colors.ts`,
`src/lib/situazioni/paesi.ts` (i 35 paesi Ergast in italiano). Quattro slot
con bordo superiore del colore dello slot; Chi/Dove/Quando a scelta
singola con tendina (input + listbox, frecce/invio/esc, aria-activedescendant);
Cosa a più fatti, ognuno con il parametro modificabile in linea dentro
l'etichetta ("partito [10]° o peggio"). Le ere regolamentari sono dichiarate
in `ERE` (ibrida 2014-24, V8 2006-13, V10 1989-2005, turbo 1977-88, 3 litri
1966-76, primi anni 1950-65). Dopo "Chi" si apre da solo "Cosa", dopo "Cosa"
si apre "Dove": il flusso segue la frase. Demo in `/dev/frase-demo`, che
apre già sulla situazione del mockup e mostra frase riletta, N su M,
finestra e i gruppi del reticolo. Provato nel browser: "Dove" → "spa" →
invio ⇒ "Lewis Hamilton vince partito 10° o peggio a Spa · Mai su 18 gare
del pilota". Tre difetti corretti al primo sguardo: nome breve del circuito
(era "a Italia": ora è la località Ergast, "Monza"), spazio in "Mai su", e
la frase in chiaro lega i complementi senza "e" ("vince partito 10° o
peggio", non "vince e partito").

## D3.2 — Il parser di testo libero

`src/lib/situazioni/parser.ts`: regole a dizionario, nessun modello. Test con
almeno 20 frasi scritte nel file di test (es. "hamilton vince monza dalla
decima", "leclerc podio da p5 a spa 2019", "verstappen ritiro giro 1"). La
barra riempie gli slot e mostra cosa non ha capito, senza indovinare.

- [x] Prompt eseguito (11 set 2026)
- [x] Diff letto

**Esito D3.2.** `src/lib/situazioni/parser.ts` (`analizza(testo, dizionari)`
→ situazione, letture per slot, `nonCapito`), quattro passate a dizionario:
nomi (piloti per cognome/nome/codice, team, circuiti per sinonimo, paesi in
italiano, ere), epoche (anno, "anni 70"/"anni settanta"), fatti per sinonimo
(i più lunghi prima), numeri (cifre, "p10", "10°", ordinali in lettere)
assegnati al fatto parametrico vicino — anche con riempitivi in mezzo ("al
comando entro il giro 28") — oppure trasformati in "partito P" / "arriva P"
dalla parola che li precede ("dalla decima", "quinto"), con "o peggio" / "o
meglio" che scelgono la variante. `src/components/situazioni/BarraTesto.tsx`
riempie la frase a slot e stampa "Ho letto: pilota … · fatto … · circuito
…" e "Non ho capito: …". `scripts/verify-parser.ts`: **22 frasi**, tutte
passano. Tre cose imparate dalle frasi sbagliate, non a tavolino: "in
italia" è un paese, non il sinonimo di Monza (i nomi di paese non valgono
come sinonimi di circuito nel testo libero); "o peggio" non è un sinonimo
di "arriva P o peggio" ma una coda del numero; "ritiro" + "al primo giro"
è un fatto solo (il generico cade davanti allo specifico). `ERE` è passata
in `src/lib/situazioni/ere.ts` perché la legge anche il parser fuori dal
browser.

# Fase D4 — La linea dei déjà vu

## D4.1 — La vista D3

`src/components/charts/LineaDejaVu.tsx`: x = tempo, righe = gruppi, punti =
occorrenze, colore = slot che cambia, banda grigia fuori finestra, riga vuota
disegnata con "mai successo", brush sul tempo che aggiorna i conteggi,
transizione dei punti tra righe quando uno slot cambia. `ResizeObserver`.
Tooltip e click come in PROGETTAZIONE-v4 §7.3.

- [x] Prompt eseguito (11 set 2026)
- [x] Verificata nel browser (DOM: 9 righe, 48 punti, righe vuote dichiarate)
- [x] Diff letto

**Esito D4.1.** `src/components/charts/LineaDejaVu.tsx` + `src/lib/situazioni/slug.ts`.
Righe = `righeDaReticolo(reticolo)`: "uguale" (rossa, enfatizzata), poi
ogni gruppo a UN allentamento nell'ordine di distanza, poi una riga sola
"cambiano due slot" con i gruppi a due allentamenti fusi (grigio). Etichetta
a sinistra con "n su m unità" e "· k nuovi" quando il gruppo ripete casi già
visti più in alto. Punti con chiave stabile (riga della tabella): cambiando
uno slot lo stesso caso migra tra le righe con una transizione di 450 ms.
Banda tratteggiata "senza dati 1950–1995" fuori finestra; con intersezione
vuota, una banda su tutto. Brush D3 sul tempo: i punti fuori sbiadiscono e
ogni riga stampa "k nel periodo · n su m"; i denominatori restano quelli
della finestra piena, per scelta dichiarata nel testo sotto la vista.
Tooltip (`ChartTooltip`, portal): anno · nome gara, pilota, "cambia: <slot>".
Click → `onScegli(occorrenza, riga)`; nella demo porta a `/gara/<slug>`.
Fallback da tastiera: lista `sr-only` di bottoni, uno per caso. Provata su
*Hamilton · vince da 10° o peggio · a Monza*: 9 righe, 48 punti, "MAI
SUCCESSO" sulla riga uguale, tre righe "nessun caso" disegnate. I paesi
nelle etichette del reticolo ora passano da `paeseIt` ("in Italia").

# Fase D5 — Ritratti e mappa

## D5.1 — I ritratti

`src/components/charts/Ritratto.tsx` + griglia di small multiples sotto ogni
gruppo, scale condivise, dati da `tracce/<raceId>.json` a richiesta. Per gare
pre-1996 il ritratto è griglia → arrivo (due punti e un segmento), dichiarato.

- [x] Prompt eseguito (11 set 2026)
- [x] Diff letto

**Esito D5.1.** `src/components/charts/Ritratto.tsx` (un small multiple,
D3: y = posizione 1-20 condivisa, x = giro normalizzato, linea a gradini +
area, griglia a sinistra, arrivo a destra — rosso solo se è una vittoria;
didascalia "53 giri" / "ritirato dopo N giri su M" / "prima del 1996: solo
griglia → arrivo") e `RitrattiGruppo.tsx` (griglia di ritratti per riga
della linea, 8 alla volta con "mostra tutti", cache delle tracce per gara
condivisa, `datiRitratto()` costruisce titolo, pilota·team, stato da
tabelle e dizionari). Le tracce arrivano da `/data/situazioni/tracce/<raceId>.json`
a richiesta (verificato: 33 richieste 200 nella demo, una per gara). Due
regole del compilatore React rispettate dopo il primo lint: niente
`setState` sincrono in un effetto (lo stato porta la chiave gara+pilota e
"caricamento" è derivato), niente `ref.current` durante il render (la cache
è un `useMemo`).

## D5.2 — La mappa collegata

`DoveMappa.tsx` riceve le occorrenze del reticolo; click su circuito riempie
lo slot "dove". Tasso normalizzato per gare ospitate.

- [x] Prompt eseguito (11 set 2026)
- [x] Diff letto

**Esito D5.2.** `DoveMappa.tsx` (v3) ha tre prop opzionali in più —
`colore`, `finestraTesto`, `onCircuito` — che vincono su `entry` quando ci
sono: nessuna vista v3 cambia. `src/components/charts/DoveDejaVu.tsx` è
l'adattatore: conta le occorrenze delle righe a un allentamento (+ esatta)
per circuito, normalizza per le gare ospitate dal dizionario, passa il
colore dello slot "dove" e la finestra; il click su un cerchio o una barra
chiama `onCircuito(ref)` e la demo riempie lo slot Dove. Verificato: 3
circuiti per lo scenario del mockup (Monza, Hockenheim, Interlagos).

# Fase D6 — La nuova home

## D6.1 — Home, nome, testata, scheda gara, /esplora

`src/app/page.tsx` = frase + risposta + linea + gruppi con ritratti + mappa.
Titolo del sito "Déjà vu", metadati e testata aggiornati (via "Box, box?",
"Race Dynamics", "Race Anatomy"). La scheda gara mostra ogni fatto come
situazione cliccabile. /esplora invariato. Il compositore v3 (`/eventi/...`)
resta raggiungibile da /esplora.

- [x] Prompt eseguito (11 set 2026)
- [x] Diff letto

**Esito D6.1.** `src/app/page.tsx` (server: legge tabelle, dizionari, pesi,
circuits-geo) + `src/components/situazioni/DejaVu.tsx` (client: barra →
frase → risposta → linea → ritratti per riga → mappa, un solo stato). La
situazione vive nell'URL in chiaro (`src/lib/situazioni/url.ts`:
`?chi=p1&cosa=vince,parte_o_peggio:10&dove=c:monza`), letta dopo il
montaggio e aggiornata con `replaceState`; indietro/avanti funzionano.
La vecchia home (compositore a chip v3) è spostata **tale e quale** in
`/scenari`, linkata da `/esplora`. Testata: "Déjà vu · l'hai già visto?",
menu Chiedi / Gare / Esplora / Metodo (via "Race Dynamics", "Race Anatomy",
"Box, box?"); metadati aggiornati. Scheda gara: ogni fatto notevole porta
"È già successo qui? Chiedi a Déjà vu →" con la situazione compilata da
`src/lib/situazioni/daEventoV3.ts` (22 eventi v3 mappati, gli altri senza
link, dichiarato nel file); il link al compositore v3 resta.

Un bug trovato in prova e non a tavolino: con `useSearchParams` dentro
`Suspense` gli effetti D3 del **primo montaggio** non partivano (linea
senza righe, ritratti senza tracce, mappa vuota; tutto tornava vivo al
primo cambio di stato). Sostituito con la lettura di `window.location`
in un effetto dopo il montaggio: niente Suspense, tutto disegnato al primo
colpo (verificato: 9 righe, 48 punti, 12 ritratti con traccia, 3 circuiti;
e da URL `?cosa=vince,parte_o_peggio:10&dove=c:monza` → 2 su 74).

# Fase D7 — Chiusura

## D7.1 — Accessibilità, verifica, documenti

Tastiera e screen reader sulla frase; contrasto dei colori slot su fondo
scuro; `prefers-reduced-motion`. `npm run build` e `npm run lint` puliti.
`verify-situazioni.ts` tutto verde. Aggiornare `NUMERI.md`, `DOMANDE-ESAME.md`,
`/methodology`. PROGETTAZIONE.md (v3) resta come storia.

- [x] Prompt eseguito (11 set 2026)
- [x] Diff letto

**Esito D7.1.** `prefers-reduced-motion` azzera le transizioni della linea
dei déjà vu (unica animazione con significato). Tastiera: frase a slot con
combobox/listbox e `aria-activedescendant`, fallback `sr-only` ai punti SVG
della linea, ritratti come bottoni. Contrasto: "cosa" usa #B8B04A invece
dell'oliva Tol (#999933) per restare leggibile su #0B0C10. `npm run lint`
e `npm run build` puliti (la venv Python è ignorata da eslint);
`verify-situazioni.ts` e `verify-parser.ts` tutti verdi. Documenti:
NUMERI.md §10 (numeri v4 con fonte), DOMANDE-ESAME.md sezione v4 (sei
domande con risposta), /methodology sezione "Déjà vu: la frase a slot e i
casi simili", PROGETTAZIONE-v4 §3.1 e §4 allineati alle decisioni prese in
D2.2 e D2.1. Restano da fare, fuori roadmap: pagina "Gare" come elenco
(oggi il menu porta a /gara/2024-monza); i fatti su Q1/Q2 (servono le
colonne q1/q2/q3 in pipeline).

## D7.2 — Rifinitura della frase a slot  ✅ FATTO (11 set 2026)

Segnalazione di Luca sulla sezione dei quattro slot: "se clicco fuori dalla
lista una volta premuto un bottone non si chiude la lista". Rilette tutte le
funzioni della sezione, non solo quella: **sei difetti trovati e corretti**,
tutti in `src/components/situazioni/Frase.tsx`.

1. **La tendina non si chiudeva cliccando fuori.** Nuovo hook
   `useChiudiFuori`: `pointerdown` in fase di cattura sul documento, con il
   ref sul contenitore che include ANCHE il bottone che apre. Senza quel
   dettaglio si cade nella trappola classica: il clic sul bottone chiude "da
   fuori" e il click subito dopo riapre, e il menu non si chiude mai.
   `pointerdown` e non `click` perché le opzioni si scelgono con `mousedown`
   + preventDefault (per non perdere il fuoco dall'input di ricerca).
2. **Il fuoco non tornava indietro.** Chiudendo con Esc o scegliendo con
   Invio, il fuoco finiva sul `<body>`: ora torna al bottone dello slot.
   Aggiunta anche la chiusura quando il Tab porta il fuoco fuori dallo slot
   (`onBlur` sul contenitore, con controllo su `relatedTarget`).
3. **Le frecce uscivano dalla parte visibile della lista.** Con 12 voci in
   `max-h-72` l'opzione evidenziata spariva sotto il bordo: aggiunto
   `scrollIntoView({block:"nearest"})` e i tasti Home/Fine.
4. **La tendina dell'ultimo slot usciva dallo schermo.** "Quando" sta a
   destra e la tendina è larga 26rem: ora si misura dopo il primo disegno e
   si ancora a destra se sborderebbe (con listener di resize, e controllo sul
   bordo opposto per non rimbalzare).
5. **Il campo numerico.** Tre difetti in uno: (a) cancellarlo lo rimandava
   di colpo al minimo, perché `Number("")` è 0 — ora c'è una bozza di testo e
   il valore si taglia ai limiti solo all'uscita dal campo; (b) la rotellina
   sopra il campo a fuoco cambiava il parametro mentre si scorreva la pagina
   — ora il campo perde il fuoco; (c) la larghezza era fissa a 3.2ch e
   tagliava i valori a tre cifre (`gp_numero` arriva a 420) — ora segue la
   lunghezza.
6. **Tre etichette senza cifra.** Verificato sui 45 fatti: `soste` a 0 →
   "senza fermarsi", `ritiro_entro_giro` a 0 → "si ritira al via",
   `almeno_n_neutralizzazioni` a 1 → "con almeno una Safety Car o VSC". Lì
   `testo.indexOf(numero)` non trovava nulla e il campo finiva appiccicato in
   fondo alla frase, come un refuso (è il caso nello screenshot di Luca). Ora
   in quei casi il campo si stacca dopo il nome del parametro in piccolo
   maiuscoletto, così si legge come un comando.

**Cambiata anche una scelta di progetto, non un bug.** L'apertura automatica
del menu successivo dopo ogni scelta (documentata in D3.1: "il flusso segue
la frase") faceva comparire la tendina "Dove" da sola ogni volta che si
aggiungeva un fatto, coprendo la risposta appena cambiata. Ora: scelto "Chi"
si apre "Cosa" **solo se non c'è ancora un fatto** (senza un fatto la frase
non ha risposta, quindi è un seguito ovvio); scelto un fatto, la tendina si
chiude e basta.

Provato nel browser funzione per funzione: clic fuori chiude; il bottone
resta un interruttore (apri/chiudi/riapri); Esc chiude e riporta il fuoco;
Tab fuori chiude; frecce, Home e Fine tengono l'opzione visibile; Invio e
clic scelgono e chiudono; "Quando" si ancora a destra e resta dentro lo
schermo mentre "Chi" resta a sinistra; svuota-slot, togli-fatto e "+ e…"
aggiornano i conteggi (Hamilton a Monza: 18 gare, 5 vittorie, 14 gare da
quando ci sono i dati sulle soste). `npm run lint`, `npx tsc`, `npm run
build`, `verify-situazioni` e `verify-parser`: tutti puliti.


## D7.3 — Tendine complete, a gruppi  ✅ FATTO (11 set 2026)

Segnalazione di Luca: "quando apro il menu a tendina non si vedono tutte le
scelte, probabilmente perché sono troppe, però sarebbe interessante che il
telecronista possa vederle tutte". Vero e più grave di quanto sembrasse: il
tetto `MAX_OPZIONI = 12` valeva per **tutti e quattro** gli slot, e sotto ci
sono 48 fatti, 77 circuiti + 35 paesi, 75 stagioni + 8 decenni + 6 ere, 861
piloti + 211 team. Il caso grave è "Cosa": è il vocabolario del prodotto, e
chi non indovinava la parola non poteva sapere che esistesse "si ritira al
via" o "batte il compagno".

**Le famiglie diventano un dato.** I commenti di sezione di `fatti.ts`
(`// ---- ritiri ----`) erano già la classificazione giusta: sono diventati
il campo `gruppo` dei 48 fatti e l'elenco `GRUPPI_FATTI`, in ordine di
telecronaca — come finisce, come parte, se non finisce, e poi il resto.

**Una tendina sola, tre tipi di riga.** `Opzione` ora può essere una scelta
(`applica`), una discesa in una famiglia (`entra`) o un "mostra tutti"
(`espandi`); la navigazione da tastiera resta una sola — freccia e Invio,
senza dover sapere su che tipo di riga si è. Le righe portano l'etichetta del
gruppo e la tendina ci disegna sopra un'intestazione `sticky`, che resta in
alto mentre si scorre: si sa sempre in che parte dell'elenco si è finiti.

**Slot per slot.** *Cosa*: due passaggi, le nove famiglie con sommario e
conteggio, poi i fatti dentro la famiglia (con "←", Esc e Backspace a campo
vuoto per risalire); appena si scrive i due livelli spariscono e la ricerca è
piatta su tutti i 48 fatti, etichettati per famiglia — così si impara dove
stanno le cose. *Dove*: tutti i 77 circuiti (in ordine di gare ospitate:
Monza, Monaco, Silverstone) e tutti i 35 paesi. *Quando*: 6 ere, 8 decenni,
75 stagioni. *Chi*: gli unici elenchi che non si scorrono (861 + 211), quindi
anteprima di 12 e una riga "mostra tutti gli 861 piloti" che riapre l'elenco
**in ordine alfabetico** — espanso si cerca un nome, non si guarda chi ha
corso di più. Espandendo, l'evidenza torna in cima al gruppo appena aperto:
l'indice di prima punterebbe a un nome a caso, visto che l'ordine cambia. La
lista nuova si ricalcola nel gestore invece che in un effetto (`setState`
dentro un effetto = render a cascata, ed è anche un errore di lint).

Tolto il tetto di 12 ovunque tranne che nell'anteprima di "Chi"; lista
cresciuta da `max-h-72` a `max-h-[22rem]`.

Provato nel browser: "Cosa" apre le nove famiglie con il conteggio aggiornato
ai fatti già scelti, entra ed esce con clic, Invio, Esc e Backspace; cercando
"ritir" escono i fatti di due famiglie diverse con le intestazioni giuste;
"Dove" mostra 112 voci sotto Circuiti/Paesi, "Quando" 89 sotto
Ere/Decenni/Stagioni; "mostra tutti gli 861 piloti" porta la lista a 874 voci
in ordine alfabetico (Abate, Abecassis, Acheson). `npx tsc`, `npx eslint` e
`npm run build`: puliti.
