"use client";

// Vista 1 della specifica (docs/PROGETTAZIONE.md, sezioni 6 e 7): la race
// trace. Segue la convenzione di src/components/charts/D3Chart.tsx — React
// possiede solo il contenitore (ref, props, stato del tooltip/lock), D3
// possiede l'intero <svg>: scale, assi, bande, linee, marker e brush sono
// tutti dentro useEffect, con redraw incrementale via selection.join.
//
// Nota per il task 4.1 (coordinamento tra viste): oggi ogni hover richiama
// onHighlightChange, che aggiorna lo stato nel componente padre e fa
// ri-eseguire questo effetto da capo (ricalcola scale/assi). Funziona, ma
// non è il redraw "solo attributi" richiesto dal checklist di 4.1 — lì va
// ottimizzato separando l'aggiornamento dell'evidenziazione (stroke/width)
// dal resto, così l'hover non ricalcola scale e assi a ogni pixel.

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { pitContextColor, NEUTRALIZATION_BAND_COLORS, HIGHLIGHT_COLOR, DEFAULT_LINE_COLOR } from "@/lib/colors";

export interface RaceLap {
  l: number;
  pos: number | null;
  ms: number | null;
  gapLeader: number | null;
  trace: number | null;
}

export interface RacePit {
  lap: number;
  context: string;
  eventId: string | null;
  effectiveLoss: number | null;
  discount: number | null;
  posBefore: number | null;
  posAfter: number | null;
  posAfter3: number | null;
  posAfter5: number | null;
  doubleStack: boolean;
}

export interface RaceDriver {
  id: string;
  driverId: string;
  team: string | null;
  grid: number | null;
  finish: number | null;
  laps: RaceLap[];
  pits: RacePit[];
  outcomes: { event: number; eventId: string; category: string; posDelta: number | null }[];
}

export interface RaceNeutralization {
  eventId: string;
  type: "SC" | "VSC";
  startLap: number;
  endLap: number;
}

export interface RaceData {
  race: {
    raceId: string;
    name: string;
    circuit: string | null;
    country: string | null;
    year: number;
    round: number;
    date: string;
    laps: number;
    nominalPitLoss: number | null;
    excludedAnomalousLaps: number;
  };
  neutralizations: RaceNeutralization[];
  drivers: RaceDriver[];
}

interface BrushRange {
  startLap: number;
  endLap: number;
}

interface Props {
  raceData: RaceData;
  highlightedDriverId: string | null;
  onHighlightChange: (id: string | null) => void;
  onBrushChange?: (range: BrushRange | null) => void;
}

interface TooltipState {
  x: number;
  y: number;
  driverId: string;
  lap: number;
  gapLeader: number | null;
}

const MARGIN = { top: 28, right: 60, bottom: 32, left: 48 };
const HEIGHT = 420;
const MIN_LABEL_GAP = 13;
const HOVER_PIXEL_THRESHOLD = 28;
const CLICK_DRAG_THRESHOLD_PX = 4;

function widthForLaps(totalLaps: number): number {
  return Math.max(900, totalLaps * 13);
}

