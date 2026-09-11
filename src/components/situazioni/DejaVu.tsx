"use client";

// La pagina di Déjà vu (v4, docs/PROGETTAZIONE-v4.md §7, §9; roadmap D6.1):
// barra di testo → frase a slot → risposta → linea dei déjà vu → i casi
// (ritratti) per riga → i dove. Un solo stato: la situazione. Il motore e
// il reticolo girano in memoria a ogni cambiamento (0,8 ms + ~14 ms).
//
// La situazione vive anche nell'URL (?chi=…&cosa=…), così una domanda si
// condivide e la scheda gara può portare qui con la frase già compilata.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BarraTesto from "./BarraTesto";
import Frase, { nomeBreveCircuito } from "./Frase";
import LineaDejaVu, { righeDaReticolo, type RigaLinea } from "@/components/charts/LineaDejaVu";
import RitrattiGruppo from "@/components/charts/RitrattiGruppo";
import DoveDejaVu from "@/components/charts/DoveDejaVu";
import { fraseInChiaro, valuta, type Occorrenza, type Situazione } from "@/lib/situazioni/motore";
import { costruisciReticolo, type PesiAllentamento } from "@/lib/situazioni/reticolo";
import { slugPerGara } from "@/lib/situazioni/slug";
import { decodeTabelle, type DizionariJson, type GareJson, type RisultatiJson } from "@/lib/situazioni/tabelle";
import { situazioneFromParams, situazioneToParams } from "@/lib/situazioni/url";
import { SLOT_COLORS } from "@/lib/colors";

interface Props {
  risultatiJson: RisultatiJson;
  gareJson: GareJson;
  dizionari: DizionariJson;
  pesi: PesiAllentamento;
  circuitiGeo: Record<string, { lat: number; lng: number; nome: string }>;
}

// La situazione con cui la pagina apre se l'URL non ne porta una: quella
// del mockup (docs/mockup-dejavu.html), con numeri verificati (0 su 18).
const INIZIALE: Situazione = {
  chi: { tipo: "pilota", driverId: 1 },
  cosa: [{ id: "vince" }, { id: "parte_o_peggio", parametro: 10 }],
  dove: { tipo: "circuito", circuitRef: "monza" },
};

const COLONNE_IT: Record<string, string> = {
  cambiDiLeader: "i cambi di leader (tempi sul giro, dal 1996)",
  leaderDiversi: "i leader diversi (tempi sul giro, dal 1996)",
  vittoriaUltimoGiro: "l'ultimo giro (tempi sul giro, dal 1996)",
  posDopoGiro1: "la posizione dopo il giro 1 (dal 1996)",
  giriAlComando: "i giri al comando (dal 1996)",
  primoGiroAlComando: "i giri al comando (dal 1996)",
  posPeggiore: "le posizioni per giro (dal 1996)",
  posMigliore: "le posizioni per giro (dal 1996)",
  soste: "le soste ai box (dal 2011)",
  giroPrimaSosta: "le soste ai box (dal 2011)",
  posQualifica: "le qualifiche (dal 1994)",
  giroVeloceRank: "il giro veloce (dal 2004)",
  neutralizzazioni: "le neutralizzazioni (2023-2024)",
};

