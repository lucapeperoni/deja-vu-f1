"use client";

// Vista 3 della specifica (docs/PROGETTAZIONE.md, sezioni 6 e 7): la
// classifica deformata. Nasce riadattando src/app/rivalry/[id]/RaceSlopeChart.tsx
// (ora rimosso insieme alle pagine rivalry, sezione 3) — qui è una
// riscrittura completa secondo la convenzione D3-possiede-l'SVG delle
// altre viste della pagina gara.
//
// Confronta, per UNA neutralizzazione alla volta, le posizioni al giro del
// deployment con le posizioni 3 giri dopo la fine del ciclo di soste (lo
// stesso scarto — POST_EVENT_OUTCOME_OFFSET = 3 — già usato per il
// posDelta di outcomes in data-layer/scripts/build_all.py).
//
// L'evento selezionato non è più uno stato locale: vive nel
// RaceInteractionContext (selectedEventId), condiviso con la matrice della
// lotteria (OpportunityWindow) — "il selettore evento sincronizza slope e
// matrice" (sezione 7/8, categoria "connect" di Yi et al.): scegliere
// l'evento qui o cliccare una colonna là fa la stessa cosa.
//
// Task 4.1: split tra effect strutturale (dipende da raceData/evento
// selezionato — cambiare evento è un'esplorazione esplicita, ricalcolare
// tutto è corretto) ed effect di evidenziazione (dipende solo
// dall'highlightedDriverId, nessun nuovo data join).

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import clsx from "clsx";
import { HIGHLIGHT_COLOR, DEFAULT_LINE_COLOR, OUTCOME_COLORS } from "@/lib/colors";
import type { RaceData, RaceNeutralization } from "./RaceAnatomyTimeline";
import { useRaceInteraction } from "./RaceInteractionContext";

const POST_EVENT_OFFSET = 3; // deve restare sincronizzato con build_all.py e params.json

interface Props {
  raceData: RaceData;
}

interface SlopeDatum {
  driverId: string;
  posBefore: number;
  posAfter: number;
  delta: number;
}

const MARGIN = { top: 16, right: 64, bottom: 16, left: 64 };
const ROW_HEIGHT = 22;
const WIDTH = 420;

function slopeColor(delta: number): string {
  if (delta > 0) return OUTCOME_COLORS.EXPLOITED; // ha guadagnato posizioni
  if (delta < 0) return OUTCOME_COLORS.FULL_PRICE; // ne ha perse
  return DEFAULT_LINE_COLOR;
}

