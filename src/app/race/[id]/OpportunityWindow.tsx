"use client";

// Vista 4 della specifica (docs/PROGETTAZIONE.md, sezioni 5.5, 6 e 7):
// la matrice della lotteria. Stessa convenzione di
// src/components/charts/D3Chart.tsx e di RaceAnatomyTimeline.tsx: React
// possiede solo il contenitore (ref, props, stato del tooltip), D3
// possiede l'intero <svg> — griglia, celle, etichette dentro useEffect,
// redraw incrementale via selection.join.
//
// I dati di outcomes.json portano solo la categoria e il posDelta (vedi
// sezione 6), non il "perché" testuale: la spiegazione in italiano per il
// tooltip viene ricostruita qui rileggendo gli stessi ingredienti usati
// da classify_outcome() in data-layer/scripts/build_all.py (soglie
// comprese) — nessun dato nuovo, solo la stessa logica raccontata a parole.
//
// La colonna dell'evento cliccata sincronizza EventSlopeChart tramite
// RaceInteractionContext (selectedEventId) — "connect: brushing and
// linking tra le viste" (sezione 8, categorie di Yi et al.).
//
// Task 4.1: split tra effect strutturale (celle/etichette, dipende da
// raceData/drivers/events) ed effect di evidenziazione (opacità per
// pilota evidenziato + contorno della colonna sincronizzata con lo slope
// chart) — nessun nuovo data join quando cambia solo l'hover.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  outcomeColor,
  OUTCOME_LEGEND,
  HIGHLIGHT_COLOR,
  NEUTRALIZATION_ACCENT_COLOR,
  TEXT_MUTED_COLOR,
  CONTRAST_TEXT_COLOR,
} from "@/lib/colors";
import type { RaceData, RaceDriver, RaceNeutralization, RacePit } from "./RaceAnatomyTimeline";
import { useRaceInteraction } from "./RaceInteractionContext";
import ChartTooltip from "@/components/ChartTooltip";

// Soglie dichiarate (docs/PROGETTAZIONE.md sezione 5.5 e
// public/data/params.json): devono restare sincronizzate con
// data-layer/scripts/build_all.py, che è la fonte di verità per il
// calcolo effettivo della categoria. Qui servono solo a spiegarla.
const TYRE_AGE_MIN_LAPS = 8;

interface Props {
  raceData: RaceData;
}

interface CellDatum {
  driver: RaceDriver;
  event: RaceNeutralization;
  eventIndex: number;
  category: string;
  posDelta: number | null;
  tyreCompound: string | null;
  tyreAge: number | null;
}

interface TooltipState {
  x: number;
  y: number;
  driverLabel: string;
  eventLabel: string;
  category: string;
  detail: string;
  posDelta: number | null;
}

const MARGIN = { top: 64, right: 16, bottom: 8, left: 56 };
const CELL_WIDTH = 96;
const CELL_HEIGHT = 22;
const CELL_GAP = 3;

function lastPitLapBefore(pits: RacePit[], lap: number): number {
  let last = 0;
  for (const p of [...pits].sort((a, b) => a.lap - b.lap)) {
    if (p.lap < lap) last = p.lap;
    else break;
  }
  return last;
}

function carsBehindWithinPitLoss(
  driver: RaceDriver,
  eventStartLap: number,
  allDrivers: RaceDriver[],
  nominalPitLoss: number | null
): number | null {
  if (nominalPitLoss == null) return null;
  const driverLap = driver.laps.find((l) => l.l === eventStartLap);
  if (!driverLap || driverLap.ms == null) return null;
  let count = 0;
  for (const other of allDrivers) {
    if (other.driverId === driver.driverId) continue;
    const otherLap = other.laps.find((l) => l.l === eventStartLap);
    if (!otherLap || otherLap.ms == null) continue;
    const gap = otherLap.ms - driverLap.ms;
    if (gap > 0 && gap <= nominalPitLoss * 1000) count++;
  }
  return count;
}

