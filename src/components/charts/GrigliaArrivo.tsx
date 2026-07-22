"use client";

// Vista 5 (docs/PROGETTAZIONE.md, sezione 7 e 10 rischio 4): "il piano
// griglia × arrivo". Tutti i risultati (griglia di partenza × posizione di
// arrivo) come nuvola densa; le occorrenze dell'evento selezionato si
// illuminano — risponde a "perché è raro", non solo "quante volte": le
// vittorie da oltre la decima piazza si vedono come una manciata di punti
// in un angolo quasi vuoto.
//
// Scelta SVG vs canvas (sezione 10, rischio 4): misurato con dati veri —
// dei 26.354 risultati, 15.518 hanno sia griglia sia arrivo (gli altri sono
// scartati, niente coordinata; sezione 5.6 regola 3). Un <circle> SVG per
// punto: ~20-30ms di join una tantum, ~15.6k nodi SVG in più. Restato SVG,
// NON passato a canvas: il rischio vero non era il join iniziale (che è
// imperceptibile), ma un bug — corretto qui sotto — che rieseguiva quel
// join ad ogni movimento dello slider del parametro; con gli effetti
// separati (nuvola vs evidenziazione) il costo dei 15.6k punti si paga UNA
// SOLA VOLTA per pagina, mai durante l'interazione. Se in futuro la nuvola
// dovesse davvero pesare (più risultati, animazioni sulla nuvola stessa),
// il piano B resta: canvas per lo sfondo, SVG per assi ed evidenziazione.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { familyColor, TEXT_MUTED_COLOR, TEXT_PRIMARY_COLOR } from "@/lib/colors";
import { formatWindow, type CatalogEventEntry } from "@/lib/eventCatalog";
import ChartTooltip from "@/components/ChartTooltip";

export interface GrigliaPoint {
  grid: number;
  arrivo: number;
}

interface Props {
  entry: CatalogEventEntry;
  cloud: { griglia: (number | null)[]; arrivo: (number | null)[] };
  highlighted: GrigliaPoint[];
}

interface TooltipState {
  x: number;
  y: number;
  point: GrigliaPoint;
}

const WIDTH = 1200;
const HEIGHT = 620;
const MARGIN = { top: 24, right: 24, bottom: 48, left: 56 };

