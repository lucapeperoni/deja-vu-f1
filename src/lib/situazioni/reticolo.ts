// Il reticolo dei déjà vu (Déjà vu v4, docs/PROGETTAZIONE-v4.md §3.1;
// roadmap D2.2): i casi "simili" a una situazione si ottengono ALLENTANDO
// uno slot alla volta, in un modo dichiarato, e poi due. Nessun punteggio
// opaco: la distanza di un gruppo è la somma dei pesi degli allentamenti
// (params.json → situazioni.pesiAllentamento), e le differenze non le
// spieghiamo noi — sono letteralmente lo slot che cambia, con il nome
// scritto accanto al gruppo.
//
// Allentamenti possibili, per slot:
//   chi     pilota/team → chiunque
//   dove    circuito → stesso paese (grado 1) → ovunque (grado 2);
//           paese → ovunque
//   quando  anno → stesso decennio → sempre; decennio/era → sempre
//   cosa    parametro numerico → tolleranza 1 → 2 (nella direzione
//           dichiarata dal fatto); con più fatti, se ne toglie uno (ma
//           questo allentamento non si combina con altri)
//
// Si toccano al più `gradoMassimo` slot (2): tutti i singoli, poi le coppie.
//
// Un'occorrenza compare UNA volta sola, nel gruppo più vicino in cui
// regge: i gruppi più lontani mostrano solo i casi NUOVI. La situazione
// esatta è il gruppo a distanza 0, e se è vuoto resta ("mai successo").

import { fattoById } from "./fatti";
import { valuta, type Occorrenza, type Risposta, type Situazione } from "./motore";
import type { Tabelle } from "./tabelle";

export interface PesiAllentamento {
  chi: number;
  dove: number;
  doveStessoPaese: number;
  quando: number;
  quandoStessoDecennio: number;
  cosaParametro: number;
  cosaFatto: number;
  gradoMassimo: number;
}

export type SlotAllentato = "chi" | "dove" | "quando" | "cosa";

export interface Allentamento {
  slot: SlotAllentato;
  grado: number;
  peso: number;
  // togliere un fatto si fa SOLO da solo: combinato con altro produce
  // gruppi senza significato ("senza vince, un altro pilota" = tutti)
  soloDaSolo?: boolean;
  // in chiaro: "altro pilota", "stesso paese, altro circuito", "partito 9° o peggio"
  etichetta: string;
  applica: (s: Situazione) => Situazione;
}

export interface Gruppo {
  chiave: string;
  distanza: number;
  allentamenti: Allentamento[];
  risposta: Risposta;
  // le occorrenze che NON erano già in un gruppo più vicino
  nuove: Occorrenza[];
}

export interface Reticolo {
  esatto: Gruppo;
  gruppi: Gruppo[]; // a distanza > 0, ordinati per distanza crescente
}

interface Contesto {
  paeseDiCircuito: (ref: string) => string | undefined;
}

// Le catene di allentamento per ogni slot pieno della situazione. Ogni
// catena è ordinata per grado: il grado 2 include il grado 1.
function catene(s: Situazione, pesi: PesiAllentamento, ctx: Contesto): Allentamento[][] {
  const out: Allentamento[][] = [];

  if (s.chi) {
    out.push([{
      slot: "chi", grado: 1, peso: pesi.chi,
      etichetta: s.chi.tipo === "pilota" ? "un altro pilota" : "un altro team",
      applica: (x) => ({ ...x, chi: undefined }),
    }]);
  }

  if (s.dove) {
    const c: Allentamento[] = [];
    if (s.dove.tipo === "circuito") {
      const paese = ctx.paeseDiCircuito(s.dove.circuitRef);
      if (paese) {
        c.push({
          slot: "dove", grado: 1, peso: pesi.doveStessoPaese,
          etichetta: `un altro circuito in ${paese}`,
          applica: (x) => ({ ...x, dove: { tipo: "paese", paese } }),
        });
      }
    }
    c.push({
      slot: "dove", grado: c.length + 1, peso: pesi.dove,
      etichetta: "un altro circuito",
      applica: (x) => ({ ...x, dove: undefined }),
    });
    out.push(c);
  }

  if (s.quando) {
    const c: Allentamento[] = [];
    if (s.quando.tipo === "anno") {
      const annoDa = Math.floor(s.quando.anno / 10) * 10;
      c.push({
        slot: "quando", grado: 1, peso: pesi.quandoStessoDecennio,
        etichetta: `un altro anno degli anni ${annoDa}`,
        applica: (x) => ({ ...x, quando: { tipo: "decennio", annoDa } }),
      });
    }
    c.push({
      slot: "quando", grado: c.length + 1, peso: pesi.quando,
      etichetta: "un'altra epoca",
      applica: (x) => ({ ...x, quando: undefined }),
    });
    out.push(c);
  }

  s.cosa.forEach((c, k) => {
    const f = fattoById(c.id);
    if (!f.parametro) return;
    const chain: Allentamento[] = [];
    for (let t = 1; t <= 2; t++) {
      const allentato = { ...c, tolleranza: t };
      chain.push({
        slot: "cosa", grado: t, peso: pesi.cosaParametro * t,
        etichetta: etichettaAllentata(f.id, allentato),
        applica: (x) => ({ ...x, cosa: x.cosa.map((y, j) => (j === k ? allentato : y)) }),
      });
    }
    out.push(chain);
  });

  if (s.cosa.length >= 2) {
    s.cosa.forEach((c, k) => {
      const f = fattoById(c.id);
      out.push([{
        slot: "cosa", grado: 1, peso: pesi.cosaFatto, soloDaSolo: true,
        etichetta: `senza "${f.etichetta(c.parametro ?? f.parametro?.default ?? 0)}"`,
        applica: (x) => ({ ...x, cosa: x.cosa.filter((_, j) => j !== k) }),
      }]);
    });
  }

  return out;
}