function explainOutcome(
  driver: RaceDriver,
  event: RaceNeutralization,
  category: string,
  allDrivers: RaceDriver[],
  nominalPitLoss: number | null,
  tyreCompound: string | null,
  tyreAgeReal: number | null
): string {
  const pitInEvent = driver.pits.find((p) => p.eventId === event.eventId);
  // Mescola montata all'uscita: disponibile solo per le 3 gare-caso (vedi
  // build_all.py, CASE_RACE_SLUGS), puramente descrittivo.
  const compoundSuffix = pitInEvent?.compound ? ` (gomme ${pitInEvent.compound})` : "";

  switch (category) {
    case "EXPLOITED":
      return pitInEvent
        ? `Si è fermato al giro ${pitInEvent.lap}, sfruttando lo sconto (risparmio stimato ${pitInEvent.discount?.toFixed(1) ?? "n/d"}s)${compoundSuffix}.`
        : "Si è fermato durante la finestra, sfruttando lo sconto.";
    case "FULL_PRICE":
      return pitInEvent
        ? `Si è fermato al giro ${pitInEvent.lap}, pagando il prezzo pieno pochi giri prima dell'inizio della finestra.`
        : "Si è fermato poco prima della finestra, pagando il prezzo pieno.";
    case "LOCKED_OUT": {
      // tyreAgeReal viene dagli stint OpenF1 (solo 3 gare-caso): quando c'è,
      // e' piu' preciso della stima dedotta dai pit stop Ergast (tyreAge).
      const tyreAge = tyreAgeReal ?? event.startLap - lastPitLapBefore(driver.pits, event.startLap);
      const compoundLabel = tyreCompound ? ` ${tyreCompound}` : "";
      if (tyreAge < TYRE_AGE_MIN_LAPS) {
        return `Escluso: gomme${compoundLabel} montate da ${tyreAge} giri, troppo fresche per fermarsi di nuovo.`;
      }
      const carsBehind = carsBehindWithinPitLoss(driver, event.startLap, allDrivers, nominalPitLoss);
      return carsBehind != null
        ? `Escluso: fermandosi sarebbe rientrato dietro ad almeno ${carsBehind} auto (gomme${compoundLabel} da ${tyreAge} giri).`
        : "Escluso dalla finestra: le gomme o il traffico non lo permettevano.";
    }
    case "NOT_NEEDED":
      return "Aveva già completato le soste previste: la finestra non lo riguardava.";
    default:
      return "Non si è fermato, per una strategia non altrimenti classificata.";
  }
}

function orderDrivers(raceData: RaceData): RaceDriver[] {
  // "Ordinati per posizione al momento dell'evento" (sezione 6): con più
  // eventi si usa la posizione al primo, come ordine stabile dell'intera
  // matrice. Senza eventi (gara di controllo) si ordina per arrivo.
  const firstEvent = raceData.neutralizations[0];
  return [...raceData.drivers].sort((a, b) => {
    const posA = firstEvent ? a.laps.find((l) => l.l === firstEvent.startLap)?.pos : a.finish;
    const posB = firstEvent ? b.laps.find((l) => l.l === firstEvent.startLap)?.pos : b.finish;
    return (posA ?? Infinity) - (posB ?? Infinity);
  });
}

