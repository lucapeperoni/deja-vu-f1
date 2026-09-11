// Le tabelle delle situazioni (Déjà vu v4, docs/PROGETTAZIONE-v4.md §6,
// roadmap D2.1): decodifica dei JSON colonnari prodotti da
// data-layer/scripts/build_situazioni.py e ricalcolo delle colonne DERIVATE
// che la pipeline non spedisce (contatori di carriera, ordine del compagno).
//
// Nessun `fs`: questo modulo riceve i JSON come argomento e può essere
// importato da un componente client. La lettura dei file sta in
// tabelleServer.ts.
//
// Convenzione ereditata dalla pipeline: null = non sappiamo (campo vuoto in
// Ergast, o fuori dalla finestra di copertura), MAI 0. Le colonne restano
// array di `number | null`, non typed array con un sentinella: i due stati
// non si devono confondere, e il costo per 26.759 righe è trascurabile
// (decodifica in ~20 ms, una valutazione in <1 ms).

export type Nullable = number | null;

export interface RisultatiJson {
  versione: 1;
  righe: number;
  statoCodes: string[];
  colonne: Record<string, (number | null)[]>;
  derivate: Record<string, string>;
  meta: { finestre: Record<string, [number, number]>; note: Record<string, string> };
}

export interface GareJson {
  versione: 1;
  righe: number;
  colonne: Record<string, (number | string | null)[]>;
  meta: { finestre: Record<string, [number, number]>; note: Record<string, string> };
}

export interface DizionariJson {
  versione: 1;
  piloti: { id: number; ref: string; nome: string; cognome: string; codice: string | null; annoDa: number; annoA: number; gp: number }[];
  team: { id: number; ref: string; nome: string; annoDa: number; annoA: number; risultati: number }[];
  circuiti: { ref: string; nome: string; localita: string; paese: string; sinonimi: string[]; gare: number; annoDa: number; annoA: number }[];
}

export const STATO = { CLASSIFICATO: 0, NON_QUALIFICATO: 1, NON_PARTITO: 2, RITIRO_TECNICO: 3, RITIRO_INCIDENTE: 4 } as const;
export const HA_PRESO_IL_VIA = new Set<number>([STATO.CLASSIFICATO, STATO.RITIRO_TECNICO, STATO.RITIRO_INCIDENTE]);

// Una colonna per campo, tutte lunghe `righe`. I nomi sono quelli della
// pipeline, più le derivate.
export interface Risultati {
  righe: number;
  raceId: number[];
  driverId: number[];
  constructorId: number[];
  griglia: Nullable[];
  pitLane: number[];
  arrivo: Nullable[];
  ordine: number[];
  statoCat: number[];
  statusId: number[];
  giri: Nullable[];
  giroVeloceRank: Nullable[];
  decimiDalVincitore: Nullable[];
  posDopoGiro1: Nullable[];
  giriAlComando: Nullable[];
  primoGiroAlComando: Nullable[];
  posPeggiore: Nullable[];
  posMigliore: Nullable[];
  soste: Nullable[];
  giroPrimaSosta: Nullable[];
  posQualifica: Nullable[];
  punti: number[];
  // derivate (ricalcolate qui, verificate contro la pipeline in scripts/verify-situazioni.ts)
  gpInCarriera: number[];
  vittoriePrima: number[];
  podiPrima: number[];
  polePrima: number[];
  vittorieSuCircuitoPrima: number[];
  ordineCompagno: Nullable[];
  // indice della riga della gara in `Gare`
  garaIdx: number[];
}

export interface Gare {
  righe: number;
  raceId: number[];
  anno: number[];
  round: number[];
  indy: number[];
  partiti: number[];
  classificati: number[];
  ritiri: number[];
  doppietta: number[];
  tripletta: number[];
  margineMs: Nullable[];
  cambiDiLeader: Nullable[];
  leaderDiversi: Nullable[];
  vittoriaUltimoGiro: Nullable[];
  neutralizzazioni: Nullable[];
  circuitRef: string[];
  paese: string[];
  nome: string[];
  data: string[];
  // righe di `Risultati` della gara: [inizio, fine)
  rigaDa: number[];
  rigaA: number[];
}

export interface Tabelle {
  risultati: Risultati;
  gare: Gare;
  finestre: Record<string, [number, number]>;
  garaIdxByRaceId: Map<number, number>;
}

