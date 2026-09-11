"use client";

// Vista 4 (docs/PROGETTAZIONE.md, sezione 7 e 5.3): "dove". I circuiti sulle
// loro coordinate reali (lat/lng, vedi data-layer/scripts/build_circuits_geo.py
// — non ancora esportate dal motore eventi, lette qui a parte da
// circuits.csv). Interruttore fra conteggio grezzo e tasso per gara
// ospitata: l'idiom "encode" di Yi et al. applicato al colore — l'unica
// codifica quantitativa in colore ammessa in tutto il sito è proprio questa
// (sezione 7, "regola vincolante sul colore"), una scala sequenziale dalla
// tinta neutra alla tinta della famiglia dell'evento (mai una palette
// sequenziale slegata). Il raggio dei segni invece resta sempre il
// conteggio grezzo: cosi' un cerchio piccolo ma acceso (poche gare ospitate,
// tasso alto) rende visibile perche' la classifica si ribalta cambiando
// interruttore, invece di dirlo solo a parole.
//
// Vista a barre ordinate sempre disponibile come alternativa: la mappa è
// bella, la barra è precisa (sezione 7).

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { familyColor, HIGHLIGHT_COLOR, MUTED_FILL_COLOR, TEXT_MUTED_COLOR, TEXT_PRIMARY_COLOR } from "@/lib/colors";
import { formatWindow, type CatalogEventEntry, type CircuitGeo, type CircuitStat } from "@/lib/eventCatalog";
import ChartTooltip from "@/components/ChartTooltip";

interface Props {
  entry: CatalogEventEntry;
  perCircuito: CircuitStat[];
  allCircuits: CircuitGeo[];
  isYearFiltered: boolean;
  // Adattatore v4 (Déjà vu, roadmap D5.2): la mappa serve anche al reticolo
  // delle situazioni, che non ha una famiglia né una finestra da catalogo.
  // Quando sono passati, questi vincono su entry per colore e finestra;
  // onCircuito rende i segni cliccabili (riempie lo slot "dove").
  colore?: string;
  finestraTesto?: string;
  onCircuito?: (circuitRef: string) => void;
}

type Mode = "mappa" | "barre";
type Metric = "conteggio" | "tasso";

interface TooltipState {
  x: number;
  y: number;
  stat: CircuitStat;
}

const WIDTH = 1200;
const HEIGHT = 460;
const MAP_MARGIN = { top: 16, right: 16, bottom: 16, left: 16 };
const BAR_ROW_HEIGHT = 26;
const BAR_MARGIN = { top: 8, right: 60, bottom: 8, left: 220 };

function metricValue(stat: Pick<CircuitStat, "occorrenze" | "tasso">, metric: Metric): number {
  return metric === "conteggio" ? stat.occorrenze : stat.tasso;
}

// Il tasso è occorrenze/gareOspitate: per gli eventi di unità GARA non può
// mai superare il 100% (un'occorrenza al massimo per gara), ma per
// RISULTATO o TEAM_GARA sì — più piloti/team possono far scattare lo stesso
// evento nella STESSA gara (es. "pit sotto Safety Car": più piloti si
// fermano nella stessa gara). Mostrarlo come percentuale in quel caso
// darebbe numeri come "2000%", che sembra un errore anche se non lo è:
// sotto GARA resta una percentuale, altrimenti un rapporto "×per gara".
function formatMetric(value: number, metric: Metric, unita: CatalogEventEntry["unita"]): string {
  if (metric === "conteggio") return String(value);
  return unita === "GARA" ? `${(value * 100).toFixed(1)}%` : `${value.toFixed(2)}× per gara`;
}

