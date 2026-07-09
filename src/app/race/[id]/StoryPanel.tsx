"use client";

// Pannello narrativo delle 3 gare-caso (task 5.1, docs/PROGETTAZIONE.md
// sezioni 8 e 9). Puro React (nessun D3: è testo e stato, non un grafico) —
// scorrendo le tappe si scrive nello stesso RaceInteractionContext letto
// dalla race trace e dalle altre viste: brush sull'intervallo di giri
// rilevante, evento selezionato, piloti coinvolti evidenziati. Le gare
// senza voce in stories.json non montano questo componente.

import { useState } from "react";
import type { RaceStory } from "./RaceAnatomyTimeline";
import { useRaceInteraction } from "./RaceInteractionContext";

interface Props {
  story: RaceStory;
}

export default function StoryPanel({ story }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { setBrushRange, setSelectedEventId, setStoryDriverIds, setLockedDriverId } = useRaceInteraction();

  function goToStep(index: number) {
    setActiveIndex(index);
    const step = story.steps[index];
    setBrushRange(step.brushRange);
    if (step.eventId) setSelectedEventId(step.eventId);
    setStoryDriverIds(step.driverIds.length > 0 ? step.driverIds : null);
    setLockedDriverId(step.driverIds[0] ?? null);
  }

  function clearStep() {
    setActiveIndex(null);
    setBrushRange(null);
    setStoryDriverIds(null);
    setLockedDriverId(null);
  }

  return (
    <div className="bg-panel border border-graphite rounded-xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-condensed text-xl font-bold uppercase text-white">{story.title}</h2>
        {activeIndex != null && (
          <button
            onClick={clearStep}
            className="text-xs uppercase tracking-widest text-neutral-gray hover:text-white transition-colors"
          >
            Chiudi tappa ×
          </button>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {story.steps.map((step, index) => {
          const isActive = activeIndex === index;
          return (
            <li key={index}>
              <button
                onClick={() => goToStep(index)}
                className={`w-full text-left flex gap-4 p-3 rounded-lg border transition-colors ${
                  isActive
                    ? "border-racing-red bg-racing-red/10"
                    : "border-transparent hover:border-graphite hover:bg-white/5"
                }`}
              >
                <div
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-condensed font-bold text-sm ${
                    isActive ? "bg-racing-red text-white" : "bg-graphite text-neutral-gray"
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-white text-sm">{step.title}</span>
                    <span className="text-xs text-neutral-gray uppercase tracking-widest">giro {step.lap}</span>
                  </div>
                  <p className="text-sm text-text-secondary mt-1">{step.text}</p>
                  {step.driverIds.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {step.driverIds.map((id) => (
                        <span
                          key={id}
                          className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-graphite text-neutral-gray"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
