// La scheda di UNA gara, ricavata dalle tabelle delle situazioni (roadmap
// D7.7). Nessun dato nuovo: `gare.json` e `risultati.json` coprono tutte le
// 1125 gare dal 1950, colonna per colonna — qui si estrae la fetta di una
// gara sola e la si rimette in forma di righe leggibili.
//
// Modulo puro (niente `fs`, niente React): la pagina server lo chiama dopo
// `decodeTabelle`, e gli stessi numeri si possono verificare da script.
//
// Regola ereditata dalla pipeline: `null` = non lo sappiamo, MAI 0. Le
// colonne con una finestra di copertura (soste dal 2011, comando in pista
// dal 1996) sono nulle fuori da quella finestra, e la scheda non deve
// scrivere "0 soste" dove il dato non esiste: chi legge deve vedere la
// differenza fra "non si è fermato" e "non lo sappiamo".

import { HA_PRESO_IL_VIA, STATO, type DizionariJson, type Tabelle } from "./tabelle";

export interface RigaClassifica {
  driverId: number;
  pilota: string;
  codice: string | null;
  team: string;
  // posizione d'arrivo; null = non classificato (ritiro, squalifica…)
  arrivo: number | null;
  ordine: number;
  griglia: number | null;
  pitLane: boolean;
  giri: number | null;
  statoCat: number;
  // com'è finita, in chiaro: "al traguardo", "+1 giro", "motore", "contatto"
  stato: string;
  haFinito: boolean;
  distaccoDecimi: number | null;
  soste: number | null;
  punti: number;
  giroVeloce: boolean;
  posQualifica: number | null;
  giriAlComando: number | null;
  // griglia − arrivo: positivo = posizioni guadagnate
  guadagno: number | null;
  gpInCarriera: number;
  debutto: boolean;
  primaVittoria: boolean;
  primoPodio: boolean;
  primaPole: boolean;
}

export interface Momento {
  testo: string;
  pilota: string;
}

export interface SchedaGara {
  raceId: number;
  nome: string;
  anno: number;
  round: number;
  data: string;
  circuitRef: string;
  nomeCircuito: string;
  localita: string;
  paese: string;
  giriGara: number | null;
  partiti: number;
  classificati: number;
  ritiri: number;
  margineMs: number | null;
  doppietta: boolean;
  tripletta: boolean;
  cambiDiLeader: number | null;
  leaderDiversi: number | null;
  vittoriaUltimoGiro: boolean | null;
  neutralizzazioni: number | null;
  sosteMedie: number | null;
  classifica: RigaClassifica[];
  podio: RigaClassifica[];
  pole: RigaClassifica | null;
  giroVeloce: RigaClassifica | null;
  momenti: Momento[];
  // le tracce giro per giro esistono dal 1996 (544 gare)
  haTracce: boolean;
}

const ANNO_TRACCE = 1996;

export function costruisciScheda(
  tab: Tabelle,
  diz: DizionariJson,
  raceId: number,
  statusIt: Record<number, string>
): SchedaGara | null {
  const gi = tab.garaIdxByRaceId.get(raceId);
  if (gi === undefined) return null;
  const { risultati: r, gare: g } = tab;

  const piloti = new Map(diz.piloti.map((p) => [p.id, p]));
  const team = new Map(diz.team.map((t) => [t.id, t.nome]));
  const circuito = diz.circuiti.find((c) => c.ref === g.circuitRef[gi]);

  const righe: RigaClassifica[] = [];
  for (let i = g.rigaDa[gi]; i < g.rigaA[gi]; i++) {
    const p = piloti.get(r.driverId[i]);
    const arrivo = r.arrivo[i];
    const cat = r.statoCat[i];
    righe.push({
      driverId: r.driverId[i],
      pilota: p?.nome ?? `#${r.driverId[i]}`,
      codice: p?.codice ?? null,
      team: team.get(r.constructorId[i]) ?? "",
      arrivo,
      ordine: r.ordine[i],
      griglia: r.griglia[i],
      pitLane: r.pitLane[i] === 1,
      giri: r.giri[i],
      statoCat: cat,
      stato: statusIt[r.statusId[i]] ?? "",
      haFinito: arrivo !== null,
      distaccoDecimi: r.decimiDalVincitore[i],
      soste: r.soste[i],
      punti: r.punti[i],
      giroVeloce: r.giroVeloceRank[i] === 1,
      posQualifica: r.posQualifica[i],
      giriAlComando: r.giriAlComando[i],
      guadagno: r.griglia[i] !== null && arrivo !== null ? r.griglia[i]! - arrivo : null,
      gpInCarriera: r.gpInCarriera[i],
      debutto: r.gpInCarriera[i] === 1,
      primaVittoria: arrivo === 1 && r.vittoriePrima[i] === 0,
      primoPodio: arrivo !== null && arrivo <= 3 && r.podiPrima[i] === 0,
      primaPole: r.griglia[i] === 1 && r.polePrima[i] === 0,
    });
  }
  righe.sort((a, b) => a.ordine - b.ordine);

  const vincitore = righe.find((x) => x.arrivo === 1) ?? null;
  const podio = righe.filter((x) => x.arrivo !== null && x.arrivo <= 3);
  const pole = righe.find((x) => x.griglia === 1) ?? null;
  const giroVeloce = righe.find((x) => x.giroVeloce) ?? null;

  // I giri della gara = i giri del vincitore; se la gara non ha un vincitore
  // classificato (non è mai successo dal 1950, ma la colonna lo permette) si
  // prende il massimo, che è la stessa cosa senza dare niente per scontato.
  const giriGara = vincitore?.giri ?? righe.reduce<number | null>((m, x) => (x.giri !== null && (m === null || x.giri > m) ? x.giri : m), null);

  // Media delle soste fra chi ha preso il via e ha il dato (dal 2011). Se
  // nessuno ce l'ha, resta null: la gara è più vecchia della copertura.
  const conSoste = righe.filter((x) => x.soste !== null && HA_PRESO_IL_VIA.has(x.statoCat));
  const sosteMedie = conSoste.length ? conSoste.reduce((a, x) => a + x.soste!, 0) / conSoste.length : null;

  return {
    raceId,
    nome: g.nome[gi],
    anno: g.anno[gi],
    round: g.round[gi],
    data: g.data[gi],
    circuitRef: g.circuitRef[gi],
    nomeCircuito: circuito?.nome ?? g.circuitRef[gi],
    localita: circuito?.localita ?? "",
    paese: g.paese[gi],
    giriGara,
    partiti: g.partiti[gi],
    classificati: g.classificati[gi],
    ritiri: g.ritiri[gi],
    margineMs: g.margineMs[gi],
    doppietta: g.doppietta[gi] === 1,
    tripletta: g.tripletta[gi] === 1,
    cambiDiLeader: g.cambiDiLeader[gi],
    leaderDiversi: g.leaderDiversi[gi],
    vittoriaUltimoGiro: g.vittoriaUltimoGiro[gi] === null ? null : g.vittoriaUltimoGiro[gi] === 1,
    neutralizzazioni: g.neutralizzazioni[gi],
    sosteMedie,
    classifica: righe,
    podio,
    pole,
    giroVeloce,
    momenti: momentiDi(righe),
    haTracce: g.anno[gi] >= ANNO_TRACCE,
  };
}

