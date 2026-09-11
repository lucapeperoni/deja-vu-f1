"use client";

// La frase a slot (Déjà vu v4, docs/PROGETTAZIONE-v4.md §7.1; roadmap D3.1):
// quattro slot in linea — Chi · Cosa · Dove · Quando — che si leggono come
// una frase italiana. Ogni slot apre un menu con completamento; il
// parametro numerico si scrive nello slot stesso. Tutto da tastiera:
// frecce, invio, esc, tab tra gli slot.
//
// HTML/CSS puro: non disegna scale né assi, quindi non è una vista D3
// (stessa motivazione già accettata per EventCardsGrid e per il compositore
// v3). Il colore dello slot è SLOT_COLORS (src/lib/colors.ts): lo stesso
// colore lega lo slot alla riga della linea dei déjà vu e al bordo del
// ritratto.
//
// Il componente è controllato: riceve la situazione e chiama onChange. Non
// valuta niente — la valutazione è del motore (motore.ts), chiamata dalla
// pagina.

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SLOT_COLORS, SLOT_LABELS, type Slot } from "@/lib/colors";
import { FATTI, GRUPPI_FATTI, fattoById, type Fatto, type GruppoFatto } from "@/lib/situazioni/fatti";
import type { Chi, Dove, FattoScelto, Quando, Situazione } from "@/lib/situazioni/motore";
import { paeseIt } from "@/lib/situazioni/paesi";
import type { DizionariJson } from "@/lib/situazioni/tabelle";
import { ERE } from "@/lib/situazioni/ere";

export interface FraseProps {
  dizionari: DizionariJson;
  value: Situazione;
  onChange: (s: Situazione) => void;
  // quale slot aprire all'avvio (es. "cosa" quando la frase è vuota)
  apriSlot?: Slot | null;
}

export { ERE };

