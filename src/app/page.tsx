import Link from 'next/link';
import { ArrowRight, Activity, Crosshair, Flag } from 'lucide-react';
import fs from 'fs';
import path from 'path';

export default async function Home() {
  // Read all race JSONs
  const racesDir = path.join(process.cwd(), 'public', 'data', 'races');
  let availableRaces: any[] = [];
  
  if (fs.existsSync(racesDir)) {
    const files = fs.readdirSync(racesDir).filter(f => f.endsWith('.json'));
    availableRaces = files.map(filename => {
      const filePath = path.join(racesDir, filename);
      const fileData = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileData);
      return {
        id: filename.replace('.json', ''),
        country: data.country,
        season: data.season,
        name: data.raceName,
        totalLaps: data.totalLaps,
        neutralizations: data.neutralizations?.length || 0,
      };
    });
  }

  return (
    <main className="flex-1 flex flex-col bg-background min-h-screen">
      {/* Hero Section */}
      <section className="relative px-6 py-24 flex flex-col items-center justify-center border-b border-graphite overflow-hidden">
        {/* Background Decorative */}
        <div className="absolute inset-0 bg-texture-grid opacity-20 pointer-events-none" />
        <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-racing-red to-transparent opacity-50" />
        
        <div className="relative z-10 text-center max-w-4xl mx-auto space-y-6">
          <div className="inline-block px-4 py-1 border border-racing-red/30 bg-racing-red/10 text-racing-red font-condensed tracking-widest text-sm uppercase rounded-sm mb-4">
            Advanced F1 Analytics
          </div>
          
          <h1 className="font-condensed text-6xl md:text-8xl font-bold uppercase tracking-tight text-white drop-shadow-lg">
            Race <span className="text-racing-red">Dynamics</span>
          </h1>
          
          <h2 className="text-2xl md:text-3xl text-text-secondary font-medium tracking-wide">
            Le forze invisibili che cambiano una gara
          </h2>
          
          <p className="text-lg text-neutral-gray max-w-2xl mx-auto leading-relaxed mt-8">
            Il risultato finale mostra dove sono arrivati i piloti. Race Dynamics mostra come la gara è stata trasformata. 
            Esplora l'impatto reale di Safety Car, Virtual Safety Car e l'arte dei pit stop strategici.
          </p>
        </div>
      </section>

      {/* Available Races Section */}
      <section className="px-6 py-20 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-10">
          <Flag className="text-racing-red w-8 h-8" />
          <h3 className="font-condensed text-4xl font-bold uppercase text-white">Gare Disponibili</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableRaces.map((race) => (
            <Link 
              key={race.id} 
              href={`/race/${race.id}`}
              className="group block bg-panel border border-graphite hover:border-racing-red hover:shadow-[0_0_30px_rgba(220,0,0,0.15)] transition-all duration-300 relative overflow-hidden"
            >
              {/* Hover gradient effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-racing-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-xs font-bold text-racing-red tracking-widest uppercase bg-racing-red/10 px-2 py-1 rounded-sm">
                    {race.season}
                  </div>
                  <ArrowRight className="w-5 h-5 text-neutral-gray group-hover:text-racing-red group-hover:-rotate-45 transition-all duration-300" />
                </div>
                
                <h4 className="font-condensed text-3xl text-white font-bold uppercase tracking-tight mb-1 group-hover:translate-x-1 transition-transform">
                  {race.country}
                </h4>
                <div className="text-text-secondary text-sm mb-6 uppercase tracking-wider">{race.name}</div>
                
                <div className="flex gap-4 border-t border-graphite/50 pt-4">
                  <div>
                    <div className="text-[10px] text-neutral-gray uppercase tracking-widest">Giri</div>
                    <div className="text-white font-condensed font-bold">{race.totalLaps || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-gray uppercase tracking-widest">Neutralizzazioni</div>
                    <div className="text-white font-condensed font-bold">{race.neutralizations}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {availableRaces.length === 0 && (
            <div className="col-span-full text-center py-12 text-neutral-gray border border-graphite border-dashed">
              Nessun dato gara trovato in public/data/races/
            </div>
          )}
        </div>
      </section>

      {/* Teammate Dynamics Module Link */}
      <section className="px-6 pb-20 max-w-7xl mx-auto w-full">
        <div className="bg-panel border border-graphite p-8 hover:border-white transition-colors group flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Crosshair className="text-white w-6 h-6" />
              <h3 className="font-condensed text-3xl font-bold uppercase text-white">Teammate Dynamics</h3>
            </div>
            <p className="text-text-secondary leading-relaxed max-w-2xl">
              Esplora il modulo storico per isolare il talento del pilota dalla performance della vettura. Confronta i compagni di squadra e scopri i veri rapporti di forza.
            </p>
          </div>
          <Link href="/grid" className="shrink-0 bg-white text-background px-8 py-4 font-condensed uppercase tracking-widest font-bold hover:bg-neutral-gray transition-colors flex items-center gap-3">
            Esplora Rivalità <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
