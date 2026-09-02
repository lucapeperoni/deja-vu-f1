// Il motore di match a cascata del compositore di scenari, in forma PURA
// (roadmap S, fase S2.2, docs/ROADMAP-6.md — separazione di quello che era
// scenarioMatch.ts).
//
// Qui dentro non c'è `fs`: questo modulo riceve l'indice come argomento e
// può essere importato da un componente client. La lettura dei 33 file
// eventi + races-index.json + results-plane.json + params.json e la
// codifica colonnare stanno nel gemello server, scenarioIndexServer.ts.
// Motivo della separazione (S1.1): l'indice serializzato "a oggetti" pesava
// 2,9 MB, ma la ricerca deve essere istantanea mentre si digita, quindi
// l'indice va al client — in forma compatta — e il match con lui.
//
// L'algoritmo è identico a quello verificato in S1.2, non è stato
// riprogettato: il "pool" di occorrenze candidate è l'unione delle
// occorrenze proprie di ogni chip evento (mai l'intero indice — un chip
// circuito da solo non identifica "cosa è successo"). Per ogni occorrenza
// del pool, il chip evento che l'ha prodotta regge per costruzione; gli
// ALTRI chip evento reggono se la stessa gara (o lo stesso pilota, a
// seconda della modalità di join) compare anche tra le loro occorrenze
// proprie; i chip pilota/team/circuito/era reggono se i campi di quella
// singola occorrenza li soddisfano.

import type { EventUnit } from "./eventCatalog";

export type JoinMode = "stessa gara" | "stesso pilota";

// ---------------------------------------------------------------------------
// La forma compatta (prodotta dal modulo server, consumata da decodeScenarioIndex)
// ---------------------------------------------------------------------------

// Array paralleli, stesso schema colonnare che results-plane.json usa già in
// questo progetto: si scorre per indice, niente nomi di campo ripetuti
// 17.208 volte. Le codifiche non ovvie sono commentate campo per campo.
export interface CompactScenarioIndex {
  versione: 1;
  // Dizionario dei circuitRef: le occorrenze e le gare puntano qui per indice.
  circuiti: string[];
  // TUTTE le gare di races-index.json (non solo quelle con occorrenze): il
  // denominatore proxy del ramo GARA (S0.1, caso 2) conta anche le gare in
  // cui non è successo niente. raceId e anno sono crescenti, quindi vanno
  // per differenza.
  gare: {
    raceIdDelta: number[];
    annoDelta: number[];
    // round della stagione: NON entra nel match (nessun numero di regressione
    // cambia), serve solo al client per ricostruire lo slug /gara/<slug> come
    // buildSlugByRaceId — "<anno>-<circuitRef>", con "-r<round>" per le 4
    // coppie 2020/2021 che condividono anno+circuito. Delta-codificato come
    // gli altri, anche se non è monotòno (torna a 1 a ogni stagione): i salti
    // restano interi piccoli.
    roundDelta: number[];
    circuito: number[];
    indy: number[]; // 0/1 = isIndy500, l'esclusione di ogni denominatore del sito
  };
  // Una riga per (eventId × parametri): le 67 varianti del catalogo.
  varianti: {
    eventId: string[];
    nome: string[];
    famiglia: string[];
    unita: number[]; // indice in UNITA_CODES
    parametri: Record<string, number | string>[];
    annoDa: number[];
    annoA: number[];
    occorrenze: number[];
    denominatore: number[];
    rarita: number[];
    // Il soggetto è "perso" per l'INTERA variante o per nessuna delle sue
    // occorrenze — verificato sui dati (zero varianti miste), quindi il
    // terzo stato "non valutabile" (S0.1) sta qui e non costa 17.208 valori.
    pilotiPersi: number[];
    teamPersi: number[];
    // Lunghezza 68: le occorrenze della variante v sono [offset[v], offset[v+1]).
    offset: number[];
  };
  occorrenze: {
    // Indice nella tabella gare, per differenza dalla precedente occorrenza
    // della stessa variante (le occorrenze sono quasi sempre cronologiche).
    garaDelta: number[];
    // 0 = nessun soggetto; >0 = indice+1 in pilotiRef; -1 = più soggetti,
    // la lista è la prossima non ancora consumata di pilotiListe.
    pilota: number[];
    pilotiListe: number[][];
    team: number[];
    teamListe: number[][];
  };
  // driverId / constructorId veri, ordinati per frequenza: gli id più
  // ricorrenti prendono gli indici più corti.
  pilotiRef: number[];
  teamRef: number[];
  // results-plane.json compattato: serve SOLO ai denominatori composti
  // (S0.1, caso 2). Righe raggruppate per pilota.
  piano: {
    pilota: number[]; // driverId, uno per gruppo
    offset: number[]; // lunghezza pilota.length + 1
    garaDelta: number[]; // indice gara, per differenza dentro il gruppo
    validoBits: number[]; // bitset a 30 bit: griglia e arrivo non nulli
  };
  // I pesi della similarità restano dichiarati in params.json (decisione in
  // cima alla roadmap): qui sono solo trasportati, mai riscritti a mano.
  pesi: PesiChipContesto;
}