export default function DoveMappa({ entry, perCircuito, allCircuits, isYearFiltered, colore, finestraTesto, onCircuito }: Props) {
  const [mode, setMode] = useState<Mode>("mappa");
  const [metric, setMetric] = useState<Metric>("conteggio");
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const color = colore ?? familyColor(entry.famiglia);
  const finestra = finestraTesto ?? formatWindow(entry);
  const colorInterpolator = useMemo(() => d3.interpolateRgb(MUTED_FILL_COLOR, color), [color]);

  const maxOccorrenze = d3.max(perCircuito, (d) => d.occorrenze) ?? 1;
  const maxMetric = d3.max(perCircuito, (d) => metricValue(d, metric)) ?? 1;
  const colorScale = useMemo(
    () => d3.scaleSequential(colorInterpolator).domain([0, maxMetric || 1]),
    [colorInterpolator, maxMetric]
  );

  // Il caso demo (sezione 7): chi spicca per conteggio vs per tasso, per far
  // vedere a parole cosa il grafico mostra visivamente quando si passa da un
  // interruttore all'altro.
  const topByCount = useMemo(() => [...perCircuito].sort((a, b) => b.occorrenze - a.occorrenze)[0], [perCircuito]);
  const topByRate = useMemo(() => [...perCircuito].sort((a, b) => b.tasso - a.tasso)[0], [perCircuito]);

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex gap-2">
          {(["mappa", "barre"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-xs uppercase tracking-widest border ${
                mode === m ? "border-racing-red text-white" : "border-graphite text-neutral-gray"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["conteggio", "tasso"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 text-xs uppercase tracking-widest border ${
                metric === m ? "border-racing-red text-white" : "border-graphite text-neutral-gray"
              }`}
            >
              {m === "conteggio" ? "Conteggio" : "Tasso per gara ospitata"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-neutral-gray mb-4">
        {topByCount && topByRate && topByCount.circuitRef !== topByRate.circuitRef ? (
          <>
            Per conteggio spicca <span className="text-white">{topByCount.nome}</span> ({topByCount.occorrenze}{" "}
            volte); per tasso invece <span className="text-white">{topByRate.nome}</span> (
            {formatMetric(topByRate.tasso, "tasso", entry.unita)} su {topByRate.gareOspitate} gare ospitate) — un
            circuito con poche gare ospitate ma un tasso alto scala in alto anche se il conteggio grezzo è piccolo: è
            per questo che la classifica si ribalta.
          </>
        ) : (
          topByCount && (
            <>
              <span className="text-white">{topByCount.nome}</span> è in cima sia per conteggio ({topByCount.occorrenze}{" "}
              volte) sia per tasso ({formatMetric(topByCount.tasso, "tasso", entry.unita)}).
            </>
          )
        )}
      </p>
      {isYearFiltered && metric === "tasso" && (
        <p className="text-xs text-neutral-gray mb-4 italic">
          Filtro anni attivo: il tasso resta calcolato sulle gare ospitate nell&apos;intera finestra dell&apos;evento (
          {finestra}), non nel solo intervallo selezionato — non sappiamo quante gare ha ospitato ogni
          circuito nel sotto-intervallo.
        </p>
      )}

      {mode === "mappa" ? (
        <MapChart
          entry={entry}
          perCircuito={perCircuito}
          allCircuits={allCircuits}
          metric={metric}
          colorScale={colorScale}
          maxOccorrenze={maxOccorrenze}
          tooltip={tooltip}
          setTooltip={setTooltip}
          onCircuito={onCircuito}
        />
      ) : (
        <BarChart
          entry={entry}
          perCircuito={perCircuito}
          metric={metric}
          colorScale={colorScale}
          tooltip={tooltip}
          setTooltip={setTooltip}
          onCircuito={onCircuito}
        />
      )}

      {tooltip && (
        <ChartTooltip x={tooltip.x} y={tooltip.y} onDismiss={() => setTooltip(null)}>
          <div className="font-bold">{tooltip.stat.nome}</div>
          <div className="text-neutral-gray mt-1">
            {tooltip.stat.occorrenze} volte su {tooltip.stat.gareOspitate} gare ospitate (
            {formatMetric(tooltip.stat.tasso, "tasso", entry.unita)})
          </div>
          <div className="text-neutral-gray">Finestra: {finestra}</div>
          {onCircuito && <div className="text-neutral-gray mt-1">Clic: cerca qui →</div>}
        </ChartTooltip>
      )}
    </div>
  );
}

function MapChart({
  perCircuito,
  allCircuits,
  metric,
  colorScale,
  maxOccorrenze,
  setTooltip,
  onCircuito,
}: {
  entry: CatalogEventEntry;
  perCircuito: CircuitStat[];
  allCircuits: CircuitGeo[];
  metric: Metric;
  colorScale: d3.ScaleSequential<string>;
  maxOccorrenze: number;
  tooltip: TooltipState | null;
  setTooltip: (t: TooltipState | null) => void;
  onCircuito?: (circuitRef: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const lngExtent = useMemo(
    () => (d3.extent(allCircuits, (d) => d.lng) as [number, number]) ?? [-180, 180],
    [allCircuits]
  );
  const latExtent = useMemo(
    () => (d3.extent(allCircuits, (d) => d.lat) as [number, number]) ?? [-60, 70],
    [allCircuits]
  );

  const xScale = useMemo(
    () => d3.scaleLinear().domain(lngExtent).nice().range([MAP_MARGIN.left, WIDTH - MAP_MARGIN.right]),
    [lngExtent]
  );
  const yScale = useMemo(
    () => d3.scaleLinear().domain(latExtent).nice().range([HEIGHT - MAP_MARGIN.bottom, MAP_MARGIN.top]),
    [latExtent]
  );
  const rScale = useMemo(() => d3.scaleSqrt().domain([0, maxOccorrenze || 1]).range([3, 16]), [maxOccorrenze]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    for (const cls of ["background-group", "points-group"]) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select<SVGGElement>(".background-group")
      .selectAll<SVGCircleElement, CircuitGeo>("circle.bg-circuit")
      .data(allCircuits, (d) => d.circuitRef)
      .join("circle")
      .attr("class", "bg-circuit")
      .attr("cx", (d) => xScale(d.lng))
      .attr("cy", (d) => yScale(d.lat))
      .attr("r", 2)
      .attr("fill", TEXT_MUTED_COLOR)
      .attr("opacity", 0.25);

    svg
      .select<SVGGElement>(".points-group")
      .selectAll<SVGCircleElement, CircuitStat>("circle.stat-circuit")
      .data(
        perCircuito.filter((d) => d.lat != null && d.lng != null),
        (d) => d.circuitRef
      )
      .join(
        (enter) => enter.append("circle").attr("class", "stat-circuit").attr("r", 0),
        (update) => update,
        (exit) => exit.transition().duration(200).attr("r", 0).remove()
      )
      .attr("cx", (d) => xScale(d.lng as number))
      .attr("cy", (d) => yScale(d.lat as number))
      .attr("fill", (d) => colorScale(metricValue(d, metric)))
      .attr("stroke", HIGHLIGHT_COLOR)
      .attr("stroke-width", 0.75)
      .style("cursor", "pointer")
      .on("pointerenter", (event, d) => setTooltip({ x: event.clientX, y: event.clientY, stat: d }))
      .on("pointermove", (event, d) => setTooltip({ x: event.clientX, y: event.clientY, stat: d }))
      .on("pointerleave", () => setTooltip(null))
      .on("click", (_e, d) => onCircuito?.(d.circuitRef))
      .transition()
      .duration(350)
      .attr("r", (d) => rScale(d.occorrenze));
  }, [perCircuito, allCircuits, xScale, yScale, rScale, colorScale, metric, setTooltip, onCircuito]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label="Circuiti sulle loro coordinate reali; colore = metrica selezionata, raggio = conteggio"
    />
  );
}

function BarChart({
  entry,
  perCircuito,
  metric,
  colorScale,
  setTooltip,
  onCircuito,
}: {
  entry: CatalogEventEntry;
  perCircuito: CircuitStat[];
  metric: Metric;
  colorScale: d3.ScaleSequential<string>;
  tooltip: TooltipState | null;
  setTooltip: (t: TooltipState | null) => void;
  onCircuito?: (circuitRef: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const sorted = useMemo(
    () => [...perCircuito].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)),
    [perCircuito, metric]
  );
  const height = BAR_MARGIN.top + sorted.length * BAR_ROW_HEIGHT + BAR_MARGIN.bottom;
  const maxValue = d3.max(sorted, (d) => metricValue(d, metric)) ?? 1;

  const xScale = useMemo(
    () => d3.scaleLinear().domain([0, maxValue || 1]).range([BAR_MARGIN.left, WIDTH - BAR_MARGIN.right]),
    [maxValue]
  );

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (svg.select(".bars-group").empty()) svg.append("g").attr("class", "bars-group");
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    const rows = svg
      .select<SVGGElement>(".bars-group")
      .selectAll<SVGGElement, CircuitStat>("g.bar-row")
      .data(sorted, (d) => d.circuitRef);

    const entered = rows.enter().append("g").attr("class", "bar-row").style("cursor", "pointer");
    entered.append("text").attr("class", "row-label");
    entered.append("rect").attr("class", "row-bar").attr("height", BAR_ROW_HEIGHT - 8).attr("x", BAR_MARGIN.left);
    entered.append("text").attr("class", "row-value");

    rows.exit().remove();

    const merged = entered.merge(rows);
    merged
      .on("pointerenter", (event, d) => setTooltip({ x: event.clientX, y: event.clientY, stat: d }))
      .on("pointermove", (event, d) => setTooltip({ x: event.clientX, y: event.clientY, stat: d }))
      .on("pointerleave", () => setTooltip(null))
      .on("click", (_e, d) => onCircuito?.(d.circuitRef));

    merged
      .select<SVGTextElement>("text.row-label")
      .attr("x", BAR_MARGIN.left - 10)
      .attr("y", (_d, i) => i * BAR_ROW_HEIGHT + BAR_ROW_HEIGHT / 2)
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .attr("font-size", 11)
      .attr("fill", TEXT_PRIMARY_COLOR)
      .text((d) => d.nome);

    merged
      .select<SVGRectElement>("rect.row-bar")
      .attr("y", (_d, i) => i * BAR_ROW_HEIGHT + 4)
      .attr("fill", (d) => colorScale(metricValue(d, metric)))
      .transition()
      .duration(350)
      .attr("width", (d) => Math.max(1, xScale(metricValue(d, metric)) - BAR_MARGIN.left));

    merged
      .select<SVGTextElement>("text.row-value")
      .attr("y", (_d, i) => i * BAR_ROW_HEIGHT + BAR_ROW_HEIGHT / 2)
      .attr("dy", "0.32em")
      .attr("font-size", 11)
      .attr("fill", TEXT_MUTED_COLOR)
      .transition()
      .duration(350)
      .attr("x", (d) => xScale(metricValue(d, metric)) + 8)
      .textTween(function (d) {
        // Il testo precedente è già formattato ("14.5%", "2.34× per gara" o
        // "40"): va riportato nella stessa scala di metricValue (frazione
        // 0-1 per il tasso in %, non percentuale) prima di interpolare,
        // altrimenti l'animazione parte da un numero 100 volte più grande
        // del dovuto — succede solo per unità GARA, dove il tasso è "%".
        const prevRaw = parseFloat(d3.select(this).text()) || 0;
        const prevNum = metric === "tasso" && entry.unita === "GARA" ? prevRaw / 100 : prevRaw;
        const targetNum = metricValue(d, metric);
        const interpolate = d3.interpolateNumber(prevNum, targetNum);
        return (t) =>
          formatMetric(metric === "conteggio" ? Math.round(interpolate(t)) : interpolate(t), metric, entry.unita);
      });
  }, [sorted, xScale, colorScale, metric, setTooltip, entry.unita, onCircuito]);

  return (
    <div className="overflow-x-auto hide-scrollbar">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Circuiti ordinati per la metrica selezionata"
      />
    </div>
  );
}
