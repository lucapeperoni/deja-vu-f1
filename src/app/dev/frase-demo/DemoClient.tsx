"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LineaDejaVu, { righeDaReticolo } from "@/components/charts/LineaDejaVu";
import RitrattiGruppo from "@/components/charts/RitrattiGruppo";
import DoveDejaVu from "@/components/charts/DoveDejaVu";
import { slugPerGara } from "@/lib/situazioni/slug";
import Frase, { nomeBreveCircuito } from "@/components/situazioni/Frase";
import BarraTesto from "@/components/situazioni/BarraTesto";
import { fraseInChiaro, valuta, type Situazione } from "@/lib/situazioni/motore";
import { costruisciReticolo, etichettaGruppo, type PesiAllentamento } from "@/lib/situazioni/reticolo";
import { decodeTabelle, type DizionariJson, type GareJson, type RisultatiJson } from "@/lib/situazioni/tabelle";

interface Props {
  risultatiJson: RisultatiJson;
  gareJson: GareJson;
  dizionari: DizionariJson;
  pesi: PesiAllentamento;
  circuitiGeo: Record<string, { lat: number; lng: number; nome: string }>;
}

// Situazione di partenza: quella del mockup (docs/mockup-dejavu.html), così
// la demo apre già su un caso noto con numeri verificati (0 su 18).
const INIZIALE: Situazione = {
  chi: { tipo: "pilota", driverId: 1 },
  cosa: [{ id: "vince" }, { id: "parte_o_peggio", parametro: 10 }],
  dove: { tipo: "circuito", circuitRef: "monza" },
};

export default function DemoClient({ risultatiJson, gareJson, dizionari, pesi, circuitiGeo }: Props) {
  const tab = useMemo(() => decodeTabelle(risultatiJson, gareJson), [risultatiJson, gareJson]);
  const [sit, setSit] = useState<Situazione>(INIZIALE);
  const router = useRouter();
  const slug = useMemo(() => slugPerGara(tab.gare), [tab]);

  const nomi = useMemo(() => {
    const chi = sit.chi;
    const pilota = chi?.tipo === "pilota" ? dizionari.piloti.find((p) => p.id === chi.driverId)?.nome : undefined;
    const team = chi?.tipo === "team" ? dizionari.team.find((t) => t.id === chi.constructorId)?.nome : undefined;
    const circuito = sit.dove?.tipo === "circuito" ? nomeBreveCircuito(dizionari, sit.dove.circuitRef) : undefined;
    return { pilota, team, circuito };
  }, [sit, dizionari]);

  const risposta = useMemo(() => (sit.cosa.length ? valuta(tab, sit) : null), [tab, sit]);
  const reticolo = useMemo(
    () =>
      sit.cosa.length
        ? costruisciReticolo(tab, sit, pesi, { paeseDiCircuito: (ref) => dizionari.circuiti.find((c) => c.ref === ref)?.paese })
        : null,
    [tab, sit, pesi, dizionari]
  );

  return (
    <div className="flex flex-col gap-8">
      <BarraTesto dizionari={dizionari} onChange={(s) => setSit(s)} />
      <Frase dizionari={dizionari} value={sit} onChange={setSit} />

      <div className="border-t border-graphite pt-6" data-testid="risposta">
        {!risposta && <p className="text-neutral-gray text-sm">Scegli almeno un fatto in &ldquo;Cosa&rdquo;.</p>}
        {risposta && (
          <>
            <p className="text-white text-lg">{fraseInChiaro(sit, nomi)}</p>
            <p className="font-condensed text-5xl font-bold text-racing-red mt-2">
              {risposta.n === 0 ? "Mai" : `${risposta.n} ${risposta.n === 1 ? "volta" : "volte"}`}
              {" "}
              <span className="text-2xl text-white font-semibold ml-3">
                su {risposta.m} {risposta.unitaDenominatore}
              </span>
            </p>
            <p className="text-sm text-neutral-gray mt-1">
              Finestra {risposta.finestra.vuota ? "vuota: gli slot non si sovrappongono" : `${risposta.finestra.annoDa}–${risposta.finestra.annoA}`}
              {risposta.finestra.limitataDa.length > 0 && ` (limitata da ${risposta.finestra.limitataDa.join(", ")})`}
              {risposta.nonValutabili > 0 && ` · ${risposta.nonValutabili} righe non valutabili escluse dal denominatore`}
            </p>
          </>
        )}
      </div>

      {reticolo && risposta && (
        <div className="border-t border-graphite pt-6">
          <h2 className="font-condensed text-lg font-bold text-white uppercase mb-3">La linea dei déjà vu</h2>
          <LineaDejaVu
            reticolo={reticolo}
            finestra={risposta.finestra}
            gare={tab.gare}
            dizionari={dizionari}
            onScegli={(o) => {
              const s = slug.get(o.raceId);
              if (s) router.push(`/gara/${s}`);
            }}
          />
        </div>
      )}

      {reticolo && risposta && (
        <div className="border-t border-graphite pt-6 flex flex-col gap-8">
          <h2 className="font-condensed text-lg font-bold text-white uppercase">I casi, uno slot alla volta</h2>
          {righeDaReticolo(reticolo)
            .filter((r) => r.chiave !== "due")
            .map((r) => (
              <section key={r.chiave}>
                <h3 className="font-condensed text-xl font-semibold mb-3" style={{ color: r.esatto ? "#fff" : r.colore }}>
                  <span className="text-3xl font-bold text-white mr-3 tabular-nums">{r.nuove.length}</span>
                  {r.etichetta}
                  <span className="text-sm text-neutral-gray ml-3">{r.gruppo ? `${r.n} su ${r.m} ${r.unita}` : ""}</span>
                </h3>
                <RitrattiGruppo
                  riga={r}
                  tabelle={tab}
                  dizionari={dizionari}
                  onApri={(o) => {
                    const s = slug.get(o.raceId);
                    if (s) router.push(`/gara/${s}`);
                  }}
                />
              </section>
            ))}
          <h2 className="font-condensed text-lg font-bold text-white uppercase">I dove</h2>
          <DoveDejaVu
            righe={righeDaReticolo(reticolo)}
            finestra={risposta.finestra}
            dizionari={dizionari}
            circuitiGeo={circuitiGeo}
            onCircuito={(ref) => setSit({ ...sit, dove: { tipo: "circuito", circuitRef: ref } })}
          />
        </div>
      )}

      {reticolo && (
        <div className="border-t border-graphite pt-6">
          <h2 className="font-condensed text-lg font-bold text-white uppercase mb-3">Reticolo ({reticolo.gruppi.length} gruppi)</h2>
          <ul className="text-sm flex flex-col gap-1">
            {reticolo.gruppi.map((g) => (
              <li key={g.chiave} className="flex gap-3 text-neutral-gray">
                <span className="w-12 text-right tabular-nums">{g.distanza.toFixed(2)}</span>
                <span className="text-white">{etichettaGruppo(g)}</span>
                <span className="tabular-nums">
                  {g.risposta.n} su {g.risposta.m} · {g.nuove.length} nuove
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
