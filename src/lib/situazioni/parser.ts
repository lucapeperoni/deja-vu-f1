// Il parser del testo libero (Déjà vu v4, docs/PROGETTAZIONE-v4.md §7.1;
// roadmap D3.2): "hamilton vince monza dalla decima" → i quattro slot.
//
// Regole a dizionario, nessun modello: si cercano nel testo, nell'ordine,
// (1) i nomi (piloti, team, circuiti, paesi, dai dizionari della pipeline),
// (2) le epoche (anno, "anni 70", nome di un'era), (3) i fatti tramite i
// sinonimi dichiarati accanto a ogni predicato in fatti.ts, (4) i numeri
// (cifre e ordinali in lettere) assegnati al fatto parametrico più vicino.
// Quello che resta si restituisce come `nonCapito`: la UI lo mostra, non
// lo indovina.
//
// La risposta porta anche `letture`: per ogni slot riempito, il pezzo di
// testo che l'ha prodotto, così la frase "Ho letto: pilota Hamilton · fatto
// vince, partito 10° o peggio · circuito Monza" è verificabile a vista.

import { FATTI, fattoById, type Fatto } from "./fatti";
import type { Situazione } from "./motore";
import { PAESI_IT } from "./paesi";
import type { DizionariJson } from "./tabelle";
import { ERE } from "./ere";

export interface Lettura {
  slot: "chi" | "cosa" | "dove" | "quando";
  testo: string; // le parole del testo che hanno prodotto lo slot
  valore: string; // in chiaro
}

export interface Esito {
  situazione: Situazione;
  letture: Lettura[];
  nonCapito: string[];
}

function normalizza(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, " ");
}

const ORDINALI: Record<string, number> = {
  primo: 1, prima: 1, secondo: 2, seconda: 2, terzo: 3, terza: 3, quarto: 4, quarta: 4, quinto: 5, quinta: 5,
  sesto: 6, sesta: 6, settimo: 7, settima: 7, ottavo: 8, ottava: 8, nono: 9, nona: 9, decimo: 10, decima: 10,
  undicesimo: 11, undicesima: 11, dodicesimo: 12, dodicesima: 12, tredicesimo: 13, tredicesima: 13,
  quattordicesimo: 14, quattordicesima: 14, quindicesimo: 15, quindicesima: 15, sedicesimo: 16, sedicesima: 16,
  diciassettesimo: 17, diciassettesima: 17, diciottesimo: 18, diciottesima: 18, diciannovesimo: 19, diciannovesima: 19,
  ventesimo: 20, ventesima: 20, ultimo: 20, ultima: 20,
};
const CARDINALI: Record<string, number> = {
  una: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
  undici: 11, dodici: 12, quindici: 15, venti: 20, trenta: 30,
};
const DECENNI: Record<string, number> = {
  cinquanta: 1950, sessanta: 1960, settanta: 1970, ottanta: 1980, novanta: 1990, duemila: 2000, duemiladieci: 2010, duemilaventi: 2020,
};

// Un numero nel testo: "10", "10°", "10a", "p10", "decima", "dieci".
function numero(tok: string): number | null {
  const m = tok.match(/^p?(\d{1,2})[°ºa]?$/);
  if (m) return Number(m[1]);
  if (tok in ORDINALI) return ORDINALI[tok];
  if (tok in CARDINALI) return CARDINALI[tok];
  return null;
}

interface Voce {
  parole: string[]; // già normalizzate
  applica: (s: Situazione) => Situazione;
  slot: Lettura["slot"];
  valore: string;
}

