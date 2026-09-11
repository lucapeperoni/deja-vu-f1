// Controprova del motore delle situazioni (Déjà vu v4, docs/ROADMAP-7.md
// D2.1 e seguenti). I numeri attesi sono stati calcolati A MANO in Python
// (pandas sui CSV Ergast, build_situazioni.py e il suo riepilogo) l'11
// settembre 2026 e stanno qui come attese, non come commento. Si esegue con:
//   npx ts-node --compilerOptions '{"module":"commonjs","moduleResolution":"node","target":"es2020","esModuleInterop":true}' scripts/verify-situazioni.ts
import { decodeTabelle } from "../src/lib/situazioni/tabelle";
import { leggiGareJson, leggiRisultatiJson } from "../src/lib/situazioni/tabelleServer";
import { valuta, type Situazione } from "../src/lib/situazioni/motore";

const t0 = Date.now();
const tab = decodeTabelle(leggiRisultatiJson(), leggiGareJson());
console.log(`Tabelle decodificate in ${Date.now() - t0} ms: ${tab.risultati.righe} risultati, ${tab.gare.righe} gare`);

let errori = 0;
function check(label: string, got: unknown, exp: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) errori++;
  console.log(`  [${ok ? "OK " : "ERR"}] ${label}: ${JSON.stringify(got)} (atteso ${JSON.stringify(exp)})`);
}

// ---- derivate (contro build_situazioni.py) --------------------------------
console.log("Colonne derivate:");
const riga = (raceId: number, driverId: number) => {
  const i = tab.risultati.raceId.findIndex((r, k) => r === raceId && tab.risultati.driverId[k] === driverId);
  if (i < 0) throw new Error("riga non trovata");
  return i;
};
const r = tab.risultati;
const gasly = riga(1038, 842);
check("Gasly Monza 2020", [r.gpInCarriera[gasly], r.vittoriePrima[gasly], r.podiPrima[gasly], r.polePrima[gasly], r.vittorieSuCircuitoPrima[gasly], r.ordineCompagno[gasly]], [55, 0, 1, 0, 0, 9]);
const ham = riga(1038, 1);
check("Hamilton Monza 2020", [r.gpInCarriera[ham], r.vittoriePrima[ham], r.podiPrima[ham], r.polePrima[ham], r.vittorieSuCircuitoPrima[ham], r.ordineCompagno[ham]], [258, 89, 157, 93, 5, 5]);
check("Hamilton: GP totali", Math.max(...r.gpInCarriera.filter((_, k) => r.driverId[k] === 1)), 356);

// ---- situazioni ------------------------------------------------------------
console.log("Situazioni:");
const vinceDa10: Situazione = { cosa: [{ id: "vince" }, { id: "parte_o_peggio", parametro: 10 }] };
let x = valuta(tab, vinceDa10);
check("chiunque vince da 10° o peggio", [x.n, x.m, x.unitaDenominatore, x.finestra.annoDa, x.finestra.annoA], [37, 1114, "gare", 1950, 2024]);

x = valuta(tab, { ...vinceDa10, dove: { tipo: "circuito", circuitRef: "monza" } });
check("... a Monza", [x.n, x.m, x.occorrenze.map((o) => o.anno)], [2, 74, [1971, 2020]]);

x = valuta(tab, { ...vinceDa10, chi: { tipo: "pilota", driverId: 1 } });
check("... Hamilton, ovunque", [x.n, x.m, x.unitaDenominatore, x.occorrenze.map((o) => o.anno)], [2, 356, "gare del pilota", [2018, 2021]]);

x = valuta(tab, { ...vinceDa10, chi: { tipo: "pilota", driverId: 1 }, dove: { tipo: "circuito", circuitRef: "monza" } });
check("... Hamilton a Monza", [x.n, x.m], [0, 18]);

x = valuta(tab, { chi: { tipo: "pilota", driverId: 1 }, cosa: [{ id: "vince" }] });
check("Hamilton vince", [x.n, x.m], [105, 356]);
x = valuta(tab, { chi: { tipo: "pilota", driverId: 1 }, cosa: [{ id: "vince" }], dove: { tipo: "circuito", circuitRef: "monza" } });
check("Hamilton vince a Monza", [x.n, x.m], [5, 18]);

x = valuta(tab, { cosa: [{ id: "vince" }, { id: "debutto" }] });
// Python contava 3 (Farina 1950, Parsons Indy 1950, Baghetti 1961): la
// terza e' la 500 Miglia, esclusa da ogni denominatore (trappola 1) -> 2.
check("vince al debutto (storia intera, Indy esclusa)", [x.n, x.m, x.occorrenze.map((o) => o.anno)], [2, 1114, [1950, 1961]]);

// fatti sulla gara: regressione contro la v3 (docs/ROADMAP-6.md S1.2/S2.2):
// doppietta + nessun cambio di leader = 30 gare su 544 (1996-2024)
x = valuta(tab, { cosa: [{ id: "doppietta" }, { id: "nessun_cambio_leader" }] });
check("doppietta + nessun cambio di leader", [x.n, x.m, x.finestra.annoDa, x.finestra.limitataDa], [30, 544, 1996, ["cambiDiLeader"]]);

// finestra: un fatto sulle soste stringe a 2011+, e "anni 1970" la svuota
x = valuta(tab, { cosa: [{ id: "vince" }, { id: "soste_almeno", parametro: 3 }] });
check("vince con almeno 3 soste: finestra e gare 2011-2024", [x.finestra.annoDa, x.finestra.annoA, x.m], [2011, 2024, 286]);
x = valuta(tab, { cosa: [{ id: "vince" }, { id: "soste_almeno", parametro: 3 }], quando: { tipo: "decennio", annoDa: 1970 } });
check("... negli anni 1970: intersezione vuota", [x.finestra.vuota, x.n, x.m], [true, 0, 0]);

// Gasly, Monza 2020: al comando entro il giro 28, non entro il 27
x = valuta(tab, { chi: { tipo: "pilota", driverId: 842 }, cosa: [{ id: "vince" }, { id: "al_comando_al_giro", parametro: 27 }] });
check("Gasly vince ed è al comando entro il giro 27", x.n, 0);
x = valuta(tab, { chi: { tipo: "pilota", driverId: 842 }, cosa: [{ id: "vince" }, { id: "al_comando_al_giro", parametro: 28 }] });
check("... entro il giro 28", [x.n, x.occorrenze[0]?.anno], [1, 2020]);

const t1 = Date.now();
for (let k = 0; k < 20; k++) valuta(tab, vinceDa10);
console.log(`Tempo medio di una valutazione su tutta la tabella: ${((Date.now() - t1) / 20).toFixed(1)} ms`);

if (errori > 0) {
  console.error(`\n${errori} controlli falliti`);
  process.exit(1);
}
console.log("\nTutti i controlli passano.");
