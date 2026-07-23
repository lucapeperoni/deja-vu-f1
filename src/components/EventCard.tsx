"use client";

// Riquadro per UN evento del catalogo (roadmap R1.1, docs/ROADMAP-4.md).
// Componente React puro: niente D3, niente useEffect su un <svg> — la
// "regola sul D3" (docs/PROGETTAZIONE.md, sezione 7) riguarda i grafici,
// non una card di testo con un piccolo stato locale.
//
// Riceve tutte le varianti (combinazioni parametro) di un eventId già
// filtrate dal chiamante: non legge alcun file, solo props — stesso array
// che oggi popola public/data/events/index.json per quell'eventId.
// Cambiare parametro sposta solo l'indice locale (useState) tra varianti
// già in memoria: nessuna richiesta di rete.

import { useState } from "react";
import Link from "next/link";
import {
  formatBigAnswer,
  formatDrought,
  formatParameterValue,
  formatWindow,
  parameterSuffix,
  type CatalogEventEntry,
} from "@/lib/eventCatalog";
import { familyColor } from "@/lib/colors";

interface Props {
  variants: CatalogEventEntry[];
}

export default function EventCard({ variants }: Props) {
  const base = variants[0];
  const paramKey = Object.keys(base.parametriDisponibili)[0];
  const paramValues = paramKey ? base.parametriDisponibili[paramKey] : [];

  // Stessa convenzione di CompositoreClient.orderedVariants: le varianti
  // ordinate secondo la griglia dichiarata nel catalogo (parametriDisponibili),
  // non nell'ordine (arbitrario) in cui compaiono in index.json.
  const orderedVariants = paramKey
    ? paramValues
        .map((value) => variants.find((v) => v.parametri[paramKey] === value))
        .filter((v): v is CatalogEventEntry => Boolean(v))
    : variants;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const current = orderedVariants[selectedIndex] ?? base;
  const color = familyColor(current.famiglia);
  const drought = formatDrought(current);

  return (
    <div className="bg-panel border border-graphite rounded-sm overflow-hidden flex flex-col h-full">
      {/* Linea chiara sul bordo inferiore della striscia (roadmap R4.1,
          passata di contrasto): stessa ragione del pallino in
          EventCardsGrid — indigo (griglia_e_risultato) e vinaccia (team)
          hanno un contrasto sotto 2:1 contro bg-panel, sotto il 3:1
          richiesto per un elemento grafico. L'inset box-shadow disegna un
          bordo senza consumare l'altezza dei 4px della striscia. */}
      <div
        className="h-1"
        style={{ backgroundColor: color, boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.4)" }}
      />
      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="font-condensed text-base font-bold text-white uppercase leading-tight">
          {current.nome}
          <span className="text-neutral-gray normal-case">{parameterSuffix(current)}</span>
        </h3>

        <div className="text-lg font-bold leading-snug" style={{ color }}>
          {formatBigAnswer(current)}
        </div>

        <div className="text-xs text-neutral-gray">
          Finestra: <span className="text-white">{formatWindow(current)}</span>
        </div>

        {drought && <div className="text-xs text-racing-red">{drought}</div>}

        {/* Riquadro sempre presente, anche senza bottoni: uno spazio invisibile
            alto quanto la riga di bottoni evita che la griglia "salti" tra un
            evento con parametro e uno senza (roadmap R1.2, min-height invece
            di condizionare il rendering dell'intero blocco). */}
        <div
          className="flex flex-wrap gap-1 mt-1 min-h-[26px]"
          role={paramKey && paramValues.length > 1 ? "group" : undefined}
          aria-label={paramKey && paramValues.length > 1 ? `Valori di ${paramKey}` : undefined}
        >
          {paramKey &&
            paramValues.length > 1 &&
            paramValues.map((value, idx) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                aria-pressed={idx === selectedIndex}
                className={`px-2 py-0.5 text-xs border rounded-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-racing-red ${
                  idx === selectedIndex
                    ? "border-racing-red text-white bg-racing-red/20"
                    : "border-graphite text-neutral-gray hover:text-white hover:border-neutral-gray"
                }`}
              >
                {formatParameterValue(paramKey, value)}
              </button>
            ))}
        </div>
      </div>

      <div className="border-t border-graphite px-4 py-2">
        <Link
          href={`/eventi/${current.eventId}${paramKey ? `?${paramKey}=${current.parametri[paramKey]}` : ""}`}
          className="text-racing-red hover:underline text-xs uppercase tracking-widest"
        >
          Apri nel compositore →
        </Link>
      </div>
    </div>
  );
}
