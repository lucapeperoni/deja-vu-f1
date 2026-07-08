'use client';

import { useState } from 'react';
import clsx from 'clsx';
import RaceAnatomyTimeline from './RaceAnatomyTimeline';
import PitCostDumbbell from './PitCostDumbbell';
import OpportunityWindow from './OpportunityWindow';
import { Info, AlertCircle } from 'lucide-react';

export default function RaceAnatomyClient({ data }: { data: any }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const selectedEvent = data.neutralizations.find((n: any) => n.eventId === selectedEventId);

  return (
    <div className="flex flex-col gap-12">
      {/* Overview Section - Race Timeline */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-condensed text-2xl font-bold uppercase text-white">Race Anatomy Timeline</h2>
            <p className="text-sm text-text-secondary">Clicca su una banda di neutralizzazione per analizzare le Opportunity Windows.</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-gray">
              <div className="w-3 h-3 bg-yellow-500/20 border border-yellow-500" />
              Safety Car
            </div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-gray">
              <div className="w-3 h-3 border border-yellow-500 border-dashed" />
              Virtual SC
            </div>
          </div>
        </div>
        
        <RaceAnatomyTimeline 
          data={data} 
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId} 
        />
      </section>

      {/* Analysis Section - Only visible when an event is selected */}
      {selectedEvent ? (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
          
          {/* Opportunity Window (Left) */}
          <div className="bg-panel border border-graphite p-6">
            <h3 className="font-condensed text-xl font-bold uppercase text-white mb-2 flex items-center gap-2">
              <div className={clsx("w-3 h-3 rounded-full", selectedEvent.type === 'Safety Car' ? 'bg-yellow-500' : 'bg-yellow-500/50')} />
              Opportunity Window
            </h3>
            <p className="text-sm text-text-secondary mb-8">
              Chi poteva realisticamente effettuare la sosta al momento del messaggio della Direzione Gara?
            </p>
            <OpportunityWindow data={data} eventId={selectedEventId!} />
          </div>

          {/* Pit Cost Dumbbell (Right) */}
          <div className="bg-panel border border-graphite p-6">
            <h3 className="font-condensed text-xl font-bold uppercase text-white mb-2">
              Neutralization Discount
            </h3>
            <p className="text-sm text-text-secondary mb-8">
              Confronto tra il costo atteso della sosta (Gara Verde) e il costo effettivo ottenuto sotto {selectedEvent.type}.
            </p>
            <PitCostDumbbell data={data} eventId={selectedEventId!} />
          </div>
          
        </section>
      ) : (
        <section className="h-64 border border-graphite border-dashed flex flex-col items-center justify-center text-neutral-gray">
          <Info className="w-8 h-8 mb-4 opacity-50" />
          <h3 className="font-condensed text-xl uppercase tracking-widest">Seleziona un Evento</h3>
          <p className="text-sm">Clicca su una banda gialla nella timeline per esplorare la neutralizzazione.</p>
        </section>
      )}
    </div>
  );
}
