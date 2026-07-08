import RaceAnatomyClient from './RaceAnatomyClient';
import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';

export default async function RacePage({ params }: { params: { id: string } }) {
  // We will load the JSON from public/data/race-anatomy-[id].json
  const filePath = path.join(process.cwd(), 'public', 'data', `race-anatomy-mock.json`); // Forcing mock for demo
  
  if (!fs.existsSync(filePath)) {
    return notFound();
  }

  const fileData = fs.readFileSync(filePath, 'utf-8');
  const raceData = JSON.parse(fileData);

  return (
    <main className="flex-1 bg-background text-foreground py-10 px-6 min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-12 border-b border-graphite pb-6 flex items-end justify-between">
          <div>
            <div className="text-racing-red font-condensed tracking-widest text-sm uppercase mb-2">
              Round {raceData.round} • {raceData.season}
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
