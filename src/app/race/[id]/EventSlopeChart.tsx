"use client";

// Vista 3 della specifica, pivot v2 (docs/PROGETTAZIONE.md, §5.6 e §7,
// tabella pivot): "il momento della scelta". Non più solo prima/dopo, ma
// tre colonne — sinistra = posizione al giro del deploy, centro =
// rientro PREVISTO se si boxa (§5.6, boxOption.predictedRejoinPos, chi
// non ha boxato mantiene la posizione: linea dritta), destra = posizione
// reale 3 giri dopo la fine (come nella v1). Il segmento previsione→
// realtà (centro→destra) È il racconto: quanto il muretto aveva
// indovinato, quanto no.
//
// Nasce riadattando src/app/rivalry/[id]/RaceSlopeChart.tsx (ora rimosso
// insieme alle pagine rivalry, sezione 3) — qui è una riscrittura completa
// secondo la convenzione D3-possiede-l'SVG delle altre viste della pagina
// gara.
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
import {
  HIGHLIGHT_COLOR,
  PIT_CONTEXT_COLORS,
  OUTCOME_COLORS,
  NEUTRALIZATION_ACCENT_COLOR,
  TEXT_MUTED_COLOR,
} from "@/lib/colors";
import type { RaceData, RaceNeutralization } from "./RaceAnatomyTimeline";
import { useRaceInteraction } from "./RaceInteractionContext";

const POST_EVENT_OFFSET = 3; // deve restare sincronizzato con build_all.py e params.json

interface Props {
  raceData: RaceData;
}

interface SlopeDatum {
  driverId: string;
  posBefore: number;
  // Rientro previsto (boxOption.predictedRejoinPos) se choice === "BOX";
  // altrimenti uguale a posBefore ("mantiene la posizione", linea dritta
  // sul primo segmento — v. docstring in cima al file).
  posMid: number;
  posAfter: number;
  choice: "BOX" | "STAY" | "FORCED";
  // Distanza tra previsione e realtà: positiva = ha fatto MEGLIO del
  // previsto, negativa = peggio. È il racconto del secondo segmento
  // (v. docstring). Per chi non ha boxato coincide col movimento reale
  // (posBefore − posAfter), coerente con la v1.
  accuracyDelta: number;
}

const MARGIN = { top: 20, right: 68, bottom: 16, left: 68 };
const ROW_HEIGHT = 22;
const WIDTH = 640;

