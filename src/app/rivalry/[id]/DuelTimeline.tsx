'use client';

import { useState } from 'react';
import { RaceComparison, DriverIndex } from '@/lib/data';
import clsx from 'clsx';
import { Info, ArrowRight } from 'lucide-react';
import RaceSlopeChart from './RaceSlopeChart';

interface Props {
  races: RaceComparison[];
  driverA: DriverIndex;
  driverB: DriverIndex;
  stats: any;
}

export default function DuelTimeline({ races, driverA, driverB, stats }: Props) {
  const [metric, setMetric] = useState<'race' | 'qualy' | 'points'>('race');
  const [hoveredRace, setHoveredRace] = useState<RaceComparison | null>(null);
  const [selectedRace, setSelectedRace] = useState<RaceComparison | null>(null);

  // Cumulative advantage
  let cumA = 0;
  let cumB = 0;
  const cumulativeData = races.map(r => {
    if (metric === 'race') {
      if (r.raceWinner === driverA.id) cumA++;
      else if (r.raceWinner === driverB.id) cumB++;
    } else if (metric === 'qualy') {
      if (r.qualyWinner === driverA.id) cumA++;
      else if (r.qualyWinner === driverB.id) cumB++;
    } else if (metric === 'points') {
      cumA += r.pointsA;
      cumB += r.pointsB;
    }
    return { cumA, cumB, advantage: cumA - cumB };
  });

  const maxAdvantage = Math.max(1, ...cumulativeData.map(d => Math.abs(d.advantage)));

  return (
    <div className="flex flex-col gap-12">
      {/* Controls */}
      <div className="flex gap-4 p-2 bg-panel border border-graphite w-fit">
        {['race', 'qualy', 'points'].map(m => (
          <button
            key={m}
            onClick={() => setMetric(m as any)}
            className={clsx(
              "px-4 py-2 text-sm font-condensed uppercase tracking-wider transition-colors",
              metric === m ? "bg-racing-red text-white font-bold" : "text-neutral-gray hover:text-white"
            )}
          >
            {m === 'race' ? 'Risultato Gara' : m === 'qualy' ? 'Qualifica' : 'Punti'}
          </button>
        ))}
      </div>

      {/* Visualization */}
      <div className="relative bg-panel border border-graphite p-8 overflow-x-auto">
        <div className="min-w-[800px] relative">
          
          {/* Driver Labels */}
          <div className="absolute left-0 top-12 bottom-12 w-32 flex flex-col justify-between font-condensed uppercase font-bold text-lg text-text-secondary">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-racing-red rounded-full" />
              {driverA.name.split(' ').pop()}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-white rounded-full" />
              {driverB.name.split(' ').pop()}
            </div>
          </div>

          <div className="ml-40 flex items-stretch h-64 relative mt-12">
            
            {/* Center Zero Line (for cumulative) */}
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-graphite -translate-y-1/2 z-0" />

            {races.map((race, idx) => {
              const cum = cumulativeData[idx];
              let winnerA = false;
              let winnerB = false;
              
              if (metric === 'race' && race.raceWinner === driverA.id) winnerA = true;
              if (metric === 'race' && race.raceWinner === driverB.id) winnerB = true;
              if (metric === 'qualy' && race.qualyWinner === driverA.id) winnerA = true;
              if (metric === 'qualy' && race.qualyWinner === driverB.id) winnerB = true;
              if (metric === 'points') {
                if (race.pointsA > race.pointsB) winnerA = true;
                if (race.pointsB > race.pointsA) winnerB = true;
              }

              // Cumulative trend line height (relative to center)
              const yPos = (cum.advantage / maxAdvantage) * 50; // percentage from center
              
              return (
                <div 
                  key={idx} 
                  className="flex-1 flex flex-col justify-between relative group"
                  onMouseEnter={() => setHoveredRace(race)}
                  onMouseLeave={() => setHoveredRace(null)}
                >
                  {/* Round label */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-xs font-condensed text-neutral-gray">
                    R{race.round}
                  </div>

                  {/* Vertical Hover Line */}
                  <div className="absolute inset-y-0 left-1/2 w-[1px] bg-graphite opacity-0 group-hover:opacity-100 transition-opacity z-0" />

                  {/* Cumulative Plot Point */}
                  <div 
                    className="absolute left-1/2 w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 z-10 opacity-50 group-hover:opacity-100 transition-all"
                    style={{ 
                      top: `calc(50% - ${yPos}%)`,
                      backgroundColor: cum.advantage > 0 ? '#E10600' : cum.advantage < 0 ? '#FFFFFF' : '#707070'
                    }}
                  />

                  {/* Connection Line representing the discrete duel result */}
                  <div className="absolute inset-y-8 left-1/2 -translate-x-1/2 w-[2px] z-10 flex items-center justify-center">
                    <div className={clsx(
                      "w-full transition-all duration-300",
                      winnerA ? "bg-racing-red h-full rounded-t-full" : winnerB ? "bg-white h-full rounded-b-full" : "bg-neutral-gray h-1/3",
                      selectedRace?.raceId === race.raceId ? "shadow-[0_0_10px_rgba(225,6,0,0.8)]" : ""
                    )} />
                  </div>

                  {/* Driver A Node */}
                  <button 
                    onClick={() => setSelectedRace(race)}
                    className="absolute inset-0 w-full h-full z-30 cursor-pointer focus:outline-none" 
                    aria-label={`Visualizza dettaglio Gara ${race.round}`}
                  />
                  
                  <div className={clsx(
                    "w-4 h-4 mx-auto rounded-full z-20 border-2 transition-colors pointer-events-none",
                    winnerA ? "bg-racing-red border-racing-red" : "bg-panel border-graphite"
                  )} />

                  {/* Driver B Node */}
                  <div className={clsx(
                    "w-4 h-4 mx-auto rounded-full z-20 border-2 transition-colors pointer-events-none",
                    winnerB ? "bg-white border-white" : "bg-panel border-graphite"
                  )} />
                </div>
              );
            })}

            {/* SVG line connecting cumulative points */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" preserveAspectRatio="none">
              <path 
                d={`M ${cumulativeData.map((d, i) => {
                  const x = (i + 0.5) * (100 / races.length);
                  const y = 50 - ((d.advantage / maxAdvantage) * 50);
                  return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                }).join(' ')}`}
                fill="none"
                stroke="#707070"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="opacity-30"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Hover Info Panel */}
      <div className="h-48 bg-panel border border-graphite p-6 flex flex-col justify-center">
        {hoveredRace ? (
          <div className="grid grid-cols-3 gap-8 w-full max-w-4xl mx-auto">
            <div className="text-right">
              <h4 className="font-condensed text-xl font-bold text-white mb-2">{driverA.name}</h4>
              <div className="text-sm text-text-secondary">Posizione: <span className="text-white font-bold">{hoveredRace.posA}</span></div>
              <div className="text-sm text-text-secondary">Griglia: <span className="text-white font-bold">{hoveredRace.gridA || '-'}</span></div>
              <div className="text-sm text-text-secondary">Punti: <span className="text-white font-bold">{hoveredRace.pointsA}</span></div>
            </div>
            
            <div className="flex flex-col items-center justify-center border-l border-r border-graphite px-8">
              <span className="text-racing-red font-condensed uppercase tracking-widest text-sm mb-1">Gara {hoveredRace.round}</span>
              <span className="font-bold text-xl text-white mb-2">Round {hoveredRace.round}</span>
              {hoveredRace.raceWinner === driverA.id && <span className="text-sm text-racing-red font-bold uppercase">{driverA.name.split(' ').pop()} vince il duello</span>}
              {hoveredRace.raceWinner === driverB.id && <span className="text-sm text-white font-bold uppercase">{driverB.name.split(' ').pop()} vince il duello</span>}
              {!hoveredRace.raceWinner && <span className="text-sm text-neutral-gray uppercase">Nessun vincitore (ritirati)</span>}
            </div>

            <div className="text-left">
              <h4 className="font-condensed text-xl font-bold text-white mb-2">{driverB.name}</h4>
              <div className="text-sm text-text-secondary">Posizione: <span className="text-white font-bold">{hoveredRace.posB}</span></div>
              <div className="text-sm text-text-secondary">Griglia: <span className="text-white font-bold">{hoveredRace.gridB || '-'}</span></div>
              <div className="text-sm text-text-secondary">Punti: <span className="text-white font-bold">{hoveredRace.pointsB}</span></div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-neutral-gray h-full">
            <Info className="w-8 h-8 mb-4 opacity-50" />
            <p className="font-condensed uppercase tracking-widest">Passa sopra una gara per i dettagli</p>
          </div>
        )}
      </div>

      {/* Race Detail Section */}
      {selectedRace && (
        <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
           <RaceSlopeChart race={selectedRace} driverA={driverA} driverB={driverB} />
        </div>
      )}
    </div>
  );
}
