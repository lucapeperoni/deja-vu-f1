"use client";

// Stato condiviso tra le viste della pagina gara (docs/PROGETTAZIONE.md,
// interazione comune di sezione 7 e le categorie di Yi et al. in sezione
// 8): select (hover/click sul pilota, bloccabile), filter (il brush della
// race trace), explore/connect (il selettore evento che sincronizza slope
// chart e matrice). Un context leggero, come alternativa a far girare 6
// callback tra RaceAnatomyClient e ognuna delle 5 viste.
//
// Le funzioni esposte (setHoveredDriverId, setBrushRange, ecc.) sono
// referenzialmente stabili: setX di useState non cambia mai identità tra
// render, toggleLockedDriverId/clearLock sono avvolte in useCallback con
// dipendenze vuote. Questo è il pezzo che rende possibile, nei singoli
// componenti D3, tenere l'effect "strutturale" (scale, assi, data join)
// SENZA l'id evidenziato tra le dipendenze: un secondo effect, minuscolo,
// si occupa solo di ridipingere gli attributi di evidenziazione quando
// cambia l'id — vedi il commento in ogni componente vista.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface BrushRange {
  startLap: number;
  endLap: number;
}

interface RaceInteractionValue {
  hoveredDriverId: string | null;
  lockedDriverId: string | null;
  // Quello che le viste devono effettivamente disegnare come "evidenziato":
  // il blocco (click) vince sempre sull'hover.
  highlightedDriverId: string | null;
  setHoveredDriverId: (id: string | null) => void;
  toggleLockedDriverId: (id: string) => void;
  clearLock: () => void;
  brushRange: BrushRange | null;
  setBrushRange: (range: BrushRange | null) => void;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
}

const RaceInteractionContext = createContext<RaceInteractionValue | null>(null);

export function RaceInteractionProvider({
  children,
  defaultEventId,
}: {
  children: ReactNode;
  defaultEventId: string | null;
}) {
  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null);
  const [lockedDriverId, setLockedDriverId] = useState<string | null>(null);
  const [brushRange, setBrushRange] = useState<BrushRange | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(defaultEventId);

  const toggleLockedDriverId = useCallback((id: string) => {
    setLockedDriverId((current) => (current === id ? null : id));
  }, []);

  const clearLock = useCallback(() => setLockedDriverId(null), []);

  const value = useMemo<RaceInteractionValue>(
    () => ({
      hoveredDriverId,
      lockedDriverId,
      highlightedDriverId: lockedDriverId ?? hoveredDriverId,
      setHoveredDriverId,
      toggleLockedDriverId,
      clearLock,
      brushRange,
      setBrushRange,
      selectedEventId,
      setSelectedEventId,
    }),
    [hoveredDriverId, lockedDriverId, brushRange, selectedEventId, toggleLockedDriverId, clearLock]
  );

  return <RaceInteractionContext.Provider value={value}>{children}</RaceInteractionContext.Provider>;
}

export function useRaceInteraction(): RaceInteractionValue {
  const ctx = useContext(RaceInteractionContext);
  if (!ctx) throw new Error("useRaceInteraction va usato dentro RaceInteractionProvider");
  return ctx;
}