export interface PesiChipContesto {
  pilota: number;
  team: number;
  circuito: number;
  era: number;
}

export const UNITA_CODES: EventUnit[] = ["GARA", "RISULTATO", "TEAM_GARA"];

// ---------------------------------------------------------------------------
// La forma a runtime (quella su cui lavora il match)
// ---------------------------------------------------------------------------

// Come lo ScenarioIndexEntry di S1.1, meno `raw`: il motore non l'ha mai
// letto, e spedirlo al client raddoppiava il peso (4,1 MB contro 2,9).
export interface ScenarioEntry {
  varianteIdx: number;
  eventId: string;
  parametri: Record<string, number | string>;
  famiglia: string;
  unita: EventUnit;
  raceId: number;
  anno: number;
  circuitRef: string;
  // undefined = dato perso, quindi "non valutabile" per il motore; [] =
  // l'evento genuinamente non ha quel soggetto. Mai confondere i due (S0.1).
  driverIds: number[] | undefined;
  constructorIds: number[] | undefined;
}

export interface VarianteMeta {
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
}

export interface RaceRow {
  raceId: number;
  anno: number;
  round: number;
  circuitRef: string;
  isIndy500: boolean;
}

export interface ScenarioRuntimeIndex {
  entries: ScenarioEntry[];
  meta: VarianteMeta[];
  ownEntriesByVariante: ScenarioEntry[][];
  races: RaceRow[];
  racesById: Map<number, RaceRow>;
  // Righe di results-plane.json in forma piatta, per il denominatore.
  piano: { driverId: number[]; raceId: number[]; valido: Uint8Array };
  pesi: PesiChipContesto;
}

// ---------------------------------------------------------------------------
// I chip
// ---------------------------------------------------------------------------

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
export type ChipContesto = PilotaChip | TeamChip | CircuitoChip | EraChip;

