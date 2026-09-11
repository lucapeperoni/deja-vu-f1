"use client";

// La barra di testo libero (Déjà vu v4, docs/PROGETTAZIONE-v4.md §7.1;
// roadmap D3.2): chi ha fretta scrive "hamilton vince monza dalla decima"
// e la frase a slot si riempie da sola, tramite il parser a dizionari
// (src/lib/situazioni/parser.ts). Sotto la barra, la riga "Ho letto: …"
// dice slot per slot cosa è stato capito e, in chiaro, cosa NON è stato
// capito: il sistema non indovina, lo dichiara.
//
// Controllato: a ogni tasto chiama onChange con la situazione letta. È la
// frase a slot (Frase.tsx) la fonte di verità: si può correggere lì quello
// che il parser ha sbagliato.

import { useMemo, useState } from "react";
import { SLOT_COLORS, SLOT_LABELS } from "@/lib/colors";
import type { Situazione } from "@/lib/situazioni/motore";
import { analizza, type Esito } from "@/lib/situazioni/parser";
import type { DizionariJson } from "@/lib/situazioni/tabelle";

interface Props {
  dizionari: DizionariJson;
  onChange: (s: Situazione, esito: Esito) => void;
  segnaposto?: string;
  autoFocus?: boolean;
}

const ESEMPI = ["hamilton vince monza dalla decima", "leclerc podio da p5 a spa", "verstappen ritiro al primo giro", "doppietta ferrari anni 2000", "vince al debutto"];

export default function BarraTesto({ dizionari, onChange, segnaposto, autoFocus }: Props) {
  const [testo, setTesto] = useState("");
  const esito = useMemo(() => (testo.trim() ? analizza(testo, dizionari) : null), [testo, dizionari]);

  function cambia(v: string) {
    setTesto(v);
    if (v.trim()) {
      const e = analizza(v, dizionari);
      onChange(e.situazione, e);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-3 bg-panel border border-neutral-gray/60 px-4 py-3 focus-within:border-white">
        <span className="font-condensed text-xs tracking-[0.14em] uppercase text-neutral-gray shrink-0">Scrivi</span>
        <input
          type="text"
          value={testo}
          onChange={(e) => cambia(e.target.value)}
          placeholder={segnaposto ?? `es. “${ESEMPI[0]}”`}
          aria-label="Descrivi la situazione in una riga"
          autoComplete="off"
          autoFocus={autoFocus}
          className="flex-1 bg-transparent text-white text-base outline-none placeholder:text-neutral-gray/70"
        />
        {testo && (
          <button type="button" aria-label="Cancella il testo" onClick={() => setTesto("")} className="text-neutral-gray hover:text-white px-1">
            ×
          </button>
        )}
      </label>
      <p className="text-sm text-neutral-gray min-h-[1.5rem]" aria-live="polite">
        {!esito && (
          <>
            Oppure prova:{" "}
            {ESEMPI.map((e, i) => (
              <span key={e}>
                <button type="button" onClick={() => cambia(e)} className="underline decoration-dotted hover:text-white">
                  {e}
                </button>
                {i < ESEMPI.length - 1 ? " · " : ""}
              </span>
            ))}
          </>
        )}
        {esito && (
          <>
            Ho letto:{" "}
            {esito.letture.length === 0 && <span>niente che io conosca. </span>}
            {esito.letture.map((l, i) => (
              <span key={`${l.slot}-${i}`}>
                <span style={{ color: SLOT_COLORS[l.slot] }}>{SLOT_LABELS[l.slot].toLowerCase()}</span> <b className="text-white font-medium">{l.valore}</b>
                {i < esito.letture.length - 1 ? " · " : ". "}
              </span>
            ))}
            {esito.nonCapito.length > 0 && (
              <span>
                Non ho capito: <span className="text-white/80">{esito.nonCapito.map((t) => `“${t}”`).join(", ")}</span>. Correggi negli slot qui sotto.
              </span>
            )}
          </>
        )}
      </p>
    </div>
  );
}
