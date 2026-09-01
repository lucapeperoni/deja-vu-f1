"use client";

// Wrapper client della demo (roadmap S2.1): tiene lo stato dei chip emessi
// da EventPicker, che page.tsx (server, legge il catalogo da fs) non può
// tenere da solo.

import { useState } from "react";
import EventPicker from "@/components/scenario/EventPicker";
import type { CatalogEventEntry } from "@/lib/eventCatalog";
import type { EventoChip } from "@/lib/scenarioMatch";

interface Props {
  catalog: CatalogEventEntry[];
}

export default function DemoClient({ catalog }: Props) {
  const [emessi, setEmessi] = useState<EventoChip[]>([]);

  function handleEmit(chip: EventoChip) {
    console.log("EventPicker onEmit:", chip);
    setEmessi((prev) => [chip, ...prev]);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      <EventPicker catalog={catalog} onEmit={handleEmit} />

      <div>
        <h2 className="font-condensed text-lg font-bold text-white uppercase mb-3">Chip emessi ({emessi.length})</h2>
        {emessi.length === 0 && <p className="text-sm text-neutral-gray">Nessun chip ancora. Scegli una voce foglia nel menu.</p>}
        <ul className="flex flex-col gap-2">
          {emessi.map((chip, i) => (
            <li key={`${chip.id}-${i}`} className="bg-panel border border-graphite rounded-sm p-3">
              <div className="text-white text-sm">{chip.label}</div>
              <pre className="text-xs text-neutral-gray mt-1 overflow-x-auto">{JSON.stringify(chip, null, 2)}</pre>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