export default function OpportunityWindow({ raceData }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const { highlightedDriverId, lockedDriverId, setHoveredDriverId, toggleLockedDriverId, selectedEventId, setSelectedEventId } =
    useRaceInteraction();

  const lockedRef = useRef(lockedDriverId);
  useEffect(() => {
    lockedRef.current = lockedDriverId;
  }, [lockedDriverId]);

  const drivers = useMemo(() => orderDrivers(raceData), [raceData]);
  const events = raceData.neutralizations;

  const width = MARGIN.left + MARGIN.right + Math.max(events.length, 1) * (CELL_WIDTH + CELL_GAP);
  const height = MARGIN.top + MARGIN.bottom + drivers.length * (CELL_HEIGHT + CELL_GAP);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const groups = ["column-headers", "row-labels", "cells-group"];
    for (const cls of groups) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  // --- Effect strutturale: intestazioni, etichette, celle. NON dipende da
  // highlightedDriverId né da selectedEventId (li dipinge il secondo
  // effect).
  useEffect(() => {
    if (events.length === 0) return;
    const svg = d3.select(svgRef.current);

    const yFor = (rowIndex: number) => MARGIN.top + rowIndex * (CELL_HEIGHT + CELL_GAP);
    const xFor = (colIndex: number) => MARGIN.left + colIndex * (CELL_WIDTH + CELL_GAP);

    // --- Intestazioni di colonna (le neutralizzazioni): cliccabili, per
    // sincronizzare lo slope chart sullo stesso evento.
    svg
      .select<SVGGElement>(".column-headers")
      .selectAll<SVGTextElement, RaceNeutralization>("text.col-header")
      .data(events, (d) => d.eventId)
      .join(
        (enter) =>
          enter
            .append("text")
            .attr("class", "col-header")
            .attr("text-anchor", "middle")
            .attr("font-size", 11)
            .style("cursor", "pointer"),
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("x", (_d, i) => xFor(i) + CELL_WIDTH / 2)
      .attr("y", MARGIN.top - 16)
      .text((d) => `${d.type} · giri ${d.startLap}-${d.endLap}`)
      .on("click", (_event, d) => setSelectedEventId(d.eventId));

    // --- Etichette di riga (i piloti) ---
    svg
      .select<SVGGElement>(".row-labels")
      .selectAll<SVGTextElement, RaceDriver>("text.row-label")
      .data(drivers, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("text")
            .attr("class", "row-label")
            .attr("text-anchor", "end")
            .attr("font-size", 11)
            .attr("dominant-baseline", "middle")
            .style("cursor", "pointer")
            .style("user-select", "none"),
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("x", MARGIN.left - 10)
      .attr("y", (_d, i) => yFor(i) + CELL_HEIGHT / 2)
      .text((d) => d.id)
      .on("pointerenter", (_event, d) => {
        if (!lockedRef.current) setHoveredDriverId(d.id);
      })
      .on("pointerleave", () => {
        if (!lockedRef.current) setHoveredDriverId(null);
      })
      .on("click", (_event, d) => toggleLockedDriverId(d.id));

    // --- Celle ---
    const cellData: CellDatum[] = drivers.flatMap((driver, rowIndex) =>
      events.map((event, eventIndex) => {
        const outcome = driver.outcomes.find((o) => o.eventId === event.eventId);
        return {
          driver,
          event,
          eventIndex,
          category: outcome?.category ?? "NEUTRAL",
          posDelta: outcome?.posDelta ?? null,
          tyreCompound: outcome?.tyreCompound ?? null,
          tyreAge: outcome?.tyreAge ?? null,
        };
      })
    );

    svg
      .select<SVGGElement>(".cells-group")
      .selectAll<SVGGElement, CellDatum>("g.cell")
      .data(cellData, (d) => `${d.driver.id}-${d.event.eventId}`)
      .join(
        (enter) => {
          const g = enter.append("g").attr("class", "cell").style("cursor", "pointer");
          g.append("rect").attr("class", "cell-rect").attr("rx", 3).attr("width", CELL_WIDTH).attr("height", CELL_HEIGHT);
          g.append("text")
            .attr("x", CELL_WIDTH / 2)
            .attr("y", CELL_HEIGHT / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-size", 11)
            .attr("fill", CONTRAST_TEXT_COLOR)
            .style("pointer-events", "none");
          return g;
        },
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("transform", (d) => {
        const rowIndex = drivers.findIndex((dr) => dr.id === d.driver.id);
        return `translate(${xFor(d.eventIndex)}, ${yFor(rowIndex)})`;
      })
      .each(function (d) {
        const g = d3.select(this);
        g.select("rect.cell-rect").attr("fill", outcomeColor(d.category));
        g.select("text").text(d.posDelta != null ? `${d.posDelta > 0 ? "+" : ""}${d.posDelta}` : "");
      })
      .on("pointerenter", function (event, d) {
        if (!lockedRef.current) setHoveredDriverId(d.driver.id);
        // Coordinate VIEWPORT (non d3.pointer/spazio SVG): il tooltip è un
        // portal fixed su document.body, vedi ChartTooltip — non risente
        // dell'overflow-x-auto del contenitore della matrice.
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          driverLabel: d.driver.id,
          eventLabel: `${d.event.type} · giri ${d.event.startLap}-${d.event.endLap}`,
          category: d.category,
          detail: explainOutcome(
            d.driver,
            d.event,
            d.category,
            raceData.drivers,
            raceData.race.nominalPitLoss,
            d.tyreCompound,
            d.tyreAge
          ),
          posDelta: d.posDelta,
        });
      })
      .on("pointerleave", () => {
        if (!lockedRef.current) setHoveredDriverId(null);
        setTooltip(null);
      })
      .on("click", (_event, d) => {
        toggleLockedDriverId(d.driver.id);
        setSelectedEventId(d.event.eventId);
      });
  }, [raceData, drivers, events, setHoveredDriverId, toggleLockedDriverId, setSelectedEventId]);

  // --- Effect di evidenziazione: opacità delle righe per il pilota
  // evidenziato + contorno della colonna sincronizzata con lo slope chart.
  // Solo attributi, nessun nuovo join.
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select<SVGGElement>(".cells-group")
      .selectAll<SVGGElement, CellDatum>("g.cell")
      .attr("opacity", (d) => (highlightedDriverId && d.driver.id !== highlightedDriverId ? 0.35 : 1))
      .select<SVGRectElement>("rect.cell-rect")
      .attr("stroke", (d) => (d.event.eventId === selectedEventId ? HIGHLIGHT_COLOR : "none"))
      .attr("stroke-width", (d) => (d.event.eventId === selectedEventId ? 2 : 0));

    svg
      .select<SVGGElement>(".row-labels")
      .selectAll<SVGTextElement, RaceDriver>("text.row-label")
      .attr("fill", (d) => (d.id === highlightedDriverId ? HIGHLIGHT_COLOR : TEXT_MUTED_COLOR))
      .attr("font-weight", (d) => (d.id === highlightedDriverId ? 700 : 400));

    svg
      .select<SVGGElement>(".column-headers")
      .selectAll<SVGTextElement, RaceNeutralization>("text.col-header")
      .attr("fill", (d) => (d.eventId === selectedEventId ? HIGHLIGHT_COLOR : NEUTRALIZATION_ACCENT_COLOR))
      .attr("font-weight", (d) => (d.eventId === selectedEventId ? 700 : 400));
  }, [highlightedDriverId, selectedEventId, drivers, events]);

  if (events.length === 0) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 text-sm text-text-secondary italic">
        Nessuna neutralizzazione in questa gara: la matrice della lotteria non si applica (è la gara di controllo).
      </div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative overflow-x-auto hide-scrollbar">
      <div style={{ position: "relative", width }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={`Matrice degli esiti pilota per evento di ${raceData.race.name} ${raceData.race.year}`}
        />
        {tooltip && (
          <ChartTooltip x={tooltip.x} y={tooltip.y} maxWidthPx={240} onDismiss={() => setTooltip(null)}>
            <div className="font-bold">
              {tooltip.driverLabel} · {tooltip.eventLabel}
            </div>
            <div className="text-neutral-gray mt-1">{tooltip.detail}</div>
            {tooltip.posDelta != null && (
              <div className="mt-1">
                delta posizioni: {tooltip.posDelta > 0 ? "+" : ""}
                {tooltip.posDelta}
              </div>
            )}
          </ChartTooltip>
        )}
      </div>
      <div className="flex gap-4 flex-wrap mt-4">
        {OUTCOME_LEGEND.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-gray">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
