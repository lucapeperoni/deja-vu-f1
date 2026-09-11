// Il motore delle situazioni (Déjà vu v4, docs/PROGETTAZIONE-v4.md §3, §5;
// roadmap D2.1). Puro: riceve le tabelle decodificate, valuta una
// situazione e risponde "N volte su M", con la finestra e le occorrenze.
//
// Una situazione = quattro slot (chi · cosa · dove · quando). "Cosa" porta
// uno o più fatti (fatti.ts). I fatti sul RISULTATO si applicano tutti alla
// stessa riga pilota×gara; i fatti sulla GARA alla gara di quella riga. Se
// ci sono solo fatti sulla gara, l'unità è la gara.
//
// Il denominatore M — la regola d'oro, ogni numero porta la sua finestra —
// è l'universo dell'unità ristretto a: Indy 500 escluse; finestra =
// intersezione delle finestre delle colonne usate dai fatti (e dallo slot
// quando); slot chi/dove; righe VALUTABILI (nessun fatto risponde null).
// L'unità in cui M si legge:
//   - chi = pilota/team  → "gare di X" (righe di X)
//   - chi vuoto e un fatto `unico` (vince, pole, giro veloce) → "gare"
//     (in ogni gara c'è un solo vincitore: 37 su 1114 gare, come in v3)
//   - chi vuoto altrimenti → "risultati" (righe pilota×gara)
//   - solo fatti sulla gara → "gare"

import { fattoById, type Fatto } from "./fatti";
import type { Tabelle } from "./tabelle";

export interface FattoScelto {
  id: string;
  parametro?: number;
}

export type Chi = { tipo: "pilota"; driverId: number } | { tipo: "team"; constructorId: number };
export type Dove = { tipo: "circuito"; circuitRef: string } | { tipo: "paese"; paese: string };
export type Quando = { tipo: "anno"; anno: number } | { tipo: "decennio"; annoDa: number } | { tipo: "era"; annoDa: number; annoA: number };

export interface Situazione {
  chi?: Chi;
  cosa: FattoScelto[];
  dove?: Dove;
  quando?: Quando;
}

export type UnitaDenominatore = "gare" | "risultati" | "gare del pilota" | "risultati del team";

export interface Occorrenza {
  // indice riga in risultati (null se l'unità è la gara)
  riga: number | null;
  garaIdx: number;
  raceId: number;
  anno: number;
  circuitRef: string;
  driverId: number | null;
  constructorId: number | null;
}

export interface Finestra {
  annoDa: number;
  annoA: number;
  // vuota se gli slot non si sovrappongono (es. fatto sulle soste + anni 1970)
  vuota: boolean;
  // quale colonna stringe la finestra, per dirlo a schermo
  limitataDa: string[];
}

export interface Risposta {
  situazione: Situazione;
  unita: "risultato" | "gara";
  n: number;
  m: number;
  unitaDenominatore: UnitaDenominatore;
  finestra: Finestra;
  occorrenze: Occorrenza[];
  // righe uscite dal denominatore perché un fatto non era valutabile
  nonValutabili: number;
}

export function quandoIntervallo(q: Quando | undefined): [number, number] | null {
  if (!q) return null;
  if (q.tipo === "anno") return [q.anno, q.anno];
  if (q.tipo === "decennio") return [q.annoDa, q.annoDa + 9];
  return [q.annoDa, q.annoA];
}

export function finestraDi(tab: Tabelle, fatti: Fatto[], quando?: Quando): Finestra {
  let annoDa = 1950;
  let annoA = 2024;
  const limitataDa: string[] = [];
  for (const f of fatti) {
    for (const c of f.colonne) {
      const w = tab.finestre[c];
      if (!w) continue;
      if (w[0] > annoDa) {
        annoDa = w[0];
        limitataDa.length = 0;
        limitataDa.push(c);
      } else if (w[0] === annoDa && w[0] > 1950 && !limitataDa.includes(c)) limitataDa.push(c);
      if (w[1] < annoA) annoA = w[1];
    }
  }
  const q = quandoIntervallo(quando);
  if (q) {
    annoDa = Math.max(annoDa, q[0]);
    annoA = Math.min(annoA, q[1]);
  }
  return { annoDa, annoA, vuota: annoDa > annoA, limitataDa };
}

