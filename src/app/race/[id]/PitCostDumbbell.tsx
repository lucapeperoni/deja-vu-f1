"use client";

// Vista 2 della specifica (docs/PROGETTAZIONE.md, sezioni 5.3, 6 e 7):
// gli sconti. Stessa convenzione delle altre viste — React possiede solo
// il contenitore (ref, props, stato del tooltip), D3 possiede l'intero
// <svg> dentro useEffect, redraw incrementale via selection.join.
//
// Task 4.1: come in RaceAnatomyTimeline, l'effect strutturale (posizione e
// dimensione delle barre, che dipendono da raceData/brushRange) è separato
// da un secondo effect che dipinge SOLO l'evidenziazione (stroke/opacity)
// quando cambia highlightedDriverId — nessun ricalcolo di scale o nuovo
// data join ad ogni hover.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { pitContextColor, HIGHLIGHT_COLOR, DEFAULT_LINE_COLOR, TEXT_PRIMARY_COLOR } from "@/lib/colors";
import type { RaceData } from "./RaceAnatomyTimeline";
import { useRaceInteraction } from "./RaceInteractionContext";
import ChartTooltip from "@/components/ChartTooltip";

interface Props {
  raceData: RaceData;
}

interface PitDatum {
  key: string;
  driverId: string;
  lap: number;
  context: string;
  effectiveLoss: number | null;
  discount: number;
  posBefore: number | null;
  posAfter: number | null;
}

interface TooltipState {
  x: number;
  y: number;
  datum: PitDatum;
}

const MARGIN = { top: 12, right: 56, bottom: 32, left: 56 };
const BAR_HEIGHT = 18;
const BAR_GAP = 6;
const WIDTH = 720;
const MAX_HEIGHT = 560;

function allPits(raceData: RaceData): PitDatum[] {
  return raceData.drivers.flatMap((driver) =>
    driver.pits
      .filter((p) => p.discount != null)
      .map((p) => ({
        key: `${driver.id}-${p.lap}`,
        driverId: driver.id,
        lap: p.lap,
        context: p.context,
        effectiveLoss: p.effectiveLoss,
        discount: p.discount as number,
        posBefore: p.posBefore,
        posAfter: p.posAfter,
      }))
  );
}

