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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SLOT_COLORS, SLOT_LABELS, type Slot } from "@/lib/colors";
import { FATTI, fattoById, type Fatto } from "@/lib/situazioni/fatti";
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

interface Opzione {
  chiave: string;
  titolo: string;
  dettaglio?: string;
  applica: (s: Situazione) => Situazione;
}

const MAX_OPZIONI = 12;

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
        opzioni={(q) => opzioniChi(dizionari, q)}
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
        opzioni={(q) => opzioniDove(dizionari, q)}
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
        opzioni={(q) => opzioniQuando(q)}
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

function ordina<T extends { rango: number | null; o: Opzione }>(xs: T[]): Opzione[] {
  return xs
    .filter((x): x is T & { rango: number } => x.rango !== null)
    .sort((a, b) => a.rango - b.rango)
    .slice(0, MAX_OPZIONI)
    .map((x) => x.o);
}

function opzioniChi(d: DizionariJson, q: string): Opzione[] {
  const nq = normalizza(q.trim());
  // I dizionari sono già ordinati per anno di ultima attività e numero di
  // gare: a parità di rango, "hamilton" dà Lewis prima di Duncan.
  const piloti = d.piloti.map((p) => ({
    rango: punteggio(`${p.nome} ${p.codice ?? ""}`, nq),
    o: {
      chiave: `p${p.id}`,
      titolo: p.nome,
      dettaglio: `pilota · ${p.gp} GP, ${p.annoDa}–${p.annoA}`,
      applica: (s: Situazione): Situazione => ({ ...s, chi: { tipo: "pilota", driverId: p.id } satisfies Chi }),
    },
  }));
  const team = d.team.map((t) => ({
    rango: punteggio(t.nome, nq),
    o: {
      chiave: `t${t.id}`,
      titolo: t.nome,
      dettaglio: `team · ${t.annoDa}–${t.annoA}`,
      applica: (s: Situazione): Situazione => ({ ...s, chi: { tipo: "team", constructorId: t.id } satisfies Chi }),
    },
  }));
  // a campo vuoto: i piloti recenti; con testo: piloti e team insieme
  if (nq === "") return piloti.slice(0, MAX_OPZIONI).map((x) => x.o);
  return ordina([...piloti, ...team]);
}

function opzioniDove(d: DizionariJson, q: string): Opzione[] {
  const nq = normalizza(q.trim());
  const circuiti = d.circuiti.map((c) => ({
    rango: punteggio(`${c.sinonimi.join(" ")} ${c.nome} ${paeseIt(c.paese)}`, nq),
    o: {
      chiave: `c${c.ref}`,
      titolo: c.nome,
      dettaglio: `${c.localita}, ${paeseIt(c.paese)} · ${c.gare} gare, ${c.annoDa}–${c.annoA}`,
      applica: (s: Situazione): Situazione => ({ ...s, dove: { tipo: "circuito", circuitRef: c.ref } satisfies Dove }),
    },
  }));
  const paesi = Array.from(new Set(d.circuiti.map((c) => c.paese))).map((p) => ({
    rango: punteggio(paeseIt(p), nq),
    o: {
      chiave: `n${p}`,
      titolo: paeseIt(p),
      dettaglio: `paese · ${d.circuiti.filter((c) => c.paese === p).length} circuiti`,
      applica: (s: Situazione): Situazione => ({ ...s, dove: { tipo: "paese", paese: p } satisfies Dove }),
    },
  }));
  if (nq === "") return circuiti.slice(0, MAX_OPZIONI).map((x) => x.o);
  return ordina([...circuiti, ...paesi]);
}

function opzioniQuando(q: string): Opzione[] {
  const nq = normalizza(q.trim());
  const anni: { rango: number | null; o: Opzione }[] = [];
  for (let a = 2024; a >= 1950; a--) {
    anni.push({
      rango: punteggio(String(a), nq),
      o: { chiave: `a${a}`, titolo: String(a), dettaglio: "stagione", applica: (s) => ({ ...s, quando: { tipo: "anno", anno: a } }) },
    });
  }
  const decenni: { rango: number | null; o: Opzione }[] = [];
  for (let d = 2020; d >= 1950; d -= 10) {
    decenni.push({
      rango: punteggio(`anni ${d} ${d}`, nq),
      o: { chiave: `d${d}`, titolo: `Anni ${d}`, dettaglio: `${d}–${Math.min(d + 9, 2024)}`, applica: (s) => ({ ...s, quando: { tipo: "decennio", annoDa: d } }) },
    });
  }
  const ere = ERE.map((e) => ({
    rango: punteggio(`${e.etichetta} ${e.annoDa}`, nq),
    o: {
      chiave: `e${e.annoDa}`,
      titolo: e.etichetta,
      dettaglio: `${e.annoDa}–${e.annoA}`,
      applica: (s: Situazione): Situazione => ({ ...s, quando: { tipo: "era", annoDa: e.annoDa, annoA: e.annoA } }),
    },
  }));
  if (nq === "") return [...ere.slice(0, 3), ...decenni.slice(0, 4), ...anni.slice(0, 5)].map((x) => x.o);
  return ordina([...anni, ...decenni, ...ere]);
}

