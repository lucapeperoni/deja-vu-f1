"use client";

// Il menu a macro-aree del compositore di scenari (roadmap S, fase S2.1,
// docs/ROADMAP-6.md). Navigazione gerarchica a tre livelli, stile "Comandi"
// di iOS: UNA colonna che scende di livello (mai due affiancate), con una
// briciola di pane in cima per risalire — niente stato di "colonne multiple"
// da tenere sincronizzato, solo il livello corrente.
//
// Livelli: famiglia (le 9 di FAMILY_LEGEND) -> evento (deduplicato con
// dedupeToDefaultParams) -> parametro (solo per i 14 eventi con
// parametriDisponibili non vuoto — gli altri sono foglia già al livello
// evento). Ogni riga mostra già rarità e finestra prima di essere scelta
// (chi sceglie deve sapere cosa sta scegliendo): riusa gli helper di
// eventCatalog.ts, non li ricalcola.
//
// Selezionare una foglia non naviga: chiama onEmit con un EventoChip già
// nella forma esatta attesa da scenarioEngine.ts. Nessun D3 (non è un
// grafico, stessa motivazione già accettata per EventCardsGrid).

import { useState } from "react";
import { FAMILY_LEGEND, type EventFamily } from "@/lib/colors";
import {
  dedupeToDefaultParams,
  formatRarityPercent,
  formatWindow,
  parameterSuffix,
  type CatalogEventEntry,
} from "@/lib/eventCatalog";
import type { EventoChip } from "@/lib/scenarioEngine";

interface Props {
  catalog: CatalogEventEntry[];
  onEmit: (chip: EventoChip) => void;
}

type Level =
  | { tipo: "famiglia" }
  | { tipo: "evento"; famigliaKey: EventFamily }
  | { tipo: "parametro"; famigliaKey: EventFamily; eventId: string };

// Stessa costruzione dell'id concordata in roadmap: evento + parametri
// serializzati, stabile perché parametri è già lo stesso oggetto che vive
// nel catalogo (nessuna chiave viene riordinata a mano qui).
function chipFromEntry(entry: CatalogEventEntry): EventoChip {
  return {
    id: `evento:${entry.eventId}:${JSON.stringify(entry.parametri)}`,
    label: `${entry.nome}${parameterSuffix(entry)}`,
    tipo: "evento",
    eventId: entry.eventId,
    parametri: entry.parametri,
  };
}

// Stessa convenzione di EventCard.orderedVariants: le varianti di un evento
// ordinate secondo la griglia dichiarata in parametriDisponibili, non
// nell'ordine (arbitrario) in cui compaiono in index.json.
function orderedVariants(catalog: CatalogEventEntry[], base: CatalogEventEntry): CatalogEventEntry[] {
  const variants = catalog.filter((e) => e.eventId === base.eventId);
  const paramKey = Object.keys(base.parametriDisponibili)[0];
  if (!paramKey) return variants;
  return base.parametriDisponibili[paramKey]
    .map((value) => variants.find((v) => v.parametri[paramKey] === value))
    .filter((v): v is CatalogEventEntry => Boolean(v));
}

export default function EventPicker({ catalog, onEmit }: Props) {
  const [level, setLevel] = useState<Level>({ tipo: "famiglia" });
  const defaultEvents = dedupeToDefaultParams(catalog);

  const famigliaCorrente = level.tipo !== "famiglia" ? FAMILY_LEGEND.find((f) => f.key === level.famigliaKey) ?? null : null;
  const eventoCorrente = level.tipo === "parametro" ? defaultEvents.find((e) => e.eventId === level.eventId) ?? null : null;

  return (
    <div className="bg-panel border border-graphite rounded-sm overflow-hidden">
      {/* Briciola di pane: ogni tappa precedente resta cliccabile per
          risalire di più livelli in un colpo solo, non solo di uno. */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-graphite text-xs uppercase tracking-widest overflow-x-auto whitespace-nowrap">
        <button
          type="button"
          onClick={() => setLevel({ tipo: "famiglia" })}
          className={level.tipo === "famiglia" ? "text-white" : "text-neutral-gray hover:text-white transition-colors"}
        >
          Famiglie
        </button>
        {famigliaCorrente && (
          <>
            <span className="text-neutral-gray">›</span>
            <button
              type="button"
              onClick={() => setLevel({ tipo: "evento", famigliaKey: famigliaCorrente.key })}
              className={level.tipo === "evento" ? "text-white" : "text-neutral-gray hover:text-white transition-colors"}
            >
              {famigliaCorrente.label}
            </button>
          </>
        )}
        {eventoCorrente && (
          <>
            <span className="text-neutral-gray">›</span>
            <span className="text-white">{eventoCorrente.nome}</span>
          </>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto divide-y divide-graphite">
        {level.tipo === "famiglia" &&
          FAMILY_LEGEND.map((famiglia) => {
            const count = defaultEvents.filter((e) => e.famiglia === famiglia.key).length;
            return (
              <button
                key={famiglia.key}
                type="button"
                onClick={() => setLevel({ tipo: "evento", famigliaKey: famiglia.key })}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-graphite/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-racing-red"
              >
                <span className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/40"
                    style={{ backgroundColor: famiglia.color }}
                  />
                  <span className="font-condensed text-lg font-bold text-white uppercase">{famiglia.label}</span>
                  <span className="text-xs text-neutral-gray">({count})</span>
                </span>
                <span className="text-neutral-gray shrink-0">›</span>
              </button>
            );
          })}

        {level.tipo === "evento" &&
          famigliaCorrente &&
          defaultEvents
            .filter((e) => e.famiglia === famigliaCorrente.key)
            .sort((a, b) => b.rarita - a.rarita)
            .map((entry) => {
              const hasParametri = Object.keys(entry.parametriDisponibili).length > 0;
              const paramKey = hasParametri ? Object.keys(entry.parametriDisponibili)[0] : null;
              const numValori = paramKey ? entry.parametriDisponibili[paramKey].length : 0;
              return (
                <button
                  key={entry.eventId}
                  type="button"
                  onClick={() =>
                    hasParametri
                      ? setLevel({ tipo: "parametro", famigliaKey: famigliaCorrente.key, eventId: entry.eventId })
                      : onEmit(chipFromEntry(entry))
                  }
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-graphite/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-racing-red"
                >
                  <span className="min-w-0">
                    <span className="block text-white">
                      {entry.nome}
                      {!hasParametri && <span className="text-neutral-gray">{parameterSuffix(entry)}</span>}
                    </span>
                    <span className="block text-xs text-neutral-gray">
                      {formatRarityPercent(entry.rarita)} · Finestra {formatWindow(entry)}
                      {hasParametri ? ` · ${numValori} valori possibili` : ""}
                    </span>
                  </span>
                  <span className="text-neutral-gray shrink-0">{hasParametri ? "›" : ""}</span>
                </button>
              );
            })}

        {level.tipo === "parametro" &&
          famigliaCorrente &&
          eventoCorrente &&
          orderedVariants(catalog, eventoCorrente).map((entry) => (
            <button
              key={JSON.stringify(entry.parametri)}
              type="button"
              onClick={() => onEmit(chipFromEntry(entry))}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-graphite/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-racing-red"
            >
              <span className="min-w-0">
                <span className="block text-white">
                  {entry.nome}
                  <span className="text-neutral-gray">{parameterSuffix(entry)}</span>
                </span>
                <span className="block text-xs text-neutral-gray">
                  {formatRarityPercent(entry.rarita)} · Finestra {formatWindow(entry)}
                </span>
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}
