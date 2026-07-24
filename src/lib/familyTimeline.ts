// Aggregazione "famiglia x anno" per la vista Nel tempo (roadmap T2.1,
// docs/ROADMAP-5.md). Funzione pura, nessun fs: riceve già estratto, per
// ogni evento (parametro di default), famiglia e perStagione — chi la chiama
// (una pagina server) fa la lettura dei 33 file public/data/events/<eventId>.json.
//
// Zero-filled per anno/famiglia: ogni punto ha SEMPRE tutte le 9 famiglie,
// anche a 0, così d3.stack (in FamilyStream.tsx) non trova mai una chiave
// mancante — un buco nei dati diventerebbe un salto nella fascia impilata,
// non un valore assente.

import { FAMILY_LEGEND } from "./colors";
import type { FamilyTimelinePoint } from "@/components/charts/FamilyStream";

const YEAR_FROM = 1950;
const YEAR_TO = 2024;

export interface FamilyYearSource {
  famiglia: string;
  perStagione: Record<string, number>;
}

export function buildFamilyTimeline(sources: FamilyYearSource[]): FamilyTimelinePoint[] {
  const familyKeys = FAMILY_LEGEND.map((f) => f.key);

  const pointByYear = new Map<number, FamilyTimelinePoint>();
  for (let anno = YEAR_FROM; anno <= YEAR_TO; anno++) {
    const point = { anno } as FamilyTimelinePoint;
    for (const key of familyKeys) point[key] = 0;
    pointByYear.set(anno, point);
  }

  for (const source of sources) {
    for (const [yearStr, count] of Object.entries(source.perStagione)) {
      const anno = Number(yearStr);
      const point = pointByYear.get(anno);
      if (!point) continue; // fuori da 1950-2024: non dovrebbe succedere, ignorato invece di rompere il grafico
      point[source.famiglia] = (point[source.famiglia] ?? 0) + count;
    }
  }

  return [...pointByYear.values()].sort((a, b) => a.anno - b.anno);
}
