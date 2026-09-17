"use client";

// Vista "Nel tempo" (roadmap T, docs/ROADMAP-5.md): come cambia nel tempo il
// MIX di famiglie del catalogo eventi. Una domanda che nessun'altra vista
// copre oggi — la vista 1 risponde "quanto è raro" (RarityScale/EventCardsGrid),
// QuandoStrip nel compositore risponde "quando è successo QUESTO evento" (uno
// alla volta). Qui invece tutte le famiglie insieme, impilate.
//
// Convenzione D3 del progetto (docs/PROGETTAZIONE.md, sezione 7): D3 possiede
// l'intero <svg> — scale, stack layout, area generator, data join dentro un
// unico useEffect. React tiene solo ref, stato di selezione/tooltip. Il colore
// codifica la FAMIGLIA (familyColor, stessa palette di RarityScale/
// EventCardsGrid), mai la quantità.
//
// Scelta dell'offset (motivata, come richiesto dal task T1.1): wiggle
// (streamgraph "ThemeRiver" vero, non uno stacked-area a zero) con ordine
// insideOut. Un asse Y con baseline a zero avrebbe richiesto un valore
// assoluto preciso leggibile a occhio — cosa che QuandoStrip fa già bene per
// UN evento, e che il tooltip fa qui per anno/famiglia specifici. Il valore
// aggiunto di questa vista non è il numero esatto ma la FORMA: quali famiglie
// si allargano/restringono e quando, cosa che il wiggle rende immediata e che
// un asse con baseline fissa (spesso quasi piatta nei primi decenni,
// affollata negli ultimi) comunicherebbe peggio. Per questo niente asse Y
// esplicito — è un silhouette, non un grafico di quantità assolute da
// leggere sull'asse.
//
// Legenda: CLICK isola la famiglia, non hover (roadmap T4.1, a differenza
// della legenda hover-only di RarityScale). Motivo: qui l'obiettivo è
// seguire l'andamento di UNA famiglia lungo 75 anni di larghezza del
// grafico — un'ispezione prolungata, con lo sguardo che percorre tutto
// l'asse X. L'hover richiederebbe di tenere il mouse fermo sulla legenda
// mentre gli occhi si spostano, ma almeno lascia libero lo sguardo (il
// mouse resta parcheggiato); il click invece FISSA la selezione senza
// vincolare il mouse a nessun punto, ed è più adatto anche da tastiera
// (Invio/Spazio su un bottone reale) di un hover che da tastiera non
// esisterebbe. Stesso pattern del filtro di EventCardsGrid (click per
// isolare, click di nuovo per deselezionare), riusato qui per coerenza.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { familyColor, familyLabel, FAMILY_LEGEND } from "@/lib/colors";
import ChartTooltip from "@/components/ChartTooltip";

// Una riga per anno, una colonna per famiglia: la forma che d3.stack si
// aspetta (struttura fissata nel task T0.1). Il loader di T2 produce
// esattamente questa struttura leggendo i 33 file evento.
export type FamilyTimelinePoint = { anno: number } & Record<string, number>;

interface Props {
  data: FamilyTimelinePoint[];
  // Chiamato quando l'utente clicca "Vedi gli eventi di [famiglia] →" con
  // una famiglia isolata (roadmap T5): a differenza di RarityScale/
  // EventCardsGrid, il fiume non porta a nessuna scheda di dettaglio da
  // solo — questo callback chiude il cerchio, passando la mano a "I
  // riquadri" già filtrato sulla stessa famiglia. Opzionale: se assente
  // (es. nella demo isolata), il link non compare.
  onSelectFamily?: (key: string) => void;
}

interface TooltipState {
  x: number;
  y: number;
  anno: number;
  famiglia: string;
  occorrenze: number;
}

const MARGIN = { top: 24, right: 24, bottom: 32, left: 24 };
const HEIGHT = 360;
// Stessa soglia di RarityScale.tsx e stesso ragionamento: DEFAULT_WIDTH è il
// valore prima della prima misura del ResizeObserver (SSR/primo paint),
// MIN_WIDTH il minimo sotto cui il grafico resta scrollabile in orizzontale
// invece di comprimersi fino a diventare illeggibile.
const DEFAULT_WIDTH = 1180;
const MIN_WIDTH = 900;

const FAMILY_KEYS = FAMILY_LEGEND.map((f) => f.key);

