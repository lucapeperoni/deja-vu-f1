import FamilyStream, { type FamilyTimelinePoint } from "@/components/charts/FamilyStream";
import { FAMILY_LEGEND } from "@/lib/colors";

// Pagina di prova temporanea per verificare FamilyStream isolato (roadmap
// T1.1, docs/ROADMAP-5.md). Da rimuovere prima della fase T4 (rifinitura
// finale), stessa convenzione di src/app/dev/event-card-demo.
//
// Dati finti ma deterministici (nessun Math.random): ogni famiglia ha una
// fase e un'ampiezza diverse su una curva sinusoidale, così il grafico
// mostra un mix plausibile che cambia nel tempo, come farà quello vero in
// T2 quando i dati arriveranno dai file evento.

function buildFakeData(): FamilyTimelinePoint[] {
  const data: FamilyTimelinePoint[] = [];
  for (let anno = 1950; anno <= 2024; anno++) {
    const point: FamilyTimelinePoint = { anno };
    FAMILY_LEGEND.forEach((family, i) => {
      const phase = i * 0.7;
      const amplitude = 6 + i * 1.5;
      const base = 8 + i;
      const value = base + amplitude * Math.sin((anno - 1950) / 12 + phase);
      point[family.key] = Math.max(0, Math.round(value));
    });
    data.push(point);
  }
  return data;
}

export default function FamilyStreamDemoPage() {
  const data = buildFakeData();

  return (
    <main className="bg-background min-h-screen px-6 py-10">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-condensed text-2xl font-bold text-white mb-2">
          Demo: FamilyStream (temporanea, roadmap T1.1)
        </h1>
        <p className="text-neutral-gray text-sm mb-8">
          Dati finti (deterministici, non dal catalogo reale). Hover sulla legenda per evidenziare una famiglia,
          hover sul grafico per il tooltip anno/famiglia/occorrenze.
        </p>
        <FamilyStream data={data} />
      </div>
    </main>
  );
}
