"use client";

// L'interruttore della vista 1 (roadmap R3.1, docs/ROADMAP-4.md): due modi
// di leggere lo STESSO catalogo di eventi, non due cataloghi diversi — "La
// scala della rarità" (RarityScale, il default) e "I riquadri"
// (EventCardsGrid). Solo stato React locale (useState), nessuna route o
// querystring nuova: chi apre il sito per la prima volta vede sempre
// RarityScale.
//
// Persistenza in sessionStorage (non nell'URL): tornando indietro dal
// compositore (link "Apri nel compositore →" di una card), Next.js a
// volte rimonta questa pagina da zero, azzerando lo useState e riportando
// l'utente sulla scala anche se stava guardando i riquadri. sessionStorage
// sopravvive al rimontaggio; useSyncExternalStore (non un setState dentro
// useEffect, vietato dal lint del progetto) è il modo corretto di
// sincronizzare React con uno store esterno: sul server e al primo paint
// client restituisce sempre "scala" (getServerSnapshot, nessun flash alla
// prima visita), poi si allinea al valore salvato.
//
// Stile del segmented control riusato identico a quello già validato in
// OpportunityWindow.tsx (vista "decisione"/"opportunità"): stessa
// convenzione in tutto il sito per un controllo a due stati.

import { useSyncExternalStore } from "react";
import clsx from "clsx";
import RarityScale from "@/components/charts/RarityScale";
import EventCardsGrid from "@/components/EventCardsGrid";
import type { CatalogEventEntry } from "@/lib/eventCatalog";

type ViewMode = "scala" | "riquadri";

const STORAGE_KEY = "home-catalog-view";
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): ViewMode {
  return sessionStorage.getItem(STORAGE_KEY) === "riquadri" ? "riquadri" : "scala";
}

function getServerSnapshot(): ViewMode {
  return "scala";
}

function setStoredView(next: ViewMode) {
  sessionStorage.setItem(STORAGE_KEY, next);
  listeners.forEach((callback) => callback());
}

interface Props {
  events: CatalogEventEntry[];
  catalog: CatalogEventEntry[];
}

export default function HomeCatalogView({ events, catalog }: Props) {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <div className="flex gap-1 p-1 bg-panel border border-graphite rounded-md">
          <button
            type="button"
            onClick={() => setStoredView("scala")}
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
            onClick={() => setStoredView("riquadri")}
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
