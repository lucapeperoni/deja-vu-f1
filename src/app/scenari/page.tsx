import fs from "fs";
import path from "path";
import ScenarioComposer, { type SoggettiRicerca } from "@/components/scenario/ScenarioComposer";
import { buildCompactScenarioIndex } from "@/lib/scenarioIndexServer";
import type { CatalogEventEntry } from "@/lib/eventCatalog";

// Il compositore di scenari v3 (roadmap S, docs/ROADMAP-6.md). Era la home
// dal S5.1; con la v4 "Déjà vu" (docs/ROADMAP-7.md, D6.1) la home è la frase
// a slot e questo compositore a chip resta qui, sotto /scenari, raggiungibile
// da /esplora — niente si butta, si sposta.
//
// Questa pagina (server) legge i file e costruisce l'indice COMPATTO; il compositore (client) fa il match
// in memoria, senza backend a runtime e senza tornare al server a ogni tasto.

function readJson<T>(...segmenti: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), ...segmenti), "utf-8"));
}

export default function ScenariPage() {
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
    <main className="flex-1 flex flex-col bg-background min-h-screen">
      {/* Apertura (docs/PROGETTAZIONE.md, sezioni 1 e 8): il problema è "è già
          successo?" — la domanda del telecronista sotto scadenza. Il catalogo
          si esplora da /esplora; qui si interroga in fretta, guidati da uno
          scenario preciso. */}
      <section className="relative px-6 py-14 flex flex-col items-center justify-center border-b border-graphite overflow-hidden">
        <div className="absolute inset-0 bg-texture-grid opacity-20 pointer-events-none" />
        <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-racing-red to-transparent opacity-50" />

        <div className="relative z-10 text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-block px-4 py-1 border border-racing-red/30 bg-racing-red/10 text-racing-red font-condensed tracking-widest text-sm uppercase rounded-sm mb-2">
            il compositore di scenari · 75 stagioni di Formula 1
          </div>

          <h1 className="font-condensed text-4xl md:text-6xl font-bold uppercase tracking-tight text-white drop-shadow-lg">
            È già <span className="text-racing-red">successo?</span>
          </h1>

          <p className="text-base text-neutral-gray max-w-2xl mx-auto leading-relaxed">
            Succede qualcosa in gara. Ricomponilo in pochi secondi: aggiungi i pezzi — un evento
            (&quot;doppietta&quot;, &quot;nessun cambio al comando&quot;), un pilota, una squadra, un circuito,
            un decennio — e leggi subito quante volte è già capitato tutto insieme, quando, e quali casi sono{" "}
            <em>quasi</em> identici. Nessun punteggio opaco: solo un conteggio di condizioni che reggono, con la
            finestra di copertura sempre in chiaro accanto al numero.
          </p>
          <p className="text-sm text-neutral-gray">
            Vuoi invece scorrere tutto il catalogo?{" "}
            <a href="/esplora" className="text-racing-red hover:text-white transition-colors underline">
              Esplora il catalogo →
            </a>
          </p>
        </div>
      </section>

      <section className="px-6 py-10 max-w-4xl mx-auto w-full">
        <ScenarioComposer catalog={catalog} indiceCompatto={indiceCompatto} soggetti={soggetti} />
      </section>
    </main>
  );
}
