// L'indice normalizzato delle occorrenze per il compositore di scenari
// (roadmap S, docs/ROADMAP-6.md, fase S1.1). A differenza di
// familyTimeline.ts — funzione pura che riceve dati già estratti da una
// pagina server — questo modulo fa lui stesso la lettura dei 33 file
// public/data/events/<eventId>.json: nessuna pagina esistente legge oggi
// tutte le occorrenzeDettaglio per un altro scopo, quindi non c'è un
// "chiamante naturale" da cui estrarre i dati a monte. Il modulo incapsula
// la lettura fs e mette il risultato in cache a livello di modulo
// (`cached`): sui 33 file (~1,6 MB, S0.1) viene letto e normalizzato una
// sola volta per processo server, poi riusato — non ha senso rileggerlo a
// ogni richiesta in un dataset che non cambia mai a runtime.

import fs from "fs";
import path from "path";
import type { EventUnit } from "./eventCatalog";

const EVENTS_DIR = path.join(process.cwd(), "public", "data", "events");
const RACES_INDEX_PATH = path.join(process.cwd(), "public", "data", "races-index.json");

// Quando un soggetto manca dal payload, "assente" (undefined) e "vuoto" ([])
// vogliono dire due cose diverse, e sbagliarle produce una bugia silenziosa:
// un chip "pilota" su un dato assente darebbe "non regge" quando la verità è
// "non lo so".
//
// La regola NON è "solo ritiro_per_causa_specifica è troncato" (era la prima
// versione di questo file, ed era sbagliata): è l'UNITÀ dell'evento a dire
// quali soggetti devono esistere. Un evento RISULTATO riguarda un pilota di
// una scuderia — se il payload non li porta, il dato è perso, non assente per
// natura. Un evento GARA riguarda la gara intera: lì l'assenza è genuina.
//
// Verificato sui dati il 1 set 2026, i casi reali sono più dei previsti in
// S0.1, che aveva visto solo il troncamento a 300 KB:
//   - pilota perso: rimonta_almeno_n_posizioni (1990), pilota_con_almeno_n_soste
//     (550), causa_non_vista_da_anni (86), vincitore_con_almeno_n_soste (85)
//     — tutti RISULTATO con occorrenze prive di driverId.
//   - team perso: i 4 sopra, più ritiro_per_causa_specifica (6514, il
//     troncamento di scripts/build_events.py:135-149) e i 4 eventi di pit stop
//     ereditati dalla pipeline v2 (pilota_fregato, pit_double_stack,
//     pit_sotto_neutralizzazione, pilota_locked_out), che hanno il pilota ma
//     mai il constructorId.
// In totale 2.711 occorrenze senza pilota e 10.249 senza team, su 17.208.
const UNITA_CON_PILOTA: EventUnit[] = ["RISULTATO", "TEAM_GARA"];
const UNITA_CON_TEAM: EventUnit[] = ["RISULTATO", "TEAM_GARA"];

interface RaceIndexEntry {
  raceId: number;
  anno: number;
  circuitRef: string;
}

interface EventFileParametro {
  parametri: Record<string, number | string>;
  occorrenze: number;
  denominatore: number;
  rarita: number;
  ultimaOccorrenza: string;
  occorrenzeDettaglio: Record<string, unknown>[];
}

interface EventFile {
  eventId: string;
  nome: string;
  famiglia: string;
  unita: EventUnit;
  annoDa: number;
  annoA: number;
  pesoEditoriale: number;
  parametriDisponibili: Record<string, (number | string)[]>;
  perParametro: EventFileParametro[];
}

// Una riga per occorrenza passata: la forma "NormalizedOccurrence + eventId/
// parametri/famiglia/unita" concordata in S0.1.
export interface ScenarioIndexEntry {
  eventId: string;
  parametri: Record<string, number | string>;
  famiglia: string;
  unita: EventUnit;
  raceId: number;
  anno: number;
  circuitRef: string;
  // undefined = dato perso, quindi "non valutabile" per il motore di match
  // (S1.2); [] = l'evento genuinamente non ha quel soggetto (una gara senza
  // ritiri non ha "un pilota"). Mai confondere i due.
  driverIds: number[] | undefined;
  constructorIds: number[] | undefined;
  raw: Record<string, unknown>;
}

// Un riepilogo per (eventId, parametri): i numeri già precalcolati dalla
// pipeline, riletti qui senza ricalcolo — servono al motore di match (S1.2)
// per il caso "un solo chip, niente che restringa" (S0.1, denominatore
// caso 1) e al controllo di coerenza sotto.
export interface EventParamMeta {
  eventId: string;
  nome: string;
  famiglia: string;
  unita: EventUnit;
  parametri: Record<string, number | string>;
  annoDa: number;
  annoA: number;
  occorrenze: number;
  denominatore: number;
  rarita: number;
  ultimaOccorrenza: string;
  pesoEditoriale: number;
}

export interface ScenarioIndex {
  entries: ScenarioIndexEntry[];
  meta: EventParamMeta[];
}

function loadRacesById(): Map<number, RaceIndexEntry> {
  const races: RaceIndexEntry[] = JSON.parse(fs.readFileSync(RACES_INDEX_PATH, "utf-8"));
  return new Map(races.map((r) => [r.raceId, r]));
}

