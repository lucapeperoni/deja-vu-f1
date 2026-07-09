'use client';

import { useCallback, useState } from 'react';
import RaceAnatomyTimeline, { type RaceData } from './RaceAnatomyTimeline';
import { PIT_CONTEXT_LEGEND } from '@/lib/colors';

interface BrushRange {
  startLap: number;
  endLap: number;
}

// Le viste 2 (sconti, PitCostDumbbell) e 4 (matrice della lotteria,
// OpportunityWindow) arrivano con i task 3.2 e 3.3: qui per ora c'è solo
// la vista 1 (race trace), completa di hover/click coordinati e brush.
export default function RaceAnatomyClient({ raceData }: { raceData: RaceData }) {
  const [highlightedDriverId, setHighlightedDriverId] = useState<string | null>(null);
  const [brushRange, setBrushRange] = useState<BrushRange | null>(null);

  const handleHighlightChange = useCallback((id: string | null) => {
    setHighlightedDriverId(id);
  }, []);

  const handleBrushChange = useCallback((range: BrushRange | null) => {
    setBrushRange(range);
  }, []);

  return (
    <div className="flex flex-col gap-12">
      <section>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h2 className="font-condensed text-2xl font-bold uppercase text-white">Race Anatomy Timeline</h2>
            <p className="text-sm text-text-secondary">
              Passa il mouse su una linea o su un nome pilota per evidenziarlo, clicca per bloccare
              l&apos;evidenziazione. Trascina sull&apos;asse dei giri per selezionare un intervallo.
            </p>
          </div>
          <div className="flex gap-4 flex-wrap">
            {PIT_CONTEXT_LEGEND.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-gray">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        <RaceAnatomyTimeline
          raceData={raceData}
          highlightedDriverId={highlightedDriverId}
          onHighlightChange={handleHighlightChange}
          onBrushChange={handleBrushChange}
        />

        {brushRange && (
          <p className="mt-3 text-xs text-neutral-gray">
            Intervallo selezionato: giro {brushRange.startLap} – giro {brushRange.endLap}
          </p>
        )}
        {highlightedDriverId && (
          <p className="mt-1 text-xs text-neutral-gray">Pilota evidenziato: {highlightedDriverId}</p>
        )}
      </section>
    </div>
  );
}