export function normalizza(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Chi digita ha in mente l'inizio di una parola: "ham" trova Hamilton
// prima di "Graham Hill". Rango 0 = inizio stringa, 1 = inizio parola,
// 2 = sottostringa, null = niente.
export function punteggio(testo: string, q: string): number | null {
  const t = normalizza(testo);
  if (q === "") return 3;
  if (t.startsWith(q)) return 0;
  if (t.split(/[^a-z0-9]+/).some((p) => p.startsWith(q))) return 1;
  return t.includes(q) ? 2 : null;
}

// Una riga della tendina. Tre tipi, distinti da quale campo è presente:
// `applica` = una scelta vera; `entra` = si scende in una famiglia di fatti;
// `espandi` = "mostra tutti", che allunga un gruppo invece di chiudere la
// tendina. Le tre stanno nella stessa lista perché la navigazione da
// tastiera è una sola: freccia giù e invio, senza sapere su cosa si è.
interface Opzione {
  chiave: string;
  titolo: string;
  // riga in piccolo sotto il titolo (le famiglie di "Cosa" dicono così cosa
  // contengono senza doverci entrare)
  sotto?: string;
  // il titolo di un fatto con parametro, spezzato attorno al posto del
  // numero: si disegna con il nome della variabile al centro, colorato
  variabile?: { prima: string; nome: string; dopo: string };
  dettaglio?: string;
  // intestazione del gruppo sotto cui va mostrata; righe consecutive con la
  // stessa etichetta stanno sotto la stessa intestazione
  gruppo?: string;
  applica?: (s: Situazione) => Situazione;
  entra?: GruppoFatto;
  espandi?: string;
}

// Una riga che porta davvero a una scelta (le righe di navigazione, `entra`
// e `espandi`, la tendina se le gestisce da sola e non escono mai).
type Scelta = Opzione & { applica: (s: Situazione) => Situazione };

// Un menu: le righe più il contesto del livello in cui ci si trova.
interface Menu {
  righe: Opzione[];
  // intestazione del pannello quando si è dentro un sottolivello
  titolo?: string;
  segnaposto?: string;
}

interface StatoMenu {
  dentro: GruppoFatto | null;
  espansi: string[];
}

type FonteMenu = (q: string, stato: StatoMenu) => Menu;

// Quante voci mostrare a colpo d'occhio nei gruppi troppo lunghi da
// scorrere (piloti e team): sotto c'è sempre una riga "mostra tutti".
const ANTEPRIMA = 12;

// Misure della tendina, in pixel. L'altezza non è fissa: è quanto spazio c'è
// fra lo slot e il bordo della finestra, tagliato fra questi due estremi.
const ALTEZZA_MAX = 384;
const ALTEZZA_MIN = 220;
const LARGHEZZA_MIN = 416; // le 26rem del pannello
const MARGINE = 12;

export default function Frase({ dizionari, value, onChange, apriSlot = null }: FraseProps) {
  const [aperto, setAperto] = useState<Slot | null>(apriSlot);

  const nomi = useMemo(() => {
    const piloti = new Map(dizionari.piloti.map((p) => [p.id, p.nome]));
    const team = new Map(dizionari.team.map((t) => [t.id, t.nome]));
    const circuiti = new Map(dizionari.circuiti.map((c) => [c.ref, c.nome]));
    return { piloti, team, circuiti };
  }, [dizionari]);

  const testoChi = value.chi
    ? value.chi.tipo === "pilota"
      ? nomi.piloti.get(value.chi.driverId) ?? "pilota"
      : nomi.team.get(value.chi.constructorId) ?? "team"
    : null;
  const testoDove = value.dove
    ? value.dove.tipo === "circuito"
      ? `a ${nomeBreveCircuito(dizionari, value.dove.circuitRef)}`
      : `in ${paeseIt(value.dove.paese)}`
    : null;
  const testoQuando = value.quando ? etichettaQuando(value.quando) : null;

  return (
    <div className="flex flex-wrap items-stretch gap-2" role="group" aria-label="La situazione, in quattro slot">
      <SlotBox
        slot="chi"
        aperto={aperto === "chi"}
        onApri={() => setAperto(aperto === "chi" ? null : "chi")}
        onChiudi={() => setAperto(null)}
        testo={testoChi}
        vuoto="chiunque"
        suggerimento="pilota o team"
        onSvuota={value.chi ? () => onChange({ ...value, chi: undefined }) : undefined}
        fonte={(q, stato) => opzioniChi(dizionari, q, stato)}
        // Scelto "chi", si apre da solo "Cosa" SOLO se non c'è ancora un
        // fatto: senza un fatto la frase non ha risposta, quindi è un
        // seguito ovvio. Negli altri casi la tendina si chiude e basta —
        // un menu che si apre da sé quando non serve è la cosa che rendeva
        // fastidiosa questa sezione.
        onScegli={(o) => {
          onChange(o.applica(value));
          setAperto(value.cosa.length === 0 ? "cosa" : null);
        }}
      />

      <SlotCosa
        aperto={aperto === "cosa"}
        onApri={() => setAperto(aperto === "cosa" ? null : "cosa")}
        onChiudi={() => setAperto(null)}
        value={value}
        onChange={onChange}
        // Scelto un fatto la tendina si chiude, invece di saltare a "Dove":
        // aprire "Dove" da solo copriva la risposta appena cambiata, e chi
        // voleva un secondo fatto se lo trovava addosso.
        onScelto={() => setAperto(null)}
      />

      <SlotBox
        slot="dove"
        aperto={aperto === "dove"}
        onApri={() => setAperto(aperto === "dove" ? null : "dove")}
        onChiudi={() => setAperto(null)}
        testo={testoDove}
        vuoto="ovunque"
        suggerimento="circuito o paese"
        onSvuota={value.dove ? () => onChange({ ...value, dove: undefined }) : undefined}
        fonte={(q) => opzioniDove(dizionari, q)}
        onScegli={(o) => {
          onChange(o.applica(value));
          setAperto(null);
        }}
      />

      <SlotBox
        slot="quando"
        aperto={aperto === "quando"}
        onApri={() => setAperto(aperto === "quando" ? null : "quando")}
        onChiudi={() => setAperto(null)}
        testo={testoQuando}
        vuoto="sempre"
        suggerimento="anno, decennio o era"
        onSvuota={value.quando ? () => onChange({ ...value, quando: undefined }) : undefined}
        fonte={(q) => opzioniQuando(q)}
        onScegli={(o) => {
          onChange(o.applica(value));
          setAperto(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etichette
// ---------------------------------------------------------------------------

export function nomeBreveCircuito(d: DizionariJson, ref: string): string {
  const c = d.circuiti.find((x) => x.ref === ref);
  if (!c) return ref;
  // "Monza", "Spa", "Silverstone": la località di Ergast è il nome con cui
  // si chiama il circuito in telecronaca (il primo sinonimo della pipeline)
  return c.localita;
}

export function etichettaQuando(q: Quando): string {
  if (q.tipo === "anno") return `nel ${q.anno}`;
  if (q.tipo === "decennio") return `negli anni ${q.annoDa}`;
  const era = ERE.find((e) => e.annoDa === q.annoDa && e.annoA === q.annoA);
  return era ? `${era.etichetta.toLowerCase()} (${q.annoDa}–${q.annoA})` : `tra il ${q.annoDa} e il ${q.annoA}`;
}

export function etichettaFatto(c: FattoScelto): string {
  const f = fattoById(c.id);
  return f.etichetta(c.parametro ?? f.parametro?.default ?? 0);
}

// ---------------------------------------------------------------------------
// Opzioni per slot
// ---------------------------------------------------------------------------

// Ordina per rango (miglior corrispondenza prima) e butta via i non
// corrispondenti. Nessun tetto: la tendina scorre, e una scelta che non si
// vede è una scelta che non esiste.
function ordina<T extends { rango: number | null; o: Opzione }>(xs: T[]): Opzione[] {
  return xs
    .filter((x): x is T & { rango: number } => x.rango !== null)
    .sort((a, b) => a.rango - b.rango)
    .map((x) => x.o);
}

// Un gruppo lungo si mostra accorciato con in fondo una riga "mostra tutti";
// una volta espanso resta espanso finché la tendina è aperta.
function conAnteprima(righe: Opzione[], chiaveGruppo: string, espansi: string[], tutti: string): Opzione[] {
  if (espansi.includes(chiaveGruppo) || righe.length <= ANTEPRIMA + 1) return righe;
  const gruppo = righe[0]?.gruppo;
  return [
    ...righe.slice(0, ANTEPRIMA),
    { chiave: `piu-${chiaveGruppo}`, titolo: tutti.replace("N", String(righe.length)), gruppo, espandi: chiaveGruppo },
  ];
}

function opzioniChi(d: DizionariJson, q: string, { espansi }: StatoMenu): Menu {
  const nq = normalizza(q.trim());
  // I dizionari sono già ordinati per anno di ultima attività e numero di
  // gare: a parità di rango, "hamilton" dà Lewis prima di Duncan. Espanso,
  // invece, l'elenco va in ordine alfabetico: si scorre per cercare un nome,
  // non per vedere chi ha corso di più.
  const rigaPilota = (p: DizionariJson["piloti"][number]) => ({
    chiave: `p${p.id}`,
    titolo: p.nome,
    gruppo: "Piloti",
    dettaglio: `${p.gp} GP, ${p.annoDa}–${p.annoA}`,
    applica: (s: Situazione): Situazione => ({ ...s, chi: { tipo: "pilota", driverId: p.id } satisfies Chi }),
  });
  const rigaTeam = (t: DizionariJson["team"][number]) => ({
    chiave: `t${t.id}`,
    titolo: t.nome,
    gruppo: "Team",
    dettaglio: `${t.annoDa}–${t.annoA}`,
    applica: (s: Situazione): Situazione => ({ ...s, chi: { tipo: "team", constructorId: t.id } satisfies Chi }),
  });

  if (nq === "") {
    const piloti = espansi.includes("piloti")
      ? [...d.piloti].sort((a, b) => a.cognome.localeCompare(b.cognome, "it")).map(rigaPilota)
      : d.piloti.map(rigaPilota);
    const team = espansi.includes("team")
      ? [...d.team].sort((a, b) => a.nome.localeCompare(b.nome, "it")).map(rigaTeam)
      : d.team.map(rigaTeam);
    return {
      righe: [
        ...conAnteprima(piloti, "piloti", espansi, "Mostra tutti gli N piloti"),
        ...conAnteprima(team, "team", espansi, "Mostra tutti gli N team"),
      ],
      segnaposto: "cerca un pilota o un team…",
    };
  }

  const piloti = ordina(d.piloti.map((p) => ({ rango: punteggio(`${p.nome} ${p.codice ?? ""}`, nq), o: rigaPilota(p) })));
  const team = ordina(d.team.map((t) => ({ rango: punteggio(t.nome, nq), o: rigaTeam(t) })));
  return {
    righe: [
      ...conAnteprima(piloti, "piloti", espansi, "Mostra tutti gli N piloti trovati"),
      ...conAnteprima(team, "team", espansi, "Mostra tutti gli N team trovati"),
    ],
    segnaposto: "cerca un pilota o un team…",
  };
}

function opzioniDove(d: DizionariJson, q: string): Menu {
  const nq = normalizza(q.trim());
  // 77 circuiti e 35 paesi si scorrono tutti: niente tetto, solo due
  // intestazioni. A campo vuoto i circuiti restano in ordine di quante gare
  // hanno ospitato (Monza, Monaco, Silverstone in cima), che è l'ordine in
  // cui un telecronista se li aspetta.
  const circuiti = d.circuiti.map((c) => ({
    rango: punteggio(`${c.sinonimi.join(" ")} ${c.nome} ${paeseIt(c.paese)}`, nq),
    o: {
      chiave: `c${c.ref}`,
      titolo: c.nome,
      gruppo: "Circuiti",
      dettaglio: `${c.localita}, ${paeseIt(c.paese)} · ${c.gare} gare, ${c.annoDa}–${c.annoA}`,
      applica: (s: Situazione): Situazione => ({ ...s, dove: { tipo: "circuito", circuitRef: c.ref } satisfies Dove }),
    },
  }));
  const paesi = Array.from(new Set(d.circuiti.map((c) => c.paese)))
    .sort((a, b) => paeseIt(a).localeCompare(paeseIt(b), "it"))
    .map((p) => ({
      rango: punteggio(paeseIt(p), nq),
      o: {
        chiave: `n${p}`,
        titolo: paeseIt(p),
        gruppo: "Paesi",
        dettaglio: `${d.circuiti.filter((c) => c.paese === p).length} circuiti`,
        applica: (s: Situazione): Situazione => ({ ...s, dove: { tipo: "paese", paese: p } satisfies Dove }),
      },
    }));
  return { righe: [...ordina(circuiti), ...ordina(paesi)], segnaposto: "cerca un circuito o un paese…" };
}

function opzioniQuando(q: string): Menu {
  const nq = normalizza(q.trim());
  const ere = ERE.map((e) => ({
    rango: punteggio(`${e.etichetta} ${e.annoDa}`, nq),
    o: {
      chiave: `e${e.annoDa}`,
      titolo: e.etichetta,
      gruppo: "Ere",
      dettaglio: `${e.annoDa}–${e.annoA}`,
      applica: (s: Situazione): Situazione => ({ ...s, quando: { tipo: "era", annoDa: e.annoDa, annoA: e.annoA } }),
    },
  }));
  const decenni: { rango: number | null; o: Opzione }[] = [];
  for (let d = 2020; d >= 1950; d -= 10) {
    decenni.push({
      rango: punteggio(`anni ${d} ${d}`, nq),
      o: {
        chiave: `d${d}`,
        titolo: `Anni ${d}`,
        gruppo: "Decenni",
        dettaglio: `${d}–${Math.min(d + 9, 2024)}`,
        applica: (s: Situazione): Situazione => ({ ...s, quando: { tipo: "decennio", annoDa: d } }),
      },
    });
  }
  // tutte e 75 le stagioni, dalla più recente: sono l'elenco più lungo dello
  // slot ma scorrerle è immediato, e chi cerca un anno preciso lo digita
  const anni: { rango: number | null; o: Opzione }[] = [];
  for (let a = 2024; a >= 1950; a--) {
    anni.push({
      rango: punteggio(String(a), nq),
      o: {
        chiave: `a${a}`,
        titolo: String(a),
        gruppo: "Stagioni",
        applica: (s: Situazione): Situazione => ({ ...s, quando: { tipo: "anno", anno: a } }),
      },
    });
  }
  return { righe: [...ordina(ere), ...ordina(decenni), ...ordina(anni)], segnaposto: "anno, decennio o era…" };
}

// L'etichetta di un fatto parametrico con la VARIABILE al posto del numero:
// "partito P° o peggio", non "partito 5°". Nella tendina un numero già
// scritto si legge come parte del fatto — "5°" sembra una posizione scelta
// da noi, e per giunta anonima — e non lascia capire che è la cosa che
// l'utente cambierà appena scelto il fatto.
//
// Dove sta il numero dentro la frase non è dichiarato da nessuna parte:
// l'etichetta è una funzione, quindi lo si trova provandola. Si parte dal
// default; se lì il numero si dice a parole (`almeno_n_neutralizzazioni` a 1
// → "con almeno UNA Safety Car o VSC") si prova il valore successivo finché
// la cifra non compare davvero nel testo. Il risultato si tiene in cache: i
// fatti sono 48 e le etichette non cambiano mai.
const CACHE_VARIABILE = new Map<string, Opzione["variabile"]>();

function etichettaVariabile(f: Fatto): Opzione["variabile"] {
  if (!f.parametro) return undefined;
  if (CACHE_VARIABILE.has(f.id)) return CACHE_VARIABILE.get(f.id);
  const spec = f.parametro;
  let trovata: Opzione["variabile"];
  for (let v = spec.default; v <= spec.max && trovata === undefined; v++) {
    const testo = f.etichetta(v);
    const at = testo.indexOf(String(v));
    if (at >= 0) trovata = { prima: testo.slice(0, at), nome: spec.nome, dopo: testo.slice(at + String(v).length) };
  }
  CACHE_VARIABILE.set(f.id, trovata);
  return trovata;
}

// Lo slot "Cosa" ha 48 fatti: la tendina si apre sulle nove famiglie e
// scende dentro quella scelta. Appena si scrive, però, i due livelli
// spariscono e si cerca in tutto il vocabolario: chi sa già la parola non
// deve indovinare in che famiglia sta.
function opzioniCosa(q: string, giaScelti: string[], { dentro }: StatoMenu): Menu {
  const nq = normalizza(q.trim());
  const libero = (f: Fatto) => !giaScelti.includes(f.id);
  const etichettaGruppo = (g: GruppoFatto) => GRUPPI_FATTI.find((x) => x.id === g)!.etichetta;
  const riga = (f: Fatto): Opzione => ({
    chiave: f.id,
    titolo: f.etichetta(f.parametro?.default ?? 0),
    variabile: etichettaVariabile(f),
    gruppo: etichettaGruppo(f.gruppo),
    // "parametro P" a destra non serve più: la variabile è nella frase
    dettaglio: f.unita === "gara" ? "sulla gara" : undefined,
    applica: (s: Situazione): Situazione => ({ ...s, cosa: [...s.cosa, { id: f.id, parametro: f.parametro?.default }] }),
  });

  if (nq !== "") {
    const trovati = ordina(
      FATTI.filter(libero).map((f) => ({ rango: punteggio(`${f.etichetta(f.parametro?.default ?? 0)} ${f.sinonimi.join(" ")}`, nq), o: riga(f) }))
    );
    // in ricerca le righe si ordinano per corrispondenza, ma restano
    // etichettate con la famiglia: si impara dove stanno le cose
    return { righe: trovati, titolo: dentro ? "Cerca in tutti i fatti" : undefined, segnaposto: SEGNAPOSTO_COSA };
  }

  if (dentro) {
    const g = GRUPPI_FATTI.find((x) => x.id === dentro)!;
    // dentro una famiglia il nome sta già nell'intestazione del pannello:
    // ripeterlo anche come intestazione di gruppo sarebbe due volte la
    // stessa parola a due righe di distanza
    const righe = FATTI.filter((f) => f.gruppo === dentro && libero(f)).map((f) => ({ ...riga(f), gruppo: undefined }));
    return { righe, titolo: g.etichetta, segnaposto: SEGNAPOSTO_COSA };
  }

  return {
    righe: GRUPPI_FATTI.map((g) => {
      const n = FATTI.filter((f) => f.gruppo === g.id && libero(f)).length;
      return {
        chiave: `g${g.id}`,
        titolo: g.etichetta,
        sotto: g.sommario,
        dettaglio: `${n} ${n === 1 ? "fatto" : "fatti"}`,
        entra: g.id,
      } satisfies Opzione;
    }).filter((o) => !o.dettaglio.startsWith("0 ")),
    segnaposto: SEGNAPOSTO_COSA,
  };
}

const SEGNAPOSTO_COSA = "vince, podio, ritiro, pole, soste…";

// ---------------------------------------------------------------------------
// Chiusura della tendina: clic fuori, fuoco che se ne va, Esc
// ---------------------------------------------------------------------------

// Restituisce il ref da mettere sul contenitore dello slot (bottone che apre
// + tendina). Finché la tendina è aperta, un `pointerdown` fuori da quel
// contenitore la chiude.
//
// Perché `pointerdown` in fase di CATTURA e non `click`: le opzioni della
// tendina si scelgono con `mousedown` + preventDefault (per non perdere il
// fuoco dall'input di ricerca), quindi un handler su `click` arriverebbe
// dopo la scelta e in ritardo. E perché il contenitore include il bottone
// che apre: senza, un clic sul bottone mentre la tendina è aperta la
// chiuderebbe da "fuori" e il click subito dopo la riaprirebbe — il classico
// menu che non si chiude mai.
function useChiudiFuori<T extends HTMLElement>(aperto: boolean, onChiudi: () => void) {
  const ref = useRef<T | null>(null);
  // La callback arriva come arrow function nuova a ogni render del padre:
  // tenuta in un ref, l'effetto del listener non si riaggancia a ogni
  // render. Il ref si aggiorna in un effetto, non durante il render (il
  // compilatore React lo vieta, e a ragione: in render non è ancora detto
  // che quel valore sia quello che finirà sullo schermo).
  const cb = useRef(onChiudi);
  useEffect(() => {
    cb.current = onChiudi;
  });

  useEffect(() => {
    if (!aperto) return;
    const fuori = (e: PointerEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) cb.current();
    };
    document.addEventListener("pointerdown", fuori, true);
    return () => document.removeEventListener("pointerdown", fuori, true);
  }, [aperto]);

  return ref;
}

// ---------------------------------------------------------------------------
// SlotBox: uno slot a scelta singola (chi, dove, quando)
// ---------------------------------------------------------------------------

interface SlotBoxProps {
  slot: Slot;
  aperto: boolean;
  onApri: () => void;
  onChiudi: () => void;
  testo: string | null;
  vuoto: string;
  suggerimento: string;
  onSvuota?: () => void;
  fonte: FonteMenu;
  onScegli: (o: Scelta) => void;
}

function SlotBox({ slot, aperto, onApri, onChiudi, testo, vuoto, suggerimento, onSvuota, fonte, onScegli }: SlotBoxProps) {
  const colore = SLOT_COLORS[slot];
  const bottoneRef = useRef<HTMLButtonElement | null>(null);
  const contenitore = useChiudiFuori<HTMLDivElement>(aperto, onChiudi);

  // Chiusura da tastiera (Esc, o scelta fatta con Invio): il fuoco torna al
  // bottone che ha aperto la tendina, altrimenti finirebbe sul <body> e chi
  // naviga da tastiera perderebbe il posto nella frase.
  const chiudiEFocus = useCallback(() => {
    onChiudi();
    bottoneRef.current?.focus();
  }, [onChiudi]);

  return (
    <div
      ref={contenitore}
      className="relative min-w-[170px] flex-1 basis-[170px]"
      // Tab che porta il fuoco fuori dallo slot: la tendina si chiude, come
      // farebbe un clic fuori. relatedTarget null = fuoco perso del tutto.
      onBlur={(e) => {
        if (aperto && !e.currentTarget.contains(e.relatedTarget as Node | null)) onChiudi();
      }}
    >
      <button
        ref={bottoneRef}
        type="button"
        onClick={onApri}
        aria-expanded={aperto}
        aria-haspopup="listbox"
        className="w-full h-full text-left flex flex-col gap-1 px-3.5 py-2.5 bg-panel border border-graphite border-t-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white hover:border-neutral-gray transition-colors"
        style={{ borderTopColor: colore }}
      >
        <span className="font-condensed text-xs tracking-[0.14em] uppercase" style={{ color: colore }}>
          {SLOT_LABELS[slot]}
        </span>
        <span className={`font-condensed text-2xl leading-tight font-semibold ${testo ? "text-white" : "text-neutral-gray font-medium"}`}>
          {testo ?? vuoto}
        </span>
        <span className="text-xs text-neutral-gray">{suggerimento}</span>
      </button>
      {onSvuota && (
        <button
          type="button"
          aria-label={`Svuota ${SLOT_LABELS[slot]}`}
          onClick={onSvuota}
          className="absolute top-2 right-2 px-1.5 text-neutral-gray hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          ×
        </button>
      )}
      {aperto && <Tendina slot={slot} fonte={fonte} onScegli={onScegli} onChiudi={chiudiEFocus} />}
    </div>
  );
}

interface TendinaProps {
  slot: Slot;
  fonte: FonteMenu;
  onScegli: (o: Scelta) => void;
  onChiudi: () => void;
}

function Tendina({ slot, fonte, onScegli, onChiudi }: TendinaProps) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  // Due stati di navigazione dentro la tendina, che muoiono con lei: in
  // quale famiglia si è scesi ("Cosa") e quali gruppi sono stati allungati
  // con "mostra tutti" ("Chi").
  const [dentro, setDentro] = useState<GruppoFatto | null>(null);
  const [espansi, setEspansi] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const pannelloRef = useRef<HTMLDivElement>(null);
  const menu = useMemo(() => fonte(q, { dentro, espansi }), [fonte, q, dentro, espansi]);
  const lista = menu.righe;
  const i = Math.min(idx, Math.max(0, lista.length - 1));
  useEffect(() => inputRef.current?.focus(), []);

  // Risalire di un livello: dalla famiglia all'elenco delle famiglie. È la
  // stessa cosa che fanno il bottone "←", Esc e il Backspace a campo vuoto,
  // perché un menu a due passaggi senza un'uscita ovvia è una trappola.
  const risali = useCallback(() => {
    setDentro(null);
    setQ("");
    setIdx(0);
    inputRef.current?.focus();
  }, []);

  function scegli(o: Opzione) {
    if (o.entra) {
      setDentro(o.entra);
      setQ("");
      setIdx(0);
      inputRef.current?.focus();
      return;
    }
    if (o.espandi) {
      const espansiDopo = espansi.includes(o.espandi) ? espansi : [...espansi, o.espandi];
      setEspansi(espansiDopo);
      // Espandendo, il gruppo non si allunga in fondo: si riordina in
      // alfabetico, quindi l'indice di prima punterebbe a un nome a caso in
      // mezzo all'elenco. L'evidenza va in cima al gruppo appena aperto: la
      // lista nuova si ricalcola qui invece di aspettare il render, così non
      // serve un effetto che rincorra l'indice.
      const k = fonte(q, { dentro, espansi: espansiDopo }).righe.findIndex((r) => r.gruppo === o.gruppo);
      setIdx(Math.max(0, k));
      inputRef.current?.focus();
      return;
    }
    if (o.applica) onScegli(o as Scelta);
  }

  // Dove sta la tendina rispetto allo slot. Due misure, tutte e due prese
  // dallo SLOT (il contenitore del pannello) e non dal pannello: lo slot non
  // si muove quando la tendina cambia lato o altezza, quindi la misura non
  // può rincorrere sé stessa.
  //
  // - di lato: "Quando" è l'ultimo slot a destra e la tendina è larga 26rem,
  //   quindi ancorata a sinistra uscirebbe dallo schermo;
  // - in altezza: con elenchi lunghi (77 circuiti, 861 piloti) un'altezza
  //   fissa ancorata sotto lo slot finisce sotto il bordo della finestra, e
  //   le ultime voci si leggono solo scrollando la pagina — è il difetto
  //   segnalato. La tendina si alza fin dove c'è posto, e se sotto non ce
  //   n'è abbastanza si apre verso l'alto.
  const [aDestra, setADestra] = useState(false);
  const [inAlto, setInAlto] = useState(false);
  const [altezzaMax, setAltezzaMax] = useState(ALTEZZA_MAX);
  useLayoutEffect(() => {
    const misura = () => {
      const slot = pannelloRef.current?.parentElement;
      if (!slot) return;
      const r = slot.getBoundingClientRect();
      setADestra(r.left + LARGHEZZA_MIN > window.innerWidth - MARGINE);
      const sotto = window.innerHeight - r.bottom - MARGINE;
      const sopra = r.top - MARGINE;
      // verso l'alto solo se sotto si starebbe davvero stretti E sopra si sta
      // meglio: aprire in su è meno naturale, non va fatto per pochi pixel
      const su = sotto < ALTEZZA_MIN && sopra > sotto;
      setInAlto(su);
      setAltezzaMax(Math.max(ALTEZZA_MIN, Math.min(ALTEZZA_MAX, su ? sopra : sotto)));
    };
    misura();
    window.addEventListener("resize", misura);
    // scorrendo la pagina lo slot si muove e lo spazio libero cambia
    window.addEventListener("scroll", misura, true);
    return () => {
      window.removeEventListener("resize", misura);
      window.removeEventListener("scroll", misura, true);
    };
  }, []);

  // L'opzione evidenziata deve restare visibile anche quando si scende con
  // le frecce oltre il bordo della lista (ora la lista può essere lunga
  // quanto tutto il vocabolario).
  useEffect(() => {
    listaRef.current?.querySelector('[data-attivo="1"]')?.scrollIntoView({ block: "nearest" });
  }, [i, lista]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((k) => (lista.length ? (Math.min(k, lista.length - 1) + 1) % lista.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((k) => (lista.length ? (Math.min(k, lista.length - 1) - 1 + lista.length) % lista.length : 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setIdx(Math.max(0, lista.length - 1));
    } else if (e.key === "Enter") {
      if (lista[i]) {
        e.preventDefault();
        scegli(lista[i]);
      }
    } else if (e.key === "Backspace" && q === "" && dentro) {
      // campo di ricerca già vuoto: il Backspace non ha niente da cancellare
      // e vale come "torna indietro"
      e.preventDefault();
      risali();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (dentro) risali();
      else onChiudi();
    }
  }

  return (
    <div
      ref={pannelloRef}
      className={`absolute ${aDestra ? "right-0" : "left-0"} ${inAlto ? "bottom-full mb-1" : "top-full mt-1"} z-40 flex flex-col w-[min(26rem,90vw)] bg-panel border border-graphite shadow-xl`}
      style={{ maxHeight: altezzaMax }}
    >
      {menu.titolo && (
        <div className="shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-graphite">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              risali();
            }}
            className="px-1.5 text-neutral-gray hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Torna alle famiglie"
          >
            ←
          </button>
          <span className="font-condensed text-xs tracking-[0.14em] uppercase text-neutral-gray">{menu.titolo}</span>
        </div>
      )}
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setIdx(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={menu.segnaposto ?? "cerca…"}
        aria-label={`Cerca in ${SLOT_LABELS[slot]}`}
        role="combobox"
        aria-expanded="true"
        aria-controls={`tendina-${slot}`}
        aria-activedescendant={lista[i] ? `opz-${slot}-${i}` : undefined}
        autoComplete="off"
        className="shrink-0 w-full bg-graphite text-white px-3 py-2 text-sm outline-none border-b border-graphite focus:border-neutral-gray"
      />
      <ul ref={listaRef} id={`tendina-${slot}`} role="listbox" aria-label={SLOT_LABELS[slot]} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {lista.length === 0 && <li className="px-3 py-2 text-sm text-neutral-gray">Niente con questo nome.</li>}
        {lista.map((o, k) => (
          <Fragment key={o.chiave}>
            {/* Intestazione di gruppo: compare quando cambia il gruppo della
                riga. Resta appiccicata in alto mentre si scorre, così si sa
                sempre in che parte dell'elenco si è finiti. `presentation`
                perché non è una voce scegliibile del listbox. */}
            {o.gruppo && o.gruppo !== lista[k - 1]?.gruppo && (
              <li
                role="presentation"
                className="sticky top-0 z-10 bg-panel px-3 pt-2 pb-1 font-condensed text-xs tracking-[0.14em] uppercase text-neutral-gray border-b border-graphite"
              >
                {o.gruppo}
              </li>
            )}
            <li
              id={`opz-${slot}-${k}`}
              role="option"
              aria-selected={k === i}
              data-attivo={k === i ? "1" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                scegli(o);
              }}
              onMouseEnter={() => setIdx(k)}
              className={`px-3 py-1.5 cursor-pointer flex items-baseline justify-between gap-3 ${k === i ? "bg-graphite" : ""}`}
            >
              <span className="min-w-0">
                <span className={`text-sm ${o.espandi ? "text-neutral-gray" : "text-white"}`}>
                  {o.espandi && "↓ "}
                  {o.variabile ? (
                    <>
                      {o.variabile.prima}
                      <span
                        // niente padding: "partito P°" ha il grado attaccato
                        // alla variabile, come nello slot
                        className="font-condensed font-semibold border-b-2"
                        style={{ color: SLOT_COLORS.cosa, borderColor: SLOT_COLORS.cosa }}
                      >
                        {o.variabile.nome}
                      </span>
                      {o.variabile.dopo}
                    </>
                  ) : (
                    o.titolo
                  )}
                </span>
                {o.sotto && <span className="block text-xs text-neutral-gray">{o.sotto}</span>}
              </span>
              {o.dettaglio && <span className="text-xs text-neutral-gray text-right shrink-0">{o.dettaglio}</span>}
              {o.entra && <span className="text-neutral-gray shrink-0">›</span>}
            </li>
          </Fragment>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlotCosa: più fatti, ognuno con il suo parametro
// ---------------------------------------------------------------------------

interface SlotCosaProps {
  aperto: boolean;
  onApri: () => void;
  onChiudi: () => void;
  value: Situazione;
  onChange: (s: Situazione) => void;
  onScelto: () => void;
}

function SlotCosa({ aperto, onApri, onChiudi, value, onChange, onScelto }: SlotCosaProps) {
  const colore = SLOT_COLORS.cosa;
  const scelti = value.cosa;
  const bottoneRef = useRef<HTMLButtonElement | null>(null);
  const contenitore = useChiudiFuori<HTMLDivElement>(aperto, onChiudi);
  const chiudiEFocus = useCallback(() => {
    onChiudi();
    bottoneRef.current?.focus();
  }, [onChiudi]);
  const idScelti = useMemo(() => scelti.map((c) => c.id), [scelti]);
  const fonte = useMemo<FonteMenu>(() => (q, stato) => opzioniCosa(q, idScelti, stato), [idScelti]);

  function cambiaParametro(k: number, v: number) {
    onChange({ ...value, cosa: value.cosa.map((c, j) => (j === k ? { ...c, parametro: v } : c)) });
  }
  function togli(k: number) {
    onChange({ ...value, cosa: value.cosa.filter((_, j) => j !== k) });
  }

  return (
    <div
      ref={contenitore}
      className="relative flex-[2] basis-[300px] min-w-[260px]"
      onBlur={(e) => {
        if (aperto && !e.currentTarget.contains(e.relatedTarget as Node | null)) onChiudi();
      }}
    >
      <div
        className="h-full flex flex-col gap-1 px-3.5 py-2.5 bg-panel border border-graphite border-t-[3px]"
        style={{ borderTopColor: colore }}
      >
        <span className="font-condensed text-xs tracking-[0.14em] uppercase" style={{ color: colore }}>
          Cosa
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {scelti.map((c, k) => {
            const f = fattoById(c.id);
            return (
              <span key={`${c.id}-${k}`} className="inline-flex items-center gap-1 font-condensed text-2xl leading-tight font-semibold text-white">
                {k > 0 && <span className="text-neutral-gray font-medium text-lg mr-1">e</span>}
                {f.parametro ? (
                  <FattoConParametro fatto={f} valore={c.parametro ?? f.parametro.default} onChange={(v) => cambiaParametro(k, v)} />
                ) : (
                  f.etichetta(0)
                )}
                <button
                  type="button"
                  aria-label={`Togli ${etichettaFatto(c)}`}
                  onClick={() => togli(k)}
                  className="ml-0.5 text-base text-neutral-gray hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  ×
                </button>
              </span>
            );
          })}
          <button
            ref={bottoneRef}
            type="button"
            onClick={onApri}
            aria-expanded={aperto}
            aria-haspopup="listbox"
            className={`font-condensed leading-tight ${scelti.length ? "text-sm text-neutral-gray hover:text-white px-1.5 py-0.5 border border-graphite" : "text-2xl font-medium text-neutral-gray hover:text-white"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}
          >
            {scelti.length ? "+ e…" : "fa cosa?"}
          </button>
        </div>
        <span className="text-xs text-neutral-gray">{scelti.length ? `${scelti.length} ${scelti.length === 1 ? "fatto" : "fatti"}` : "vince, arriva 3°, si ritira, fa 2 soste…"}</span>
      </div>
      {aperto && (
        <Tendina
          slot="cosa"
          fonte={fonte}
          onScegli={(o) => {
            onChange(o.applica(value));
            onScelto();
          }}
          onChiudi={chiudiEFocus}
        />
      )}
    </div>
  );
}

// L'etichetta di un fatto parametrico, con il numero modificabile in
// linea: "partito [10]° o peggio".
//
// Tre etichette del catalogo NON contengono la cifra, perché a quel valore
// il numero si dice a parole (verificato sui 45 fatti: `soste` a 0 →
// "senza fermarsi", `ritiro_entro_giro` a 0 → "si ritira al via",
// `almeno_n_neutralizzazioni` a 1 → "con almeno una Safety Car o VSC").
// Lì il campo non può stare "dentro" la frase: finiva appiccicato in fondo
// e sembrava un errore. In quel caso il campo si mostra staccato, dopo il
// nome del parametro in piccolo, così si legge come un comando e non come
// un refuso.
function FattoConParametro({ fatto, valore, onChange }: { fatto: Fatto; valore: number; onChange: (v: number) => void }) {
  const spec = fatto.parametro!;
  const testo = fatto.etichetta(valore);
  const num = String(valore);
  const at = testo.indexOf(num);
  const inLinea = at >= 0;
  const prima = inLinea ? testo.slice(0, at) : testo;
  const dopo = inLinea ? testo.slice(at + num.length) : "";

  // Bozza di testo mentre si digita: senza, cancellare il campo lo
  // rimandava di colpo al minimo (Number("") è 0, che viene poi alzato a
  // `min`) e diventava impossibile svuotarlo per riscrivere due cifre.
  // Il valore esce solo quando è un numero dentro i limiti; all'uscita dal
  // campo la bozza si scarta e torna il valore vero.
  const [bozza, setBozza] = useState<string | null>(null);
  const mostrato = bozza ?? num;

  return (
    <span className="inline-flex items-baseline">
      {prima}
      {!inLinea && <span className="ml-1.5 mr-0.5 text-xs font-medium uppercase tracking-wider text-neutral-gray">{spec.nome}</span>}
      <input
        type="number"
        value={mostrato}
        min={spec.min}
        max={spec.max}
        step={spec.tipo === "secondi" ? 0.5 : 1}
        inputMode="decimal"
        aria-label={`${spec.nome} di ${fatto.etichetta(spec.default)}`}
        onChange={(e) => {
          const testoDigitato = e.target.value;
          setBozza(testoDigitato);
          const v = Number(testoDigitato);
          if (testoDigitato !== "" && !Number.isNaN(v) && v >= spec.min && v <= spec.max) onChange(v);
        }}
        onBlur={() => {
          const v = Number(bozza);
          if (bozza !== null && bozza !== "" && !Number.isNaN(v)) onChange(Math.min(spec.max, Math.max(spec.min, v)));
          setBozza(null);
        }}
        // La rotellina sopra un campo numerico a fuoco ne cambia il valore:
        // scorrendo la pagina si sarebbe cambiata la domanda senza volerlo.
        onWheel={(e) => e.currentTarget.blur()}
        // Frecce su/giù restano al campo (incremento), ma Invio e Esc non
        // devono restare intrappolati qui.
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
        }}
        // stesso colore della variabile nella tendina ("partito P° o
        // peggio"): la P gialla che si è scelti è diventata questo campo
        className="mx-0.5 bg-graphite text-center font-condensed text-2xl font-semibold border-b-2 outline-none focus:bg-neutral-gray/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        style={{ color: SLOT_COLORS.cosa, borderColor: SLOT_COLORS.cosa, width: `${Math.max(2, mostrato.length) + 0.9}ch` }}
      />
      {dopo}
    </span>
  );
}