export default function GrigliaArrivo({ entry, cloud, highlighted }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const color = familyColor(entry.famiglia);

  const cloudPoints = useMemo(() => {
    const pts: GrigliaPoint[] = [];
    for (let i = 0; i < cloud.griglia.length; i++) {
      const g = cloud.griglia[i];
      const a = cloud.arrivo[i];
      if (g != null && a != null) pts.push({ grid: g, arrivo: a });
    }
    return pts;
  }, [cloud]);

  const maxGrid = d3.max(cloudPoints, (d) => d.grid) ?? 30;
  const maxArrivo = d3.max(cloudPoints, (d) => d.arrivo) ?? 30;

  const xScale = useMemo(
    () => d3.scaleLinear().domain([0, maxGrid]).nice().range([MARGIN.left, WIDTH - MARGIN.right]),
    [maxGrid]
  );
  const yScale = useMemo(
    () => d3.scaleLinear().domain([0, maxArrivo]).nice().range([MARGIN.top, HEIGHT - MARGIN.bottom]),
    [maxArrivo]
  );

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    for (const cls of ["x-axis", "y-axis", "diagonal", "cloud-group", "highlight-group"]) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
    if (svg.select("line.diagonal-line").empty()) {
      svg.select(".diagonal").append("line").attr("class", "diagonal-line");
    }
  }, []);

  // Assi e diagonale: ridisegnati solo se cambia la scala (praticamente
  // mai — dominio fisso su tutti i risultati). Effetto separato da quello
  // della nuvola qui sotto per lo stesso motivo: non deve rieseguire il
  // join dei 15mila punti ogni volta che cambia solo l'evidenziazione.
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0, ${HEIGHT - MARGIN.bottom})`)
      .call(d3.axisBottom(xScale).ticks(10))
      .call((g) => g.selectAll("text").attr("fill", TEXT_MUTED_COLOR).attr("font-size", 10))
      .call((g) => g.selectAll("line, path").attr("stroke", TEXT_MUTED_COLOR).attr("opacity", 0.4));

    svg
      .select<SVGGElement>(".y-axis")
      .attr("transform", `translate(${MARGIN.left}, 0)`)
      .call(d3.axisLeft(yScale).ticks(10))
      .call((g) => g.selectAll("text").attr("fill", TEXT_MUTED_COLOR).attr("font-size", 10))
      .call((g) => g.selectAll("line, path").attr("stroke", TEXT_MUTED_COLOR).attr("opacity", 0.4));

    const diagEnd = Math.min(xScale.domain()[1], yScale.domain()[1]);
    svg
      .select("line.diagonal-line")
      .attr("x1", xScale(0))
      .attr("y1", yScale(0))
      .attr("x2", xScale(diagEnd))
      .attr("y2", yScale(diagEnd))
      .attr("stroke", TEXT_MUTED_COLOR)
      .attr("stroke-dasharray", "3 3")
      .attr("opacity", 0.3);
  }, [xScale, yScale]);

  // Nuvola di sfondo: stessi dati per ogni evento (il "risultati totali" non
  // cambia muovendo lo slider del parametro), quindi un effetto a parte con
  // le SUE dipendenze (solo cloudPoints/xScale/yScale) — misurato di
  // proposito: se stesse nello stesso effetto dell'evidenziazione, il join
  // da ~20ms rieseguirebbe ad ogni movimento dello slider, percepibile
  // durante il trascinamento.
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select<SVGGElement>(".cloud-group")
      .selectAll<SVGCircleElement, GrigliaPoint>("circle.cloud-point")
      .data(cloudPoints)
      .join("circle")
      .attr("class", "cloud-point")
      .attr("cx", (d) => xScale(d.grid))
      .attr("cy", (d) => yScale(d.arrivo))
      .attr("r", 1.4)
      .attr("fill", TEXT_MUTED_COLOR)
      .attr("opacity", 0.35);
  }, [cloudPoints, xScale, yScale]);

  // Evidenziazione: la parte che CAMBIA muovendo lo slider — poche decine
  // o centinaia di punti, animati in transizione.
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    // .enter()/.merge() classico (stesso idioma di ParameterRarityTrack.tsx
    // e QuandoStrip.tsx in questo repo), coerenza di stile con il resto del
    // progetto.
    const sel = svg
      .select<SVGGElement>(".highlight-group")
      .selectAll<SVGCircleElement, GrigliaPoint>("circle.highlight-point")
      .data(highlighted, (_d, i) => i);

    sel.exit().transition().duration(200).attr("r", 0).remove();

    const entered = sel
      .enter()
      .append("circle")
      .attr("class", "highlight-point")
      .attr("cx", (d) => xScale(d.grid))
      .attr("cy", (d) => yScale(d.arrivo))
      .attr("r", 0);

    entered
      .merge(sel)
      .attr("fill", color)
      .attr("stroke", "#000")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("pointerenter", (event, d) => setTooltip({ x: event.clientX, y: event.clientY, point: d }))
      .on("pointermove", (event, d) => setTooltip({ x: event.clientX, y: event.clientY, point: d }))
      .on("pointerleave", () => setTooltip(null))
      .transition()
      .duration(400)
      .attr("cx", (d) => xScale(d.grid))
      .attr("cy", (d) => yScale(d.arrivo))
      .attr("r", 4);
  }, [highlighted, xScale, yScale, color]);

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative overflow-x-auto hide-scrollbar">
      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-neutral-gray mb-3">
        <div>
          <span className="text-white">{highlighted.length}</span> occorrenze evidenziate su{" "}
          <span className="text-white">{cloudPoints.length}</span> risultati totali (1950–2024)
        </div>
      </div>
      <div style={{ position: "relative", width: WIDTH }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label="Piano griglia di partenza per posizione di arrivo di tutti i risultati, con l'evento selezionato evidenziato"
        />
        {tooltip && (
          <ChartTooltip x={tooltip.x} y={tooltip.y} onDismiss={() => setTooltip(null)}>
            <div className="font-bold" style={{ color: TEXT_PRIMARY_COLOR }}>
              Griglia {tooltip.point.grid} → arrivo {tooltip.point.arrivo}
            </div>
            <div className="text-neutral-gray">Finestra: {formatWindow(entry)}</div>
          </ChartTooltip>
        )}
      </div>
      <div className="text-xs text-neutral-gray mt-2">
        La diagonale tratteggiata è &quot;nessun cambiamento&quot; (arrivato dove è partito): la nuvola sopra/sotto
        mostra chi ha guadagnato/perso posizioni.
      </div>
    </div>
  );
}
