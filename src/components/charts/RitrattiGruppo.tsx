"use client";

// I ritratti di un gruppo del reticolo (Déjà vu v4, roadmap D5.1): la
// griglia di small multiples sotto ogni riga della linea dei déjà vu. Ogni
// ritratto è costruito dalle tabelle (griglia, arrivo, stato, giri) e
// carica la sua traccia a richiesta; la cache è condivisa per gara.
//
// HTML per la griglia (nessuna scala), D3 dentro ogni Ritratto.

import { useMemo, useState } from "react";
import Ritratto, { type DatiRitratto, type Traccia } from "./Ritratto";
import type { RigaLinea } from "./LineaDejaVu";
import type { Occorrenza } from "@/lib/situazioni/motore";
import { STATO, type DizionariJson, type Tabelle } from "@/lib/situazioni/tabelle";

interface Props {
  riga: RigaLinea;
  tabelle: Tabelle;
  dizionari: DizionariJson;
  onApri?: (o: Occorrenza) => void;
  // quanti mostrare prima del bottone "mostra tutti"
  limite?: number;
}

const FINESTRA_TRACCE = 1996;

export function datiRitratto(o: Occorrenza, tab: Tabelle, diz: DizionariJson, colore: string): DatiRitratto {
  const { risultati: r, gare: g } = tab;
  const gi = o.garaIdx;
  const localita = diz.circuiti.find((c) => c.ref === o.circuitRef)?.localita ?? o.circuitRef;
  const titolo = `${localita} ${g.anno[gi]}`;
  if (o.riga === null) {
    return { raceId: o.raceId, driverId: null, titolo, sottotitolo: g.nome[gi], griglia: null, pitLane: false, arrivo: null, statoTesto: "fatto sulla gara", giriGara: null, haTracce: false, colore };
  }
  const i = o.riga;
  const pilota = diz.piloti.find((p) => p.id === r.driverId[i])?.nome ?? "";
  const team = diz.team.find((t) => t.id === r.constructorId[i])?.nome ?? "";
  const cat = r.statoCat[i];
  let statoTesto: string;
  if (r.arrivo[i] !== null) statoTesto = `arrivo ${r.arrivo[i]}°`;
  else if (cat === STATO.RITIRO_INCIDENTE || cat === STATO.RITIRO_TECNICO) statoTesto = `ritirato${r.giri[i] !== null ? ` al giro ${r.giri[i]}` : ""}`;
  else if (cat === STATO.NON_PARTITO) statoTesto = "non partito";
  else if (cat === STATO.NON_QUALIFICATO) statoTesto = "non qualificato";
  else statoTesto = "non classificato";
  // i giri della gara = giri del vincitore (ordine 1)
  let giriGara: number | null = null;
  for (let k = g.rigaDa[gi]; k < g.rigaA[gi]; k++) if (r.ordine[k] === 1) giriGara = r.giri[k];
  return {
    raceId: o.raceId,
    driverId: r.driverId[i],
    titolo,
    sottotitolo: `${pilota}${team ? ` · ${team}` : ""}`,
    griglia: r.griglia[i],
    pitLane: r.pitLane[i] === 1,
    arrivo: r.arrivo[i],
    statoTesto,
    giriGara,
    haTracce: g.anno[gi] >= FINESTRA_TRACCE,
    colore,
  };
}

export default function RitrattiGruppo({ riga, tabelle, dizionari, onApri, limite = 8 }: Props) {
  const [tutti, setTutti] = useState(false);
  const cache = useMemo(() => new Map<number, Promise<Traccia | null>>(), []);
  const occ = useMemo(() => [...riga.nuove].sort((a, b) => b.anno - a.anno), [riga]);
  const mostrate = tutti ? occ : occ.slice(0, limite);

  if (occ.length === 0) {
    return <p className="text-sm text-neutral-gray italic">{riga.esatto ? "Mai successo." : "Nessun caso."}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {mostrate.map((o) => {
          const d = datiRitratto(o, tabelle, dizionari, riga.colore);
          return <Ritratto key={`${o.raceId}-${o.driverId ?? "g"}`} dati={d} cache={cache} onClick={onApri ? () => onApri(o) : undefined} />;
        })}
      </div>
      {occ.length > limite && (
        <button type="button" onClick={() => setTutti((t) => !t)} className="self-start text-sm text-neutral-gray underline decoration-dotted hover:text-white">
          {tutti ? "mostra meno" : `mostra tutti i ${occ.length} casi`}
        </button>
      )}
    </div>
  );
}
