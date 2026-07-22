"use client";

// Mini-vista del compositore (docs/PROGETTAZIONE.md, sezione 7, vista 2):
// "muovendo la soglia, [...] è qui che si vede la rarità DIVENTARE rarità
// (10° o peggio: 40 volte; 15°: 9; 20°: 1)". Stesso idioma visivo della
// vista 1 (RarityScale.tsx) — asse di rarità logaritmico, dal più comune a
// sinistra al più raro a destra — ma con una sola riga: tutti i valori
// precalcolati del parametro corrente come tacche, quello selezionato come
// marker pieno che SI SPOSTA in transizione D3 quando il parametro cambia.
//
// Convenzione D3 del progetto: D3 possiede l'SVG (scale, data join,
// transizioni dentro useEffect), React passa solo i dati e lo stato.

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { familyColor, HIGHLIGHT_COLOR, TEXT_MUTED_COLOR, TEXT_PRIMARY_COLOR } from "@/lib/colors";

export interface ParameterVariantPoint {
  key: string; // JSON.stringify(parametri), per il data join
  label: string; // etichetta del valore parametro (es. "10", "UNDER_SC")
  rarita: number;
  occorrenze: number;
}

interface Props {
  points: ParameterVariantPoint[];
  currentKey: string;
  famiglia: string;
  onSelect?: (key: string) => void;
}

const WIDTH = 640;
const HEIGHT = 90;
const MARGIN = { top: 12, right: 24, bottom: 28, left: 24 };

export default function ParameterRarityTrack({ points, currentKey, famiglia, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const rarityExtent = d3.extent(points, (d) => d.rarita) as [number, number];
  const color = familyColor(famiglia);

  const xScale = useMemo(() => {
    const [min, max] = rarityExtent;
    const domain: [number, number] = min === max ? [min * 1.5, min * 0.5] : [max, min];
    return d3
      .scaleLog()
      .domain(domain[0] > 0 ? domain : [1, 0.001])
      .range([MARGIN.left, WIDTH - MARGIN.right])
      .clamp(true);
  }, [rarityExtent]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    for (const cls of ["track-line", "ticks-group", "current-marker"]) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
    if (svg.select("line.track-baseline").empty()) {
      svg
        .select(".track-line")
        .append("line")
        .attr("class", "track-baseline")
        .attr("y1", HEIGHT / 2)
        .attr("y2", HEIGHT / 2)
        .attr("stroke", TEXT_MUTED_COLOR)
        .attr("stroke-opacity", 0.3);
    }
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select("line.track-baseline")
      .attr("x1", MARGIN.left)
      .attr("x2", WIDTH - MARGIN.right);

    const ticks = svg
      .select<SVGGElement>(".ticks-group")
      .selectAll<SVGGElement, ParameterVariantPoint>("g.tick-item")
      .data(points, (d) => d.key);

    const ticksEntered = ticks
      .enter()
      .append("g")
      .attr("class", "tick-item")
      .style("cursor", onSelect ? "pointer" : "default");

    ticksEntered.append("circle").attr("class", "tick-dot");
    ticksEntered.append("text").attr("class", "tick-label");

    ticks.exit().remove();

    const ticksMerged = ticksEntered.merge(ticks);
    ticksMerged.on("click", (_event, d) => onSelect?.(d.key));

    ticksMerged
      .select<SVGCircleElement>("circle.tick-dot")
      .attr("cx", (d) => xScale(d.rarita))
      .attr("cy", HEIGHT / 2)
      .attr("r", (d) => (d.key === currentKey ? 0 : 4))
      .attr("fill", TEXT_MUTED_COLOR)
      .attr("opacity", (d) => (d.key === currentKey ? 0 : 0.5));

    // Le tacche agli estremi del dominio (rarita massima/minima) siedono
    // esattamente sul bordo dell'asse: un'etichetta centrata lì uscirebbe
    // dal viewBox. Ancoraggio start/end per i due bordi, middle nel mezzo.
    const [rarestMax, rarestMin] = xScale.domain();

    ticksMerged
      .select<SVGTextElement>("text.tick-label")
      .attr("x", (d) => xScale(d.rarita))
      .attr("y", HEIGHT / 2 + 22)
      .attr("text-anchor", (d) => {
        if (d.rarita === rarestMax) return "start";
        if (d.rarita === rarestMin) return "end";
        return "middle";
      })
      .attr("font-size", 11)
      .attr("fill", (d) => (d.key === currentKey ? TEXT_PRIMARY_COLOR : TEXT_MUTED_COLOR))
      .attr("font-weight", (d) => (d.key === currentKey ? 700 : 400))
      .text((d) => d.label);

    const current = points.find((p) => p.key === currentKey);

    const marker = svg
      .select<SVGGElement>(".current-marker")
      .selectAll<SVGCircleElement, ParameterVariantPoint>("circle.current-dot")
      .data(current ? [current] : [], (d) => d.key);

    marker
      .enter()
      .append("circle")
      .attr("class", "current-dot")
      .attr("cx", (d) => xScale(d.rarita))
      .attr("cy", HEIGHT / 2)
      .attr("r", 0)
      .attr("fill", color)
      .attr("stroke", HIGHLIGHT_COLOR)
      .attr("stroke-width", 1.5)
      .merge(marker)
      .transition()
      .duration(400)
      .ease(d3.easeCubicOut)
      .attr("cx", (d) => xScale(d.rarita))
      .attr("r", 8);
  }, [points, currentKey, xScale, color, onSelect]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label="Rarità di tutti i valori disponibili per il parametro corrente, dal più comune al più raro"
    />
  );
}
