"use client";

// Vista 1 della specifica v3 (docs/PROGETTAZIONE.md, sezione 7): "la scala
// della rarità", overview del catalogo eventi nel mantra di Shneiderman.
// Un segno per evento su un asse di rarità logaritmico, dal più comune (a
// sinistra) al più raro (a destra); l'ordinamento verticale segue la stessa
// rarità, così il grafico legge come una scala/gradinata (da cui il nome).
//
// Convenzione D3 del progetto (sezione 7, "regola sul D3"): D3 possiede
// l'intero <svg> — scale, assi, data join e transizioni dentro un unico
// useEffect. React tiene solo il ref, lo stato di hover/tooltip e la
// navigazione (useRouter), che notifica via callback — mai lo stato di
// evidenziazione dentro D3. Base: src/components/charts/D3Chart.tsx.
//
// Il colore codifica la FAMIGLIA (sezione 7, "regola vincolante sul
// colore"), mai la rarità: la rarità è quantitativa e vive per intero sulla
// posizione (x logaritmica + ordine verticale).
//
// La finestra di copertura (sezione 5.2, "un evento su 285 gare e uno su
// 1125 non si confrontano") è codificata visivamente accanto a ogni evento
// come un segmento su una mini-timeline condivisa (1950-2024): la sua
// LUNGHEZZA è la copertura reale, non solo un numero scritto. Il tooltip
// (src/lib/eventCatalog.ts, eventTooltipLines) mostra comunque sempre la
// finestra per esteso: la regola vale ovunque, l'encoding visivo non la
// sostituisce, la rinforza.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { useRouter } from "next/navigation";
import {
  familyColor,
  familyLabel,
  FAMILY_LEGEND,
  HIGHLIGHT_COLOR,
  TEXT_MUTED_COLOR,
  TEXT_PRIMARY_COLOR,
} from "@/lib/colors";
import { eventTooltipLines, parameterSuffix, type CatalogEventEntry } from "@/lib/eventCatalog";
import ChartTooltip from "@/components/ChartTooltip";

interface Props {
  events: CatalogEventEntry[];
}

interface TooltipState {
  x: number;
  y: number;
  event: CatalogEventEntry;
}

const MARGIN = { top: 36, right: 110, bottom: 40, left: 16 };
const ROW_HEIGHT = 30;
const LABEL_WIDTH = 340;
const LABEL_MAX_CHARS = 50;
const WINDOW_WIDTH = 110;
const GUTTER = 24;
// Larghezza del grafico misurata dal contenitore reale (ResizeObserver più
// sotto), non più una costante fissa: un numero fisso o va troppo stretto
// su un monitor largo (spazio nero sprecato ai lati) o troppo largo su un
// laptop comune (scrollbar orizzontale del pannello che prima non serviva).
// DEFAULT_WIDTH è solo il valore prima della prima misura (SSR/primo
// paint). MIN_WIDTH è il minimo sotto cui l'asse smette di avere senso
// (sotto, l'etichetta+finestra+margini da sole superano lo spazio
// disponibile): sotto quella soglia il pannello resta scrollabile in
// orizzontale invece di comprimere il grafico fino a romperlo — stesso
// comportamento che aveva già su mobile con la larghezza fissa originale.
const DEFAULT_WIDTH = 1180;
const MIN_WIDTH = 900;
const TIMELINE_FROM = 1950;
const TIMELINE_TO = 2024;
// Altezza oltre la quale il pannello smette di allungare la pagina e apre
// uno scroll verticale suo: con 33+ righe a piena leggibilità il grafico
// da solo supererebbe i 1000px, spingendo il resto della pagina fuori
// schermo. Il pannello resta un riquadro di dimensione fissa, non la
// pagina intera.
const MAX_PANEL_HEIGHT = 640;

// Un'etichetta come "Pit stop sotto Safety Car / sotto VSC
// (contesto=UNDER_SC)" non entra in nessuna colonna ragionevole senza
// spingere i pallini fuori schermo: si tronca con l'ellissi, il nome
// completo resta sempre nel tooltip (eventTooltipLines), mai perso.
function truncateLabel(label: string): string {
  return label.length > LABEL_MAX_CHARS ? `${label.slice(0, LABEL_MAX_CHARS - 1)}…` : label;
}

