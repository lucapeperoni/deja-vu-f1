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

## 4. Team

| Evento | Volte | Ultima volta |
|---|---|---|
| Doppietta 1-2 | 316 | 2024 Las Vegas |
| **Tripletta 1-2-3** | **13** | **1961 Silverstone** (63 anni fa) |
| Doppio ritiro dello stesso team | 2964 | 2024 San Paolo |
| Doppio ritiro per la **stessa causa** | 772 | 2024 Monaco |
| Prima vittoria assoluta di un costruttore | 47 | 2021 Ungheria (Alpine) |

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

## Script usati

Gli script esplorativi che hanno prodotto questi numeri sono materiale di
lavoro; vanno riscritti come modulo della pipeline (`scripts/python/`)
prima di finire nel prodotto.