function opzioniFatti(q: string, giaScelti: string[]): { fatto: Fatto; rango: number }[] {
  const nq = normalizza(q.trim());
  return FATTI.filter((f) => !giaScelti.includes(f.id))
    .map((f) => ({ fatto: f, rango: punteggio(`${f.etichetta(f.parametro?.default ?? 0)} ${f.sinonimi.join(" ")}`, nq) }))
    .filter((x): x is { fatto: Fatto; rango: number } => x.rango !== null)
    .sort((a, b) => a.rango - b.rango)
    .slice(0, MAX_OPZIONI);
}

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
  opzioni: (q: string) => Opzione[];
  onScegli: (o: Opzione) => void;
}

function SlotBox({ slot, aperto, onApri, onChiudi, testo, vuoto, suggerimento, onSvuota, opzioni, onScegli }: SlotBoxProps) {
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
      {aperto && <Tendina slot={slot} opzioni={opzioni} onScegli={onScegli} onChiudi={chiudiEFocus} />}
    </div>
  );
}

interface TendinaProps {
  slot: Slot;
  opzioni: (q: string) => Opzione[];
  onScegli: (o: Opzione) => void;
  onChiudi: () => void;
  segnaposto?: string;
}

function Tendina({ slot, opzioni, onScegli, onChiudi, segnaposto = "cerca…" }: TendinaProps) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const pannelloRef = useRef<HTMLDivElement>(null);
  const lista = useMemo(() => opzioni(q), [opzioni, q]);
  const i = Math.min(idx, Math.max(0, lista.length - 1));
  useEffect(() => inputRef.current?.focus(), []);

  // L'ultimo slot della frase ("Quando") sta a destra: una tendina larga
  // 26rem ancorata a sinistra gli uscirebbe dallo schermo. Si misura dopo
  // il primo disegno e, se sborda, si ancora a destra.
  const [aDestra, setADestra] = useState(false);
  useLayoutEffect(() => {
    const misura = () => {
      const el = pannelloRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Con la tendina già ancorata a destra si controlla il bordo opposto,
      // per non rimbalzare avanti e indietro a ogni misura.
      setADestra((prima) => (prima ? r.left < 8 ? false : true : r.right > window.innerWidth - 8));
    };
    misura();
    window.addEventListener("resize", misura);
    return () => window.removeEventListener("resize", misura);
  }, []);

  // L'opzione evidenziata deve restare visibile anche quando si scende con
  // le frecce oltre il bordo della lista (max-h-72, fino a 12 voci).
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
        onScegli(lista[i]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onChiudi();
    }
  }

  return (
    <div
      ref={pannelloRef}
      className={`absolute ${aDestra ? "right-0" : "left-0"} top-full mt-1 z-40 w-[min(26rem,90vw)] bg-panel border border-graphite shadow-xl`}
    >
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setIdx(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={segnaposto}
        aria-label={`Cerca in ${SLOT_LABELS[slot]}`}
        role="combobox"
        aria-expanded="true"
        aria-controls={`tendina-${slot}`}
        aria-activedescendant={lista[i] ? `opz-${slot}-${i}` : undefined}
        autoComplete="off"
        className="w-full bg-graphite text-white px-3 py-2 text-sm outline-none border-b border-graphite focus:border-neutral-gray"
      />
      <ul ref={listaRef} id={`tendina-${slot}`} role="listbox" aria-label={SLOT_LABELS[slot]} className="max-h-72 overflow-y-auto">
        {lista.length === 0 && <li className="px-3 py-2 text-sm text-neutral-gray">Niente con questo nome.</li>}
        {lista.map((o, k) => (
          <li
            key={o.chiave}
            id={`opz-${slot}-${k}`}
            role="option"
            aria-selected={k === i}
            data-attivo={k === i ? "1" : undefined}
            onMouseDown={(e) => {
              e.preventDefault();
              onScegli(o);
            }}
            onMouseEnter={() => setIdx(k)}
            className={`px-3 py-1.5 cursor-pointer flex items-baseline justify-between gap-3 ${k === i ? "bg-graphite" : ""}`}
          >
            <span className="text-sm text-white">{o.titolo}</span>
            {o.dettaglio && <span className="text-xs text-neutral-gray text-right shrink-0">{o.dettaglio}</span>}
          </li>
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
  const opzioni = useMemo(
    () => (q: string): Opzione[] =>
      opzioniFatti(q, scelti.map((c) => c.id)).map(({ fatto }) => ({
        chiave: fatto.id,
        titolo: fatto.etichetta(fatto.parametro?.default ?? 0),
        dettaglio: fatto.unita === "gara" ? "fatto sulla gara" : fatto.parametro ? `parametro ${fatto.parametro.nome}` : undefined,
        applica: (s: Situazione): Situazione => ({ ...s, cosa: [...s.cosa, { id: fatto.id, parametro: fatto.parametro?.default }] }),
      })),
    [scelti]
  );

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
          opzioni={opzioni}
          segnaposto="vince, podio, ritiro, pole, soste…"
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
        className="mx-0.5 bg-graphite text-white text-center font-condensed text-2xl font-semibold border-b-2 outline-none focus:bg-neutral-gray/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        style={{ borderColor: SLOT_COLORS.cosa, width: `${Math.max(2, mostrato.length) + 0.9}ch` }}
      />
      {dopo}
    </span>
  );
}
