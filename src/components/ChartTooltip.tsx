"use client";

// Tooltip condiviso da tutte le viste D3 della pagina gara e della home
// (task 5.2, passata di qualità: "tooltip coerenti — stesso componente
// ovunque"). Prima ogni vista duplicava lo stesso markup con piccole
// differenze (bg-black/85 vs /90, max-width presente solo in due viste su
// cinque): un solo componente, ogni vista passa solo x/y già calcolate
// (nel proprio sistema di riferimento) e il contenuto.

import { useLayoutEffect, useRef, type ReactNode } from "react";

interface Props {
  x: number;
  y: number;
  children: ReactNode;
  maxWidthPx?: number;
}

// Margine di sicurezza dal bordo della finestra: sotto questa soglia il
// tooltip viene spinto indietro invece di uscire dal viewport.
const VIEWPORT_MARGIN = 8;

export default function ChartTooltip({ x, y, children, maxWidthPx }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Il tooltip segue il cursore in basso-a-destra (x+12, y-10): su una riga
  // in fondo a una vista alta (es. la matrice della lotteria con molti
  // piloti) quel posizionamento naturale esce dal bordo della finestra. Si
  // misura la posizione effettiva dopo il render e si corregge prima del
  // paint, così il tooltip resta sempre interamente visibile.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${x + 12}px`;
    el.style.top = `${y - 10}px`;

    const rect = el.getBoundingClientRect();
    const overflowRight = rect.right - (window.innerWidth - VIEWPORT_MARGIN);
    const overflowBottom = rect.bottom - (window.innerHeight - VIEWPORT_MARGIN);
    const overflowLeft = VIEWPORT_MARGIN - rect.left;
    const overflowTop = VIEWPORT_MARGIN - rect.top;

    if (overflowRight > 0) el.style.left = `${x + 12 - overflowRight}px`;
    if (overflowBottom > 0) el.style.top = `${y - 10 - overflowBottom}px`;
    if (overflowLeft > 0) el.style.left = `${x + 12 + overflowLeft}px`;
    if (overflowTop > 0) el.style.top = `${y - 10 + overflowTop}px`;
  }, [x, y, children]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute z-50 rounded-md border border-white/20 bg-black/90 px-3 py-2 text-xs text-white shadow-xl"
      style={{ left: x + 12, top: y - 10, maxWidth: maxWidthPx }}
    >
      {children}
    </div>
  );
}
