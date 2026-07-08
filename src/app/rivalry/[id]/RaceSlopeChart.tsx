'use client';

import { RaceComparison, DriverIndex } from '@/lib/data';
import clsx from 'clsx';
import { Flag, Timer } from 'lucide-react';

interface Props {
  race: RaceComparison;
  driverA: DriverIndex;
  driverB: DriverIndex;
}

export default function RaceSlopeChart({ race, driverA, driverB }: Props) {
  // Slope chart parameters
  const MAX_POS = 20; // typical F1 grid size
  const chartHeight = 300;
  
  const getPosHeight = (pos: number | null) => {
    if (!pos || pos > MAX_POS) return chartHeight; // bottom for DNF or out of bounds
    return ((pos - 1) / (MAX_POS - 1)) * chartHeight;
  };

  const gridA_y = getPosHeight(race.gridA);
  const posA_y = getPosHeight(race.posA);
  const gridB_y = getPosHeight(race.gridB);
  const posB_y = getPosHeight(race.posB);

  const deltaA = (race.gridA && race.posA) ? race.gridA - race.posA : null;
  const deltaB = (race.gridB && race.posB) ? race.gridB - race.posB : null;
  
  const formatDelta = (delta: number | null) => {
    if (delta === null) return '';
    if (delta > 0) return `+${delta}`;
    if (delta < 0) return `${delta}`;
    return '=';
  };

  const getStatusText = (statusId: number) => {
    // 1 is Finished, 11-19 usually laps down, etc. 
    // We simplify based on common F1 status IDs
    if (statusId === 1) return 'Al traguardo';
    if (statusId >= 11 && statusId <= 19) return 'Doppiato';
    if (statusId === 3 || statusId === 4) return 'Incidente';
    return 'Ritiro / Problema Tecnico';
  };

  return (
    <div className="bg-panel border border-graphite p-8">
      <div className="mb-6 flex justify-between items-center border-b border-graphite pb-4">
        <h3 className="font-condensed text-3xl font-bold uppercase tracking-wider text-white flex items-center gap-3">
          <Flag className="text-racing-red w-6 h-6" />
          Dettaglio Gara {race.round}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 items-stretch h-auto min-h-[400px]">
        
        {/* Left Column: Drivers Info */}
        <div className="flex flex-col gap-6">
          
          {/* Driver A Info */}
          <div className="flex flex-col justify-between items-start text-left border border-racing-red/30 bg-racing-red/5 p-4 rounded-sm flex-1">
            <div className="w-full">
              <h4 className="text-3xl font-condensed font-bold text-racing-red mb-2">{driverA.name}</h4>
              
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div>
                  <dt className="text-xs font-condensed uppercase text-racing-red/70 tracking-widest">Griglia</dt>
                  <dd className="text-3xl font-bold text-racing-red">{race.gridA || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-condensed uppercase text-racing-red/70 tracking-widest">Arrivo</dt>
                  <dd className="text-3xl font-bold text-racing-red">{race.posA}</dd>
                </div>
                <div>
                  <dt className="text-xs font-condensed uppercase text-racing-red/70 tracking-widest">Punti</dt>
                  <dd className="text-xl font-bold text-racing-red">+{race.pointsA}</dd>
                </div>
              </div>
            </div>
            
            <div className="text-sm font-bold text-racing-red mt-6 bg-racing-red/10 px-3 py-1 rounded-sm w-full uppercase tracking-wider text-center">
              Status: {getStatusText(race.statusA)}
            </div>
          </div>

          {/* Driver B Info */}
          <div className="flex flex-col justify-between items-start text-left border border-white/20 bg-white/5 p-4 rounded-sm flex-1">
            <div className="w-full">
              <h4 className="text-3xl font-condensed font-bold text-white mb-2">{driverB.name}</h4>
              
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div>
                  <dt className="text-xs font-condensed uppercase text-white/50 tracking-widest">Griglia</dt>
                  <dd className="text-3xl font-bold text-white">{race.gridB || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-condensed uppercase text-white/50 tracking-widest">Arrivo</dt>
                  <dd className="text-3xl font-bold text-white">{race.posB}</dd>
                </div>
                <div>
                  <dt className="text-xs font-condensed uppercase text-white/50 tracking-widest">Punti</dt>
                  <dd className="text-xl font-bold text-white">+{race.pointsB}</dd>
                </div>
              </div>
            </div>
            
            <div className="text-sm font-bold text-white mt-6 bg-white/10 px-3 py-1 rounded-sm w-full uppercase tracking-wider text-center">
              Status: {getStatusText(race.statusB)}
            </div>
          </div>

        </div>

        {/* Right Column: Slope Chart */}
        <div className="relative border border-graphite bg-background h-[400px] px-8 py-6 flex flex-col justify-between rounded-sm">
          <div className="flex justify-between text-xs font-condensed uppercase text-neutral-gray tracking-widest mb-4">
            <span>Partenza (Griglia)</span>
            <span>Arrivo (Posizione)</span>
          </div>

          <div className="relative flex-1" style={{ height: chartHeight }}>
            {/* Horizontal Grid lines */}
            {[1, 5, 10, 15, 20].map(pos => (
              <div 
                key={pos} 
                className="absolute w-full border-t border-graphite/30 z-0 flex items-center"
                style={{ top: getPosHeight(pos) }}
              >
                <span className="text-[10px] text-graphite font-bold absolute -left-6 -translate-y-1/2">{pos}</span>
                <span className="text-[10px] text-graphite font-bold absolute -right-6 -translate-y-1/2">{pos}</span>
              </div>
            ))}

            <svg className="absolute inset-0 w-full h-full overflow-visible z-10" preserveAspectRatio="none">
              <defs>
                <linearGradient id="gradientA" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#E10600" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#E10600" stopOpacity="1" />
                </linearGradient>
                <linearGradient id="gradientB" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                </linearGradient>
              </defs>

              {/* Line A */}
              {race.gridA && race.posA && (
                <>
                  <line x1="0%" y1={gridA_y} x2="100%" y2={posA_y} stroke="url(#gradientA)" strokeWidth="4" />
                  <circle cx="0%" cy={gridA_y} r="6" fill="#E10600" />
                  <circle cx="100%" cy={posA_y} r="6" fill="#E10600" />
                  <text x="2%" y={gridA_y - 10} fill="#E10600" fontSize="14" fontWeight="bold" fontFamily="sans-serif">P {race.gridA}</text>
                  <text x="98%" y={posA_y - 10} fill="#E10600" fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="end">P {race.posA}</text>
                  
                  {/* Delta Badge A */}
                  {deltaA !== null && (
                    <g transform={`translate(200, ${(gridA_y + posA_y) / 2})`}>
                      <rect x="-20" y="-12" width="40" height="24" rx="12" fill="#E10600" />
                      <text x="0" y="4" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">{formatDelta(deltaA)}</text>
                    </g>
                  )}
                </>
              )}

              {/* Line B */}
              {race.gridB && race.posB && (
                <>
                  <line x1="0%" y1={gridB_y} x2="100%" y2={posB_y} stroke="url(#gradientB)" strokeWidth="4" />
                  <circle cx="0%" cy={gridB_y} r="6" fill="#ffffff" />
                  <circle cx="100%" cy={posB_y} r="6" fill="#ffffff" />
                  <text x="2%" y={gridB_y + 20} fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="sans-serif">P {race.gridB}</text>
                  <text x="98%" y={posB_y + 20} fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="end">P {race.posB}</text>
                  
                  {/* Delta Badge B */}
                  {deltaB !== null && (
                    <g transform={`translate(200, ${(gridB_y + posB_y) / 2})`}>
                      <rect x="-20" y="-12" width="40" height="24" rx="12" fill="#ffffff" />
                      <text x="0" y="4" fill="#080808" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">{formatDelta(deltaB)}</text>
                    </g>
                  )}
                </>
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
