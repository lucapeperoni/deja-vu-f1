"use client";

// Vista 4 della specifica, pivot v2 (docs/PROGETTAZIONE.md, §5.6 e §7,
// tabella pivot): la matrice della lotteria diventa "matrice scelta ×
// esito". Le celle non colorano più solo la categoria v1 (EXPLOITED/
// LOCKED_OUT/...), ma choice × verdict del blocco decisions (§5.6, task
// P2.1): BOX-guadagnato, BOX-perso, STAY-guadagnato, STAY-perso, FORCED,
// NOT_NEEDED attenuato. La lettura v1 resta raggiungibile con il toggle
// "Vista opportunità" qui sotto — stessi dati, non ricalcolati, solo
// un'altra chiave di colore.
//
// Il tooltip diventa la scheda decisione (§5.6): cosa vedeva il muretto
// (margine, gomme, soste già fatte), le due opzioni quantificate (costo
// del box e rientro previsto — quest'ultimo preciso, errore mediano 1
// posizione, spike P1.1), scelta ed esito, in italiano discorsivo.
// L'indice combinato è una riga separata e dichiaratamente diversa: un
// vantaggio statistico stimato sull'intero campione, MAI chiamato
// "previsione" (quella è solo il rientro previsto, che è invece uno
// snapshot preciso per singolo caso — la distinzione è il punto centrale
// della decisione presa dopo lo spike P1.2, v. §5.6).
//
// Stessa convenzione di src/components/charts/D3Chart.tsx e di
// RaceAnatomyTimeline.tsx: React possiede solo il contenitore (ref, props,
// stato di tooltip/toggle), D3 possiede l'intero <svg> — griglia, celle,
// etichette dentro useEffect, redraw incrementale via selection.join.
//
// La colonna dell'evento cliccata sincronizza EventSlopeChart tramite
// RaceInteractionContext (selectedEventId) — "connect: brushing and
// linking tra le viste" (sezione 8, categorie di Yi et al.).
//
// Task 4.1: split tra effect strutturale (celle/etichette, dipende da
// raceData/drivers/events/matrixMode) ed effect di evidenziazione
// (opacità per pilota evidenziato + contorno della colonna sincronizzata
// con lo slope chart) — nessun nuovo data join quando cambia solo l'hover.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import clsx from "clsx";
import {
  outcomeColor,
  OUTCOME_LABELS,
  OUTCOME_LEGEND,
  decisionCellColor,
  DECISION_CELL_LEGEND,
  type DecisionCellCategory,
  HIGHLIGHT_COLOR,
  NEUTRALIZATION_ACCENT_COLOR,
  TEXT_MUTED_COLOR,
  CONTRAST_TEXT_COLOR,
} from "@/lib/colors";
import type { RaceData, RaceDecision, RaceDriver, RaceNeutralization } from "./RaceAnatomyTimeline";
import { useRaceInteraction } from "./RaceInteractionContext";
import ChartTooltip from "@/components/ChartTooltip";

// Deve restare sincronizzato con build_all.py / params.json
// (postEventOutcomeOffsetLaps): il campo outcome.posDelta5 del blocco
// decisions è popolato con lo stesso valore v1 a questo scarico di giri,
// non un calcolo separato a 5 giri nonostante il nome del campo — v.
// data-layer/app/metrics/decision_snapshots.py, build_event_decisions.
const POST_EVENT_OFFSET = 3;

type MatrixMode = "decision" | "opportunity";

interface Props {
  raceData: RaceData;
}

interface CellDatum {
  driver: RaceDriver;
  event: RaceNeutralization;
  eventIndex: number;
  decision: RaceDecision | undefined;
  decisionCategory: DecisionCellCategory;
  legacyCategory: string;
  posDelta: number | null;
}

interface TooltipState {
  x: number;
  y: number;
  driverLabel: string;
  eventLabel: string;
  narrative: string;
  indexLine: string;
  legacyLabel: string;
}

const MARGIN = { top: 64, right: 16, bottom: 8, left: 56 };
const CELL_WIDTH = 96;
const CELL_HEIGHT = 22;
const CELL_GAP = 3;
const NOT_NEEDED_OPACITY = 0.35;

function decisionCategory(decision: RaceDecision | undefined): DecisionCellCategory {
  if (!decision) return "STAY_NEUTRAL";
  if (decision.notNeeded) return "NOT_NEEDED";
  if (decision.choice === "FORCED") return "FORCED";
  const prefix = decision.choice === "BOX" ? "BOX" : "STAY";
  return `${prefix}_${decision.outcome.verdict}` as DecisionCellCategory;
}

