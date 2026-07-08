'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Rivalry, DriverIndex, ConstructorIndex } from '@/lib/data';
import clsx from 'clsx';

interface Props {
  initialRivalries: Rivalry[];
  drivers: Record<string, DriverIndex>;
  constructors: Record<string, ConstructorIndex>;
}

export default function RivalryGridInteractive({ initialRivalries, drivers, constructors }: Props) {
  const [minRaces, setMinRaces] = useState(5);
  const [decade, setDecade] = useState<string>('all');

  const filtered = useMemo(() => {
    return initialRivalries.filter(r => {
      if (r.sharedRaces < minRaces) return false;
      if (decade !== 'all') {
        const start = parseInt(decade);
        if (r.year < start || r.year >= start + 10) return false;
      }
      return true;
    });
  }, [initialRivalries, minRaces, decade]);

  // Extract unique years and constructors for axes
  const years = Array.from(new Set(filtered.map(r => r.year))).sort((a, b) => b - a);
  const constructorIds = Array.from(new Set(filtered.map(r => r.constructorId)));
  
  // Sort constructors by name
  constructorIds.sort((a, b) => {
    const nameA = constructors[a]?.name || '';
    const nameB = constructors[b]?.name || '';
    return nameA.localeCompare(nameB);
  });

  // Create lookup matrix
  const matrix: Record<number, Record<number, Rivalry[]>> = {};
  filtered.forEach(r => {
    if (!matrix[r.constructorId]) matrix[r.constructorId] = {};
    if (!matrix[r.constructorId][r.year]) matrix[r.constructorId][r.year] = [];
    matrix[r.constructorId][r.year].push(r);
  });

  const getTDIColor = (tdi: number) => {
    const absTdi = Math.abs(tdi);
    // Dark grey (0) to Racing Red (100)
    if (absTdi < 20) return 'bg-neutral-gray';
    if (absTdi < 50) return 'bg-dark-red';
    return 'bg-racing-red';
  };

  return (
    <div className="flex flex-col flex-1 h-full">
      {/* Controls */}
      <div className="flex flex-wrap gap-6 mb-6 p-4 bg-panel border border-graphite">
        <label className="flex items-center gap-3">
          <span className="text-sm font-condensed uppercase text-neutral-gray">Min gare condivise:</span>
          <input 
            type="range" min="1" max="20" value={minRaces} 
            onChange={e => setMinRaces(parseInt(e.target.value))}
            className="accent-racing-red"
          />
          <span className="font-bold w-6">{minRaces}</span>
        </label>

        <label className="flex items-center gap-3">
          <span className="text-sm font-condensed uppercase text-neutral-gray">Decade:</span>
          <select 
            value={decade} 
            onChange={e => setDecade(e.target.value)}
            className="bg-background border border-graphite text-white px-2 py-1 outline-none focus:border-racing-red"
          >
            <option value="all">Tutte</option>
            <option value="2020">2020s</option>
            <option value="2010">2010s</option>
            <option value="2000">2000s</option>
            <option value="1990">1990s</option>
            <option value="1980">1980s</option>
            <option value="1970">1970s</option>
            <option value="1960">1960s</option>
            <option value="1950">1950s</option>
          </select>
        </label>
      </div>

      {/* Grid */}
      <div className="overflow-auto flex-1 border border-graphite bg-panel p-4 relative">
        <div className="inline-flex flex-col min-w-full">
          {/* Header Row (Years) */}
          <div className="flex mb-2 sticky top-0 bg-panel z-20">
            <div className="w-40 shrink-0 sticky left-0 bg-panel z-30" /> {/* Top Left Corner */}
            {years.map(y => (
              <div key={y} className="w-10 shrink-0 text-center font-condensed text-xs text-neutral-gray">
                {y.toString().slice(2)}
              </div>
            ))}
          </div>

          {/* Constructor Rows */}
          {constructorIds.map(cid => (
            <div key={cid} className="flex mb-1 group">
              {/* Constructor Label */}
              <div className="w-40 shrink-0 sticky left-0 bg-panel z-10 text-xs font-medium truncate pr-4 text-text-secondary group-hover:text-white transition-colors flex items-center">
                {constructors[cid]?.name}
              </div>

              {/* Year Cells */}
              {years.map(y => {
                const cellRivalries = matrix[cid]?.[y] || [];
                return (
                  <div key={y} className="w-10 h-8 shrink-0 flex items-center justify-center p-[1px]">
                    {cellRivalries.length > 0 ? (
                      <div className="w-full h-full flex flex-col gap-[1px]">
                        {cellRivalries.map(r => (
                          <Link 
                            key={r.id} 
                            href={`/rivalry/${r.id}`}
                            title={`${drivers[r.driverAId]?.name} vs ${drivers[r.driverBId]?.name} (TDI: ${r.metrics.TDI})`}
                            className={clsx(
                              "flex-1 w-full hover:ring-1 hover:ring-white transition-all",
                              getTDIColor(r.metrics.TDI),
                              r.sharedRaces < 10 ? "opacity-50" : "opacity-100" // fade low sample sizes
                            )}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="w-full h-full bg-graphite/20" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
