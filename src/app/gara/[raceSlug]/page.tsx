import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import GaraSelector, { type RaceOption } from "./GaraSelector";
import {
  formatBigAnswer,
  formatDrought,
  formatWindow,
  parameterSuffix,
  type CatalogEventEntry,
} from "@/lib/eventCatalog";
import { familyColor, familyLabel } from "@/lib/colors";
import { situazioneDaEventoV3 } from "@/lib/situazioni/daEventoV3";
import { situazioneToParams } from "@/lib/situazioni/url";

// Vista 6 della specifica (docs/PROGETTAZIONE.md, sezione 7 e 5.4): "la
// scheda gara". Si sceglie una gara tra le 1125 e il sistema mostra i suoi
// fatti notevoli — già ordinati per notevolezza da
// data-layer/scripts/build_events.py in public/data/facts/<slug>.json —
// ognuno arricchito con rarità/finestra/siccità dal catalogo
// (public/data/events/index.json), lo stesso incrocio per (eventId,
// parametri) già usato dal compositore (vista 2).

interface RaceIndexEntry {
  raceId: number;
  anno: number;
  round: number;
  nomeGara: string;
  data: string;
  circuitRef: string;
  nomeCircuito: string;
  isIndy500: boolean;
}

interface FactEntry {
  eventId: string;
  nome: string;
  famiglia: string;
  parametri: Record<string, number | string>;
  rarita: number;
  siccitaGare: number;
  pesoEditoriale: number;
  notevolezza: number;
}

interface FactsFile {
  raceId: number;
  anno: number;
  circuitRef: string;
  nomeCircuito: string;
  nomeGara: string;
  fatti: FactEntry[];
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(
    fs.readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), ...segments), "utf-8")
  ) as T;
}

function paramsKey(parametri: Record<string, number | string>): string {
  return JSON.stringify(Object.entries(parametri).sort(([a], [b]) => a.localeCompare(b)));
}

// Stesso algoritmo di slug di build_events.py (_costruisci_file_fatti):
// "<anno>-<circuitRef>", con "-r<round>" per le 4 coppie di gare 2020/2021
// che condividono anno+circuito (calendario Covid) — altrimenti si
// sovrascriverebbero. Verificato contro l'elenco reale di public/data/facts/
// (1125 file, corrispondenza esatta) invece di rileggere la cartella ad
// ogni richiesta.
function buildSlugByRaceId(races: RaceIndexEntry[]): Map<number, string> {
  const sorted = [...races].sort((a, b) => a.data.localeCompare(b.data));
  const used = new Set<string>();
  const slugByRaceId = new Map<number, string>();
  for (const r of sorted) {
    const base = `${r.anno}-${r.circuitRef}`;
    const slug = used.has(base) ? `${base}-r${r.round}` : base;
    used.add(base);
    slugByRaceId.set(r.raceId, slug);
  }
  return slugByRaceId;
}

