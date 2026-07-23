"use client";

// L'interruttore della vista 1 (roadmap R3.1, docs/ROADMAP-4.md): due modi
// di leggere lo STESSO catalogo di eventi, non due cataloghi diversi — "La
// scala della rarità" (RarityScale, il default) e "I riquadri"
// (EventCardsGrid). Solo stato React locale (useState), nessuna route o
// querystring nuova: la scelta non sopravvive a un refresh, e chi apre il
// sito per la prima volta vede sempre RarityScale.
//
// Stile del segmented control riusato identico a quello già validato in
// OpportunityWindow.tsx (vista "decisione"/"opportunità"): stessa
// convenzione in tutto il sito per un controllo a due stati.

import { useState } from "react";
import clsx from "clsx";
import RarityScale from "@/components/charts/RarityScale";
import EventCardsGrid from "@/components/EventCardsGrid";
import type { CatalogEventEntry } from "@/lib/eventCatalog";

type ViewMode = "scala" | "riquadri";

interface Props {
  events: CatalogEventEntry[];
  catalog: CatalogEventEntry[];
}

export default function HomeCatalogView({ events, catalog }: Props) {
  const [view, setView] = useState<ViewMode>("scala");

  return (
    <div>
      <div className="flex justify-end mb-4">
        <div className="flex gap-1 p-1 bg-panel border border-graphite rounded-md">
          <button
            type="button"
            onClick={() => setView("scala")}
            aria-pressed={view === "scala"}
            className={clsx(
              "px-3 py-1.5 text-xs font-condensed uppercase tracking-wider rounded transition-colors",
              view === "scala" ? "bg-racing-red text-white font-bold" : "text-neutral-gray hover:text-white"
            )}
          >
            La scala della rarità
          </button>
          <button
            type="button"
            onClick={() => setView("riquadri")}
            aria-pressed={view === "riquadri"}
            className={clsx(
              "px-3 py-1.5 text-xs font-condensed uppercase tracking-wider rounded transition-colors",
              view === "riquadri" ? "bg-racing-red text-white font-bold" : "text-neutral-gray hover:text-white"
            )}
          >
            I riquadri
          </button>
        </div>
      </div>

      {view === "scala" ? <RarityScale events={events} /> : <EventCardsGrid catalog={catalog} />}
    </div>
  );
}
