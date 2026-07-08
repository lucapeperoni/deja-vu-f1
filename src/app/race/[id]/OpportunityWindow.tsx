'use client';

import clsx from 'clsx';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface Props {
  data: any;
  eventId: string;
}

export default function OpportunityWindow({ data, eventId }: Props) {
  const { opportunityWindows, drivers } = data;
  
  const windows = opportunityWindows?.filter((w: any) => w.eventId === eventId) || [];

  if (windows.length === 0) {
    return (
      <div className="text-text-secondary text-sm italic">
        Nessun dato dettagliato sulla finestra di opportunità per questo evento.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {windows.map((w: any, idx: number) => {
        const driver = drivers.find((d: any) => d.id === w.driverId);
        if (!driver) return null;

        const isEligible = w.eligibility === 'Eligible';
        const isPassed = w.eligibility === 'Passed Pit Entry';
        
        return (
          <div key={idx} className="bg-background border border-graphite p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1 h-12 rounded-sm" style={{ backgroundColor: driver.color }} />
              <div>
                <h4 className="font-condensed font-bold text-lg text-white">{driver.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  {isEligible ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : isPassed ? (
                    <XCircle className="w-4 h-4 text-racing-red" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className={clsx(
                    "text-xs font-condensed uppercase tracking-widest",
                    isEligible ? "text-green-500" : isPassed ? "text-racing-red" : "text-yellow-500"
                  )}>
                    {w.eligibility}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-neutral-gray mb-1">Distanza Pit Entry</div>
              <div className={clsx(
                "font-condensed font-bold text-xl",
                w.estimatedSecondsToPit < 0 ? "text-racing-red" : "text-white"
              )}>
                {w.estimatedSecondsToPit > 0 ? `+${w.estimatedSecondsToPit}s` : 'Oltrepassata'}
              </div>
            </div>

            <div className="text-right pl-6 border-l border-graphite">
              <div className="text-xs text-neutral-gray mb-1">Azione</div>
              <div className={clsx(
                "font-condensed uppercase font-bold tracking-wider",
                w.action === 'Pitted' ? "text-white" : "text-text-secondary"
              )}>
                {w.action}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