export default function RaceAnatomyTimeline({
  raceData,
  highlightedDriverId,
  onHighlightChange,
  onBrushChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [locked, setLocked] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const totalLaps = raceData.race.laps;
  const width = widthForLaps(totalLaps);

  // Setup una tantum: i gruppi persistenti dell'SVG, nell'ordine di
  // disegno (le bande sotto tutto, il brush sopra tutto per intercettare
  // gli eventi del mouse).
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const groups = ["bands-group", "x-axis", "y-axis", "series-group", "pits-group", "labels-group", "brush-group"];
    for (const cls of groups) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const drivers = raceData.drivers;
    const allTraces = drivers.flatMap((d) => d.laps.map((l) => l.trace).filter((v): v is number => v != null));
    const yExtent = d3.extent(allTraces) as [number, number];
    const yPad = (yExtent[1] - yExtent[0]) * 0.08 || 1;

    const xScale = d3
      .scaleLinear()
      .domain([1, totalLaps])
      .range([MARGIN.left, MARGIN.left + innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([MARGIN.top + innerHeight, MARGIN.top]);

    // --- Assi ---
    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0, ${MARGIN.top + innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(Math.min(totalLaps, 15)).tickFormat((d) => `${d}`));

    svg
      .select<SVGGElement>(".y-axis")
      .attr("transform", `translate(${MARGIN.left}, 0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d}s`));

    // --- Bande di neutralizzazione ---
    svg
      .select<SVGGElement>(".bands-group")
      .selectAll<SVGGElement, RaceNeutralization>("g.band")
      .data(raceData.neutralizations, (d) => d.eventId)
      .join(
        (enter) => {
          const g = enter.append("g").attr("class", "band");
          g.append("rect");
          g.append("text");
          return g;
        },
        (update) => update,
        (exit) => exit.remove()
      )
      .each(function (d) {
        const g = d3.select(this);
        const x0 = xScale(d.startLap);
        const x1 = xScale(d.endLap);
        const w = Math.max(x1 - x0, 6);
        g.select("rect")
          .attr("x", x0)
          .attr("y", MARGIN.top)
          .attr("width", w)
          .attr("height", innerHeight)
          .attr("fill", NEUTRALIZATION_BAND_COLORS[d.type]);
        g.select("text")
          .attr("x", x0 + w / 2)
          .attr("y", MARGIN.top - 10)
          .attr("text-anchor", "middle")
          .attr("font-size", 11)
          .attr("fill", "#eab308")
          .text(`${d.type} · giri ${d.startLap}-${d.endLap}`);
      });

    // --- Linee dei piloti ---
    const line = d3
      .line<RaceLap>()
      .defined((d) => d.trace != null)
      .x((d) => xScale(d.l))
      .y((d) => yScale(d.trace as number));

    svg
      .select<SVGGElement>(".series-group")
      .selectAll<SVGPathElement, RaceDriver>("path.driver-line")
      .data(drivers, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("path")
            .attr("class", "driver-line")
            .attr("fill", "none")
            .attr("stroke", DEFAULT_LINE_COLOR)
            .attr("stroke-width", 1.3)
            .attr("d", (d) => line(d.laps))
            .style("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(200).style("opacity", 0).remove()
      )
      .transition()
      .duration(250)
      .style("opacity", 1)
      .attr("stroke", (d) => (d.id === highlightedDriverId ? HIGHLIGHT_COLOR : DEFAULT_LINE_COLOR))
      .attr("stroke-width", (d) => (d.id === highlightedDriverId ? 3 : 1.3))
      .attr("d", (d) => line(d.laps));

    // --- Marker dei pit stop ---
    type PitPoint = RacePit & { driverId: string; x: number; y: number | null };
    const pitPoints: PitPoint[] = drivers.flatMap((d) =>
      d.pits.map((p) => {
        const lapEntry = d.laps.find((l) => l.l === p.lap);
        return { ...p, driverId: d.id, x: xScale(p.lap), y: lapEntry?.trace != null ? yScale(lapEntry.trace) : null };
      })
    );

    svg
      .select<SVGGElement>(".pits-group")
      .selectAll<SVGCircleElement, PitPoint>("circle.pit-marker")
      .data(
        pitPoints.filter((p) => p.y != null),
        (d) => `${d.driverId}-${d.lap}`
      )
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "pit-marker")
            .attr("r", 0)
            .attr("cx", (d) => d.x)
            .attr("cy", (d) => d.y as number)
            .attr("stroke", "#0a0a0a")
            .attr("stroke-width", 1),
        (update) => update,
        (exit) => exit.transition().duration(200).attr("r", 0).remove()
      )
      .attr("fill", (d) => pitContextColor(d.context))
      .attr("opacity", (d) => (highlightedDriverId && d.driverId !== highlightedDriverId ? 0.35 : 1))
      .transition()
      .duration(250)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y as number)
      .attr("r", (d) => (d.driverId === highlightedDriverId ? 6 : 4.5));

    // titolo nativo (tooltip minimo del browser) sui marker
    svg
      .select<SVGGElement>(".pits-group")
      .selectAll<SVGCircleElement, PitPoint>("circle.pit-marker")
      .selectAll("title")
      .data((d) => [d])
      .join("title")
      .text((d) => `${d.driverId} · giro ${d.lap} · ${d.context} · sconto ${d.discount?.toFixed(1) ?? "n/d"}s`);

    // --- Etichette dei piloti a fine linea, con separazione minima ---
    const rawLabelPoints = drivers
      .map((d) => {
        const lastDefined = [...d.laps].reverse().find((l) => l.trace != null);
        if (!lastDefined) return null;
        return { id: d.id, y: yScale(lastDefined.trace as number) };
      })
      .filter((d): d is { id: string; y: number } => d != null)
      .sort((a, b) => a.y - b.y);

    for (let i = 1; i < rawLabelPoints.length; i++) {
      if (rawLabelPoints[i].y - rawLabelPoints[i - 1].y < MIN_LABEL_GAP) {
        rawLabelPoints[i].y = rawLabelPoints[i - 1].y + MIN_LABEL_GAP;
      }
    }
    const labelYById = new Map(rawLabelPoints.map((p) => [p.id, p.y]));

    svg
      .select<SVGGElement>(".labels-group")
      .selectAll<SVGTextElement, RaceDriver>("text.driver-label")
      .data(drivers, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("text")
            .attr("class", "driver-label")
            .attr("x", MARGIN.left + innerWidth + 6)
            .attr("font-size", 10)
            .attr("dominant-baseline", "middle")
            .style("cursor", "pointer")
            .style("user-select", "none"),
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("y", (d) => labelYById.get(d.id) ?? yScale(0))
      .attr("fill", (d) => (d.id === highlightedDriverId ? HIGHLIGHT_COLOR : "#9ca3af"))
      .attr("font-weight", (d) => (d.id === highlightedDriverId ? 700 : 400))
      .text((d) => d.id)
      .on("pointerenter", (_event, d) => {
        if (!locked) onHighlightChange(d.id);
      })
      .on("pointerleave", () => {
        if (!locked) onHighlightChange(null);
      })
      .on("click", (_event, d) => {
        if (locked && highlightedDriverId === d.id) {
          setLocked(false);
          onHighlightChange(d.id);
        } else {
          setLocked(true);
          onHighlightChange(d.id);
        }
      });

    // --- Hover sulle linee + brush, sulla stessa area di interazione ---
    // Il brush intercetta tutti gli eventi del mouse nella sua area (il suo
    // <rect class="overlay"> ha pointer-events:all): per far convivere
    // hover (tooltip/evidenziazione) e trascinamento (filtro sui giri) si
    // aggiungono i listener di hover come EVENTI NAMESPACED SEPARATI
    // ("pointermove.hover") sullo stesso overlay, invece che su path
    // individuali — d3-brush usa il namespace ".brush" internamente e non
    // li sovrascrive.
    function driverLapsSorted(d: RaceDriver) {
      return d.laps.filter((l) => l.trace != null);
    }

    function nearestDriverAt(mx: number, my: number): { driver: RaceDriver; lap: RaceLap } | null {
      const lapAtMouse = xScale.invert(mx);
      let best: { driver: RaceDriver; lap: RaceLap; distPx: number } | null = null;
      for (const d of drivers) {
        const laps = driverLapsSorted(d);
        if (laps.length === 0) continue;
        let nearest = laps[0];
        let minLapDist = Math.abs(nearest.l - lapAtMouse);
        for (const l of laps) {
          const dist = Math.abs(l.l - lapAtMouse);
          if (dist < minLapDist) {
            minLapDist = dist;
            nearest = l;
          }
        }
        const py = yScale(nearest.trace as number);
        const distPx = Math.abs(py - my);
        if (!best || distPx < best.distPx) best = { driver: d, lap: nearest, distPx };
      }
      if (best && best.distPx <= HOVER_PIXEL_THRESHOLD) return { driver: best.driver, lap: best.lap };
      return null;
    }

    const brush = d3
      .brushX()
      .extent([
        [MARGIN.left, MARGIN.top],
        [MARGIN.left + innerWidth, MARGIN.top + innerHeight],
      ])
      .on("end", (event) => {
        const selection = event.selection as [number, number] | null;
        if (!selection) {
          onBrushChange?.(null);
          return;
        }
        const [x0, x1] = selection;
        if (x1 - x0 < CLICK_DRAG_THRESHOLD_PX) {
          // Trascinamento troppo corto: è un click, non una selezione.
          // Blocca/sblocca l'evidenziazione sul pilota più vicino al punto
          // di click, poi ripulisce la selezione del brush.
          const hit = nearestDriverAt(x0, event.sourceEvent?.offsetY ?? MARGIN.top);
          if (!hit) {
            if (locked) {
              setLocked(false);
              onHighlightChange(null);
            }
          } else if (locked && highlightedDriverId === hit.driver.id) {
            setLocked(false);
            onHighlightChange(hit.driver.id);
          } else {
            setLocked(true);
            onHighlightChange(hit.driver.id);
          }
          brushGroupSel.call(brush.move, null);
          onBrushChange?.(null);
          return;
        }
        const startLap = Math.round(xScale.invert(x0));
        const endLap = Math.round(xScale.invert(x1));
        onBrushChange?.({ startLap, endLap });
      });

    const brushGroupSel = svg.select<SVGGElement>(".brush-group");
    brushGroupSel.call(brush);

    brushGroupSel
      .select<SVGRectElement>(".overlay")
      .on("pointermove.hover", function (event) {
        if (locked) return;
        const [mx, my] = d3.pointer(event, svgRef.current);
        const hit = nearestDriverAt(mx, my);
        if (hit) {
          onHighlightChange(hit.driver.id);
          setTooltip({
            x: mx,
            y: my,
            driverId: hit.driver.id,
            lap: hit.lap.l,
            gapLeader: hit.lap.gapLeader,
          });
        } else {
          onHighlightChange(null);
          setTooltip(null);
        }
      })
      .on("pointerleave.hover", () => {
        if (locked) return;
        onHighlightChange(null);
        setTooltip(null);
      });
  }, [raceData, highlightedDriverId, onHighlightChange, onBrushChange, locked, totalLaps, width]);

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative overflow-x-auto hide-scrollbar">
      <div style={{ position: "relative", width }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Race trace di ${raceData.race.name} ${raceData.race.year}`}
        />
        {tooltip && (
          <div
            className="pointer-events-none absolute z-50 rounded-md border border-white/20 bg-black/85 px-3 py-2 text-xs text-white shadow-xl"
            style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
          >
            <div className="font-bold">{tooltip.driverId}</div>
            <div className="text-neutral-gray">giro {tooltip.lap}</div>
            <div>
              gap leader{" "}
              {tooltip.gapLeader != null ? `${tooltip.gapLeader >= 0 ? "+" : ""}${tooltip.gapLeader.toFixed(1)}s` : "n/d"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
