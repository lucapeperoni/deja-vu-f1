"use client";

// Vista 6 della specifica (docs/PROGETTAZIONE.md, sezione 7): la
// distribuzione degli sconti, in home — dà il peso statistico alla tesi
// dell'intero progetto. Tutti i pit stop 2023-2024 su un asse orizzontale
// del costo effettivo (sezione 5.1): la nuvola dei pit in verde si
// raggruppa intorno al prezzo pieno, quella sotto neutralizzazione si
// allarga verso il basso costo. Stessa convenzione D3-possiede-l'SVG delle
// viste della pagina gara: React tiene solo ref/stato (tooltip), D3 fa
// scale, assi e il posizionamento a sciame (force collide, sezione 7)
// dentro un unico useEffect.
//
// Lo sciame non è animato in tempo reale: con ~1700 punti far vedere il
// D3-force che vibra ad ogni render sarebbe solo rumore. La simulazione
// gira UNA VOLTA (stop() + tick manuali) quando cambiano i dati, poi il
// join disegna solo la posizione finale, con un fade-in.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { useRouter } from "next/navigation";
import { pitContextColor, PIT_CONTEXT_LEGEND, HIGHLIGHT_COLOR } from "@/lib/colors";

export interface PitPoint {
  key: string;
  raceId: string;
  raceName: string;
  year: number;
  driverCode: string;
  context: string;
  effectiveLoss: number;
  discount: number | null;
  doubleStack: boolean;
}

interface Props {
  points: PitPoint[];
  listinoTipico: number;
}

interface SimPoint extends PitPoint {
  x: number;
  y: number;
}

interface TooltipState {
  x: number;
  y: number;
  point: PitPoint;
}

const MARGIN = { top: 24, right: 40, bottom: 40, left: 40 };
const WIDTH = 1120;
const HEIGHT = 440;
const RADIUS = 3;
const SIM_TICKS = 160;