export interface ChipMatchResult {
  entry: ScenarioEntry;
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

// ---------------------------------------------------------------------------
// Decodifica: dalla forma compatta a quella a runtime
// ---------------------------------------------------------------------------

function decodeSubjects(
  col: number[],
  liste: number[][],
  ref: number[],
  persiPerVariante: number[],
  varianteDiOccorrenza: Int32Array
): (number[] | undefined)[] {
  const out: (number[] | undefined)[] = new Array(col.length);
  let prossimaLista = 0;
  for (let i = 0; i < col.length; i++) {
    const v = col[i];
    // La lista si consuma in ordine: il marcatore è una costante (-1) e non
    // un indice, così non costa cinque cifre per ognuna delle migliaia di
    // occorrenze con più soggetti.
    // Anche dentro le liste i soggetti sono codici del dizionario, non
    // driverId/constructorId veri: vanno risolti come i singoli.
    const ids = v === -1 ? liste[prossimaLista++].map((c) => ref[c - 1]) : v === 0 ? [] : [ref[v - 1]];
    out[i] = persiPerVariante[varianteDiOccorrenza[i]] === 1 ? undefined : ids;
  }
  return out;
}

export function decodeScenarioIndex(compact: CompactScenarioIndex): ScenarioRuntimeIndex {
  // Gare: raceId e anno arrivano per differenza.
  const races: RaceRow[] = [];
  let raceId = 0;
  let anno = 0;
  let round = 0;
  for (let i = 0; i < compact.gare.raceIdDelta.length; i++) {
    raceId += compact.gare.raceIdDelta[i];
    anno += compact.gare.annoDelta[i];
    round += compact.gare.roundDelta[i];
    races.push({
      raceId,
      anno,
      round,
      circuitRef: compact.circuiti[compact.gare.circuito[i]],
      isIndy500: compact.gare.indy[i] === 1,
    });
  }
  const racesById = new Map(races.map((r) => [r.raceId, r]));

  const v = compact.varianti;
  const meta: VarianteMeta[] = v.eventId.map((eventId, i) => ({
    eventId,
    nome: v.nome[i],
    famiglia: v.famiglia[i],
    unita: UNITA_CODES[v.unita[i]],
    parametri: v.parametri[i],
    annoDa: v.annoDa[i],
    annoA: v.annoA[i],
    occorrenze: v.occorrenze[i],
    denominatore: v.denominatore[i],
    rarita: v.rarita[i],
  }));

  const nOcc = compact.occorrenze.garaDelta.length;
  const varianteDiOccorrenza = new Int32Array(nOcc);
  for (let vi = 0; vi < meta.length; vi++) {
    for (let i = v.offset[vi]; i < v.offset[vi + 1]; i++) varianteDiOccorrenza[i] = vi;
  }

  const driverIdsPerOcc = decodeSubjects(
    compact.occorrenze.pilota,
    compact.occorrenze.pilotiListe,
    compact.pilotiRef,
    v.pilotiPersi,
    varianteDiOccorrenza
  );
  const constructorIdsPerOcc = decodeSubjects(
    compact.occorrenze.team,
    compact.occorrenze.teamListe,
    compact.teamRef,
    v.teamPersi,
    varianteDiOccorrenza
  );

  const entries: ScenarioEntry[] = new Array(nOcc);
  const ownEntriesByVariante: ScenarioEntry[][] = [];
  for (let vi = 0; vi < meta.length; vi++) {
    const m = meta[vi];
    const own: ScenarioEntry[] = [];
    let garaIdx = 0;
    for (let i = v.offset[vi]; i < v.offset[vi + 1]; i++) {
      garaIdx = i === v.offset[vi] ? compact.occorrenze.garaDelta[i] : garaIdx + compact.occorrenze.garaDelta[i];
      const race = races[garaIdx];
      const entry: ScenarioEntry = {
        varianteIdx: vi,
        eventId: m.eventId,
        parametri: m.parametri,
        famiglia: m.famiglia,
        unita: m.unita,
        raceId: race.raceId,
        anno: race.anno,
        circuitRef: race.circuitRef,
        driverIds: driverIdsPerOcc[i],
        constructorIds: constructorIdsPerOcc[i],
      };
      entries[i] = entry;
      own.push(entry);
    }
    ownEntriesByVariante.push(own);
  }

  // Piano dei risultati: gruppi per pilota, gara per differenza, validità in
  // un bitset da 30 bit per numero.
  const nRighe = compact.piano.garaDelta.length;
  const pianoDriver = new Array<number>(nRighe);
  const pianoRace = new Array<number>(nRighe);
  const pianoValido = new Uint8Array(nRighe);
  for (let g = 0; g < compact.piano.pilota.length; g++) {
    const da = compact.piano.offset[g];
    const a = compact.piano.offset[g + 1];
    let idx = 0;
    for (let i = da; i < a; i++) {
      idx = i === da ? compact.piano.garaDelta[i] : idx + compact.piano.garaDelta[i];
      pianoDriver[i] = compact.piano.pilota[g];
      pianoRace[i] = races[idx].raceId;
      pianoValido[i] = (compact.piano.validoBits[Math.floor(i / 30)] >> i % 30) & 1;
    }
  }

  return {
    entries,
    meta,
    ownEntriesByVariante,
    races,
    racesById,
    piano: { driverId: pianoDriver, raceId: pianoRace, valido: pianoValido },
    pesi: compact.pesi,
  };
}

// ---------------------------------------------------------------------------
// Il match (logica invariata rispetto a S1.2)
// ---------------------------------------------------------------------------

function parametriEqual(a: Record<string, number | string>, b: Record<string, number | string>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

// Il denominatore non si restringe solo per anno: DEVE restringersi con ogni
// chip di contesto, altrimenti la rarità è una bugia. "Vittoria dalla 10° a
// Monza" con denominatore = tutti i risultati di sempre dà 0,013% invece del
// numero vero (verificato: sbagliato di ~70 volte, S1.2).
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
function raceIdsDelPilota(index: ScenarioRuntimeIndex, driverId: number): Set<number> {
  const out = new Set<number>();
  const piano = index.piano;
  for (let i = 0; i < piano.driverId.length; i++) {
    if (piano.driverId[i] === driverId) out.add(piano.raceId[i]);
  }
  return out;
}

// Caso 2 di S0.1, ramo GARA: races-index.json (isIndy500 sempre escluso,
// come ogni denominatore del sito) intersecato con finestra e contesto.
function countRacesInWindow(index: ScenarioRuntimeIndex, annoDa: number, annoA: number, filtri: FiltriContesto): number | null {
  if (filtri.haChipTeam) return null;
  const gareDeiPiloti = filtri.driverIds.map((d) => raceIdsDelPilota(index, d));
  return index.races.filter((r) => {
    if (r.isIndy500 || r.anno < annoDa || r.anno > annoA) return false;
    if (filtri.circuitRefs.length > 0 && !filtri.circuitRefs.includes(r.circuitRef)) return false;
    return gareDeiPiloti.every((set) => set.has(r.raceId));
  }).length;
}

// Caso 2 di S0.1, ramo RISULTATO: il piano dei risultati (griglia e arrivo
// non nulli) intersecato con finestra e contesto.
function countResultsInWindow(index: ScenarioRuntimeIndex, annoDa: number, annoA: number, filtri: FiltriContesto): number | null {
  if (filtri.haChipTeam) return null;
  const piano = index.piano;
  let count = 0;
  for (let i = 0; i < piano.raceId.length; i++) {
    if (piano.valido[i] === 0) continue;
    const race = index.racesById.get(piano.raceId[i]);
    if (!race || race.anno < annoDa || race.anno > annoA) continue;
    if (filtri.circuitRefs.length > 0 && !filtri.circuitRefs.includes(race.circuitRef)) continue;
    if (filtri.driverIds.length > 0 && !filtri.driverIds.includes(piano.driverId[i])) continue;
    count++;
  }
  return count;
}

function findVarianteIdx(index: ScenarioRuntimeIndex, eventId: string, parametri: Record<string, number | string>): number {
  const i = index.meta.findIndex((m) => m.eventId === eventId && parametriEqual(m.parametri, parametri));
  if (i < 0) {
    throw new Error(`scenarioEngine: nessun evento "${eventId}" con parametri ${JSON.stringify(parametri)} nel catalogo`);
  }
  return i;
}

type ChipEsito = "regge" | "salta" | "non_valutabile";

interface EventoChipData {
  chip: EventoChip;
  meta: VarianteMeta;
  ownEntries: ScenarioEntry[];
  ownEntriesSet: Set<ScenarioEntry>;
  // "stessa gara": raceId delle occorrenze proprie. "stesso pilota":
  // driverId delle occorrenze proprie che un driverId ce l'hanno — resta
  // vuoto (mai undefined) se l'evento non porta MAI driverId, e quel caso
  // è distinto sotto con nessunDriverIdProprio.
  joinKeys: Set<number>;
  nessunDriverIdProprio: boolean; // solo rilevante in modalità "stesso pilota"
}

function buildEventoChipData(index: ScenarioRuntimeIndex, chip: EventoChip, joinMode: JoinMode): EventoChipData {
  const vi = findVarianteIdx(index, chip.eventId, chip.parametri);
  const ownEntries = index.ownEntriesByVariante[vi];

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
    meta: index.meta[vi],
    ownEntries,
    ownEntriesSet: new Set(ownEntries),
    joinKeys,
    nessunDriverIdProprio:
      joinMode === "stesso pilota" && ownEntries.length > 0 && ownEntries.every((e) => e.driverIds === undefined),
  };
}

function evaluaEventoChip(entry: ScenarioEntry, target: EventoChipData, joinMode: JoinMode): ChipEsito {
  if (target.ownEntriesSet.has(entry)) return "regge"; // l'occorrenza stessa del chip: banale, nessun join necessario

  if (joinMode === "stessa gara") {
    return target.joinKeys.has(entry.raceId) ? "regge" : "salta";
  }

  // "stesso pilota": non valutabile se uno dei due lati non porta driverId —
  // "non lo so", non "no" (S0.1, terzo stato obbligatorio).
  if (target.nessunDriverIdProprio || entry.driverIds === undefined) return "non_valutabile";
  return entry.driverIds.some((d) => target.joinKeys.has(d)) ? "regge" : "salta";
}

function evaluaChipContesto(entry: ScenarioEntry, chip: ChipContesto): ChipEsito {
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

function pesoChip(chip: Chip, eventoData: Map<string, EventoChipData>, pesi: PesiChipContesto): number {
  if (chip.tipo === "evento") {
    const data = eventoData.get(chip.id);
    if (!data) throw new Error(`scenarioEngine: chip evento "${chip.id}" senza dati risolti`);
    return 1 - data.meta.rarita;
  }
  return pesi[chip.tipo];
}

function intersecaFinestra(a: { annoDa: number; annoA: number }, b: { annoDa: number; annoA: number }) {
  return { annoDa: Math.max(a.annoDa, b.annoDa), annoA: Math.min(a.annoA, b.annoA) };
}

export function matchScenario(index: ScenarioRuntimeIndex, chips: Chip[], joinMode?: JoinMode): ScenarioResult {
  const eventoChips = chips.filter((c): c is EventoChip => c.tipo === "evento");
  const contestoChips = chips.filter((c): c is ChipContesto => c.tipo !== "evento");

  // Default dedotto (decisione S0.1/S1.2): "stesso pilota" solo se TUTTI i
  // chip evento sono RISULTATO — con zero chip evento non c'è nulla da
  // dedurre, "stessa gara" resta il default innocuo (nessun pool, nessun
  // join da fare comunque).
  const joinModeDedotto: JoinMode =
    eventoChips.length > 0 &&
    eventoChips.every((c) => index.meta[findVarianteIdx(index, c.eventId, c.parametri)].unita === "RISULTATO")
      ? "stesso pilota"
      : "stessa gara";
  const joinModeEsplicita = joinMode !== undefined;
  const effectiveJoinMode = joinMode ?? joinModeDedotto;

  const K = chips.length;

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
  for (const c of eventoChips) eventoDataById.set(c.id, buildEventoChipData(index, c, effectiveJoinMode));

  // Finestra intersecata: parte da 1950-2024, si stringe con ogni chip
  // evento (la sua finestra propria) e con ogni chip era.
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
      eventoChips.length === 1
        ? eventoDataById.get(eventoChips[0].id)!.meta.unita
        : effectiveJoinMode === "stessa gara"
          ? "GARA"
          : "RISULTATO";
    const valore =
      unita === "TEAM_GARA"
        ? null
        : unita === "GARA"
          ? countRacesInWindow(index, finestra.annoDa, finestra.annoA, filtriContesto)
          : countResultsInWindow(index, finestra.annoDa, finestra.annoA, filtriContesto);
    denominatoreComposto = { valore, fonte: valore === null ? "non_calcolabile" : "proxy", unita };
  }

  // Il pool: unione delle occorrenze proprie di ogni chip evento, ognuna
  // ancora legata al chip che l'ha generata (per il "regge per costruzione").
  const pool: { entry: ScenarioEntry; origine: EventoChipData }[] = [];
  for (const c of eventoChips) {
    const data = eventoDataById.get(c.id)!;
    for (const entry of data.ownEntries) pool.push({ entry, origine: data });
  }

  // DEDUPLICA, altrimenti si conta più volte la stessa cosa: due chip evento
  // che capitano nella stessa gara mettono nel pool DUE occorrenze diverse
  // (una per evento) che nel mondo reale sono un fatto solo. Verificato
  // prima della correzione in S1.2: 60 risultati per 30 gare.
  //
  // L'unità di conteggio è quella del join: la gara, oppure il pilota in
  // quella gara. Le occorrenze senza pilota noto (S1.1) restano separate:
  // non possiamo affermare che siano lo stesso pilota.
  const chiaveUnita = (entry: ScenarioEntry): string =>
    effectiveJoinMode === "stessa gara"
      ? String(entry.raceId)
      : `${entry.raceId}|${entry.driverIds === undefined ? "?" : [...entry.driverIds].sort((a, b) => a - b).join(",")}`;

  const gruppi = new Map<string, { entry: ScenarioEntry; origine: EventoChipData }[]>();
  for (const p of pool) {
    const k = chiaveUnita(p.entry);
    const g = gruppi.get(k);
    if (g) g.push(p);
    else gruppi.set(k, [p]);
  }

  // Unendo le copie, un chip regge se lo prova ANCHE UNA SOLA di esse, e
  // "non valutabile" batte "salta": un dato che manca non è una smentita.
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

    const pesoHeld = chipsHeld.reduce((s, c) => s + pesoChip(c, eventoDataById, index.pesi), 0);
    const pesoMissed = chipsMissed.reduce((s, c) => s + pesoChip(c, eventoDataById, index.pesi), 0);
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
