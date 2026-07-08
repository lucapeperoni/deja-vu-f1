import Link from 'next/link';
import { ArrowRight, Activity, Crosshair, Flag } from 'lucide-react';

export default function Home() {
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
          
          <div className="pt-10">
            <Link 
              href="/race/2021-22"
              className="inline-flex items-center gap-3 bg-racing-red text-white px-8 py-4 font-condensed uppercase tracking-widest font-bold hover:bg-white hover:text-racing-red transition-all duration-300"
            >
              Esplora una Gara <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Modules Overview */}
      <section className="px-6 py-20 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12">
        
        {/* Race Dynamics Module */}
        <div className="bg-panel border border-graphite p-8 hover:border-racing-red transition-colors group">
          <div className="w-12 h-12 bg-racing-red/10 rounded-full flex items-center justify-center mb-6">
            <Activity className="text-racing-red w-6 h-6" />
          </div>
          <h3 className="font-condensed text-3xl font-bold uppercase text-white mb-4">Race Anatomy</h3>
          <p className="text-text-secondary mb-6 leading-relaxed">
            Una timeline interattiva per scoprire chi ha sfruttato le finestre di opportunità (Opportunity Window) create dalle neutralizzazioni, misurando lo "sconto" reale sui pit stop (Neutralization Discount).
          </p>
          <Link href="/race/2021-22" className="text-racing-red font-condensed uppercase tracking-widest text-sm flex items-center gap-2 group-hover:gap-4 transition-all">
            Analizza VSC & SC <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Teammate Dynamics Module */}
        <div className="bg-panel border border-graphite p-8 hover:border-white transition-colors group">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-6">
            <Crosshair className="text-white w-6 h-6" />
          </div>
          <h3 className="font-condensed text-3xl font-bold uppercase text-white mb-4">Teammate Dynamics</h3>
          <p className="text-text-secondary mb-6 leading-relaxed">
            Il modulo storico per isolare il talento del pilota dalla performance della vettura. Confronta i compagni di squadra, scopri le "Macchine Illegali" e i "Distruttori" di compagni attraverso il Teammate Dominance Index (TDI).
          </p>
          <Link href="/grid" className="text-white font-condensed uppercase tracking-widest text-sm flex items-center gap-2 group-hover:gap-4 transition-all">
            Esplora le Rivalità <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </section>
    </main>
  );
}