// Colore condiviso dai due segmenti "di risultato" (il secondo, sempre; il
// primo solo quando non ha boxato, perché li' coincide col movimento
// reale): stessa palette esiti usata nella matrice delle decisioni. Il
// caso "nessun cambiamento" riusa lo stesso slate (#94a3b8) della matrice
// (DECISION_CELL_COLORS.BOX_NEUTRAL/STAY_NEUTRAL) invece di
// DEFAULT_LINE_COLOR (#4b5563, un grigio diverso): stesso concetto di
// "esito neutro", stessa pagina gara, deve leggersi come lo stesso colore
// in entrambe le viste (passata di qualità §7, task P3.3).
function resultColor(delta: number): string {
  if (delta > 0) return OUTCOME_COLORS.EXPLOITED; // ha fatto meglio del previsto
  if (delta < 0) return OUTCOME_COLORS.FULL_PRICE; // ha fatto peggio del previsto
  return PIT_CONTEXT_COLORS.GREEN;
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
    const decisionByDriverId = new Map(
      raceData.decisions.filter((d) => d.eventId === selectedEvent.eventId).map((d) => [d.driverId, d])
    );
    return raceData.drivers
      .map((driver) => {
        const posBefore = driver.laps.find((l) => l.l === selectedEvent.startLap)?.pos;
        const posAfter = driver.laps.find((l) => l.l === afterLap)?.pos;
        if (posBefore == null || posAfter == null) return null;
        const decision = decisionByDriverId.get(driver.driverId);
        const choice = decision?.choice ?? "STAY";
        const posMid = choice === "BOX" ? decision?.boxOption.predictedRejoinPos ?? posBefore : posBefore;
        return { driverId: driver.id, posBefore, posMid, posAfter, choice, accuracyDelta: posMid - posAfter };
      })
      .filter((d): d is SlopeDatum => d != null);
  }, [raceData, selectedEvent]);

  const height = MARGIN.top + MARGIN.bottom + Math.max(slopeData.length, 1) * ROW_HEIGHT;

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const groups = ["headers", "predicted-lines-group", "actual-lines-group", "left-labels", "mid-labels", "right-labels"];
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

    // Interrompe transizioni in corso prima di ridisegnare: React
    // StrictMode (dev) invoca questo effect due volte per commit, e due
    // join/transizioni consecutivi sugli stessi elementi altrimenti si
    // accavallano (v. DecisionIndexDistribution.tsx per il bug che questo
    // pattern evita: un tween interrotto a metà lascia etichette vuote o
    // linee mai portate al valore finale).
    for (const cls of ["predicted-lines-group", "actual-lines-group", "left-labels", "mid-labels", "right-labels"]) {
      const group = svg.select(`.${cls}`);
      group.interrupt();
      group.selectAll("*").interrupt();
    }

    const xLeft = MARGIN.left;
    const xRight = WIDTH - MARGIN.right;
    const xMid = (xLeft + xRight) / 2;

    // Ranghi densi (indice dopo ordinamento, non il valore di posizione
    // grezzo): evita righe vuote se qualche pilota manca di dati a questo
    // giro. Stesso principio per le tre colonne.
    const byBefore = [...slopeData].sort((a, b) => a.posBefore - b.posBefore);
    const byMid = [...slopeData].sort((a, b) => a.posMid - b.posMid);
    const byAfter = [...slopeData].sort((a, b) => a.posAfter - b.posAfter);
    const yLeft = new Map(byBefore.map((d, i) => [d.driverId, MARGIN.top + i * ROW_HEIGHT]));
    const yMid = new Map(byMid.map((d, i) => [d.driverId, MARGIN.top + i * ROW_HEIGHT]));
    const yRight = new Map(byAfter.map((d, i) => [d.driverId, MARGIN.top + i * ROW_HEIGHT]));

    svg
      .select<SVGGElement>(".headers")
      .selectAll<SVGTextElement, { text: string; x: number; anchor: "start" | "middle" | "end" }>("text.header")
      .data([
        { text: "Al deployment", x: xLeft, anchor: "start" as const },
        { text: "Rientro previsto (se boxa)", x: xMid, anchor: "middle" as const },
        { text: `+${POST_EVENT_OFFSET} giri dopo la fine`, x: xRight, anchor: "end" as const },
      ])
      .join(
        (enter) => enter.append("text").attr("class", "header").attr("font-size", 11).attr("fill", NEUTRALIZATION_ACCENT_COLOR),
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("x", (d) => d.x)
      .attr("y", MARGIN.top - 8)
      .attr("text-anchor", (d) => d.anchor)
      .text((d) => d.text);

    // Primo segmento (sinistra→centro), tratteggiato: la PREVISIONE, non
    // un risultato — colore neutro di riferimento (stessa costante usata
    // per le bande di neutralizzazione e le linee di riferimento altrove
    // nel progetto), non la palette esiti. Per chi non ha boxato è piatto
    // (posMid = posBefore): "mantiene la posizione", come da richiesta.
    const predictedLines = svg
      .select<SVGGElement>(".predicted-lines-group")
      .selectAll<SVGLineElement, SlopeDatum>("line.predicted-line")
      .data(slopeData, (d) => d.driverId)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("class", "predicted-line")
            .style("cursor", "pointer")
            .style("pointer-events", "stroke")
            .attr("stroke", NEUTRALIZATION_ACCENT_COLOR)
            .attr("stroke-dasharray", "3 3")
            .attr("x1", xLeft)
            .attr("x2", xMid)
            .attr("y1", (d) => yLeft.get(d.driverId) ?? 0)
            .attr("y2", (d) => yLeft.get(d.driverId) ?? 0)
            .style("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(200).style("opacity", 0).remove()
      );

    predictedLines
      .on("pointerenter", (_event, d) => {
        if (!lockedRef.current) setHoveredDriverId(d.driverId);
      })
      .on("pointerleave", () => {
        if (!lockedRef.current) setHoveredDriverId(null);
      })
      .on("click", (_event, d) => toggleLockedDriverId(d.driverId))
      .attr("stroke-width", 1.5)
      .transition()
      .duration(400)
      .style("opacity", (d) => (d.choice === "BOX" ? 0.85 : 0.35))
      .attr("y1", (d) => yLeft.get(d.driverId) ?? 0)
      .attr("y2", (d) => yMid.get(d.driverId) ?? 0);

    // Secondo segmento (centro→destra), pieno: "successo davvero" — la
    // distanza tra previsione e realtà, colorata con la palette esiti
    // (verde = ha fatto meglio del previsto, vermiglio = peggio). Per chi
    // non ha boxato coincide col movimento reale rispetto al deployment,
    // stessa lettura della v1.
    const actualLines = svg
      .select<SVGGElement>(".actual-lines-group")
      .selectAll<SVGLineElement, SlopeDatum>("line.actual-line")
      .data(slopeData, (d) => d.driverId)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("class", "actual-line")
            .style("cursor", "pointer")
            .attr("stroke", (d) => resultColor(d.accuracyDelta))
            .attr("x1", xMid)
            .attr("x2", xRight)
            .attr("y1", (d) => yLeft.get(d.driverId) ?? 0)
            .attr("y2", (d) => yLeft.get(d.driverId) ?? 0)
            .style("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(200).style("opacity", 0).remove()
      );

    actualLines
      .on("pointerenter", (_event, d) => {
        if (!lockedRef.current) setHoveredDriverId(d.driverId);
      })
      .on("pointerleave", () => {
        if (!lockedRef.current) setHoveredDriverId(null);
      })
      .on("click", (_event, d) => toggleLockedDriverId(d.driverId))
      .attr("stroke", (d) => resultColor(d.accuracyDelta))
      .attr("stroke-width", (d) => Math.min(1 + Math.abs(d.accuracyDelta) * 0.6, 8))
      .transition()
      .duration(400)
      .style("opacity", 1)
      .attr("x1", xMid)
      .attr("y1", (d) => yMid.get(d.driverId) ?? 0)
      .attr("y2", (d) => yRight.get(d.driverId) ?? 0);

    function labelSelection(
      className: string,
      x: number,
      anchor: "start" | "end" | "middle",
      yMap: Map<string, number>,
      fontSize: number,
      text: (d: SlopeDatum) => string,
      visible: (d: SlopeDatum) => boolean = () => true
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
              .attr("font-size", fontSize)
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
        .style("opacity", (d) => (visible(d) ? 1 : 0))
        .attr("x", x)
        .attr("y", (d) => yMap.get(d.driverId) ?? 0)
        .text(text);
    }

    // Sinistra: testo allineato a destra (verso il grafico), mostra la
    // posizione AL DEPLOYMENT. Destra: allineato a sinistra, mostra la
    // posizione DOPO. Centro: piccola etichetta solo per chi ha boxato
    // (per chi resta fuori coinciderebbe col valore già mostrato a
    // sinistra, sarebbe rumore) — il parametro "visible" controlla questo
    // senza toccare i join sopra.
    labelSelection("left-labels", xLeft - 8, "end", yLeft, 11, (d) => `P${d.posBefore} ${d.driverId}`);
    labelSelection("right-labels", xRight + 8, "start", yRight, 11, (d) => `${d.driverId} P${d.posAfter}`);
    labelSelection(
      "mid-labels",
      xMid,
      "middle",
      yMid,
      11,
      (d) => `P${d.posMid}`,
      (d) => d.choice === "BOX"
    );
  }, [raceData, selectedEvent, slopeData, height, setHoveredDriverId, toggleLockedDriverId]);

  // --- Effect di evidenziazione: solo colore/spessore sui nodi già
  // disegnati, nessun nuovo join.
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select<SVGGElement>(".predicted-lines-group")
      .selectAll<SVGLineElement, SlopeDatum>("line.predicted-line")
      .attr("stroke", (d) => (d.driverId === highlightedDriverId ? HIGHLIGHT_COLOR : NEUTRALIZATION_ACCENT_COLOR))
      .attr("stroke-width", (d) => (d.driverId === highlightedDriverId ? 3 : 1.5));

    svg
      .select<SVGGElement>(".actual-lines-group")
      .selectAll<SVGLineElement, SlopeDatum>("line.actual-line")
      .attr("stroke", (d) => (d.driverId === highlightedDriverId ? HIGHLIGHT_COLOR : resultColor(d.accuracyDelta)))
      .attr("stroke-width", (d) => (d.driverId === highlightedDriverId ? 4 : Math.min(1 + Math.abs(d.accuracyDelta) * 0.6, 8)));

    for (const cls of ["left-labels", "mid-labels", "right-labels"]) {
      svg
        .select<SVGGElement>(`.${cls}`)
        .selectAll<SVGTextElement, SlopeDatum>("text.label")
        .attr("fill", (d) => (d.driverId === highlightedDriverId ? HIGHLIGHT_COLOR : TEXT_MUTED_COLOR))
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
      <p className="text-xs text-text-secondary mb-3 max-w-2xl">
        La colonna centrale è dove il modello prevedeva di rientrare chi ha scelto di fermarsi (§5.6): tratteggiato
        il tragitto previsto, pieno il tratto che conta — quanto la realtà si è discostata dalla previsione, in
        verde se meglio del previsto, in vermiglio se peggio. Chi non si è fermato resta piatto sul primo tratto:
        non c&apos;era una previsione di rientro da verificare.
      </p>
      {slopeData.length === 0 ? (
        <p className="text-sm text-text-secondary italic">Dati insufficienti per questo evento.</p>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={`Classifica deformata dall'evento ${selectedEvent?.type} di ${raceData.race.name}, con rientro previsto per chi ha boxato`}
        />
      )}
    </div>
  );
}
