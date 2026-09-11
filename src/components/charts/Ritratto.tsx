"use client";

// Il ritratto di un'occorrenza (Déjà vu v4, docs/PROGETTAZIONE-v4.md §7.5;
// roadmap D5.1): la posizione giro per giro di UN pilota in UNA gara, come
// small multiple. Scale condivise da tutti i ritratti (y = posizione 1..20,
// x = giro normalizzato 0-100% della gara) così i ritratti affiancati si
// confrontano a colpo d'occhio: stessa forma, stessa scala.
//
// I dati arrivano da /data/situazioni/tracce/<raceId>.json a richiesta
// (1996+). Per le gare senza tempi sul giro il ritratto è griglia → arrivo:
// due punti e un segmento tratteggiato, dichiarato in didascalia — non
// sappiamo cosa è successo in mezzo, e lo diciamo.
//
// D3 possiede l'SVG (scale, linea, area, data join in useEffect); React
// tiene il ref, lo stato del caricamento e il colore (lo slot che cambia,
// SLOT_COLORS: stesso colore del punto nella linea dei déjà vu).

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import Link from "next/link";
import { STORY_ACCENT_COLOR, TEXT_MUTED_COLOR } from "@/lib/colors";

export interface DatiRitratto {
  raceId: number;
  driverId: number | null;
  titolo: string; // "Monza 2020"
  sottotitolo?: string; // "Pierre Gasly · AlphaTauri"
  griglia: number | null;
  pitLane: boolean;
  arrivo: number | null; // null = non classificato
  statoTesto: string; // "arrivo 1°" / "ritirato al giro 12"
  giriGara: number | null;
  // true se la gara ha tempi sul giro (1996+): si prova a caricare la traccia
  haTracce: boolean;
  colore: string;
}

interface Props {
  dati: DatiRitratto;
  // Dove porta il ritratto: la scheda di quella gara. È un href e non un
  // gestore di click perché un <a> funziona anche PRIMA che React abbia
  // idratato la pagina — e questa pagina è pesante (tabelle, reticolo,
  // decine di grafici D3): chi clicca appena vede la griglia, con un
  // <button> non otteneva niente. In più si apre in una scheda nuova con
  // cmd/ctrl+clic, il browser mostra la destinazione in basso e il
  // puntatore diventa una mano.
  href?: string;
  onClick?: () => void;
  // cache condivisa delle tracce per gara, per non riscaricare lo stesso file
  cache?: Map<number, Promise<Traccia | null>>;
}

export interface Traccia {
  raceId: number;
  giri: number;
  piloti: number[];
  posizioni: (number | null)[][];
}

const W = 260;
const H = 84;
const PAD = { top: 6, right: 8, bottom: 14, left: 24 };
const POS_MAX = 20;

