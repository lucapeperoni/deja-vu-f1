// Il marchio di Déjà vu: una D disegnata come un tracciato chiuso, con dietro
// la stessa D spostata e più tenue (il giro che hai già visto). Il puntino è
// il traguardo. Stesso disegno di src/app/icon.svg.

export default function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path
        d="M16 12 H32 A20 20 0 0 1 32 52 H16 Z"
        transform="translate(6 -5)"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.55}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M12 16 H28 A20 20 0 0 1 28 56 H12 Z" fill="none" stroke="#E10600" strokeWidth={8} strokeLinejoin="round" />
      <circle cx={12} cy={36} r={4.5} fill="#F5F5F5" />
    </svg>
  );
}
