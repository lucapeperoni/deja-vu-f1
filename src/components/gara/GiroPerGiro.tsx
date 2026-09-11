"use client";

// Il grafico della gara: la posizione di ogni pilota, giro per giro (roadmap
// D7.7). È il racconto che una tabella non può dare — dove è cambiata la
// testa, chi ha rimontato, chi è sparito al giro 3.
//
// Stessi dati dei ritratti della home (`/data/situazioni/tracce/<raceId>.json`,
// 544 gare dal 1996), qui a piena grandezza e per tutti i piloti insieme.
//
// D3 possiede l'SVG (scale, linee, assi); React tiene il ref, il caricamento
// e quale pilota è sotto il mouse. Le linee sono tutte grigie tranne il
// podio e quella puntata: con venti linee colorate non si legge niente, ed è
// la stessa regola del resto del sito (una cosa alla volta in evidenza).

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { DEFAULT_LINE_COLOR, HIGHLIGHT_COLOR, STORY_ACCENT_COLOR, TEXT_MUTED_COLOR } from "@/lib/colors";
import { caricaTraccia, type Traccia } from "@/components/charts/Ritratto";

export interface PilotaTraccia {
  driverId: number;
  nome: string;
  codice: string | null;
  arrivo: number | null;
}

interface Props {
  raceId: number;
  giriGara: number | null;
  piloti: PilotaTraccia[];
}

const W = 1000;
const H = 420;
const PAD = { top: 16, right: 150, bottom: 34, left: 46 };
// il colore del podio: oro/argento/bronzo no (tre gialli non si distinguono
// sul nero), si usa l'accento del sito per il vincitore e due grigi chiari
const COLORI_PODIO = [STORY_ACCENT_COLOR, HIGHLIGHT_COLOR, "#9aa4b2"];