export default function RarityScale({ events }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredFamily, setHoveredFamily] = useState<string | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  // Misura la larghezza disponibile del contenitore (il div "overflow-auto"
  // sotto, che non ha una width propria e prende quella che il pannello gli
  // dà) e la segue a ogni ridimensionamento: così il grafico riempie
  // esattamente lo spazio disponibile, sia in una sezione stretta sia in
  // una larga, senza un numero indovinato a mano.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured) setWidth(Math.max(MIN_WIDTH, Math.round(measured)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ordine verticale = ordine di rarità (dal più comune, in alto, al più
  // raro, in basso): la scala è leggibile SIA sull'asse X (log) SIA
  // sull'ordine delle righe, le due cose si rinforzano a vicenda invece di
  // essere un ranking ridondante.
  const sorted = useMemo(() => [...events].sort((a, b) => b.rarita - a.rarita), [events]);

  const height = MARGIN.top + sorted.length * ROW_HEIGHT + MARGIN.bottom;
  const chartLeft = MARGIN.left + LABEL_WIDTH + WINDOW_WIDTH + GUTTER;
  const chartRight = width - MARGIN.right;
  const windowLeft = MARGIN.left + LABEL_WIDTH;

  const rarityExtent = d3.extent(sorted, (d) => d.rarita) as [number, number];

  const xScale = useMemo(
    () =>
      d3
        .scaleLog()
        .domain(rarityExtent[0] > 0 ? [rarityExtent[1], rarityExtent[0]] : [1, 0.001])
        .range([chartLeft, chartRight])
        .clamp(true),
    [rarityExtent, chartLeft, chartRight]
  );

  const yScale = useMemo(
    () => (eventId: string) => {
      const idx = sorted.findIndex((d) => d.eventId === eventId);
      return MARGIN.top + idx * ROW_HEIGHT + ROW_HEIGHT / 2;
    },
    [sorted]
  );

  const windowScale = useMemo(
    () => d3.scaleLinear().domain([TIMELINE_FROM, TIMELINE_TO]).range([windowLeft, windowLeft + WINDOW_WIDTH]).clamp(true),
    [windowLeft]
  );

  // Setup una tantum: gruppi persistenti dell'SVG.
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    for (const cls of ["x-axis", "timeline-header", "rows-group"]) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    // Tick espliciti (non i tick automatici di scaleLog, che su 3 decadi
    // producono una ventina di valori illeggibili): una manciata di soglie
    // percentuali tonde, filtrate al dominio effettivo dei dati.
    const tickCandidates = [50, 30, 20, 10, 5, 3, 2, 1, 0.5, 0.3, 0.2, 0.1, 0.05].map((p) => p / 100);
    const [domainMax, domainMin] = xScale.domain();
    const tickValues = tickCandidates.filter((v) => v >= domainMin * 0.9 && v <= domainMax * 1.1);

    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0, ${MARGIN.top - 12})`)
      .call(
        d3
          .axisTop(xScale)
          .tickValues(tickValues)
          .tickFormat((d) => `${(Number(d) * 100).toFixed(Number(d) < 0.01 ? 2 : 0)}%`)
      )
      .call((g) => g.selectAll("text").attr("fill", TEXT_MUTED_COLOR).attr("font-size", 10))
      .call((g) => g.selectAll("line, path").attr("stroke", TEXT_MUTED_COLOR).attr("opacity", 0.4));

    // Intestazione della mini-timeline (una volta sola, non per riga):
    // "1950" ... "2024" sopra la colonna delle finestre di copertura.
    const header = svg.select<SVGGElement>(".timeline-header");
    header.attr("transform", `translate(0, ${MARGIN.top - 12})`);
    header
      .selectAll("text.timeline-label")
      .data([TIMELINE_FROM, TIMELINE_TO])
      .join("text")
      .attr("class", "timeline-label")
      .attr("x", (d) => windowScale(d))
      .attr("text-anchor", (d) => (d === TIMELINE_FROM ? "start" : "end"))
      .attr("fill", TEXT_MUTED_COLOR)
      .attr("font-size", 10)
      .text((d) => String(d));

    const rows = svg
      .select<SVGGElement>(".rows-group")
      .selectAll<SVGGElement, CatalogEventEntry>("g.event-row")
      .data(sorted, (d) => d.eventId);

    const entered = rows
      .enter()
      .append("g")
      .attr("class", "event-row")
      .style("cursor", "pointer")
      .style("opacity", 0);

    entered.append("text").attr("class", "row-label");
    entered.append("rect").attr("class", "row-window-bg");
    entered.append("rect").attr("class", "row-window-fill");
    entered.append("line").attr("class", "row-connector");
    entered.append("circle").attr("class", "row-dot");

    rows.exit().transition().duration(250).style("opacity", 0).remove();

    const merged = entered.merge(rows);

    merged
      .on("pointerenter", function (event, d) {
        setTooltip({ x: event.clientX, y: event.clientY, event: d });
      })
      .on("pointermove", function (event) {
        setTooltip((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
      })
      .on("pointerleave", () => setTooltip(null))
      .on("click", (_event, d) => router.push(`/eventi/${d.eventId}`));

    merged
      .select<SVGTextElement>("text.row-label")
      .attr("x", MARGIN.left + 10)
      .attr("y", (d) => yScale(d.eventId))
      .attr("dy", "0.32em")
      .attr("font-size", 13)
      .attr("fill", TEXT_PRIMARY_COLOR)
      .attr("opacity", (d) => (hoveredFamily && d.famiglia !== hoveredFamily ? 0.35 : 1))
      .text((d) => truncateLabel(`${d.nome}${parameterSuffix(d)}`));

    merged
      .select<SVGRectElement>("rect.row-window-bg")
      .attr("x", windowLeft)
      .attr("y", (d) => yScale(d.eventId) - 3.5)
      .attr("width", WINDOW_WIDTH)
      .attr("height", 7)
      .attr("fill", TEXT_MUTED_COLOR)
      .attr("opacity", 0.15)
      .attr("rx", 3.5);

    merged
      .select<SVGRectElement>("rect.row-window-fill")
      .attr("x", (d) => windowScale(d.annoDa))
      .attr("y", (d) => yScale(d.eventId) - 3.5)
      .attr("width", (d) => Math.max(2, windowScale(d.annoA) - windowScale(d.annoDa)))
      .attr("height", 7)
      .attr("rx", 3.5)
      .attr("fill", (d) => familyColor(d.famiglia))
      .attr("opacity", (d) => (hoveredFamily && d.famiglia !== hoveredFamily ? 0.15 : 0.75));

    merged
      .select<SVGLineElement>("line.row-connector")
      .attr("x1", chartLeft)
      .attr("x2", (d) => xScale(d.rarita))
      .attr("y1", (d) => yScale(d.eventId))
      .attr("y2", (d) => yScale(d.eventId))
      .attr("stroke", TEXT_MUTED_COLOR)
      .attr("stroke-opacity", 0.2);

    merged
      .select<SVGCircleElement>("circle.row-dot")
      .attr("cy", (d) => yScale(d.eventId))
      .attr("r", 5.5)
      .attr("fill", (d) => familyColor(d.famiglia))
      .attr("stroke", (d) =>
        tooltip?.event.eventId === d.eventId ? HIGHLIGHT_COLOR : "none"
      )
      .attr("stroke-width", 1.5)
      .attr("opacity", (d) => (hoveredFamily && d.famiglia !== hoveredFamily ? 0.2 : 0.95))
      .transition()
      .duration(300)
      .attr("cx", (d) => xScale(d.rarita));

    merged.transition().duration(200).style("opacity", 1);
  }, [sorted, xScale, yScale, windowScale, windowLeft, chartLeft, hoveredFamily, tooltip?.event.eventId, router]);

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative">
      {/* Pannello di altezza fissa con scroll verticale suo, non l'intera
          pagina: con 33+ eventi a piena leggibilità il grafico da solo
          supererebbe abbondantemente uno schermo — qui resta un riquadro
          consultabile, non un ostacolo da scorrere per arrivare al resto
          della pagina. La legenda sotto resta invece sempre visibile. */}
      <div
        ref={containerRef}
        className="overflow-auto hide-scrollbar rounded-lg"
        style={{ maxHeight: Math.min(height, MAX_PANEL_HEIGHT) }}
      >
        <div style={{ position: "relative", width }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            role="img"
            aria-label="Tutti gli eventi del catalogo ordinati per rarità, dal più comune al più raro"
          />
        </div>
      </div>
      {tooltip && (
        <ChartTooltip x={tooltip.x} y={tooltip.y} onDismiss={() => setTooltip(null)}>
          <div className="font-bold">{eventTooltipLines(tooltip.event)[0]}</div>
          <div className="text-neutral-gray mt-1">{familyLabel(tooltip.event.famiglia)}</div>
          {eventTooltipLines(tooltip.event)
            .slice(1)
            .map((line) => (
              <div key={line} className="text-neutral-gray">
                {line}
              </div>
            ))}
          <div className="text-racing-red mt-1">Clic per aprire la scheda evento →</div>
        </ChartTooltip>
      )}
      <div className="flex gap-4 flex-wrap mt-4">
        {FAMILY_LEGEND.map((item) => (
          <button
            key={item.key}
            onMouseEnter={() => setHoveredFamily(item.key)}
            onMouseLeave={() => setHoveredFamily(null)}
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