export function valuta(tab: Tabelle, s: Situazione): Risposta {
  const fatti = s.cosa.map((c) => fattoById(c.id));
  const params = s.cosa.map((c, k) => c.parametro ?? fatti[k].parametro?.default ?? 0);
  const fattiRisultato = fatti.map((f, k) => [f, params[k]] as const).filter(([f]) => f.unita === "risultato");
  const fattiGara = fatti.map((f, k) => [f, params[k]] as const).filter(([f]) => f.unita === "gara");
  const unita: "risultato" | "gara" = fattiRisultato.length > 0 ? "risultato" : "gara";
  const finestra = finestraDi(tab, fatti, s.quando);
  const { risultati: r, gare: g } = tab;

  const garaAmmessa = (gi: number): boolean => {
    if (g.indy[gi] === 1) return false;
    if (g.anno[gi] < finestra.annoDa || g.anno[gi] > finestra.annoA) return false;
    if (s.dove) {
      if (s.dove.tipo === "circuito" && g.circuitRef[gi] !== s.dove.circuitRef) return false;
      if (s.dove.tipo === "paese" && g.paese[gi] !== s.dove.paese) return false;
    }
    return true;
  };

  // esito dei fatti sulla gara, calcolato una volta per gara
  const esitoGara = (gi: number): boolean | null => {
    let ok = true;
    for (const [f, p] of fattiGara) {
      const e = f.testGara!(g, gi, p);
      if (e === null) return null;
      if (!e) ok = false;
    }
    return ok;
  };

  const occorrenze: Occorrenza[] = [];
  let n = 0;
  let m = 0;
  let nonValutabili = 0;

  if (finestra.vuota) {
    return { situazione: s, unita, n: 0, m: 0, unitaDenominatore: unitaDenominatore(s, fatti, unita), finestra, occorrenze, nonValutabili };
  }

  if (unita === "gara") {
    for (let gi = 0; gi < g.righe; gi++) {
      if (!garaAmmessa(gi)) continue;
      // con chi = pilota/team e soli fatti di gara, la gara conta se lui c'era
      if (s.chi && !presente(tab, gi, s.chi)) continue;
      const e = esitoGara(gi);
      if (e === null) {
        nonValutabili++;
        continue;
      }
      m++;
      if (e) {
        n++;
        occorrenze.push({ riga: null, garaIdx: gi, raceId: g.raceId[gi], anno: g.anno[gi], circuitRef: g.circuitRef[gi], driverId: null, constructorId: null });
      }
    }
    return { situazione: s, unita, n, m, unitaDenominatore: "gare", finestra, occorrenze, nonValutabili };
  }

  const ud = unitaDenominatore(s, fatti, unita);
  const gareContate = new Set<number>();
  for (let gi = 0; gi < g.righe; gi++) {
    if (!garaAmmessa(gi)) continue;
    const eg = fattiGara.length ? esitoGara(gi) : true;
    if (eg === null) {
      nonValutabili += g.rigaA[gi] - g.rigaDa[gi];
      continue;
    }
    for (let i = g.rigaDa[gi]; i < g.rigaA[gi]; i++) {
      if (s.chi) {
        if (s.chi.tipo === "pilota" && r.driverId[i] !== s.chi.driverId) continue;
        if (s.chi.tipo === "team" && r.constructorId[i] !== s.chi.constructorId) continue;
      }
      let ok = eg;
      let valutabile = true;
      for (const [f, p] of fattiRisultato) {
        const e = f.testRisultato!(r, i, p);
        if (e === null) {
          valutabile = false;
          break;
        }
        if (!e) ok = false;
      }
      if (!valutabile) {
        nonValutabili++;
        continue;
      }
      if (ud === "gare") gareContate.add(gi);
      else m++;
      if (ok) {
        n++;
        occorrenze.push({ riga: i, garaIdx: gi, raceId: g.raceId[gi], anno: g.anno[gi], circuitRef: g.circuitRef[gi], driverId: r.driverId[i], constructorId: r.constructorId[i] });
      }
    }
  }
  if (ud === "gare") m = gareContate.size;
  return { situazione: s, unita, n, m, unitaDenominatore: ud, finestra, occorrenze, nonValutabili };
}

function unitaDenominatore(s: Situazione, fatti: Fatto[], unita: "risultato" | "gara"): UnitaDenominatore {
  if (unita === "gara") return "gare";
  if (s.chi?.tipo === "pilota") return "gare del pilota";
  if (s.chi?.tipo === "team") return "risultati del team";
  return fatti.some((f) => f.unico) ? "gare" : "risultati";
}

function presente(tab: Tabelle, gi: number, chi: Chi): boolean {
  const { risultati: r, gare: g } = tab;
  for (let i = g.rigaDa[gi]; i < g.rigaA[gi]; i++) {
    if (chi.tipo === "pilota" && r.driverId[i] === chi.driverId) return true;
    if (chi.tipo === "team" && r.constructorId[i] === chi.constructorId) return true;
  }
  return false;
}

// La frase in chiaro, riletta dal motore: è quello che il telecronista
// controlla prima di dirlo in onda (PROGETTAZIONE-v4 §7.2).
export function fraseInChiaro(s: Situazione, nomi: { pilota?: string; team?: string; circuito?: string }): string {
  const fatti = s.cosa.map((c) => fattoById(c.id).etichetta(c.parametro ?? fattoById(c.id).parametro?.default ?? 0));
  const chi = s.chi ? (s.chi.tipo === "pilota" ? nomi.pilota ?? "il pilota" : nomi.team ?? "il team") : "un pilota";
  const dove = s.dove ? (s.dove.tipo === "circuito" ? ` a ${nomi.circuito ?? s.dove.circuitRef}` : ` in ${s.dove.paese}`) : "";
  const q = s.quando;
  const quando = !q ? "" : q.tipo === "anno" ? ` nel ${q.anno}` : q.tipo === "decennio" ? ` negli anni ${q.annoDa}` : ` tra il ${q.annoDa} e il ${q.annoA}`;
  return `${chi} ${fatti.join(" e ")}${dove}${quando}`;
}
