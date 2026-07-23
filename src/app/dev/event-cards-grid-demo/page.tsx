import fs from "fs";
import path from "path";
import EventCardsGrid from "@/components/EventCardsGrid";
import type { CatalogEventEntry } from "@/lib/eventCatalog";

// Pagina di prova temporanea per verificare EventCardsGrid isolato
// (roadmap R2.1, docs/ROADMAP-4.md). Da rimuovere prima della fase R4,
// stessa convenzione di src/app/dev/event-card-demo.

export default function EventCardsGridDemoPage() {
  const indexPath = path.join(process.cwd(), "public", "data", "events", "index.json");
  const catalog: CatalogEventEntry[] = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  return (
    <main className="bg-background min-h-screen px-6 py-10">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-condensed text-2xl font-bold text-white mb-2">
          Demo: EventCardsGrid (temporanea, roadmap R2.1)
        </h1>
        <p className="text-neutral-gray text-sm mb-8">
          Stesso catalogo di RarityScale, raggruppato per famiglia invece che su un asse di rarità.
        </p>
        <EventCardsGrid catalog={catalog} />
      </div>
    </main>
  );
}
