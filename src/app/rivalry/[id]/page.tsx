import { getRivalries, getDriversMap, getConstructorsMap, getRivalryRaceComparisons } from '@/lib/data';
import DuelTimeline from './DuelTimeline';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function RivalryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const rivalries = await getRivalries();
  const rivalry = rivalries.find(r => r.id === resolvedParams.id);
  
  if (!rivalry) return notFound();

  const drivers = await getDriversMap();
  const constructors = await getConstructorsMap();
  const races = await getRivalryRaceComparisons(
    rivalry.driverAId, 
    rivalry.driverBId, 
    rivalry.year, 
    rivalry.constructorId
  );

  const driverA = drivers.get(rivalry.driverAId);
  const driverB = drivers.get(rivalry.driverBId);
  const team = constructors.get(rivalry.constructorId);

  return (
    <main className="flex-1 flex flex-col bg-background min-h-screen p-6">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
        <Link href="/grid" className="inline-flex items-center gap-2 text-text-secondary hover:text-white mb-8 w-fit transition-colors">
          <ArrowLeft className="w-4 h-4" /> Torna alla Grid
        </Link>
        
        {/* Header */}
        <header className="mb-12 border-b border-graphite pb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <div className="text-racing-red font-condensed tracking-widest uppercase mb-2">
                {team?.name} • {rivalry.year}
              </div>
              <h1 className="font-condensed text-5xl font-bold uppercase tracking-wide flex items-center gap-4 flex-wrap">
                <span>{driverA?.name}</span>
                <span className="text-neutral-gray text-3xl">vs</span>
                <span>{driverB?.name}</span>
              </h1>
            </div>
            
            <div className="flex gap-8">
              <div className="flex flex-col">
                <span className="text-xs uppercase text-neutral-gray tracking-widest">TDI</span>
                <span className="font-condensed text-4xl font-bold">{Math.abs(rivalry.metrics.TDI)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase text-neutral-gray tracking-widest">Balance</span>
                <span className="font-condensed text-4xl font-bold text-text-secondary">{rivalry.metrics.rivalryBalanceScore}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Duel Timeline Component */}
        <DuelTimeline 
          races={races} 
          driverA={driverA!} 
          driverB={driverB!} 
          stats={rivalry.stats} 
        />
      </div>
    </main>
  );
}
