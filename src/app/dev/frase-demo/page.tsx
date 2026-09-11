import DemoClient from "./DemoClient";
import { leggiDizionariJson, leggiGareJson, leggiRisultatiJson } from "@/lib/situazioni/tabelleServer";
import fs from "fs";
import path from "path";

// Pagina di prova isolata per la frase a slot (roadmap D3.1,
// docs/ROADMAP-7.md), stessa convenzione delle demo di src/app/dev/. Il
// server legge i JSON delle situazioni e li passa al client, che decodifica
// una volta sola e valuta in memoria.

export default function FraseDemoPage() {
  const pesi = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", "params.json"), "utf8")).situazioni.pesiAllentamento;
  return (
    <main className="bg-background min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-condensed text-2xl font-bold text-white mb-2">Demo: la frase a slot (temporanea, roadmap D3.1)</h1>
        <p className="text-neutral-gray text-sm mb-8">
          Chi · Cosa · Dove · Quando. Sotto, la frase riletta dal motore e la risposta N su M con la finestra.
        </p>
        <DemoClient risultatiJson={leggiRisultatiJson()} gareJson={leggiGareJson()} dizionari={leggiDizionariJson()} pesi={pesi} />
      </div>
    </main>
  );
}
