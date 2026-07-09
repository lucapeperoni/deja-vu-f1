"use client";

// Vista 1 della specifica (docs/PROGETTAZIONE.md, sezioni 6 e 7): la
// race trace. Segue la convenzione di src/components/charts/D3Chart.tsx —
// React possiede solo il contenitore (ref, props, stato del tooltip), D3
// possiede l'intero <svg>: scale, assi, bande, linee, marker e brush sono
// tutti dentro useEffect, con redraw incrementale via selection.join.
//
// Task 4.1 (coordinamento tra viste, sezione 7/8): l'evidenziazione è
// tenuta FUORI dall'effect strutturale apposta. Ci sono due effect:
// - quello strutturale (deps: raceData, totalLaps, width) fa scale, assi,
//   bande, join di linee/marker/etichette e attacca gli handler di
//   hover/click/brush una volta sola;
// - un secondo effect, minuscolo (deps: highlightedDriverId), riseleziona
//   gli elementi già disegnati e ne aggiorna solo stroke/opacity/fill —
//   nessun ricalcolo di scale o assi, nessun nuovo data join. Così l'hover
//   (che scatta ad ogni pixel di movimento del mouse) non ridisegna il
//   grafico: cambia solo qualche attributo su nodi che esistono già.
//
// Per evitare che l'effect strutturale debba includere highlightedDriverId
// o lockedDriverId tra le dipendenze (altrimenti tornerebbe a ridisegnare
// tutto ad ogni hover), gli handler di brush/hover leggono il valore
// corrente da due ref sincronizzate con un effect a parte, che non tocca
// il DOM ed è quindi economico anche se gira ad ogni cambiamento.

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  pitContextColor,
  NEUTRALIZATION_BAND_COLORS,
  NEUTRALIZATION_ACCENT_COLOR,
  STORY_ACCENT_COLOR,
  HIGHLIGHT_COLOR,
  DEFAULT_LINE_COLOR,
  TEXT_MUTED_COLOR,
  CONTRAST_TEXT_COLOR,
  WHITE_TEXT_COLOR,
} from "@/lib/colors";
import { useRaceInteraction } from "./RaceInteractionContext";
import ChartTooltip from "@/components/ChartTooltip";

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

export interface StoryStep {
  lap: number;
  title: string;
  text: string;
  eventId: string | null;
  brushRange: { startLap: number; endLap: number } | null;
  driverIds: string[];
}

export interface RaceStory {
  title: string;
  steps: StoryStep[];
}

interface Props {
  raceData: RaceData;
  story?: RaceStory | null;
}

interface TooltipState {
  x: number;
  y: number;
  driverId: string;
  lap: number;
  gapLeader: number | null;
}

const MARGIN_BASE = { top: 28, right: 60, bottom: 32, left: 48 };
const HEIGHT_BASE = 420;
// Riga in più in basso per i marcatori numerati delle tappe di racconto
// (task 5.1, sezione 9): solo le gare-caso con storia la usano.
const STORY_ROW_HEIGHT = 34;
const MIN_LABEL_GAP = 13;
const HOVER_PIXEL_THRESHOLD = 28;
const CLICK_DRAG_THRESHOLD_PX = 4;

function widthForLaps(totalLaps: number): number {
  return Math.max(900, totalLaps * 13);
}