// La forma di occorrenzeDettaglio dipende dal payload, non da "unita"
// (S0.1): singolo Result (driverId/constructorId), coppia (driverId1/
// driverId2/constructorId1/constructorId2), lista (driverIds/
// constructorIds), o payload numerico puro senza alcun pilota.
function extractSubjects(
  raw: Record<string, unknown>,
  unita: EventUnit
): { driverIds: number[] | undefined; constructorIds: number[] | undefined } {
  // I singoli sono quasi ovunque number, ma negli eventi di pit stop ereditati
  // dalla pipeline v2 (pilota_fregato, pit_double_stack,
  // pit_sotto_neutralizzazione, pilota_locked_out) driverId è una stringa
  // numerica ("832"): stessa forma di payload, tipo diverso. Un controllo
  // `typeof === "number"` li faceva finire in silenzio nel ramo "nessun
  // soggetto" — normalizzare a Number() e basta.
  const idSingolo = (v: unknown): number | null =>
    typeof v === "number" || typeof v === "string" ? Number(v) : null;

  const driverIds = ((): number[] | null => {
    if (Array.isArray(raw.driverIds)) return (raw.driverIds as (number | string)[]).map(Number);
    const d1 = idSingolo(raw.driverId1);
    const d2 = idSingolo(raw.driverId2);
    if (d1 !== null && d2 !== null) return [d1, d2];
    const d = idSingolo(raw.driverId);
    return d !== null ? [d] : null;
  })();

  const constructorIds = ((): number[] | null => {
    if (Array.isArray(raw.constructorIds)) return (raw.constructorIds as (number | string)[]).map(Number);
    const c1 = idSingolo(raw.constructorId1);
    const c2 = idSingolo(raw.constructorId2);
    if (c1 !== null && c2 !== null) return [c1, c2];
    const c = idSingolo(raw.constructorId);
    return c !== null ? [c] : null;
  })();

  // Il payload non porta il soggetto: è "perso" (undefined) se l'unità
  // dell'evento lo implica, "genuinamente assente" ([]) altrimenti.
  return {
    driverIds: driverIds ?? (UNITA_CON_PILOTA.includes(unita) ? undefined : []),
    constructorIds: constructorIds ?? (UNITA_CON_TEAM.includes(unita) ? undefined : []),
  };
}

function resolveAnnoCircuito(
  raw: Record<string, unknown>,
  raceId: number,
  racesById: Map<number, RaceIndexEntry>
): { anno: number; circuitRef: string } {
  if (typeof raw.anno === "number" && typeof raw.circuitRef === "string") {
    return { anno: raw.anno, circuitRef: raw.circuitRef };
  }
  const race = racesById.get(raceId);
  if (!race) {
    throw new Error(`scenarioIndex: raceId ${raceId} assente da races-index.json (occorrenza troncata non risolvibile)`);
  }
  return { anno: race.anno, circuitRef: race.circuitRef };
}

function normalizeEventFile(
  file: EventFile,
  racesById: Map<number, RaceIndexEntry>
): { entries: ScenarioIndexEntry[]; meta: EventParamMeta[] } {
  const entries: ScenarioIndexEntry[] = [];
  const meta: EventParamMeta[] = [];

  for (const pp of file.perParametro) {
    meta.push({
      eventId: file.eventId,
      nome: file.nome,
      famiglia: file.famiglia,
      unita: file.unita,
      parametri: pp.parametri,
      annoDa: file.annoDa,
      annoA: file.annoA,
      occorrenze: pp.occorrenze,
      denominatore: pp.denominatore,
      rarita: pp.rarita,
      ultimaOccorrenza: pp.ultimaOccorrenza,
      pesoEditoriale: file.pesoEditoriale,
    });

    for (const raw of pp.occorrenzeDettaglio) {
      const raceId = raw.raceId as number;
      const { anno, circuitRef } = resolveAnnoCircuito(raw, raceId, racesById);
      const { driverIds, constructorIds } = extractSubjects(raw, file.unita);

      entries.push({
        eventId: file.eventId,
        parametri: pp.parametri,
        famiglia: file.famiglia,
        unita: file.unita,
        raceId,
        anno,
        circuitRef,
        driverIds,
        constructorIds,
        raw,
      });
    }
  }

  return { entries, meta };
}

let cached: ScenarioIndex | null = null;

export function buildScenarioIndex(): ScenarioIndex {
  if (cached) return cached;

  const racesById = loadRacesById();
  const fileNames = fs
    .readdirSync(EVENTS_DIR)
    .filter((name) => name.endsWith(".json") && name !== "index.json");

  const entries: ScenarioIndexEntry[] = [];
  const meta: EventParamMeta[] = [];

  for (const fileName of fileNames) {
    const file: EventFile = JSON.parse(fs.readFileSync(path.join(EVENTS_DIR, fileName), "utf-8"));
    const normalized = normalizeEventFile(file, racesById);
    entries.push(...normalized.entries);
    meta.push(...normalized.meta);
  }

  cached = { entries, meta };
  return cached;
}
