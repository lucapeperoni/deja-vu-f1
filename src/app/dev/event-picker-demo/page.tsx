import fs from "fs";
import path from "path";
import DemoClient from "./DemoClient";
import type { CatalogEventEntry } from "@/lib/eventCatalog";

// Pagina di prova temporanea per verificare EventPicker isolato (roadmap
// S2.1, docs/ROADMAP-6.md). Da rimuovere prima della fase S6, stessa
// convenzione di src/app/dev/event-cards-grid-demo.

export default function EventPickerDemoPage() {
  const indexPath = path.join(process.cwd(), "public", "data", "events", "index.json");
  const catalog: CatalogEventEntry[] = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  return (
    <main className="bg-background min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-condensed text-2xl font-bold text-white mb-2">
          Demo: EventPicker (temporanea, roadmap S2.1)
        </h1>
        <p className="text-neutral-gray text-sm mb-8">
          Menu a macro-aree famiglia → evento → parametro. Le voci foglia emettono un EventoChip, non navigano.
        </p>
        <DemoClient catalog={catalog} />
      </div>
    </main>
  );
}
