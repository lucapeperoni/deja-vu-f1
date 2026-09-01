// Controprova della fase S2.2 (docs/ROADMAP-6.md): dopo la separazione tra
// motore puro (src/lib/scenarioEngine.ts) e lettura file (src/lib/
// scenarioIndexServer.ts), i numeri del motore devono restare IDENTICI a
// quelli verificati in S1.2 — che sono scritti qui come attese, non come
// commento. Si esegue con:
//   npx ts-node --compilerOptions '{"module":"commonjs","moduleResolution":"node","target":"es2020","esModuleInterop":true}' scripts/verify-s22.ts
import zlib from "zlib";
import { buildCompactScenarioIndex } from "../src/lib/scenarioIndexServer";
import { decodeScenarioIndex, matchScenario, type Chip } from "../src/lib/scenarioEngine";

const compact = buildCompactScenarioIndex();
const json = JSON.stringify(compact);
const senzaPiano = JSON.stringify({ ...compact, piano: undefined });
console.log(
  `Indice compatto: ${(json.length / 1024).toFixed(1)} KB grezzi, ${(zlib.gzipSync(json).length / 1024).toFixed(1)} KB compressi\n` +
    `  occorrenze + varianti + gare: ${(senzaPiano.length / 1024).toFixed(1)} KB grezzi (tetto dichiarato in S2.2: 200 KB)\n` +
    `  piano dei risultati, solo denominatori: ${((json.length - senzaPiano.length) / 1024).toFixed(1)} KB grezzi`
);

// Si decodifica dal JSON, non dall'oggetto in memoria: è il percorso vero
// (props del server → componente client).
const index = decodeScenarioIndex(JSON.parse(json));

const ev = (id: string, eventId: string, parametri: Record<string, number | string> = {}): Chip => ({
  id,
  label: eventId,
  tipo: "evento",
  eventId,
  parametri,
});

interface Attesa {
  nome: string;
  chips: Chip[];
  risultatiPieni: number;
  gareDistinte: number;
  denominatore: number | null;
  fonte: "precalcolato" | "proxy" | "non_calcolabile";
}

const casi: Attesa[] = [
  {
    nome: "doppietta + nessun_cambio_di_leader",
    chips: [ev("a", "doppietta"), ev("b", "nessun_cambio_di_leader")],
    risultatiPieni: 30,
    gareDistinte: 30,
    denominatore: 544,
    fonte: "proxy",
  },
  {
    nome: "vittoria_da_griglia N=10 + circuito Monza",
    chips: [ev("a", "vittoria_da_griglia", { N: 10 }), { id: "b", label: "Monza", tipo: "circuito", circuitRef: "monza" }],
    risultatiPieni: 2,
    gareDistinte: 2,
    denominatore: 1016,
    fonte: "proxy",
  },
  {
    nome: "vittoria_da_griglia N=10 da solo",
    chips: [ev("a", "vittoria_da_griglia", { N: 10 })],
    risultatiPieni: 37,
    gareDistinte: 37,
    denominatore: 1114,
    fonte: "precalcolato",
  },
  {
    nome: "vittoria_da_griglia N=10 + chip team Ferrari",
    chips: [ev("a", "vittoria_da_griglia", { N: 10 }), { id: "b", label: "Ferrari", tipo: "team", constructorId: 6 }],
    risultatiPieni: 6,
    gareDistinte: 6,
    denominatore: null,
    fonte: "non_calcolabile",
  },
];

let falliti = 0;
for (const caso of casi) {
  const r = matchScenario(index, caso.chips);
  const pieno = r.byScore[0];
  const gare = new Set(pieno.risultati.map((m) => m.entry.raceId)).size;
  const d = r.denominatoreComposto;
  const ok =
    pieno.risultati.length === caso.risultatiPieni &&
    gare === caso.gareDistinte &&
    d.valore === caso.denominatore &&
    d.fonte === caso.fonte;
  if (!ok) falliti++;
  console.log(
    `\n${caso.nome}\n` +
      `  K su K (${pieno.score}/${caso.chips.length}): ${pieno.risultati.length} risultati su ${gare} gare distinte` +
      ` [atteso ${caso.risultatiPieni} su ${caso.gareDistinte}]\n` +
      `  cascata: ${r.byScore.map((l) => `${l.score}→${l.risultati.length}`).join("  ")}\n` +
      `  denominatore: ${d.valore ?? "non calcolabile"} (fonte "${d.fonte}") [atteso ${caso.denominatore ?? "non calcolabile"}, "${caso.fonte}"]\n` +
      `  finestra ${r.finestraIntersecata.annoDa}-${r.finestraIntersecata.annoA}, join "${r.joinMode}"\n` +
      `  ${ok ? "IDENTICO a S1.2" : "DIVERSO da S1.2 — bug della separazione"}`
  );
}

console.log(`\n${casi.length - falliti}/${casi.length} casi identici a S1.2.`);
process.exit(falliti === 0 ? 0 : 1);
