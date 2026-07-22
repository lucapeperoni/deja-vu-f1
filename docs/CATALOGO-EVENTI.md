# Catalogo degli eventi interrogabili

Materiale di lavoro per il pivot v3 ("è già successo?"). Tutti i numeri qui
sotto sono **calcolati davvero sui CSV in `data/raw/`**, non stimati: gli
script usati sono in `scripts/python/` (vedi in fondo). Perimetro:
1950-2024, 1125 gare.

Obiettivo del documento: dimostrare che esiste abbastanza materiale per uno
strumento di interrogazione, e capire quali eventi entrano nell'MVP.

---

## 0. Copertura dei dati (vincolo che decide cosa è interrogabile)

| Sorgente | Copertura | Gare | Cosa abilita |
|---|---|---|---|
| `results`, `races`, `driver_standings`, `constructor_standings`, `status` | **1950-2024** | 1125 | griglia, arrivo, punti, ritiri, classifiche |
| `qualifying` (Q1/Q2/Q3) | 1994-2024 | 494 | eventi di qualifica dettagliati |
| `lap_times` | 1996-2024 | 544 | comando in pista, cambi di leader, andamento |
| `results.rank` (giro veloce) | 2004-2024 | 412 | hat-trick, giro veloce |
| `pit_stops` | 2011-2024 | 285 | strategie, numero di soste |
| OpenF1 (SC/VSC) — già nostro | 2023-2024 | 46 | neutralizzazioni |

**Regola di progetto che ne discende:** ogni evento nello strumento deve
dichiarare la propria finestra temporale. "Mai successo prima" significa
"mai nella finestra in cui il dato esiste" — è una precisazione onesta, ed
è anche una delle cose che rende il progetto una *soluzione* e non un
generatore di curiosità.

---

## 1. Griglia e risultato (1950-2024) — la famiglia più ricca

| Evento | Volte | Ultima volta | Circuito che lo ospita di più |
|---|---|---|---|
| Vittoria dalla pole | 481 | 2024 Abu Dhabi | Monaco (32) |
| Vincitore non partito in prima fila | 379 | 2024 San Paolo | Monza (35) |
| Vittoria partendo 5° o peggio | 174 | 2024 San Paolo | Spa (14) |
| Vittoria partendo 10° o peggio | **40** | 2024 San Paolo (Verstappen, 17°) | Spa (4) |
| Vittoria partendo 15° o peggio | **9** | 2024 San Paolo | Singapore |
| Vittoria partendo 20° o peggio | **1** | 1983 Long Beach | — |
| Podio partendo 15° o peggio | 75 | 2024 Abu Dhabi | Indianapolis (8) |
| Nessuno dei primi 3 in griglia sul podio | 78 | 2024 San Paolo | Monza (9) |
| Podio intero partito fuori dai primi 5 | 19 | 2014 Silverstone | Spa (2) |
| Pole finita con un ritiro | 284 | 2024 Silverstone | — |

Questa famiglia da sola regge una vista: **un piano griglia × arrivo** con
1125 gare come nuvola, e l'evento selezionato che si illumina.

**Con le trappole di §5.6 applicate** (verificato in `data-layer/app/events`,
milestone di fine E1, `scripts/spike_events.py`): i numeri sopra sono
**grezzi**, calcolati senza filtri. Con la sola trappola 1 (Indy 500 esclusa)
diventano:

| Evento | Grezzo | Con trappole | Perché cambia |
|---|---:|---:|---|
| Vittoria partendo 5° o peggio | 174 | **166** (−8) | −7 vittorie all'Indy 500 1950-1960 con griglia ≥5 (1950, 1952, 1954, 1955, 1957, 1958, 1959); −1 perché il GP di Francia 1951 fu vinto a guida condivisa (prassi pre-1958) da due piloti entrambi partiti 7°: contarli come due righe di risultato invece che come una vittoria per gara porta il grezzo a 174 invece di 173 — non è una trappola di §5.6, è una particolarità del dataset che va dichiarata comunque. |
| Vittoria partendo 10° o peggio | 40 | **37** (−3) | −3 vittorie all'Indy 500 con griglia ≥10 (1954, 1955, 1957). |
| Vittoria partendo 15° o peggio | 9 | **8** (−1) | −1 vittoria all'Indy 500 con griglia ≥15 (1954, griglia 19ª). |
| Vittoria partendo 20° o peggio | 1 | **1** (invariato) | Nessuna vittoria Indy 500 partiva da griglia ≥20 (la più indietro è 19ª, 1954): la trappola non tocca questo numero. |

