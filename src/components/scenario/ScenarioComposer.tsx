"use client";

// Il compositore di scenari (roadmap S, fase S2.2, docs/ROADMAP-6.md): la
// barra di ricerca che cerca INSIEME sui cinque tipi di chip — eventi,
// piloti, team, circuiti, ere — con i risultati raggruppati per tipo.
//
// Perché la barra e non solo il menu di S2.1: in diretta tre livelli di
// menu sono troppi. Chi sa cosa cerca digita; il menu a macro-aree resta
// raggiungibile da qui (bottone "Sfoglia per famiglia") come modo di
// SCOPRIRE cosa si può chiedere.
//
// Tutto navigabile da tastiera, perché è lo scenario d'uso dichiarato (un
// telecronista con pochi secondi, che non prende il mouse): frecce su/giù
// tra i risultati, invio per scegliere, backspace su input vuoto per
// togliere l'ultimo chip, Esc per chiudere la tendina.
//
// Qui NON si disegnano i risultati del match: è la fase S3 (lo scaffale
// delle corrispondenze). Per ora c'è solo una riga di testo provvisoria con
// quanti risultati escono per ogni livello della cascata.
//
// HTML/CSS puro, niente D3: non ci sono scale né assi da disegnare (stessa
// motivazione già accettata per EventCardsGrid e per EventPicker).

import { useEffect, useMemo, useRef, useState } from "react";
import EventPicker from "./EventPicker";
import ScaffaleCorrispondenze from "@/components/charts/ScaffaleCorrispondenze";
import { familyColor } from "@/lib/colors";
import {
  dedupeToDefaultParams,
  formatParameterValue,
  formatRarityPercent,
  formatWindow,
  parameterSuffix,
  type CatalogEventEntry,
} from "@/lib/eventCatalog";
import {
  decodeScenarioIndex,
  matchScenario,
  type Chip,
  type CompactScenarioIndex,
  type EventoChip,
} from "@/lib/scenarioEngine";

export interface SoggettiRicerca {
  piloti: { driverId: number; nome: string }[];
  team: { constructorId: number; nome: string }[];
  circuiti: { circuitRef: string; nome: string }[];
}

interface Props {
  catalog: CatalogEventEntry[];
  indiceCompatto: CompactScenarioIndex;
  soggetti: SoggettiRicerca;
}

type TipoChip = Chip["tipo"];

interface Suggerimento {
  chiave: string;
  tipo: TipoChip;
  titolo: string;
  dettaglio: string;
  colore?: string; // solo gli eventi hanno un colore: è la famiglia (regola d'oro del progetto)
  chip: Chip;
}

const ETICHETTE_TIPO: Record<TipoChip, string> = {
  evento: "Eventi",
  pilota: "Piloti",
  team: "Team",
  circuito: "Circuiti",
  era: "Ere",
};

const ORDINE_TIPI: TipoChip[] = ["evento", "pilota", "team", "circuito", "era"];
const MAX_PER_TIPO = 5;