export function caricaTraccia(raceId: number, cache?: Map<number, Promise<Traccia | null>>): Promise<Traccia | null> {
  const hit = cache?.get(raceId);
  if (hit) return hit;
  const p = fetch(`/data/situazioni/tracce/${raceId}.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Traccia>) : null))
    .catch(() => null);
  cache?.set(raceId, p);
  return p;
}

export default function Ritratto({ dati, href, onClick, cache }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Lo stato porta la chiave (gara+pilota) a cui si riferisce: se non
  // combacia con quella corrente, si sta ancora caricando. Nessun setState
  // sincrono dentro l'effetto — solo nel callback della fetch.
  const chiave = `${dati.raceId}:${dati.driverId ?? ""}`;
  const [caricata, setCaricata] = useState<{ chiave: string; posizioni: (number | null)[] | null } | null>(null);
  const serveTraccia = dati.haTracce && dati.driverId !== null;
  const posizioni: (number | null)[] | null | "caricamento" = !serveTraccia
    ? null
    : caricata && caricata.chiave === chiave
      ? caricata.posizioni
      : "caricamento";

  useEffect(() => {
    if (!serveTraccia) return;
    let vivo = true;
    caricaTraccia(dati.raceId, cache).then((t) => {
      if (!vivo) return;
      const k = t ? t.piloti.indexOf(dati.driverId!) : -1;
      setCaricata({ chiave, posizioni: t && k >= 0 ? t.posizioni[k] : null });
    });
    return () => {
      vivo = false;
    };
  }, [dati.raceId, dati.driverId, serveTraccia, chiave, cache]);

  const y = useMemo(() => d3.scaleLinear().domain([1, POS_MAX]).range([PAD.top, H - PAD.bottom]).clamp(true), []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (svg.select(".griglia-y").empty()) {
      svg.append("g").attr("class", "griglia-y");
      svg.append("path").attr("class", "area");
      svg.append("path").attr("class", "linea");
      svg.append("g").attr("class", "estremi");
      svg.append("text").attr("class", "nota");
    }
    // riferimenti P1, P10, P20 condivisi
    svg
      .select<SVGGElement>(".griglia-y")
      .selectAll<SVGGElement, number>("g.rif")
      .data([1, 10, 20])
      .join((enter) => {
        const g = enter.append("g").attr("class", "rif");
        g.append("line");
        g.append("text");
        return g;
      })
      .call((g) => g.select("line").attr("x1", PAD.left).attr("x2", W - PAD.right).attr("y1", (d) => y(d)).attr("y2", (d) => y(d)).attr("stroke", "rgba(255,255,255,0.08)"))
      .call((g) =>
        g
          .select("text")
          .attr("x", PAD.left - 4)
          .attr("y", (d) => y(d) + 3.5)
          .attr("text-anchor", "end")
          .attr("font-size", 9)
          .attr("fill", TEXT_MUTED_COLOR)
          .text((d) => `P${d}`)
      );

    const col = dati.colore;
    const nota = svg.select<SVGTextElement>("text.nota").attr("x", (PAD.left + W - PAD.right) / 2).attr("y", H - 3).attr("text-anchor", "middle").attr("font-size", 9).attr("fill", TEXT_MUTED_COLOR);

    if (posizioni === "caricamento") {
      svg.select("path.area").attr("d", null);
      svg.select("path.linea").attr("d", null);
      svg.select(".estremi").selectAll("*").remove();
      nota.text("carico i tempi sul giro…");
      return;
    }

    if (posizioni === null) {
      // griglia → arrivo, tratteggiato: prima del 1996 (o senza traccia)
      svg.select("path.area").attr("d", null);
      const x0 = PAD.left;
      const x1 = W - PAD.right;
      const yA = dati.griglia !== null ? y(dati.griglia) : dati.pitLane ? y(POS_MAX) : null;
      const yB = dati.arrivo !== null ? y(dati.arrivo) : y(POS_MAX);
      svg
        .select("path.linea")
        .attr("d", yA === null ? null : `M${x0},${yA}L${x1},${yB}`)
        .attr("fill", "none")
        .attr("stroke", col)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4 4");
      const estremi = [
        yA !== null ? { cx: x0, cy: yA, c: col } : null,
        { cx: x1, cy: yB, c: dati.arrivo === 1 ? STORY_ACCENT_COLOR : col },
      ].filter((d): d is { cx: number; cy: number; c: string } => d !== null);
      svg
        .select<SVGGElement>(".estremi")
        .selectAll<SVGCircleElement, (typeof estremi)[number]>("circle")
        .data(estremi)
        .join("circle")
        .attr("cx", (d) => d.cx)
        .attr("cy", (d) => d.cy)
        .attr("r", 4)
        .attr("fill", (d) => d.c);
      nota.text(dati.haTracce ? "traccia non disponibile: solo griglia → arrivo" : "prima del 1996: solo griglia → arrivo");
      return;
    }

    const n = posizioni.length;
    const x = d3.scaleLinear().domain([0, Math.max(1, n - 1)]).range([PAD.left, W - PAD.right]);
    const punti = posizioni.map((p, i) => ({ i, p })).filter((d): d is { i: number; p: number } => d.p !== null);
    const linea = d3
      .line<{ i: number; p: number }>()
      .x((d) => x(d.i))
      .y((d) => y(d.p))
      .curve(d3.curveStepAfter);
    const area = d3
      .area<{ i: number; p: number }>()
      .x((d) => x(d.i))
      .y0(y(POS_MAX))
      .y1((d) => y(d.p))
      .curve(d3.curveStepAfter);
    svg.select("path.area").attr("d", area(punti)).attr("fill", col).attr("fill-opacity", 0.12);
    svg.select("path.linea").attr("d", linea(punti)).attr("fill", "none").attr("stroke", col).attr("stroke-width", 1.8).attr("stroke-dasharray", null);
    const primo = punti[0];
    const ultimo = punti[punti.length - 1];
    const estremi = [
      dati.griglia !== null ? { cx: PAD.left, cy: y(dati.griglia), c: col, r: 3 } : null,
      primo ? null : null,
      ultimo ? { cx: x(ultimo.i), cy: y(ultimo.p), c: dati.arrivo === 1 ? STORY_ACCENT_COLOR : col, r: 4 } : null,
    ].filter((d): d is { cx: number; cy: number; c: string; r: number } => d !== null);
    svg
      .select<SVGGElement>(".estremi")
      .selectAll<SVGCircleElement, (typeof estremi)[number]>("circle")
      .data(estremi)
      .join("circle")
      .attr("cx", (d) => d.cx)
      .attr("cy", (d) => d.cy)
      .attr("r", (d) => d.r)
      .attr("fill", (d) => d.c);
    const giriFatti = punti.length;
    nota.text(giriFatti < n ? `ritirato dopo ${giriFatti} giri su ${n}` : `${n} giri`);
  }, [posizioni, dati, y]);

  const classi =
    "text-left bg-panel border border-graphite border-l-[3px] px-3 py-2.5 flex flex-col gap-1 w-full no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white hover:border-neutral-gray transition-colors" +
    (href || onClick ? " cursor-pointer" : "");
  const dentro = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-condensed text-lg font-bold text-white leading-tight">{dati.titolo}</span>
        {dati.giriGara !== null && <span className="text-[11px] text-neutral-gray">{dati.giriGara} giri</span>}
      </div>
      {dati.sottotitolo && <div className="text-xs text-white/85">{dati.sottotitolo}</div>}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Posizione giro per giro: ${dati.titolo}, ${dati.statoTesto}`} />
      <div className="flex justify-between text-[11px] text-neutral-gray">
        <span>
          griglia <b className="text-white font-medium">{dati.griglia !== null ? `${dati.griglia}°` : dati.pitLane ? "pit lane" : "?"}</b>
        </span>
        <span>{dati.statoTesto}</span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classi} style={{ borderLeftColor: dati.colore }}>
        {dentro}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classi} style={{ borderLeftColor: dati.colore }}>
        {dentro}
      </button>
    );
  }
  return (
    <div className={classi} style={{ borderLeftColor: dati.colore }}>
      {dentro}
    </div>
  );
}
