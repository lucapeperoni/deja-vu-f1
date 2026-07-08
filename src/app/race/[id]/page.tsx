import RaceAnatomyClient from './RaceAnatomyClient';
import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  // We load the JSON from public/data/races/[id].json
  const filePath = path.join(process.cwd(), 'public', 'data', 'races', `${resolvedParams.id}.json`);
  
  if (!fs.existsSync(filePath)) {
    return notFound();
  }

  const fileData = fs.readFileSync(filePath, 'utf-8');
  const rawData = JSON.parse(fileData);

  // Map backend data format to frontend expectations
  const pitStops = (rawData.pit_stops || []).map((pit: any, idx: number) => ({
    ...pit,
    driverId: pit.driverNumber?.toString() || `unknown-${idx}`,
    lap: pit.lapNumber || 0,
    expectedGreenLoss: pit.baselineCost || 20,
    observedLoss: pit.pitDuration || 20,
    neutralizationDiscount: pit.neutralizationDiscount || 0,
  }));

  // Create a basic drivers list from the unique drivers in pit stops
  const uniqueDriverIds = Array.from(new Set(pitStops.map((p: any) => p.driverId)));
  const drivers = uniqueDriverIds.map((id: any, index: number) => ({
    id,
    name: `Driver ${id}`,
    color: `hsl(${(index * 360) / Math.max(1, uniqueDriverIds.length)}, 70%, 50%)`,
  }));

  const raceData = {
    ...rawData,
    pitStops,
    drivers,
    opportunityWindows: rawData.opportunityWindows || []
  };

  return (
    <main className="flex-1 bg-background text-foreground py-10 px-6 min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-12 border-b border-graphite pb-6 flex items-end justify-between">
          <div>
            <div className="text-racing-red font-condensed tracking-widest text-sm uppercase mb-2">
              {raceData.country} • {raceData.season}
            </div>
            <h1 className="font-condensed text-5xl font-bold uppercase text-white">
              {raceData.raceName}
            </h1>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-panel border border-graphite px-4 py-2 text-center">
              <div className="text-xs uppercase text-neutral-gray tracking-widest mb-1">Giri</div>
              <div className="text-xl font-bold text-white font-condensed">{raceData.totalLaps}</div>
            </div>
            <div className="bg-panel border border-graphite px-4 py-2 text-center">
              <div className="text-xs uppercase text-neutral-gray tracking-widest mb-1">Neutralizzazioni</div>
              <div className="text-xl font-bold text-racing-red font-condensed">{raceData.neutralizations.length}</div>
            </div>
          </div>
        </header>

        <RaceAnatomyClient data={raceData} />
      </div>
    </main>
  );
}
