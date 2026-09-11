import fs from "fs";
import path from "path";
import DejaVu from "@/components/situazioni/DejaVu";
import { leggiDizionariJson, leggiGareJson, leggiRisultatiJson } from "@/lib/situazioni/tabelleServer";

// Home v4 "Déjà vu" (docs/PROGETTAZIONE-v4.md, docs/ROADMAP-7.md D6.1): la
// prima pagina è la frase a slot. Il server legge le tabelle delle
// situazioni (public/data/situazioni/, ~195 KB gzip) e i dizionari e li
// passa al client, che decodifica una volta e risponde in memoria a ogni
// tasto — nessun backend a runtime, sito statico. Il compositore a chip v3
// è sotto /scenari, le viste del catalogo sotto /esplora.

function readJson<T>(...segmenti: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), ...segmenti), "utf-8"));
}

export default function Home() {
  const pesi = readJson<{ situazioni: { pesiAllentamento: never } }>("public", "data", "params.json").situazioni.pesiAllentamento;
  const circuitiGeo = readJson<Record<string, { lat: number; lng: number; nome: string }>>("public", "data", "circuits-geo.json");

  return (
    <main className="flex-1 flex flex-col bg-background min-h-screen">
      <section className="px-6 pt-10 pb-6 max-w-[1100px] mx-auto w-full">
        <div className="font-condensed text-xs tracking-[0.14em] uppercase text-neutral-gray mb-1">L&apos;hai già visto? · 1950–2024, 1125 gare</div>
        <h1 className="font-condensed text-3xl md:text-4xl font-extrabold text-white leading-tight">
          Descrivi quello che è appena successo.
        </h1>
        <p className="text-neutral-gray mt-2 max-w-[64ch]">
          Chi, cosa, dove, quando. Rispondiamo quante volte è già capitato su quante gare, con la finestra dei dati accanto al numero,
          e mostriamo i casi che gli somigliano cambiando un solo slot. Nessun modello: conteggi, e lo slot che cambia scritto accanto.
        </p>
      </section>
      <section className="px-6 pb-16 max-w-[1100px] mx-auto w-full">
        <DejaVu risultatiJson={leggiRisultatiJson()} gareJson={leggiGareJson()} dizionari={leggiDizionariJson()} pesi={pesi} circuitiGeo={circuitiGeo} />
      </section>
    </main>
  );
}
