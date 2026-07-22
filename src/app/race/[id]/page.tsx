import RaceAnatomyClient from './RaceAnatomyClient';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import type { RaceData, RaceStory } from './RaceAnatomyTimeline';

// Vista 7 (docs/PROGETTAZIONE.md, sezione 7 e 5.5): "il capitolo
// neutralizzazioni". Le viste v2 qui sotto (race trace, sconti, matrice,
// compagni di squadra — RaceAnatomyClient e figli) NON sono state
// riscritte, solo reinquadrate: l'unica aggiunta è l'intestazione che
// dichiara apertamente la finestra 2023-2024 e la fonte OpenF1, diversa dal
// resto del sito (Ergast/CSV, 1950-2024) — la "regola vincolante" di
// sezione 5.2 applicata anche qui, non solo al catalogo v3.

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  // Il JSON è generato dalla pipeline (data-layer/scripts/build_all.py,
  // task 2.1), schema descritto in docs/PROGETTAZIONE.md sezione 6.
  const filePath = path.join(process.cwd(), 'public', 'data', 'races', `${resolvedParams.id}.json`);

  if (!fs.existsSync(filePath)) {
    return notFound();
  }

  const fileData = fs.readFileSync(filePath, 'utf-8');
  const raceData: RaceData = JSON.parse(fileData);

  // Livello narrativo delle 3 gare-caso (task 5.1, docs/PROGETTAZIONE.md
  // sezione 9): solo queste hanno una voce in stories.json, le altre
  // gare funzionano come prima (story resta null).
  const storiesPath = path.join(process.cwd(), 'public', 'data', 'stories.json');
  const stories: Record<string, RaceStory> = fs.existsSync(storiesPath)
    ? JSON.parse(fs.readFileSync(storiesPath, 'utf-8'))
    : {};
  const story = stories[resolvedParams.id] ?? null;

  return (
    <main className="flex-1 bg-background text-foreground py-10 px-6 min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-8 bg-panel border border-graphite p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 mb-2">
            <div className="text-racing-red font-condensed tracking-widest text-sm uppercase">
              Il capitolo neutralizzazioni
            </div>
            <Link href={`/gara/${resolvedParams.id}`} className="text-sm text-racing-red hover:underline">
              ← Torna alla scheda gara
            </Link>
          </div>
          <p className="text-sm text-text-secondary max-w-3xl">
            Finestra: <span className="text-white">2023–2024</span>, <span className="text-white">46 gare</span>,
            fonte <span className="text-white">OpenF1</span> (dati giro per giro di Safety Car e Virtual Safety
            Car). Copertura diversa dal resto del sito, che si basa sui CSV storici Ergast (1950–2024): OpenF1
            fornisce la telemetria delle neutralizzazioni solo per le stagioni più recenti, quindi questa famiglia
            di eventi non è confrontabile in rarità con le altre — la finestra è dichiarata qui e ovunque nel
            compositore.
          </p>
          <p className="text-xs text-neutral-gray mt-3 max-w-3xl">
            Limite noto: sotto Virtual Safety Car (finestre di 1-2 giri) i numeri restano meno puliti che sotto
            Safety Car piena — l&apos;allineamento per giro intero non cattura in che punto esatto del giro è
            scattata la neutralizzazione.
          </p>
        </div>

        <header className="mb-12 border-b border-graphite pb-6 flex items-end justify-between">
          <div>
            <div className="text-racing-red font-condensed tracking-widest text-sm uppercase mb-2">
              {raceData.race.country} • {raceData.race.year}
            </div>
            <h1 className="font-condensed text-5xl font-bold uppercase text-white">
              {raceData.race.name}
            </h1>
          </div>

          <div className="flex gap-4">
            <div className="bg-panel border border-graphite px-4 py-2 text-center">
              <div className="text-xs uppercase text-neutral-gray tracking-widest mb-1">Giri</div>
              <div className="text-xl font-bold text-white font-condensed">{raceData.race.laps}</div>
            </div>
            <div className="bg-panel border border-graphite px-4 py-2 text-center">
              <div className="text-xs uppercase text-neutral-gray tracking-widest mb-1">Neutralizzazioni</div>
              <div className="text-xl font-bold text-racing-red font-condensed">{raceData.neutralizations.length}</div>
            </div>
            <div className="bg-panel border border-graphite px-4 py-2 text-center">
              <div className="text-xs uppercase text-neutral-gray tracking-widest mb-1">Prezzo di listino</div>
              <div className="text-xl font-bold text-white font-condensed">
                {raceData.race.nominalPitLoss != null ? `${raceData.race.nominalPitLoss.toFixed(1)}s` : 'n/d'}
              </div>
            </div>
          </div>
        </header>

        <RaceAnatomyClient raceData={raceData} story={story} />
      </div>
    </main>
  );
}