export default function PitStopBeeswarm({ points, listinoTipico }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const router = useRouter();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredContext, setHoveredContext] = useState<string | null>(null);

  const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const centerY = MARGIN.top + innerHeight / 2;

  const xScale = useMemo(() => {
    const extent = d3.extent(points, (d) => d.effectiveLoss) as [number, number];
    return d3
      .scaleLinear()
      .domain([Math.min(0, extent[0]), extent[1]])
      .nice()
      .range([MARGIN.left, MARGIN.left + innerWidth])
      .clamp(true);
  }, [points, innerWidth]);

  // La simulazione a sciame gira una sola volta per dataset (non ad ogni
  // hover): forceX porta ogni punto verso la sua ascissa "vera" (il costo
  // effettivo), forceCollide impedisce le sovrapposizioni, forceY li
  // ricentra verticalmente. Sezione 7: "force collide semplice".
  const simPoints = useMemo<SimPoint[]>(() => {
    // Jitter verticale iniziale deterministico (seed fisso): serve solo a
    // dare alla simulazione un punto di partenza non allineato, non deve
    // cambiare ad ogni render (Math.random() qui romperebbe la purezza del
    // render, oltre a rendere i risultati non riproducibili).
    const jitter = d3.randomLcg(0.42);
    const nodes: SimPoint[] = points.map((p) => ({
      ...p,
      x: xScale(p.effectiveLoss),
      y: centerY + (jitter() - 0.5) * innerHeight * 0.6,
    }));

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("x", d3.forceX((d) => xScale((d as SimPoint).effectiveLoss)).strength(1))
      .force("y", d3.forceY(centerY).strength(0.06))
      .force("collide", d3.forceCollide(RADIUS + 0.6))
      .stop();

    for (let i = 0; i < SIM_TICKS; i++) simulation.tick();

    // Tieni i punti dentro l'area disegnabile anche dopo la collisione.
    for (const n of nodes) {
      n.y = Math.max(MARGIN.top + RADIUS, Math.min(MARGIN.top + innerHeight - RADIUS, n.y));
    }

    return nodes;
  }, [points, xScale, centerY, innerHeight]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const groups = ["x-axis", "reference-line", "points-group"];
    for (const cls of groups) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0, ${MARGIN.top + innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(10).tickFormat((d) => `${d}s`));

    // Linea di riferimento: il prezzo di listino tipico (mediana dei pit
    // in verde su tutto il campione, sezione 5.2).
    const refX = xScale(listinoTipico);
    const refGroup = svg.select<SVGGElement>(".reference-line");
    refGroup
      .selectAll("line")
      .data([listinoTipico])
      .join("line")
      .attr("x1", refX)
      .attr("x2", refX)
      .attr("y1", MARGIN.top)
      .attr("y2", MARGIN.top + innerHeight)
      .attr("stroke", "#eab308")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 4")
      .attr("opacity", 0.6);
    refGroup
      .selectAll("text")
      .data([listinoTipico])
      .join("text")
      .attr("x", refX)
      .attr("y", MARGIN.top - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", "#eab308")
      .text(`prezzo di listino · ${listinoTipico.toFixed(1)}s`);

    svg
      .select<SVGGElement>(".points-group")
      .selectAll<SVGCircleElement, SimPoint>("circle.pit-point")
      .data(simPoints, (d) => d.key)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "pit-point")
            .attr("cx", (d) => d.x)
            .attr("cy", (d) => d.y)
            .attr("r", 0)
            .style("cursor", "pointer"),
        (update) => update,
        (exit) => exit.transition().duration(200).attr("r", 0).remove()
      )
      .attr("fill", (d) => pitContextColor(d.context))
      .attr("opacity", (d) => (hoveredContext && d.context !== hoveredContext ? 0.12 : 0.85))
      .on("pointerenter", function (event, d) {
        d3.select(this).attr("stroke", HIGHLIGHT_COLOR).attr("stroke-width", 1.5);
        const [mx, my] = d3.pointer(event, svgRef.current);
        setTooltip({ x: mx, y: my, point: d });
      })
      .on("pointermove", function (event, d) {
        const [mx, my] = d3.pointer(event, svgRef.current);
        setTooltip({ x: mx, y: my, point: d });
      })
      .on("pointerleave", function () {
        d3.select(this).attr("stroke", "none");
        setTooltip(null);
      })
      .on("click", (_event, d) => {
        router.push(`/race/${d.raceId}`);
      })
      .transition()
      .duration(400)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", RADIUS);
  }, [simPoints, xScale, innerHeight, listinoTipico, hoveredContext, router]);

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative overflow-x-auto hide-scrollbar">
      <div style={{ position: "relative", width: WIDTH }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label="Distribuzione del costo effettivo di tutti i pit stop 2023-2024"
        />
        {tooltip && (
          <div
            className="pointer-events-none absolute z-50 rounded-md border border-white/20 bg-black/90 px-3 py-2 text-xs text-white shadow-xl"
            style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
          >
            <div className="font-bold">
              {tooltip.point.driverCode} · {tooltip.point.raceName} {tooltip.point.year}
            </div>
            <div className="text-neutral-gray mt-1">
              sconto{" "}
              {tooltip.point.discount != null
                ? `${tooltip.point.discount >= 0 ? "+" : ""}${tooltip.point.discount.toFixed(1)}s`
                : "n/d"}
            </div>
            <div className="text-neutral-gray">costo effettivo {tooltip.point.effectiveLoss.toFixed(1)}s</div>
            <div className="text-racing-red mt-1">Clic per aprire la gara →</div>
          </div>
        )}
      </div>
      <div className="flex gap-4 flex-wrap mt-4">
        {PIT_CONTEXT_LEGEND.map((item) => (
          <button
            key={item.key}
            onMouseEnter={() => setHoveredContext(item.key)}
            onMouseLeave={() => setHoveredContext(null)}
            className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-gray hover:text-white transition-colors"
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
