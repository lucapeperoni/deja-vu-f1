import { getRivalries, getConstructorsMap, getDriversMap, Rivalry } from '@/lib/data';
import Link from 'next/link';

export default async function RankingsPage() {
  const rivalries = await getRivalries();
  const driversMap = await getDriversMap();
  const constructorsMap = await getConstructorsMap();

  // Filter to robust samples
  const validRivalries = rivalries.filter(r => r.sharedRaces >= 10);

  // 1. Le Macchine "Illegali"
  // High total points, low TDI (balanced)
  const maxPoints = Math.max(...validRivalries.map(r => r.stats.totalPointsA + r.stats.totalPointsB));
  const illegalCars = [...validRivalries]
    .filter(r => Math.abs(r.metrics.TDI) < 20)
    .sort((a, b) => (b.stats.totalPointsA + b.stats.totalPointsB) - (a.stats.totalPointsA + a.stats.totalPointsB))
    .slice(0, 10);

  // 2. I Distruttori di Compagni
  // Highest absolute TDI
  const destroyers = [...validRivalries]
    .sort((a, b) => Math.abs(b.metrics.TDI) - Math.abs(a.metrics.TDI))
    .slice(0, 10);

  // 3. Guerra Totale
  // Highest Balance Score (closest to 100)
  const wars = [...validRivalries]
    .sort((a, b) => b.metrics.rivalryBalanceScore - a.metrics.rivalryBalanceScore)
    .slice(0, 10);

  const renderRankingCard = (r: Rivalry, index: number, highlightMetric: string) => {
    const dA = driversMap.get(r.driverAId);
    const dB = driversMap.get(r.driverBId);
    const team = constructorsMap.get(r.constructorId);
    
    // For destroyers, figure out who the destroyer is
    let destroyerName = '';
    let victimName = '';
    if (highlightMetric === 'tdi') {
      destroyerName = r.metrics.TDI > 0 ? dA?.name! : dB?.name!;
      victimName = r.metrics.TDI > 0 ? dB?.name! : dA?.name!;
    }

    return (
      <Link href={`/rivalry/${r.id}`} key={r.id} className="block group">
        <div className="bg-panel border border-graphite p-4 flex items-center gap-6 hover:border-racing-red transition-colors relative overflow-hidden">
          {/* Rank Number */}
          <div className="text-4xl font-condensed font-bold text-graphite group-hover:text-racing-red/20 transition-colors w-12 shrink-0">
            #{index + 1}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-xs font-condensed uppercase tracking-widest text-racing-red mb-1 truncate">
              {team?.name} • {r.year}
            </div>
            
            {highlightMetric === 'tdi' ? (
              <div className="font-condensed text-2xl text-white font-bold truncate" title={`${destroyerName} ha distrutto ${victimName}`}>
                {destroyerName} <span className="text-neutral-gray font-normal text-lg">ha distrutto</span> {victimName}
              </div>
            ) : (
              <div className="font-condensed text-2xl text-white font-bold flex gap-2 truncate" title={`${dA?.name} vs ${dB?.name}`}>
                <span className="truncate">{dA?.name}</span> <span className="text-neutral-gray font-normal shrink-0">vs</span> <span className="truncate">{dB?.name}</span>
              </div>
            )}
          </div>

          <div className="text-right shrink-0">
            {highlightMetric === 'points' && (
              <>
                <div className="text-xs uppercase text-neutral-gray tracking-widest">Punti Team</div>
                <div className="font-condensed text-3xl font-bold text-white">{r.stats.totalPointsA + r.stats.totalPointsB}</div>
              </>
            )}
            {highlightMetric === 'tdi' && (
              <>
                <div className="text-xs uppercase text-neutral-gray tracking-widest">TDI</div>
                <div className="font-condensed text-3xl font-bold text-racing-red">{Math.abs(r.metrics.TDI)}</div>
              </>
            )}
            {highlightMetric === 'balance' && (
              <>
                <div className="text-xs uppercase text-neutral-gray tracking-widest">Balance Score</div>
                <div className="font-condensed text-3xl font-bold text-white">{r.metrics.rivalryBalanceScore}</div>
              </>
            )}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <main className="flex-1 bg-background text-foreground py-16 px-6 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <header className="mb-16">
          <h1 className="font-condensed text-5xl font-bold uppercase tracking-wide">Hall of Teammates</h1>
          <p className="text-text-secondary mt-2 text-xl">
            I record storici che rispondono alla domanda: Macchina o Pilota? (Minimo 10 gare insieme)
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Column 1 */}
          <div className="space-y-6">
            <div>
              <h2 className="font-condensed text-3xl font-bold uppercase text-white mb-2">Le Macchine "Illegali"</h2>
              <p className="text-sm text-text-secondary mb-6">
                Dominio totale dei punti, ma con piloti vicinissimi tra loro (TDI quasi zero). Il merito è tutto dell'ingegneria.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {illegalCars.map((r, i) => renderRankingCard(r, i, 'points'))}
            </div>
          </div>

          {/* Column 2 */}
          <div className="space-y-6">
            <div>
              <h2 className="font-condensed text-3xl font-bold uppercase text-racing-red mb-2">I Distruttori</h2>
              <p className="text-sm text-text-secondary mb-6">
                I divari più estremi della storia a parità di vettura (Massimo TDI). Qui vedi il talento puro che sovrasta il compagno.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {destroyers.map((r, i) => renderRankingCard(r, i, 'tdi'))}
            </div>
          </div>

          {/* Column 3 */}
          <div className="space-y-6">
            <div>
              <h2 className="font-condensed text-3xl font-bold uppercase text-white mb-2">Guerra Totale</h2>
              <p className="text-sm text-text-secondary mb-6">
                Le rivalità statisticamente più equilibrate in assoluto. Battaglie punto su punto in cui nessuno dei due ha mai ceduto.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {wars.map((r, i) => renderRankingCard(r, i, 'balance'))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