export default function RaceAnatomyTimeline({ raceData, story }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const {
    highlightedDriverId,
    lockedDriverId,
    storyDriverIds,
    setHoveredDriverId,
    toggleLockedDriverId,
    clearLock,
    setBrushRange,
    setSelectedEventId,
    setStoryDriverIds,
    setLockedDriverId,
  } = useRaceInteraction();

  const hasStory = (story?.steps.length ?? 0) > 0;
  const MARGIN = hasStory ? { ...MARGIN_BASE, bottom: MARGIN_BASE.bottom + STORY_ROW_HEIGHT } : MARGIN_BASE;
  const HEIGHT = hasStory ? HEIGHT_BASE + STORY_ROW_HEIGHT : HEIGHT_BASE;

  // Valori "vivi" per gli handler dell'effect strutturale, che non li ha
  // tra le dipendenze (vedi commento in testa al file).
  const highlightedRef = useRef(highlightedDriverId);
  const lockedRef = useRef(lockedDriverId);
  useEffect(() => {
    highlightedRef.current = highlightedDriverId;
  }, [highlightedDriverId]);
  useEffect(() => {
    lockedRef.current = lockedDriverId;
  }, [lockedDriverId]);

  const totalLaps = raceData.race.laps;
  const width = widthForLaps(totalLaps);

  // Setup una tantum: i gruppi persistenti dell'SVG, nell'ordine di
  // disegno (le bande sotto tutto, il brush sopra tutto per intercettare
  // gli eventi del mouse).
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const groups = [
      "bands-group",
      "x-axis",
      "y-axis",
      "series-group",
      "pits-group",
      "labels-group",
      "story-group",
      "brush-group",
    ];
    for (const cls of groups) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  // --- Effect strutturale: scale, assi, bande, linee, marker, etichette,
  // brush. NON dipende dall'evidenziazione: gira solo quando cambiano i
  // dati della gara o le dimensioni del grafico.
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
          .attr("fill", NEUTRALIZATION_ACCENT_COLOR)
          .text(`${d.type} · giri ${d.startLap}-${d.endLap}`);
      });

    // --- Linee dei piloti (stile neutro: l'evidenziazione la dipinge il
    // secondo effect, qui si parte sempre dallo stile di default) ---
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
      .attr("d", (d) => line(d.laps))
      .transition()
      .duration(250)
      .style("opacity", 1);

    // --- Marker dei pit stop (colore di contesto, fisso: non cambia con
    // l'evidenziazione, solo l'opacità la aggiorna il secondo effect) ---
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
            .attr("stroke", CONTRAST_TEXT_COLOR)
            .attr("stroke-width", 1),
        (update) => update,
        (exit) => exit.transition().duration(200).attr("r", 0).remove()
      )
      .attr("fill", (d) => pitContextColor(d.context))
      .transition()
      .duration(250)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y as number)
      .attr("r", 4.5);

    // titolo nativo (tooltip minimo del browser) sui marker
    svg
      .select<SVGGElement>(".pits-group")
      .selectAll<SVGCircleElement, PitPoint>("circle.pit-marker")
      .selectAll("title")
      .data((d) => [d])
      .join("title")
      .text((d) => `${d.driverId} · giro ${d.lap} · ${d.context} · sconto ${d.discount?.toFixed(1) ?? "n/d"}s`);

    // --- Marcatori numerati delle tappe di racconto (task 5.1, sezione 9):
    // una riga sotto l'asse dei giri, con una linea tratteggiata che sale
    // fino in cima al grafico per indicare il giro esatto della tappa.
    // Cliccare un marcatore equivale a cliccare la tappa nel pannello.
    const steps = story?.steps ?? [];
    const storyRowY = MARGIN.top + innerHeight + 26;

    svg
      .select<SVGGElement>(".story-group")
      .selectAll<SVGGElement, StoryStep & { index: number }>("g.story-marker")
      .data(
        steps.map((s, index) => ({ ...s, index })),
        (d) => d.index
      )
      .join(
        (enter) => {
          const g = enter.append("g").attr("class", "story-marker").style("cursor", "pointer");
          g.append("line").attr("class", "story-guide");
          g.append("circle").attr("class", "story-badge").attr("r", 9);
          g.append("text").attr("class", "story-badge-label");
          return g;
        },
        (update) => update,
        (exit) => exit.remove()
      )
      .each(function (d) {
        const g = d3.select(this);
        const x = xScale(d.lap);
        g.select(".story-guide")
          .attr("x1", x)
          .attr("x2", x)
          .attr("y1", MARGIN.top)
          .attr("y2", storyRowY - 10)
          .attr("stroke", STORY_ACCENT_COLOR)
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "3,3")
          .attr("opacity", 0.5);
        g.select(".story-badge")
          .attr("cx", x)
          .attr("cy", storyRowY)
          .attr("fill", STORY_ACCENT_COLOR)
          .attr("stroke", CONTRAST_TEXT_COLOR)
          .attr("stroke-width", 1.5);
        g.select(".story-badge-label")
          .attr("x", x)
          .attr("y", storyRowY)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("font-size", 11)
          .attr("font-weight", 700)
          .attr("fill", WHITE_TEXT_COLOR)
          .style("pointer-events", "none")
          .text(d.index + 1);
        g.select("title").remove();
        g.append("title").text(`${d.index + 1}. ${d.title} (giro ${d.lap})`);
      })
      .on("click", (_event, d) => {
        setBrushRange(d.brushRange ?? null);
        if (d.eventId) setSelectedEventId(d.eventId);
        setStoryDriverIds(d.driverIds.length > 0 ? d.driverIds : null);
        setLockedDriverId(d.driverIds[0] ?? null);
      });

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
            .attr("font-size", 11)
            .attr("dominant-baseline", "middle")
            .style("cursor", "pointer")
            .style("user-select", "none"),
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("y", (d) => labelYById.get(d.id) ?? yScale(0))
      .text((d) => d.id)
      .on("pointerenter", (_event, d) => {
        if (!lockedRef.current) setHoveredDriverId(d.id);
      })
      .on("pointerleave", () => {
        if (!lockedRef.current) setHoveredDriverId(null);
      })
      .on("click", (_event, d) => {
        toggleLockedDriverId(d.id);
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
          setBrushRange(null);
          return;
        }
        const [x0, x1] = selection;
        if (x1 - x0 < CLICK_DRAG_THRESHOLD_PX) {
          // Trascinamento troppo corto: è un click, non una selezione.
          // Blocca/sblocca l'evidenziazione sul pilota più vicino al punto
          // di click, poi ripulisce la selezione del brush.
          const hit = nearestDriverAt(x0, event.sourceEvent?.offsetY ?? MARGIN.top);
          if (!hit) {
            if (lockedRef.current) clearLock();
          } else {
            toggleLockedDriverId(hit.driver.id);
          }
          brushGroupSel.call(brush.move, null);
          setBrushRange(null);
          return;
        }
        const startLap = Math.round(xScale.invert(x0));
        const endLap = Math.round(xScale.invert(x1));
        setBrushRange({ startLap, endLap });
      });

    const brushGroupSel = svg.select<SVGGElement>(".brush-group");
    brushGroupSel.call(brush);

    brushGroupSel
      .select<SVGRectElement>(".overlay")
      .on("pointermove.hover", function (event) {
        if (lockedRef.current) return;
        const [mx, my] = d3.pointer(event, svgRef.current);
        const hit = nearestDriverAt(mx, my);
        if (hit) {
          setHoveredDriverId(hit.driver.id);
          setTooltip({
            x: mx,
            y: my,
            driverId: hit.driver.id,
            lap: hit.lap.l,
            gapLeader: hit.lap.gapLeader,
          });
        } else {
          setHoveredDriverId(null);
          setTooltip(null);
        }
      })
      .on("pointerleave.hover", () => {
        if (lockedRef.current) return;
        setHoveredDriverId(null);
        setTooltip(null);
      });
  }, [
    raceData,
    totalLaps,
    width,
    story,
    setHoveredDriverId,
    toggleLockedDriverId,
    clearLock,
    setBrushRange,
    setSelectedEventId,
    setStoryDriverIds,
    setLockedDriverId,
  ]);

  // --- Effect di evidenziazione: SOLO attributi (stroke/opacity/fill) su
  // elementi già disegnati dall'effect strutturale. Nessun ricalcolo di
  // scale/assi, nessun nuovo data join: è la parte che deve restare
  // economica anche se l'hover scatta ad ogni pixel (task 4.1).
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const storySet = new Set(storyDriverIds ?? []);
    // Un pilota è "coinvolto" se è il pilota bloccato/in hover (evidenziazione
    // piena, bianca) oppure fa parte della tappa di racconto attiva
    // (evidenziazione più tenue, non deve competere col colore del
    // pilota bloccato/hover).
    const isPrimary = (id: string) => id === highlightedDriverId;
    const isInvolved = (id: string) => isPrimary(id) || storySet.has(id);

    svg
      .select<SVGGElement>(".series-group")
      .selectAll<SVGPathElement, RaceDriver>("path.driver-line")
      .attr("stroke", (d) => (isPrimary(d.id) ? HIGHLIGHT_COLOR : isInvolved(d.id) ? STORY_ACCENT_COLOR : DEFAULT_LINE_COLOR))
      .attr("stroke-width", (d) => (isInvolved(d.id) ? 3 : 1.3));

    svg
      .select<SVGGElement>(".pits-group")
      .selectAll<SVGCircleElement, { driverId: string }>("circle.pit-marker")
      .attr("opacity", (d) => (highlightedDriverId || storySet.size > 0 ? (isInvolved(d.driverId) ? 1 : 0.35) : 1))
      .attr("r", (d) => (isInvolved(d.driverId) ? 6 : 4.5));

    svg
      .select<SVGGElement>(".labels-group")
      .selectAll<SVGTextElement, RaceDriver>("text.driver-label")
      .attr("fill", (d) => (isPrimary(d.id) ? HIGHLIGHT_COLOR : isInvolved(d.id) ? STORY_ACCENT_COLOR : TEXT_MUTED_COLOR))
      .attr("font-weight", (d) => (isInvolved(d.id) ? 700 : 400));
    // raceData/totalLaps/width in dipendenza: non per ricalcolare (lo fa
    // l'altro effect), ma per ridipingere l'evidenziazione corrente sugli
    // elementi appena ricreati quando cambia la gara — altrimenti un
    // pilota bloccato "perderebbe" l'evidenziazione al primo redraw
    // strutturale successivo.
  }, [highlightedDriverId, storyDriverIds, raceData, totalLaps, width]);

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
          <ChartTooltip x={tooltip.x} y={tooltip.y}>
            <div className="font-bold">{tooltip.driverId}</div>
            <div className="text-neutral-gray">giro {tooltip.lap}</div>
            <div>
              gap leader{" "}
              {tooltip.gapLeader != null ? `${tooltip.gapLeader >= 0 ? "+" : ""}${tooltip.gapLeader.toFixed(1)}s` : "n/d"}
            </div>
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}
