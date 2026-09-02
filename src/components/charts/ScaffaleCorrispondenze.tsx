"use client";

// Lo scaffale delle corrispondenze (roadmap S, fase S3.1, docs/ROADMAP-6.md):
// la vista portante del compositore di scenari.
//
//   X = il tempo, 1950-2024 (stessa scala lineare e stesso stile d'asse di
//       QuandoStrip: tick d3.format("d"), colori da colors.ts).
//   Y = quante condizioni reggono: una riga per ogni livello della cascata,
//       da K (in alto) a 1 (in basso). Le righe vengono da result.byScore,
//       che è GIÀ completo anche per i livelli vuoti — non si deducono dai
//       dati, si prendono da byScore.
//   Un punto per ogni ChipMatchResult, per anno sulla riga del suo score.
//   Colore = famiglia (familyColor), mai la rarità (regola d'oro).
//
// La riga "K su K" (byScore[0]) è la risposta alla domanda "è già successo?":
// è enfatizzata con sfondo e bordo propri, non con una sola etichetta. Una
// riga vuota RESTA disegnata, con scritto "mai successo": la sua assenza di
// punti è essa stessa un'informazione.
//
// Convenzione D3 del progetto (docs/PROGETTAZIONE.md, sezione 7): D3 possiede
// l'intero <svg> — scale, assi, data join, transizioni in un unico useEffect.
// React tiene il ref, lo stato di hover/tooltip e il router (useRouter di
// next/navigation, come RarityScale). Responsive con ResizeObserver dal primo
// colpo (pattern di RarityScale), mai una WIDTH fissa scritta a mano.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { useRouter } from "next/navigation";
import { familyColor, TEXT_MUTED_COLOR, TEXT_PRIMARY_COLOR, STORY_ACCENT_COLOR } from "@/lib/colors";
import ChartTooltip from "@/components/ChartTooltip";
import type { ChipMatchResult, RaceRow, ScenarioResult } from "@/lib/scenarioEngine";

interface Props {
  result: ScenarioResult;
  // Tutte le gare dell'indice decodificato: servono a ricostruire lo slug
  // /gara/<slug> con lo stesso algoritmo di buildSlugByRaceId.
  races: RaceRow[];
  // circuitRef → nome leggibile, opzionale: senza, si mostra il circuitRef.
  nomiCircuiti?: Record<string, string>;
}

interface TooltipState {
  x: number;
  y: number;
  result: ChipMatchResult;
}

const TIMELINE_FROM = 1950;
const TIMELINE_TO = 2024;

const MARGIN = { top: 18, right: 24, bottom: 30, left: 104 };
const ROW_HEIGHT = 56;
const DEFAULT_WIDTH = 1100;
const MIN_WIDTH = 640;

// Stesso algoritmo di buildSlugByRaceId in src/app/gara/[raceSlug]/page.tsx:
// "<anno>-<circuitRef>", con "-r<round>" per le gare che condividono
// anno+circuito (le 4 coppie 2020/2021 del calendario Covid). L'originale
// ordina per data; qui si ordina per (anno, round), che dà lo stesso ordine
// cronologico — il round è progressivo dentro la stagione — senza portarsi
// dietro la stringa di data nell'indice compatto.
function buildSlugByRaceId(races: RaceRow[]): Map<number, string> {
  const sorted = [...races].sort((a, b) => a.anno - b.anno || a.round - b.round);
  const used = new Set<string>();
  const slugByRaceId = new Map<number, string>();
  for (const r of sorted) {
    const base = `${r.anno}-${r.circuitRef}`;
    const slug = used.has(base) ? `${base}-r${r.round}` : base;
    used.add(base);
    slugByRaceId.set(r.raceId, slug);
  }
  return slugByRaceId;
}

