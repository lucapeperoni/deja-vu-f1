import Link from 'next/link';

export default function MethodologyPage() {
  return (
    <main className="flex-1 bg-background text-foreground py-16 px-6">
      <div className="max-w-4xl mx-auto space-y-16">
        
        <header className="space-y-4">
          <h1 className="font-condensed text-5xl font-bold uppercase tracking-wide">Macchina o Pilota?</h1>
          <p className="text-xl text-text-secondary">
            Il confronto con il compagno di squadra non separa perfettamente il pilota dalla macchina, ma riduce una parte importante della variabilità esterna, rendendo il confronto più significativo di una semplice classifica assoluta.
          </p>
        </header>

        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">Livello Osservabile</h2>
          <p className="text-text-secondary">
            Ciò che il dataset permette di misurare direttamente:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-white">
            <li>Differenza tra compagni in ogni singola gara</li>
            <li>Costanza del vantaggio durante l'intero campionato</li>
            <li>Risultati in qualifica (chi parte più avanti a parità di mezzo)</li>
            <li>Risultati in gara (chi massimizza i punti della domenica)</li>
            <li>Affidabilità del mezzo (ritiri per cause tecniche)</li>
          </ul>
        </section>

        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-neutral-gray uppercase tracking-wider">Livello Non Osservabile</h2>
          <p className="text-text-secondary">
            Ciò che il dataset non permette di controllare completamente, e che richiede contesto umano:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-white">
            <li>Aggiornamenti asimmetrici della vettura (es. nuovo fondo solo per il pilota A)</li>
            <li>Ordini di scuderia (team orders) o strategie differenziate ai box</li>
            <li>Danni invisibili subiti durante i contatti del primo giro</li>
            <li>Qualità dello staff di ingegneri dedicato al singolo lato del box</li>
            <li>Condizioni fisiche non dichiarate o adattamento a specifiche mescole di pneumatici</li>
          </ul>
        </section>

        <section className="bg-panel border border-graphite p-8 mt-12">
          <h2 className="font-condensed text-3xl font-bold text-white uppercase tracking-wider mb-6">TDI — Teammate Dominance Index</h2>
          <p className="mb-6 text-text-secondary leading-relaxed">
            L'indice TDI (Teammate Dominance Index) è un indicatore sintetico progettato per misurare lo sbilanciamento di prestazioni all'interno dello stesso team in una specifica stagione. Il valore varia da <strong>-100</strong> a <strong>+100</strong>. Un valore vicino allo 0 indica una rivalità perfettamente equilibrata.
          </p>

          <h3 className="font-condensed text-xl font-bold text-white mb-4">Composizione e Pesi</h3>
          <div className="space-y-4 font-mono text-sm">
            <div className="flex justify-between border-b border-graphite pb-2">
              <span className="text-text-secondary">Head-to-head in Gara (Vittorie interne)</span>
              <span className="text-racing-red font-bold">30%</span>
            </div>
            <div className="flex justify-between border-b border-graphite pb-2">
              <span className="text-text-secondary">Head-to-head in Qualifica</span>
              <span className="text-racing-red font-bold">25%</span>
            </div>
            <div className="flex justify-between border-b border-graphite pb-2">
              <span className="text-text-secondary">Quota Punti (Contribuzione al team)</span>
              <span className="text-racing-red font-bold">20%</span>
            </div>
            <div className="flex justify-between border-b border-graphite pb-2">
              <span className="text-text-secondary">Differenza Mediana di Posizione in Gara</span>
              <span className="text-racing-red font-bold">15%</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-text-secondary">Differenza Mediana in Griglia</span>
              <span className="text-racing-red font-bold">10%</span>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