function vociNomi(d: DizionariJson): Voce[] {
  const v: Voce[] = [];
  // Piloti: cognome, nome+cognome, codice a tre lettere. I dizionari sono
  // ordinati per attività recente, quindi il primo "hamilton" è Lewis: le
  // voci con lo stesso cognome si tengono tutte ma la prima vince a parità.
  for (const p of d.piloti) {
    const cognome = normalizza(p.cognome).split(" ");
    v.push({ parole: normalizza(p.nome).split(" "), applica: (s) => ({ ...s, chi: { tipo: "pilota", driverId: p.id } }), slot: "chi", valore: p.nome });
    v.push({ parole: cognome, applica: (s) => ({ ...s, chi: { tipo: "pilota", driverId: p.id } }), slot: "chi", valore: p.nome });
    if (p.codice) v.push({ parole: [normalizza(p.codice)], applica: (s) => ({ ...s, chi: { tipo: "pilota", driverId: p.id } }), slot: "chi", valore: p.nome });
  }
  for (const t of d.team) {
    v.push({ parole: normalizza(t.nome).split(" "), applica: (s) => ({ ...s, chi: { tipo: "team", constructorId: t.id } }), slot: "chi", valore: t.nome });
  }
  const nomiPaese = new Set(Object.values(PAESI_IT).map(normalizza));
  for (const c of d.circuiti) {
    for (const sin of c.sinonimi) {
      // "Italia" è un sinonimo utile nello slot Dove (trova Monza), ma nel
      // testo libero "in italia" vuol dire il paese, non un circuito
      if (nomiPaese.has(normalizza(sin))) continue;
      v.push({ parole: normalizza(sin).split(/[\s-]+/), applica: (s) => ({ ...s, dove: { tipo: "circuito", circuitRef: c.ref } }), slot: "dove", valore: c.nome });
    }
  }
  for (const [en, it] of Object.entries(PAESI_IT)) {
    v.push({ parole: normalizza(it).split(" "), applica: (s) => ({ ...s, dove: { tipo: "paese", paese: en } }), slot: "dove", valore: it });
  }
  for (const e of ERE) {
    v.push({ parole: normalizza(e.etichetta).split(" "), applica: (s) => ({ ...s, quando: { tipo: "era", annoDa: e.annoDa, annoA: e.annoA } }), slot: "quando", valore: e.etichetta });
  }
  return v;
}

// Parole che i sinonimi dei fatti condividono con i nomi dei circuiti o dei
// paesi: nel dubbio vince il nome ("Monza" prima di tutto), poi il fatto.
// I sinonimi più lunghi si provano prima ("prima vittoria" prima di "prima").
function vociFatti(): { parole: string[]; fatto: Fatto }[] {
  const out: { parole: string[]; fatto: Fatto }[] = [];
  for (const f of FATTI) for (const sin of f.sinonimi) out.push({ parole: normalizza(sin).split(" "), fatto: f });
  return out.sort((a, b) => b.parole.length - a.parole.length);
}

// "dalla decima" / "dal 10" / "partito 10" / "griglia 10" → partito 10°;
// seguito da "o peggio"/"in giu"/"o oltre" → 10° o peggio; "o meglio" → o meglio.
// "arriva/finisce/chiude 3" → arriva 3°. Un ordinale da solo → arriva P.
const PAROLE_GRIGLIA = new Set(["dalla", "dal", "partito", "partita", "partendo", "parte", "griglia", "casella", "da"]);
const RIEMPITIVI = new Set(["entro", "il", "al", "giro", "giri", "di", "la", "le", "almeno", "piu", "oltre", "meno", "posizioni", "posizione", "soste", "secondi", "s", "con"]);
const PAROLE_ARRIVO = new Set(["arriva", "arrivato", "arrivata", "finisce", "chiude", "classificato", "termina", "posto", "posizione"]);