export default function GiroPerGiro({ raceId, giriGara, piloti }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [traccia, setTraccia] = useState<Traccia | null | "errore">(null);
  const [sotto, setSotto] = useState<number | null>(null);

  const perId = useMemo(() => new Map(piloti.map((p) => [p.driverId, p])), [piloti]);

  useEffect(() => {
    let vivo = true;
    caricaTraccia(raceId).then((t) => {
      if (vivo) setTraccia(t ?? "errore");
    });
    return () => {
      vivo = false;
    };
  }, [raceId]);

  useEffect(() => {
    if (!traccia || traccia === "errore") return;
    const svg = d3.select(svgRef.current);
    const giri = traccia.giri || giriGara || 1;
    const maxPos = Math.max(
      3,
      d3.max(traccia.posizioni.flat().filter((v): v is number => v !== null)) ?? 20
    );
    const x = d3.scaleLinear().domain([1, giri]).range([PAD.left, W - PAD.right]);
    const y = d3.scaleLinear().domain([1, maxPos]).range([PAD.top, H - PAD.bottom]);

    for (const cls of ["assi", "linee", "etichette"]) {
      if (svg.select(`.${cls}`).empty()) svg.append("g").attr("class", cls);
    }

    // assi: i giri sotto, le posizioni a sinistra (1 in alto: la prima
    // posizione sta in cima, come in classifica)
    const assi = svg.select<SVGGElement>(".assi");
    assi.selectAll("*").remove();
    const tickPos = [1, 5, 10, 15, 20].filter((p) => p <= maxPos);
    assi
      .selectAll("text.pos")
      .data(tickPos)
      .join("text")
      .attr("class", "pos")
      .attr("x", PAD.left - 10)
      .attr("y", (d) => y(d))
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .attr("fill", TEXT_MUTED_COLOR)
      .attr("font-size", 11)
      .text((d) => `P${d}`);
    assi
      .selectAll("line.griglia")
      .data(tickPos)
      .join("line")
      .attr("class", "griglia")
      .attr("x1", PAD.left)
      .attr("x2", W - PAD.right)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "#22262b");
    const tickGiri = x.ticks(Math.min(10, giri)).filter((v) => Number.isInteger(v) && v >= 1);
    assi
      .selectAll("text.giro")
      .data(tickGiri)
      .join("text")
      .attr("class", "giro")
      .attr("x", (d) => x(d))
      .attr("y", H - PAD.bottom + 18)
      .attr("text-anchor", "middle")
      .attr("fill", TEXT_MUTED_COLOR)
      .attr("font-size", 11)
      .text((d) => `${d}`);
    assi
      .append("text")
      .attr("x", (PAD.left + W - PAD.right) / 2)
      .attr("y", H - 4)
      .attr("text-anchor", "middle")
      .attr("fill", TEXT_MUTED_COLOR)
      .attr("font-size", 11)
      .text("giro");

    const linea = d3
      .line<{ l: number; p: number | null }>()
      .defined((d) => d.p !== null)
      .x((d) => x(d.l))
      .y((d) => y(d.p as number))
      .curve(d3.curveStepAfter);

    interface Serie {
      driverId: number;
      punti: { l: number; p: number | null }[];
      colore: string;
      spessore: number;
      opacita: number;
      ultimo: { l: number; p: number } | null;
      nome: string;
    }

    const serie: Serie[] = traccia.piloti.map((id, k) => {
      const p = perId.get(id);
      const punti = traccia.posizioni[k].map((pos, j) => ({ l: j + 1, p: pos }));
      const validi = punti.filter((d): d is { l: number; p: number } => d.p !== null);
      const rank = p?.arrivo ?? null;
      const inPodio = rank !== null && rank <= 3;
      const puntato = sotto === id;
      return {
        driverId: id,
        punti,
        colore: puntato ? HIGHLIGHT_COLOR : inPodio ? COLORI_PODIO[rank - 1] : DEFAULT_LINE_COLOR,
        spessore: puntato ? 3 : inPodio ? 2.2 : 1.2,
        opacita: puntato || inPodio ? 1 : sotto !== null ? 0.25 : 0.55,
        ultimo: validi.length ? validi[validi.length - 1] : null,
        nome: p?.codice ?? p?.nome ?? `#${id}`,
      };
    });
    // il puntato si disegna per ultimo, così passa sopra le altre linee
    serie.sort((a, b) => a.spessore - b.spessore);

    svg
      .select<SVGGElement>(".linee")
      .selectAll<SVGPathElement, Serie>("path.traccia")
      .data(serie, (d) => d.driverId)
      .join("path")
      .attr("class", "traccia")
      .attr("fill", "none")
      .attr("stroke-linejoin", "round")
      .attr("d", (d) => linea(d.punti))
      .attr("stroke", (d) => d.colore)
      .attr("stroke-width", (d) => d.spessore)
      .attr("opacity", (d) => d.opacita)
      .style("cursor", "pointer")
      .on("pointerenter", (_e, d) => setSotto(d.driverId))
      .on("pointerleave", () => setSotto(null));

    // Il nome dove la linea finisce: sostituisce una legenda, che
    // costringerebbe a saltare avanti e indietro con gli occhi. Le linee che
    // finiscono vicine (due ritiri allo stesso giro, o due piloti a fine gara
    // in posizioni consecutive) porterebbero i nomi uno sopra l'altro: si
    // scorrono dall'alto e chi si sovrappone a un vicino di colonna scende
    // quel tanto che basta a restare leggibile.
    const etichette = serie
      .filter((d) => d.ultimo !== null)
      .map((d) => ({ serie: d, ex: x(d.ultimo!.l) + 8, ey: y(d.ultimo!.p) }))
      .sort((a, b) => a.ey - b.ey);
    for (let k = 1; k < etichette.length; k++) {
      const e = etichette[k];
      for (let j = 0; j < k; j++) {
        const p = etichette[j];
        if (Math.abs(p.ex - e.ex) < 34 && e.ey - p.ey < 11) e.ey = p.ey + 11;
      }
    }

    svg
      .select<SVGGElement>(".etichette")
      .selectAll<SVGTextElement, (typeof etichette)[number]>("text.nome")
      .data(etichette, (d) => d.serie.driverId)
      .join("text")
      .attr("class", "nome")
      .attr("x", (d) => d.ex)
      .attr("y", (d) => d.ey)
      .attr("dy", "0.32em")
      .attr("font-size", 11)
      .attr("fill", (d) => d.serie.colore)
      .attr("opacity", (d) => (d.serie.opacita < 0.5 ? 0.5 : 1))
      .style("cursor", "pointer")
      .text((d) => d.serie.nome)
      .on("pointerenter", (_e, d) => setSotto(d.serie.driverId))
      .on("pointerleave", () => setSotto(null));
  }, [traccia, giriGara, perId, sotto]);

  if (traccia === "errore") {
    return <p className="text-sm text-neutral-gray italic">Per questa gara non abbiamo la posizione giro per giro.</p>;
  }
  if (!traccia) {
    return <p className="text-sm text-neutral-gray italic">Carico la gara giro per giro…</p>;
  }
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Posizione giro per giro di tutti i piloti, ${traccia.giri} giri. Il podio è in evidenza.`}
    />
  );
}
