import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import GaraSelector, { type RaceOption } from "./GaraSelector";
import GiroPerGiro from "@/components/gara/GiroPerGiro";
import GrigliaArrivoGara from "@/components/gara/GrigliaArrivoGara";
import { decodeTabelle } from "@/lib/situazioni/tabelle";
import { leggiDizionariJson, leggiGareJson, leggiRisultatiJson } from "@/lib/situazioni/tabelleServer";
import {
  costruisciScheda,
  dataItaliana,
  formattaDistacco,
  formattaMargine,
  type RigaClassifica,
} from "@/lib/situazioni/schedaGara";
import { situazioneToParams } from "@/lib/situazioni/url";
import { paeseIt } from "@/lib/situazioni/paesi";

// LA SCHEDA GARA (riscritta con la roadmap D7.7).
//
// Prima questa pagina mostrava i "fatti notevoli" del catalogo v3 — "Margine
// di vittoria sotto N secondi (N=2), 183 volte su 1088 risultati" — cioè
// statistiche GLOBALI con i parametri in vista, e non una parola su quella
// gara: chi ha vinto, da dove partiva, chi si è ritirato. Segnalato da Luca
// aprendo Indianapolis 2007, dove la scheda non diceva nemmeno il nome del
// vincitore. Ora la pagina racconta la gara, con i dati che avevamo già:
// `gare.json` e `risultati.json` coprono tutte le 1125 gare dal 1950.
//
// Pagina server: legge le tabelle dal disco, ne estrae la fetta di una gara
// (costruisciScheda) e manda al browser solo quella — una ventina di righe,
// non le 26.759 della home. I due grafici sono client (D3), e le tracce giro
// per giro se le carica il browser a richiesta.

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

function readJson<T>(...segments: string[]): T {
  return JSON.parse(
    fs.readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), ...segments), "utf-8")
  ) as T;
}

// Stesso algoritmo di slug di build_events.py: "<anno>-<circuitRef>", con
// "-r<round>" per le 4 coppie di gare 2020/2021 che condividono
// anno+circuito (calendario Covid).
function buildSlugByRaceId(races: RaceIndexEntry[]): Map<number, string> {
  const sorted = [...races].sort((a, b) => a.data.localeCompare(b.data));
  const used = new Set<string>();
  const slugByRaceId = new Map<number, string>();
  for (const r of sorted) {
    const base = `${r.anno}-${r.circuitRef}`;
    const slug = used.has(base) ? `${base}-r${r.round}` : base;
    used.add(base);
    slugByRaceId.set(r.raceId, slug);
  }
  return slugByRaceId;
}

