"use client";

// Vista 5 della specifica (docs/PROGETTAZIONE.md, sezioni 3, 6 e 7):
// "stesso box, fortuna diversa". Nasce dal riciclo del lavoro fatto sulle
// rivalità (src/app/rivalry/[id]/DuelTimeline.tsx e RaceSlopeChart.tsx, ora
// rimossi insieme alle pagine /rivalry, /grid, /rankings — un solo progetto,
// una sola domanda di ricerca, sezione 3): non più "chi ha vinto il duello
// stagionale", ma "davanti alla stessa neutralizzazione, come sono andate le
// cose ai due compagni di squadra". Stessa convenzione D3-possiede-l'SVG
// delle altre viste della pagina gara (React tiene solo ref/stato, D3 fa
// scale, data join e transizioni dentro useEffect).
//
// Una riga per ogni coppia (team, neutralizzazione) in cui almeno uno dei
// due compagni ha un pit "vicino" all'evento (contesto diverso da GREEN:
// sotto SC/VSC, fregato appena prima, o appena dopo — sezione 5.4). I due
// piloti sono affiancati a specchio attorno a una linea centrale: a
// sinistra e a destra, l'etichetta del pit, una mini-barra per lo sconto,
// l'esito (sezione 5.5) e il delta di posizioni. Se entrambi si fermano
// nello stesso giro (double stack, sezione 5.4) un connettore orizzontale
// unisce le due barre con l'indicazione di chi è passato per primo — si
// deduce dalla posizione al momento del pit: chi era davanti in pista entra
// per primo, il compagno dietro perde tempo in coda (sezione 7, vista 5).
//
// Regola sul colore (sezione 7): questa è l'UNICA vista dove è ammesso il
// colore team, ed è dietro un interruttore locale che di default resta su
// "colora per contesto" — altrove nel sito il colore codifica sempre e solo
// l'etichetta del pit o l'esito, mai il team.
//
// Task 4.1: come nelle altre viste, l'effect strutturale (dipende da
// rows/colorMode: cambiare colonna colore è una riconfigurazione esplicita,
// non un hover) è separato dall'effect di evidenziazione (dipende solo da
// highlightedDriverId) — l'hover non ricalcola barre e posizioni.
//
// Task successivo (leggibilità): con più neutralizzazioni nella stessa gara
// la vista era un'unica lista lunga di righe (team × evento) che ripeteva
// "team · evento" su ogni riga — scorrendola si perdeva il confine tra un
// evento e l'altro. Ora le righe sono raggruppate sotto un'intestazione di
// evento condivisa (mostrata una sola volta per gruppo, non per riga), e un
// filtro sopra il grafico permette di isolare un solo evento quando i team
// coinvolti sono troppi per leggerli tutti insieme.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import clsx from "clsx";
import {
  pitContextColor,
  teamColor,
  teamLabel,
  outcomeColor,
  OUTCOME_LABELS,
  PIT_CONTEXT_LABELS,
  HIGHLIGHT_COLOR,
  DEFAULT_LINE_COLOR,
  NEUTRALIZATION_ACCENT_COLOR,
  TEXT_MUTED_COLOR,
  TEXT_PRIMARY_COLOR,
  MUTED_FILL_COLOR,
} from "@/lib/colors";
import type { RaceData, RaceDriver, RaceNeutralization, RacePit } from "./RaceAnatomyTimeline";
import { useRaceInteraction } from "./RaceInteractionContext";
import ChartTooltip from "@/components/ChartTooltip";

type ColorMode = "context" | "team";

interface Props {
  raceData: RaceData;
}

interface MirrorSide {
  driverId: string;
  pit: RacePit | null;
  outcomeCategory: string | null;
  posDelta: number | null;
}

interface MirrorRow {
  key: string;
  team: string;
  event: RaceNeutralization;
  left: MirrorSide;
  right: MirrorSide;
  doubleStack: boolean;
  firstDriverId: string | null; // chi è passato per primo nel double stack
}

interface TooltipState {
  x: number;
  y: number;
  side: MirrorSide;
  row: MirrorRow;
}

const MARGIN = { top: 12, right: 20, bottom: 12, left: 20 };
const WIDTH = 900;
const ROW_HEIGHT = 120;
const ROW_GAP = 10; // tra due righe (team) dello STESSO evento
const GROUP_GAP = 22; // spazio extra prima dell'intestazione di un NUOVO evento
const HEADER_HEIGHT = 34; // altezza riservata all'intestazione di evento, una volta per gruppo
const BAR_HEIGHT = 14;
const MAX_BAR_LEN = 190; // lunghezza massima di ciascuna mezza-barra, dal centro verso l'esterno