// Il confronto ignora accenti e maiuscole: "raikkonen" deve trovare
// "Räikkönen" — chi ha fretta non cerca il tasto giusto.
function normalizza(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Chi digita ha in mente l'inizio di una parola, non una sottostringa a
// caso: "ham" deve dare Hamilton prima di "Graham Hill".
function punteggio(testo: string, q: string): number | null {
  const t = normalizza(testo);
  if (t.startsWith(q)) return 0;
  const parole = t.split(/[^a-z0-9]+/);
  if (parole.some((p) => p.startsWith(q))) return 1;
  return t.includes(q) ? 2 : null;
}

function chipEvento(entry: CatalogEventEntry): EventoChip {
  return {
    id: `evento:${entry.eventId}:${JSON.stringify(entry.parametri)}`,
    label: `${entry.nome}${parameterSuffix(entry)}`,
    tipo: "evento",
    eventId: entry.eventId,
    parametri: entry.parametri,
  };
}

// I decenni: l'unica forma di "era" prevista dalla roadmap. L'ultimo si
// ferma al 2024, la fine della copertura dei dati.
const ERE = Array.from({ length: 8 }, (_, i) => {
  const annoDa = 1950 + i * 10;
  const annoA = Math.min(annoDa + 9, 2024);
  return { annoDa, annoA, label: `Anni ${annoDa}` };
});

export default function ScenarioComposer({ catalog, indiceCompatto, soggetti }: Props) {
  const [chips, setChips] = useState<Chip[]>([]);
  const [query, setQuery] = useState("");
  const [evidenziato, setEvidenziato] = useState(0);
  const [menuAperto, setMenuAperto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  // La decodifica dell'indice compatto costa una volta sola: da lì in poi
  // il match è in memoria, ed è il motivo per cui l'indice è al client
  // (S2.2) invece che dietro una richiesta al server.
  const indice = useMemo(() => decodeScenarioIndex(indiceCompatto), [indiceCompatto]);
  const eventiDefault = useMemo(() => dedupeToDefaultParams(catalog), [catalog]);

  const idsPresenti = useMemo(() => new Set(chips.map((c) => c.id)), [chips]);

  // circuitRef → nome leggibile, per il tooltip dello scaffale (S3.1).
  const nomiCircuiti = useMemo(
    () => Object.fromEntries(soggetti.circuiti.map((c) => [c.circuitRef, c.nome])),
    [soggetti.circuiti]
  );

  const suggerimenti = useMemo<Suggerimento[]>(() => {
    const q = normalizza(query.trim());
    if (q.length === 0) return [];

    const perTipo = new Map<TipoChip, { s: Suggerimento; rank: number }[]>();
    const aggiungi = (tipo: TipoChip, rank: number | null, s: Suggerimento) => {
      if (rank === null || idsPresenti.has(s.chip.id)) return;
      const lista = perTipo.get(tipo) ?? [];
      lista.push({ s, rank });
      perTipo.set(tipo, lista);
    };

    // Eventi: si cerca sulla variante di default (come nel menu di S2.1) —
    // il parametro si cambia dopo, sul chip stesso.
    for (const entry of eventiDefault) {
      const chip = chipEvento(entry);
      // Si cerca anche sull'eventId: i nomi in chiaro sono lunghi ("Vittoria
      // partendo dalla N° posizione o peggio") e chi conosce il catalogo
      // digita "vittoria_da_griglia".
      aggiungi("evento", punteggio(`${entry.nome} ${entry.descrizione} ${entry.eventId.replace(/_/g, " ")}`, q), {
        chiave: chip.id,
        tipo: "evento",
        titolo: entry.nome,
        dettaglio: `${formatRarityPercent(entry.rarita)} · Finestra ${formatWindow(entry)}`,
        colore: familyColor(entry.famiglia),
        chip,
      });
    }

    for (const p of soggetti.piloti) {
      aggiungi("pilota", punteggio(p.nome, q), {
        chiave: `pilota:${p.driverId}`,
        tipo: "pilota",
        titolo: p.nome,
        dettaglio: "Pilota",
        chip: { id: `pilota:${p.driverId}`, label: p.nome, tipo: "pilota", driverId: p.driverId },
      });
    }

    for (const t of soggetti.team) {
      aggiungi("team", punteggio(t.nome, q), {
        chiave: `team:${t.constructorId}`,
        tipo: "team",
        titolo: t.nome,
        dettaglio: "Team",
        chip: { id: `team:${t.constructorId}`, label: t.nome, tipo: "team", constructorId: t.constructorId },
      });
    }

    for (const c of soggetti.circuiti) {
      aggiungi("circuito", punteggio(`${c.nome} ${c.circuitRef}`, q), {
        chiave: `circuito:${c.circuitRef}`,
        tipo: "circuito",
        titolo: c.nome,
        dettaglio: "Circuito",
        chip: { id: `circuito:${c.circuitRef}`, label: c.nome, tipo: "circuito", circuitRef: c.circuitRef },
      });
    }

    for (const e of ERE) {
      aggiungi("era", punteggio(`${e.label} ${e.annoDa} ${e.annoA}`, q), {
        chiave: `era:${e.annoDa}`,
        tipo: "era",
        titolo: e.label,
        dettaglio: `${e.annoDa}-${e.annoA}`,
        chip: { id: `era:${e.annoDa}`, label: e.label, tipo: "era", annoDa: e.annoDa, annoA: e.annoA },
      });
    }

    // Raggruppati per tipo, nell'ordine dichiarato: la lista piatta che
    // segue è quella su cui si muovono le frecce.
    return ORDINE_TIPI.flatMap((tipo) =>
      (perTipo.get(tipo) ?? [])
        .sort((a, b) => a.rank - b.rank || a.s.titolo.localeCompare(b.s.titolo))
        .slice(0, MAX_PER_TIPO)
        .map((x) => x.s)
    );
  }, [query, eventiDefault, soggetti, idsPresenti]);

  // L'evidenziazione si azzera a ogni digitazione (nell'onChange, non in un
  // effetto), ma la lista può accorciarsi anche per altri motivi — es. un
  // chip appena scelto sparisce dai suggerimenti: l'indice va tenuto dentro
  // i bordi qui, dove si legge.
  const idxEvidenziato = Math.min(evidenziato, Math.max(0, suggerimenti.length - 1));

  // La riga evidenziata deve restare visibile anche quando si scende con le
  // frecce oltre il bordo della tendina.
  useEffect(() => {
    listaRef.current?.querySelector('[data-evidenziato="1"]')?.scrollIntoView({ block: "nearest" });
  }, [idxEvidenziato, suggerimenti]);

  const risultato = useMemo(() => (chips.length > 0 ? matchScenario(indice, chips) : null), [indice, chips]);

  function aggiungiChip(chip: Chip) {
    setChips((prev) => (prev.some((c) => c.id === chip.id) ? prev : [...prev, chip]));
    setQuery("");
    setEvidenziato(0);
    inputRef.current?.focus();
  }

  function rimuoviChip(id: string) {
    setChips((prev) => prev.filter((c) => c.id !== id));
    inputRef.current?.focus();
  }

  // Cambiare il parametro di un chip evento non è "toglierlo e rimetterlo":
  // resta al suo posto nella riga, con lo stesso ordine di lettura.
  function cambiaParametro(chipId: string, entry: CatalogEventEntry) {
    setChips((prev) => prev.map((c) => (c.id === chipId ? chipEvento(entry) : c)));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggerimenti.length > 0) {
      e.preventDefault();
      setEvidenziato((i) => (Math.min(i, suggerimenti.length - 1) + 1) % suggerimenti.length);
    } else if (e.key === "ArrowUp" && suggerimenti.length > 0) {
      e.preventDefault();
      setEvidenziato((i) => (Math.min(i, suggerimenti.length - 1) - 1 + suggerimenti.length) % suggerimenti.length);
    } else if (e.key === "Enter") {
      const scelto = suggerimenti[idxEvidenziato];
      if (scelto) {
        e.preventDefault();
        aggiungiChip(scelto.chip);
      }
    } else if (e.key === "Backspace" && query === "" && chips.length > 0) {
      e.preventDefault();
      rimuoviChip(chips[chips.length - 1].id);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  }

  // Le varianti parametriche di un chip evento, nell'ordine dichiarato in
  // parametriDisponibili (stessa convenzione di EventPicker/EventCard).
  function variantiDi(chip: EventoChip): { chiave: string; entry: CatalogEventEntry; etichetta: string }[] {
    const varianti = catalog.filter((e) => e.eventId === chip.eventId);
    const paramKey = Object.keys(varianti[0]?.parametriDisponibili ?? {})[0];
    if (!paramKey) return [];
    return varianti[0].parametriDisponibili[paramKey]
      .map((valore) => {
        const entry = varianti.find((v) => v.parametri[paramKey] === valore);
        return entry
          ? { chiave: JSON.stringify(entry.parametri), entry, etichetta: `${paramKey}=${formatParameterValue(paramKey, valore)}` }
          : null;
      })
      .filter((v): v is { chiave: string; entry: CatalogEventEntry; etichetta: string } => v !== null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* La riga dei chip scelti: sta SOPRA la barra, perché è lo scenario
          che si sta componendo, non un risultato della ricerca. */}
      <div className="flex flex-wrap items-center gap-2 min-h-[2.25rem]">
        {chips.length === 0 && (
          <span className="text-sm text-neutral-gray">
            Nessun pezzo scelto. Digita qui sotto un evento, un pilota, un team, un circuito o un decennio.
          </span>
        )}
        {chips.map((chip) => {
          const varianti = chip.tipo === "evento" ? variantiDi(chip) : [];
          return (
            <span
              key={chip.id}
              className="flex items-center gap-2 pl-2 pr-1 py-1 bg-panel border border-graphite rounded-sm text-sm text-white"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/40"
                style={{
                  backgroundColor:
                    chip.tipo === "evento"
                      ? familyColor(catalog.find((e) => e.eventId === chip.eventId)?.famiglia ?? "")
                      : "transparent",
                  border: chip.tipo === "evento" ? undefined : "1px solid #6b7280",
                }}
              />
              <span className="text-xs uppercase tracking-widest text-neutral-gray">{chip.tipo}</span>
              <span>{chip.tipo === "evento" ? catalog.find((e) => e.eventId === chip.eventId)?.nome ?? chip.label : chip.label}</span>

              {varianti.length > 0 && (
                <select
                  aria-label={`Parametro di ${chip.label}`}
                  className="bg-graphite text-white text-xs rounded-sm px-1 py-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-racing-red"
                  value={JSON.stringify((chip as EventoChip).parametri)}
                  onChange={(e) => {
                    const scelta = varianti.find((v) => v.chiave === e.target.value);
                    if (scelta) cambiaParametro(chip.id, scelta.entry);
                  }}
                >
                  {varianti.map((v) => (
                    <option key={v.chiave} value={v.chiave}>
                      {v.etichetta}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                aria-label={`Togli ${chip.label}`}
                onClick={() => rimuoviChip(chip.id)}
                className="px-1 text-neutral-gray hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-racing-red"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={suggerimenti.length > 0}
            aria-controls="scenario-suggerimenti"
            aria-activedescendant={suggerimenti[idxEvidenziato] ? `sugg-${suggerimenti[idxEvidenziato].chiave}` : undefined}
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setEvidenziato(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Cerca un evento, un pilota, un team, un circuito, un decennio…"
            className="flex-1 bg-panel border border-graphite rounded-sm px-4 py-3 text-white placeholder:text-neutral-gray focus-visible:outline focus-visible:outline-2 focus-visible:outline-racing-red"
          />
          <button
            type="button"
            onClick={() => setMenuAperto((v) => !v)}
            aria-expanded={menuAperto}
            className="px-4 py-3 bg-panel border border-graphite rounded-sm text-sm text-neutral-gray hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-racing-red"
          >
            {menuAperto ? "Chiudi il menu" : "Sfoglia per famiglia"}
          </button>
        </div>

        {suggerimenti.length > 0 && (
          <ul
            id="scenario-suggerimenti"
            role="listbox"
            ref={listaRef}
            className="absolute z-10 left-0 right-0 mt-1 max-h-[320px] overflow-y-auto bg-panel border border-graphite rounded-sm divide-y divide-graphite"
          >
            {suggerimenti.map((s, i) => {
              const primoDelTipo = i === 0 || suggerimenti[i - 1].tipo !== s.tipo;
              return (
                <li key={s.chiave}>
                  {primoDelTipo && (
                    <div className="px-4 pt-2 pb-1 text-[0.65rem] uppercase tracking-widest text-neutral-gray">
                      {ETICHETTE_TIPO[s.tipo]}
                    </div>
                  )}
                  <div
                    id={`sugg-${s.chiave}`}
                    role="option"
                    aria-selected={i === idxEvidenziato}
                    data-evidenziato={i === idxEvidenziato ? "1" : "0"}
                    onMouseEnter={() => setEvidenziato(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      aggiungiChip(s.chip);
                    }}
                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${i === idxEvidenziato ? "bg-graphite" : ""}`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: s.colore ?? "transparent", border: s.colore ? undefined : "1px solid #6b7280" }}
                    />
                    <span className="min-w-0">
                      <span className="block text-white text-sm truncate">{s.titolo}</span>
                      <span className="block text-xs text-neutral-gray truncate">{s.dettaglio}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {menuAperto && (
        <EventPicker
          catalog={catalog}
          onEmit={(chip) => {
            aggiungiChip(chip);
            setMenuAperto(false);
          }}
        />
      )}

      {/* Lo scaffale delle corrispondenze (fase S3.1): la vista portante. La
          finestra intersecata e il denominatore composto restano scritti in
          chiaro accanto alla vista, sempre visibili e mai in un tooltip
          (regola d'oro del progetto). */}
      <div className="border-t border-graphite pt-4">
        {risultato === null ? (
          <span className="text-sm text-neutral-gray">
            Lo scaffale comparirà qui appena scegli il primo pezzo.
          </span>
        ) : (
          <>
            <div className="mb-3 text-sm text-neutral-gray">
              Finestra intersecata{" "}
              <span className="text-white">
                {risultato.finestraIntersecata.annoDa}–{risultato.finestraIntersecata.annoA}
              </span>{" "}
              · denominatore composto{" "}
              <span className="text-white">
                {risultato.denominatoreComposto.valore === null
                  ? "non calcolabile"
                  : `${risultato.denominatoreComposto.valore} (${risultato.denominatoreComposto.fonte})`}
              </span>{" "}
              · join <span className="text-white">&quot;{risultato.joinMode}&quot;</span>
            </div>
            <ScaffaleCorrispondenze result={risultato} races={indice.races} nomiCircuiti={nomiCircuiti} />
          </>
        )}
      </div>
    </div>
  );
}
