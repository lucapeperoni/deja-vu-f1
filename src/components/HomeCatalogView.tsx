"use client";

// L'interruttore della vista 1 (roadmap R3.1 e T3.1, docs/ROADMAP-4.md e
// docs/ROADMAP-5.md): TRE modi di leggere lo STESSO catalogo di eventi, non
// tre cataloghi diversi — "La scala della rarità" (RarityScale, il default),
// "I riquadri" (EventCardsGrid), "Il fiume delle famiglie" (FamilyStream,
// nome scelto per restare coerente con le altre due etichette — un
// sostantivo con articolo, non "Nel tempo" che avrebbe rotto lo stile).
// Solo stato React locale, nessuna route o querystring nuova: chi apre il
// sito per la prima volta vede sempre RarityScale.
//
// Persistenza in sessionStorage (non nell'URL): tornando indietro dal
// compositore (link "Apri nel compositore →" di una card), Next.js a
// volte rimonta questa pagina da zero, azzerando lo useState e riportando
// l'utente sulla scala anche se stava guardando un'altra vista.
// sessionStorage sopravvive al rimontaggio; useSyncExternalStore (non un
// setState dentro useEffect, vietato dal lint del progetto) è il modo
// corretto di sincronizzare React con uno store esterno: sul server e al
// primo paint client restituisce sempre "scala" (getServerSnapshot, nessun
// flash alla prima visita), poi si allinea al valore salvato. Stesso
// meccanismo di R3.1, esteso da 2 a 3 valori — non un caso nuovo da
// reinventare.
//
// Stile del segmented control riusato identico a quello già validato in
// OpportunityWindow.tsx (vista "decisione"/"opportunità"): stessa
// convenzione in tutto il sito per un controllo a più stati.

import { useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import RarityScale from "@/components/charts/RarityScale";
import EventCardsGrid from "@/components/EventCardsGrid";
import FamilyStream, { type FamilyTimelinePoint } from "@/components/charts/FamilyStream";
import type { CatalogEventEntry } from "@/lib/eventCatalog";

type ViewMode = "scala" | "riquadri" | "tempo";

const VIEW_MODES: ViewMode[] = ["scala", "riquadri", "tempo"];

const STORAGE_KEY = "home-catalog-view";
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): ViewMode {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return VIEW_MODES.includes(stored as ViewMode) ? (stored as ViewMode) : "scala";
}

function getServerSnapshot(): ViewMode {
  return "scala";
}

function setStoredView(next: ViewMode) {
  sessionStorage.setItem(STORAGE_KEY, next);
  listeners.forEach((callback) => callback());
}

const VIEW_LABELS: Record<ViewMode, string> = {
  scala: "La scala della rarità",
  riquadri: "I riquadri",
  tempo: "Il fiume delle famiglie",
};

interface Props {
  events: CatalogEventEntry[];
  catalog: CatalogEventEntry[];
  familyTimelineData: FamilyTimelinePoint[];
}

export default function HomeCatalogView({ events, catalog, familyTimelineData }: Props) {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Famiglia da isolare all'apertura di "I riquadri" (roadmap T5, link "Vedi
  // gli eventi di [famiglia] →" dal fiume): solo un valore di innesco, non
  // uno stato persistente del filtro — che resta sotto EventCardsGrid. Va
  // azzerato ogni volta che la vista cambia per qualunque ALTRA via (i tre
  // bottoni del toggle in alto), altrimenti un passaggio manuale successivo
  // su "I riquadri" riapplicherebbe un filtro ormai stantio. Niente
  // useEffect per questo azzeramento (vietato dal lint del progetto per un
  // setState dentro un effetto, roadmap R3.1): lo si fa direttamente negli
  // handler dei click, che sono l'unico altro posto da cui la vista cambia.
  const [pendingFamily, setPendingFamily] = useState<string | null>(null);

  function selectView(mode: ViewMode) {
    setPendingFamily(null);
    setStoredView(mode);
  }

  function showFamilyInGrid(familyKey: string) {
    setPendingFamily(familyKey);
    setStoredView("riquadri");
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <div className="flex gap-1 p-1 bg-panel border border-graphite rounded-md flex-wrap">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => selectView(mode)}
              aria-pressed={view === mode}
              className={clsx(
                "px-3 py-1.5 text-xs font-condensed uppercase tracking-wider rounded transition-colors",
                view === mode ? "bg-racing-red text-white font-bold" : "text-neutral-gray hover:text-white"
              )}
            >
              {VIEW_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      {view === "scala" && <RarityScale events={events} />}
      {view === "riquadri" && (
        <EventCardsGrid key={pendingFamily ?? "all"} catalog={catalog} initialFamily={pendingFamily} />
      )}
      {view === "tempo" && <FamilyStream data={familyTimelineData} onSelectFamily={showFamilyInGrid} />}
    </div>
  );
}
