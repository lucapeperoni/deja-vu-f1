"use client";

// Pagina di prova temporanea per la convenzione D3 (task 1.3 della
// roadmap). Da rimuovere prima della consegna (vedi task 5.4).

import { useState } from "react";
import D3Chart, { type Series } from "@/components/charts/D3Chart";

const DEMO_SERIES: Series[] = [
  {
    id: "VER",
    points: Array.from({ length: 20 }, (_, i) => ({
      x: i + 1,
      y: Math.sin(i / 3) * 2 + 10,
    })),
  },
  {
    id: "HAM",
    points: Array.from({ length: 20 }, (_, i) => ({
      x: i + 1,
      y: Math.cos(i / 4) * 3 + 14,
    })),
  },
  {
    id: "LEC",
    points: Array.from({ length: 20 }, (_, i) => ({
      x: i + 1,
      y: Math.sin(i / 2 + 1) * 1.5 + 8,
    })),
  },
];

export default function ChartDemoPage() {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
        Demo: convenzione D3 (temporanea, task 1.3)
      </h1>
      <p style={{ marginBottom: 16, color: "#666" }}>
        Passa il mouse su una linea: l&apos;evidenziazione è gestita da D3
        (eventi pointerenter/pointerleave dentro useEffect), lo stato è
        tenuto da React (highlightedId).
      </p>
      <D3Chart
        series={DEMO_SERIES}
        highlightedId={highlightedId}
        onHighlightChange={setHighlightedId}
      />
      <p style={{ marginTop: 12, fontSize: 14 }}>
        Pilota evidenziato: {highlightedId ?? "nessuno"}
      </p>
    </main>
  );
}