// I momenti di carriera capitati in questa gara: sono già nelle colonne
// derivate (quante vittorie/podi/pole PRIMA di questa riga), quindi non
// costano niente e sono la cosa che un telecronista direbbe per prima.
function momentiDi(righe: RigaClassifica[]): Momento[] {
  const out: Momento[] = [];
  for (const x of righe) {
    if (x.primaVittoria) out.push({ testo: "prima vittoria in carriera", pilota: x.pilota });
    else if (x.primoPodio) out.push({ testo: "primo podio in carriera", pilota: x.pilota });
    if (x.primaPole) out.push({ testo: "prima pole in carriera", pilota: x.pilota });
    if (x.debutto) out.push({ testo: "debutto in Formula 1", pilota: x.pilota });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Formati
// ---------------------------------------------------------------------------

// Il margine di vittoria in chiaro. I millesimi si scrivono solo sotto il
// secondo, dove sono la notizia (Monza 1971: 0,010 s); sopra basta il
// decimo, che è anche la precisione con cui questa tabella porta i distacchi
// degli altri piloti — scrivere "1,500 s" qui e "+1,5 s" due righe sotto,
// per lo stesso distacco, sembra un errore di battitura. Un margine nullo
// NON è zero: vuol dire che il tempo non c'è (gara interrotta, o vincitore
// senza tempo registrato).
export function formattaMargine(ms: number | null): string | null {
  if (ms === null) return null;
  const s = ms / 1000;
  if (s < 1) return `${s.toFixed(3).replace(".", ",")} s`;
  if (s < 60) return `${s.toFixed(1).replace(".", ",")} s`;
  const m = Math.floor(s / 60);
  return `${m}′ ${(s - m * 60).toFixed(1).replace(".", ",")}″`;
}

// Il distacco di un pilota dal vincitore, in decimi nella tabella.
export function formattaDistacco(riga: RigaClassifica, vincitore: RigaClassifica | null): string {
  if (riga.arrivo === 1) return "—";
  if (riga.arrivo === null) return riga.stato || "ritirato";
  if (riga.distaccoDecimi === null) return riga.stato || "";
  // "+1 giro" e simili stanno già nello stato: con un giro di distacco il
  // tempo dal vincitore non è un distacco leggibile
  if (vincitore?.giri != null && riga.giri != null && riga.giri < vincitore.giri) return riga.stato;
  const s = riga.distaccoDecimi / 10;
  if (s < 60) return `+${s.toFixed(1).replace(".", ",")} s`;
  const m = Math.floor(s / 60);
  return `+${m}′ ${(s - m * 60).toFixed(1).replace(".", ",")}″`;
}

export function testoStato(riga: RigaClassifica): string {
  if (riga.arrivo !== null) return `${riga.arrivo}°`;
  if (riga.statoCat === STATO.NON_PARTITO) return "non partito";
  if (riga.statoCat === STATO.NON_QUALIFICATO) return "non qualificato";
  return "ritirato";
}

export function dataItaliana(iso: string): string {
  const mesi = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const [a, m, g] = iso.split("-").map(Number);
  if (!a || !m || !g) return iso;
  return `${g} ${mesi[m - 1]} ${a}`;
}
