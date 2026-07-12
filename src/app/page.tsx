import fs from "fs";
import path from "path";
import PitStopBeeswarm, { type PitPoint } from "./PitStopBeeswarm";
import DecisionIndexDistribution, { type DecisionPoint } from "./DecisionIndexDistribution";
import RaceGrid, { type RaceGridEntry } from "./RaceGrid";

// Home = apertura del racconto (docs/PROGETTAZIONE.md, sezioni 1, 6 e 8,
// pivot v2). Il grafico principale (vista 6 riorientata, sezione 7) è ora
// la mappa del "quando conviene": distribuzioni sovrapposte dell'indice
// combinato (sezione 5.6, task P2.1) per chi ha guadagnato e chi ha perso
// posizioni dopo essersi fermato ai box — un vantaggio statistico reale
// ma modesto (correlazione 0,34-0,36, decisione presa dopo lo spike P1.2:
// niente scatter a 2 assi, il segnale non basta per un confine netto). Il
// beeswarm degli sconti (vecchia vista 6) scende sotto come sezione di
// supporto: quantifica il costo dell'opzione BOX, non la sua probabilità
// di successo. "Overview first" nel mantra di Shneiderman citato in
// sezione 8.

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

interface AggregateDecision {
  raceId: string;
  eventId: string;
  driverId: string;
  choice: string;
  verdict: string;
  combinedIndex: number | null;
  notNeeded: boolean;
  unreliableGapReference: boolean;
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

interface RaceDecisionDetail {
  eventId: string;
  driverId: string;
  snapshot: { gapBehind: number | null; tyreAge: number | null; compound: string | null };
  outcome: { posDelta5: number | null };
}

interface CircuitParams {
  overtakability: number;
  listino: number;
  chaos: number;
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

// raceId è già "{anno}-{circuitRef}" (data-layer/scripts/build_all.py, la
// stessa slug usata come chiave in public/data/circuits.json): non serve
// un'altra mappa, basta togliere i primi 5 caratteri ("YYYY-").
function circuitRefFromRaceId(raceId: string): string {
  return raceId.slice(5);
}

export default async function Home() {
  const dataDir = ["public", "data"];
  const aggregate = readJson<{ pitStops: AggregatePitStop[]; decisions: AggregateDecision[] }>(
    ...dataDir,
    "aggregate.json"
  );
  const raceIndex = readJson<RaceIndexEntry[]>(...dataDir, "index.json");
  const circuits = readJson<Record<string, CircuitParams>>(...dataDir, "circuits.json");

  const raceNameById = new Map(raceIndex.map((r) => [r.id, r.name]));
  const raceYearById = new Map(raceIndex.map((r) => [r.id, r.year]));

  // L'aggregate.json porta solo l'id numerico del pilota (sezione 6): il
  // codice a 3 lettere e i dettagli per pilota x evento (gap, gomme,
  // esito) si trovano solo nei singoli file gara. Si scandiscono una volta
  // sola, invece di tenere un JSON a parte solo per questo.
  const racesDir = path.join(process.cwd(), "public", "data", "races");
  const raceFiles = fs.existsSync(racesDir) ? fs.readdirSync(racesDir).filter((f) => f.endsWith(".json")) : [];
  const driverCodeById = new Map<string, string>();
  const decisionDetailByKey = new Map<string, RaceDecisionDetail>();
  for (const filename of raceFiles) {
    const raceSlug = filename.replace(/\.json$/, "");
    const raceData = readJson<{ drivers: { id: string; driverId: string }[]; decisions: RaceDecisionDetail[] }>(
      "public",
      "data",
      "races",
      filename
    );
    for (const driver of raceData.drivers ?? []) {
      if (!driverCodeById.has(driver.driverId)) driverCodeById.set(driver.driverId, driver.id);
    }
    for (const decision of raceData.decisions ?? []) {
      decisionDetailByKey.set(`${raceSlug}-${decision.eventId}-${decision.driverId}`, decision);
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

  // Sorpassabilità mediana sul campione di piste presenti in circuits.json
  // (task P2.1): definisce la soglia "sorpassabile vs no" del filtro, non
  // un valore arbitrario scelto a mano.
  const overtakabilityMedian = median(Object.values(circuits).map((c) => c.overtakability));

  // La mappa (vista 6 riorientata, sezione 5.6): solo decisioni BOX, non
  // NOT_NEEDED, con verdetto GAINED o LOST (NEUTRAL escluso: la domanda è
  // "guadagnato o perso?", non "è cambiato qualcosa?") e indice combinato
  // calcolabile. Esclude anche i pochi snapshot marcati
  // unreliableGapReference (task P2.2): il loro indice combinato dipende
  // da un margine dietro non affidabile, non è corretto silenziosamente.
  const decisionPoints: DecisionPoint[] = aggregate.decisions
    .filter(
      (d) =>
        d.choice === "BOX" &&
        !d.notNeeded &&
        !d.unreliableGapReference &&
        (d.verdict === "GAINED" || d.verdict === "LOST") &&
        d.combinedIndex != null
    )
    .map((d) => {
      const detail = decisionDetailByKey.get(`${d.raceId}-${d.eventId}-${d.driverId}`);
      const circuitRef = circuitRefFromRaceId(d.raceId);
      const overtakability = circuits[circuitRef]?.overtakability ?? overtakabilityMedian;
      return {
        key: `${d.raceId}-${d.eventId}-${d.driverId}`,
        raceId: d.raceId,
        raceName: raceNameById.get(d.raceId) ?? d.raceId,
        year: raceYearById.get(d.raceId) ?? 0,
        driverCode: driverCodeById.get(d.driverId) ?? d.driverId,
        eventId: d.eventId,
        combinedIndex: d.combinedIndex as number,
        verdict: d.verdict as "GAINED" | "LOST",
        gapBehind: detail?.snapshot.gapBehind ?? null,
        tyreAge: detail?.snapshot.tyreAge ?? null,
        compound: detail?.snapshot.compound ?? null,
        posDelta5: detail?.outcome.posDelta5 ?? null,
        overtakable: overtakability >= overtakabilityMedian,
      };
    });

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
      {/* Primo atto: il problema e la soluzione (docs/PROGETTAZIONE.md, sezione 1) */}
      <section className="relative px-6 py-24 flex flex-col items-center justify-center border-b border-graphite overflow-hidden">
        <div className="absolute inset-0 bg-texture-grid opacity-20 pointer-events-none" />
        <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-racing-red to-transparent opacity-50" />

        <div className="relative z-10 text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-block px-4 py-1 border border-racing-red/30 bg-racing-red/10 text-racing-red font-condensed tracking-widest text-sm uppercase rounded-sm mb-4">
            F1 2023–2024 · Safety Car e Virtual Safety Car
          </div>

          <h1 className="font-condensed text-5xl md:text-7xl font-bold uppercase tracking-tight text-white drop-shadow-lg">
            Box, <span className="text-racing-red">box?</span>
          </h1>

          <p className="text-lg text-neutral-gray max-w-2xl mx-auto leading-relaxed">
            Quando entra la Safety Car, il muretto ha pochi secondi per rispondere alla chiamata radio: fermarsi
            costa molto meno del normale (15,5s mediani contro {listinoTipico.toFixed(1)}s in verde), ma si rientra
            nel traffico; restare fuori conserva la posizione, con gomme più vecchie e la scommessa di pagare
            prezzo pieno più avanti. Da fuori — TV, timing screen — si vede solo l&apos;esito, mai le carte che il
            muretto aveva in mano. Persino i top team la sbagliano (Ferrari a Monaco 2022, Mercedes ad Abu Dhabi
            2021).
          </p>
          <p className="text-base text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Questo progetto ricostruisce ~800 di quelle decisioni reali dalle stagioni 2023-2024, pilota per
            pilota, con le due opzioni quantificate come le vedeva il muretto — e le aggrega in una mappa empirica
            di quando la scommessa ha pagato.
          </p>
        </div>
      </section>

      {/* Secondo atto: la mappa del "quando conviene" (vista 6 riorientata) */}
      <section className="px-6 py-20 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <h3 className="font-condensed text-4xl font-bold uppercase text-white mb-3">
            La mappa del <span className="text-racing-red">quando conviene</span>
          </h3>
          <p className="text-text-secondary max-w-3xl">
            Ogni tacca in basso è una decisione BOX reale del campione: traffico (quanti altri si fermano nella
            stessa finestra) e margine sul gruppo dietro, combinati in un unico indice (sezione 5.6 della
            progettazione). Le due curve sono la densità di quell&apos;indice per chi ha guadagnato posizioni e per
            chi ne ha perse dopo essersi fermato.
          </p>
        </div>
        <DecisionIndexDistribution points={decisionPoints} />
        <p className="text-sm text-text-secondary max-w-3xl mt-6 leading-relaxed">
          Le due curve si sovrappongono pesantemente: questa <em>non</em> è una previsione, è una{" "}
          <strong className="text-white">tendenza statistica</strong> — un vantaggio reale ma modesto (correlazione
          misurata 0,34–0,36 tra indice combinato ed esito, su tutte e 46 le gare). Chi ha guadagnato posizioni ha
          in media un indice più alto di chi ne ha perse, ma tantissimi casi in entrambe le code smentiscono la
          media: nessuna delle coppie di variabili provate (margine, età gomme, sorpassabilità, fase di gara)
          traccia un confine netto tra chi vince e chi perde la scommessa. È coerente con la letteratura sul tema,
          che per fare meglio usa modelli molto più pesanti della telemetria istantanea — e con l&apos;idea di
          fondo del progetto: questo strumento aiuta la decisione del muretto, non la sostituisce.
        </p>
      </section>

      {/* Sezione di supporto: quanto costa l'opzione BOX (ex vista 6) */}
      <section className="px-6 py-20 max-w-7xl mx-auto w-full border-t border-graphite">
        <div className="mb-10">
          <h3 className="font-condensed text-4xl font-bold uppercase text-white mb-3">
            Quanto costa fermarsi: il prezzo dell&apos;opzione BOX
          </h3>
          <p className="text-text-secondary max-w-3xl">
            Ogni punto è un pit stop del campione 2023–2024, posizionato sul suo costo effettivo (sezione 5.1 della
            progettazione): quanto tempo è costato davvero, rispetto a chi non si è fermato in quel giro. La nuvola
            grigia dei pit in condizioni normali si addensa intorno al prezzo pieno; i pit sotto neutralizzazione si
            spostano verso costi più bassi — quello è lo sconto, la parte "sicura" della scommessa. Se poi conviene
            prenderlo lo dice la mappa sopra. Passa il mouse su un punto per i dettagli, clicca per aprire la gara.
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