// Scheda decisione (§5.6) raccontata in italiano discorsivo, nella forma
// decisa in progettazione: "aveva 19s di margine e gomme di 22 giri: si è fermato, previsto
// P6, rientrato P7, dopo 3 giri P5". Nessun dato nuovo: solo gli stessi
// campi del blocco decisions e di driver.pits (per la posizione di
// rientro effettiva, non presente in decisions) raccontati a parole.
function buildDecisionCard(
  driver: RaceDriver,
  event: RaceNeutralization,
  decision: RaceDecision | undefined
): { narrative: string; indexLine: string } {
  if (!decision) {
    return { narrative: "Dati della decisione non disponibili per questo pilota in questo evento.", indexLine: "" };
  }

  if (decision.notNeeded) {
    return {
      narrative: "Non aveva bisogno di fermarsi: aveva già completato le soste previste per questa gara.",
      indexLine: "",
    };
  }

  const { snapshot, boxOption, choice, outcome, combinedIndex } = decision;

  const gapPart =
    snapshot.gapBehind != null
      ? `${snapshot.gapBehind.toFixed(1)}s di margine sul gruppo dietro${
          snapshot.unreliableGapReference ? " (gap non affidabile in questo giro, v. metodologia)" : ""
        }`
      : "nessuno dietro (ultimo in classifica)";
  const tyrePart =
    snapshot.tyreAge != null
      ? `gomme di ${snapshot.tyreAge} giri${snapshot.compound ? ` (${snapshot.compound})` : ""}`
      : "età gomme non nota";
  const stopsPart =
    snapshot.stopsTypical > 0
      ? ` Aveva già fatto ${snapshot.stopsDone} sosta/e su ${snapshot.stopsTypical} tipiche di questa gara.`
      : "";

  const pit = driver.pits.find((p) => p.eventId === event.eventId);
  const posAfterOffset = outcome.posDelta5 != null && snapshot.pos != null ? snapshot.pos - outcome.posDelta5 : null;
  const afterClause = posAfterOffset != null ? `, dopo ${POST_EVENT_OFFSET} giri P${posAfterOffset}` : "";

  let choiceSentence: string;
  if (choice === "BOX") {
    const rejoin = pit?.posAfter != null ? `rientrato P${pit.posAfter}` : "rientro non registrato";
    choiceSentence = `Si è fermato: previsto P${boxOption.predictedRejoinPos ?? "n/d"}, ${rejoin}${afterClause}.`;
  } else if (choice === "FORCED") {
    choiceSentence = `Scelta forzata: escluso dalla finestra${afterClause}.`;
  } else {
    choiceSentence = `È rimasto fuori, ha scelto di aspettare${afterClause}.`;
  }

  const costClause =
    choice === "BOX" && boxOption.expectedLoss != null ? ` Costo atteso del box: ${boxOption.expectedLoss.toFixed(1)}s.` : "";

  const posClause = snapshot.pos != null ? `Aveva P${snapshot.pos}, ` : "Posizione al deployment non nota, ";
  const narrative = `${posClause}${gapPart} e ${tyrePart}.${stopsPart} ${choiceSentence}${costClause}`;

  const indexLine =
    combinedIndex != null
      ? `Vantaggio statistico stimato: ${combinedIndex >= 0 ? "+" : ""}${combinedIndex.toFixed(1)} — ${
          combinedIndex > 0.1 ? "sopra" : combinedIndex < -0.1 ? "sotto" : "nella"
        } media di chi di solito guadagna posizioni fermandosi (indice combinato di traffico e margine, §5.6: un'euristica aggregata su tutto il campione, non una previsione per questo caso).`
      : "Vantaggio statistico stimato: non calcolabile per questo evento (mancano traffico o margine).";

  return { narrative, indexLine };
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
  const [matrixMode, setMatrixMode] = useState<MatrixMode>("decision");
  const { highlightedDriverId, lockedDriverId, setHoveredDriverId, toggleLockedDriverId, selectedEventId, setSelectedEventId } =
    useRaceInteraction();

  const lockedRef = useRef(lockedDriverId);
  useEffect(() => {
    lockedRef.current = lockedDriverId;
  }, [lockedDriverId]);

  const drivers = useMemo(() => orderDrivers(raceData), [raceData]);
  const events = raceData.neutralizations;

  const decisionByKey = useMemo(() => {
    const map = new Map<string, RaceDecision>();
    for (const d of raceData.decisions) map.set(`${d.eventId}-${d.driverId}`, d);
    return map;
  }, [raceData]);

  const width = MARGIN.left + MARGIN.right + Math.max(events.length, 1) * (CELL_WIDTH + CELL_GAP);
  const height = MARGIN.top + MARGIN.bottom + drivers.length * (CELL_HEIGHT + CELL_GAP);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    // "column-highlight" prima di "cells-group" nel DOM: disegnata sotto le
    // celle, così la fascia di sfondo della colonna selezionata non copre
    // il bordo tratteggiato scelto/non scelto (v. sotto).
    const groups = ["column-highlight", "column-headers", "row-labels", "cells-group"];
    for (const cls of groups) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  // --- Effect strutturale: intestazioni, etichette, celle. Dipende anche
  // da matrixMode (ricolora le celle già disegnate): NON dipende da
  // highlightedDriverId né da selectedEventId (li dipinge il secondo
  // effect).
  useEffect(() => {
    if (events.length === 0) return;
    const svg = d3.select(svgRef.current);

    // Interrompe transizioni in corso prima di ridisegnare (v. commento
    // analogo in DecisionIndexDistribution.tsx/EventSlopeChart.tsx):
    // React StrictMode (dev) invoca questo effect due volte per commit.
    const cellsGroup = svg.select(".cells-group");
    cellsGroup.interrupt();
    cellsGroup.selectAll("*").interrupt();

    const yFor = (rowIndex: number) => MARGIN.top + rowIndex * (CELL_HEIGHT + CELL_GAP);
    const xFor = (colIndex: number) => MARGIN.left + colIndex * (CELL_WIDTH + CELL_GAP);
    const columnsHeight = drivers.length * (CELL_HEIGHT + CELL_GAP) - CELL_GAP;

    // --- Fascia di sfondo della colonna sincronizzata con lo slope chart:
    // prima era uno stroke sulle singole celle, spostato qui perché lo
    // stroke delle celle ora codifica la scelta BOX/STAY (v. sotto) — due
    // significati sullo stesso attributo avrebbero rotto uno dei due
    // (regola §7: "se il colore/stroke significa due cose, il grafico
    // diventa illeggibile"). Opacità impostata dall'effect di
    // evidenziazione, qui solo il join geometrico.
    svg
      .select<SVGGElement>(".column-highlight")
      .selectAll<SVGRectElement, RaceNeutralization>("rect.column-highlight-rect")
      .data(events, (d) => d.eventId)
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("class", "column-highlight-rect")
            .attr("rx", 4)
            .attr("fill", HIGHLIGHT_COLOR)
            .style("pointer-events", "none"),
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("x", (_d, i) => xFor(i) - 3)
      .attr("y", MARGIN.top - 3)
      .attr("width", CELL_WIDTH + 6)
      .attr("height", columnsHeight + 6);

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
    const cellData: CellDatum[] = drivers.flatMap((driver) =>
      events.map((event, eventIndex) => {
        const decision = decisionByKey.get(`${event.eventId}-${driver.driverId}`);
        const legacyCategory = driver.outcomes.find((o) => o.eventId === event.eventId)?.category ?? "NEUTRAL";
        return {
          driver,
          event,
          eventIndex,
          decision,
          decisionCategory: decisionCategory(decision),
          legacyCategory,
          posDelta: driver.outcomes.find((o) => o.eventId === event.eventId)?.posDelta ?? null,
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
        const fill = matrixMode === "decision" ? decisionCellColor(d.decisionCategory) : outcomeColor(d.legacyCategory);
        const fillOpacity = matrixMode === "decision" && d.decisionCategory === "NOT_NEEDED" ? NOT_NEEDED_OPACITY : 1;
        // Bordo tratteggiato = STAY, pieno = BOX/FORCED: la scelta deve
        // leggersi anche senza colore (passata di qualità §7, task P3.3).
        // BOX_GAINED/STAY_LOST e STAY_GAINED/grigio neutro cadono a
        // distanze RGB borderline sotto simulazione di protanopia/
        // deuteranopia (Machado-Oliveira-Fernandes 2009): la luminosità
        // da sola non basta a distinguere la scelta in quei casi. Solo in
        // "vista decisione": la vista v1 non ha un asse scelta da segnare.
        const isStay = matrixMode === "decision" && d.decision?.choice === "STAY";
        g.select("rect.cell-rect")
          .attr("fill", fill)
          .attr("fill-opacity", fillOpacity)
          .attr("stroke", matrixMode === "decision" ? CONTRAST_TEXT_COLOR : "none")
          .attr("stroke-opacity", 0.55)
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", isStay ? "3 2" : "none");
        g.select("text").text(d.posDelta != null ? `${d.posDelta > 0 ? "+" : ""}${d.posDelta}` : "");
      })
      .on("pointerenter", function (event, d) {
        if (!lockedRef.current) setHoveredDriverId(d.driver.id);
        const { narrative, indexLine } = buildDecisionCard(d.driver, d.event, d.decision);
        // Coordinate VIEWPORT (non d3.pointer/spazio SVG): il tooltip è un
        // portal fixed su document.body, vedi ChartTooltip — non risente
        // dell'overflow-x-auto del contenitore della matrice.
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          driverLabel: d.driver.id,
          eventLabel: `${d.event.type} · giri ${d.event.startLap}-${d.event.endLap}`,
          narrative,
          indexLine,
          legacyLabel: OUTCOME_LABELS[d.legacyCategory as keyof typeof OUTCOME_LABELS] ?? d.legacyCategory,
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
  }, [raceData, drivers, events, decisionByKey, matrixMode, setHoveredDriverId, toggleLockedDriverId, setSelectedEventId]);

  // --- Effect di evidenziazione: opacità delle righe per il pilota
  // evidenziato + contorno della colonna sincronizzata con lo slope chart.
  // Solo attributi, nessun nuovo join.
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg
      .select<SVGGElement>(".cells-group")
      .selectAll<SVGGElement, CellDatum>("g.cell")
      .attr("opacity", (d) => (highlightedDriverId && d.driver.id !== highlightedDriverId ? 0.35 : 1));

    // Fascia della colonna sincronizzata con lo slope chart: non più uno
    // stroke sulle celle (quell'attributo ora codifica la scelta BOX/STAY,
    // v. effect strutturale), un elemento a parte sotto le celle.
    svg
      .select<SVGGElement>(".column-highlight")
      .selectAll<SVGRectElement, RaceNeutralization>("rect.column-highlight-rect")
      .attr("opacity", (d) => (d.eventId === selectedEventId ? 0.12 : 0));

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
        Nessuna neutralizzazione in questa gara: la matrice delle decisioni non si applica (è la gara di controllo).
      </div>
    );
  }

  const legend = matrixMode === "decision" ? DECISION_CELL_LEGEND : OUTCOME_LEGEND;

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative overflow-x-auto hide-scrollbar">
      <div className="flex justify-end mb-3">
        <div className="flex gap-1 p-1 bg-panel border border-graphite rounded-md">
          <button
            onClick={() => setMatrixMode("decision")}
            className={clsx(
              "px-3 py-1.5 text-xs font-condensed uppercase tracking-wider rounded transition-colors",
              matrixMode === "decision" ? "bg-racing-red text-white font-bold" : "text-neutral-gray hover:text-white"
            )}
          >
            Vista decisione
          </button>
          <button
            onClick={() => setMatrixMode("opportunity")}
            className={clsx(
              "px-3 py-1.5 text-xs font-condensed uppercase tracking-wider rounded transition-colors",
              matrixMode === "opportunity" ? "bg-racing-red text-white font-bold" : "text-neutral-gray hover:text-white"
            )}
          >
            Vista opportunità (v1)
          </button>
        </div>
      </div>
      <div style={{ position: "relative", width }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={`Matrice scelta per esito, pilota per evento, di ${raceData.race.name} ${raceData.race.year}`}
        />
        {tooltip && (
          <ChartTooltip x={tooltip.x} y={tooltip.y} maxWidthPx={280} onDismiss={() => setTooltip(null)}>
            <div className="font-bold">
              {tooltip.driverLabel} · {tooltip.eventLabel}
            </div>
            <div className="text-neutral-gray mt-1">{tooltip.narrative}</div>
            {tooltip.indexLine && <div className="text-neutral-gray mt-1.5 italic">{tooltip.indexLine}</div>}
            <div className="text-neutral-gray/70 mt-1.5 text-[10px] uppercase tracking-wide">
              lettura precedente (v1): {tooltip.legacyLabel}
            </div>
          </ChartTooltip>
        )}
      </div>
      <div className="flex gap-4 flex-wrap mt-4">
        {legend.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-gray">
            <div
              className="w-3 h-3 rounded-sm"
              style={{
                backgroundColor: item.color,
                // Stesso bordo tratteggiato delle celle STAY (v. effect
                // strutturale): la legenda deve spiegare la codifica non
                // solo a colori, non solo dichiararla nel testo.
                border: item.key.startsWith("STAY_") ? `1.5px dashed ${CONTRAST_TEXT_COLOR}` : "none",
              }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
