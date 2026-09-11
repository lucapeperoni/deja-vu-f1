"use client";

// Griglia → arrivo di una singola gara (roadmap D7.7): due colonne di
// posizioni e una linea per pilota. È il grafico a pendenza (slopegraph):
// la pendenza È il risultato — chi sale ha rimontato, chi scende ha perso,
// chi si ferma a metà strada non è arrivato.
//
// Vale per tutte le 1125 gare, anche quelle del 1950: gli serve solo la
// griglia e l'ordine d'arrivo. Il giro per giro, che è più ricco, esiste
// invece solo dal 1996 — questo grafico è il racconto minimo che c'è sempre.
//
// SVG scritto da React, non da D3: sono due colonne di testo e una manciata
// di segmenti, nessuna scala da dominare (i numeri di posizione sono già la
// scala) e nessuna transizione. Vedi la stessa scelta per EventCardsGrid.

import { useState } from "react";
import { DEFAULT_LINE_COLOR, HIGHLIGHT_COLOR, STORY_ACCENT_COLOR, TEXT_MUTED_COLOR } from "@/lib/colors";
import type { RigaClassifica } from "@/lib/situazioni/schedaGara";

interface Props {
  classifica: RigaClassifica[];
}

const RIGA = 22;
const PAD_TOP = 34;
const X_GRIGLIA = 150;
const X_ARRIVO = 350;
const W = 500;

export default function GrigliaArrivoGara({ classifica }: Props) {
  const [sotto, setSotto] = useState<number | null>(null);

  // Si disegna chi ha una casella in griglia: senza quella non c'è un punto
  // di partenza da cui tracciare la linea (pit lane compresa, che in griglia
  // non ha numero). Chi non è arrivato la linea ce l'ha lo stesso, ma si
  // ferma a mezza strada: è l'informazione, non un buco.
  const righe = classifica.filter((r) => r.griglia !== null);
  const maxPos = Math.max(...righe.map((r) => Math.max(r.griglia ?? 1, r.arrivo ?? 0)), 3);
  const H = PAD_TOP + maxPos * RIGA + 16;
  const y = (pos: number) => PAD_TOP + (pos - 0.5) * RIGA;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Griglia di partenza e ordine d'arrivo, una linea per pilota">
      <text x={X_GRIGLIA} y={18} textAnchor="end" fill={TEXT_MUTED_COLOR} fontSize={11} className="uppercase tracking-widest">
        griglia
      </text>
      <text x={X_ARRIVO} y={18} textAnchor="start" fill={TEXT_MUTED_COLOR} fontSize={11} className="uppercase tracking-widest">
        arrivo
      </text>

      {righe.map((r) => {
        const puntato = sotto === r.driverId;
        const podio = r.arrivo !== null && r.arrivo <= 3;
        const colore = puntato ? HIGHLIGHT_COLOR : r.arrivo === 1 ? STORY_ACCENT_COLOR : podio ? "#9aa4b2" : DEFAULT_LINE_COLOR;
        const yDa = y(r.griglia!);
        const yA = r.arrivo !== null ? y(r.arrivo) : null;
        return (
          <g
            key={r.driverId}
            onPointerEnter={() => setSotto(r.driverId)}
            onPointerLeave={() => setSotto(null)}
            style={{ cursor: "default" }}
            opacity={sotto !== null && !puntato ? 0.3 : 1}
          >
            {/* la zona sensibile: la linea sottile è difficile da puntare */}
            <rect x={X_GRIGLIA} y={Math.min(yDa, yA ?? yDa) - RIGA / 2} width={X_ARRIVO - X_GRIGLIA} height={Math.abs((yA ?? yDa) - yDa) + RIGA} fill="transparent" />
            {yA !== null ? (
              <line x1={X_GRIGLIA + 8} y1={yDa} x2={X_ARRIVO - 8} y2={yA} stroke={colore} strokeWidth={puntato ? 2.5 : podio ? 2 : 1.2} />
            ) : (
              // non arrivato: la linea si ferma a metà e sfuma
              <line x1={X_GRIGLIA + 8} y1={yDa} x2={(X_GRIGLIA + X_ARRIVO) / 2} y2={yDa} stroke={colore} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.7} />
            )}
            <text x={X_GRIGLIA - 6} y={yDa} dy="0.32em" textAnchor="end" fontSize={12} fill={puntato ? HIGHLIGHT_COLOR : "#d7dbe0"}>
              {r.griglia}. {r.codice ?? r.pilota}
            </text>
            {yA !== null && (
              <text x={X_ARRIVO + 6} y={yA} dy="0.32em" fontSize={12} fill={puntato ? HIGHLIGHT_COLOR : "#d7dbe0"}>
                {r.arrivo}. {r.codice ?? r.pilota}
                {r.guadagno !== null && r.guadagno !== 0 && (
                  <tspan fill={r.guadagno > 0 ? "#4ade80" : "#f87171"} fontSize={11}>
                    {" "}
                    {r.guadagno > 0 ? `+${r.guadagno}` : r.guadagno}
                  </tspan>
                )}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
