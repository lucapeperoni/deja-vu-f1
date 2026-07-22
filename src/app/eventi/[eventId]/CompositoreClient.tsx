"use client";

// Vista 2 (docs/PROGETTAZIONE.md, sezione 7): "il compositore di eventi".
// Layout: selettore famiglia/evento in alto, la risposta grande con la
// mini-scala di rarità (ParameterRarityTrack, stesso idioma della vista 1),
// la tabella delle occorrenze, e tre riquadri segnaposto per le viste 3/4/5
// — che le altre persone aggancieranno qui, riusando lo stato condiviso
// esportato da questo file (vedi CompositoreSharedState).
//
// Navigazione fra eventi: cambiare evento fa un router.push (la pagina è
// server-side, ricarica solo il file <eventId>.json scelto — niente
// prefetch di tutto il catalogo). Muovere lo slider del parametro invece
// resta client-side: nessuna richiesta, solo un data join D3 che
// transiziona fra le varianti già in memoria — è così che "si vede la
// rarità diventare rarità" muovendo la soglia, come chiede la specifica.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ParameterRarityTrack, { type ParameterVariantPoint } from "@/components/charts/ParameterRarityTrack";
import QuandoStrip from "@/components/charts/QuandoStrip";
import DoveMappa from "@/components/charts/DoveMappa";
import {
  formatDrought,
  formatRarityPercent,
  formatWindow,
  parameterSuffix,
  unitLabel,
  type CatalogEventEntry,
  type CircuitGeo,
  type CircuitStat,
} from "@/lib/eventCatalog";
import { FAMILY_LEGEND, familyColor, familyLabel, PIT_CONTEXT_LABELS } from "@/lib/colors";

export interface EnrichedOccurrence {
  raceId: number;
  raceSlug: string | null;
  nomeGara: string | null;
  nomeCircuito: string | null;
  round: number | null;
  anno: number;
  circuitRef: string;
  [key: string]: unknown;
}

export interface ParameterVariant extends CatalogEventEntry {
  occorrenzeDettaglio: EnrichedOccurrence[];
  perStagione: Record<string, number>;
  perCircuito: CircuitStat[];
}

// Lo stato condiviso che le viste 3 (quando), 4 (dove) e 5 (griglia×arrivo)
// ricevono da qui: l'evento corrente con i SUOI parametri correnti già
// dentro (CatalogEventEntry porta .parametri), più un filtro anni opzionale
// che vista 3 pilota con un brush e che filtra anche la tabella e la vista 4.
export interface CompositoreSharedState {
  currentEvent: CatalogEventEntry;
  yearFilter: [number, number] | null;
  onYearFilterChange: (range: [number, number] | null) => void;
}

interface Props {
  catalogEvents: CatalogEventEntry[];
  eventId: string;
  variants: ParameterVariant[];
  circuitsGeo: CircuitGeo[];
}

const PAGE_SIZE = 50;
const NON_DETAIL_KEYS = new Set(["raceId", "raceSlug", "nomeGara", "nomeCircuito", "round", "anno", "circuitRef"]);

function paramsKey(parametri: Record<string, number | string>): string {
  return JSON.stringify(Object.entries(parametri).sort(([a], [b]) => a.localeCompare(b)));
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    .toLowerCase();
}

function formatParamValue(paramKey: string, value: number | string): string {
  if (paramKey === "contesto") return PIT_CONTEXT_LABELS[value as keyof typeof PIT_CONTEXT_LABELS] ?? String(value);
  return String(value);
}

