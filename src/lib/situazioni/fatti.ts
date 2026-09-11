// Il vocabolario dei FATTI (Déjà vu v4, docs/PROGETTAZIONE-v4.md §4).
//
// Un fatto è un predicato con al più un parametro, valutato su una riga di
// `Risultati` (unità: pilota×gara) o di `Gare` (unità: gara). Non è
// precalcolato per valore: si valuta sul momento, nel browser.
//
// Tre esiti, mai due: `true` (regge), `false` (non regge), `null` (NON
// VALUTABILE: il campo manca o è fuori dalla finestra di copertura). Una
// riga non valutabile esce dal denominatore invece di contare come "non è
// successo" — è la trappola 3 della v3 ("campi vuoti"), applicata fatto per
// fatto. Le finestre non si scrivono qui: ogni fatto dichiara le COLONNE da
// cui dipende e la finestra è l'intersezione di quelle colonne
// (`meta.finestre` della pipeline), così il numero non può mentire.
//
// I sinonimi stanno accanto al predicato, non in un JSON a parte: parser
// (D3.2) e motore leggono la stessa lista.

import { HA_PRESO_IL_VIA, STATO, type Gare, type Risultati } from "./tabelle";

export type UnitaFatto = "risultato" | "gara";

export interface ParametroSpec {
  nome: string;
  // come si legge nell'etichetta: "10°", "3 giri", "5 s"
  tipo: "posizione" | "numero" | "giro" | "secondi";
  default: number;
  min: number;
  max: number;
  // In che direzione il parametro si ALLENTA nel reticolo dei déjà vu
  // (reticolo.ts): "giu" = una soglia "P o peggio / almeno N" regge per
  // più righe se P scende; "su" = "P o meglio / entro il giro L" se sale;
  // "intorno" = un valore esatto ("arriva 5°") si allarga a 4°-6°.
  allenta: "giu" | "su" | "intorno";
}

export type Esito = boolean | null;

export interface Fatto {
  id: string;
  unita: UnitaFatto;
  // etichetta in chiaro, con il parametro già dentro
  etichetta: (p: number) => string;
  parametro?: ParametroSpec;
  colonne: string[];
  // true se in una gara può reggere per UNA sola riga (vince, pole, giro
  // veloce): allora il denominatore naturale è "gare", non "risultati"
  unico?: boolean;
  sinonimi: string[];
  // valutazione su una riga di risultati (i = indice riga) o di gare (g)
  testRisultato?: (r: Risultati, i: number, p: number) => Esito;
  testGara?: (g: Gare, gi: number, p: number) => Esito;
}

const pos = (n: number) => `${n}°`;

// "partito P o peggio" con partenza dalla pit lane: la pit lane è peggio di
// qualunque casella, quindi regge; con griglia sconosciuta e niente pit
// lane, non si sa.
function griglia(r: Risultati, i: number): number | null {
  return r.griglia[i];
}

