"use client";

// Tooltip condiviso da tutte le viste D3 della pagina gara e della home
// (task 5.2, passata di qualità: "tooltip coerenti — stesso componente
// ovunque"). Prima ogni vista duplicava lo stesso markup con piccole
// differenze (bg-black/85 vs /90, max-width presente solo in due viste su
// cinque): un solo componente, ogni vista passa solo x/y già calcolate
// (nel proprio sistema di riferimento) e il contenuto.

import type { ReactNode } from "react";

interface Props {
  x: number;
  y: number;
  children: ReactNode;
  maxWidthPx?: number;
}

export default function ChartTooltip({ x, y, children, maxWidthPx }: Props) {
  return (
    <div
      className="pointer-events-none absolute z-50 rounded-md border border-white/20 bg-black/90 px-3 py-2 text-xs text-white shadow-xl"
      style={{ left: x + 12, top: y - 10, maxWidth: maxWidthPx }}
    >
      {children}
    </div>
  );
}