// Coordinate verticali (row-local, relative all'origine di OGNI riga team,
// non dell'intestazione) del blocco di testo sopra la barra: ogni riga di
// testo ha bisogno di piu' spazio del previsto rispetto alla successiva,
// altrimenti ascendenti/discendenti dei font si sovrappongono (era il bug:
// 6px di distanza tra baseline con font da 11-12px).
const TEAM_LABEL_Y = 14;
const DRIVER_LABEL_Y = 34;
const PIT_LABEL_Y = 48;
const BAR_Y = 68;
const STACK_LABEL_Y = BAR_Y - 8;

function sideFor(driver: RaceDriver, event: RaceNeutralization): MirrorSide {
  const pit = driver.pits.find((p) => p.eventId === event.eventId && p.context !== "GREEN") ?? null;
  const outcome = driver.outcomes.find((o) => o.eventId === event.eventId) ?? null;
  return {
    driverId: driver.id,
    pit,
    outcomeCategory: outcome?.category ?? null,
    posDelta: outcome?.posDelta ?? null,
  };
}

function buildRows(raceData: RaceData): MirrorRow[] {
  // Raggruppa i piloti per team, ordine stabile (alfabetico sul codice) così
  // "sinistra" e "destra" restano lo stesso pilota su tutte le righe.
  const byTeam = new Map<string, RaceDriver[]>();
  for (const driver of raceData.drivers) {
    if (!driver.team) continue;
    if (!byTeam.has(driver.team)) byTeam.set(driver.team, []);
    byTeam.get(driver.team)!.push(driver);
  }

  const rows: MirrorRow[] = [];
  for (const [team, teamDrivers] of byTeam) {
    if (teamDrivers.length < 2) continue; // serve una coppia da specchiare
    const [driverLeft, driverRight] = [...teamDrivers].sort((a, b) => a.id.localeCompare(b.id));

    for (const event of raceData.neutralizations) {
      const left = sideFor(driverLeft, event);
      const right = sideFor(driverRight, event);
      if (!left.pit && !right.pit) continue; // il team deve avere almeno un pit vicino a questo evento

      const doubleStack =
        left.pit != null && right.pit != null && left.pit.lap === right.pit.lap && (left.pit.doubleStack || right.pit.doubleStack);

      let firstDriverId: string | null = null;
      if (doubleStack && left.pit && right.pit) {
        // Chi era davanti in pista (posBefore più basso) entra ai box per
        // primo; il compagno dietro fa la coda del double stack.
        if (left.pit.posBefore != null && right.pit.posBefore != null) {
          firstDriverId = left.pit.posBefore <= right.pit.posBefore ? left.driverId : right.driverId;
        } else if (driverLeft.grid != null && driverRight.grid != null) {
          // posBefore manca per i pit al giro 1 (non esiste un "giro prima"
          // da cui leggere la posizione, es. SC al via): la griglia di
          // partenza è il miglior proxy di chi era davanti in quel momento.
          firstDriverId = driverLeft.grid <= driverRight.grid ? left.driverId : right.driverId;
        }
      }

      rows.push({
        key: `${team}-${event.eventId}`,
        team,
        event,
        left,
        right,
        doubleStack,
        firstDriverId,
      });
    }
  }

  // Ordine di lettura: per giro dell'evento (con l'eventId come spareggio,
  // cosi' le righe dello stesso evento restano sempre adiacenti anche nel
  // caso limite di due eventi con lo stesso startLap), poi per team.
  return rows.sort(
    (a, b) =>
      a.event.startLap - b.event.startLap ||
      a.event.eventId.localeCompare(b.event.eventId) ||
      a.team.localeCompare(b.team)
  );
}

function pitLabel(side: MirrorSide): string {
  if (!side.pit) return "Non si è fermato in questa finestra";
  const base = `Giro ${side.pit.lap} · ${PIT_CONTEXT_LABELS[side.pit.context as keyof typeof PIT_CONTEXT_LABELS] ?? side.pit.context}`;
  // Mescola montata: disponibile solo per le 3 gare-caso (build_all.py,
  // CASE_RACE_SLUGS), puramente descrittivo.
  return side.pit.compound ? `${base} · gomme ${side.pit.compound}` : base;
}

interface LayoutRow {
  row: MirrorRow;
  y: number; // offset verticale (row-local) dell'origine della riga team
  isFirstInGroup: boolean;
}

