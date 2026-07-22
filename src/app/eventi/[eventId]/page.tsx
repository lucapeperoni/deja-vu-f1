import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import CompositoreClient, { type EnrichedOccurrence, type ParameterVariant } from "./CompositoreClient";
import { dedupeToDefaultParams, type CatalogEventEntry, type CircuitGeo, type CircuitStat } from "@/lib/eventCatalog";

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

interface CircuitGeoFile {
  lat: number;
  lng: number;
  nome: string;
  paese: string;
}

interface PerCircuitoEntry {
  circuitRef: string;
  nome: string;
  occorrenze: number;
  gareOspitate: number;
  tasso: number;
}

interface ResultsPlaneFile {
  griglia: (number | null)[];
  arrivo: (number | null)[];
  raceId: number[];
  driverId: number[];
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
    perCircuito?: PerCircuitoEntry[];
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

// I pagliati coinvolti in un'occorrenza compaiono con chiavi diverse a
// seconda della forma del payload (sezione 6, _descrivi_payload in
// build_events.py): un Result singolo -> driverId, una coppia -> driverId1
// /driverId2, una lista -> driverIds. La famiglia neutralizzazioni (eredità
// v2, aggregate.json) porta driverId come STRINGA, non numero — da qui il
// Number() tollerante: se non converte a un numero valido o non trova
// corrispondenza nella pianta dei risultati, il punto è semplicemente
// scartato (nessun highlight per quell'occorrenza), non un errore.
function extractDriverIds(occ: Record<string, unknown>): number[] {
  const ids: number[] = [];
  const push = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n)) ids.push(n);
  };
  push(occ.driverId);
  push(occ.driverId1);
  push(occ.driverId2);
  if (Array.isArray(occ.driverIds)) for (const d of occ.driverIds) push(d);
  return ids;
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

  // Coordinate dei circuiti (vista 4, sezione 5.3): esportate a parte da
  // data-layer/scripts/build_circuits_geo.py, che legge data/raw/circuits.csv
  // direttamente — non è ancora un campo del motore eventi.
  const circuitsGeoPath = path.join(process.cwd(), "public", "data", "circuits-geo.json");
  const circuitsGeoFile: Record<string, CircuitGeoFile> = fs.existsSync(circuitsGeoPath)
    ? readJson<Record<string, CircuitGeoFile>>("public", "data", "circuits-geo.json")
    : {};
  const circuitsGeo: CircuitGeo[] = Object.entries(circuitsGeoFile).map(([circuitRef, geo]) => ({
    circuitRef,
    lat: geo.lat,
    lng: geo.lng,
  }));

  // Vista 5 (sezione 7, §10 rischio 4): la nuvola griglia×arrivo di tutti i
  // 26.354 risultati (1950-2024, Indy 500 esclusa). Il file su disco porta
  // anche driverId per risolvere ESATTAMENTE quale punto evidenziare (sotto)
  // — 355 KB, sopra il budget di 300 KB usato altrove, deroga chiesta e
  // confermata perché il file NON viene mai spedito intero al client: qui
  // si costruisce "cloud" (solo griglia/arrivo, ~159 KB) per il rendering
  // di sfondo, e una mappa raceId|driverId -> punto SOLO lato server, usata
  // subito sotto e mai passata come prop.
  const resultsPlanePath = path.join(process.cwd(), "public", "data", "results-plane.json");
  const resultsPlane: ResultsPlaneFile = fs.existsSync(resultsPlanePath)
    ? readJson<ResultsPlaneFile>("public", "data", "results-plane.json")
    : { griglia: [], arrivo: [], raceId: [], driverId: [] };
  const cloud = { griglia: resultsPlane.griglia, arrivo: resultsPlane.arrivo };

  const pointByRaceDriver = new Map<string, { grid: number; arrivo: number }>();
  for (let i = 0; i < resultsPlane.raceId.length; i++) {
    const grid = resultsPlane.griglia[i];
    const arrivo = resultsPlane.arrivo[i];
    if (grid == null || arrivo == null) continue; // niente coordinata, niente punto (sezione 5.6, regola 3)
    pointByRaceDriver.set(`${resultsPlane.raceId[i]}|${resultsPlane.driverId[i]}`, { grid, arrivo });
  }

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

    const perCircuito: CircuitStat[] = (p.perCircuito ?? []).map((c) => {
      const geo = circuitsGeoFile[c.circuitRef];
      return { ...c, lat: geo?.lat ?? null, lng: geo?.lng ?? null };
    });

    // Vista 5: risolve, per ogni occorrenza, il/i punto/i (grid, arrivo) da
    // evidenziare sul piano. Un'occorrenza senza driverId/driverId1/2/
    // driverIds riconoscibile (eventi di livello GARA puro, es. "nessun
    // ritiro") non ha un pilota specifico da segnare — resta fuori, non è
    // un errore: quell'evento non si presta a un highlight puntuale.
    const highlightedPoints: { grid: number; arrivo: number }[] = [];
    for (const occ of occorrenzeDettaglio) {
      for (const driverId of extractDriverIds(occ)) {
        const point = pointByRaceDriver.get(`${occ.raceId}|${driverId}`);
        if (point) highlightedPoints.push(point);
      }
    }

    return { ...entry, occorrenzeDettaglio, perStagione: p.perStagione ?? {}, perCircuito, highlightedPoints };
  });

  return (
    <CompositoreClient
      key={eventId}
      catalogEvents={catalogEvents}
      eventId={eventId}
      variants={variants}
      circuitsGeo={circuitsGeo}
      cloud={cloud}
    />
  );
}