export function decodeTabelle(rj: RisultatiJson, gj: GareJson): Tabelle {
  const gc = gj.colonne;
  const ng = gj.righe;
  const gare: Gare = {
    righe: ng,
    raceId: gc.raceId as number[],
    anno: gc.anno as number[],
    round: gc.round as number[],
    indy: gc.indy as number[],
    partiti: gc.partiti as number[],
    classificati: gc.classificati as number[],
    ritiri: gc.ritiri as number[],
    doppietta: gc.doppietta as number[],
    tripletta: gc.tripletta as number[],
    margineMs: gc.margineMs as Nullable[],
    cambiDiLeader: gc.cambiDiLeader as Nullable[],
    leaderDiversi: gc.leaderDiversi as Nullable[],
    vittoriaUltimoGiro: gc.vittoriaUltimoGiro as Nullable[],
    neutralizzazioni: gc.neutralizzazioni as Nullable[],
    circuitRef: gc.circuitRef as string[],
    paese: gc.paese as string[],
    nome: gc.nome as string[],
    data: gc.data as string[],
    rigaDa: new Array(ng).fill(0),
    rigaA: new Array(ng).fill(0),
  };
  const garaIdxByRaceId = new Map<number, number>();
  for (let i = 0; i < ng; i++) garaIdxByRaceId.set(gare.raceId[i], i);

  const c = rj.colonne;
  const n = rj.righe;
  // raceId per differenza (la prima riga porta il valore pieno)
  const raceId = new Array<number>(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += c.raceIdDelta[i] as number;
    raceId[i] = acc;
  }
  const garaIdx = raceId.map((id) => {
    const g = garaIdxByRaceId.get(id);
    if (g === undefined) throw new Error(`raceId ${id} nei risultati ma non nelle gare`);
    return g;
  });
  // intervalli di righe per gara (le righe sono ordinate per raceId)
  for (let i = 0; i < n; i++) {
    const g = garaIdx[i];
    if (i === 0 || garaIdx[i - 1] !== g) gare.rigaDa[g] = i;
    gare.rigaA[g] = i + 1;
  }

  const ris: Risultati = {
    righe: n,
    raceId,
    driverId: c.driverId as number[],
    constructorId: c.constructorId as number[],
    griglia: c.griglia as Nullable[],
    pitLane: c.pitLane as number[],
    arrivo: c.arrivo as Nullable[],
    ordine: c.ordine as number[],
    statoCat: c.statoCat as number[],
    statusId: c.statusId as number[],
    giri: c.giri as Nullable[],
    giroVeloceRank: c.giroVeloceRank as Nullable[],
    decimiDalVincitore: c.decimiDalVincitore as Nullable[],
    posDopoGiro1: c.posDopoGiro1 as Nullable[],
    giriAlComando: c.giriAlComando as Nullable[],
    primoGiroAlComando: c.primoGiroAlComando as Nullable[],
    posPeggiore: c.posPeggiore as Nullable[],
    posMigliore: c.posMigliore as Nullable[],
    soste: c.soste as Nullable[],
    giroPrimaSosta: c.giroPrimaSosta as Nullable[],
    posQualifica: c.posQualifica as Nullable[],
    punti: c.punti as number[],
    gpInCarriera: new Array(n).fill(0),
    vittoriePrima: new Array(n).fill(0),
    podiPrima: new Array(n).fill(0),
    polePrima: new Array(n).fill(0),
    vittorieSuCircuitoPrima: new Array(n).fill(0),
    ordineCompagno: new Array(n).fill(null),
    garaIdx,
  };

  calcolaDerivate(ris, gare);

  return { risultati: ris, gare, finestre: { ...rj.meta.finestre, ...gj.meta.finestre }, garaIdxByRaceId };
}

// Le derivate, con la stessa definizione della pipeline
// (build_situazioni.py, sezione "contatori di carriera"): ordine
// cronologico per (data, raceId, ordine); i contatori "Prima" NON contano
// la gara corrente; gpInCarriera la conta.
function calcolaDerivate(r: Risultati, g: Gare): void {
  const ordine = Array.from({ length: r.righe }, (_, i) => i).sort((a, b) => {
    const ga = r.garaIdx[a], gb = r.garaIdx[b];
    if (g.data[ga] !== g.data[gb]) return g.data[ga] < g.data[gb] ? -1 : 1;
    if (g.raceId[ga] !== g.raceId[gb]) return g.raceId[ga] - g.raceId[gb];
    return r.ordine[a] - r.ordine[b];
  });
  const gp = new Map<number, number>();
  const vitt = new Map<number, number>();
  const podi = new Map<number, number>();
  const pole = new Map<number, number>();
  const vittCirc = new Map<string, number>();
  for (const i of ordine) {
    const d = r.driverId[i];
    const kc = `${d}|${g.circuitRef[r.garaIdx[i]]}`;
    r.gpInCarriera[i] = (gp.get(d) ?? 0) + 1;
    gp.set(d, r.gpInCarriera[i]);
    r.vittoriePrima[i] = vitt.get(d) ?? 0;
    r.podiPrima[i] = podi.get(d) ?? 0;
    r.polePrima[i] = pole.get(d) ?? 0;
    r.vittorieSuCircuitoPrima[i] = vittCirc.get(kc) ?? 0;
    const win = r.arrivo[i] === 1 ? 1 : 0;
    const pod = r.arrivo[i] !== null && r.arrivo[i]! <= 3 ? 1 : 0;
    const pl = r.griglia[i] === 1 ? 1 : 0;
    if (win) vitt.set(d, r.vittoriePrima[i] + 1);
    if (pod) podi.set(d, r.podiPrima[i] + 1);
    if (pl) pole.set(d, r.polePrima[i] + 1);
    if (win) vittCirc.set(kc, r.vittorieSuCircuitoPrima[i] + 1);
  }
  // ordine del compagno: solo se il team ha esattamente 2 righe nella gara
  for (let gi = 0; gi < g.righe; gi++) {
    const byTeam = new Map<number, number[]>();
    for (let i = g.rigaDa[gi]; i < g.rigaA[gi]; i++) {
      const t = r.constructorId[i];
      const l = byTeam.get(t);
      if (l) l.push(i);
      else byTeam.set(t, [i]);
    }
    for (const rows of byTeam.values()) {
      if (rows.length === 2) {
        r.ordineCompagno[rows[0]] = r.ordine[rows[1]];
        r.ordineCompagno[rows[1]] = r.ordine[rows[0]];
      }
    }
  }
}
