"use client";

// Vista 6 riorientata (docs/PROGETTAZIONE.md, sezione 7, pivot v2): la
// "mappa del quando conviene" in home. Decisione presa dopo lo spike P1.2
// (sezione 5.6): NON uno scatter a 2 assi con la pretesa di un confine
// netto — nessuna coppia di assi provata mostrava una separazione visibile.
// La mappa diventa un confronto di DISTRIBUZIONI sull'indice combinato
// (0,6 × z-score(traffico) + 0,4 × z-score(margine dietro), pesi
// dichiarati in public/data/params.json) tra chi ha guadagnato posizioni e
// chi ne ha perse, sulle sole decisioni BOX (STAY/FORCED e NOT_NEEDED non
// sono nella mappa: la domanda è "il mio box ha pagato?", non "dovevo
// fermarmi?"). Correlazione misurata nello spike: 0,34-0,36 — un
// vantaggio statistico reale ma modesto, le due popolazioni si
// sovrappongono pesantemente. Lo si dichiara nel testo sotto il grafico
// invece di nasconderlo: è la tesi del progetto (§3), non un limite.
//
// Stessa convenzione D3-possiede-l'SVG delle altre viste: React tiene solo
// ref/stato (filtro piste, tooltip), D3 fa scale, assi, la stima di densità
// (kernel gaussiano, calcolato in JS puro fuori da D3) e il join di curve +
// rug plot dentro un unico useEffect.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { useRouter } from "next/navigation";
import { VERDICT_COLORS, VERDICT_LABELS, HIGHLIGHT_COLOR } from "@/lib/colors";
import ChartTooltip from "@/components/ChartTooltip";
import clsx from "clsx";

export interface DecisionPoint {
  key: string;
  raceId: string;
  raceName: string;
  year: number;
  driverCode: string;
  eventId: string;
  combinedIndex: number;
  verdict: "GAINED" | "LOST";
  gapBehind: number | null;
  tyreAge: number | null;
  compound: string | null;
  posDelta5: number | null;
  overtakable: boolean;
}

interface Props {
  points: DecisionPoint[];
}

interface TooltipState {
  x: number;
  y: number;
  point: DecisionPoint;
}

type CircuitFilter = "all" | "overtakable" | "technical";

const WIDTH = 1120;
const HEIGHT = 460;
const MARGIN = { top: 64, right: 40, bottom: 46, left: 48 };
const RUG_HEIGHT = 16;
const RUG_GAP = 10;
const DENSITY_SAMPLES = 140;
const RUG_RADIUS = 2.2;

// Stima di densità a kernel gaussiano: nessuna libreria esterna, è la
// ricetta standard di ~10 righe (kernel + media mobile sui punti), non
// serve altro per "KDE semplice" (richiesta esplicita del task).
function gaussianKernel(bandwidth: number) {
  const factor = 1 / (bandwidth * Math.sqrt(2 * Math.PI));
  return (u: number) => factor * Math.exp(-0.5 * (u / bandwidth) ** 2);
}

// Regola del pollice di Silverman: bandwidth ridotto per campioni piccoli,
// mai sotto una soglia minima (altrimenti con pochi punti dopo un filtro
// la curva degenera in tanti picchi stretti, illeggibile).
function silvermanBandwidth(values: number[]): number {
  if (values.length < 2) return 0.3;
  const std = d3.deviation(values) ?? 0.3;
  return Math.max(1.06 * std * Math.pow(values.length, -1 / 5), 0.08);
}

function kernelDensity(values: number[], xTicks: number[]): { x: number; y: number }[] {
  if (values.length === 0) return xTicks.map((x) => ({ x, y: 0 }));
  const kernel = gaussianKernel(silvermanBandwidth(values));
  return xTicks.map((x) => ({ x, y: d3.mean(values, (v) => kernel(x - v)) ?? 0 }));
}