Circuito che ospita di più e ultima volta restano gli stessi in entrambe le
versioni (Spa per N=5/10, Singapore per N=15, Long Beach 1983 per N=20).

## 2. Margine di vittoria (1099 gare calcolabili)

Il margine si ricava da `milliseconds` del 1° e del 2° (solo quando sono
sullo stesso giro).

| Evento | Volte | Ultima volta |
|---|---|---|
| Margine sotto 2 secondi | 183 | 2024 Belgio |
| Margine sotto 1 secondo | 95 | 2024 Imola |
| Margine sotto mezzo secondo | 41 | 2023 Australia |
| Margine sotto un decimo | **5** | 2002 Indianapolis |

Le 5 volate più strette di sempre: Monza 1971 (**0.010s**), Indianapolis
2002 (0.011s), Jerez 1986 (0.014s), Österreichring 1982 (0.050s), Monza
1969 (0.080s). Questo è esattamente il tipo di fatto che un commentatore
cerca in diretta.

**Con le trappole di §5.6 applicate:** le 4 occorrenze sopra sono
**invariate** (183/95/41/5 → 183/95/41/5: nessuna delle 11 gare Indy 500 ha
un margine sotto le 2 secondi, quindi la trappola 1 non tocca il numeratore).
Cambia solo il denominatore delle "gare calcolabili": **1099 grezzo → 1088
con trappole (−11)**, esattamente le 11 gare Indy 500 (tutte calcolabili, ma
con margini troppo larghi per rientrare in una soglia). Nota: ricalcolando
il grezzo in modo indipendente (`data-layer/app/events`, senza escludere
l'Indy 500) risulta 1098, non 1099 — uno scarto di 1 gara non spiegato dalle
trappole di §5.6 e non ancora risolto; probabile la conta originale contasse
una gara in più come "calcolabile" per una ragione che non sono riuscito a
ricostruire. Da verificare in E1.2 prima di fidarsi ciecamente del
denominatore in `/methodology`.

## 3. Gare anomale

| Evento | Volte | Ultima volta |
|---|---|---|
| Meno di 10 classificati | 138 | 2008 Australia |
| Meno di 8 classificati | 47 | 2005 Indianapolis (6 in pista) |
| Meno di 6 classificati | 8 | 1984 Detroit |
| Nessun ritiro (tutti al traguardo) | **14** | 2024 Zandvoort |
| % ritiri record | — | Monaco 1996: 86% (19 su 22) |

Dal 2010 la gara più decimata è Monaco 2010 (50%): il **contrasto per era**
è di per sé una storia visualizzabile.

**RISOLTO (non con le trappole — con un bug trovato nel documento stesso):**
i numeri grezzi qui sopra (138/47/8) sono **sbagliati**, non solo diversi
per via delle trappole. Prova decisiva, interna a questa stessa sezione:
la riga "% ritiri record" qui sopra dichiara **Monaco 1996 con 19 ritiri su
22**, cioè **3 classificati** — ma la riga "Meno di 6 classificati" dichiara
solo 8 occorrenze in assoluto con ultima nel **1984**, il che è
impossibile se Monaco 1996 (3 classificati, quindi sotto qualunque soglia
6/8/10) è nello stesso documento due righe sopra. Le due righe si
contraddicono da sole: la tabella "classificati" ha un bug, non è un
effetto delle trappole di §5.6.

Ho comunque provato a spiegare il divario con le trappole prima di
concludere questo (filtro Indy 500, tassonomia dei ritiri, e in più
un'ipotesi a soglia percentuale sui giri rispetto al vincitore, testata a
più valori tra 80% e 100%): nessuna spiega un divario di 50-150 gare, e il
filtro Indy 500 da solo sposta il totale di **1 gara al massimo**. I numeri
adottati sono quindi quelli del motore, verificati anche a mano su
Monaco 1996 e Australia 2008 (entrambi fatti storici pubblici):

| Evento | Grezzo (sezione originale, **da considerare errato**) | Adottato (`data-layer/app/events`, verificato) |
|---|---:|---:|
| Meno di 6 classificati | ~~8, ultima 1984 Detroit~~ | **17**, ultima **1996 Monaco** (3 classificati) |
| Meno di 8 classificati | ~~47, ultima 2005 Indianapolis~~ | **76**, ultima **2008 Australia** (6 classificati) |
| Meno di 10 classificati | ~~138, ultima 2008 Australia~~ | **192**, ultima 2008 Australia |

## 4. Team

| Evento | Volte | Ultima volta |
|---|---|---|
| Doppietta 1-2 | 316 | 2024 Las Vegas |
| **Tripletta 1-2-3** | **13** | **1961 Silverstone** (63 anni fa) |
| Doppio ritiro dello stesso team | 2964 | 2024 San Paolo |
| Doppio ritiro per la **stessa causa** | 772 | 2024 Monaco |
| Prima vittoria assoluta di un costruttore | 47 | 2021 Ungheria (Alpine) |

**Con le trappole di §5.6 applicate:**

| Evento | Grezzo | Con trappole | Perché cambia |
|---|---:|---:|---|
| Doppio ritiro dello stesso team | 2964 | **2311** (−653, ultima invariata 2024 San Paolo) | −626 dalla trappola 2 (tassonomia status): il grezzo conta come "ritiro" anche i *Did not qualify*/*Did not prequalify*/*Withdrew*, che non sono ritiri (§5.6 punto 2); tenendo solo RITIRO_TECNICO e RITIRO_INCIDENTE il numero scende a 2338. Altri −27 dalla trappola 1 (Indy 500 esclusa). Somma −653, torna esatto. |
| Doppio ritiro per la stessa causa | 772 | **665** (ultima invariata 2024 Monaco) | **Deciso, non ricostruito**: ho provato 5 combinazioni di categorie incluse/escluse (ritiro stretto, +NON_PARTITO, +NON_QUALIFICATO, con/senza Indy 500) e nessuna riproduce 772 (ottengo 957, 938, 921, 720, 684 o 665). L'ultima occorrenza (2024 Monaco) coincide in ogni variante, quindi lo script originale guardava la stessa cosa, ma con una regola di conteggio che non sono riuscito a isolare — e lo script che l'ha prodotta non è più nel repo, quindi non è verificabile a ritroso. **665 è il numero adottato**, perché è l'unico coerente con la tassonomia di §5.6 applicata senza eccezioni (solo RITIRO_TECNICO e RITIRO_INCIDENTE contano come "ritiro", Indy 500 esclusa) — le stesse regole che spiegano per intero la riga sopra. 772 resta come riferimento storico del documento, non come numero da usare in `/methodology`. |

## 5. Prime volte e carriere

| Evento | Volte | Ultima volta |
|---|---|---|
| Prima vittoria in carriera | 115 | 2024 Ungheria (Piastri) |
| Primo podio in carriera | 216 | 2023 Giappone |
| Prima pole in carriera | 110 | 2022 Ungheria |
| Prima vittoria di quel pilota **su quel circuito** | 687 | — |
| Podio al debutto assoluto in F1 | **21** | 2014 Australia |
| **Vittoria al debutto assoluto** | **3** | **1961 Francia** |

Record d'età calcolabili da `drivers.dob`: vincitore più giovane
Verstappen a 18,6 anni (Spagna 2016), più vecchio Fagioli a 53,1 (Francia
1951).

**Con le trappole di §5.6 applicate:** Prima vittoria in carriera: **115
grezzo → 105 con trappole** (−10, ultima invariata 2024 Ungheria). I 10
piloti in meno sono quelli la cui unica "prima vittoria" registrata cadeva
in una delle 11 gare Indy 500 1950-1960: escludendo quelle gare dalla
cronologia (non erano gare di F1), la loro vittoria sparisce dal conteggio
invece di spostarsi su una gara successiva. Spiegato per intero dalla
trappola 1.

## 6. Cause di ritiro — 105 cause distinte davvero usate

Top: Motore 2026, Incidente 1062, Collisione 854, Cambio 810, Testacoda
795, Sospensione 431, Trasmissione 321, Elettrico 316.

**38 cause hanno 5 o meno occorrenze in 75 anni** — è qui che sta l'oro
per il giornalista: "Cintura di sicurezza" (1 sola volta, Australia 1996),
"Ferita all'occhio" (1, Francia 1972), "Giunto omocinetico" (1, Germania
1985), "Candele" (3, Giappone 2017), "Tubo dell'acqua" (3), "Compressore
volumetrico" (5, ultima Indy 1952).

Interrogazione tipo: *"da quando non si ritira più nessuno per X?"* →
Frizione ferma al 2014 Bahrain, Accensione al 2002 Francia, Semiasse al
2001 Germania, Finito il carburante al 2019 Bahrain.

## 7. Comando in pista (1996-2024, 544 gare)

| Evento | Volte / valore | Note |
|---|---|---|
| Gare senza **nessun** cambio di leader | 99 | il contrario della "gara noiosa" percepita |
| Gare con ≥5 piloti diversi al comando | 33 | massimo 7 (Australia 2013, Canada 2008) |
| Più cambi di leader | 10 | Giappone 2011, Australia 2013, Giappone 2008 |
| **Vittoria conquistata solo all'ultimo giro** | **6** | l'ultima: **Abu Dhabi 2021** |

Le rimonte (`grid − posizione finale`): ≥10 posizioni 1750 volte, ≥15 352
volte, ≥20 solo 33 volte.

**Con le trappole di §5.6 applicate:** Gare senza nessun cambio di leader:
**99 grezzo → 99 con trappole** (invariato, ultima 2024 Abu Dhabi, circuito
che lo ospita di più Monaco con 13). Nessuna gara Indy 500 (1950-1960) cade
nella finestra 1996-2024 di questo evento (serve `lap_times`), quindi la
trappola 1 non ha nulla da togliere qui: finestra e trappola non si
sovrappongono nel tempo.

## 8. Strategia (2011-2024, 285 gare)

Distribuzione soste per pilota-gara: 1 sosta 1854, 2 soste 2225, 3 soste
1069, 4 soste 307, 5 soste 91, 6 soste 26, **7 soste 3 volte**.

Il vincitore ha fatto: 1 sosta 105 volte, 2 soste 117, 3 soste 45, 4 soste
14, **5 soste 2 volte, 6 soste 2 volte**. Evento interrogabile: *"quante
volte ha vinto chi si è fermato più di tutti?"*

Pit stop più veloci registrati: 12.90s Maldonado (Abu Dhabi 2011) — nota:
è il tempo in pit lane, non la sosta statica. Soste sopra i 60 secondi:
517.

**Qui si innesta tutto il lavoro già fatto**: le neutralizzazioni SC/VSC
2023-2024 diventano una famiglia di eventi tra le altre, con la sua
finestra dichiarata (46 gare), e la metrica del costo effettivo resta il
motore di quella famiglia.

## 9. Campionato (1950-2024)

| Evento | Volte | Esempi |
|---|---|---|
| Titolo deciso per ≤5 punti | 26 | 2008 (1 pt), 2007 (1 pt), 2016 (5 pt) |
| Stagioni con ≥5 cambi di leader in classifica | 13 | 1986 e 2010 con **9** cambi |
| Vittorie consecutive, serie più lunghe | — | Verstappen 10, Verstappen 9, Vettel 9, Ascari 7, Schumacher 7 |
| Hat-trick pole+vittoria+giro veloce (dal 2004) | 69 | ultima: 2024 Zandvoort |

## 10. Identità e geografia

Vittorie per nazionalità: britannici 317, tedeschi 179, brasiliani 101,
francesi 81, olandesi 63, finlandesi 57.

Interrogazione "siccità": neozelandesi fermi al **1974**, svedesi al 1978,
**americani al 1978**, svizzeri al 1979, sudafricani al 1979, argentini al
1981. Ottimo materiale per la dimensione "dove" richiesta dal prof:
i 77 circuiti hanno coordinate (`circuits.csv` ha lat/lng), quindi ogni
evento è mappabile.

---

## 11. Trappole nei dati (da gestire, e da dichiarare in `/methodology`)

1. **Indianapolis 500**: 19 gare a Indianapolis nel dataset, di cui
   **1950-1960 sono la 500 Miglia**, che contava per il mondiale ma non era
   una gara di F1. Inquina i record ("rimonta più grande di sempre" =
   Indy 1957, 30 posizioni). Serve un filtro esplicito, con l'opzione di
   includerle.
2. **"Ritiro" ≠ "non partito"**: in `status` ci sono 1025 *Did not
   qualify*, 331 *Did not prequalify*, 248 *Withdrew*. Se contati come
   ritiri gonfiano tutte le statistiche di affidabilità degli anni '80-'90.
   Va definita una tassonomia: non-qualificato / non-partito / ritiro
   tecnico / ritiro per incidente.
3. **Campi vuoti**: `position` è vuoto nel 41% dei risultati (chi non è
   classificato), `time`/`milliseconds` nel 71%, giro veloce nel 69%
   (esiste solo dal 2004).
4. **Griglia = 0** significa partenza dalla pit lane: da non trattare come
   "posizione 0".
5. **Punti non comparabili tra ere**: il sistema di punteggio è cambiato
   più volte; i confronti in punti vanno fatti dentro la stessa era o
   normalizzati.

Queste cinque trappole non sono un problema: sono **il contenuto della
pagina metodologia** e la dimostrazione che il gruppo ha guardato i dati
sul serio.

---

## 12. Proposta di MVP

Prima ondata (solo `results` + `races` + `status`, copertura piena
1950-2024, nessuna dipendenza):

1. Vittoria da griglia ≥ N (parametrico)
2. Margine di vittoria sotto N secondi
3. Meno di N classificati / % ritiri della gara
4. Doppietta, tripletta, doppio ritiro (anche per stessa causa)
5. Prima volta in carriera (vittoria / podio / pole), anche per circuito
6. Ritiro per causa X: quando, dove, quanto tempo è passato

Seconda ondata (finestre ridotte, valore alto):

7. Cambi di leader e comando in pista (1996+)
8. Numero di soste del vincitore (2011+)
9. Neutralizzazioni SC/VSC e costo del pit (2023-2024, **già fatto**)

Terza ondata (la parte che impressiona):

10. **Generatore automatico di fatti notevoli**: data una gara, il sistema
    valuta tutti gli eventi del catalogo, calcola la rarità di ciascuno
    (occorrenze / gare nella finestra valida) e restituisce i fatti
    ordinati per rarità. Il giornalista apre il GP e trova già scritto
    "3ª volta dal 1950".

## 13. E2.1 — Il catalogo esteso a 28 eventi: confronto con le trappole

`data-layer/app/events/catalog.py` implementa 28 eventi in 8 famiglie
(soglia minima 20/5 superata). Per ogni evento nuovo, il numero grezzo di
questo documento coincide **esattamente** una volta ricalcolato includendo
l'Indy 500 (per isolare l'effetto della sola trappola 1), poi la trappola
si riapplica e il numero cambia in modo spiegabile. Verificato in
`data-layer/tests/test_catalog.py` (26 test, 20 eventi distinti, tutti
passano).