export default function PitCostDumbbell({ raceData }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const { highlightedDriverId, lockedDriverId, setHoveredDriverId, toggleLockedDriverId, brushRange } =
    useRaceInteraction();

  const lockedRef = useRef(lockedDriverId);
  useEffect(() => {
    lockedRef.current = lockedDriverId;
  }, [lockedDriverId]);

  const pits = useMemo(() => allPits(raceData), [raceData]);
  const visiblePits = useMemo(() => {
    const filtered = brushRange
      ? pits.filter((p) => p.lap >= brushRange.startLap && p.lap <= brushRange.endLap)
      : pits;
    return [...filtered].sort((a, b) => a.discount - b.discount);
  }, [pits, brushRange]);

  const height = MARGIN.top + MARGIN.bottom + Math.max(visiblePits.length, 1) * (BAR_HEIGHT + BAR_GAP);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const groups = ["zero-line", "x-axis", "bars-group"];
    for (const cls of groups) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  // Se cambia l'intervallo selezionato (o l'insieme dei pit visibili), un
  // tooltip aperto potrebbe riferirsi a una barra appena rimossa dal
  // filtro: lo si chiude per sicurezza invece di lasciarlo "appeso".
  useEffect(() => {
    setTooltip(null);
  }, [brushRange]);

  // --- Effect strutturale: dipende da raceData/brushRange (il brush è un
  // filtro esplicito, non un hover: qui è corretto ricalcolare posizioni e
  // barre). NON dipende da highlightedDriverId.
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;

    const maxAbsDiscount = Math.max(1, d3.max(pits, (d) => Math.abs(d.discount)) ?? 1);
    const xScale = d3
      .scaleLinear()
      .domain([-maxAbsDiscount, maxAbsDiscount])
      .nice()
      .range([MARGIN.left, MARGIN.left + innerWidth]);

    const yScale = d3
      .scaleBand<string>()
      .domain(visiblePits.map((d) => d.key))
      .range([MARGIN.top, MARGIN.top + innerHeight])
      .paddingInner(BAR_GAP / (BAR_HEIGHT + BAR_GAP));

    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0, ${MARGIN.top + innerHeight})`)
      .transition()
      .duration(300)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat((d) => `${d}s`));

    svg
      .select<SVGGElement>(".zero-line")
      .selectAll<SVGLineElement, null>("line")
      .data([null])
      .join("line")
      .attr("x1", xScale(0))
      .attr("x2", xScale(0))
      .attr("y1", MARGIN.top)
      .attr("y2", MARGIN.top + innerHeight)
      .attr("stroke", DEFAULT_LINE_COLOR)
      .attr("stroke-width", 1);

    const barsGroup = svg.select<SVGGElement>(".bars-group");

    const rows = barsGroup
      .selectAll<SVGGElement, PitDatum>("g.pit-row")
      .data(visiblePits, (d) => d.key)
      .join(
        (enter) => {
          const g = enter
            .append("g")
            .attr("class", "pit-row")
            .style("cursor", "pointer")
            .attr("transform", (d) => `translate(0, ${yScale(d.key) ?? 0})`)
            .style("opacity", 0);
          g.append("rect").attr("class", "pit-bar").attr("height", BAR_HEIGHT).attr("rx", 2);
          g.append("text")
            .attr("class", "pit-label")
            .attr("dominant-baseline", "middle")
            .attr("font-size", 11);
          return g;
        },
        (update) => update,
        (exit) =>
          exit
            .transition()
            .duration(250)
            .style("opacity", 0)
            .attr("transform", (d) => `translate(0, ${(yScale(d.key) ?? 0) + 8})`)
            .remove()
      );

    rows
      .on("pointerenter", (_event, d) => {
        if (!lockedRef.current) setHoveredDriverId(d.driverId);
      })
      .on("pointerleave", () => {
        if (!lockedRef.current) setHoveredDriverId(null);
      })
      .on("pointermove", function (event, d) {
        const [mx, my] = d3.pointer(event, svgRef.current);
        setTooltip({ x: mx, y: my, datum: d });
      })
      .on("click", (_event, d) => {
        toggleLockedDriverId(d.driverId);
      });

    rows.transition().duration(350).style("opacity", 1).attr("transform", (d) => `translate(0, ${yScale(d.key) ?? 0})`);

    rows
      .select<SVGRectElement>("rect.pit-bar")
      .attr("fill", (d) => pitContextColor(d.context))
      .transition()
      .duration(350)
      .attr("x", (d) => Math.min(xScale(0), xScale(d.discount)))
      .attr("width", (d) => Math.max(Math.abs(xScale(d.discount) - xScale(0)), 1));

    rows
      .select<SVGTextElement>("text.pit-label")
      .attr("text-anchor", (d) => (d.discount >= 0 ? "start" : "end"))
      .attr("y", BAR_HEIGHT / 2)
      .transition()
      .duration(350)
      .attr("x", (d) => xScale(d.discount) + (d.discount >= 0 ? 6 : -6))
      .textTween(function (d) {
        // Interpola il numero mostrato insieme alla barra, invece di farlo
        // scattare di colpo a fine transizione.
        const node = this as SVGTextElement;
        const previous = parseFloat(node.textContent?.match(/-?\d+\.?\d*/)?.[0] ?? `${d.discount}`);
        const interpolate = d3.interpolateNumber(previous, d.discount);
        return (t) => `${d.driverId} ${interpolate(t) >= 0 ? "+" : ""}${interpolate(t).toFixed(1)}s`;
      });
  }, [raceData, visiblePits, pits, height, setHoveredDriverId, toggleLockedDriverId]);

  // --- Effect di evidenziazione: solo stroke/opacity/colore testo sui
  // nodi già disegnati, nessun nuovo join.
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select<SVGGElement>(".bars-group")
      .selectAll<SVGGElement, PitDatum>("g.pit-row")
      .style("opacity", (d) => (highlightedDriverId && d.driverId !== highlightedDriverId ? 0.4 : 1));

    svg
      .select<SVGGElement>(".bars-group")
      .selectAll<SVGRectElement, PitDatum>("rect.pit-bar")
      .attr("stroke", (d) => (d.driverId === highlightedDriverId ? HIGHLIGHT_COLOR : "none"))
      .attr("stroke-width", 1.5);

    svg
      .select<SVGGElement>(".bars-group")
      .selectAll<SVGTextElement, PitDatum>("text.pit-label")
      .attr("fill", (d) => (d.driverId === highlightedDriverId ? HIGHLIGHT_COLOR : TEXT_PRIMARY_COLOR))
      .attr("font-weight", (d) => (d.driverId === highlightedDriverId ? 700 : 400));
    // visiblePits in dipendenza solo per ridipingere l'evidenziazione dopo
    // un redraw strutturale (nuovo brush): il ricalcolo vero e proprio lo
    // fa l'altro effect.
  }, [highlightedDriverId, visiblePits]);

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative">
      <p className="text-xs text-neutral-gray mb-3">
        Prezzo di listino di questa gara:{" "}
        <span className="text-white font-bold">
          {raceData.race.nominalPitLoss != null ? `${raceData.race.nominalPitLoss.toFixed(1)}s` : "n/d"}
        </span>
        {brushRange && (
          <span>
            {" "}
            · mostrando i pit tra giro {brushRange.startLap} e giro {brushRange.endLap}
          </span>
        )}
      </p>
      {visiblePits.length === 0 ? (
        <p className="text-sm text-text-secondary italic">Nessun pit stop nell&apos;intervallo selezionato.</p>
      ) : (
        <div style={{ maxHeight: MAX_HEIGHT, overflowY: height >= MAX_HEIGHT ? "auto" : "visible" }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${height}`}
            width="100%"
            height={height}
            role="img"
            aria-label={`Sconti dei pit stop di ${raceData.race.name} ${raceData.race.year}`}
          />
        </div>
      )}
      {tooltip && (
        <ChartTooltip x={tooltip.x} y={tooltip.y + MARGIN.top + 10}>
          <div className="font-bold">
            {tooltip.datum.driverId} · giro {tooltip.datum.lap}
          </div>
          <div className="text-neutral-gray mt-1">
            costo effettivo {tooltip.datum.effectiveLoss != null ? `${tooltip.datum.effectiveLoss.toFixed(1)}s` : "n/d"}
          </div>
          <div>
            sconto {tooltip.datum.discount >= 0 ? "+" : ""}
            {tooltip.datum.discount.toFixed(1)}s
          </div>
          <div className="text-neutral-gray mt-1">
            posizione {tooltip.datum.posBefore ?? "n/d"} → {tooltip.datum.posAfter ?? "n/d"}
          </div>
        </ChartTooltip>
      )}
    </div>
  );
}