export default function DecisionIndexDistribution({ points }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const router = useRouter();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [circuitFilter, setCircuitFilter] = useState<CircuitFilter>("all");

  const filteredPoints = useMemo(() => {
    if (circuitFilter === "all") return points;
    const wantOvertakable = circuitFilter === "overtakable";
    return points.filter((p) => p.overtakable === wantOvertakable);
  }, [points, circuitFilter]);

  const gained = useMemo(() => filteredPoints.filter((p) => p.verdict === "GAINED"), [filteredPoints]);
  const lost = useMemo(() => filteredPoints.filter((p) => p.verdict === "LOST"), [filteredPoints]);

  const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
  const densityInnerHeight = HEIGHT - MARGIN.top - MARGIN.bottom - RUG_HEIGHT - RUG_GAP;
  const rugTop = MARGIN.top + densityInnerHeight + RUG_GAP;

  const xScale = useMemo(() => {
    const allValues = filteredPoints.map((p) => p.combinedIndex);
    const extent = d3.extent(allValues) as [number, number];
    const pad = allValues.length > 0 ? (extent[1] - extent[0]) * 0.15 || 0.5 : 1;
    const domain: [number, number] =
      allValues.length > 0 ? [extent[0] - pad, extent[1] + pad] : [-2, 2];
    return d3.scaleLinear().domain(domain).range([MARGIN.left, MARGIN.left + innerWidth]).clamp(true);
  }, [filteredPoints, innerWidth]);

  const { gainedDensity, lostDensity, yScale, meanGained, meanLost } = useMemo(() => {
    const [x0, x1] = xScale.domain();
    const xTicks = d3.range(DENSITY_SAMPLES + 1).map((i) => x0 + ((x1 - x0) * i) / DENSITY_SAMPLES);
    const gVals = gained.map((p) => p.combinedIndex);
    const lVals = lost.map((p) => p.combinedIndex);
    const gDensity = kernelDensity(gVals, xTicks);
    const lDensity = kernelDensity(lVals, xTicks);
    const maxY = Math.max(d3.max(gDensity, (d) => d.y) ?? 0, d3.max(lDensity, (d) => d.y) ?? 0, 0.01);
    const yS = d3
      .scaleLinear()
      .domain([0, maxY * 1.12])
      .range([MARGIN.top + densityInnerHeight, MARGIN.top]);
    return {
      gainedDensity: gDensity,
      lostDensity: lDensity,
      yScale: yS,
      meanGained: d3.mean(gVals) ?? null,
      meanLost: d3.mean(lVals) ?? null,
    };
  }, [xScale, gained, lost, densityInnerHeight]);

  // Setup una tantum dei gruppi persistenti dell'SVG (mai ricreati).
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const groups = ["x-axis", "density-group", "mean-group", "rug-group"];
    for (const cls of groups) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  // Redraw incrementale: mai un remove-and-recreate dell'SVG.
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    // Interrompe qualunque transizione in corso sui gruppi prima di avviarne
    // di nuove: React StrictMode (dev) invoca questo effetto due volte per
    // ogni commit, e due join/transition consecutivi sugli stessi elementi
    // altrimenti si accavallano — la seconda transizione interrompe la
    // prima a metà, e se un tween di testo/opacità non arriva mai a
    // completarsi il grafico resta con etichette vuote o tacche del rug
    // plot mai rimosse (bug osservato in sviluppo). Interrompere prima di
    // ridisegnare rende ogni invocazione idempotente indipendentemente da
    // quante volte l'effetto viene richiamato.
    for (const cls of ["x-axis", "density-group", "mean-group", "rug-group"]) {
      const group = svg.select(`.${cls}`);
      group.interrupt();
      group.selectAll("*").interrupt();
    }

    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0, ${MARGIN.top + densityInnerHeight})`)
      .transition()
      .duration(300)
      .call(d3.axisBottom(xScale).ticks(10).tickFormat((d) => (d as number).toFixed(1)));

    const area = d3
      .area<{ x: number; y: number }>()
      .curve(d3.curveMonotoneX)
      .x((d) => xScale(d.x))
      .y0(yScale(0))
      .y1((d) => yScale(d.y));

    const line = d3
      .line<{ x: number; y: number }>()
      .curve(d3.curveMonotoneX)
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y));

    const series = [
      { id: "GAINED" as const, density: gainedDensity },
      { id: "LOST" as const, density: lostDensity },
    ];

    const densityGroup = svg.select<SVGGElement>(".density-group");

    densityGroup
      .selectAll<SVGPathElement, (typeof series)[number]>("path.density-fill")
      .data(series, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("path")
            .attr("class", "density-fill")
            .attr("fill", (d) => VERDICT_COLORS[d.id])
            .style("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(250).style("opacity", 0).remove()
      )
      .transition()
      .duration(350)
      .style("opacity", 0.22)
      .attr("d", (d) => area(d.density));

    densityGroup
      .selectAll<SVGPathElement, (typeof series)[number]>("path.density-stroke")
      .data(series, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("path")
            .attr("class", "density-stroke")
            .attr("fill", "none")
            .attr("stroke", (d) => VERDICT_COLORS[d.id])
            .attr("stroke-width", 2)
            .style("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(250).style("opacity", 0).remove()
      )
      .transition()
      .duration(350)
      .style("opacity", 1)
      .attr("d", (d) => line(d.density));

    // Linee verticali della media, con etichetta numerica: la richiesta
    // esplicita del task ("marca le medie con una linea verticale ed
    // etichetta il numero"). Se le due medie cadono troppo vicine in
    // pixel, la seconda etichetta scende sotto la prima per non
    // sovrapporsi.
    const meanEntries = [
      meanGained != null ? { id: "GAINED" as const, value: meanGained } : null,
      meanLost != null ? { id: "LOST" as const, value: meanLost } : null,
    ].filter((d): d is { id: "GAINED" | "LOST"; value: number } => d !== null);

    const labelOffsetY: Record<string, number> = {};
    if (meanEntries.length === 2) {
      const dx = Math.abs(xScale(meanEntries[0].value) - xScale(meanEntries[1].value));
      labelOffsetY[meanEntries[0].id] = 0;
      labelOffsetY[meanEntries[1].id] = dx < 110 ? 16 : 0;
    }

    const meanGroup = svg.select<SVGGElement>(".mean-group");

    meanGroup
      .selectAll<SVGLineElement, (typeof meanEntries)[number]>("line.mean-line")
      .data(meanEntries, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("class", "mean-line")
            .attr("stroke", (d) => VERDICT_COLORS[d.id])
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "5 4")
            .style("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(250).style("opacity", 0).remove()
      )
      .transition()
      .duration(350)
      .style("opacity", 0.9)
      .attr("x1", (d) => xScale(d.value))
      .attr("x2", (d) => xScale(d.value))
      .attr("y1", MARGIN.top)
      .attr("y2", MARGIN.top + densityInnerHeight);

    // Il testo si imposta SUBITO, fuori dalla transizione: un tween di testo
    // interrotto a metà (v. commento sull'.interrupt() sopra) lascerebbe
    // l'etichetta vuota invece che con un valore anche solo stantio.
    // Anima solo le proprietà puramente visive (opacità, posizione).
    meanGroup
      .selectAll<SVGTextElement, (typeof meanEntries)[number]>("text.mean-label")
      .data(meanEntries, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("text")
            .attr("class", "mean-label")
            .attr("font-size", 12)
            .attr("font-weight", 700)
            .attr("fill", (d) => VERDICT_COLORS[d.id])
            .attr("text-anchor", "middle")
            .style("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(250).style("opacity", 0).remove()
      )
      .attr("x", (d) => xScale(d.value))
      .attr("y", (d) => MARGIN.top - 14 - (labelOffsetY[d.id] ?? 0))
      .text((d) => `media ${d.id === "GAINED" ? "guadagnato" : "perso"}: ${d.value.toFixed(2)}`)
      .transition()
      .duration(350)
      .style("opacity", 1);

    // Rug plot: un tick per decisione reale, sotto le curve. È l'unico
    // elemento "a punto" della vista: hover mostra la scheda decisione,
    // click apre la gara — richiesto esplicitamente dal task.
    svg
      .select<SVGGElement>(".rug-group")
      .selectAll<SVGLineElement, DecisionPoint>("line.rug-tick")
      .data(filteredPoints, (d) => d.key)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("class", "rug-tick")
            .attr("x1", (d) => xScale(d.combinedIndex))
            .attr("x2", (d) => xScale(d.combinedIndex))
            .attr("y1", rugTop)
            .attr("y2", rugTop)
            .style("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(200).style("opacity", 0).remove()
      )
      .attr("stroke", (d) => VERDICT_COLORS[d.verdict])
      .attr("stroke-width", RUG_RADIUS)
      .attr("stroke-linecap", "round")
      .style("cursor", "pointer")
      .on("pointerenter", function (event, d) {
        d3.select(this).attr("stroke", HIGHLIGHT_COLOR).attr("stroke-width", RUG_RADIUS + 1.5);
        setTooltip({ x: event.clientX, y: event.clientY, point: d });
      })
      .on("pointermove", function (event, d) {
        setTooltip({ x: event.clientX, y: event.clientY, point: d });
      })
      .on("pointerleave", function (_event, d) {
        d3.select(this).attr("stroke", VERDICT_COLORS[d.verdict]).attr("stroke-width", RUG_RADIUS);
        setTooltip(null);
      })
      .on("click", (_event, d) => {
        router.push(`/race/${d.raceId}`);
      })
      .transition()
      .duration(350)
      .style("opacity", 0.65)
      .attr("x1", (d) => xScale(d.combinedIndex))
      .attr("x2", (d) => xScale(d.combinedIndex))
      .attr("y1", rugTop)
      .attr("y2", rugTop + RUG_HEIGHT);
  }, [filteredPoints, gainedDensity, lostDensity, xScale, yScale, meanGained, meanLost, densityInnerHeight, rugTop, router]);

  const filterOptions: { key: CircuitFilter; label: string }[] = [
    { key: "all", label: `Tutte le piste (${points.length})` },
    {
      key: "overtakable",
      label: `Piste sorpassabili (${points.filter((p) => p.overtakable).length})`,
    },
    {
      key: "technical",
      label: `Piste tecniche/poco sorpassabili (${points.filter((p) => !p.overtakable).length})`,
    },
  ];

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative overflow-x-auto hide-scrollbar">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-4 flex-wrap">
          {(["GAINED", "LOST"] as const).map((v) => (
            <div key={v} className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-gray">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: VERDICT_COLORS[v] }} />
              {VERDICT_LABELS[v]}
            </div>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-panel border border-graphite rounded-md flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setCircuitFilter(opt.key)}
              className={clsx(
                "px-3 py-1.5 text-xs font-condensed uppercase tracking-wider rounded transition-colors",
                circuitFilter === opt.key ? "bg-racing-red text-white font-bold" : "text-neutral-gray hover:text-white"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", width: WIDTH }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label="Distribuzioni sovrapposte dell'indice combinato per chi ha guadagnato e chi ha perso posizioni dopo essersi fermato ai box"
        />
        {tooltip && (
          <ChartTooltip x={tooltip.x} y={tooltip.y} onDismiss={() => setTooltip(null)}>
            <div className="font-bold">
              {tooltip.point.driverCode} · {tooltip.point.raceName} {tooltip.point.year}
            </div>
            <div className="mt-1" style={{ color: VERDICT_COLORS[tooltip.point.verdict] }}>
              {VERDICT_LABELS[tooltip.point.verdict]}
              {tooltip.point.posDelta5 != null && ` (${tooltip.point.posDelta5 >= 0 ? "-" : "+"}${Math.abs(tooltip.point.posDelta5)} pos.)`}
            </div>
            <div className="text-neutral-gray mt-1">scelta: BOX</div>
            <div className="text-neutral-gray">
              gap dietro: {tooltip.point.gapBehind != null ? `${tooltip.point.gapBehind.toFixed(1)}s` : "n/d"}
            </div>
            <div className="text-neutral-gray">
              gomme: {tooltip.point.tyreAge != null ? `${tooltip.point.tyreAge} giri` : "n/d"}
              {tooltip.point.compound ? ` (${tooltip.point.compound})` : ""}
            </div>
            <div className="text-neutral-gray">indice combinato: {tooltip.point.combinedIndex.toFixed(2)}</div>
            <div className="text-racing-red mt-1">Clic per aprire la gara →</div>
          </ChartTooltip>
        )}
      </div>

      {filteredPoints.length === 0 && (
        <p className="text-xs text-neutral-gray italic mt-2">
          Nessuna decisione BOX nel sottoinsieme selezionato: prova un altro filtro.
        </p>
      )}
    </div>
  );
}
