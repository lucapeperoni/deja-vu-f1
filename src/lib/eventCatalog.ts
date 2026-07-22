// Tipo e helper condivisi del catalogo eventi (v3, docs/PROGETTAZIONE.md,
// sezione 6-7): un'unica definizione, riusata da ogni vista che legge
// public/data/events/index.json o public/data/events/<eventId>.json.
// Il frontend non sa nulla di come si calcola un evento (sezione 5.1) —
// legge solo questi campi già precalcolati dalla pipeline
// (data-layer/scripts/build_events.py).

import { PIT_CONTEXT_LABELS } from "./colors";

export type EventUnit = "GARA" | "RISULTATO" | "TEAM_GARA";

export interface CatalogEventEntry {
  eventId: string;
  nome: string;
  famiglia: string;
  unita: EventUnit;
  descrizione: string;
  parametri: Record<string, number | string>;
  parametriDisponibili: Record<string, (number | string)[]>;
  campi: string[];
  annoDa: number;
  annoA: number;
  occorrenze: number;
  denominatore: number;
  rarita: number;
  siccitaGareCorrente: number;
  siccitaAnniCorrente: number;
  ultimaOccorrenza: string;
  pesoEditoriale: number;
}

// Occorrenze per circuito di un evento (vista 4, sezione 5.3: "occorrenze
// per circuito e tasso per gara ospitata"). lat/lng sono null quando il
// circuito non è in public/data/circuits-geo.json (non dovrebbe succedere
// per i circuiti reali, ma il dato viene da un export a parte — vedi
// data-layer/scripts/build_circuits_geo.py — quindi il caso va gestito).
export interface CircuitStat {
  circuitRef: string;
  nome: string;
  occorrenze: number;
  gareOspitate: number;
  tasso: number;
  lat: number | null;
  lng: number | null;
}

// Coordinate di un circuito, indipendenti da un evento specifico: usate
// come livello di contesto ("tutti i 77 circuiti") sotto ai CircuitStat di
// un singolo evento nella vista 4.
export interface CircuitGeo {
  circuitRef: string;
  lat: number;
  lng: number;
}

// Etichette dell'unità di osservazione (sezione 5.1: gara / risultato
// pilota×gara / coppia team×gara), usate ovunque si mostri il denominatore
// della rarità — mai "volte" e basta, sempre "volte su cosa".
export const UNIT_LABELS: Record<EventUnit, string> = {
  GARA: "gare",
  RISULTATO: "risultati pilota×gara",
  TEAM_GARA: "coppie team×gara",
};

export function unitLabel(unita: string): string {
  return UNIT_LABELS[unita as EventUnit] ?? unita;
}

// Un evento con parametro (soglia N) compare più volte nel catalogo, una
// per valore precalcolato (sezione 6: "griglia di valori dichiarata nel
// catalogo"). Le viste che mostrano UN segno per evento (vista 1, la scala
// della rarità) tengono solo la prima configurazione dichiarata — il
// parametro di default del catalogo — non tutte: il confronto tra eventi è
// già abbastanza carico senza sdoppiare quelli parametrici in più righe.
export function dedupeToDefaultParams(entries: CatalogEventEntry[]): CatalogEventEntry[] {
  const seen = new Set<string>();
  const result: CatalogEventEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.eventId)) continue;
    seen.add(entry.eventId);
    result.push(entry);
  }
  return result;
}

// Etichetta leggibile di un valore di parametro: per "contesto" (famiglia
// neutralizzazioni) riusa le etichette PIT_CONTEXT_LABELS già validate
// invece del codice grezzo ("UNDER_SC" -> "Sotto Safety Car") — fissato qui
// perché il compositore (vista 2) e la scheda gara (vista 6) devono
// mostrare la STESSA etichetta per lo stesso parametro.
export function formatParameterValue(key: string, value: number | string): string {
  if (key === "contesto") return PIT_CONTEXT_LABELS[value as keyof typeof PIT_CONTEXT_LABELS] ?? String(value);
  return String(value);
}

// Etichetta del parametro corrente, se l'evento ne ha uno (es. "N=10",
// "causa=5"): compare accanto al nome nell'etichetta e nel tooltip, perché
// "vittoria da griglia" senza soglia è un nome ambiguo.
export function parameterSuffix(entry: Pick<CatalogEventEntry, "parametri">): string {
  const keys = Object.keys(entry.parametri);
  if (keys.length === 0) return "";
  return ` (${keys.map((k) => `${k}=${formatParameterValue(k, entry.parametri[k])}`).join(", ")})`;
}

export function formatWindow(entry: Pick<CatalogEventEntry, "annoDa" | "annoA">): string {
  return entry.annoDa === entry.annoA ? `${entry.annoDa}` : `${entry.annoDa}–${entry.annoA}`;
}

export function formatRarityPercent(rarita: number): string {
  const pct = rarita * 100;
  return pct >= 1 ? `${pct.toFixed(1)}%` : `${pct.toFixed(2)}%`;
}

// "La risposta grande" del compositore (sezione 7, vista 2: "40 volte su
// 1125 gare (3,6%)"), fissata qui perché è la stessa frase che il tooltip
// (sotto) e la scheda gara futura (vista 6) dovranno riusare parola per
// parola — un solo posto dove cambiare il formato, non uno per vista.
export function formatBigAnswer(entry: Pick<CatalogEventEntry, "occorrenze" | "denominatore" | "unita" | "rarita">): string {
  return `${entry.occorrenze} volte su ${entry.denominatore} ${unitLabel(entry.unita)} (${formatRarityPercent(
    entry.rarita
  )})`;
}

// La siccità (sezione 5.3: "non succedeva dal ..."), o null se l'evento è
// così frequente da non avere una siccità corrente degna di nota (successo
// nell'ultima unità osservata).
export function formatDrought(
  entry: Pick<CatalogEventEntry, "siccitaGareCorrente" | "siccitaAnniCorrente">
): string | null {
  if (entry.siccitaGareCorrente <= 0) return null;
  return entry.siccitaAnniCorrente > 0
    ? `Non succede da ${entry.siccitaGareCorrente} gare (${entry.siccitaAnniCorrente} anni)`
    : `Non succede da ${entry.siccitaGareCorrente} gare`;
}

// Formato del tooltip fissato qui per tutte le viste successive (sezione 7,
// nota dell'incarico): mostra SEMPRE la finestra di copertura insieme al
// numero, mai il numero da solo — è la regola vincolante di sezione 5.2
// applicata al componente condiviso, non solo alla vista 1.
export function eventTooltipLines(entry: CatalogEventEntry): string[] {
  const lines = [
    `${entry.nome}${parameterSuffix(entry)}`,
    formatBigAnswer(entry),
    `Finestra: ${formatWindow(entry)}`,
  ];
  const drought = formatDrought(entry);
  if (drought) lines.push(drought);
  if (entry.ultimaOccorrenza) lines.push(`Ultima volta: ${entry.ultimaOccorrenza}`);
  return lines;
}