// Dispersione verticale deterministica dentro la banda della riga: 350 punti
// su una riga sola si sovrappongono, e un jitter casuale cambierebbe a ogni
// render. Deriva dal raceId, stabile.
function jitter01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function ScaffaleCorrispondenze({ result, races, nomiCircuiti }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  const slugByRaceId = useMemo(() => buildSlugByRaceId(races), [races]);
  const K = result.chips.length;
  const rows = result.byScore; // già completo, K..1, anche vuoto

  const height = MARGIN.top + rows.length * ROW_HEIGHT + MARGIN.bottom;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured) setWidth(Math.max(MIN_WIDTH, Math.round(measured)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const xScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([TIMELINE_FROM, TIMELINE_TO])
        .range([MARGIN.left, width - MARGIN.right])
        .clamp(true),
    [width]
  );

  // Setup una tantum: gruppi persistenti dell'SVG.
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    for (const cls of ["rows-group", "points-group", "x-axis"]) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    const rowY = (rowIdx: number) => MARGIN.top + rowIdx * ROW_HEIGHT;
    const rowCenter = (rowIdx: number) => rowY(rowIdx) + ROW_HEIGHT / 2;
    const plotLeft = MARGIN.left;
    const plotRight = width - MARGIN.right;

    // --- Asse X: stile di QuandoStrip -------------------------------------
    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0, ${MARGIN.top + rows.length * ROW_HEIGHT + 6})`)
      .call(d3.axisBottom(xScale).ticks(Math.min(15, Math.floor(width / 90))).tickFormat(d3.format("d")))
      .call((g) => g.selectAll("text").attr("fill", TEXT_MUTED_COLOR).attr("font-size", 10))
      .call((g) => g.selectAll("line, path").attr("stroke", TEXT_MUTED_COLOR).attr("opacity", 0.4));

    // --- Le righe (da byScore, non dai dati) -----------------------------
    const rowSel = svg
      .select<SVGGElement>(".rows-group")
      .selectAll<SVGGElement, (typeof rows)[number]>("g.scaffale-row")
      .data(rows, (d) => d.score);

    const rowEnter = rowSel.enter().append("g").attr("class", "scaffale-row");
    rowEnter.append("rect").attr("class", "row-bg");
    rowEnter.append("text").attr("class", "row-label-score");
    rowEnter.append("text").attr("class", "row-label-count");
    rowEnter.append("text").attr("class", "row-empty");
    rowSel.exit().remove();

    const rowMerged = rowEnter.merge(rowSel);

    rowMerged
      .select<SVGRectElement>("rect.row-bg")
      .attr("x", plotLeft)
      .attr("y", (_, i) => rowY(i) + 4)
      .attr("width", Math.max(0, plotRight - plotLeft))
      .attr("height", ROW_HEIGHT - 8)
      .attr("rx", 4)
      // byScore[0] = "K su K": sfondo e bordo propri, è la risposta.
      .attr("fill", (_, i) => (i === 0 ? "rgba(225, 6, 0, 0.08)" : "rgba(255,255,255,0.025)"))
      .attr("stroke", (_, i) => (i === 0 ? STORY_ACCENT_COLOR : "rgba(255,255,255,0.08)"))
      .attr("stroke-width", (_, i) => (i === 0 ? 1.5 : 1));

    rowMerged
      .select<SVGTextElement>("text.row-label-score")
      .attr("x", MARGIN.left - 12)
      .attr("y", (_, i) => rowCenter(i) - 4)
      .attr("text-anchor", "end")
      .attr("font-size", (_, i) => (i === 0 ? 14 : 12))
      .attr("font-weight", (_, i) => (i === 0 ? 700 : 400))
      .attr("fill", (_, i) => (i === 0 ? TEXT_PRIMARY_COLOR : TEXT_MUTED_COLOR))
      .text((d) => `${d.score} su ${K}`);

    rowMerged
      .select<SVGTextElement>("text.row-label-count")
      .attr("x", MARGIN.left - 12)
      .attr("y", (_, i) => rowCenter(i) + 12)
      .attr("text-anchor", "end")
      .attr("font-size", 10)
      .attr("fill", TEXT_MUTED_COLOR)
      .text((d) => `${d.risultati.length} ${d.risultati.length === 1 ? "caso" : "casi"}`);

    rowMerged
      .select<SVGTextElement>("text.row-empty")
      .attr("x", (plotLeft + plotRight) / 2)
      .attr("y", (_, i) => rowCenter(i) + 3)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("font-style", "italic")
      .attr("fill", TEXT_MUTED_COLOR)
      .attr("opacity", (d) => (d.risultati.length === 0 ? 0.7 : 0))
      .text((d, i) => (d.risultati.length === 0 ? (i === 0 ? "mai successo" : "nessun caso a questo livello") : ""));

    // --- I punti --------------------------------------------------------
    interface Punto {
      key: string;
      rowIdx: number;
      cx: number;
      cy: number;
      color: string;
      r: ChipMatchResult;
    }
    const punti: Punto[] = [];
    rows.forEach((riga, rowIdx) => {
      const banda = ROW_HEIGHT - 22;
      riga.risultati.forEach((res, j) => {
        punti.push({
          key: `${riga.score}:${res.entry.raceId}:${res.entry.eventId}:${j}`,
          rowIdx,
          cx: xScale(res.entry.anno),
          cy: rowCenter(rowIdx) + (jitter01(res.entry.raceId + j * 7) - 0.5) * banda,
          color: familyColor(res.entry.famiglia),
          r: res,
        });
      });
    });

    svg
      .select<SVGGElement>(".points-group")
      .selectAll<SVGCircleElement, Punto>("circle.scaffale-dot")
      .data(punti, (d) => d.key)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "scaffale-dot")
            .attr("r", 0)
            .attr("cx", (d) => d.cx)
            .attr("cy", (d) => d.cy),
        (update) => update,
        (exit) => exit.transition().duration(150).attr("r", 0).remove()
      )
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", 0.72)
      .attr("stroke", (d) => d.color)
      .attr("stroke-opacity", 0.9)
      .style("cursor", "pointer")
      .on("pointerenter", (event, d) => setTooltip({ x: event.clientX, y: event.clientY, result: d.r }))
      .on("pointermove", (event, d) => setTooltip({ x: event.clientX, y: event.clientY, result: d.r }))
      .on("pointerleave", () => setTooltip(null))
      .on("click", (_event, d) => {
        const slug = slugByRaceId.get(d.r.entry.raceId);
        if (slug) router.push(`/gara/${slug}`);
      })
      .transition()
      .duration(250)
      .attr("cx", (d) => d.cx)
      .attr("cy", (d) => d.cy)
      .attr("r", 3.5);
  }, [rows, K, xScale, width, slugByRaceId, router]);

  const tt = tooltip?.result;
  const garaNome = tt ? nomiCircuiti?.[tt.entry.circuitRef] ?? tt.entry.circuitRef : "";

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative">
      <div ref={containerRef} className="overflow-x-auto hide-scrollbar">
        <div style={{ position: "relative", width }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            role="img"
            aria-label="Scaffale delle corrispondenze: per ogni livello della cascata (da tutte le condizioni a una sola), i casi passati collocati nel tempo"
          />
        </div>
      </div>
      {tooltip && tt && (
        <ChartTooltip x={tooltip.x} y={tooltip.y} onDismiss={() => setTooltip(null)}>
          <div className="font-bold">
            {tt.entry.anno} · {garaNome}
          </div>
          {tt.chipsMissed.length === 0 && tt.chipsNonValutabili.length === 0 ? (
            <div className="text-neutral-gray mt-1">Tutte le condizioni reggono</div>
          ) : (
            <>
              {tt.chipsMissed.length > 0 && (
                <div className="text-neutral-gray mt-1">
                  Salta: {tt.chipsMissed.map((c) => c.label).join(", ")}
                </div>
              )}
              {tt.chipsNonValutabili.length > 0 && (
                <div className="text-neutral-gray mt-1">
                  Non valutabile: {tt.chipsNonValutabili.map((c) => c.label).join(", ")}
                </div>
              )}
            </>
          )}
          <div className="text-racing-red mt-1">Clic per aprire la scheda gara →</div>
        </ChartTooltip>
      )}
    </div>
  );
}