export default function DejaVu({ risultatiJson, gareJson, dizionari, pesi, circuitiGeo }: Props) {
  const router = useRouter();
  const tab = useMemo(() => decodeTabelle(risultatiJson, gareJson), [risultatiJson, gareJson]);
  const slug = useMemo(() => slugPerGara(tab.gare), [tab]);
  const [sit, setSitStato] = useState<Situazione>(INIZIALE);

  // Cambiare la situazione = cambiare l'URL (replace, per non riempire la
  // cronologia a ogni tasto): la fonte di verità resta lo stato locale, che
  // risponde subito; l'URL lo segue.
  const setSit = useCallback(
    (s: Situazione) => {
      setSitStato(s);
      const q = situazioneToParams(s).toString();
      window.history.replaceState(null, "", q ? `/?${q}` : "/");
    },
    []
  );
  // L'URL si legge nel browser, dopo il montaggio (non con useSearchParams:
  // in Next quel hook fa saltare la pagina a rendering solo-client sotto
  // Suspense e, in prova, gli effetti D3 del primo montaggio non partivano).
  // Stesso listener per indietro/avanti del browser.
  useEffect(() => {
    const leggi = () => {
      const s = situazioneFromParams(new URLSearchParams(window.location.search));
      if (s) setSitStato(s);
    };
    leggi();
    window.addEventListener("popstate", leggi);
    return () => window.removeEventListener("popstate", leggi);
  }, []);

  const nomi = useMemo(() => {
    const chi = sit.chi;
    return {
      pilota: chi?.tipo === "pilota" ? dizionari.piloti.find((p) => p.id === chi.driverId)?.nome : undefined,
      team: chi?.tipo === "team" ? dizionari.team.find((t) => t.id === chi.constructorId)?.nome : undefined,
      circuito: sit.dove?.tipo === "circuito" ? nomeBreveCircuito(dizionari, sit.dove.circuitRef) : undefined,
    };
  }, [sit, dizionari]);

  const risposta = useMemo(() => (sit.cosa.length ? valuta(tab, sit) : null), [tab, sit]);
  const reticolo = useMemo(
    () => (sit.cosa.length ? costruisciReticolo(tab, sit, pesi, { paeseDiCircuito: (ref) => dizionari.circuiti.find((c) => c.ref === ref)?.paese }) : null),
    [tab, sit, pesi, dizionari]
  );
  const righe = useMemo(() => (reticolo ? righeDaReticolo(reticolo) : []), [reticolo]);

  const apriGara = useCallback(
    (o: Occorrenza) => {
      const s = slug.get(o.raceId);
      if (s) router.push(`/gara/${s}`);
    },
    [slug, router]
  );

  const frase = risposta ? fraseInChiaro(sit, nomi) : "";
  const fraseCap = frase.charAt(0).toUpperCase() + frase.slice(1);
  const unitaTesto = (n: number, u: string) => {
    if (u === "gare") return n === 1 ? "gara" : "gare";
    if (u === "gare del pilota") return n === 1 ? "gara del pilota" : "gare del pilota";
    if (u === "risultati") return n === 1 ? "risultato" : "risultati";
    return n === 1 ? "risultato del team" : "risultati del team";
  };
  const righeVicine = righe.filter((r) => r.chiave !== "due");
  const vicini = righeVicine.filter((r) => !r.esatto).reduce((a, r) => a + r.nuove.length, 0);

  return (
    <div className="flex flex-col gap-8">
      <BarraTesto dizionari={dizionari} onChange={(s) => setSit(s)} autoFocus />
      <Frase dizionari={dizionari} value={sit} onChange={setSit} />

      {/* La risposta (§7.2): l'unica cosa che si legge in tre secondi. */}
      <section className="border-t border-b border-graphite py-8 grid gap-8 md:grid-cols-2 items-end" aria-live="polite">
        {!risposta && (
          <p className="text-neutral-gray">Scegli almeno un fatto in &ldquo;Cosa&rdquo;, o scrivi la situazione qui sopra.</p>
        )}
        {risposta && (
          <>
            <div>
              <div className="font-condensed font-extrabold text-racing-red leading-[0.9] tracking-tight" style={{ fontSize: "clamp(56px, 9vw, 96px)" }}>
                {risposta.finestra.vuota ? "?" : risposta.n === 0 ? "Mai" : risposta.n === 1 ? "Una volta" : `${risposta.n} volte`}
              </div>
              <div className="font-condensed text-2xl font-semibold text-white mt-2">
                {risposta.finestra.vuota ? "gli slot non hanno stagioni in comune" : `su ${risposta.m} ${unitaTesto(risposta.m, risposta.unitaDenominatore)}`}
              </div>
              <p className="text-sm text-neutral-gray mt-3 max-w-[46ch]">
                {risposta.finestra.vuota ? (
                  <>Nessuna stagione in comune tra i fatti scelti e l&apos;epoca: la domanda non ha un universo su cui contare.</>
                ) : (
                  <>
                    Finestra <b className="text-white font-medium">{risposta.finestra.annoDa}–{risposta.finestra.annoA}</b>
                    {risposta.finestra.limitataDa.length > 0
                      ? `, limitata da ${risposta.finestra.limitataDa.map((c) => COLONNE_IT[c] ?? c).filter((v, i, a) => a.indexOf(v) === i).join(" e ")}`
                      : ", tutti i campi coperti"}
                    .
                    {risposta.nonValutabili > 0 && ` ${risposta.nonValutabili} casi con un dato mancante sono fuori dal conteggio, non contati come "non è successo".`}
                  </>
                )}
              </p>
            </div>
            <div className="text-[17px] leading-relaxed max-w-[44ch]">
              <p className="text-white">{fraseCap}: {risposta.n === 0 ? "mai successo." : risposta.n === 1 ? "è successo una volta." : `è successo ${risposta.n} volte.`}</p>
              {vicini > 0 && (
                <p className="text-neutral-gray mt-2">
                  Ma ci sono <b className="text-white font-medium">{vicini} casi</b> a un solo slot di distanza. Sotto, in ordine: ogni riga è uno slot che cambia.
                </p>
              )}
              {vicini === 0 && risposta.n === 0 && <p className="text-neutral-gray mt-2">Nemmeno allentando uno slot: è una situazione davvero senza precedenti nei dati.</p>}
            </div>
          </>
        )}
      </section>

      {reticolo && risposta && (
        <>
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 mb-3">
              <div>
                <div className="font-condensed text-xs tracking-[0.14em] uppercase text-neutral-gray">Quando, e quanto è lontano</div>
                <h2 className="font-condensed text-2xl font-bold text-white">La linea dei déjà vu</h2>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-gray">
                <span><i className="inline-block w-2.5 h-2.5 rounded-full align-[-1px] mr-1.5 bg-racing-red" />uguale</span>
                {(["chi", "cosa", "dove", "quando"] as const).map((k) => (
                  <span key={k}>
                    <i className="inline-block w-2.5 h-2.5 rounded-full align-[-1px] mr-1.5" style={{ background: SLOT_COLORS[k] }} />cambia {k}
                  </span>
                ))}
                <span><i className="inline-block w-2.5 h-2.5 rounded-full align-[-1px] mr-1.5 bg-neutral-gray" />due slot</span>
              </div>
            </div>
            <LineaDejaVu reticolo={reticolo} finestra={risposta.finestra} gare={tab.gare} dizionari={dizionari} onScegli={apriGara} />
          </section>

          <section className="flex flex-col gap-8">
            <div>
              <div className="font-condensed text-xs tracking-[0.14em] uppercase text-neutral-gray">Come è successo</div>
              <h2 className="font-condensed text-2xl font-bold text-white">I casi, uno slot alla volta</h2>
            </div>
            {righeVicine.map((r: RigaLinea) => (
              <section key={r.chiave} className="border-t border-graphite pt-5">
                <h3 className="flex flex-wrap items-baseline gap-x-3 mb-3">
                  <span className="font-condensed text-3xl font-extrabold text-white tabular-nums min-w-[2.2ch] text-right">{r.nuove.length}</span>
                  <span className="font-condensed text-xl font-semibold" style={{ color: r.esatto ? "#fff" : r.colore }}>
                    {r.esatto ? "uguale" : `stesso fatto, ${r.etichetta}`}
                  </span>
                  {r.gruppo && (
                    <span className="text-sm text-neutral-gray">
                      {r.n} su {r.m} {unitaTesto(r.m, r.unita)}
                      {!r.esatto && r.nuove.length !== r.n ? ` · ${r.nuove.length} non già visti sopra` : ""}
                    </span>
                  )}
                </h3>
                <RitrattiGruppo riga={r} tabelle={tab} dizionari={dizionari} onApri={apriGara} />
              </section>
            ))}
          </section>

          <section>
            <div className="mb-3">
              <div className="font-condensed text-xs tracking-[0.14em] uppercase text-neutral-gray">Dove</div>
              <h2 className="font-condensed text-2xl font-bold text-white">I circuiti in cui è capitato</h2>
              <p className="text-sm text-neutral-gray mt-1 max-w-[70ch]">
                I casi uguali e quelli a un solo slot di distanza, per circuito. Il tasso è normalizzato per gare ospitate. Clic su un circuito: lo slot &ldquo;Dove&rdquo; si riempie e la frase si riscrive.
              </p>
            </div>
            <DoveDejaVu righe={righe} finestra={risposta.finestra} dizionari={dizionari} circuitiGeo={circuitiGeo} onCircuito={(ref) => setSit({ ...sit, dove: { tipo: "circuito", circuitRef: ref } })} />
          </section>
        </>
      )}
    </div>
  );
}