// Calcola l'offset verticale di ogni riga, inserendo lo spazio per
// un'intestazione di evento (una sola volta) ogni volta che l'eventId
// cambia rispetto alla riga precedente. Le righe arrivano già ordinate per
// evento da buildRows, quindi un cambio di eventId segna sempre un nuovo
// gruppo, mai un evento già chiuso che si ripresenta più avanti.
function computeLayout(rows: MirrorRow[]): { layout: LayoutRow[]; totalHeight: number } {
  const layout: LayoutRow[] = [];
  let y = 0;
  rows.forEach((row, i) => {
    const isFirstInGroup = i === 0 || row.event.eventId !== rows[i - 1].event.eventId;
    if (i > 0) y += isFirstInGroup ? GROUP_GAP : ROW_GAP;
    if (isFirstInGroup) y += HEADER_HEIGHT;
    layout.push({ row, y, isFirstInGroup });
    y += ROW_HEIGHT;
  });
  return { layout, totalHeight: y };
}

export default function TeammateMirror({ raceData }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("context");
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<"all" | string>("all");
  const { highlightedDriverId, lockedDriverId, setHoveredDriverId, toggleLockedDriverId } = useRaceInteraction();

  const lockedRef = useRef(lockedDriverId);
  useEffect(() => {
    lockedRef.current = lockedDriverId;
  }, [lockedDriverId]);

  const allRows = useMemo(() => buildRows(raceData), [raceData]);

  // Un evento per ogni "capitolo" del filtro sopra il grafico, con quante
  // righe (coppie team-evento) porta con sé: aiuta a capire, prima di
  // scegliere, se un evento è "affollato" oppure no.
  const eventOptions = useMemo(() => {
    const byEvent = new Map<string, { event: RaceNeutralization; count: number }>();
    for (const row of allRows) {
      const entry = byEvent.get(row.event.eventId);
      if (entry) entry.count += 1;
      else byEvent.set(row.event.eventId, { event: row.event, count: 1 });
    }
    return [...byEvent.values()].sort((a, b) => a.event.startLap - b.event.startLap);
  }, [allRows]);

  const rows = useMemo(
    () => (selectedEventId === "all" ? allRows : allRows.filter((r) => r.event.eventId === selectedEventId)),
    [allRows, selectedEventId]
  );

  const { layout, totalHeight } = useMemo(() => computeLayout(rows), [rows]);
  const height = MARGIN.top + MARGIN.bottom + Math.max(totalHeight, ROW_HEIGHT);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const groups = ["headers-group", "rows-group"];
    for (const cls of groups) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  useEffect(() => {
    setTooltip(null);
  }, [colorMode, selectedEventId]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const centerX = WIDTH / 2;

    const maxAbsDiscount = Math.max(
      1,
      d3.max(rows, (r) => Math.max(Math.abs(r.left.pit?.discount ?? 0), Math.abs(r.right.pit?.discount ?? 0))) ?? 1
    );
    const barScale = d3.scaleLinear().domain([0, maxAbsDiscount]).range([0, MAX_BAR_LEN]).clamp(true);

    function fillFor(row: MirrorRow, side: MirrorSide): string {
      if (colorMode === "team") return teamColor(row.team);
      if (!side.pit) return MUTED_FILL_COLOR;
      return pitContextColor(side.pit.context);
    }

    function barLen(side: MirrorSide): number {
      if (!side.pit || side.pit.discount == null) return 0;
      return barScale(Math.abs(side.pit.discount));
    }

    // --- Intestazioni di evento: una per gruppo, sopra le righe team che
    // condividono lo stesso evento. Sostituiscono la ripetizione di "team ·
    // evento" su ogni singola riga.
    const headersSel = svg
      .select<SVGGElement>(".headers-group")
      .selectAll<SVGGElement, LayoutRow>("g.event-header")
      .data(
        layout.filter((d) => d.isFirstInGroup),
        (d) => d.row.event.eventId
      )
      .join(
        (enter) => {
          const g = enter.append("g").attr("class", "event-header").style("opacity", 0);
          g.append("text").attr("class", "event-header-label").attr("font-size", 13).attr("font-weight", 700).attr("fill", NEUTRALIZATION_ACCENT_COLOR);
          g.append("line").attr("class", "event-header-rule").attr("stroke", NEUTRALIZATION_ACCENT_COLOR).attr("stroke-width", 1).style("opacity", 0.35);
          return g;
        },
        (update) => update,
        (exit) => exit.transition().duration(200).style("opacity", 0).remove()
      );

    headersSel.transition().duration(300).style("opacity", 1);

    headersSel
      .select<SVGTextElement>("text.event-header-label")
      .attr("x", 0)
      .attr("y", (d) => MARGIN.top + d.y - HEADER_HEIGHT + 16)
      .text((d) => `${d.row.event.type} · giri ${d.row.event.startLap}-${d.row.event.endLap}`);

    headersSel
      .select<SVGLineElement>("line.event-header-rule")
      .attr("x1", 0)
      .attr("x2", WIDTH)
      .attr("y1", (d) => MARGIN.top + d.y - HEADER_HEIGHT + 24)
      .attr("y2", (d) => MARGIN.top + d.y - HEADER_HEIGHT + 24);

    const rowsSel = svg
      .select<SVGGElement>(".rows-group")
      .selectAll<SVGGElement, LayoutRow>("g.mirror-row")
      .data(layout, (d) => d.row.key)
      .join(
        (enter) => {
          const g = enter
            .append("g")
            .attr("class", "mirror-row")
            .style("opacity", 0)
            .attr("transform", (d) => `translate(0, ${MARGIN.top + d.y})`);

          g.append("text").attr("class", "team-label").attr("text-anchor", "middle").attr("font-size", 11).attr("fill", TEXT_MUTED_COLOR);
          g.append("line").attr("class", "center-line").attr("stroke", DEFAULT_LINE_COLOR).attr("stroke-width", 1);

          for (const side of ["left", "right"] as const) {
            g.append("text").attr("class", `${side}-driver-label`).attr("font-size", 12).attr("font-weight", 700);
            g.append("text").attr("class", `${side}-pit-label`).attr("font-size", 11).attr("fill", TEXT_MUTED_COLOR);
            g.append("rect").attr("class", `${side}-bar`).attr("height", BAR_HEIGHT).attr("rx", 2);
            g.append("text").attr("class", `${side}-discount-label`).attr("font-size", 11).attr("font-weight", 700);
            g.append("circle").attr("class", `${side}-outcome-dot`).attr("r", 4);
            g.append("text").attr("class", `${side}-outcome-label`).attr("font-size", 11);
          }

          g.append("line").attr("class", "stack-connector").attr("stroke", NEUTRALIZATION_ACCENT_COLOR).attr("stroke-width", 2).style("opacity", 0);
          g.append("text").attr("class", "stack-label").attr("font-size", 11).attr("fill", NEUTRALIZATION_ACCENT_COLOR).attr("text-anchor", "middle");

          return g;
        },
        (update) => update,
        (exit) => exit.transition().duration(200).style("opacity", 0).remove()
      );

    rowsSel
      .transition()
      .duration(300)
      .style("opacity", 1)
      .attr("transform", (d) => `translate(0, ${MARGIN.top + d.y})`);

    rowsSel
      .select<SVGTextElement>("text.team-label")
      .attr("x", centerX)
      .attr("y", TEAM_LABEL_Y)
      .text((d) => teamLabel(d.row.team));

    rowsSel
      .select<SVGLineElement>("line.center-line")
      .attr("x1", centerX)
      .attr("x2", centerX)
      .attr("y1", TEAM_LABEL_Y + 10)
      .attr("y2", ROW_HEIGHT - 10);

    for (const side of ["left", "right"] as const) {
      const isLeft = side === "left";
      const barY = BAR_Y;
      const driverX = isLeft ? centerX - 8 : centerX + 8;
      const anchor = isLeft ? "end" : "start";

      rowsSel
        .select<SVGTextElement>(`text.${side}-driver-label`)
        .attr("x", driverX)
        .attr("y", DRIVER_LABEL_Y)
        .attr("text-anchor", anchor)
        .style("cursor", "pointer")
        .text((d) => d.row[side].driverId)
        .on("pointerenter", (_e, d) => {
          if (!lockedRef.current) setHoveredDriverId(d.row[side].driverId);
        })
        .on("pointerleave", () => {
          if (!lockedRef.current) setHoveredDriverId(null);
        })
        .on("click", (_e, d) => toggleLockedDriverId(d.row[side].driverId));

      rowsSel
        .select<SVGTextElement>(`text.${side}-pit-label`)
        .attr("x", driverX)
        .attr("y", PIT_LABEL_Y)
        .attr("text-anchor", anchor)
        .text((d) => pitLabel(d.row[side]));

      rowsSel
        .select<SVGRectElement>(`rect.${side}-bar`)
        .attr("y", barY)
        .style("cursor", "pointer")
        .on("pointerenter", function (event, d) {
          if (!lockedRef.current) setHoveredDriverId(d.row[side].driverId);
          // Coordinate VIEWPORT (non d3.pointer/spazio SVG): il tooltip è
          // un portal fixed su document.body, vedi ChartTooltip.
          setTooltip({ x: event.clientX, y: event.clientY, side: d.row[side], row: d.row });
        })
        .on("pointermove", function (event, d) {
          setTooltip({ x: event.clientX, y: event.clientY, side: d.row[side], row: d.row });
        })
        .on("pointerleave", () => {
          if (!lockedRef.current) setHoveredDriverId(null);
          setTooltip(null);
        })
        .on("click", (_event, d) => toggleLockedDriverId(d.row[side].driverId))
        .transition()
        .duration(350)
        .attr("x", (d) => (isLeft ? centerX - barLen(d.row[side]) : centerX))
        .attr("width", (d) => Math.max(barLen(d.row[side]), d.row[side].pit ? 2 : 0))
        .attr("fill", (d) => fillFor(d.row, d.row[side]));

      rowsSel
        .select<SVGTextElement>(`text.${side}-discount-label`)
        .attr("y", barY + BAR_HEIGHT / 2 + 3)
        .attr("text-anchor", isLeft ? "end" : "start")
        .attr("fill", TEXT_PRIMARY_COLOR)
        .transition()
        .duration(350)
        .attr("x", (d) => {
          const len = barLen(d.row[side]);
          const edge = isLeft ? centerX - len : centerX + len;
          return isLeft ? edge - 6 : edge + 6;
        })
        .text((d) => {
          const disc = d.row[side].pit?.discount;
          if (disc == null) return d.row[side].pit ? "n/d" : "";
          return `${disc >= 0 ? "+" : ""}${disc.toFixed(1)}s`;
        });

      rowsSel
        .select<SVGCircleElement>(`circle.${side}-outcome-dot`)
        .attr("cx", isLeft ? driverX - 4 : driverX + 4)
        .attr("cy", barY + BAR_HEIGHT + 16)
        .attr("fill", (d) => (d.row[side].outcomeCategory ? outcomeColor(d.row[side].outcomeCategory as string) : MUTED_FILL_COLOR));

      rowsSel
        .select<SVGTextElement>(`text.${side}-outcome-label`)
        .attr("x", isLeft ? driverX - 10 : driverX + 10)
        .attr("y", barY + BAR_HEIGHT + 19)
        .attr("text-anchor", anchor)
        .attr("fill", TEXT_MUTED_COLOR)
        .text((d) => {
          const s = d.row[side];
          const outcomeText = s.outcomeCategory
            ? OUTCOME_LABELS[s.outcomeCategory as keyof typeof OUTCOME_LABELS] ?? s.outcomeCategory
            : "—";
          const deltaText = s.posDelta != null ? ` · Δ pos ${s.posDelta > 0 ? "+" : ""}${s.posDelta}` : "";
          return `${outcomeText}${deltaText}`;
        });
    }

    // --- Connettore double stack: unisce il bordo interno delle due
    // mezze-barre, con l'indicazione di chi è passato per primo.
    rowsSel
      .select<SVGLineElement>("line.stack-connector")
      .attr("y1", BAR_Y + BAR_HEIGHT / 2)
      .attr("y2", BAR_Y + BAR_HEIGHT / 2)
      .transition()
      .duration(350)
      .style("opacity", (d) => (d.row.doubleStack ? 1 : 0))
      .attr("x1", (d) => centerX - Math.min(barLen(d.row.left), 14))
      .attr("x2", (d) => centerX + Math.min(barLen(d.row.right), 14));

    rowsSel
      .select<SVGTextElement>("text.stack-label")
      .attr("x", centerX)
      .attr("y", STACK_LABEL_Y)
      .style("opacity", (d) => (d.row.doubleStack ? 1 : 0))
      .text((d) => (d.row.doubleStack ? `Double stack · ${d.row.firstDriverId ?? "?"} entra per primo` : ""));
  }, [rows, layout, colorMode, setHoveredDriverId, toggleLockedDriverId]);

  // --- Effect di evidenziazione: solo colore/stroke/opacità sui nodi già
  // disegnati, nessun nuovo join, nessun ricalcolo di barre.
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    for (const side of ["left", "right"] as const) {
      svg
        .select<SVGGElement>(".rows-group")
        .selectAll<SVGTextElement, LayoutRow>(`text.${side}-driver-label`)
        .attr("fill", (d) => (d.row[side].driverId === highlightedDriverId ? HIGHLIGHT_COLOR : TEXT_PRIMARY_COLOR));

      svg
        .select<SVGGElement>(".rows-group")
        .selectAll<SVGRectElement, LayoutRow>(`rect.${side}-bar`)
        .attr("stroke", (d) => (d.row[side].driverId === highlightedDriverId ? HIGHLIGHT_COLOR : "none"))
        .attr("stroke-width", 1.5)
        .attr("opacity", (d) => (highlightedDriverId && d.row[side].driverId !== highlightedDriverId ? 0.4 : 1));
    }
    // rows/colorMode in dipendenza solo per ridipingere l'evidenziazione
    // dopo un redraw strutturale: il ricalcolo vero e proprio resta
    // nell'altro effect.
  }, [highlightedDriverId, rows, layout, colorMode]);

  if (allRows.length === 0) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 text-sm text-text-secondary italic">
        Nessun team ha un pit stop vicino a una neutralizzazione in questa gara: la vista non si applica.
      </div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6 relative">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <p className="text-xs text-neutral-gray max-w-2xl">
          Una riga per ogni team davanti a una neutralizzazione in cui almeno uno dei due compagni si è fermato: a
          sinistra e a destra, a specchio, l&apos;esito di ciascuno.
          {eventOptions.length > 1 && " Con più eventi, isola quello che ti interessa dai filtri qui sotto."}
        </p>
        <div className="flex gap-1 p-1 bg-panel border border-graphite rounded-md">
          <button
            onClick={() => setColorMode("context")}
            className={clsx(
              "px-3 py-1.5 text-xs font-condensed uppercase tracking-wider rounded transition-colors",
              colorMode === "context" ? "bg-racing-red text-white font-bold" : "text-neutral-gray hover:text-white"
            )}
          >
            Colora per contesto
          </button>
          <button
            onClick={() => setColorMode("team")}
            className={clsx(
              "px-3 py-1.5 text-xs font-condensed uppercase tracking-wider rounded transition-colors",
              colorMode === "team" ? "bg-racing-red text-white font-bold" : "text-neutral-gray hover:text-white"
            )}
          >
            Colora per team
          </button>
        </div>
      </div>

      {eventOptions.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setSelectedEventId("all")}
            className={clsx(
              "px-3 py-1 text-xs font-condensed uppercase tracking-wider rounded-full border transition-colors",
              selectedEventId === "all"
                ? "bg-racing-red border-racing-red text-white font-bold"
                : "border-graphite text-neutral-gray hover:text-white hover:border-neutral-gray"
            )}
          >
            Tutti gli eventi ({allRows.length})
          </button>
          {eventOptions.map(({ event, count }) => (
            <button
              key={event.eventId}
              onClick={() => setSelectedEventId(event.eventId)}
              className={clsx(
                "px-3 py-1 text-xs font-condensed uppercase tracking-wider rounded-full border transition-colors",
                selectedEventId === event.eventId
                  ? "bg-racing-red border-racing-red text-white font-bold"
                  : "border-graphite text-neutral-gray hover:text-white hover:border-neutral-gray"
              )}
            >
              {event.type} · giri {event.startLap}-{event.endLap} ({count})
            </button>
          ))}
        </div>
      )}

      <div style={{ maxHeight: 640, overflowY: "auto" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={`Stesso box, fortuna diversa — ${raceData.race.name} ${raceData.race.year}${
            selectedEventId === "all" ? "" : `, evento ${selectedEventId}`
          }`}
        />
      </div>

      {tooltip && (
        <ChartTooltip x={tooltip.x} y={tooltip.y} maxWidthPx={240} onDismiss={() => setTooltip(null)}>
          <div className="font-bold">{tooltip.side.driverId}</div>
          <div className="text-neutral-gray mt-1">{pitLabel(tooltip.side)}</div>
          {tooltip.side.pit?.discount != null && (
            <div>
              sconto {tooltip.side.pit.discount >= 0 ? "+" : ""}
              {tooltip.side.pit.discount.toFixed(1)}s
            </div>
          )}
          {tooltip.side.outcomeCategory && (
            <div className="text-neutral-gray mt-1">
              {OUTCOME_LABELS[tooltip.side.outcomeCategory as keyof typeof OUTCOME_LABELS] ?? tooltip.side.outcomeCategory}
            </div>
          )}
        </ChartTooltip>
      )}
    </div>
  );
}
