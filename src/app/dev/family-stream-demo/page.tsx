import fs from "fs";
import path from "path";
import FamilyStream from "@/components/charts/FamilyStream";
import { buildFamilyTimeline, type FamilyYearSource } from "@/lib/familyTimeline";
import { dedupeToDefaultParams, type CatalogEventEntry } from "@/lib/eventCatalog";

// Pagina di prova per FamilyStream con dati REALI (roadmap T2.1,
// docs/ROADMAP-5.md). Da rimuovere prima della fase T4, stessa convenzione
// di src/app/dev/event-card-demo. Sostituisce i dati finti di T1.1.

function readJson<T>(...segments: string[]): T {
  return JSON.parse(
    fs.readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), ...segments), "utf-8")
  ) as T;
}

// Stessa chiave canonica di src/app/eventi/[eventId]/page.tsx: fa
// corrispondere le varianti di index.json (una per eventId+parametro) alla
// entry giusta dentro perParametro del file di dettaglio, indipendentemente
// dall'ordine in cui compaiono nei due file.
function paramsKey(parametri: Record<string, number | string>): string {
  return JSON.stringify(Object.entries(parametri).sort(([a], [b]) => a.localeCompare(b)));
}

interface EventDetailFile {
  eventId: string;
  famiglia: string;
  perParametro: {
    parametri: Record<string, number | string>;
    perStagione?: Record<string, number>;
  }[];
}

// Legge il catalogo (per eventId+famiglia+parametro di default) e, per
// ciascuno dei 33 eventi, il suo file di dettaglio (per perStagione della
// STESSA variante di default, non un indice a caso) — tutto server-side,
// nessuna richiesta di rete dal browser.
function loadFamilyYearSources(): FamilyYearSource[] {
  const catalog = readJson<CatalogEventEntry[]>("public", "data", "events", "index.json");
  const defaults = dedupeToDefaultParams(catalog);

  return defaults.map((entry) => {
    const detail = readJson<EventDetailFile>("public", "data", "events", `${entry.eventId}.json`);
    const key = paramsKey(entry.parametri);
    const variant = detail.perParametro.find((p) => paramsKey(p.parametri) === key) ?? detail.perParametro[0];
    return { famiglia: entry.famiglia, perStagione: variant?.perStagione ?? {} };
  });
}

export default function FamilyStreamDemoPage() {
  const sources = loadFamilyYearSources();
  const data = buildFamilyTimeline(sources);

  return (
    <main className="bg-background min-h-screen px-6 py-10">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-condensed text-2xl font-bold text-white mb-2">
          Demo: FamilyStream (dati reali, roadmap T2.1)
        </h1>
        <p className="text-neutral-gray text-sm mb-8">
          Occorrenze per famiglia e anno, aggregate dai 33 file evento (parametro di default). Hover sulla legenda
          per evidenziare una famiglia, hover sul grafico per il tooltip anno/famiglia/occorrenze.
        </p>
        <FamilyStream data={data} />
      </div>
    </main>
  );
}
