"use client";

// Vista 3 (docs/PROGETTAZIONE.md, sezione 7 e 5.3): "quando". Asse X: le
// stagioni della finestra di copertura DELL'EVENTO (non sempre tutte le 75:
// un evento 2011-2024 mostra solo le sue 14 stagioni, altrimenti si
// implicherebbe una copertura più larga di quella reale — la stessa regola
// di onestà della vista 1 applicata qui). Sopra, l'istogramma per stagione;
// sotto, una striscia di segni (un cerchio per stagione con almeno
// un'occorrenza, raggio ~ conteggio): lo spazio VUOTO fra i segni è la
// siccità, si legge prima di contarla.
//
// Il brush (d3.brushX) seleziona un intervallo di anni e lo notifica al
// compositore via onYearFilterChange, che lo propaga alla tabella e alla
// vista 4. La sincronizzazione è a doppio senso: se il filtro cambia da
// fuori (i campi Da/A, il pulsante Reset), il brush si riposiziona da solo
// — con una guardia per non richiamare onYearFilterChange in un loop.
//
// Convenzione D3 del progetto: D3 possiede l'SVG, dentro un unico
// useEffect; il colore codifica la famiglia, mai la rarità.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { familyColor, TEXT_MUTED_COLOR } from "@/lib/colors";
import { formatDrought, formatWindow, type CatalogEventEntry } from "@/lib/eventCatalog";
import ChartTooltip from "@/components/ChartTooltip";

interface Props {
  entry: CatalogEventEntry;
  perStagione: Record<string, number>;
  yearFilter: [number, number] | null;
  onYearFilterChange: (range: [number, number] | null) => void;
}

interface TooltipState {
  x: number;
  y: number;
  year: number;
  count: number;
}

const WIDTH = 1200;
const HEIGHT = 200;
const MARGIN = { top: 16, right: 24, bottom: 28, left: 24 };
const HIST_TOP = MARGIN.top;
const HIST_BOTTOM = 110;
const STRIP_Y = 140;
const BRUSH_TOP = 118;
const BRUSH_BOTTOM = 162;

