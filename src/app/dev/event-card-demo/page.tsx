import fs from "fs";
import path from "path";
import EventCard from "@/components/EventCard";
import type { CatalogEventEntry } from "@/lib/eventCatalog";

// Pagina di prova temporanea per verificare EventCard isolato (roadmap
// R1.1, docs/ROADMAP-4.md). Da rimuovere prima della fase R4 (rifinitura
// finale), stessa convenzione di src/app/dev/chart-demo.

const SAMPLE_IDS = [
  "vittoria_da_griglia", // parametro numerico N: 5/10/15/20
  "pit_sotto_neutralizzazione", // parametro testuale (contesto), finestra 2023-2024
  "pilota_locked_out", // nessun parametro, finestra 2023-2024
];

export default function EventCardDemoPage() {
  const indexPath = path.join(process.cwd(), "public", "data", "events", "index.json");
  const catalog: CatalogEventEntry[] = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  return (
    <main style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: "white" }}>
        Demo: EventCard (temporanea, roadmap R1.1)
      </h1>
      <p style={{ marginBottom: 16, color: "#9ca3af" }}>
        Clicca i bottoni del parametro: solo lo stato locale della card cambia, nessuna richiesta di rete.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {SAMPLE_IDS.map((eventId) => {
          const variants = catalog.filter((e) => e.eventId === eventId);
          return <EventCard key={eventId} variants={variants} />;
        })}
      </div>
    </main>
  );
}
