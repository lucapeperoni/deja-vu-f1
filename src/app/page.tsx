import fs from "fs";
import path from "path";
import PitStopBeeswarm, { type PitPoint } from "./PitStopBeeswarm";
import RaceGrid, { type RaceGridEntry } from "./RaceGrid";

// Home = apertura del racconto (docs/PROGETTAZIONE.md, sezioni 6 e 8):
// primo atto il prezzo di listino (il numero grande), secondo atto lo
// sconto (la vista 6, tutti i pit 2023-2024 su un asse di costo), terzo
// atto la lotteria — solo accennato qui, si vede per intero nella matrice
// di ogni pagina gara (vista 4). "Overview first" nel mantra di
// Shneiderman citato in sezione 8.

interface AggregatePitStop {
  raceId: string;
  year: number;
  driverId: string;
  lap: number;
  context: string;
  effectiveLoss: number | null;
  discount: number | null;
  doubleStack: boolean;
}

interface RaceIndexEntry {
  id: string;
  raceId: string;
  year: number;
  round: number;
  name: string;
  circuit: string;
  totalNeutralizations: number;
  interesting: boolean;
}

// Le 3 gare-caso scelte in sezione 9 del documento di progettazione.
const CASE_RACE_IDS = ["2023-bahrain", "2024-jeddah", "2023-albert_park"];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function readJson<T>(...segments: string[]): T {
  const filePath = path.join(process.cwd(), ...segments);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export default async function Home() {
  const dataDir = ["public", "data"];
  const aggregate = readJson<{ pitStops: AggregatePitStop[] }>(...dataDir, "aggregate.json");
  const raceIndex = readJson<RaceIndexEntry[]>(...dataDir, "index.json");

  const raceNameById = new Map(raceIndex.map((r) => [r.id, r.name]));

  // L'aggregate.json porta solo l'id numerico del pilota (sezione 6): il
  // codice a 3 lettere si trova nei singoli file gara. Si costruisce la
  // mappa una volta sola scandendo le gare, invece di tenere un JSON a
  // parte solo per questo.
  const racesDir = path.join(process.cwd(), "public", "data", "races");
  const raceFiles = fs.existsSync(racesDir) ? fs.readdirSync(racesDir).filter((f) => f.endsWith(".json")) : [];
  const driverCodeById = new Map<string, string>();
  for (const filename of raceFiles) {
    const raceData = readJson<{ drivers: { id: string; driverId: string }[] }>(
      "public",
      "data",
      "races",
      filename
    );
    for (const driver of raceData.drivers ?? []) {
      if (!driverCodeById.has(driver.driverId)) driverCodeById.set(driver.driverId, driver.id);
    }
  }

  const pitPoints: PitPoint[] = aggregate.pitStops
    .filter((p): p is AggregatePitStop & { effectiveLoss: number } => p.effectiveLoss != null)
    .map((p) => ({
      key: `${p.raceId}-${p.driverId}-${p.lap}`,
      raceId: p.raceId,
      raceName: raceNameById.get(p.raceId) ?? p.raceId,
      year: p.year,
      driverCode: driverCodeById.get(p.driverId) ?? p.driverId,
      context: p.context,
      effectiveLoss: p.effectiveLoss,
      discount: p.discount,
      doubleStack: p.doubleStack,
    }));

  const listinoTipico = median(
    aggregate.pitStops.filter((p) => p.context === "GREEN" && p.effectiveLoss != null).map((p) => p.effectiveLoss as number)
  );

  const raceGridEntries: RaceGridEntry[] = [...raceIndex]
    .sort((a, b) => a.year - b.year || a.round - b.round)
    .map((r) => ({
      id: r.id,
      year: r.year,
      round: r.round,
      name: r.name,
      circuit: r.circuit,
      totalNeutralizations: r.totalNeutralizations,
    }));

  return (
    <main className="flex-1 flex flex-col bg-background min-h-screen">
      {/* Primo atto: il claim e il prezzo di listino */}
      <section className="relative px-6 py-24 flex flex-col items-center justify-center border-b border-graphite overflow-hidden">
        <div className="absolute inset-0 bg-texture-grid opacity-20 pointer-events-none" />
        <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-racing-red to-transparent opacity-50" />

        <div className="relative z-10 text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-block px-4 py-1 border border-racing-red/30 bg-racing-red/10 text-racing-red font-condensed tracking-widest text-sm uppercase rounded-sm mb-4">
            F1 2023–2024 · Safety Car e Virtual Safety Car
          </div>

          <h1 className="font-condensed text-5xl md:text-7xl font-bold uppercase tracking-tight text-white drop-shadow-lg">
            Il <span className="text-racing-red">Chaos Discount</span>
          </h1>

          <p className="text-lg text-neutral-gray max-w-2xl mx-auto leading-relaxed">
            Un pit stop costa il tempo che si perde rispetto a chi resta in pista. Quando entra la Safety Car o la
            Virtual Safety Car, tutti sono costretti ad andare piano: chi si ferma in quel momento paga molto meno.
            È uno sconto — ma non è disponibile per tutti. Questo progetto misura quanto vale, e chi ha potuto
            prenderlo.
          </p>

          <div className="pt-6">
            <div className="text-xs uppercase tracking-widest text-neutral-gray mb-2">
              Prezzo di listino tipico (mediana dei pit in condizioni normali, 2023–2024)
            </div>
            <div className="font-condensed text-7xl md:text-8xl font-bold text-white">
              {listinoTipico.toFixed(1)}
              <span className="text-racing-red text-4xl md:text-5xl">s</span>
            </div>
          </div>
        </div>
      </section>

      {/* Secondo atto: lo sconto, su tutta la distribuzione */}
      <section className="px-6 py-20 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <h3 className="font-condensed text-4xl font-bold uppercase text-white mb-3">Chi paga il prezzo pieno, chi no</h3>
          <p className="text-text-secondary max-w-3xl">
            Ogni punto è un pit stop del campione 2023–2024, posizionato sul suo costo effettivo (sezione 5.1 della
            progettazione): quanto tempo è costato davvero, rispetto a chi non si è fermato in quel giro. La nuvola
            grigia dei pit in condizioni normali si addensa intorno al prezzo pieno; i pit sotto neutralizzazione si
            spostano verso costi più bassi — quello è lo sconto. Passa il mouse su un punto per i dettagli, clicca per
            aprire la gara.
          </p>
        </div>
        <PitStopBeeswarm points={pitPoints} listinoTipico={listinoTipico} />
      </section>

      {/* Terzo atto: la lotteria — solo accennata qui, si vede per intero
          nella matrice degli esiti di ogni pagina gara (vista 4). */}
      <section className="px-6 py-20 max-w-7xl mx-auto w-full border-t border-graphite">
        <div className="mb-10">
          <h3 className="font-condensed text-4xl font-bold uppercase text-white mb-3">La lotteria, gara per gara</h3>
          <p className="text-text-secondary max-w-3xl">
            Ogni gara del campione ha la sua pagina: la race trace, gli sconti, la classifica deformata, la matrice
            di chi ha sfruttato la finestra e chi ne è rimasto escluso, e il confronto tra compagni di squadra
            davanti alla stessa neutralizzazione. Le tre gare con la stella sono raccontate a fondo in relazione.
          </p>
        </div>
        <RaceGrid races={raceGridEntries} caseRaceIds={CASE_RACE_IDS} />
      </section>
    </main>
  );
}
