// La situazione nell'URL (Déjà vu v4, roadmap D6.1): `/?s=<...>` così una
// domanda si può condividere, tornare indietro col browser, e la scheda
// gara può linkare "cerca questo fatto". Codifica leggibile, non un blob:
//   chi=p1 | chi=t6 · cosa=vince,parte_o_peggio:10 · dove=c:monza | dove=n:Italy · quando=a:2020 | d:1970 | e:2006-2013
// Niente di quello che c'è qui è dato personale: sono id pubblici di
// piloti, team, circuiti.

import type { Situazione } from "./motore";
import { FATTI_BY_ID } from "./fatti";

export function situazioneToParams(s: Situazione): URLSearchParams {
  const p = new URLSearchParams();
  if (s.chi) p.set("chi", s.chi.tipo === "pilota" ? `p${s.chi.driverId}` : `t${s.chi.constructorId}`);
  if (s.cosa.length) p.set("cosa", s.cosa.map((c) => (c.parametro !== undefined ? `${c.id}:${c.parametro}` : c.id)).join(","));
  if (s.dove) p.set("dove", s.dove.tipo === "circuito" ? `c:${s.dove.circuitRef}` : `n:${s.dove.paese}`);
  if (s.quando) {
    if (s.quando.tipo === "anno") p.set("quando", `a:${s.quando.anno}`);
    else if (s.quando.tipo === "decennio") p.set("quando", `d:${s.quando.annoDa}`);
    else p.set("quando", `e:${s.quando.annoDa}-${s.quando.annoA}`);
  }
  return p;
}

export function situazioneFromParams(p: URLSearchParams): Situazione | null {
  const cosaRaw = p.get("cosa");
  if (!cosaRaw) return null;
  const cosa = cosaRaw
    .split(",")
    .map((t) => {
      const [id, par] = t.split(":");
      if (!FATTI_BY_ID.has(id)) return null;
      const n = par !== undefined ? Number(par) : undefined;
      return { id, parametro: n !== undefined && !Number.isNaN(n) ? n : undefined };
    })
    .filter((c): c is { id: string; parametro: number | undefined } => c !== null);
  if (cosa.length === 0) return null;
  const s: Situazione = { cosa };
  const chi = p.get("chi");
  if (chi) {
    const n = Number(chi.slice(1));
    if (!Number.isNaN(n)) s.chi = chi[0] === "p" ? { tipo: "pilota", driverId: n } : { tipo: "team", constructorId: n };
  }
  const dove = p.get("dove");
  if (dove) {
    const [tipo, ...rest] = dove.split(":");
    const v = rest.join(":");
    if (v) s.dove = tipo === "c" ? { tipo: "circuito", circuitRef: v } : { tipo: "paese", paese: v };
  }
  const quando = p.get("quando");
  if (quando) {
    const [tipo, v] = quando.split(":");
    if (tipo === "a" && !Number.isNaN(Number(v))) s.quando = { tipo: "anno", anno: Number(v) };
    else if (tipo === "d" && !Number.isNaN(Number(v))) s.quando = { tipo: "decennio", annoDa: Number(v) };
    else if (tipo === "e") {
      const [da, a] = v.split("-").map(Number);
      if (!Number.isNaN(da) && !Number.isNaN(a)) s.quando = { tipo: "era", annoDa: da, annoA: a };
    }
  }
  return s;
}
