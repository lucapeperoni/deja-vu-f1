import ElencoGare, { type VoceGara } from "./ElencoGare";
import { decodeTabelle } from "@/lib/situazioni/tabelle";
import { leggiDizionariJson, leggiGareJson, leggiRisultatiJson } from "@/lib/situazioni/tabelleServer";
import { slugPerGara } from "@/lib/situazioni/slug";
import { paeseIt } from "@/lib/situazioni/paesi";

// L'ELENCO DELLE GARE (roadmap D7.8). Il menu "Gare" portava dritto a
// Monza 2024, che a chi prova il sito sembra un errore: non c'era un posto
// da cui scegliere una gara. Ora c'è — una stagione alla volta, con la
// ricerca su tutte le 1125.
//
// Pagina server: le voci (nome, data, circuito, vincitore) si ricavano qui
// dalle tabelle delle situazioni e al browser arriva solo l'elenco, non le
// 26.759 righe dei risultati. La stagione di partenza viene da `?anno=`,
// così il "torna all'elenco" della scheda gara riporta all'anno giusto.

export default async function GarePage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const tab = decodeTabelle(leggiRisultatiJson(), leggiGareJson());
  const diz = leggiDizionariJson();
  const { risultati: r, gare: g } = tab;
  const slug = slugPerGara(g);
  const piloti = new Map(diz.piloti.map((p) => [p.id, p.nome]));
  const team = new Map(diz.team.map((t) => [t.id, t.nome]));
  const circuiti = new Map(diz.circuiti.map((c) => [c.ref, c]));

  const voci: VoceGara[] = [];
  for (let gi = 0; gi < g.righe; gi++) {
    // Il vincitore: chi ha arrivo 1. Negli anni Cinquanta possono essere due
    // (vettura condivisa), e allora si dicono entrambi.
    const vincitori: string[] = [];
    const squadre = new Set<string>();
    for (let i = g.rigaDa[gi]; i < g.rigaA[gi]; i++) {
      if (r.arrivo[i] === 1) {
        vincitori.push(piloti.get(r.driverId[i]) ?? "");
        squadre.add(team.get(r.constructorId[i]) ?? "");
      }
    }
    const c = circuiti.get(g.circuitRef[gi]);
    voci.push({
      slug: slug.get(g.raceId[gi])!,
      anno: g.anno[gi],
      round: g.round[gi],
      nome: g.nome[gi],
      data: g.data[gi],
      localita: c?.localita ?? g.circuitRef[gi],
      paese: paeseIt(g.paese[gi]),
      vincitore: vincitori.filter(Boolean).join(" e "),
      team: [...squadre].filter(Boolean).join(" · "),
    });
  }
  voci.sort((a, b) => b.anno - a.anno || a.round - b.round);

  const anni = [...new Set(voci.map((v) => v.anno))];
  const richiesto = Number((await searchParams).anno);
  const annoIniziale = anni.includes(richiesto) ? richiesto : anni[0];

  return (
    <main className="flex-1 bg-background text-foreground py-10 px-6 min-h-screen">
      <div className="max-w-[1000px] mx-auto">
        <header className="mb-8">
          <div className="text-racing-red font-condensed tracking-widest text-sm uppercase mb-2">Le gare</div>
          <h1 className="font-condensed text-4xl md:text-5xl font-bold uppercase text-white">Tutte le gare, dal 1950</h1>
          <p className="text-text-secondary mt-2">
            {voci.length} Gran Premi in {anni.length} stagioni. Scegli una stagione o cerca una gara, un circuito o un
            vincitore, e apri la sua scheda.
          </p>
        </header>
        <ElencoGare voci={voci} anni={anni} annoIniziale={annoIniziale} />
      </div>
    </main>
  );
}
