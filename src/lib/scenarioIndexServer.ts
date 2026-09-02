// Il gemello SERVER del motore di scenari (roadmap S, fase S2.2,
// docs/ROADMAP-6.md): legge i file e produce l'indice in forma colonnare
// compatta, quella che scenarioEngine.ts (puro, importabile dal client)
// riceve come argomento.
//
// Perché esiste: l'indice normalizzato di S1.1 pesa 2,9 MB serializzato "a
// oggetti", quasi tutti nomi di campo ripetuti 17.208 volte. La ricerca del
// compositore deve essere istantanea mentre si digita, quindi l'indice va al
// client — ma non così. Qui si applica lo stesso schema colonnare che
// public/data/results-plane.json usa già in questo progetto: array
// paralleli di numeri, si scorre per indice.
//
// Nessun file dati nuovo (vincolo in cima alla roadmap): la forma compatta
// è calcolata a partire dai file esistenti e passata come props alla pagina.

import fs from "fs";
import path from "path";
import { buildScenarioIndex, type ScenarioIndexEntry, type EventParamMeta } from "./scenarioIndex";
import {
  UNITA_CODES,
  type CompactScenarioIndex,
  type PesiChipContesto,
} from "./scenarioEngine";

const RACES_INDEX_PATH = path.join(process.cwd(), "public", "data", "races-index.json");
const RESULTS_PLANE_PATH = path.join(process.cwd(), "public", "data", "results-plane.json");
const PARAMS_PATH = path.join(process.cwd(), "public", "data", "params.json");

interface RaceIndexRow {
  raceId: number;
  anno: number;
  round: number;
  circuitRef: string;
  isIndy500: boolean;
}

interface ResultsPlane {
  griglia: (number | null)[];
  arrivo: (number | null)[];
  raceId: number[];
  driverId: number[];
}

interface ParamsFile {
  eventi: { pesiChipContesto: PesiChipContesto };
}

function parametriEqual(a: Record<string, number | string>, b: Record<string, number | string>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

// Gli id più ricorrenti prendono gli indici più corti: è la sola ragione per
// cui la colonna dei piloti sta in ~50 KB invece di ~65.
function dizionarioPerFrequenza(liste: (number[] | undefined)[]): { ref: number[]; codice: Map<number, number> } {
  const freq = new Map<number, number>();
  for (const l of liste) {
    if (!l) continue;
    for (const id of l) freq.set(id, (freq.get(id) ?? 0) + 1);
  }
  const ref = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([id]) => id);
  return { ref, codice: new Map(ref.map((id, i) => [id, i + 1])) };
}

// Codifica di una colonna di soggetti: 0 = nessuno, >0 = indice+1 nel
// dizionario, -1 = più soggetti (la lista è la prossima di `liste`).
// Il "perso" (dato assente, terzo stato di S0.1) NON sta qui: è uniforme per
// variante — verificato sui dati, zero varianti miste — e sta nella riga
// della variante, dove costa 67 valori invece di 17.208.
function codificaSoggetti(
  perOccorrenza: (number[] | undefined)[],
  persiPerVariante: number[],
  varianteDiOccorrenza: number[]
): { col: number[]; liste: number[][]; ref: number[] } {
  const { ref, codice } = dizionarioPerFrequenza(perOccorrenza);
  const col: number[] = [];
  const liste: number[][] = [];
  for (let i = 0; i < perOccorrenza.length; i++) {
    const ids = perOccorrenza[i];
    if (ids === undefined) {
      if (persiPerVariante[varianteDiOccorrenza[i]] !== 1) {
        throw new Error("scenarioIndexServer: soggetto perso in una variante non marcata come persa");
      }
      col.push(0);
    } else if (ids.length === 0) col.push(0);
    else if (ids.length === 1) col.push(codice.get(ids[0])!);
    else {
      col.push(-1);
      liste.push(ids.map((id) => codice.get(id)!));
    }
  }
  return { col, liste, ref };
}

let cached: CompactScenarioIndex | null = null;