export default async function GaraPage({ params }: { params: Promise<{ raceSlug: string }> }) {
  const { raceSlug } = await params;

  const factsPath = path.join(process.cwd(), "public", "data", "facts", `${raceSlug}.json`);
  if (!fs.existsSync(factsPath)) return notFound();

  const racesIndex = readJson<RaceIndexEntry[]>("public", "data", "races-index.json");
  const slugByRaceId = buildSlugByRaceId(racesIndex);

  const options: RaceOption[] = racesIndex
    .map((r) => ({
      raceSlug: slugByRaceId.get(r.raceId)!,
      anno: r.anno,
      nomeGara: r.nomeGara,
      nomeCircuito: r.nomeCircuito,
      data: r.data,
    }))
    .sort((a, b) => b.data.localeCompare(a.data));

  const facts = readJson<FactsFile>("public", "data", "facts", `${raceSlug}.json`);
  const catalog = readJson<CatalogEventEntry[]>("public", "data", "events", "index.json");
  const catalogByKey = new Map(catalog.map((e) => [`${e.eventId}::${paramsKey(e.parametri)}`, e]));

  const fattiOrdinati = [...facts.fatti].sort((a, b) => b.notevolezza - a.notevolezza);

  // Vista 7 (sezione 7): se questa gara è una delle 46 con dati di
  // neutralizzazione (v2), rimanda al capitolo esistente invece di
  // riscriverlo — non tocca quelle viste, si limita a linkarle.
  const hasNeutralizationChapter = fs.existsSync(
    path.join(process.cwd(), "public", "data", "races", `${raceSlug}.json`)
  );

  return (
    <main className="flex-1 bg-background text-foreground py-10 px-6 min-h-screen">
      <div className="max-w-[1000px] mx-auto">
        <header className="mb-10 border-b border-graphite pb-6">
          <div className="text-racing-red font-condensed tracking-widest text-sm uppercase mb-2">
            La scheda gara
          </div>
          <h1 className="font-condensed text-4xl md:text-5xl font-bold uppercase text-white">
            {facts.nomeGara} <span className="text-neutral-gray">{facts.anno}</span>
          </h1>
          <p className="text-text-secondary mt-2">{facts.nomeCircuito}</p>
        </header>

        <section className="mb-10">
          <GaraSelector options={options} currentSlug={raceSlug} />
        </section>

        <section className="mb-10">
          <h2 className="font-condensed text-2xl font-bold uppercase text-white mb-4">
            I fatti notevoli ({fattiOrdinati.length})
          </h2>
          {fattiOrdinati.length === 0 && (
            <p className="text-neutral-gray">Nessun fatto notevole rilevato per questa gara.</p>
          )}
          <div className="space-y-4">
            {fattiOrdinati.map((fatto, i) => {
              const entry = catalogByKey.get(`${fatto.eventId}::${paramsKey(fatto.parametri)}`);
              const color = familyColor(fatto.famiglia);
              const paramQuery = Object.keys(fatto.parametri)[0]
                ? `?${Object.keys(fatto.parametri)[0]}=${fatto.parametri[Object.keys(fatto.parametri)[0]]}`
                : "";
              // v4 (Déjà vu, roadmap D6.1): il fatto come situazione già
              // compilata, con "dove" = questo circuito.
              const situazione = situazioneDaEventoV3(fatto.eventId, fatto.parametri, facts.circuitRef);
              const linkDejaVu = situazione ? `/?${situazioneToParams(situazione).toString()}` : null;
              return (
                <div key={`${fatto.eventId}-${i}`} className="bg-panel border border-graphite p-5 flex gap-4">
                  <div className="text-2xl font-condensed font-bold text-neutral-gray w-8 shrink-0">{i + 1}</div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                      <h3 className="font-condensed text-xl font-bold text-white">
                        {fatto.nome}
                        {parameterSuffix({ parametri: fatto.parametri })}
                      </h3>
                      <span
                        className="text-xs uppercase tracking-widest px-2 py-0.5 rounded-sm"
                        style={{ color, backgroundColor: `${color}22` }}
                      >
                        {familyLabel(fatto.famiglia)}
                      </span>
                    </div>
                    {entry ? (
                      <>
                        <div className="text-lg font-bold" style={{ color }}>
                          {formatBigAnswer(entry)}
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm text-neutral-gray">
                          <div>
                            Finestra: <span className="text-white">{formatWindow(entry)}</span>
                          </div>
                          {formatDrought({ siccitaGareCorrente: fatto.siccitaGare, siccitaAnniCorrente: 0 }) && (
                            <div className="text-racing-red">
                              {formatDrought({ siccitaGareCorrente: fatto.siccitaGare, siccitaAnniCorrente: 0 })}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-neutral-gray">
                        Rarità {(fatto.rarita * 100).toFixed(1)}% — dettagli non trovati nel catalogo corrente
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-5 mt-2 text-sm">
                      {linkDejaVu && (
                        <Link href={linkDejaVu} className="text-racing-red hover:underline">
                          È già successo qui? Chiedi a Déjà vu →
                        </Link>
                      )}
                      <Link href={`/eventi/${fatto.eventId}${paramQuery}`} className="text-neutral-gray hover:text-white hover:underline">
                        Apri nel compositore v3
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {hasNeutralizationChapter && (
          <section className="border-t border-graphite pt-8">
            <h2 className="font-condensed text-2xl font-bold uppercase text-white mb-3">
              Il capitolo neutralizzazioni
            </h2>
            <p className="text-text-secondary mb-4">
              Questa gara fa parte delle 46 con dati di Safety Car e Virtual Safety Car (2023-2024): race trace,
              sconti, matrice delle decisioni e confronto tra compagni di squadra.
            </p>
            <Link
              href={`/race/${raceSlug}`}
              className="inline-block border border-racing-red text-racing-red px-4 py-2 uppercase text-sm tracking-widest hover:bg-racing-red hover:text-white transition-colors"
            >
              Vai al capitolo neutralizzazioni →
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
