'use client';

import clsx from 'clsx';

interface Props {
  data: any;
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}

export default function RaceAnatomyTimeline({ data, selectedEventId, onSelectEvent }: Props) {
  const totalLaps = data?.totalLaps || 0;
  const neutralizations = data?.neutralizations || [];
  const pitStops = data?.pitStops || [];
  const drivers = data?.drivers || [];

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-8 relative overflow-x-auto hide-scrollbar">
      <div className="min-w-[1000px] h-64 relative">
        
        {/* Lap grid lines */}
        <div className="absolute inset-x-0 bottom-0 top-0 flex justify-between z-0 opacity-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-full w-[1px] bg-white relative">
              <span className="absolute -bottom-6 -translate-x-1/2 text-xs font-condensed">
                L{Math.floor((i / 9) * totalLaps)}
              </span>
            </div>
          ))}
        </div>

        {/* Neutralization Bands */}
        {neutralizations.map((n: any) => {
          const leftPerc = (n.startLap / totalLaps) * 100;
          const widthPerc = ((n.endLap - n.startLap) / totalLaps) * 100;
          const isSelected = selectedEventId === n.eventId;

          return (
            <button
              key={n.eventId}
              onClick={() => onSelectEvent(n.eventId)}
              className={clsx(
                "absolute top-0 bottom-0 z-10 transition-all duration-300 focus:outline-none group cursor-pointer border-x",
                n.type === 'Safety Car' ? "bg-yellow-500/10 hover:bg-yellow-500/30 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]" : "bg-yellow-500/5 hover:bg-yellow-500/15 border-yellow-500/30 border-dashed",
                isSelected ? "border-yellow-500 ring-1 ring-yellow-500/50 bg-yellow-500/20" : ""
              )}
              style={{ left: `${leftPerc}%`, width: `${widthPerc}%` }}
            >
              <div className="absolute top-2 left-1/2 -translate-x-1/2 font-condensed text-xs font-bold text-yellow-500">
                {n.type === 'Safety Car' ? 'SC' : 'VSC'}
              </div>
            </button>
          );
        })}

        {/* Pit Stops (Scatter) */}
        {pitStops.map((pit: any, idx: number) => {
          const driver = drivers.find((d: any) => d.id === pit.driverId);
          if (!driver) return null;
          
          const leftPerc = (pit.lap / totalLaps) * 100;
          // Just pseudo-randomizing vertical position for visualization spread
          const topPerc = 20 + ((idx % 4) * 20); 

          return (
            <div 
              key={idx}
              className="absolute w-4 h-4 rounded-full border border-black z-20 group -translate-x-1/2 -translate-y-1/2 shadow-lg hover:scale-150 hover:z-40 transition-all duration-300 cursor-pointer"
              style={{ left: `${leftPerc}%`, top: `${topPerc}%`, backgroundColor: driver.color, boxShadow: `0 0 10px ${driver.color}80` }}
            >
              <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-3 bg-black/80 backdrop-blur-md border border-white/20 rounded-md px-3 py-2 text-xs whitespace-nowrap z-50 transition-all duration-300 shadow-xl pointer-events-none translate-y-2 group-hover:translate-y-0">
                <span className="font-bold text-white">{driver.name}</span> (Lap {pit.lap})
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