function etichettaAllentata(id: string, c: { parametro?: number; tolleranza?: number }): string {
  const f = fattoById(id);
  const spec = f.parametro!;
  const p = c.parametro ?? spec.default;
  const t = c.tolleranza ?? 0;
  const clamp = (v: number) => Math.min(spec.max, Math.max(spec.min, v));
  if (spec.allenta === "giu") return f.etichetta(clamp(p - t));
  if (spec.allenta === "su") return f.etichetta(clamp(p + t));
  return `${f.etichetta(clamp(p - t))} … ${clamp(p + t)}${spec.tipo === "posizione" ? "°" : ""}`;
}

function chiaveOccorrenza(o: Occorrenza): string {
  return o.riga !== null ? `r${o.riga}` : `g${o.garaIdx}`;
}

export function costruisciReticolo(tab: Tabelle, s: Situazione, pesi: PesiAllentamento, ctx: Contesto): Reticolo {
  const esattoRisposta = valuta(tab, s);
  const viste = new Set(esattoRisposta.occorrenze.map(chiaveOccorrenza));
  const esatto: Gruppo = { chiave: "esatto", distanza: 0, allentamenti: [], risposta: esattoRisposta, nuove: esattoRisposta.occorrenze };

  const chains = catene(s, pesi, ctx);
  // Tutte le combinazioni che toccano al più `gradoMassimo` catene (uno
  // slot alla volta, poi due): da ogni catena si prende "niente" oppure un
  // allentamento, di qualunque grado. Gli allentamenti `soloDaSolo` non si
  // combinano.
  const combinazioni: Allentamento[][] = [];
  const ricorsione = (i: number, scelti: Allentamento[]) => {
    if (i === chains.length) {
      if (scelti.length > 0) combinazioni.push(scelti);
      return;
    }
    ricorsione(i + 1, scelti);
    if (scelti.length >= pesi.gradoMassimo) return;
    if (scelti.some((a) => a.soloDaSolo)) return;
    for (const a of chains[i]) {
      if (a.soloDaSolo && scelti.length > 0) continue;
      ricorsione(i + 1, [...scelti, a]);
    }
  };
  ricorsione(0, []);

  const gruppi: Gruppo[] = combinazioni.map((alls) => {
    const sit = alls.reduce((x, a) => a.applica(x), s);
    const risposta = valuta(tab, sit);
    return {
      chiave: alls.map((a) => `${a.slot}${a.grado}:${a.etichetta}`).join("|"),
      distanza: alls.reduce((d, a) => d + a.peso, 0),
      allentamenti: alls,
      risposta,
      nuove: [],
    };
  });
  gruppi.sort((a, b) => a.distanza - b.distanza || b.risposta.n - a.risposta.n);
  for (const gr of gruppi) {
    for (const o of gr.risposta.occorrenze) {
      const k = chiaveOccorrenza(o);
      if (viste.has(k)) continue;
      viste.add(k);
      gr.nuove.push(o);
    }
  }
  return { esatto, gruppi };
}

// La frase del gruppo: "stesso fatto, un altro pilota" / "stesso fatto, un
// altro pilota e un altro circuito".
export function etichettaGruppo(g: Gruppo): string {
  if (g.allentamenti.length === 0) return "uguale";
  return g.allentamenti.map((a) => a.etichetta).join(" e ");
}
