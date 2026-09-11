// Lo slug della scheda gara, /gara/<anno>-<circuitRef>, con "-r<round>" per
// le gare che condividono anno e circuito (le 4 coppie 2020/2021 del
// calendario Covid). Stesso algoritmo di buildSlugByRaceId in
// src/app/gara/[raceSlug]/page.tsx, calcolato qui sulla tabella `Gare`
// delle situazioni (ordinata per anno e round: stesso ordine cronologico).

import type { Gare } from "./tabelle";

export function slugPerGara(g: Gare): Map<number, string> {
  const idx = Array.from({ length: g.righe }, (_, i) => i).sort((a, b) => g.anno[a] - g.anno[b] || g.round[a] - g.round[b]);
  const usati = new Set<string>();
  const out = new Map<number, string>();
  for (const i of idx) {
    const base = `${g.anno[i]}-${g.circuitRef[i]}`;
    const slug = usati.has(base) ? `${base}-r${g.round[i]}` : base;
    usati.add(base);
    out.set(g.raceId[i], slug);
  }
  return out;
}