export default function QuandoStrip({ entry, perStagione, yearFilter, onYearFilterChange }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const brushGroupRef = useRef<SVGGElement | null>(null);
  const lastEmitted = useRef<[number, number] | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const color = familyColor(entry.famiglia);

  const years = useMemo(() => {
    const arr: { year: number; count: number }[] = [];
    for (let y = entry.annoDa; y <= entry.annoA; y++) arr.push({ year: y, count: perStagione[String(y)] ?? 0 });
    return arr;
  }, [entry.annoDa, entry.annoA, perStagione]);

  const maxCount = d3.max(years, (d) => d.count) ?? 1;

  const xScale = useMemo(
    () => d3.scaleLinear().domain([entry.annoDa, entry.annoA]).range([MARGIN.left, WIDTH - MARGIN.right]).clamp(true),
    [entry.annoDa, entry.annoA]
  );
  const yHist = useMemo(
    () => d3.scaleLinear().domain([0, maxCount || 1]).range([HIST_BOTTOM, HIST_TOP]),
    [maxCount]
  );
  const rScale = useMemo(() => d3.scaleSqrt().domain([0, maxCount || 1]).range([0, 9]), [maxCount]);

  // Setup una tantum
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    for (const cls of ["x-axis", "hist-group", "strip-group", "brush-group"]) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  // Brush: creato una volta, il comportamento (extent) non cambia con i dati.
  const brushBehavior = useMemo(
    () =>
      d3
        .brushX()
        .extent([
          [MARGIN.left, BRUSH_TOP],
          [WIDTH - MARGIN.right, BRUSH_BOTTOM],
        ]),
    []
  );

  useEffect(() => {
    if (!brushGroupRef.current) return;
    const g = d3.select<SVGGElement, unknown>(brushGroupRef.current);
    g.call(brushBehavior);

    brushBehavior.on("end", (event: d3.D3BrushEvent<unknown>) => {
      if (!event.sourceEvent) return; // ignora i .move programmatici (sync esterna)
      if (!event.selection) {
        lastEmitted.current = null;
        onYearFilterChange(null);
        return;
      }
      const [x0, x1] = event.selection as [number, number];
      const y0 = Math.round(xScale.invert(x0));
      const y1 = Math.round(xScale.invert(x1));
      const range: [number, number] = [y0, y1];
      if (y0 <= entry.annoDa && y1 >= entry.annoA) {
        lastEmitted.current = null;
        onYearFilterChange(null);
      } else {
        lastEmitted.current = range;
        onYearFilterChange(range);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brushBehavior, xScale, entry.annoDa, entry.annoA]);

  // Sincronizzazione esterna -> brush (Reset, campi Da/A): sposta la
  // selezione solo se il filtro non corrisponde già a quello emesso
  // dall'ultimo brush di QUESTO componente, altrimenti si rientrerebbe in loop.
  useEffect(() => {
    if (!brushGroupRef.current) return;
    const g = d3.select<SVGGElement, unknown>(brushGroupRef.current);
    const matchesLastEmitted =
      (yearFilter === null && lastEmitted.current === null) ||
      (yearFilter !== null &&
        lastEmitted.current !== null &&
        yearFilter[0] === lastEmitted.current[0] &&
        yearFilter[1] === lastEmitted.current[1]);
    if (matchesLastEmitted) return;

    if (yearFilter === null) {
      g.call(brushBehavior.move, null);
    } else {
      g.call(brushBehavior.move, [xScale(yearFilter[0]), xScale(yearFilter[1])]);
    }
  }, [yearFilter, xScale, brushBehavior]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0, ${STRIP_Y + 16})`)
      .call(d3.axisBottom(xScale).ticks(Math.min(15, entry.annoA - entry.annoDa + 1)).tickFormat(d3.format("d")))
      .call((g) => g.selectAll("text").attr("fill", TEXT_MUTED_COLOR).attr("font-size", 10))
      .call((g) => g.selectAll("line, path").attr("stroke", TEXT_MUTED_COLOR).attr("opacity", 0.4));

    svg
      .select<SVGGElement>(".hist-group")
      .selectAll<SVGRectElement, { year: number; count: number }>("rect.hist-bar")
      .data(years, (d) => d.year)
      .join("rect")
      .attr("class", "hist-bar")
      .attr("x", (d) => xScale(d.year) - 2)
      .attr("width", 4)
      .attr("y", (d) => yHist(d.count))
      .attr("height", (d) => HIST_BOTTOM - yHist(d.count))
      .attr("fill", TEXT_MUTED_COLOR)
      .attr("opacity", (d) => (d.count > 0 ? 0.4 : 0.08));

    const stripSel = svg
      .select<SVGGElement>(".strip-group")
      .selectAll<SVGCircleElement, { year: number; count: number }>("circle.strip-dot")
      .data(
        years.filter((d) => d.count > 0),
        (d) => d.year
      );

    stripSel
      .join(
        (enter) => enter.append("circle").attr("class", "strip-dot").attr("r", 0),
        (update) => update,
        (exit) => exit.transition().duration(200).attr("r", 0).remove()
      )
      .attr("cx", (d) => xScale(d.year))
      .attr("cy", STRIP_Y)
      .attr("fill", color)
      .on("pointerenter", (event, d) => setTooltip({ x: event.clientX, y: event.clientY, year: d.year, count: d.count }))
      .on("pointermove", (event, d) => setTooltip({ x: event.clientX, y: event.clientY, year: d.year, count: d.count }))
      .on("pointerleave", () => setTooltip(null))
      .transition()
      .duration(300)
      .attr("r", (d) => Math.max(2, rScale(d.count)));
  }, [years, xScale, yHist, rScale, color, entry.annoDa, entry.annoA]);

  const drought = formatDrought(entry);

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative overflow-x-auto hide-scrollbar">
      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-neutral-gray mb-3">
        <div>
          Finestra: <span className="text-white">{formatWindow(entry)}</span> ({entry.annoA - entry.annoDa + 1} stagioni)
        </div>
        {drought && <div className="text-racing-red">{drought}</div>}
      </div>
      <div style={{ position: "relative", width: WIDTH }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label="Occorrenze per stagione, con la siccità come spazio vuoto fra i segni; trascina per selezionare un intervallo di anni"
        >
          <g ref={brushGroupRef} className="brush-group" />
        </svg>
        {tooltip && (
          <ChartTooltip x={tooltip.x} y={tooltip.y} onDismiss={() => setTooltip(null)}>
            <div className="font-bold">{tooltip.year}</div>
            <div className="text-neutral-gray">
              {tooltip.count} {tooltip.count === 1 ? "occorrenza" : "occorrenze"}
            </div>
            <div className="text-neutral-gray">Finestra: {formatWindow(entry)}</div>
          </ChartTooltip>
        )}
      </div>
      <div className="text-xs text-neutral-gray mt-2">Trascina sull&apos;asse per filtrare per intervallo di anni.</div>
    </div>
  );
}
