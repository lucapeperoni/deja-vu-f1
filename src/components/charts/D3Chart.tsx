"use client";

// Convenzione D3 per tutti i grafici del progetto (docs/PROGETTAZIONE.md,
// sezione 7): React possiede SOLO il contenitore — ref, props, stato — e
// decide COSA disegnare; D3 possiede l'intero <svg> e decide COME
// disegnarlo: scale, assi, data join, transizioni ed eventi vivono dentro
// useEffect, mai come JSX. Il redraw è incrementale (selection.join),
// mai un remove-and-recreate completo dell'SVG a ogni render. Gli eventi
// (hover) sono attaccati da D3 e notificano lo stato a React via callback:
// D3 non tiene mai il proprio stato di evidenziazione.

import { useEffect, useRef } from "react";
import * as d3 from "d3";

export interface SeriesPoint {
  x: number;
  y: number;
}

export interface Series {
  id: string;
  points: SeriesPoint[];
}

interface D3ChartProps {
  series: Series[];
  highlightedId?: string | null;
  onHighlightChange?: (id: string | null) => void;
  width?: number;
  height?: number;
}

const MARGIN = { top: 16, right: 24, bottom: 28, left: 40 };

export default function D3Chart({
  series,
  highlightedId = null,
  onHighlightChange,
  width = 640,
  height = 320,
}: D3ChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Setup una tantum: crea i gruppi persistenti dell'SVG. Non tocca mai i
  // dati — è compito esclusivo dell'effetto di redraw qui sotto.
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (svg.select(".x-axis").empty()) svg.append("g").attr("class", "x-axis");
    if (svg.select(".y-axis").empty()) svg.append("g").attr("class", "y-axis");
    if (svg.select(".series-group").empty()) svg.append("g").attr("class", "series-group");
  }, []);

  // Redraw incrementale: scale, assi e linee via selection.join, mai
  // svg.selectAll("*").remove().
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;

    const allPoints = series.flatMap((s) => s.points);
    const hasData = allPoints.length > 0;
    const xExtent = d3.extent(allPoints, (d) => d.x) as [number, number];
    const yExtent = d3.extent(allPoints, (d) => d.y) as [number, number];

    const xScale = d3
      .scaleLinear()
      .domain(hasData ? xExtent : [0, 1])
      .range([MARGIN.left, MARGIN.left + innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain(hasData ? yExtent : [0, 1])
      .nice()
      .range([MARGIN.top + innerHeight, MARGIN.top]);

    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0, ${MARGIN.top + innerHeight})`)
      .transition()
      .duration(300)
      .call(d3.axisBottom(xScale).ticks(6));

    svg
      .select<SVGGElement>(".y-axis")
      .attr("transform", `translate(${MARGIN.left}, 0)`)
      .transition()
      .duration(300)
      .call(d3.axisLeft(yScale).ticks(5));

    const line = d3
      .line<SeriesPoint>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y));

    svg
      .select<SVGGElement>(".series-group")
      .selectAll<SVGPathElement, Series>("path.series-line")
      .data(series, (d: Series) => d.id)
      .join(
        (enter) =>
          enter
            .append("path")
            .attr("class", "series-line")
            .attr("fill", "none")
            .attr("stroke", "#94a3b8")
            .attr("stroke-width", 1.5)
            .attr("d", (d) => line(d.points))
            .style("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(300).style("opacity", 0).remove()
      )
      .on("pointerenter", (_event, d) => onHighlightChange?.(d.id))
      .on("pointerleave", () => onHighlightChange?.(null))
      .style("cursor", onHighlightChange ? "pointer" : "default")
      // Un'unica transizione per elemento: opacità (per l'enter), stroke
      // (per l'evidenziazione) e path (per i nuovi dati) insieme. Due
      // transizioni separate sullo stesso elemento nello stesso istante si
      // interrompono a vicenda in D3 — è il bug che teneva le linee invisibili.
      .transition()
      .duration(300)
      .style("opacity", 1)
      .attr("stroke", (d) => (d.id === highlightedId ? "#dc2626" : "#94a3b8"))
      .attr("stroke-width", (d) => (d.id === highlightedId ? 3 : 1.5))
      .attr("d", (d) => line(d.points));
  }, [series, highlightedId, onHighlightChange, width, height]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label="Grafico a linee"
    />
  );
}