export default function FamilyStream({ data, onSelectFamily }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  function toggleFamily(key: string) {
    setSelectedFamily((prev) => (prev === key ? null : key));
  }

  // Stesso pattern di RarityScale.tsx: misura il contenitore reale invece di
  // una larghezza fissa indovinata a mano.
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

  const sorted = useMemo(() => [...data].sort((a, b) => a.anno - b.anno), [data]);
  const yearExtent = d3.extent(sorted, (d) => d.anno) as [number, number];

  const xScale = useMemo(
    () => d3.scaleLinear().domain(yearExtent).range([MARGIN.left, width - MARGIN.right]).clamp(true),
    [yearExtent, width]
  );

  // d3.stack fa il lavoro pesante: per ogni famiglia calcola [y0, y1] per
  // ogni anno secondo l'offset wiggle (streamgraph) e l'ordine insideOut
  // (le famiglie più "stabili" al centro, quelle più irregolari ai bordi —
  // lo stesso criterio che rende leggibile un ThemeRiver).
  const series = useMemo(
    () =>
      d3
        .stack<FamilyTimelinePoint>()
        .keys(FAMILY_KEYS)
        .order(d3.stackOrderInsideOut)
        .offset(d3.stackOffsetWiggle)(sorted),
    [sorted]
  );

  const yScale = useMemo(() => {
    const allValues = series.flatMap((layer) => layer.flatMap((d) => [d[0], d[1]]));
    const [yMin, yMax] = d3.extent(allValues) as [number, number];
    return d3.scaleLinear().domain([yMin ?? 0, yMax ?? 1]).range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  }, [series]);

  const area = useMemo(
    () =>
      d3
        .area<d3.SeriesPoint<FamilyTimelinePoint>>()
        .x((d) => xScale(d.data.anno))
        .y0((d) => yScale(d[0]))
        .y1((d) => yScale(d[1]))
        .curve(d3.curveBasis),
    [xScale, yScale]
  );

  // Trova l'anno più vicino al puntatore (bisezione, come un normale grafico
  // temporale) e la famiglia il cui strato contiene quel punto: serve a
  // popolare il tooltip senza un target per singolo pixel/famiglia.
  const bisectYear = useMemo(() => d3.bisector((d: FamilyTimelinePoint) => d.anno).left, []);

  // Setup una tantum: gruppi persistenti dell'SVG.
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    for (const cls of ["x-axis", "streams-group", "overlay"]) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0, ${HEIGHT - MARGIN.bottom + 4})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")).ticks(Math.min(15, yearExtent[1] - yearExtent[0] + 1)))
      .call((g) => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 10))
      .call((g) => g.selectAll("line, path").attr("stroke", "#9ca3af").attr("opacity", 0.4));

    const layers = svg
      .select<SVGGElement>(".streams-group")
      .selectAll<SVGPathElement, d3.Series<FamilyTimelinePoint, string>>("path.stream-layer")
      .data(series, (d) => d.key);

    layers
      .join(
        (enter) => enter.append("path").attr("class", "stream-layer").attr("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(200).attr("opacity", 0).remove()
      )
      .attr("d", (d) => area(d))
      .attr("fill", (d) => familyColor(d.key))
      // Bordo chiaro sempre presente (roadmap T4.1, passata di contrasto):
      // stessa ragione del pallino in EventCardsGrid e della striscia in
      // EventCard (roadmap R4.1) — indigo (griglia_e_risultato) e vinaccia
      // (team) hanno un contrasto sotto 2:1 contro lo sfondo quasi nero, e
      // qui il problema è amplificato perché una fascia può assottigliarsi
      // fino a pochi pixel in un anno con poche occorrenze, sparendo quasi
      // del tutto. Un filo bianco translucido attorno a OGNI fascia (non
      // solo le due critiche, per uniformità) la rende sempre percepibile
      // come forma anche quando il riempimento si confonde con lo sfondo.
      .attr("stroke", "rgba(255,255,255,0.18)")
      .attr("stroke-width", 1)
      .attr("opacity", (d) => (selectedFamily && d.key !== selectedFamily ? 0.2 : 0.9))
      .style("cursor", "default");

    // Overlay trasparente su tutta l'area del grafico: un unico target per
    // pointermove invece di uno per fascia, più semplice e più affidabile
    // quando le fasce sono sottili o si toccano.
    svg
      .select<SVGGElement>(".overlay")
      .selectAll<SVGRectElement, null>("rect.hover-target")
      .data([null])
      .join("rect")
      .attr("class", "hover-target")
      .attr("x", MARGIN.left)
      .attr("y", MARGIN.top)
      .attr("width", Math.max(0, width - MARGIN.left - MARGIN.right))
      .attr("height", HEIGHT - MARGIN.top - MARGIN.bottom)
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("pointermove", (event) => {
        const [pointerX, pointerY] = d3.pointer(event, svgRef.current);
        const anno = Math.round(xScale.invert(pointerX));
        const idx = Math.min(bisectYear(sorted, anno), sorted.length - 1);
        const point = sorted[idx];
        if (!point) return;

        const valueAtPointer = yScale.invert(pointerY);
        const layer = series.find((s) => {
          const [y0, y1] = s[idx];
          return valueAtPointer >= Math.min(y0, y1) && valueAtPointer <= Math.max(y0, y1);
        });
        if (!layer) {
          setTooltip(null);
          return;
        }

        setTooltip({
          x: event.clientX,
          y: event.clientY,
          anno: point.anno,
          famiglia: layer.key,
          occorrenze: point[layer.key] ?? 0,
        });
      })
      .on("pointerleave", () => setTooltip(null))
      // Click sul grafico stesso, non solo sulla legenda: l'overlay sta
      // SOPRA le fasce (serve così per il tooltip), quindi un click su una
      // fascia arriva qui, non al path — stessa bisezione già usata per il
      // tooltip per capire su quale fascia si è cliccato.
      .on("click", (event) => {
        const [pointerX, pointerY] = d3.pointer(event, svgRef.current);
        const idx = Math.min(bisectYear(sorted, Math.round(xScale.invert(pointerX))), sorted.length - 1);
        const valueAtPointer = yScale.invert(pointerY);
        const layer = series.find((s) => {
          const [y0, y1] = s[idx];
          return valueAtPointer >= Math.min(y0, y1) && valueAtPointer <= Math.max(y0, y1);
        });
        if (layer) toggleFamily(layer.key);
      });
  }, [series, area, xScale, yScale, yearExtent, sorted, selectedFamily, bisectYear, width]);

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative">
      <div ref={containerRef} className="overflow-x-auto hide-scrollbar rounded-lg">
        <div style={{ position: "relative", width }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            width="100%"
            height={HEIGHT}
            role="img"
            aria-label="Occorrenze per famiglia di eventi lungo le stagioni, 1950-2024"
          />
        </div>
      </div>
      {tooltip && (
        <ChartTooltip x={tooltip.x} y={tooltip.y} onDismiss={() => setTooltip(null)}>
          <div className="font-bold">{tooltip.anno}</div>
          <div className="text-neutral-gray">{familyLabel(tooltip.famiglia)}</div>
          <div className="text-neutral-gray">
            {tooltip.occorrenze} {tooltip.occorrenze === 1 ? "occorrenza" : "occorrenze"}
          </div>
        </ChartTooltip>
      )}
      <div className="flex gap-4 flex-wrap mt-4" role="group" aria-label="Isola una famiglia">
        {FAMILY_LEGEND.map((item) => {
          const isActive = selectedFamily === null || selectedFamily === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleFamily(item.key)}
              aria-pressed={selectedFamily === item.key}
              className={`flex items-center gap-2 text-xs uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-racing-red ${
                isActive ? "text-neutral-gray hover:text-white" : "text-neutral-gray/40 hover:text-neutral-gray"
              }`}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/40"
                style={{ backgroundColor: item.color, opacity: isActive ? 1 : 0.4 }}
              />
              {item.label}
            </button>
          );
        })}
        {selectedFamily !== null && (
          <button
            type="button"
            onClick={() => setSelectedFamily(null)}
            className="text-xs uppercase tracking-widest text-racing-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-racing-red"
          >
            Mostra tutte
          </button>
        )}
      </div>
      {/* Il fiume da solo non porta a nessun dettaglio (a differenza di
          RarityScale/EventCardsGrid, che finiscono sempre su un evento o sul
          compositore) — questo link chiude il cerchio verso "I riquadri",
          già filtrato sulla stessa famiglia isolata qui. */}
      {selectedFamily !== null && onSelectFamily && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onSelectFamily(selectedFamily)}
            className="text-xs uppercase tracking-widest text-racing-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-racing-red"
          >
            Vedi gli eventi di {familyLabel(selectedFamily).toLowerCase()} →
          </button>
        </div>
      )}
    </div>
  );
}
