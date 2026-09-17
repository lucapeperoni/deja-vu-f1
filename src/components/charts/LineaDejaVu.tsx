"use client";

// La linea dei déjà vu (Déjà vu v4, docs/PROGETTAZIONE-v4.md §7.3; roadmap
// D4.1): la vista portante.
//
//   X = il tempo, 1950-2024.
//   Y = la distanza dalla situazione chiesta: una riga per gruppo del
//       reticolo — "uguale" in alto, poi un allentamento alla volta, in
//       fondo "due slot cambiano" (i gruppi a due allentamenti, fusi).
//   Un punto per occorrenza, sulla riga del gruppo PIÙ VICINO in cui regge
//   (sono le `nuove` del reticolo: ogni caso una volta sola).
//   Colore = lo slot che cambia (SLOT_COLORS); la riga "uguale" è rossa,
//   l'unico posto del sito dove il rosso vuol dire qualcosa.
//
// Una riga vuota RESTA disegnata con "mai successo": l'assenza è la
// risposta. Le stagioni fuori dalla finestra di copertura sono una banda
// grigia dichiarata ("senza dati"): non sappiamo, non "non è successo".
//
// I punti hanno una CHIAVE stabile (la riga della tabella): quando uno
// slot cambia, lo stesso caso MIGRA da una riga all'altra con una
// transizione invece di sparire e riapparire — è l'unica animazione con un
// significato, e si vede cosa un allentamento sposta.
//
// Il brush sul tempo filtra i punti e aggiorna i conteggi per riga (i
// denominatori restano quelli della finestra piena, dichiarati sopra).
//
// Convenzione D3 del corso (docs/PROGETTAZIONE.md §7): D3 possiede l'intero
// <svg> — scale, assi, data join, brush, transizioni dentro useEffect;
// React tiene ref, stato di hover e callback. ResizeObserver, mai una
// larghezza scritta a mano.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import ChartTooltip from "@/components/ChartTooltip";
import { SLOT_COLORS, STORY_ACCENT_COLOR, TEXT_MUTED_COLOR, TEXT_PRIMARY_COLOR } from "@/lib/colors";
import type { Finestra, Occorrenza } from "@/lib/situazioni/motore";
import { etichettaGruppo, type Gruppo, type Reticolo } from "@/lib/situazioni/reticolo";
import type { DizionariJson, Gare } from "@/lib/situazioni/tabelle";

export interface RigaLinea {
  chiave: string;
  etichetta: string;
  colore: string;
  // n = casi del gruppo (tutte le occorrenze che reggono), nuove = quelli
  // non già in una riga più vicina; m = denominatore del gruppo
  n: number;
  m: number;
  unita: string;
  nuove: Occorrenza[];
  gruppo: Gruppo | null; // null per la riga fusa "due slot cambiano"
  esatto: boolean;
}

interface Props {
  reticolo: Reticolo;
  finestra: Finestra;
  gare: Gare;
  dizionari: DizionariJson;
  // click su un punto (o sul suo fallback da tastiera)
  onScegli?: (o: Occorrenza, riga: RigaLinea) => void;
  // il brush sul tempo, [annoDa, annoA] o null quando si toglie
  onBrush?: (intervallo: [number, number] | null) => void;
}

interface TooltipState {
  x: number;
  y: number;
  o: Occorrenza;
  riga: RigaLinea;
}

const DA = 1950;
const A = 2024;
const MARGIN = { top: 26, right: 20, bottom: 34, left: 236 };
const ROW_H = 52;
const MIN_WIDTH = 640;
const DEFAULT_WIDTH = 1100;

const COLORE_DUE_SLOT = "#8A8F9C";

