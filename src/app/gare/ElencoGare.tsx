"use client";

// L'elenco delle gare, lato browser (roadmap D7.8): la stagione scelta e la
// ricerca. Due modi, uno alla volta:
//
// - campo di ricerca vuoto → le gare della stagione scelta, in ordine di
//   calendario, con frecce e menu per cambiare anno;
// - campo pieno → le gare di TUTTE le stagioni che corrispondono, divise per
//   anno. Cercando "monaco" si vuole Monaco in ogni anno, non solo in quello
//   che era selezionato.
//
// Ogni gara è un <a href>: funziona anche prima che React sia pronto e si
// apre in una scheda nuova con cmd/ctrl+clic (la stessa lezione dei ritratti,
// D7.6). L'anno scelto finisce nell'indirizzo (`?anno=`) con replaceState:
// ricaricando o tornando indietro dalla scheda gara si resta sulla stagione.

import { Fragment, useMemo, useState } from "react";
import { dataItaliana } from "@/lib/situazioni/schedaGara";

export interface VoceGara {
  slug: string;
  anno: number;
  round: number;
  nome: string;
  data: string;
  localita: string;
  paese: string;
  vincitore: string;
  team: string;
}

interface Props {
  voci: VoceGara[];
  // dal più recente al più vecchio
  anni: number[];
  annoIniziale: number;
}

function normalizza(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function ElencoGare({ voci, anni, annoIniziale }: Props) {
  const [anno, setAnno] = useState(annoIniziale);
  const [q, setQ] = useState("");

  function scegliAnno(a: number) {
    setAnno(a);
    const url = new URL(window.location.href);
    url.searchParams.set("anno", String(a));
    window.history.replaceState(null, "", url);
  }

  // testo in cui cercare, calcolato una volta sola per gara
  const indice = useMemo(
    () => voci.map((v) => normalizza(`${v.anno} ${v.nome} ${v.localita} ${v.paese} ${v.vincitore} ${v.team}`)),
    [voci]
  );

  const parole = normalizza(q.trim()).split(/\s+/).filter(Boolean);
  const cercando = parole.length > 0;
  // Ogni parola deve comparire da qualche parte: "2008 monaco" cerca la gara
  // di Monaco del 2008, non la frase esatta.
  const mostrate = cercando
    ? voci.filter((_, k) => parole.every((p) => indice[k].includes(p)))
    : voci.filter((v) => v.anno === anno);

  const k = anni.indexOf(anno);
  const piuRecente = k > 0 ? anni[k - 1] : null;
  const piuVecchio = k < anni.length - 1 ? anni[k + 1] : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca: gara, circuito, anno o vincitore — es. monaco, senna, 2008"
          aria-label="Cerca una gara"
          className="flex-1 min-w-[240px] bg-panel border border-graphite text-white px-3 py-2 outline-none focus:border-neutral-gray"
        />
        {!cercando && (
          <div className="flex items-center gap-1" role="group" aria-label="Stagione">
            <button
              type="button"
              onClick={() => piuVecchio !== null && scegliAnno(piuVecchio)}
              disabled={piuVecchio === null}
              aria-label="Stagione precedente"
              className="px-3 py-2 border border-graphite text-neutral-gray hover:text-white hover:border-neutral-gray disabled:opacity-30 disabled:hover:text-neutral-gray cursor-pointer disabled:cursor-default"
            >
              ‹
            </button>
            <select
              value={anno}
              onChange={(e) => scegliAnno(Number(e.target.value))}
              aria-label="Scegli la stagione"
              className="bg-panel border border-graphite text-white font-condensed text-xl font-bold px-3 py-1.5 cursor-pointer"
            >
              {anni.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => piuRecente !== null && scegliAnno(piuRecente)}
              disabled={piuRecente === null}
              aria-label="Stagione successiva"
              className="px-3 py-2 border border-graphite text-neutral-gray hover:text-white hover:border-neutral-gray disabled:opacity-30 disabled:hover:text-neutral-gray cursor-pointer disabled:cursor-default"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-neutral-gray -mt-2">
        {cercando
          ? `${mostrate.length} ${mostrate.length === 1 ? "gara trovata" : "gare trovate"} in tutte le stagioni`
          : `Stagione ${anno}: ${mostrate.length} gare`}
      </p>

      {mostrate.length === 0 && <p className="text-neutral-gray">Nessuna gara corrisponde alla ricerca.</p>}

      <ol className="border border-graphite divide-y divide-graphite/60">
        {mostrate.map((v, i) => (
          <Fragment key={v.slug}>
            {/* cercando, le gare arrivano da stagioni diverse: il titolo
                dell'anno separa i gruppi */}
            {cercando && v.anno !== mostrate[i - 1]?.anno && (
              <li className="bg-panel px-4 py-1.5 font-condensed text-lg font-bold text-white">{v.anno}</li>
            )}
            <li>
              <a
                href={`/gara/${v.slug}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5 no-underline hover:bg-graphite/60 group"
              >
                <span className="w-8 shrink-0 text-right tabular-nums text-neutral-gray text-sm">{v.round}ª</span>
                <span className="flex-1 min-w-[220px]">
                  <span className="text-white group-hover:text-racing-red transition-colors">{v.nome}</span>
                  <span className="block text-xs text-neutral-gray">
                    {v.localita}, {v.paese} · {dataItaliana(v.data)}
                  </span>
                </span>
                {/* su schermo stretto il vincitore va a capo: rientra fino al nome della
                    gara invece di finire sotto il numero della prova */}
                <span className="text-sm text-text-secondary pl-12 sm:pl-0 sm:text-right">
                  {v.vincitore ? (
                    <>
                      vince <span className="text-white">{v.vincitore}</span>
                      {v.team && <span className="text-neutral-gray"> ({v.team})</span>}
                    </>
                  ) : (
                    <span className="text-neutral-gray">vincitore non noto</span>
                  )}
                </span>
              </a>
            </li>
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
