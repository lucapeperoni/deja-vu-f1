'use client';

interface Props {
  data: any;
  eventId: string;
}

export default function PitCostDumbbell({ data, eventId }: Props) {
  const { pitStops, drivers } = data;
  
  // Filter pit stops that occurred during this event
  const eventPits = pitStops.filter((p: any) => p.eventId === eventId);

  if (eventPits.length === 0) {
    return (
      <div className="text-text-secondary text-sm italic">
        Nessun pit stop strategico registrato durante questa neutralizzazione.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex gap-6 border-b border-graphite pb-4 text-xs font-condensed uppercase tracking-widest text-neutral-gray">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-neutral-gray" /> Costo Gara Verde
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white" /> Costo Reale (Scontato)
        </div>
      </div>

      {eventPits.map((pit: any, idx: number) => {
        const driver = drivers.find((d: any) => d.id === pit.driverId);
        if (!driver) return null;

        // Scale: Let's assume max pit loss is ~25s for scaling purposes
        const MAX_LOSS = 26; 
        const greenPerc = (pit.expectedGreenLoss / MAX_LOSS) * 100;
        const observedPerc = (pit.observedLoss / MAX_LOSS) * 100;
        
        return (
          <div key={idx} className="relative pt-4 pb-2">
            
            {/* Driver Info */}
            <div className="flex justify-between items-end mb-2">
              <div className="font-condensed font-bold text-lg text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: driver.color }} />
                {driver.name}
              </div>
              <div className="text-xs text-racing-red font-condensed tracking-widest font-bold">
                Sconto: {pit.neutralizationDiscount.toFixed(1)}s
              </div>
            </div>

            {/* Dumbbell Chart Track */}
            <div className="h-8 bg-graphite/30 relative border-l border-r border-graphite">
              
              {/* Green Point (Base cost) */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-neutral-gray bg-panel z-10"
                style={{ left: `calc(${greenPerc}% - 8px)` }}
                title={`Costo Verde Atteso: ${pit.expectedGreenLoss}s`}
              />
              <div className="absolute top-full mt-1 text-xs text-neutral-gray font-condensed" style={{ left: `calc(${greenPerc}% - 10px)` }}>
                {pit.expectedGreenLoss}s
              </div>

              {/* Observed Point */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white z-10"
                style={{ left: `calc(${observedPerc}% - 8px)` }}
                title={`Costo Sotto Neutralizzazione: ${pit.observedLoss}s`}
              />
              <div className="absolute top-full mt-1 text-xs text-white font-condensed font-bold" style={{ left: `calc(${observedPerc}% - 10px)` }}>
                {pit.observedLoss}s
              </div>

              {/* Connecting line (Discount) */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 h-1 bg-gradient-to-l from-neutral-gray to-white z-0"
                style={{ 
                  left: `${observedPerc}%`, 
                  width: `${greenPerc - observedPerc}%` 
                }}
              />
              
            </div>
          </div>
        );
      })}
    </div>
  );
}
