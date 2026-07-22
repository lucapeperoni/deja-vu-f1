import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import CompositoreClient, { type EnrichedOccurrence, type ParameterVariant } from "./CompositoreClient";
import { dedupeToDefaultParams, type CatalogEventEntry } from "@/lib/eventCatalog";

// Vista 2 della specifica (docs/PROGETTAZIONE.md, sezione 7): "il
// compositore di eventi". Nessun backend (sezione 6): tutto già
// precalcolato da data-layer/scripts/build_events.py, questa pagina legge
// solo public/data/events/index.json (il catalogo, per il selettore
// famiglia/evento) e public/data/events/<eventId>.json (le occorrenze
// dettagliate dell'evento scelto).

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

interface EventDetailFile {
  eventId: string;
  nome: string;
  famiglia: string;
  unita: CatalogEventEntry["unita"];
  descrizione: string;
  campi: string[];
  annoDa: number;
  annoA: number;
  pesoEditoriale: number;
  parametriDisponibili: Record<string, (number | string)[]>;
  perParametro: {
    parametri: Record<string, number | string>;
    occorrenze: number;
    denominatore: number;
    rarita: number;
    ultimaOccorrenza: string;
    occorrenzeDettaglio: Record<string, unknown>[];
    perStagione?: Record<string, number>;
    perCircuito?: Record<string, number>;
  }[];
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), ...segments), "utf-8")) as T;
}

// Chiave canonica di un oggetto parametri, indipendente dall'ordine delle
// chiavi: usata per far corrispondere le varianti di index.json (che
// portano la siccità) a quelle del file per-evento (che portano le
// occorrenze dettagliate) — le stesse identiche combinazioni, due file
// diversi.
function paramsKey(parametri: Record<string, number | string>): string {
  return JSON.stringify(Object.entries(parametri).sort(([a], [b]) => a.localeCompare(b)));
}

export default async function EventoPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const detailPath = path.join(process.cwd(), "public", "data", "events", `${eventId}.json`);
  if (!fs.existsSync(detailPath)) return notFound();

  const catalog = readJson<CatalogEventEntry[]>("public", "data", "events", "index.json");
  const catalogEvents = dedupeToDefaultParams(catalog);
  const siccitaByKey = new Map(
    catalog.filter((e) => e.eventId === eventId).map((e) => [paramsKey(e.parametri), e])
  );

  const detail = readJson<EventDetailFile>("public", "data", "events", `${eventId}.json`);
  const racesIndex = readJson<RaceIndexEntry[]>("public", "data", "races-index.json");
  const raceById = new Map(racesIndex.map((r) => [r.raceId, r]));

  const variants: ParameterVariant[] = detail.perParametro.map((p) => {
    const siccita = siccitaByKey.get(paramsKey(p.parametri));
    const occorrenzeDettaglio: EnrichedOccurrence[] = p.occorrenzeDettaglio.map((occ) => {
      const raceId = occ.raceId as number;
      const anno = occ.anno as number;
      const circuitRef = occ.circuitRef as string;
      const race = raceById.get(raceId);
      return {
        ...occ,
        raceId,
        anno,
        circuitRef,
        raceSlug: race ? `${race.anno}-${race.circuitRef}` : null,
        nomeGara: race?.nomeGara ?? null,
        nomeCircuito: race?.nomeCircuito ?? null,
        round: race?.round ?? null,
      };
    });

    const entry: CatalogEventEntry = {
      eventId: detail.eventId,
      nome: detail.nome,
      famiglia: detail.famiglia,
      unita: detail.unita,
      descrizione: detail.descrizione,
      parametri: p.parametri,
      parametriDisponibili: detail.parametriDisponibili,
      campi: detail.campi,
      annoDa: detail.annoDa,
      annoA: detail.annoA,
      occorrenze: p.occorrenze,
      denominatore: p.denominatore,
      rarita: p.rarita,
      siccitaGareCorrente: siccita?.siccitaGareCorrente ?? 0,
      siccitaAnniCorrente: siccita?.siccitaAnniCorrente ?? 0,
      ultimaOccorrenza: p.ultimaOccorrenza,
      pesoEditoriale: detail.pesoEditoriale,
    };

    return { ...entry, occorrenzeDettaglio, perStagione: p.perStagione, perCircuito: p.perCircuito };
  });

  return <CompositoreClient key={eventId} catalogEvents={catalogEvents} eventId={eventId} variants={variants} />;
}