**Coincidenze esatte** (grezzo del documento = motore con Indy 500 inclusa):

| Evento | Grezzo (documento) | Con trappole |
|---|---:|---:|
| Podio partendo 15° o peggio | 75 | **69** |
| Primo podio in carriera | 216 | **191** |
| Prima vittoria assoluta di un costruttore | 47 | **43** |
| Prima vittoria del pilota su quel circuito | 687 | **677** |
| Vittoria al debutto assoluto | 3 | **2** |
| Rimonta ≥10 posizioni | 1750 | **1668** |
| Rimonta ≥15 posizioni | 352 | **304** |
| Rimonta ≥20 posizioni | 33 | **18** |
| Ritiro per causa "Motore" | 2026 | **2001** |
| Ritiro per causa "Incidente" | 1062 | **1015** |
| Ritiro per causa "Collisione" | 854 | **854** (zero collisioni multi-vettura all'Indy 500: gara ovale, non un circuito stradale) |
| Ritiro per causa "Cambio" | 810 | **809** |
| Ritiro per causa "Testacoda" | 795 | **781** |
| Ritiro per causa "Sospensione" | 431 | **427** |
| Ritiro per causa "Trasmissione" | 321 | **311** |
| Ritiro per causa "Elettrico" | 316 | **316** (stesso motivo: nessun guasto elettrico registrato all'Indy 500) |
| Gare con ≥5 piloti diversi al comando | 33 | **33** (nessuna gara Indy 500 nella finestra 1996+) |
| Vincitore con ≥3/4/5 soste | 63 / 18 / 4 | **63 / 18 / 4** (2011-2024 non si sovrappone all'Indy 500) |
| Pilota con ≥4/5/7 soste | 427 / 120 / 3 | **427 / 120 / 3** (idem) |
| Causa di ritiro non vista da anni (4 esempi qualitativi) | Frizione 2014 Bahrain, Accensione 2002 Francia, Semiasse 2001 Germania, Finito il carburante 2019 Bahrain | **tutti e 4 confermati** |

Il "doppio ritiro dello stesso team (qualunque causa)" (2964 grezzo) torna
**2311** con le trappole, stesso conto già spiegato in sezione 4.

**Piccoli residui non spiegati** (poche gare di differenza, anche
includendo l'Indy 500 — quindi non è la trappola 1 a causarli):

| Evento | Grezzo (documento) | Motore, Indy 500 inclusa | Scarto |
|---|---:|---:|---:|
| Nessuno dei primi 3 in griglia sul podio | 78 | 82 | +4 |
| Podio al debutto assoluto | 21 | 23 | +2 |
| Doppietta 1-2 dello stesso team | 316 | 318 | +2 |
| Pole finita con un ritiro | 284 | 282-283 (a seconda se "ritiro" è la tassonomia stretta o ampia) | −1/−2 |
| Prima pole in carriera | 110 | 105 | −5 (possibile causa: qui "pole" è approssimata con `grid == 1`, che dal 1994 può divergere dalla vera posizione di qualifica quando ci sono penalità in griglia — non verificato) |

**Un punto aperto, non piccolo — segnalato invece di nascosto:**
"Vittoria conquistata all'ultimo giro": il documento dichiara **6** (ultima
Abu Dhabi 2021), il motore ne trova **12** nella stessa finestra
(1996-2024), e **non è un effetto dell'Indy 500** (fuori da quella
finestra). Controllando a mano le 12 gare trovate, almeno 5 corrispondono
a sorpassi per la vittoria all'ultimo giro storicamente documentati e noti
(Abu Dhabi 2021, Canada 2011 - rimonta di Button, Austria 2016 - Rosberg
largo all'ultima curva, USA 2002 - scambio Ferrari all'ultima curva,
Nürburgring 2005 - Räikkönen out con la sospensione mentre comandava),
il che suggerisce che il numero **6** del documento sia un sottoinsieme
curato o incompleto piuttosto che il motore sia sbagliato — ma non è una
prova, e non è stato risolto. Da verificare gara per gara prima di usare
questo evento in `/methodology`.

## Script usati

Gli script esplorativi che hanno prodotto questi numeri sono materiale di
lavoro; vanno riscritti come modulo della pipeline (`scripts/python/`)
prima di finire nel prodotto.