export function analizza(testo: string, d: DizionariJson): Esito {
  const tokens = normalizza(testo).split(/[^a-z0-9°º]+/).filter(Boolean);
  const usato = new Array<boolean>(tokens.length).fill(false);
  let s: Situazione = { cosa: [] };
  const letture: Lettura[] = [];

  const prova = (parole: string[], da: number) => parole.every((p, k) => tokens[da + k] === p && !usato[da + k]);
  const segna = (da: number, n: number) => {
    for (let k = 0; k < n; k++) usato[da + k] = true;
  };

  // l'ultima parola del testo, se non seguita da uno spazio, è ancora in
  // scrittura: "hami" può diventare "hamilton", non serve finirla di
  // digitare per farla riconoscere
  const inScrittura = tokens.length > 0 && !/\s$/.test(testo);
  const ultimoToken = tokens.length - 1;
  const provaConPrefisso = (parole: string[], da: number) =>
    parole.every((p, k) => {
      if (usato[da + k]) return false;
      const tok = tokens[da + k];
      if (tok === undefined) return false;
      if (inScrittura && da + k === ultimoToken && k === parole.length - 1) {
        // la parola intera vale sempre ("v8"); il prefisso solo da 3 lettere
        return tok === p || (tok.length >= 3 && p.startsWith(tok));
      }
      return tok === p;
    });

  // 1. nomi (le voci più lunghe prima: "lewis hamilton" batte "hamilton",
  //    "spa francorchamps" batte "spa")
  const nomi = vociNomi(d).sort((a, b) => b.parole.length - a.parole.length);
  const slotPieno = (slot: Lettura["slot"]) => letture.some((l) => l.slot === slot);
  for (let i = 0; i < tokens.length; i++) {
    if (usato[i]) continue;
    for (const v of nomi) {
      if (v.parole.length === 0 || slotPieno(v.slot)) continue;
      if (provaConPrefisso(v.parole, i)) {
        s = v.applica(s);
        segna(i, v.parole.length);
        letture.push({ slot: v.slot, testo: tokens.slice(i, i + v.parole.length).join(" "), valore: v.valore });
        break;
      }
    }
  }

  // 2. epoche: anno a quattro cifre, "anni 70"/"anni settanta", "nel 2020"
  for (let i = 0; i < tokens.length; i++) {
    if (usato[i] || slotPieno("quando")) continue;
    const t = tokens[i];
    const anno = t.match(/^(19[5-9]\d|20[0-2]\d)$/);
    if (anno) {
      s = { ...s, quando: { tipo: "anno", anno: Number(anno[1]) } };
      segna(i, 1);
      letture.push({ slot: "quando", testo: t, valore: `nel ${anno[1]}` });
      continue;
    }
    if (t === "anni" && tokens[i + 1] !== undefined && !usato[i + 1]) {
      const n = tokens[i + 1];
      let annoDa: number | null = null;
      if (n in DECENNI) annoDa = DECENNI[n];
      else if (/^\d{2}$/.test(n)) annoDa = Number(n) >= 50 ? 1900 + Number(n) : 2000 + Number(n);
      else if (/^(19[5-9]0|20[0-2]0)$/.test(n)) annoDa = Number(n);
      if (annoDa !== null) {
        s = { ...s, quando: { tipo: "decennio", annoDa } };
        segna(i, 2);
        letture.push({ slot: "quando", testo: `${t} ${n}`, valore: `anni ${annoDa}` });
      }
    }
  }

  // 3. fatti per sinonimo (i più lunghi prima)
  const fattiTrovati: { fatto: Fatto; da: number; a: number; parametro?: number }[] = [];
  const fattiV = vociFatti();
  for (let i = 0; i < tokens.length; i++) {
    if (usato[i]) continue;
    for (const v of fattiV) {
      if (prova(v.parole, i)) {
        // "prima vittoria" prende il fatto, ma "prima" da solo davanti a
        // "fila"/"vittoria" è già coperto dai sinonimi lunghi
        fattiTrovati.push({ fatto: v.fatto, da: i, a: i + v.parole.length });
        segna(i, v.parole.length);
        i += v.parole.length - 1;
        break;
      }
    }
  }

  // 4. numeri: ognuno va al fatto parametrico adiacente, oppure crea
  //    "partito P" / "arriva P" a seconda della parola che lo precede
  for (let i = 0; i < tokens.length; i++) {
    if (usato[i]) continue;
    const n = numero(tokens[i]);
    if (n === null) continue;
    const prec = i > 0 ? tokens[i - 1] : "";
    const segue = tokens.slice(i + 1, i + 3).join(" ");
    const peggio = /^(o peggio|in giu|o oltre|o piu indietro|o dietro)/.test(segue);
    const meglio = /^(o meglio|in su|o davanti)/.test(segue);
    const consumaCoda = () => {
      if (peggio || meglio) segna(i + 1, 2);
    };

    // un fatto parametrico appena prima (anche con parole di riempimento
    // in mezzo: "al comando entro il giro 28", "guadagna almeno 8") o
    // subito dopo ("3 soste"), senza parametro
    const riempitivo = (t: string) => RIEMPITIVI.has(t);
    const vicino = fattiTrovati.find((f) => {
      if (f.parametro !== undefined || !f.fatto.parametro) return false;
      if (f.da === i + 1 || f.da === i + 2) return true;
      if (f.a > i) return false;
      return tokens.slice(f.a, i).every(riempitivo);
    });
    if (vicino && !PAROLE_GRIGLIA.has(prec) && !PAROLE_ARRIVO.has(prec)) {
      vicino.parametro = n;
      segna(i, 1);
      continue;
    }
    if (PAROLE_GRIGLIA.has(prec) || prec === "p" || /^p\d/.test(tokens[i])) {
      const id = peggio ? "parte_o_peggio" : meglio ? "parte_o_meglio" : "parte";
      fattiTrovati.push({ fatto: fattoById(id), da: i - 1, a: i + 1, parametro: n });
      segna(i, 1);
      if (PAROLE_GRIGLIA.has(prec)) usato[i - 1] = true;
      consumaCoda();
      continue;
    }
    if (PAROLE_ARRIVO.has(prec) || tokens[i] in ORDINALI) {
      const id = peggio ? "arriva_o_peggio" : meglio ? "arriva_o_meglio" : "arriva";
      // "vince" già presente + "primo": non duplicare
      if (n === 1 && id === "arriva" && fattiTrovati.some((f) => f.fatto.id === "vince")) {
        segna(i, 1);
        continue;
      }
      fattiTrovati.push({ fatto: fattoById(id), da: i, a: i + 1, parametro: n });
      segna(i, 1);
      if (PAROLE_ARRIVO.has(prec)) usato[i - 1] = true;
      consumaCoda();
      continue;
    }
  }

  // "partito" senza numero seguito da "o peggio"? niente. "dalla pole" è già
  // un sinonimo. Un "parte" generico senza numero non è un fatto: si scarta.
  const fattiBuoni = fattiTrovati.filter((f) => !(f.fatto.parametro && f.parametro === undefined && f.fatto.id === "parte"));
  fattiBuoni.sort((a, b) => a.da - b.da);
  // un fatto "arriva P" con "o peggio" scritto dopo un "partito": già gestito sopra
  const cosa = fattiBuoni.map((f) => ({ id: f.fatto.id, parametro: f.parametro ?? f.fatto.parametro?.default }));
  // niente duplicati dello stesso fatto; e un fatto generico non si tiene
  // accanto alla sua versione specifica ("ritiro" + "ritiro al primo giro")
  const visti = new Set<string>();
  const ids = new Set(cosa.map((c) => c.id));
  const generico = (id: string) => id === "ritiro" && [...ids].some((x) => x.startsWith("ritiro_"));
  s = { ...s, cosa: cosa.filter((c) => (visti.has(c.id) || generico(c.id) ? false : (visti.add(c.id), true))) };
  for (const f of fattiBuoni) {
    letture.push({ slot: "cosa", testo: tokens.slice(f.da, f.a).join(" "), valore: f.fatto.etichetta(f.parametro ?? f.fatto.parametro?.default ?? 0) });
  }

  // parole di servizio che non dicono niente
  const STOP = new Set(["a", "al", "alla", "allo", "il", "lo", "la", "i", "gli", "le", "di", "del", "della", "in", "nel", "nella", "con", "e", "ed", "che", "un", "una", "o", "su", "per", "da", "dal", "dalla", "gp", "gran", "premio", "gara", "posizione", "posto", "volte", "volta", "negli", "nei", "nell", "all", "dell", "e"]);
  const nonCapito = tokens.filter((t, i) => !usato[i] && !STOP.has(t) && !RIEMPITIVI.has(t));
  const situazione: Situazione = { chi: s.chi, cosa: s.cosa, dove: s.dove, quando: s.quando };
  return { situazione, letture, nonCapito };
}