// prefers-reduced-motion: la migrazione dei punti tra righe è l'unica
// animazione con un significato, ma chi la disattiva nel sistema non la
// vede — le durate vanno a zero, il risultato finale è identico.
function durata(ms: number): number {
  if (typeof window === "undefined") return ms;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

function jitter01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function chiaveOcc(o: Occorrenza): string {
  return o.riga !== null ? `r${o.riga}` : `g${o.garaIdx}`;
}

// Le righe da disegnare, dal reticolo: esatto, poi ogni gruppo a UN
// allentamento (nell'ordine del reticolo, per distanza), poi i gruppi a due
// allentamenti fusi in una riga sola.
export function righeDaReticolo(ret: Reticolo): RigaLinea[] {
  const righe: RigaLinea[] = [];
  const e = ret.esatto.risposta;
  righe.push({ chiave: "esatto", etichetta: "uguale", colore: STORY_ACCENT_COLOR, n: e.n, m: e.m, unita: e.unitaDenominatore, nuove: ret.esatto.nuove, gruppo: ret.esatto, esatto: true });
  const due: Occorrenza[] = [];
  let dueN = 0;
  for (const g of ret.gruppi) {
    if (g.allentamenti.length === 1) {
      const a = g.allentamenti[0];
      righe.push({ chiave: g.chiave, etichetta: etichettaGruppo(g), colore: SLOT_COLORS[a.slot], n: g.risposta.n, m: g.risposta.m, unita: g.risposta.unitaDenominatore, nuove: g.nuove, gruppo: g, esatto: false });
    } else {
      due.push(...g.nuove);
      dueN += g.nuove.length;
    }
  }
  if (ret.gruppi.some((g) => g.allentamenti.length > 1)) {
    righe.push({ chiave: "due", etichetta: "cambiano due slot", colore: COLORE_DUE_SLOT, n: dueN, m: 0, unita: "", nuove: due, gruppo: null, esatto: false });
  }
  return righe;
}

export default function LineaDejaVu({ reticolo, finestra, gare, dizionari, onScegli, onBrush }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [brush, setBrush] = useState<[number, number] | null>(null);

  const righe = useMemo(() => righeDaReticolo(reticolo), [reticolo]);
  const nomiPiloti = useMemo(() => new Map(dizionari.piloti.map((p) => [p.id, p.nome])), [dizionari]);
  const nomiCircuiti = useMemo(() => new Map(dizionari.circuiti.map((c) => [c.ref, c.localita])), [dizionari]);

  const height = MARGIN.top + righe.length * ROW_H + MARGIN.bottom;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(MIN_WIDTH, Math.round(w)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const x = useMemo(() => d3.scaleLinear().domain([DA, A]).range([MARGIN.left, width - MARGIN.right]).clamp(true), [width]);

  const segnalaBrush = useCallback(
    (iv: [number, number] | null) => {
      setBrush(iv);
      onBrush?.(iv);
    },
    [onBrush]
  );

  // Setup una tantum dei gruppi persistenti (l'ordine è l'ordine di pittura).
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    for (const cls of ["band-group", "rows-group", "points-group", "brush-group", "x-axis"]) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const rowY = (i: number) => MARGIN.top + i * ROW_H;
    const rowC = (i: number) => rowY(i) + ROW_H / 2;
    const left = MARGIN.left;
    const right = width - MARGIN.right;
    const plotBottom = MARGIN.top + righe.length * ROW_H;

    // --- asse X --------------------------------------------------------
    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0, ${plotBottom + 4})`)
      .call(d3.axisBottom(x).ticks(Math.min(15, Math.floor(width / 90))).tickFormat(d3.format("d")))
      .call((g) => g.selectAll("text").attr("fill", TEXT_MUTED_COLOR).attr("font-size", 10))
      .call((g) => g.selectAll("line, path").attr("stroke", TEXT_MUTED_COLOR).attr("opacity", 0.4));

    // --- banda fuori finestra: "senza dati" --------------------------------
    const bande: { chiave: string; da: number; a: number }[] = [];
    if (!finestra.vuota) {
      if (finestra.annoDa > DA) bande.push({ chiave: "prima", da: DA, a: finestra.annoDa });
      if (finestra.annoA < A) bande.push({ chiave: "dopo", da: finestra.annoA + 1, a: A });
    } else bande.push({ chiave: "tutto", da: DA, a: A });
    const bandSel = svg.select<SVGGElement>(".band-group").selectAll<SVGGElement, (typeof bande)[number]>("g.banda").data(bande, (d) => d.chiave);
    const bandEnter = bandSel.enter().append("g").attr("class", "banda");
    bandEnter.append("rect");
    bandEnter.append("text");
    bandSel.exit().remove();
    const bandM = bandEnter.merge(bandSel);
    bandM
      .select("rect")
      .attr("x", (d) => x(d.da))
      .attr("y", MARGIN.top - 8)
      .attr("width", (d) => Math.max(0, x(d.a) - x(d.da)))
      .attr("height", plotBottom - MARGIN.top + 8)
      .attr("fill", "rgba(255,255,255,0.05)")
      .attr("stroke", "rgba(255,255,255,0.12)")
      .attr("stroke-dasharray", "3 3");
    bandM
      .select("text")
      .attr("x", (d) => (x(d.da) + x(d.a)) / 2)
      .attr("y", MARGIN.top - 12)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", TEXT_MUTED_COLOR)
      .text((d) => (d.chiave === "tutto" ? "nessuna stagione in comune tra gli slot" : `senza dati ${d.da}–${d.a === A ? A : d.a - 1}`));

    // --- righe ----------------------------------------------------------
    const nelBrush = (o: Occorrenza) => !brush || (o.anno >= brush[0] && o.anno <= brush[1]);
    const rows = svg.select<SVGGElement>(".rows-group").selectAll<SVGGElement, RigaLinea>("g.riga").data(righe, (d) => d.chiave);
    const rowsEnter = rows.enter().append("g").attr("class", "riga");
    rowsEnter.append("rect").attr("class", "bg");
    rowsEnter.append("line").attr("class", "base");
    rowsEnter.append("text").attr("class", "lab");
    rowsEnter.append("text").attr("class", "cnt");
    rowsEnter.append("text").attr("class", "vuota");
    rows.exit().remove();
    const rowsM = rowsEnter.merge(rows);
    rowsM
      .transition()
      .duration(durata(300))
      .attr("transform", (_, i) => `translate(0, ${rowY(i)})`);
    rowsM
      .select("rect.bg")
      .attr("x", left)
      .attr("y", 3)
      .attr("width", Math.max(0, right - left))
      .attr("height", ROW_H - 6)
      .attr("fill", (d) => (d.esatto ? "rgba(225,6,0,0.07)" : "rgba(255,255,255,0.02)"))
      .attr("stroke", (d) => (d.esatto ? STORY_ACCENT_COLOR : "rgba(255,255,255,0.07)"))
      .attr("stroke-width", (d) => (d.esatto ? 1.5 : 1));
    rowsM
      .select("line.base")
      .attr("x1", left)
      .attr("x2", right)
      .attr("y1", ROW_H / 2)
      .attr("y2", ROW_H / 2)
      .attr("stroke", (d) => d.colore)
      .attr("stroke-opacity", 0.35);
    rowsM
      .select("text.lab")
      .attr("x", left - 14)
      .attr("y", ROW_H / 2 - 3)
      .attr("text-anchor", "end")
      .attr("font-size", (d) => (d.esatto ? 14 : 12))
      .attr("font-weight", (d) => (d.esatto ? 700 : 500))
      .attr("fill", (d) => (d.esatto ? TEXT_PRIMARY_COLOR : d.colore))
      .text((d) => d.etichetta);
    rowsM
      .select("text.cnt")
      .attr("x", left - 14)
      .attr("y", ROW_H / 2 + 12)
      .attr("text-anchor", "end")
      .attr("font-size", 10)
      .attr("fill", TEXT_MUTED_COLOR)
      .text((d) => {
        const k = brush ? d.nuove.filter(nelBrush).length : d.nuove.length;
        const base = d.gruppo ? `${d.n} su ${d.m} ${d.unita}` : `${d.n} casi`;
        const nuove = d.gruppo && !d.esatto && d.nuove.length !== d.n ? ` · ${d.nuove.length} nuovi` : "";
        return brush ? `${k} nel periodo · ${base}` : `${base}${nuove}`;
      });
    rowsM
      .select("text.vuota")
      .attr("x", (left + right) / 2)
      .attr("y", ROW_H / 2 + 4)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => (d.esatto ? 13 : 11))
      .attr("font-weight", (d) => (d.esatto ? 700 : 400))
      .attr("letter-spacing", (d) => (d.esatto ? "0.08em" : null))
      .attr("fill", (d) => (d.esatto ? STORY_ACCENT_COLOR : TEXT_MUTED_COLOR))
      .attr("opacity", (d) => (d.nuove.filter(nelBrush).length === 0 ? 0.85 : 0))
      .text((d) => (d.nuove.filter(nelBrush).length === 0 ? (d.esatto ? "MAI SUCCESSO" : "nessun caso") : ""));

    // --- punti: chiave stabile = l'occorrenza, così migrano tra righe ----
    interface Punto {
      chiave: string;
      cx: number;
      cy: number;
      colore: string;
      o: Occorrenza;
      riga: RigaLinea;
      dentro: boolean;
    }
    const punti: Punto[] = [];
    righe.forEach((r, i) => {
      const banda = ROW_H - 20;
      // nello stesso anno più occorrenze si impilano un po', in modo stabile
      r.nuove.forEach((o) => {
        punti.push({
          chiave: chiaveOcc(o),
          cx: x(o.anno),
          cy: rowC(i) + (jitter01(o.raceId * 31 + (o.driverId ?? 0)) - 0.5) * banda,
          colore: r.colore,
          o,
          riga: r,
          dentro: nelBrush(o),
        });
      });
    });

    svg
      .select<SVGGElement>(".points-group")
      .selectAll<SVGCircleElement, Punto>("circle.dv")
      .data(punti, (d) => d.chiave)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "dv")
            .attr("r", 0)
            .attr("cx", (d) => d.cx)
            .attr("cy", (d) => d.cy),
        (update) => update,
        (exit) => exit.transition().duration(durata(200)).attr("r", 0).remove()
      )
      .style("cursor", "pointer")
      .on("pointerenter", (ev, d) => setTooltip({ x: ev.clientX, y: ev.clientY, o: d.o, riga: d.riga }))
      .on("pointermove", (ev, d) => setTooltip({ x: ev.clientX, y: ev.clientY, o: d.o, riga: d.riga }))
      .on("pointerleave", () => setTooltip(null))
      .on("click", (_ev, d) => onScegli?.(d.o, d.riga))
      .transition()
      .duration(durata(450))
      .attr("cx", (d) => d.cx)
      .attr("cy", (d) => d.cy)
      .attr("r", (d) => (d.riga.esatto ? 5.5 : d.riga.gruppo ? 4.5 : 3.5))
      .attr("fill", (d) => d.colore)
      .attr("fill-opacity", (d) => (d.dentro ? 0.85 : 0.15))
      .attr("stroke", "#0B0C10")
      .attr("stroke-width", 1);

    // --- brush sul tempo ---------------------------------------------------
    const brushBehavior = d3
      .brushX()
      .extent([
        [left, MARGIN.top],
        [right, plotBottom],
      ])
      .on("end", (ev) => {
        if (!ev.sourceEvent) return; // programmatico
        if (!ev.selection) {
          segnalaBrush(null);
          return;
        }
        const [x0, x1] = ev.selection as [number, number];
        const da = Math.round(x.invert(x0));
        const a = Math.round(x.invert(x1));
        if (a - da < 1) {
          svg.select<SVGGElement>(".brush-group").call(brushBehavior.move, null);
          segnalaBrush(null);
        } else segnalaBrush([da, a]);
      });
    svg
      .select<SVGGElement>(".brush-group")
      .call(brushBehavior)
      .call((g) => g.select(".selection").attr("fill", "rgba(255,255,255,0.08)").attr("stroke", TEXT_MUTED_COLOR))
      .call((g) => g.select(".overlay").attr("cursor", "crosshair"));
  }, [righe, x, width, finestra, brush, onScegli, segnalaBrush]);

  const tt = tooltip;

  return (
    <div className="relative">
      <div ref={containerRef} className="overflow-x-auto">
        <div style={{ position: "relative", width }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            role="img"
            aria-label={`Linea dei déjà vu: ${righe.map((r) => `${r.etichetta}, ${r.nuove.length} casi`).join("; ")}`}
          />
        </div>
      </div>
      <p className="text-xs text-neutral-gray mt-2">
        Un punto = un caso, sulla riga più vicina in cui regge; il colore è lo slot che cambia. Trascina sul tempo per contare in un periodo
        {brush && (
          <>
            {" "}
            · periodo <b className="text-white font-medium">{brush[0]}–{brush[1]}</b>{" "}
            <button type="button" className="underline decoration-dotted hover:text-white" onClick={() => segnalaBrush(null)}>
              togli
            </button>
          </>
        )}
        .
      </p>

      {/* Fallback da tastiera ai punti SVG (non focalizzabili): l'elenco dei
          casi per riga, con lo stesso click. */}
      <ul className="sr-only">
        {righe.map((r) =>
          r.nuove.map((o) => (
            <li key={`${r.chiave}-${chiaveOcc(o)}`}>
              <button type="button" onClick={() => onScegli?.(o, r)}>
                {r.etichetta}: {o.anno} {nomiCircuiti.get(o.circuitRef) ?? o.circuitRef}
                {o.driverId !== null ? `, ${nomiPiloti.get(o.driverId) ?? ""}` : ""}
              </button>
            </li>
          ))
        )}
      </ul>

      {tt && (
        <ChartTooltip x={tt.x} y={tt.y} onDismiss={() => setTooltip(null)}>
          <div className="font-bold">
            {tt.o.anno} · {gare.nome[tt.o.garaIdx]}
          </div>
          {tt.o.driverId !== null && <div className="mt-0.5">{nomiPiloti.get(tt.o.driverId) ?? ""}</div>}
          <div className="mt-1" style={{ color: tt.riga.colore }}>
            {tt.riga.esatto ? "tutti gli slot reggono" : `cambia: ${tt.riga.etichetta}`}
          </div>
          {onScegli && <div className="text-neutral-gray mt-1">Clic per la scheda gara →</div>}
        </ChartTooltip>
      )}
    </div>
  );
}
