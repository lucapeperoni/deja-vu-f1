// Controprova del parser del testo libero (Déjà vu v4, docs/ROADMAP-7.md
// D3.2): frasi come le direbbe un telecronista, con la situazione attesa
// scritta qui. Si esegue con:
//   npx ts-node --compilerOptions '{"module":"commonjs","moduleResolution":"node","target":"es2020","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["src/*"]}}' -r tsconfig-paths/register scripts/verify-parser.ts
import { analizza } from "../src/lib/situazioni/parser";
import { leggiDizionariJson } from "../src/lib/situazioni/tabelleServer";
import type { Situazione } from "../src/lib/situazioni/motore";

const d = leggiDizionariJson();
let errori = 0;
function caso(testo: string, attesa: Situazione, nonCapito: string[] = []) {
  const e = analizza(testo, d);
  const canon = (x: Situazione) => JSON.stringify({ chi: x.chi ?? null, cosa: x.cosa, dove: x.dove ?? null, quando: x.quando ?? null });
  const ok = canon(e.situazione) === canon(attesa) && JSON.stringify(e.nonCapito) === JSON.stringify(nonCapito);
  if (!ok) errori++;
  console.log(`[${ok ? "OK " : "ERR"}] "${testo}"`);
  if (!ok) {
    console.log(`      ottenuto: ${JSON.stringify(e.situazione)} nonCapito=${JSON.stringify(e.nonCapito)}`);
    console.log(`      atteso:   ${JSON.stringify(attesa)} nonCapito=${JSON.stringify(nonCapito)}`);
  }
}
const HAM = { tipo: "pilota", driverId: 1 } as const;
const LEC = { tipo: "pilota", driverId: 844 } as const;
const VER = { tipo: "pilota", driverId: 830 } as const;
const MONZA = { tipo: "circuito", circuitRef: "monza" } as const;
const SPA = { tipo: "circuito", circuitRef: "spa" } as const;

caso("hamilton vince monza dalla decima", { chi: HAM, cosa: [{ id: "vince" }, { id: "parte", parametro: 10 }], dove: MONZA });
caso("hamilton vince a monza partito 10 o peggio", { chi: HAM, cosa: [{ id: "vince" }, { id: "parte_o_peggio", parametro: 10 }], dove: MONZA });
caso("lewis hamilton vittoria dal 10° o peggio a monza", { chi: HAM, cosa: [{ id: "vince" }, { id: "parte_o_peggio", parametro: 10 }], dove: MONZA });
caso("leclerc podio da p5 a spa 2019", { chi: LEC, cosa: [{ id: "podio" }, { id: "parte", parametro: 5 }], dove: SPA, quando: { tipo: "anno", anno: 2019 } });
caso("verstappen ritiro al primo giro", { chi: VER, cosa: [{ id: "ritiro_entro_giro", parametro: 1 }] });
caso("verstappen si ritira", { chi: VER, cosa: [{ id: "ritiro" }] });
caso("ferrari doppietta a monza", { chi: { tipo: "team", constructorId: 6 }, cosa: [{ id: "doppietta" }], dove: MONZA });
caso("doppietta ferrari anni 2000", { chi: { tipo: "team", constructorId: 6 }, cosa: [{ id: "doppietta" }], quando: { tipo: "decennio", annoDa: 2000 } });
caso("pole e vittoria a montecarlo", { cosa: [{ id: "pole" }, { id: "vince" }], dove: { tipo: "circuito", circuitRef: "monaco" } });
caso("leclerc quinto a monza", { chi: LEC, cosa: [{ id: "arriva", parametro: 5 }], dove: MONZA });
caso("hamilton arriva secondo partendo dalla pole", { chi: HAM, cosa: [{ id: "arriva", parametro: 2 }, { id: "pole" }] });
caso("vince al debutto", { cosa: [{ id: "vince" }, { id: "debutto" }] });
caso("prima vittoria in carriera in italia", { cosa: [{ id: "prima_vittoria" }], dove: { tipo: "paese", paese: "Italy" } });
caso("giro veloce e vittoria dalla pit lane", { cosa: [{ id: "giro_veloce" }, { id: "vince" }, { id: "pit_lane" }] });
caso("verstappen vince con 3 soste", { chi: VER, cosa: [{ id: "vince" }, { id: "soste", parametro: 3 }] });
caso("alonso vince era v8", { chi: { tipo: "pilota", driverId: 4 }, cosa: [{ id: "vince" }], quando: { tipo: "era", annoDa: 2006, annoA: 2013 } });
caso("nessun cambio al comando a monza negli anni 70", { cosa: [{ id: "nessun_cambio_leader" }], dove: MONZA, quando: { tipo: "decennio", annoDa: 1970 } });
caso("gasly vince partito 10 e al comando entro il giro 28", { chi: { tipo: "pilota", driverId: 842 }, cosa: [{ id: "vince" }, { id: "parte", parametro: 10 }, { id: "al_comando_al_giro", parametro: 28 }] });
caso("hamilton batte il compagno a silverstone nel 2016", { chi: HAM, cosa: [{ id: "batte_compagno" }], dove: { tipo: "circuito", circuitRef: "silverstone" }, quando: { tipo: "anno", anno: 2016 } });
caso("vince guadagna almeno 8 posizioni", { cosa: [{ id: "vince" }, { id: "guadagna_posizioni", parametro: 8 }] });
caso("hamilton vince a monza con la pioggia", { chi: HAM, cosa: [{ id: "vince" }], dove: MONZA }, ["pioggia"]);
caso("safety car e vittoria dal fondo", { cosa: [{ id: "almeno_n_neutralizzazioni", parametro: 1 }, { id: "vince" }, { id: "parte_o_peggio", parametro: 10 }] });

if (errori) {
  console.error(`\n${errori} frasi sbagliate`);
  process.exit(1);
}
console.log("\nParser: tutte le frasi passano.");
