import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b border-graphite bg-panel sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-6 h-6 bg-racing-red rounded-sm group-hover:bg-white transition-colors" />
          <span className="font-condensed font-extrabold text-2xl tracking-tight text-white group-hover:text-racing-red transition-colors">
            Déjà vu
          </span>
          <span className="hidden md:inline text-xs text-neutral-gray ml-2">l&apos;hai già visto? · 75 stagioni di Formula 1</span>
        </Link>
        <nav className="flex gap-8 text-sm font-condensed tracking-widest uppercase">
          <Link href="/" className="text-sm font-medium text-white hover:text-racing-red uppercase tracking-wider transition-colors">
            Chiedi
          </Link>
          <div className="w-[1px] h-4 bg-graphite my-auto mx-2" />
          <Link href="/gare" className="text-sm font-medium text-text-secondary hover:text-white uppercase tracking-wider transition-colors">
            Gare
          </Link>
          <div className="w-[1px] h-4 bg-graphite my-auto mx-2" />
          <Link href="/esplora" className="text-sm font-medium text-text-secondary hover:text-white uppercase tracking-wider transition-colors">
            Esplora
          </Link>
          <div className="w-[1px] h-4 bg-graphite my-auto mx-2" />
          <Link href="/methodology" className="text-sm font-medium text-text-secondary hover:text-white uppercase tracking-wider transition-colors">
            Metodo
          </Link>
        </nav>
      </div>
    </header>
  );
}
