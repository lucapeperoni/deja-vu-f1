import fs from "fs";
import path from "path";
import ScenarioComposer, { type SoggettiRicerca } from "@/components/scenario/ScenarioComposer";
import { buildCompactScenarioIndex } from "@/lib/scenarioIndexServer";
import type { CatalogEventEntry } from "@/lib/eventCatalog";

// Pagina di prova temporanea per verificare ScenarioComposer isolato
// (roadmap S2.2, docs/ROADMAP-6.md). Da rimuovere prima della fase S6,
// stessa convenzione di src/app/dev/event-picker-demo.
//
// È qui che si vede la separazione di S2.2 all'opera: questa pagina (server)
// legge i file e costruisce l'indice COMPATTO; il compositore (client) fa il
// match in memoria, senza tornare al server a ogni tasto premuto.

function readJson<T>(...segmenti: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), ...segmenti), "utf-8"));
}

export default function ScenarioComposerDemoPage() {
  const catalog = readJson<CatalogEventEntry[]>("public", "data", "events", "index.json");
  const drivers = readJson<Record<string, string>>("public", "data", "drivers-index.json");
  const constructors = readJson<Record<string, string>>("public", "data", "constructors-index.json");
  const circuits = readJson<Record<string, unknown>>("public", "data", "circuits.json");
  const circuitsGeo = readJson<Record<string, { nome: string }>>("public", "data", "circuits-geo.json");

  const soggetti: SoggettiRicerca = {
    piloti: Object.entries(drivers).map(([id, nome]) => ({ driverId: Number(id), nome })),
    team: Object.entries(constructors).map(([id, nome]) => ({ constructorId: Number(id), nome })),
    // circuits.json non porta il nome leggibile (solo le metriche): il nome
    // sta in circuits-geo.json, con il circuitRef come ripiego dichiarato.
    circuiti: Object.keys(circuits).map((circuitRef) => ({
      circuitRef,
      nome: circuitsGeo[circuitRef]?.nome ?? circuitRef,
    })),
  };

  const indiceCompatto = buildCompactScenarioIndex();

  return (
    <main className="bg-background min-h-screen px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-condensed text-2xl font-bold text-white mb-2">
          Demo: ScenarioComposer (temporanea, roadmap S2.2)
        </h1>
        <p className="text-neutral-gray text-sm mb-8">
          Una sola barra su cinque tipi di pezzi. Frecce su/giù tra i risultati, invio per scegliere, backspace su
          campo vuoto per togliere l&apos;ultimo chip. I risultati veri del match arrivano in S3.
        </p>
        <ScenarioComposer catalog={catalog} indiceCompatto={indiceCompatto} soggetti={soggetti} />
      </div>
    </main>
  );
}