export default function CompositoreClient({ catalogEvents, eventId, variants, circuitsGeo }: Props) {
  const router = useRouter();
  const base = variants[0];

  const [selectedFamily, setSelectedFamily] = useState(base.famiglia);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [yearFilter, setYearFilter] = useState<[number, number] | null>(null);
  const [visibleRows, setVisibleRows] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<{ column: "anno" | "gara"; direction: "asc" | "desc" }>({
    column: "anno",
    direction: "desc",
  });

  const paramKey = Object.keys(base.parametriDisponibili)[0];
  const paramValues = useMemo(() => (paramKey ? base.parametriDisponibili[paramKey] : []), [paramKey, base]);

  const orderedVariants = useMemo(() => {
    if (!paramKey) return variants;
    return paramValues
      .map((value) => variants.find((v) => v.parametri[paramKey] === value))
      .filter((v): v is ParameterVariant => Boolean(v));
  }, [paramKey, paramValues, variants]);

  const currentVariant = orderedVariants[sliderIndex] ?? orderedVariants[0] ?? base;

  // Numero grande "tweenato" (sezione 7, vista 2: si deve VEDERE la rarità
  // cambiare, non solo leggerla di scatto): interpolazione lineare del solo
  // conteggio occorrenze su ~450ms quando cambia la variante selezionata.
  const [displayedOccorrenze, setDisplayedOccorrenze] = useState(currentVariant.occorrenze);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const from = displayedOccorrenze;
    const to = currentVariant.occorrenze;
    if (from === to) return;
    const start = performance.now();
    const duration = 450;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayedOccorrenze(Math.round(from + (to - from) * eased));
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVariant.occorrenze]);

  function selectSliderIndex(index: number) {
    setSliderIndex(index);
    setVisibleRows(PAGE_SIZE);
  }

  function handleYearFilterChange(range: [number, number] | null) {
    setYearFilter(range);
    setVisibleRows(PAGE_SIZE);
  }

  const eventsInFamily = catalogEvents.filter((e) => e.famiglia === selectedFamily);

  const trackPoints: ParameterVariantPoint[] = orderedVariants.map((v) => ({
    key: paramsKey(v.parametri),
    label: paramKey ? formatParamValue(paramKey, v.parametri[paramKey]) : v.nome,
    rarita: v.rarita,
    occorrenze: v.occorrenze,
  }));
  const currentKey = paramsKey(currentVariant.parametri);

  // Filtro anni condiviso (brush di vista 3): filtra la tabella e ricalcola
  // il conteggio per circuito di vista 4. Il tasso di vista 4 resta invece
  // sul denominatore dell'intera finestra dell'evento — non sappiamo quante
  // gare ogni circuito ha ospitato nel solo sotto-intervallo selezionato,
  // il dato non c'è — DoveMappa lo segnala esplicitamente quando filtrato.
  const filteredOccurrences = useMemo(() => {
    if (!yearFilter) return currentVariant.occorrenzeDettaglio;
    return currentVariant.occorrenzeDettaglio.filter((o) => o.anno >= yearFilter[0] && o.anno <= yearFilter[1]);
  }, [currentVariant.occorrenzeDettaglio, yearFilter]);

  const circuitStatsForMap = useMemo(() => {
    if (!yearFilter) return currentVariant.perCircuito;
    const counts = new Map<string, number>();
    for (const occ of filteredOccurrences) counts.set(occ.circuitRef, (counts.get(occ.circuitRef) ?? 0) + 1);
    return currentVariant.perCircuito
      .map((c) => {
        const occorrenze = counts.get(c.circuitRef) ?? 0;
        return { ...c, occorrenze, tasso: c.gareOspitate > 0 ? occorrenze / c.gareOspitate : 0 };
      })
      .filter((c) => c.occorrenze > 0);
  }, [currentVariant.perCircuito, filteredOccurrences, yearFilter]);

  const sortedOccurrences = useMemo(() => {
    const rows = [...filteredOccurrences];
    rows.sort((a, b) => {
      const aVal = sort.column === "anno" ? a.anno : `${a.nomeGara ?? ""}${a.anno}`;
      const bVal = sort.column === "anno" ? b.anno : `${b.nomeGara ?? ""}${b.anno}`;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [filteredOccurrences, sort]);

  function toggleSort(column: "anno" | "gara") {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "desc" }
    );
  }

  function handleFamilyChange(newFamily: string) {
    setSelectedFamily(newFamily);
    const firstOfFamily = catalogEvents.find((e) => e.famiglia === newFamily);
    if (firstOfFamily && firstOfFamily.eventId !== eventId) router.push(`/eventi/${firstOfFamily.eventId}`);
  }

  const yearMin = base.annoDa;
  const yearMax = base.annoA;
  const effectiveYearFilter = yearFilter ?? [yearMin, yearMax];

  const sharedState: CompositoreSharedState = {
    currentEvent: currentVariant,
    yearFilter,
    onYearFilterChange: handleYearFilterChange,
  };

  return (
    <main className="flex-1 bg-background text-foreground py-10 px-6 min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-10 border-b border-graphite pb-6">
          <div className="text-racing-red font-condensed tracking-widest text-sm uppercase mb-2">
            Il compositore di eventi
          </div>
          <h1 className="font-condensed text-4xl md:text-5xl font-bold uppercase text-white">
            {currentVariant.nome}
            <span className="text-neutral-gray">{parameterSuffix(currentVariant)}</span>
          </h1>
          <p className="text-text-secondary mt-2 max-w-3xl">{currentVariant.descrizione}</p>
        </header>

        {/* Selettore famiglia / evento */}
        <section className="flex flex-wrap gap-4 mb-8">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-neutral-gray">
            Famiglia
            <select
              value={selectedFamily}
              onChange={(e) => handleFamilyChange(e.target.value)}
              className="bg-panel border border-graphite text-white px-3 py-2 min-w-[220px]"
            >
              {FAMILY_LEGEND.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-neutral-gray">
            Evento
            <select
              value={eventId}
              onChange={(e) => router.push(`/eventi/${e.target.value}`)}
              className="bg-panel border border-graphite text-white px-3 py-2 min-w-[320px]"
            >
              {eventsInFamily.map((e) => (
                <option key={e.eventId} value={e.eventId}>
                  {e.nome}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* La risposta grande */}
        <section className="bg-panel border border-graphite p-6 mb-8">
          {paramKey && paramValues.length > 1 && (
            <div className="mb-6">
              <div className="flex justify-between text-xs uppercase tracking-widest text-neutral-gray mb-2">
                <span>Parametro: {paramKey}</span>
                <span className="text-white font-bold">{formatParamValue(paramKey, currentVariant.parametri[paramKey])}</span>
              </div>
              <input
                type="range"
                min={0}
                max={paramValues.length - 1}
                step={1}
                value={sliderIndex}
                onChange={(e) => selectSliderIndex(Number(e.target.value))}
                className="w-full accent-racing-red"
              />
              <div className="mt-3">
                <ParameterRarityTrack
                  points={trackPoints}
                  currentKey={currentKey}
                  famiglia={currentVariant.famiglia}
                  onSelect={(key) => {
                    const idx = trackPoints.findIndex((p) => p.key === key);
                    if (idx >= 0) selectSliderIndex(idx);
                  }}
                />
              </div>
            </div>
          )}

          <div
            className="font-condensed text-4xl md:text-5xl font-bold text-white"
            style={{ color: familyColor(currentVariant.famiglia) }}
          >
            {displayedOccorrenze} volte su {currentVariant.denominatore} {unitLabel(currentVariant.unita)}
          </div>
          <div className="text-2xl text-text-secondary mt-1">
            ({formatRarityPercent(currentVariant.denominatore === 0 ? 0 : displayedOccorrenze / currentVariant.denominatore)})
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 text-sm text-neutral-gray">
            <div>
              Finestra: <span className="text-white">{formatWindow(currentVariant)}</span>
            </div>
            {currentVariant.ultimaOccorrenza && (
              <div>
                Ultima volta: <span className="text-white">{currentVariant.ultimaOccorrenza}</span>
              </div>
            )}
            {formatDrought(currentVariant) && <div className="text-racing-red">{formatDrought(currentVariant)}</div>}
          </div>
        </section>

        {/* Filtro anni condiviso: filtra la tabella e la vista 4, pilotabile
            anche dal brush di vista 3 qui sotto (sincronizzazione a due vie) */}
        <section className="flex flex-wrap items-end gap-4 mb-8 text-sm">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-neutral-gray">
            Da
            <input
              type="number"
              min={yearMin}
              max={effectiveYearFilter[1]}
              value={effectiveYearFilter[0]}
              onChange={(e) => handleYearFilterChange([Number(e.target.value), effectiveYearFilter[1]])}
              className="bg-panel border border-graphite text-white px-3 py-1.5 w-24"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-neutral-gray">
            A
            <input
              type="number"
              min={effectiveYearFilter[0]}
              max={yearMax}
              value={effectiveYearFilter[1]}
              onChange={(e) => handleYearFilterChange([effectiveYearFilter[0], Number(e.target.value)])}
              className="bg-panel border border-graphite text-white px-3 py-1.5 w-24"
            />
          </label>
          {yearFilter && (
            <button
              onClick={() => handleYearFilterChange(null)}
              className="text-racing-red text-xs uppercase tracking-widest hover:underline"
            >
              Reset ({yearMin}-{yearMax})
            </button>
          )}
        </section>

        {/* Vista 3 — Quando */}
        <section className="mb-8">
          <h2 className="font-condensed text-2xl font-bold uppercase text-white mb-4">Quando</h2>
          <QuandoStrip
            entry={currentVariant}
            perStagione={currentVariant.perStagione}
            yearFilter={yearFilter}
            onYearFilterChange={handleYearFilterChange}
          />
        </section>

        {/* Vista 4 — Dove */}
        <section className="mb-8">
          <h2 className="font-condensed text-2xl font-bold uppercase text-white mb-4">Dove</h2>
          <DoveMappa
            entry={currentVariant}
            perCircuito={circuitStatsForMap}
            allCircuits={circuitsGeo}
            isYearFiltered={yearFilter !== null}
          />
        </section>

        {/* Tabella delle occorrenze */}
        <section className="mb-8">
          <h2 className="font-condensed text-2xl font-bold uppercase text-white mb-4">
            Le occorrenze ({sortedOccurrences.length}
            {yearFilter ? ` su ${currentVariant.occorrenze}, ${yearFilter[0]}–${yearFilter[1]}` : ""})
          </h2>
          <div className="overflow-x-auto border border-graphite">
            <table className="w-full text-sm text-left">
              <thead className="bg-panel text-neutral-gray uppercase text-xs tracking-widest">
                <tr>
                  <th className="px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort("anno")}>
                    Anno {sort.column === "anno" && (sort.direction === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort("gara")}>
                    Gara {sort.column === "gara" && (sort.direction === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-3 py-2">Dettagli</th>
                </tr>
              </thead>
              <tbody>
                {sortedOccurrences.slice(0, visibleRows).map((occ, i) => {
                  const details = Object.entries(occ).filter(([k]) => !NON_DETAIL_KEYS.has(k));
                  return (
                    <tr key={`${occ.raceId}-${i}`} className="border-t border-graphite/50">
                      <td className="px-3 py-2 text-white">{occ.anno}</td>
                      <td className="px-3 py-2">
                        {occ.raceSlug ? (
                          <Link href={`/race/${occ.raceSlug}`} className="text-racing-red hover:underline">
                            {occ.nomeGara ?? occ.raceSlug}
                          </Link>
                        ) : (
                          <span className="text-white">{occ.nomeGara ?? occ.circuitRef}</span>
                        )}
                        <span className="text-neutral-gray"> · {occ.nomeCircuito ?? occ.circuitRef}</span>
                      </td>
                      <td className="px-3 py-2 text-neutral-gray">
                        {details.map(([k, v]) => `${humanizeKey(k)}: ${v}`).join(" · ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visibleRows < sortedOccurrences.length && (
            <button
              onClick={() => setVisibleRows((n) => n + PAGE_SIZE)}
              className="mt-4 text-racing-red text-xs uppercase tracking-widest hover:underline"
            >
              Mostra altre {Math.min(PAGE_SIZE, sortedOccurrences.length - visibleRows)} (di {sortedOccurrences.length})
            </button>
          )}
        </section>

        {/* Segnaposto per la vista 5 — layout e stato pronti, non implementata qui */}
        <PlaceholderSection
          title="Vista 5 — Griglia × arrivo"
          note="Nuvola di tutti i risultati, l'evento selezionato evidenziato."
          shared={sharedState}
        />
      </div>
    </main>
  );
}

function PlaceholderSection({ title, note, shared }: { title: string; note: string; shared: CompositoreSharedState }) {
  return (
    <div className="border border-dashed border-graphite p-6 text-neutral-gray">
      <h3 className="font-condensed text-lg font-bold uppercase text-white mb-2">{title}</h3>
      <p className="text-sm">{note}</p>
      <p className="text-xs mt-4 opacity-60">
        In arrivo — stato condiviso pronto: evento <span className="text-white">{shared.currentEvent.eventId}</span>,
        famiglia <span className="text-white">{familyLabel(shared.currentEvent.famiglia)}</span>
        {shared.yearFilter && (
          <>
            {" "}
            , anni <span className="text-white">{shared.yearFilter[0]}–{shared.yearFilter[1]}</span>
          </>
        )}
        .
      </p>
    </div>
  );
}
