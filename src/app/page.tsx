import fs from "fs";
import path from "path";
import RarityScale from "@/components/charts/RarityScale";
import { dedupeToDefaultParams, type CatalogEventEntry } from "@/lib/eventCatalog";

// Home v3 = vista 1 della specifica (docs/PROGETTAZIONE.md, sezione 7):
// "la scala della rarità", l'overview del catalogo eventi nel mantra di
// Shneiderman ("overview first"). Sostituisce la home v2 (la mappa "quando
// conviene" del pit stop, ora sezione della famiglia "neutralizzazioni",
// vista 7 — non riscritta, solo reinquadrata altrove).
//
// Nessun backend (sezione 6): il catalogo è già precalcolato da
// data-layer/scripts/build_events.py in public/data/events/index.json, il
// frontend legge solo occorrenze/denominatore/rarità già calcolati.

export default async function Home() {
  const indexPath = path.join(process.cwd(), "public", "data", "events", "index.json");
  const catalog: CatalogEventEntry[] = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const events = dedupeToDefaultParams(catalog);

  const mostCommon = [...events].sort((a, b) => b.rarita - a.rarita)[0];
  const rarest = [...events].sort((a, b) => a.rarita - b.rarita)[0];

  return (
    <main className="flex-1 flex flex-col bg-background min-h-screen">
      {/* Apertura (docs/PROGETTAZIONE.md, sezioni 1 e 8): il problema è "è già
          successo?" — la domanda del giornalista sotto scadenza, o del tifoso
          che ha appena visto qualcosa di strano in gara. */}
      <section className="relative px-6 py-24 flex flex-col items-center justify-center border-b border-graphite overflow-hidden">
        <div className="absolute inset-0 bg-texture-grid opacity-20 pointer-events-none" />
        <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-racing-red to-transparent opacity-50" />

        <div className="relative z-10 text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-block px-4 py-1 border border-racing-red/30 bg-racing-red/10 text-racing-red font-condensed tracking-widest text-sm uppercase rounded-sm mb-4">
            {events.length} eventi · 75 stagioni di Formula 1
          </div>

          <h1 className="font-condensed text-5xl md:text-7xl font-bold uppercase tracking-tight text-white drop-shadow-lg">
            È già <span className="text-racing-red">successo?</span>
          </h1>

          <p className="text-lg text-neutral-gray max-w-2xl mx-auto leading-relaxed">
            Ogni riga qui sotto è un evento del catalogo — da{" "}
            <strong className="text-white">{mostCommon.nome.toLowerCase()}</strong>, che succede quasi ogni gara, a{" "}
            <strong className="text-white">{rarest.nome.toLowerCase()}</strong>, capitato solo {rarest.occorrenze}{" "}
            {rarest.occorrenze === 1 ? "volta" : "volte"} dal {rarest.annoDa}. La posizione sull&apos;asse è la
            rarità reale, non un&apos;impressione: un evento valido su 285 gare e uno valido su 1125 non si
            confrontano allo stesso modo, e la finestra di copertura di ciascuno è disegnata accanto al suo nome,
            sempre visibile.
          </p>
        </div>
      </section>

      {/* La scala della rarità (vista 1) */}
      <section className="px-6 py-20 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <h3 className="font-condensed text-4xl font-bold uppercase text-white mb-3">
            La scala della <span className="text-racing-red">rarità</span>
          </h3>
          <p className="text-text-secondary max-w-3xl">
            Asse logaritmico: dal più comune (in alto, a sinistra) al più raro (in basso, a destra). Il colore
            codifica la famiglia dell&apos;evento, mai la rarità. Accanto a ogni nome, la barra colorata è la
            finestra di copertura reale dei dati che rendono quell&apos;evento osservabile — più corta, meno gare
            contano nel denominatore. Passa il mouse per i numeri esatti, clicca per aprire la scheda dell&apos;evento.
          </p>
        </div>
        <RarityScale events={events} />
      </section>
    </main>
  );
}
