// Il motore di match a cascata del compositore di scenari (roadmap S, fase
// S1.2, docs/ROADMAP-6.md). Sopra l'indice normalizzato di S1.1
// (scenarioIndex.ts): funzione pura sull'indice già costruito, più due file
// che S1.1 non leggeva ancora — races-index.json e results-plane.json,
// serve solo qui per il denominatore composto (S0.1).
//
// L'algoritmo in una frase: il "pool" di occorrenze candidate è l'unione
// delle occorrenze proprie di ogni chip evento (mai l'intero indice — un
// chip circuito da solo non ha senso, l'utente parte sempre da un evento).
// Per ogni occorrenza del pool, il chip evento che l'ha prodotta regge per
// costruzione; gli ALTRI chip evento reggono se la stessa gara (o lo stesso
// pilota, a seconda della modalità di join) compare anche tra le loro
// occorrenze proprie; i chip pilota/team/circuito/era reggono se i campi di
// quella singola occorrenza li soddisfano. Questo spiega anche perché ogni
// ScenarioIndexEntry finisce sempre in un gruppo ≥1: regge sempre almeno il
// chip evento che l'ha generata.

import fs from "fs";
import path from "path";
import { buildScenarioIndex, type ScenarioIndexEntry, type EventParamMeta } from "./scenarioIndex";
import type { EventUnit } from "./eventCatalog";

const RACES_INDEX_PATH = path.join(process.cwd(), "public", "data", "races-index.json");
const RESULTS_PLANE_PATH = path.join(process.cwd(), "public", "data", "results-plane.json");
const PARAMS_PATH = path.join(process.cwd(), "public", "data", "params.json");

export type JoinMode = "stessa gara" | "stesso pilota";

interface ChipBase {
  // Scelto dal chiamante (la UI), stabile per la durata dello scenario:
  // serve a distinguere due chip dello stesso tipo (es. due chip pilota).
  id: string;
  // Etichetta leggibile: la UI la scrive in chiaro come "differenza" quando
  // il chip finisce in chipsMissed — non va ricostruita altrove.
  label: string;
}

export interface EventoChip extends ChipBase {
  tipo: "evento";
  eventId: string;
  parametri: Record<string, number | string>;
}

export interface PilotaChip extends ChipBase {
  tipo: "pilota";
  driverId: number;
}

export interface TeamChip extends ChipBase {
  tipo: "team";
  constructorId: number;
}

export interface CircuitoChip extends ChipBase {
  tipo: "circuito";
  circuitRef: string;
}

export interface EraChip extends ChipBase {
  tipo: "era";
  annoDa: number;
  annoA: number;
}

export type Chip = EventoChip | PilotaChip | TeamChip | CircuitoChip | EraChip;

export interface ChipMatchResult {
  entry: ScenarioIndexEntry;
  chipsHeld: Chip[];
  chipsMissed: Chip[];
  // Dato assente (non "chip fallito"): pilota/team ignoti su un'occorrenza
  // troncata (S1.1), o join "stesso pilota" impossibile perché uno dei due
  // eventi coinvolti non porta mai driverId.
  chipsNonValutabili: Chip[];
  score: number; // = chipsHeld.length, ridondante con byScore ma nel tipo concordato in S0.1
  percentualeSimilarita: number;
}

export interface DenominatoreComposto {
  valore: number | null;
  fonte: "precalcolato" | "proxy" | "non_calcolabile";
  unita: EventUnit | null;
}

export interface ScenarioResult {
  chips: Chip[];
  joinMode: JoinMode; // quella effettivamente usata (esplicita o dedotta)
  joinModeDedotto: JoinMode; // il default che il sistema avrebbe scelto da solo
  joinModeEsplicita: boolean;
  finestraIntersecata: { annoDa: number; annoA: number };
  denominatoreComposto: DenominatoreComposto;
  // Un livello per ogni punteggio da K (chips.length) a 1, sempre presenti
  // anche vuoti — S3 (la vista D3) deve poter disegnare una riga vuota
  // dichiarata invece di doverla dedurre dall'assenza del livello.
  byScore: { score: number; risultati: ChipMatchResult[] }[];
}

interface ParamsFile {
  eventi: {
    pesiChipContesto: {
      pilota: number;
      team: number;
      circuito: number;
      era: number;
    };
  };
}

