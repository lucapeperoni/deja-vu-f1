"use client";

// "I dove" del reticolo (Déjà vu v4, docs/PROGETTAZIONE-v4.md §7.4; roadmap
// D5.2): la mappa dei circuiti v3 (DoveMappa) riusata sulle occorrenze del
// reticolo — tutte le righe a un allentamento più quella esatta — con il
// tasso normalizzato per gare ospitate (dal dizionario dei circuiti). Il
// click su un circuito riempie lo slot "dove" e la frase si riscrive.
//
// Nessuna scala disegnata qui: è un adattatore che costruisce CircuitStat[]
// e passa colore/finestra alla vista D3 esistente.

import { useMemo } from "react";
import DoveMappa from "./DoveMappa";
import type { RigaLinea } from "./LineaDejaVu";
import type { CatalogEventEntry, CircuitGeo, CircuitStat } from "@/lib/eventCatalog";
import type { Finestra } from "@/lib/situazioni/motore";
import type { DizionariJson } from "@/lib/situazioni/tabelle";
import { SLOT_COLORS } from "@/lib/colors";

interface Props {
  righe: RigaLinea[];
  finestra: Finestra;
  dizionari: DizionariJson;
  circuitiGeo: Record<string, { lat: number; lng: number; nome: string }>;
  onCircuito?: (circuitRef: string) => void;
}

export default function DoveDejaVu({ righe, finestra, dizionari, circuitiGeo, onCircuito }: Props) {
  const perCircuito = useMemo<CircuitStat[]>(() => {
    const conteggio = new Map<string, number>();
    for (const r of righe) {
      if (r.chiave === "due") continue; // i casi a due slot sono troppo lontani per "dove"
      for (const o of r.nuove) conteggio.set(o.circuitRef, (conteggio.get(o.circuitRef) ?? 0) + 1);
    }
    return [...conteggio.entries()].map(([ref, n]) => {
      const c = dizionari.circuiti.find((x) => x.ref === ref);
      const geo = circuitiGeo?.[ref];
      const ospitate = c?.gare ?? 0;
      return { circuitRef: ref, nome: c?.nome ?? ref, occorrenze: n, gareOspitate: ospitate, tasso: ospitate ? n / ospitate : 0, lat: geo?.lat ?? null, lng: geo?.lng ?? null };
    });
  }, [righe, dizionari, circuitiGeo]);

  const allCircuits = useMemo<CircuitGeo[]>(() => Object.entries(circuitiGeo ?? {}).map(([circuitRef, g]) => ({ circuitRef, lat: g.lat, lng: g.lng })), [circuitiGeo]);

  // DoveMappa vuole una entry di catalogo: qui serve solo per l'unità della
  // percentuale (GARA → "%"); colore e finestra passano dall'adattatore.
  const entryFinta = useMemo(
    () => ({ unita: "GARA", famiglia: "", eventId: "situazione", nome: "", descrizione: "", parametri: {}, parametriDisponibili: {}, finestra: { annoDa: finestra.annoDa, annoA: finestra.annoA } }) as unknown as CatalogEventEntry,
    [finestra]
  );

  if (perCircuito.length === 0) return <p className="text-sm text-neutral-gray italic">Nessun circuito: non è successo da nessuna parte.</p>;
  return (
    <div data-geo={Object.keys(circuitiGeo ?? {}).length} data-circuiti={perCircuito.length}>
    <DoveMappa
      entry={entryFinta}
      perCircuito={perCircuito}
      allCircuits={allCircuits}
      isYearFiltered={false}
      colore={SLOT_COLORS.dove}
      finestraTesto={finestra.vuota ? "vuota" : `${finestra.annoDa}–${finestra.annoA}`}
      onCircuito={onCircuito}
    />
    </div>
  );
}