export const FATTI: Fatto[] = [
  // ---- arrivo -----------------------------------------------------------
  {
    id: "vince", unita: "risultato", unico: true, colonne: ["arrivo", "statoCat"],
    etichetta: () => "vince", sinonimi: ["vince", "vittoria", "vinto", "primo", "1°", "p1"],
    testRisultato: (r, i) => r.arrivo[i] === 1,
  },
  {
    id: "podio", unita: "risultato", colonne: ["arrivo", "statoCat"],
    etichetta: () => "sale sul podio", sinonimi: ["podio", "sul podio", "top 3", "top3"],
    testRisultato: (r, i) => r.arrivo[i] !== null && r.arrivo[i]! <= 3,
  },
  {
    id: "a_punti", unita: "risultato", colonne: ["punti", "statoCat"],
    etichetta: () => "va a punti", sinonimi: ["a punti", "punti", "zona punti"],
    testRisultato: (r, i) => r.punti[i] > 0,
  },
  {
    id: "arriva", unita: "risultato", colonne: ["arrivo", "statoCat"],
    parametro: { nome: "P", tipo: "posizione", default: 2, min: 1, max: 30 , allenta: "intorno" },
    etichetta: (p) => `arriva ${pos(p)}`, sinonimi: ["arriva", "arrivato", "finisce", "chiude", "classificato"],
    testRisultato: (r, i, p) => r.arrivo[i] === p,
  },
  {
    id: "arriva_o_meglio", unita: "risultato", colonne: ["arrivo", "statoCat"],
    parametro: { nome: "P", tipo: "posizione", default: 5, min: 1, max: 30 , allenta: "su" },
    etichetta: (p) => `arriva ${pos(p)} o meglio`, sinonimi: ["o meglio", "almeno", "top"],
    testRisultato: (r, i, p) => r.arrivo[i] !== null && r.arrivo[i]! <= p,
  },
  {
    id: "arriva_o_peggio", unita: "risultato", colonne: ["arrivo", "statoCat"],
    parametro: { nome: "P", tipo: "posizione", default: 10, min: 1, max: 30 , allenta: "giu" },
    etichetta: (p) => `arriva ${pos(p)} o peggio`, sinonimi: ["o peggio", "oltre"],
    // un ritirato è "peggio" di qualunque posizione: regge
    testRisultato: (r, i, p) => (r.arrivo[i] !== null ? r.arrivo[i]! >= p : HA_PRESO_IL_VIA.has(r.statoCat[i]) ? true : null),
  },
  // ---- griglia ----------------------------------------------------------
  {
    id: "parte", unita: "risultato", colonne: ["griglia"],
    parametro: { nome: "P", tipo: "posizione", default: 5, min: 1, max: 30 , allenta: "intorno" },
    etichetta: (p) => `partito ${pos(p)}`, sinonimi: ["parte", "partito", "partendo", "dalla", "dal", "griglia", "casella"],
    testRisultato: (r, i, p) => (griglia(r, i) === null ? null : griglia(r, i) === p),
  },
  {
    id: "parte_o_meglio", unita: "risultato", colonne: ["griglia"],
    parametro: { nome: "P", tipo: "posizione", default: 3, min: 1, max: 30 , allenta: "su" },
    etichetta: (p) => `partito ${pos(p)} o meglio`, sinonimi: ["partito o meglio", "prime file"],
    testRisultato: (r, i, p) => (griglia(r, i) === null ? null : griglia(r, i)! <= p),
  },
  {
    id: "parte_o_peggio", unita: "risultato", colonne: ["griglia"],
    parametro: { nome: "P", tipo: "posizione", default: 10, min: 1, max: 30 , allenta: "giu" },
    etichetta: (p) => `partito ${pos(p)} o peggio`, sinonimi: ["partito o peggio", "dal fondo", "dalle retrovie", "rimonta"],
    testRisultato: (r, i, p) => (griglia(r, i) !== null ? griglia(r, i)! >= p : r.pitLane[i] === 1 ? true : null),
  },
  {
    id: "pole", unita: "risultato", unico: true, colonne: ["griglia"],
    etichetta: () => "parte dalla pole", sinonimi: ["pole", "pole position", "dalla pole", "in pole"],
    testRisultato: (r, i) => (griglia(r, i) === null ? null : griglia(r, i) === 1),
  },
  {
    id: "prima_fila", unita: "risultato", colonne: ["griglia"],
    etichetta: () => "parte dalla prima fila", sinonimi: ["prima fila"],
    testRisultato: (r, i) => (griglia(r, i) === null ? null : griglia(r, i)! <= 2),
  },
  {
    id: "pit_lane", unita: "risultato", colonne: ["pitLane"],
    etichetta: () => "parte dalla pit lane", sinonimi: ["pit lane", "dalla pit lane", "dai box"],
    testRisultato: (r, i) => r.pitLane[i] === 1,
  },
  {
    id: "guadagna_posizioni", unita: "risultato", colonne: ["griglia", "arrivo"],
    parametro: { nome: "N", tipo: "numero", default: 5, min: 1, max: 30 , allenta: "giu" },
    etichetta: (p) => `guadagna almeno ${p} posizioni`, sinonimi: ["guadagna", "recupera", "rimonta di", "posizioni guadagnate"],
    testRisultato: (r, i, p) => (griglia(r, i) === null || r.arrivo[i] === null ? null : griglia(r, i)! - r.arrivo[i]! >= p),
  },
  {
    id: "perde_posizioni", unita: "risultato", colonne: ["griglia", "arrivo"],
    parametro: { nome: "N", tipo: "numero", default: 5, min: 1, max: 30 , allenta: "giu" },
    etichetta: (p) => `perde almeno ${p} posizioni`, sinonimi: ["perde", "perse", "posizioni perse", "crolla"],
    testRisultato: (r, i, p) => (griglia(r, i) === null || r.arrivo[i] === null ? null : r.arrivo[i]! - griglia(r, i)! >= p),
  },
  // ---- ritiri -----------------------------------------------------------
  {
    id: "ritiro", unita: "risultato", colonne: ["statoCat"],
    etichetta: () => "si ritira", sinonimi: ["ritiro", "si ritira", "ritirato", "out", "dnf", "fuori"],
    testRisultato: (r, i) => r.statoCat[i] === STATO.RITIRO_TECNICO || r.statoCat[i] === STATO.RITIRO_INCIDENTE,
  },
  {
    id: "ritiro_incidente", unita: "risultato", colonne: ["statoCat"],
    etichetta: () => "si ritira per incidente", sinonimi: ["incidente", "contatto", "collisione", "a muro", "testacoda"],
    testRisultato: (r, i) => r.statoCat[i] === STATO.RITIRO_INCIDENTE,
  },
  {
    id: "ritiro_tecnico", unita: "risultato", colonne: ["statoCat"],
    etichetta: () => "si ritira per guasto", sinonimi: ["guasto", "rottura", "motore", "problema tecnico", "cambio", "idraulica"],
    testRisultato: (r, i) => r.statoCat[i] === STATO.RITIRO_TECNICO,
  },
  {
    id: "ritiro_entro_giro", unita: "risultato", colonne: ["statoCat", "giri"],
    parametro: { nome: "L", tipo: "giro", default: 1, min: 0, max: 80 , allenta: "su" },
    etichetta: (p) => (p === 0 ? "si ritira al via" : `si ritira entro il giro ${p}`),
    sinonimi: ["ritiro al giro", "al primo giro", "al via", "subito fuori"],
    testRisultato: (r, i, p) => {
      const rit = r.statoCat[i] === STATO.RITIRO_TECNICO || r.statoCat[i] === STATO.RITIRO_INCIDENTE;
      if (!rit) return false;
      return r.giri[i] === null ? null : r.giri[i]! <= p;
    },
  },
  {
    id: "non_parte", unita: "risultato", colonne: ["statoCat"],
    etichetta: () => "non prende il via", sinonimi: ["non parte", "non partito", "dns", "ritirato prima del via"],
    testRisultato: (r, i) => r.statoCat[i] === STATO.NON_PARTITO,
  },
  // ---- giro veloce, qualifica ------------------------------------------
  {
    id: "giro_veloce", unita: "risultato", unico: true, colonne: ["giroVeloceRank"],
    etichetta: () => "fa il giro veloce", sinonimi: ["giro veloce", "giro più veloce", "fastest lap"],
    testRisultato: (r, i) => (r.giroVeloceRank[i] === null ? null : r.giroVeloceRank[i] === 1),
  },
  {
    id: "qualifica_o_peggio", unita: "risultato", colonne: ["posQualifica"],
    parametro: { nome: "P", tipo: "posizione", default: 15, min: 1, max: 30 , allenta: "giu" },
    etichetta: (p) => `in qualifica ${pos(p)} o peggio`, sinonimi: ["qualifica", "qualificato", "in qualifica"],
    testRisultato: (r, i, p) => (r.posQualifica[i] === null ? null : r.posQualifica[i]! >= p),
  },
  // ---- compagno ---------------------------------------------------------
  {
    id: "batte_compagno", unita: "risultato", colonne: ["ordine", "ordineCompagno"],
    etichetta: () => "batte il compagno", sinonimi: ["batte il compagno", "davanti al compagno", "compagno"],
    testRisultato: (r, i) => (r.ordineCompagno[i] === null ? null : r.ordine[i] < r.ordineCompagno[i]!),
  },
  {
    id: "battuto_da_compagno", unita: "risultato", colonne: ["ordine", "ordineCompagno"],
    etichetta: () => "è battuto dal compagno", sinonimi: ["dietro al compagno", "battuto dal compagno"],
    testRisultato: (r, i) => (r.ordineCompagno[i] === null ? null : r.ordine[i] > r.ordineCompagno[i]!),
  },
  // ---- carriera ---------------------------------------------------------
  {
    id: "debutto", unita: "risultato", colonne: ["gpInCarriera"],
    etichetta: () => "al debutto", sinonimi: ["debutto", "esordio", "prima gara", "primo gp", "debuttante"],
    testRisultato: (r, i) => r.gpInCarriera[i] === 1,
  },
  {
    id: "prima_vittoria", unita: "risultato", colonne: ["arrivo", "vittoriePrima"],
    etichetta: () => "prima vittoria in carriera", sinonimi: ["prima vittoria", "prima volta che vince", "prima vittoria in carriera"],
    testRisultato: (r, i) => r.arrivo[i] === 1 && r.vittoriePrima[i] === 0,
  },
  {
    id: "primo_podio", unita: "risultato", colonne: ["arrivo", "podiPrima"],
    etichetta: () => "primo podio in carriera", sinonimi: ["primo podio"],
    testRisultato: (r, i) => r.arrivo[i] !== null && r.arrivo[i]! <= 3 && r.podiPrima[i] === 0,
  },
  {
    id: "prima_pole", unita: "risultato", colonne: ["griglia", "polePrima"],
    etichetta: () => "prima pole in carriera", sinonimi: ["prima pole"],
    testRisultato: (r, i) => (griglia(r, i) === null ? null : griglia(r, i) === 1 && r.polePrima[i] === 0),
  },
  {
    id: "prima_vittoria_su_circuito", unita: "risultato", colonne: ["arrivo", "vittorieSuCircuitoPrima"],
    etichetta: () => "prima vittoria su questo circuito", sinonimi: ["prima vittoria qui", "prima volta su questo circuito"],
    testRisultato: (r, i) => r.arrivo[i] === 1 && r.vittorieSuCircuitoPrima[i] === 0,
  },
  {
    id: "gp_numero", unita: "risultato", colonne: ["gpInCarriera"],
    parametro: { nome: "N", tipo: "numero", default: 100, min: 1, max: 420 , allenta: "intorno" },
    etichetta: (p) => `al ${p}° GP in carriera`, sinonimi: ["gp numero", "gara numero", "gp in carriera"],
    testRisultato: (r, i, p) => r.gpInCarriera[i] === p,
  },
  // ---- in pista (tempi sul giro, 1996+) --------------------------------
  {
    id: "guadagna_al_via", unita: "risultato", colonne: ["griglia", "posDopoGiro1"],
    parametro: { nome: "N", tipo: "numero", default: 3, min: 1, max: 20 , allenta: "giu" },
    etichetta: (p) => `guadagna almeno ${p} posizioni al via`, sinonimi: ["al via", "alla partenza", "primo giro", "scatto"],
    testRisultato: (r, i, p) => (griglia(r, i) === null || r.posDopoGiro1[i] === null ? null : griglia(r, i)! - r.posDopoGiro1[i]! >= p),
  },
  {
    id: "al_comando_al_giro", unita: "risultato", colonne: ["primoGiroAlComando", "giriAlComando"],
    parametro: { nome: "L", tipo: "giro", default: 1, min: 1, max: 80 , allenta: "su" },
    etichetta: (p) => `al comando entro il giro ${p}`, sinonimi: ["al comando", "in testa", "leader", "prende la testa"],
    testRisultato: (r, i, p) => (r.giriAlComando[i] === null ? null : r.primoGiroAlComando[i] !== null && r.primoGiroAlComando[i]! <= p),
  },
  {
    id: "guida_almeno_giri", unita: "risultato", colonne: ["giriAlComando"],
    parametro: { nome: "N", tipo: "numero", default: 10, min: 1, max: 80 , allenta: "giu" },
    etichetta: (p) => `guida almeno ${p} giri`, sinonimi: ["giri al comando", "guida", "in testa per"],
    testRisultato: (r, i, p) => (r.giriAlComando[i] === null ? null : r.giriAlComando[i]! >= p),
  },
  {
    id: "vince_senza_guidare", unita: "risultato", unico: true, colonne: ["arrivo", "giriAlComando", "giri"],
    etichetta: () => "vince guidando solo l'ultimo giro", sinonimi: ["ultimo giro", "vince all'ultimo giro", "sorpasso finale"],
    testRisultato: (r, i) => {
      if (r.arrivo[i] !== 1) return false;
      if (r.giriAlComando[i] === null) return null;
      return r.giriAlComando[i] === 1;
    },
  },
  {
    id: "risale_da", unita: "risultato", colonne: ["posPeggiore", "arrivo"],
    parametro: { nome: "P", tipo: "posizione", default: 15, min: 2, max: 30 , allenta: "giu" },
    etichetta: (p) => `risale dalla ${pos(p)} posizione o peggio fino al podio`, sinonimi: ["risale", "dal fondo al podio", "dall'ultimo posto"],
    testRisultato: (r, i, p) => (r.posPeggiore[i] === null || r.arrivo[i] === null ? null : r.posPeggiore[i]! >= p && r.arrivo[i]! <= 3),
  },
  // ---- soste (2011+) ----------------------------------------------------
  {
    id: "soste", unita: "risultato", colonne: ["soste"],
    parametro: { nome: "N", tipo: "numero", default: 3, min: 0, max: 8 , allenta: "intorno" },
    etichetta: (p) => (p === 0 ? "senza fermarsi" : `con ${p} soste`), sinonimi: ["soste", "pit stop", "si ferma", "fermate", "senza fermarsi"],
    testRisultato: (r, i, p) => (r.soste[i] === null ? null : r.soste[i] === p),
  },
  {
    id: "soste_almeno", unita: "risultato", colonne: ["soste"],
    parametro: { nome: "N", tipo: "numero", default: 3, min: 1, max: 8 , allenta: "giu" },
    etichetta: (p) => `con almeno ${p} soste`, sinonimi: ["almeno soste", "più soste"],
    testRisultato: (r, i, p) => (r.soste[i] === null ? null : r.soste[i]! >= p),
  },
  {
    id: "sosta_entro_giro", unita: "risultato", colonne: ["giroPrimaSosta", "soste"],
    parametro: { nome: "L", tipo: "giro", default: 5, min: 1, max: 80 , allenta: "su" },
    etichetta: (p) => `prima sosta entro il giro ${p}`, sinonimi: ["prima sosta", "si ferma subito", "sosta anticipata", "undercut"],
    testRisultato: (r, i, p) => (r.soste[i] === null ? null : r.giroPrimaSosta[i] !== null && r.giroPrimaSosta[i]! <= p),
  },
  // ---- fatti sulla gara --------------------------------------------------
  {
    id: "doppietta", unita: "gara", colonne: ["doppietta"],
    etichetta: () => "doppietta dello stesso team", sinonimi: ["doppietta", "1-2", "uno-due"],
    testGara: (g, gi) => g.doppietta[gi] === 1,
  },
  {
    id: "tripletta", unita: "gara", colonne: ["tripletta"],
    etichetta: () => "tripletta dello stesso team", sinonimi: ["tripletta", "1-2-3"],
    testGara: (g, gi) => g.tripletta[gi] === 1,
  },
  {
    id: "nessun_cambio_leader", unita: "gara", colonne: ["cambiDiLeader"],
    etichetta: () => "nessun cambio al comando", sinonimi: ["nessun cambio", "mai sorpasso in testa", "leader unico", "dominio"],
    testGara: (g, gi) => (g.cambiDiLeader[gi] === null ? null : g.cambiDiLeader[gi] === 0),
  },
  {
    id: "almeno_n_leader", unita: "gara", colonne: ["leaderDiversi"],
    parametro: { nome: "N", tipo: "numero", default: 4, min: 2, max: 12 , allenta: "giu" },
    etichetta: (p) => `almeno ${p} piloti diversi al comando`, sinonimi: ["leader diversi", "piloti al comando", "gara pazza"],
    testGara: (g, gi, p) => (g.leaderDiversi[gi] === null ? null : g.leaderDiversi[gi]! >= p),
  },
  {
    id: "cambio_leader_ultimo_giro", unita: "gara", colonne: ["vittoriaUltimoGiro"],
    etichetta: () => "cambio di leader all'ultimo giro", sinonimi: ["ultimo giro", "decisa all'ultimo giro"],
    testGara: (g, gi) => (g.vittoriaUltimoGiro[gi] === null ? null : g.vittoriaUltimoGiro[gi] === 1),
  },
  {
    id: "meno_di_n_classificati", unita: "gara", colonne: ["classificati"],
    parametro: { nome: "N", tipo: "numero", default: 10, min: 1, max: 26 , allenta: "su" },
    etichetta: (p) => `meno di ${p} classificati`, sinonimi: ["classificati", "pochi al traguardo", "ecatombe"],
    testGara: (g, gi, p) => g.classificati[gi] < p,
  },
  {
    id: "nessun_ritiro", unita: "gara", colonne: ["ritiri"],
    etichetta: () => "nessun ritiro", sinonimi: ["nessun ritiro", "tutti al traguardo", "zero ritiri"],
    testGara: (g, gi) => g.ritiri[gi] === 0,
  },
  {
    id: "almeno_n_ritiri", unita: "gara", colonne: ["ritiri"],
    parametro: { nome: "N", tipo: "numero", default: 8, min: 1, max: 26 , allenta: "giu" },
    etichetta: (p) => `almeno ${p} ritiri`, sinonimi: ["ritiri", "tanti ritiri"],
    testGara: (g, gi, p) => g.ritiri[gi] >= p,
  },
  {
    id: "margine_sotto", unita: "gara", colonne: ["margineMs"],
    parametro: { nome: "S", tipo: "secondi", default: 1, min: 0, max: 60 , allenta: "su" },
    etichetta: (p) => `vinta con meno di ${p} s di margine`, sinonimi: ["margine", "volata", "fotofinish", "per un soffio", "distacco"],
    testGara: (g, gi, p) => (g.margineMs[gi] === null ? null : g.margineMs[gi]! < p * 1000),
  },
  {
    id: "margine_sopra", unita: "gara", colonne: ["margineMs"],
    parametro: { nome: "S", tipo: "secondi", default: 60, min: 0, max: 600 , allenta: "giu" },
    etichetta: (p) => `vinta con più di ${p} s di margine`, sinonimi: ["margine ampio", "dominio", "in solitaria"],
    testGara: (g, gi, p) => (g.margineMs[gi] === null ? null : g.margineMs[gi]! > p * 1000),
  },
  {
    id: "almeno_n_neutralizzazioni", unita: "gara", colonne: ["neutralizzazioni"],
    parametro: { nome: "N", tipo: "numero", default: 1, min: 1, max: 6 , allenta: "giu" },
    etichetta: (p) => (p === 1 ? "con almeno una Safety Car o VSC" : `con almeno ${p} neutralizzazioni`),
    sinonimi: ["safety car", "sc", "vsc", "neutralizzazione", "bandiera gialla"],
    testGara: (g, gi, p) => (g.neutralizzazioni[gi] === null ? null : g.neutralizzazioni[gi]! >= p),
  },
];

export const FATTI_BY_ID: Map<string, Fatto> = new Map(FATTI.map((f) => [f.id, f]));

export function fattoById(id: string): Fatto {
  const f = FATTI_BY_ID.get(id);
  if (!f) throw new Error(`fatto sconosciuto: ${id}`);
  return f;
}