export default async function GaraPage({ params }: { params: Promise<{ raceSlug: string }> }) {
  const { raceSlug } = await params;

  const racesIndex = readJson<RaceIndexEntry[]>("public", "data", "races-index.json");
  const slugByRaceId = buildSlugByRaceId(racesIndex);
  const gara = racesIndex.find((r) => slugByRaceId.get(r.raceId) === raceSlug);
  if (!gara) return notFound();

  const tab = decodeTabelle(leggiRisultatiJson(), leggiGareJson());
  const diz = leggiDizionariJson();
  const statusIt = readJson<Record<number, string>>("public", "data", "situazioni", "status.json");
  const scheda = costruisciScheda(tab, diz, gara.raceId, statusIt);
  if (!scheda) return notFound();

  const options: RaceOption[] = racesIndex
    .map((r) => ({
      raceSlug: slugByRaceId.get(r.raceId)!,
      anno: r.anno,
      nomeGara: r.nomeGara,
      nomeCircuito: r.nomeCircuito,
      data: r.data,
    }))
    .sort((a, b) => b.data.localeCompare(a.data));

  const vincitore = scheda.podio[0] ?? null;
  const margine = formattaMargine(scheda.margineMs);

  // Il podio per posizione, non per pilota: negli anni Cinquanta due piloti
  // potevano dividersi la stessa vettura e arrivavano nella stessa posizione
  // (Monza 1950: Serafini e Ascari, entrambi secondi). Senza raggruppare, la
  // pagina mostrava due schede "2° POSTO" identiche e sembrava un errore.
  const posti = [1, 2, 3]
    .map((pos) => ({ pos, piloti: scheda.podio.filter((p) => p.arrivo === pos) }))
    .filter((x) => x.piloti.length > 0);

  // Vista 7 (v2): le 46 gare con i dati di Safety Car hanno già un capitolo
  // dedicato — si linka, non si riscrive.
  const haCapitoloNeutralizzazioni = fs.existsSync(path.join(process.cwd(), "public", "data", "races", `${raceSlug}.json`));

  // Gli agganci al Déjà vu: la stessa gara diventa una domanda sulla storia
  // della F1 ("il vincitore è partito 4°: quante volte è successo?"). È il
  // ponte fra la scheda e il cuore del sito, e sostituisce i vecchi link al
  // compositore v3.
  const domande: { testo: string; href: string }[] = [];
  if (vincitore) {
    const chi = { tipo: "pilota" as const, driverId: vincitore.driverId };
    const dove = { tipo: "circuito" as const, circuitRef: scheda.circuitRef };
    domande.push({
      testo: `${vincitore.pilota} vince a ${scheda.localita || scheda.nomeCircuito}: quante volte?`,
      href: `/?${situazioneToParams({ chi, cosa: [{ id: "vince" }], dove }).toString()}`,
    });
    if (vincitore.griglia !== null && vincitore.griglia > 1) {
      domande.push({
        testo: `Vincere partendo ${vincitore.griglia}° o peggio: quante volte?`,
        href: `/?${situazioneToParams({ cosa: [{ id: "vince" }, { id: "parte_o_peggio", parametro: vincitore.griglia }] }).toString()}`,
      });
    }
  }
  if (scheda.doppietta) {
    domande.push({
      testo: `Doppietta a ${scheda.localita || scheda.nomeCircuito}: quante volte?`,
      href: `/?${situazioneToParams({ cosa: [{ id: "doppietta" }], dove: { tipo: "circuito", circuitRef: scheda.circuitRef } }).toString()}`,
    });
  }
  if (scheda.ritiri >= 8) {
    domande.push({
      testo: `Una gara con almeno ${scheda.ritiri} ritiri: quante volte?`,
      href: `/?${situazioneToParams({ cosa: [{ id: "almeno_n_ritiri", parametro: scheda.ritiri }] }).toString()}`,
    });
  }

  return (
    <main className="flex-1 bg-background text-foreground py-10 px-6 min-h-screen">
      <div className="max-w-[1100px] mx-auto flex flex-col gap-10">
        <header className="border-b border-graphite pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-racing-red font-condensed tracking-widest text-sm uppercase mb-2">La scheda gara</div>
              <h1 className="font-condensed text-4xl md:text-5xl font-bold uppercase text-white">
                {scheda.nome} <span className="text-neutral-gray">{scheda.anno}</span>
              </h1>
            </div>
            <GaraSelector options={options} currentSlug={raceSlug} />
          </div>
          <p className="text-text-secondary mt-2">
            {scheda.nomeCircuito}
            {scheda.localita ? `, ${scheda.localita}` : ""} · {paeseIt(scheda.paese)} · {dataItaliana(scheda.data)}
            {scheda.round ? ` · ${scheda.round}ª prova` : ""}
          </p>
          <p className="text-sm text-neutral-gray mt-1">
            {scheda.giriGara !== null ? `${scheda.giriGara} giri` : "giri non noti"} · {scheda.partiti} al via ·{" "}
            {scheda.classificati} classificati · {scheda.ritiri} {scheda.ritiri === 1 ? "ritiro" : "ritiri"}
          </p>
        </header>

        {/* ---- il podio ---- */}
        <section>
          <h2 className="font-condensed text-xs tracking-[0.14em] uppercase text-neutral-gray mb-3">Come è finita</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {posti.map(({ pos, piloti }) => {
              const primo = piloti[0];
              return (
                <div key={pos} className="bg-panel border border-graphite border-t-[3px] px-4 py-3" style={{ borderTopColor: pos === 1 ? "#e10600" : "#6b7280" }}>
                  <div className="font-condensed text-xs tracking-widest uppercase text-neutral-gray">{pos}° posto</div>
                  <div className="font-condensed text-2xl font-bold text-white leading-tight">
                    {piloti.map((p) => p.pilota).join(" e ")}
                  </div>
                  <div className="text-sm text-text-secondary">{[...new Set(piloti.map((p) => p.team))].join(" · ")}</div>
                  <div className="text-xs text-neutral-gray mt-2">
                    {primo.griglia !== null ? `partito ${primo.griglia}°` : primo.pitLane ? "partito dalla pit lane" : "griglia non nota"}
                    {pos === 1 && margine ? ` · vince per ${margine}` : ""}
                    {pos !== 1 ? ` · ${formattaDistacco(primo, vincitore)}` : ""}
                  </div>
                  {piloti.length > 1 && (
                    <div className="text-xs text-neutral-gray mt-1 italic">
                      Due piloti nella stessa posizione: negli anni Cinquanta la vettura si poteva condividere.
                    </div>
                  )}
                </div>
              );
            })}
            {scheda.podio.length === 0 && <p className="text-sm text-neutral-gray italic">Di questa gara non abbiamo l&apos;ordine d&apos;arrivo.</p>}
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-1 mt-3 text-sm text-neutral-gray">
            {scheda.pole && (
              <span>
                Pole: <span className="text-white">{scheda.pole.pilota}</span>
              </span>
            )}
            {scheda.giroVeloce && (
              <span>
                Giro veloce: <span className="text-white">{scheda.giroVeloce.pilota}</span>
              </span>
            )}
            {scheda.doppietta && <span className="text-white">Doppietta {scheda.podio[0]?.team}{scheda.tripletta ? " (tripletta)" : ""}</span>}
          </div>
        </section>

        {/* ---- la gara in numeri ---- */}
        <section>
          <h2 className="font-condensed text-xs tracking-[0.14em] uppercase text-neutral-gray mb-3">La gara in numeri</h2>
          <div className="grid gap-px bg-graphite border border-graphite" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <Numero etichetta="Margine di vittoria" valore={margine} />
            <Numero etichetta="Ritiri" valore={`${scheda.ritiri} su ${scheda.partiti}`} />
            <Numero etichetta="Piloti al comando" valore={scheda.leaderDiversi !== null ? `${scheda.leaderDiversi}` : null} nota="dal 1996" />
            <Numero etichetta="Cambi al comando" valore={scheda.cambiDiLeader !== null ? `${scheda.cambiDiLeader}` : null} nota="dal 1996" />
            <Numero etichetta="Soste a testa" valore={scheda.sosteMedie !== null ? scheda.sosteMedie.toFixed(1).replace(".", ",") : null} nota="dal 2011, media" />
            <Numero
              etichetta="Safety car e VSC"
              valore={scheda.neutralizzazioni !== null ? `${scheda.neutralizzazioni}` : null}
              nota="dal 2023"
            />
          </div>
          {scheda.vittoriaUltimoGiro && <p className="text-sm text-racing-red mt-2">Il comando è cambiato all&apos;ultimo giro.</p>}
        </section>

        {/* ---- giro per giro ---- */}
        {scheda.haTracce && (
          <section>
            <h2 className="font-condensed text-2xl font-bold text-white">La gara, giro per giro</h2>
            <p className="text-sm text-neutral-gray mt-1 mb-3 max-w-[70ch]">
              La posizione di ogni pilota a ogni giro. Il podio è in evidenza; passa sopra una linea per seguirne una sola.
            </p>
            <div className="bg-panel border border-graphite p-4">
              <GiroPerGiro
                raceId={scheda.raceId}
                giriGara={scheda.giriGara}
                piloti={scheda.classifica.map((r) => ({ driverId: r.driverId, nome: r.pilota, codice: r.codice, arrivo: r.arrivo }))}
              />
            </div>
          </section>
        )}

        {/* ---- griglia -> arrivo ---- */}
        <section>
          <h2 className="font-condensed text-2xl font-bold text-white">Da dove partivano, dove sono arrivati</h2>
          <p className="text-sm text-neutral-gray mt-1 mb-3 max-w-[70ch]">
            Una linea per pilota: sale chi ha guadagnato posizioni, scende chi le ha perse. Le linee tratteggiate si fermano
            dove il pilota si è ritirato.
          </p>
          <div className="bg-panel border border-graphite p-4 max-w-[640px]">
            <GrigliaArrivoGara classifica={scheda.classifica} />
          </div>
        </section>

        {/* ---- classifica ---- */}
        <section>
          <h2 className="font-condensed text-2xl font-bold text-white mb-3">L&apos;ordine d&apos;arrivo</h2>
          <div className="overflow-x-auto border border-graphite">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-panel text-neutral-gray font-condensed uppercase tracking-widest text-xs">
                  <th className="text-left px-3 py-2">Pos</th>
                  <th className="text-left px-3 py-2">Pilota</th>
                  <th className="text-left px-3 py-2">Team</th>
                  <th className="text-right px-3 py-2">Griglia</th>
                  <th className="text-right px-3 py-2">+/−</th>
                  <th className="text-right px-3 py-2">Giri</th>
                  <th className="text-left px-3 py-2">Distacco o ritiro</th>
                  <th className="text-right px-3 py-2">Soste</th>
                  <th className="text-right px-3 py-2">Punti</th>
                </tr>
              </thead>
              <tbody>
                {scheda.classifica.map((r) => (
                  <tr key={r.driverId} className="border-t border-graphite/60">
                    <td className="px-3 py-1.5 tabular-nums text-white">{r.arrivo ?? "—"}</td>
                    <td className="px-3 py-1.5 text-white whitespace-nowrap">
                      {r.pilota}
                      {r.giroVeloce && <span className="ml-2 text-[10px] uppercase tracking-widest text-racing-red">giro veloce</span>}
                    </td>
                    <td className="px-3 py-1.5 text-text-secondary whitespace-nowrap">{r.team}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-text-secondary">
                      {r.griglia !== null ? r.griglia : r.pitLane ? "pit" : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.guadagno === null || r.guadagno === 0 ? (
                        <span className="text-neutral-gray">—</span>
                      ) : (
                        <span style={{ color: r.guadagno > 0 ? "#4ade80" : "#f87171" }}>
                          {r.guadagno > 0 ? `+${r.guadagno}` : r.guadagno}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-text-secondary">{r.giri ?? "—"}</td>
                    <td className="px-3 py-1.5 text-neutral-gray whitespace-nowrap">{formattaDistacco(r, vincitore)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-text-secondary">{r.soste ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-white">{r.punti || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-gray mt-2">
            Una cella vuota o &ldquo;—&rdquo; vuol dire che il dato non c&apos;è, non che vale zero: le soste sono note dal 2011, la
            griglia manca per alcune gare degli anni Cinquanta.
          </p>
        </section>

        {/* ---- momenti di carriera ---- */}
        {scheda.momenti.length > 0 && (
          <section>
            <h2 className="font-condensed text-2xl font-bold text-white mb-3">Quel giorno, per la prima volta</h2>
            <ul className="flex flex-col gap-1">
              {scheda.momenti.map((m, i) => (
                <li key={`${m.pilota}-${i}`} className="text-sm">
                  <span className="text-white">{m.pilota}</span> <span className="text-neutral-gray">— {m.testo}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---- aggancio al Déjà vu ---- */}
        {domande.length > 0 && (
          <section className="border-t border-graphite pt-6">
            <h2 className="font-condensed text-2xl font-bold text-white">L&apos;hai già visto?</h2>
            <p className="text-sm text-neutral-gray mt-1 mb-3 max-w-[70ch]">
              Le domande che questa gara fa venire in mente, già scritte negli slot: la risposta è un conteggio su 75
              stagioni.
            </p>
            <div className="flex flex-col gap-2 items-start">
              {domande.map((d) => (
                <Link key={d.href} href={d.href} className="text-racing-red hover:underline">
                  {d.testo} →
                </Link>
              ))}
            </div>
          </section>
        )}

        {haCapitoloNeutralizzazioni && (
          <section className="border-t border-graphite pt-6">
            <h2 className="font-condensed text-2xl font-bold text-white mb-2">Il capitolo neutralizzazioni</h2>
            <p className="text-text-secondary mb-3 max-w-[70ch]">
              Questa è una delle 46 gare con i dati di Safety Car e Virtual Safety Car (2023-2024): race trace, sconti sul
              pit stop, matrice delle decisioni e confronto fra compagni di squadra.
            </p>
            <Link
              href={`/race/${raceSlug}`}
              className="inline-block border border-racing-red text-racing-red px-4 py-2 uppercase text-sm tracking-widest hover:bg-racing-red hover:text-white transition-colors"
            >
              Vai al capitolo neutralizzazioni →
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}

// Una cella della griglia dei numeri. `valore` nullo = il dato non esiste per
// quell'anno: si scrive a parole invece di mostrare uno zero che mentirebbe.
function Numero({ etichetta, valore, nota }: { etichetta: string; valore: string | null; nota?: string }) {
  return (
    <div className="bg-panel px-4 py-3">
      <div className="font-condensed text-xs tracking-widest uppercase text-neutral-gray">{etichetta}</div>
      {valore !== null ? (
        <div className="font-condensed text-2xl font-bold text-white leading-tight">{valore}</div>
      ) : (
        <div className="font-condensed text-lg text-neutral-gray leading-tight italic">non nel dato{nota ? ` (${nota})` : ""}</div>
      )}
    </div>
  );
}

export type { RigaClassifica };
