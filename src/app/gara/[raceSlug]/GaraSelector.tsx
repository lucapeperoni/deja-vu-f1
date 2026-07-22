"use client";

// Selettore delle 1125 gare (vista 6, sezione 7): ricerca testuale su anno,
// nome gara e circuito. Le opzioni arrivano già ordinate per data
// decrescente da page.tsx; qui si filtra e si tronca il risultato — 1125
// righe tutte insieme sarebbero pesanti quanto la nuvola di vista 5 senza
// nessuno dei suoi vantaggi (non è un'unica nuvola densa, sono 1125 righe
// di testo interattive).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface RaceOption {
  raceSlug: string;
  anno: number;
  nomeGara: string;
  nomeCircuito: string;
  data: string;
}

interface Props {
  options: RaceOption[];
  currentSlug: string;
}

const MAX_RESULTS = 25;

export default function GaraSelector({ options, currentSlug }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    // Ogni parola della ricerca deve trovarsi da qualche parte (anno,
    // nome gara o circuito): "2021 monaco" cerca ENTRAMBE le parole, non
    // la frase esatta — altrimenti non troverebbe mai nulla, dato che
    // "2021" e "Monaco" non compaiono mai nello stesso campo.
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = words.length
      ? options.filter((o) => {
          const haystack = `${o.anno} ${o.nomeGara} ${o.nomeCircuito}`.toLowerCase();
          return words.every((w) => haystack.includes(w));
        })
      : options;
    return matches.slice(0, MAX_RESULTS);
  }, [options, query]);

  return (
    <div>
      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-neutral-gray mb-3">
        Cerca una gara (anno o nome)
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="es. 2021 monaco, brazilian grand prix..."
          className="bg-panel border border-graphite text-white px-3 py-2 normal-case tracking-normal text-base"
        />
      </label>
      <div className="border border-graphite max-h-80 overflow-y-auto">
        {filtered.map((o) => (
          <button
            key={o.raceSlug}
            onClick={() => router.push(`/gara/${o.raceSlug}`)}
            className={`w-full text-left px-4 py-2 flex justify-between gap-4 border-b border-graphite/50 last:border-b-0 hover:bg-white/5 ${
              o.raceSlug === currentSlug ? "bg-racing-red/10 text-white" : "text-neutral-gray"
            }`}
          >
            <span>
              {o.nomeGara} <span className="text-xs">· {o.nomeCircuito}</span>
            </span>
            <span className="shrink-0">{o.anno}</span>
          </button>
        ))}
        {filtered.length === 0 && <div className="px-4 py-3 text-neutral-gray text-sm">Nessuna gara trovata.</div>}
      </div>
      {options.length > filtered.length && !query && (
        <div className="text-xs text-neutral-gray mt-2">
          Mostrate le {MAX_RESULTS} più recenti di {options.length} — cerca per vederne altre.
        </div>
      )}
    </div>
  );
}
