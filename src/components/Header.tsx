import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b border-graphite bg-panel sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-6 h-6 bg-racing-red rounded-sm group-hover:bg-white transition-colors" />
          <span className="font-condensed font-bold text-xl tracking-wide uppercase text-white group-hover:text-racing-red transition-colors">
            Race Dynamics
          </span>
        </Link>
        <nav className="flex gap-8 text-sm font-condensed tracking-widest uppercase">
          <Link href="/esplora" className="text-sm font-medium text-text-secondary hover:text-white uppercase tracking-wider transition-colors">
            Esplora il catalogo
          </Link>
          <div className="w-[1px] h-4 bg-graphite my-auto mx-2" />
          <Link href="/race/2023-bahrain" className="text-sm font-medium text-racing-red hover:text-white uppercase tracking-wider transition-colors">
            Race Anatomy
          </Link>
          <div className="w-[1px] h-4 bg-graphite my-auto mx-2" />
          <Link href="/methodology" className="text-sm font-medium text-text-secondary hover:text-white uppercase tracking-wider transition-colors">
            Metodologia
          </Link>
        </nav>
      </div>
    </header>
  );
}