export function buildCompactScenarioIndex(): CompactScenarioIndex {
  if (cached) return cached;

  const { entries, meta } = buildScenarioIndex();
  const races: RaceIndexRow[] = JSON.parse(fs.readFileSync(RACES_INDEX_PATH, "utf-8"));
  races.sort((a, b) => a.raceId - b.raceId);
  const plane: ResultsPlane = JSON.parse(fs.readFileSync(RESULTS_PLANE_PATH, "utf-8"));
  const params: ParamsFile = JSON.parse(fs.readFileSync(PARAMS_PATH, "utf-8"));

  const circuiti = [...new Set(races.map((r) => r.circuitRef))];
  const circuitoIdx = new Map(circuiti.map((c, i) => [c, i]));
  const gareIdxById = new Map(races.map((r, i) => [r.raceId, i]));

  const gare = {
    raceIdDelta: races.map((r, i) => (i === 0 ? r.raceId : r.raceId - races[i - 1].raceId)),
    annoDelta: races.map((r, i) => (i === 0 ? r.anno : r.anno - races[i - 1].anno)),
    // Il round non entra nel match: serve solo alla ricostruzione dello slug
    // /gara/<slug> lato client (S3.1). Delta-codificato come gli altri.
    roundDelta: races.map((r, i) => (i === 0 ? r.round : r.round - races[i - 1].round)),
    circuito: races.map((r) => circuitoIdx.get(r.circuitRef)!),
    indy: races.map((r) => (r.isIndy500 ? 1 : 0)),
  };

  // Le occorrenze arrivano già raggruppate per variante e nell'ordine in cui
  // le legge S1.1: quell'ordine si CONSERVA, non si riordina. Il motore
  // restituisce i pari merito nell'ordine del pool (ordinamento stabile per
  // anno), quindi riordinare qui cambierebbe l'output a parità di conteggi.
  const varianteDiOccorrenza: number[] = new Array(entries.length);
  const offset: number[] = [0];
  let cursore = 0;
  meta.forEach((m: EventParamMeta, vi: number) => {
    while (
      cursore < entries.length &&
      entries[cursore].eventId === m.eventId &&
      parametriEqual(entries[cursore].parametri, m.parametri)
    ) {
      varianteDiOccorrenza[cursore] = vi;
      cursore++;
    }
    offset.push(cursore);
  });
  if (cursore !== entries.length) {
    throw new Error("scenarioIndexServer: le occorrenze non sono contigue per variante come atteso da S1.1");
  }

  // Il "perso" è uniforme per variante: si verifica invece di darlo per
  // scontato, perché è il terzo stato obbligatorio di S0.1 e sbagliarlo
  // significa dire "non regge" dove la verità è "non lo so".
  const pilotiPersi = meta.map(() => -1);
  const teamPersi = meta.map(() => -1);
  entries.forEach((e: ScenarioIndexEntry, i: number) => {
    const vi = varianteDiOccorrenza[i];
    for (const [flags, perso] of [
      [pilotiPersi, e.driverIds === undefined ? 1 : 0],
      [teamPersi, e.constructorIds === undefined ? 1 : 0],
    ] as [number[], number][]) {
      if (flags[vi] === -1) flags[vi] = perso;
      else if (flags[vi] !== perso) {
        throw new Error(`scenarioIndexServer: variante ${meta[vi].eventId} mista tra soggetto perso e presente`);
      }
    }
  });
  for (const flags of [pilotiPersi, teamPersi]) {
    for (let i = 0; i < flags.length; i++) if (flags[i] === -1) flags[i] = 0; // variante senza occorrenze
  }

  const piloti = codificaSoggetti(entries.map((e) => e.driverIds), pilotiPersi, varianteDiOccorrenza);
  const team = codificaSoggetti(entries.map((e) => e.constructorIds), teamPersi, varianteDiOccorrenza);

  const garaDelta: number[] = new Array(entries.length);
  meta.forEach((_, vi) => {
    for (let i = offset[vi]; i < offset[vi + 1]; i++) {
      const idx = gareIdxById.get(entries[i].raceId);
      if (idx === undefined) throw new Error(`scenarioIndexServer: raceId ${entries[i].raceId} assente da races-index.json`);
      garaDelta[i] = i === offset[vi] ? idx : idx - gareIdxById.get(entries[i - 1].raceId)!;
    }
  });

  // Piano dei risultati: serve solo al denominatore composto (S0.1, caso 2),
  // ma serve tutto — countRaces guarda ogni riga (le gare in cui il pilota
  // c'era), countResults solo quelle con griglia e arrivo non nulli.
  const perPilota = new Map<number, { gara: number; valido: number }[]>();
  for (let i = 0; i < plane.raceId.length; i++) {
    const gara = gareIdxById.get(plane.raceId[i]);
    if (gara === undefined) throw new Error(`scenarioIndexServer: raceId ${plane.raceId[i]} del piano assente da races-index.json`);
    const righe = perPilota.get(plane.driverId[i]) ?? [];
    righe.push({ gara, valido: plane.griglia[i] !== null && plane.arrivo[i] !== null ? 1 : 0 });
    perPilota.set(plane.driverId[i], righe);
  }
  const pianoPilota = [...perPilota.keys()].sort((a, b) => a - b);
  const pianoOffset: number[] = [0];
  const pianoGaraDelta: number[] = [];
  const validoBits: number[] = [];
  for (const driverId of pianoPilota) {
    const righe = perPilota.get(driverId)!.sort((a, b) => a.gara - b.gara);
    righe.forEach((r, j) => {
      const i = pianoGaraDelta.length;
      pianoGaraDelta.push(j === 0 ? r.gara : r.gara - righe[j - 1].gara);
      const blocco = Math.floor(i / 30);
      while (validoBits.length <= blocco) validoBits.push(0);
      if (r.valido) validoBits[blocco] |= 1 << i % 30;
    });
    pianoOffset.push(pianoGaraDelta.length);
  }

  cached = {
    versione: 1,
    circuiti,
    gare,
    varianti: {
      eventId: meta.map((m) => m.eventId),
      nome: meta.map((m) => m.nome),
      famiglia: meta.map((m) => m.famiglia),
      unita: meta.map((m) => UNITA_CODES.indexOf(m.unita)),
      parametri: meta.map((m) => m.parametri),
      annoDa: meta.map((m) => m.annoDa),
      annoA: meta.map((m) => m.annoA),
      occorrenze: meta.map((m) => m.occorrenze),
      denominatore: meta.map((m) => m.denominatore),
      rarita: meta.map((m) => m.rarita),
      pilotiPersi,
      teamPersi,
      offset,
    },
    occorrenze: {
      garaDelta,
      pilota: piloti.col,
      pilotiListe: piloti.liste,
      team: team.col,
      teamListe: team.liste,
    },
    pilotiRef: piloti.ref,
    teamRef: team.ref,
    piano: { pilota: pianoPilota, offset: pianoOffset, garaDelta: pianoGaraDelta, validoBits },
    pesi: params.eventi.pesiChipContesto,
  };
  return cached;
}