interface RaceIndexRow {
  raceId: number;
  anno: number;
  circuitRef: string;
  isIndy500: boolean;
}

function parametriEqual(a: Record<string, number | string>, b: Record<string, number | string>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

let pesiContestoCache: ParamsFile["eventi"]["pesiChipContesto"] | null = null;
function loadPesiContesto(): ParamsFile["eventi"]["pesiChipContesto"] {
  if (pesiContestoCache) return pesiContestoCache;
  const params: ParamsFile = JSON.parse(fs.readFileSync(PARAMS_PATH, "utf-8"));
  pesiContestoCache = params.eventi.pesiChipContesto;
  return pesiContestoCache;
}

let racesCache: RaceIndexRow[] | null = null;
function loadRaces(): RaceIndexRow[] {
  if (racesCache) return racesCache;
  racesCache = JSON.parse(fs.readFileSync(RACES_INDEX_PATH, "utf-8"));
  return racesCache!;
}

interface ResultsPlane {
  griglia: (number | null)[];
  arrivo: (number | null)[];
  raceId: number[];
  driverId: number[];
}

let resultsPlaneCache: ResultsPlane | null = null;
function loadResultsPlane(): ResultsPlane {
  if (resultsPlaneCache) return resultsPlaneCache;
  resultsPlaneCache = JSON.parse(fs.readFileSync(RESULTS_PLANE_PATH, "utf-8"));
  return resultsPlaneCache!;
}

// Il denominatore non si restringe solo per anno: DEVE restringersi con ogni
// chip di contesto, altrimenti la rarità è una bugia. "Vittoria dalla 10° a
// Monza" con denominatore = tutti i risultati di sempre dà 0,013% invece del
// numero vero (verificato: sbagliato di ~70 volte). Era già la decisione di
// S0.1 — "intersecate per anno/circuito/gare in cui compare quel pilota" —
// solo non implementata alla prima stesura.
//
// Il team resta l'eccezione onesta: results-plane.json non porta
// constructorId e nessun file pubblico ha il roster completo (S0.1, caso 3),
// quindi con un chip team il denominatore è "non calcolabile", dichiarato.
interface FiltriContesto {
  circuitRefs: string[];
  driverIds: number[];
  haChipTeam: boolean;
}

// I raceId in cui quel pilota ha effettivamente corso: serve a non contare
// come "occasioni" gare in cui non era nemmeno iscritto.
function raceIdsDelPilota(driverId: number): Set<number> {
  const plane = loadResultsPlane();
  const out = new Set<number>();
  for (let i = 0; i < plane.driverId.length; i++) {
    if (plane.driverId[i] === driverId) out.add(plane.raceId[i]);
  }
  return out;
}

// Caso 2 di S0.1, ramo GARA: races-index.json (isIndy500 sempre escluso,
// come ogni denominatore del sito) intersecato con finestra e contesto.
function countRacesInWindow(annoDa: number, annoA: number, filtri: FiltriContesto): number | null {
  if (filtri.haChipTeam) return null;
  const gareDeiPiloti = filtri.driverIds.map(raceIdsDelPilota);
  return loadRaces().filter((r) => {
    if (r.isIndy500 || r.anno < annoDa || r.anno > annoA) return false;
    if (filtri.circuitRefs.length > 0 && !filtri.circuitRefs.includes(r.circuitRef)) return false;
    return gareDeiPiloti.every((set) => set.has(r.raceId));
  }).length;
}

// Caso 2 di S0.1, ramo RISULTATO: results-plane.json (colonnare, griglia e
// arrivo non nulli) intersecato con finestra e contesto.
function countResultsInWindow(annoDa: number, annoA: number, filtri: FiltriContesto): number | null {
  if (filtri.haChipTeam) return null;
  const plane = loadResultsPlane();
  const raceById = new Map(loadRaces().map((r) => [r.raceId, r]));
  let count = 0;
  for (let i = 0; i < plane.raceId.length; i++) {
    if (plane.griglia[i] === null || plane.arrivo[i] === null) continue;
    const race = raceById.get(plane.raceId[i]);
    if (!race || race.anno < annoDa || race.anno > annoA) continue;
    if (filtri.circuitRefs.length > 0 && !filtri.circuitRefs.includes(race.circuitRef)) continue;
    if (filtri.driverIds.length > 0 && !filtri.driverIds.includes(plane.driverId[i])) continue;
    count++;
  }
  return count;
}

function findMeta(meta: EventParamMeta[], eventId: string, parametri: Record<string, number | string>): EventParamMeta {
  const found = meta.find((m) => m.eventId === eventId && parametriEqual(m.parametri, parametri));
  if (!found) {
    throw new Error(`scenarioMatch: nessun evento "${eventId}" con parametri ${JSON.stringify(parametri)} nel catalogo`);
  }
  return found;
}

type ChipEsito = "regge" | "salta" | "non_valutabile";

interface EventoChipData {
  chip: EventoChip;
  meta: EventParamMeta;
  ownEntries: ScenarioIndexEntry[];
  ownEntriesSet: Set<ScenarioIndexEntry>;
  // "stessa gara": raceId delle occorrenze proprie. "stesso pilota":
  // driverId delle occorrenze proprie che un driverId ce l'hanno — resta
  // vuoto (mai undefined) se l'evento non porta MAI driverId, e quel caso
  // è distinto sotto con nessunDriverIdProprio.
  joinKeys: Set<number>;
  nessunDriverIdProprio: boolean; // solo rilevante in modalità "stesso pilota"
}

function buildEventoChipData(chip: EventoChip, entries: ScenarioIndexEntry[], meta: EventParamMeta[], joinMode: JoinMode): EventoChipData {
  const m = findMeta(meta, chip.eventId, chip.parametri);
  const ownEntries = entries.filter((e) => e.eventId === chip.eventId && parametriEqual(e.parametri, chip.parametri));

  const joinKeys = new Set<number>();
  if (joinMode === "stessa gara") {
    for (const e of ownEntries) joinKeys.add(e.raceId);
  } else {
    for (const e of ownEntries) {
      if (e.driverIds === undefined) continue;
      for (const d of e.driverIds) joinKeys.add(d);
    }
  }

  return {
    chip,
    meta: m,
    ownEntries,
    ownEntriesSet: new Set(ownEntries),
    joinKeys,
    nessunDriverIdProprio: joinMode === "stesso pilota" && ownEntries.length > 0 && ownEntries.every((e) => e.driverIds === undefined),
  };
}

function evaluaEventoChip(entry: ScenarioIndexEntry, target: EventoChipData, joinMode: JoinMode): ChipEsito {
  if (target.ownEntriesSet.has(entry)) return "regge"; // l'occorrenza stessa del chip: banale, nessun join necessario

  if (joinMode === "stessa gara") {
    return target.joinKeys.has(entry.raceId) ? "regge" : "salta";
  }

  // "stesso pilota": non valutabile se uno dei due lati non porta driverId —
  // "non lo so", non "no" (S0.1, terzo stato obbligatorio).
  if (target.nessunDriverIdProprio || entry.driverIds === undefined) return "non_valutabile";
  return entry.driverIds.some((d) => target.joinKeys.has(d)) ? "regge" : "salta";
}

function evaluaChipContesto(entry: ScenarioIndexEntry, chip: PilotaChip | TeamChip | CircuitoChip | EraChip): ChipEsito {
  switch (chip.tipo) {
    case "pilota":
      if (entry.driverIds === undefined) return "non_valutabile";
      return entry.driverIds.includes(chip.driverId) ? "regge" : "salta";
    case "team":
      if (entry.constructorIds === undefined) return "non_valutabile";
      return entry.constructorIds.includes(chip.constructorId) ? "regge" : "salta";
    case "circuito":
      // circuitRef si risale sempre (S0.1: anche le occorrenze troncate via
      // races-index.json), mai non valutabile.
      return entry.circuitRef === chip.circuitRef ? "regge" : "salta";
    case "era":
      return entry.anno >= chip.annoDa && entry.anno <= chip.annoA ? "regge" : "salta";
  }
}

function pesoChip(chip: Chip, eventoData: Map<string, EventoChipData>, pesiContesto: ParamsFile["eventi"]["pesiChipContesto"]): number {
  if (chip.tipo === "evento") {
    const data = eventoData.get(chip.id);
    if (!data) throw new Error(`scenarioMatch: chip evento "${chip.id}" senza dati risolti`);
    return 1 - data.meta.rarita;
  }
  return pesiContesto[chip.tipo];
}

function intersecaFinestra(a: { annoDa: number; annoA: number }, b: { annoDa: number; annoA: number }) {
  return { annoDa: Math.max(a.annoDa, b.annoDa), annoA: Math.min(a.annoA, b.annoA) };
}

export function matchScenario(chips: Chip[], joinMode?: JoinMode): ScenarioResult {
  const eventoChips = chips.filter((c): c is EventoChip => c.tipo === "evento");
  const contestoChips = chips.filter((c): c is PilotaChip | TeamChip | CircuitoChip | EraChip => c.tipo !== "evento");

  const { entries, meta } = buildScenarioIndex();

  // Default dedotto (decisione S0.1/S1.2): "stesso pilota" solo se TUTTI i
  // chip evento sono RISULTATO — con zero chip evento non c'è nulla da
  // dedurre, "stessa gara" resta il default innocuo (nessun pool, nessun
  // join da fare comunque).
  const joinModeDedotto: JoinMode =
    eventoChips.length > 0 && eventoChips.every((c) => findMeta(meta, c.eventId, c.parametri).unita === "RISULTATO")
      ? "stesso pilota"
      : "stessa gara";
  const joinModeEsplicita = joinMode !== undefined;
  const effectiveJoinMode = joinMode ?? joinModeDedotto;

  const K = chips.length;
  const pesiContesto = loadPesiContesto();

  if (eventoChips.length === 0) {
    // Nessun evento in mano: non c'è un pool di occorrenze da interrogare
    // (un chip pilota/circuito/era da solo non identifica "cosa è successo").
    return {
      chips,
      joinMode: effectiveJoinMode,
      joinModeDedotto,
      joinModeEsplicita,
      finestraIntersecata: { annoDa: 1950, annoA: 2024 },
      denominatoreComposto: { valore: null, fonte: "non_calcolabile", unita: null },
      byScore: Array.from({ length: K }, (_, i) => ({ score: K - i, risultati: [] })),
    };
  }

  const eventoDataById = new Map<string, EventoChipData>();
  for (const c of eventoChips) eventoDataById.set(c.id, buildEventoChipData(c, entries, meta, effectiveJoinMode));

  // Finestra intersecata: parte da 1950-2024, si stringe con ogni chip
  // evento (la sua finestra propria, meta.annoDa/annoA) e con ogni chip era.
  let finestra = { annoDa: 1950, annoA: 2024 };
  for (const c of eventoChips) {
    const d = eventoDataById.get(c.id)!;
    finestra = intersecaFinestra(finestra, { annoDa: d.meta.annoDa, annoA: d.meta.annoA });
  }
  for (const c of contestoChips) {
    if (c.tipo === "era") finestra = intersecaFinestra(finestra, { annoDa: c.annoDa, annoA: c.annoA });
  }

  // Denominatore composto, regola in tre casi di S0.1.
  const filtriContesto: FiltriContesto = {
    circuitRefs: contestoChips.filter((c): c is CircuitoChip => c.tipo === "circuito").map((c) => c.circuitRef),
    driverIds: contestoChips.filter((c): c is PilotaChip => c.tipo === "pilota").map((c) => c.driverId),
    haChipTeam: contestoChips.some((c) => c.tipo === "team"),
  };

  let denominatoreComposto: DenominatoreComposto;
  if (eventoChips.length === 1 && K === 1) {
    const m = eventoDataById.get(eventoChips[0].id)!.meta;
    denominatoreComposto = { valore: m.denominatore, fonte: "precalcolato", unita: m.unita };
  } else {
    const unita: EventUnit =
      eventoChips.length === 1 ? eventoDataById.get(eventoChips[0].id)!.meta.unita : effectiveJoinMode === "stessa gara" ? "GARA" : "RISULTATO";
    const valore =
      unita === "TEAM_GARA"
        ? null
        : unita === "GARA"
          ? countRacesInWindow(finestra.annoDa, finestra.annoA, filtriContesto)
          : countResultsInWindow(finestra.annoDa, finestra.annoA, filtriContesto);
    denominatoreComposto = { valore, fonte: valore === null ? "non_calcolabile" : "proxy", unita };
  }

  // Il pool: unione delle occorrenze proprie di ogni chip evento, ognuna
  // ancora legata al chip che l'ha generata (per il "regge per costruzione").
  const pool: { entry: ScenarioIndexEntry; origine: EventoChipData }[] = [];
  for (const c of eventoChips) {
    const data = eventoDataById.get(c.id)!;
    for (const entry of data.ownEntries) pool.push({ entry, origine: data });
  }

  // DEDUPLICA, altrimenti si conta più volte la stessa cosa: due chip evento
  // che capitano nella stessa gara mettono nel pool DUE occorrenze diverse
  // (una per evento) che nel mondo reale sono un fatto solo. Verificato prima
  // della correzione: 60 risultati per 30 gare, cioè "è successo 60 volte"
  // quando le volte erano 30 — il numero che tutta la tesi del sito promette
  // di dare giusto.
  //
  // L'unità di conteggio è quella del join: la gara, oppure il pilota in
  // quella gara. Le occorrenze senza pilota noto (S1.1) restano separate:
  // non possiamo affermare che siano lo stesso pilota, e inventarlo sarebbe
  // peggio che contarle a parte.
  const chiaveUnita = (entry: ScenarioIndexEntry): string =>
    effectiveJoinMode === "stessa gara"
      ? String(entry.raceId)
      : `${entry.raceId}|${entry.driverIds === undefined ? "?" : [...entry.driverIds].sort((a, b) => a - b).join(",")}`;

  const gruppi = new Map<string, { entry: ScenarioIndexEntry; origine: EventoChipData }[]>();
  for (const p of pool) {
    const k = chiaveUnita(p.entry);
    const g = gruppi.get(k);
    if (g) g.push(p);
    else gruppi.set(k, [p]);
  }

  // Unendo le copie, un chip regge se lo prova ANCHE UNA SOLA di esse: le
  // copie sono lo stesso fatto visto da eventi diversi, e un "no" su una
  // copia non smentisce un "sì" su un'altra (riguardano soggetti diversi
  // della stessa gara). Per lo stesso motivo "non valutabile" batte "salta":
  // un dato che manca non è una smentita.
  const priorita: Record<ChipEsito, number> = { regge: 2, non_valutabile: 1, salta: 0 };

  const risultatiTotali: ChipMatchResult[] = [...gruppi.values()].map((copie) => {
    const esiti = new Map<string, ChipEsito>();
    const registra = (chip: Chip, esito: ChipEsito) => {
      const attuale = esiti.get(chip.id);
      if (attuale === undefined || priorita[esito] > priorita[attuale]) esiti.set(chip.id, esito);
    };

    for (const { entry } of copie) {
      for (const c of eventoChips) {
        registra(c, evaluaEventoChip(entry, eventoDataById.get(c.id)!, effectiveJoinMode));
      }
      for (const c of contestoChips) registra(c, evaluaChipContesto(entry, c));
    }

    const chipsHeld: Chip[] = [];
    const chipsMissed: Chip[] = [];
    const chipsNonValutabili: Chip[] = [];
    for (const c of chips) {
      const esito = esiti.get(c.id) ?? "salta";
      if (esito === "regge") chipsHeld.push(c);
      else if (esito === "salta") chipsMissed.push(c);
      else chipsNonValutabili.push(c);
    }

    const pesoHeld = chipsHeld.reduce((s, c) => s + pesoChip(c, eventoDataById, pesiContesto), 0);
    const pesoMissed = chipsMissed.reduce((s, c) => s + pesoChip(c, eventoDataById, pesiContesto), 0);
    const denomPeso = pesoHeld + pesoMissed;
    const percentualeSimilarita = denomPeso > 0 ? pesoHeld / denomPeso : chipsHeld.length > 0 ? 1 : 0;

    return {
      entry: copie[0].entry,
      chipsHeld,
      chipsMissed,
      chipsNonValutabili,
      score: chipsHeld.length,
      percentualeSimilarita,
    };
  });

  const byScore = Array.from({ length: K }, (_, i) => {
    const score = K - i;
    return {
      score,
      risultati: risultatiTotali.filter((r) => r.score === score).sort((a, b) => b.entry.anno - a.entry.anno),
    };
  });

  return {
    chips,
    joinMode: effectiveJoinMode,
    joinModeDedotto,
    joinModeEsplicita,
    finestraIntersecata: finestra,
    denominatoreComposto,
    byScore,
  };
}
