"use client";

// Cambia gara: una riga sola, non mezza schermata (roadmap D7.7). Prima
// l'elenco delle 25 gare più recenti stava sempre aperto sotto la testata e
// spingeva in fondo alla pagina il contenuto della gara che si era appena
// aperta — cioè il motivo per cui si è lì.
//
// Le voci sono <a href> e non router.push: come i ritratti della home,
// funzionano anche prima che React abbia idratato la pagina e si aprono in
// una scheda nuova con cmd/ctrl+clic.

import { useEffect, useMemo, useRef, useState } from "react";

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

const MAX_RESULTS = 30;

export default function GaraSelector({ options, currentSlug }: Props) {
  const [aperto, setAperto] = useState(false);
  const [query, setQuery] = useState("");
  const contenitore = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!aperto) return;
    const fuori = (e: PointerEvent) => {
      if (contenitore.current && !contenitore.current.contains(e.target as Node)) setAperto(false);
    };
    document.addEventListener("pointerdown", fuori, true);
    return () => document.removeEventListener("pointerdown", fuori, true);
  }, [aperto]);

  const filtrate = useMemo(() => {
    // Ogni parola della ricerca deve trovarsi da qualche parte (anno, nome
    // gara o circuito): "2021 monaco" cerca ENTRAMBE le parole, non la frase
    // esatta — "2021" e "Monaco" non compaiono mai nello stesso campo.
    const parole = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const trovate = parole.length
      ? options.filter((o) => {
          const testo = `${o.anno} ${o.nomeGara} ${o.nomeCircuito}`.toLowerCase();
          return parole.every((w) => testo.includes(w));
        })
      : options;
    return { righe: trovate.slice(0, MAX_RESULTS), totale: trovate.length };
  }, [options, query]);

  return (
    <div ref={contenitore} className="relative">
      <button
        type="button"
        onClick={() => setAperto((a) => !a)}
        aria-expanded={aperto}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-gray border border-graphite hover:text-white hover:border-neutral-gray cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Cambia gara <span aria-hidden>▾</span>
      </button>
      {aperto && (
        <div className="absolute right-0 top-full mt-1 z-40 w-[min(28rem,90vw)] bg-panel border border-graphite shadow-xl flex flex-col max-h-[24rem]">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAperto(false)}
            placeholder="anno, gara o circuito — es. 2021 monaco"
            aria-label="Cerca una gara"
            className="shrink-0 w-full bg-graphite text-white px-3 py-2 text-sm outline-none border-b border-graphite focus:border-neutral-gray"
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtrate.righe.map((o) => (
              <a
                key={o.raceSlug}
                href={`/gara/${o.raceSlug}`}
                className={`px-3 py-1.5 flex justify-between gap-4 text-sm no-underline hover:bg-graphite ${
                  o.raceSlug === currentSlug ? "text-white bg-graphite/60" : "text-neutral-gray"
                }`}
              >
                <span className="truncate">
                  {o.nomeGara} <span className="text-xs">· {o.nomeCircuito}</span>
                </span>
                <span className="shrink-0 tabular-nums">{o.anno}</span>
              </a>
            ))}
            {filtrate.righe.length === 0 && <div className="px-3 py-2 text-sm text-neutral-gray">Nessuna gara trovata.</div>}
          </div>
          {filtrate.totale > filtrate.righe.length && (
            <div className="shrink-0 px-3 py-1.5 text-xs text-neutral-gray border-t border-graphite">
              {filtrate.righe.length} di {filtrate.totale}
              {query ? " che corrispondono" : ` — le più recenti delle ${options.length} gare`}: continua a scrivere per restringere.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