export default function EventSlopeChart({ raceData }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { highlightedDriverId, lockedDriverId, setHoveredDriverId, toggleLockedDriverId, selectedEventId, setSelectedEventId } =
    useRaceInteraction();

  const lockedRef = useRef(lockedDriverId);
  useEffect(() => {
    lockedRef.current = lockedDriverId;
  }, [lockedDriverId]);

  const events = raceData.neutralizations;
  const selectedEvent: RaceNeutralization | undefined =
    events.find((e) => e.eventId === selectedEventId) ?? events[0];

  const slopeData = useMemo<SlopeDatum[]>(() => {
    if (!selectedEvent) return [];
    const afterLap = selectedEvent.endLap + POST_EVENT_OFFSET;
    return raceData.drivers
      .map((driver) => {
        const posBefore = driver.laps.find((l) => l.l === selectedEvent.startLap)?.pos;
        const posAfter = driver.laps.find((l) => l.l === afterLap)?.pos;
        if (posBefore == null || posAfter == null) return null;
        return { driverId: driver.id, posBefore, posAfter, delta: posBefore - posAfter };
      })
      .filter((d): d is SlopeDatum => d != null);
  }, [raceData, selectedEvent]);

  const height = MARGIN.top + MARGIN.bottom + Math.max(slopeData.length, 1) * ROW_HEIGHT;

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const groups = ["headers", "lines-group", "left-labels", "right-labels"];
    for (const cls of groups) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  // --- Effect strutturale: posizioni delle linee/etichette. Dipende da
  // quale evento è selezionato (un cambio di esplorazione, non un hover):
  // è corretto che ricalcoli tutto. NON dipende da highlightedDriverId.
  useEffect(() => {
    if (!selectedEvent) return;
    const svg = d3.select(svgRef.current);
    const xLeft = MARGIN.left;
    const xRight = WIDTH - MARGIN.right;

    const byBefore = [...slopeData].sort((a, b) => a.posBefore - b.posBefore);
    const byAfter = [...slopeData].sort((a, b) => a.posAfter - b.posAfter);
    const yLeft = new Map(byBefore.map((d, i) => [d.driverId, MARGIN.top + i * ROW_HEIGHT]));
    const yRight = new Map(byAfter.map((d, i) => [d.driverId, MARGIN.top + i * ROW_HEIGHT]));

    svg
      .select<SVGGElement>(".headers")
      .selectAll<SVGTextElement, string>("text.header")
      .data(["Al deployment", `+${POST_EVENT_OFFSET} giri dopo la fine`])
      .join(
        (enter) => enter.append("text").attr("class", "header").attr("font-size", 10).attr("fill", "#eab308"),
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("x", (_d, i) => (i === 0 ? xLeft : xRight))
      .attr("y", MARGIN.top - 6)
      .attr("text-anchor", (_d, i) => (i === 0 ? "start" : "end"))
      .text((d) => d);

    const lines = svg
      .select<SVGGElement>(".lines-group")
      .selectAll<SVGLineElement, SlopeDatum>("line.slope-line")
      .data(slopeData, (d) => d.driverId)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("class", "slope-line")
            .style("cursor", "pointer")
            .attr("stroke", (d) => slopeColor(d.delta))
            .attr("x1", xLeft)
            .attr("x2", xRight)
            .attr("y1", (d) => yLeft.get(d.driverId) ?? 0)
            .attr("y2", (d) => yLeft.get(d.driverId) ?? 0)
            .style("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(200).style("opacity", 0).remove()
      );

    lines
      .on("pointerenter", (_event, d) => {
        if (!lockedRef.current) setHoveredDriverId(d.driverId);
      })
      .on("pointerleave", () => {
        if (!lockedRef.current) setHoveredDriverId(null);
      })
      .on("click", (_event, d) => toggleLockedDriverId(d.driverId))
      .attr("stroke", (d) => slopeColor(d.delta))
      .attr("stroke-width", (d) => Math.min(1 + Math.abs(d.delta) * 0.6, 8))
      .transition()
      .duration(400)
      .style("opacity", 1)
      .attr("y1", (d) => yLeft.get(d.driverId) ?? 0)
      .attr("y2", (d) => yRight.get(d.driverId) ?? 0);

    function labelSelection(
      className: string,
      x: number,
      anchor: "start" | "end",
      yMap: Map<string, number>,
      position: (d: SlopeDatum) => number
    ) {
      svg
        .select<SVGGElement>(`.${className}`)
        .selectAll<SVGTextElement, SlopeDatum>("text.label")
        .data(slopeData, (d) => d.driverId)
        .join(
          (enter) =>
            enter
              .append("text")
              .attr("class", "label")
              .attr("font-size", 10)
              .attr("dominant-baseline", "middle")
              .attr("text-anchor", anchor)
              .style("cursor", "pointer")
              .style("user-select", "none")
              .style("opacity", 0),
          (update) => update,
          (exit) => exit.transition().duration(200).style("opacity", 0).remove()
        )
        .on("pointerenter", (_event, d) => {
          if (!lockedRef.current) setHoveredDriverId(d.driverId);
        })
        .on("pointerleave", () => {
          if (!lockedRef.current) setHoveredDriverId(null);
        })
        .on("click", (_event, d) => toggleLockedDriverId(d.driverId))
        .transition()
        .duration(400)
        .style("opacity", 1)
        .attr("x", x)
        .attr("y", (d) => yMap.get(d.driverId) ?? 0)
        .text((d) => (anchor === "end" ? `${d.driverId} P${position(d)}` : `P${position(d)} ${d.driverId}`));
    }

    // Sinistra: testo allineato a destra (verso il grafico), mostra la
    // posizione AL DEPLOYMENT. Destra: allineato a sinistra, mostra la
    // posizione DOPO. Il parametro "anchor" controlla solo l'allineamento
    // del testo, "position" sceglie quale valore mostrare — sono due cose
    // diverse: tenerle disaccoppiate evita di scambiare le etichette.
    labelSelection("left-labels", xLeft - 8, "end", yLeft, (d) => d.posBefore);
    labelSelection("right-labels", xRight + 8, "start", yRight, (d) => d.posAfter);
  }, [raceData, selectedEvent, slopeData, height, setHoveredDriverId, toggleLockedDriverId]);

  // --- Effect di evidenziazione: solo colore/spessore sui nodi già
  // disegnati, nessun nuovo join.
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select<SVGGElement>(".lines-group")
      .selectAll<SVGLineElement, SlopeDatum>("line.slope-line")
      .attr("stroke", (d) => (d.driverId === highlightedDriverId ? HIGHLIGHT_COLOR : slopeColor(d.delta)))
      .attr("stroke-width", (d) => (d.driverId === highlightedDriverId ? 4 : Math.min(1 + Math.abs(d.delta) * 0.6, 8)));

    for (const cls of ["left-labels", "right-labels"]) {
      svg
        .select<SVGGElement>(`.${cls}`)
        .selectAll<SVGTextElement, SlopeDatum>("text.label")
        .attr("fill", (d) => (d.driverId === highlightedDriverId ? HIGHLIGHT_COLOR : "#9ca3af"))
        .attr("font-weight", (d) => (d.driverId === highlightedDriverId ? 700 : 400));
    }
    // selectedEvent/slopeData in dipendenza solo per ridipingere
    // l'evidenziazione dopo un cambio di evento (esplorazione esplicita):
    // il ricalcolo delle posizioni lo fa l'altro effect.
  }, [highlightedDriverId, selectedEvent, slopeData]);

  if (events.length === 0) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 text-sm text-text-secondary italic">
        Nessuna neutralizzazione in questa gara: non c&apos;è una classifica da deformare (è la gara di controllo).
      </div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6">
      {events.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {events.map((event) => (
            <button
              key={event.eventId}
              onClick={() => setSelectedEventId(event.eventId)}
              className={clsx(
                "text-xs font-condensed uppercase tracking-widest px-3 py-1.5 rounded-md border transition-colors",
                event.eventId === selectedEvent?.eventId
                  ? "border-yellow-500 text-yellow-500 bg-yellow-500/10"
                  : "border-white/10 text-neutral-gray hover:border-white/30"
              )}
            >
              {event.type} giro {event.startLap}
            </button>
          ))}
        </div>
      )}
      {slopeData.length === 0 ? (
        <p className="text-sm text-text-secondary italic">Dati insufficienti per questo evento.</p>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={`Classifica deformata dall'evento ${selectedEvent?.type} di ${raceData.race.name}`}
        />
      )}
    </div>
  );
}
