import fs from "fs";
import path from "path";
import Link from "next/link";
import {
  NEUTRALIZATION_ACCENT_COLOR,
  MUTED_FILL_COLOR,
  TEXT_MUTED_COLOR,
  TEXT_PRIMARY_COLOR,
  HIGHLIGHT_COLOR,
} from "@/lib/colors";

// Pagina /methodology, frame v3 (docs/PROGETTAZIONE.md sezione 5, 5.6, 12;
// docs/CATALOGO-EVENTI.md sezione 11): spiega come si calcola la rarità di
// un evento, la finestra che ogni numero porta con sé, le trappole nei dati
// e il punteggio di notevolezza — più l'eredità v2 (metrica del pit stop),
// ridotta ai due pezzi che restano rilevanti per questa pagina.
//
// Nessun numero qui è scritto a mano: le finestre per famiglia vengono da
// public/data/events/index.json + public/data/races-index.json, le
// trappole e i pesi da public/data/params.json (chiave "eventi", scritta
// da data-layer/scripts/build_events.py) — le stesse fonti che alimentano
// il resto del sito, così un domani che quei numeri cambiano la pagina
// cambia da sola.

interface Params {
  boxFallbackCostSeconds: number;
  eventi: {
    pesiNotevolezza: {
      rarita: number;
      siccita: number;
      pesoEditoriale: number;
    };
    trappole: {
      indy500: {
        descrizione: string;
        annoDa: number;
        annoA: number;
        numeroGare: number;
      };
      tassonomiaRitiri: {
        descrizione: string;
        categorie: string[];
        numeroDidNotQualify: number;
      };
      gridZero: {
        descrizione: string;
      };
      campiVuoti: {
        descrizione: string;
        numeroRisultati: number;
        numeroPositionVuota: number;
        percentualePositionVuota: number;
      };
      puntiNonComparabili: {
        descrizione: string;
      };
    };
  };
}

interface FamilyWindow {
  famiglia: string;
  annoDa: number;
  annoA: number;
  gare: number;
}

function readParams(): Params {
  const filePath = path.join(process.cwd(), "public", "data", "params.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Params;
}

function readFamilyWindows(): FamilyWindow[] {
  const indexPath = path.join(process.cwd(), "public", "data", "events", "index.json");
  const racesPath = path.join(process.cwd(), "public", "data", "races-index.json");
  const eventi = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as {
    famiglia: string;
    annoDa: number;
    annoA: number;
  }[];
  const races = JSON.parse(fs.readFileSync(racesPath, "utf-8")) as {
    anno: number;
    isIndy500: boolean;
  }[];

  const finestrePerFamiglia = new Map<string, { annoDa: number; annoA: number }>();
  for (const e of eventi) {
    if (!finestrePerFamiglia.has(e.famiglia)) {
      finestrePerFamiglia.set(e.famiglia, { annoDa: e.annoDa, annoA: e.annoA });
    }
  }

  return Array.from(finestrePerFamiglia.entries())
    .map(([famiglia, finestra]) => {
      const gare = races.filter(
        (r) => !r.isIndy500 && r.anno >= finestra.annoDa && r.anno <= finestra.annoA
      ).length;
      return { famiglia, ...finestra, gare };
    })
    .sort((a, b) => a.annoDa - b.annoDa || b.gare - a.gare);
}

const NOME_FAMIGLIA: Record<string, string> = {
  griglia_e_risultato: "Griglia e risultato",
  margine: "Margine di vittoria",
  gare_anomale: "Gare anomale",
  team: "Team",
  carriera: "Prime volte e carriere",
  ritiri: "Cause di ritiro",
  comando_in_pista: "Comando in pista",
  strategia: "Strategia (soste)",
  neutralizzazioni: "Neutralizzazioni (SC/VSC)",
};

const COSA_ABILITA_FAMIGLIA: Record<string, string> = {
  griglia_e_risultato: "griglia, arrivo, podi, pole — la famiglia più ricca, nessuna dipendenza oltre ai risultati",
  margine: "distacco tra 1° e 2° classificato, solo quando sono sullo stesso giro",
  gare_anomale: "classificati, ritiri, gare senza ritiri",
  team: "doppiette, triplette, doppi ritiri, prime vittorie di un costruttore",
  carriera: "prime vittorie, primi podi, prime pole, debutti",
  ritiri: "quando e dove non si vede più una causa di ritiro",
  comando_in_pista: "cambi di leader, vittorie conquistate a fine gara",
  strategia: "numero di soste, chi vince fermandosi più (o meno) del previsto",
  neutralizzazioni: "pit sotto Safety Car/VSC, esclusi dalla finestra, double stack",
};

// --- Diagramma statico del costo effettivo (eredità v2) -------------------
// Un giro "normale" costa quanto il riferimento (baseline). Il giro di
// entrata ai box e quello di uscita costano di più: la differenza rispetto
// al riferimento, sommata sui due giri, è il costo effettivo del pit stop.
// SVG statico apposta (nessun dato reale, solo l'idea): non serve D3 per
// un disegno che non cambia mai.
function PitCostDiagram() {
  const laps = [
    { label: "giro L−2", height: 90, kind: "normal" as const },
    { label: "giro L−1", height: 90, kind: "normal" as const },
    { label: "giro L (entrata)", height: 190, kind: "pit" as const },
    { label: "giro L+1 (uscita)", height: 155, kind: "pit" as const },
    { label: "giro L+2", height: 90, kind: "normal" as const },
    { label: "giro L+3", height: 90, kind: "normal" as const },
  ];
  const barWidth = 74;
  const gap = 20;
  const baseY = 210;
  const baselineHeight = 90;
  const chartWidth = laps.length * barWidth + (laps.length - 1) * gap;

  return (
    <svg
      viewBox={`0 0 ${chartWidth + 40} 260`}
      width="100%"
      role="img"
      aria-label="Diagramma: il costo effettivo di un pit stop è la differenza tra i giri di entrata e uscita e il riferimento, sommata sui due giri"
    >
      <line
        x1={20}
        x2={chartWidth + 20}
        y1={baseY - baselineHeight}
        y2={baseY - baselineHeight}
        stroke={NEUTRALIZATION_ACCENT_COLOR}
        strokeWidth={1}
        strokeDasharray="5 4"
      />
      <text x={20} y={12} fontSize={11} fill={NEUTRALIZATION_ACCENT_COLOR}>
        riferimento (baseline): quanto dura di solito un giro qui
      </text>

      {laps.map((lap, i) => {
        const x = 20 + i * (barWidth + gap);
        const y = baseY - lap.height;
        const isPit = lap.kind === "pit";
        return (
          <g key={lap.label}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={lap.height}
              fill={isPit ? "#eab308" : MUTED_FILL_COLOR}
              rx={3}
            />
            <text x={x + barWidth / 2} y={baseY + 18} fontSize={11} textAnchor="middle" fill={TEXT_MUTED_COLOR}>
              {lap.label}
            </text>
            {isPit && (
              <>
                <line
                  x1={x + barWidth + 6}
                  x2={x + barWidth + 6}
                  y1={y}
                  y2={baseY - baselineHeight}
                  stroke={HIGHLIGHT_COLOR}
                  strokeWidth={1}
                />
                <text
                  x={x + barWidth + 10}
                  y={(y + (baseY - baselineHeight)) / 2 + 4}
                  fontSize={11}
                  fill={HIGHLIGHT_COLOR}
                >
                  Δ
                </text>
              </>
            )}
          </g>
        );
      })}

      <text x={20} y={246} fontSize={12} fill={TEXT_PRIMARY_COLOR}>
        costo effettivo del pit = Δ(giro di entrata) + Δ(giro di uscita)
      </text>
    </svg>
  );
}

export default function MethodologyPage() {
  const params = readParams();
  const finestre = readFamilyWindows();
  const { pesiNotevolezza, trappole } = params.eventi;

  return (
    <main className="flex-1 bg-background text-foreground py-16 px-6">
      <div className="max-w-4xl mx-auto space-y-16">
        <header className="space-y-4">
          <h1 className="font-condensed text-5xl font-bold uppercase tracking-wide">Metodologia</h1>
          <p className="text-xl text-text-secondary leading-relaxed">
            Questa pagina spiega come arriviamo ai numeri che il resto del sito mostra: come si calcola quanto è raro
            un evento, perché ogni numero porta sempre con sé la finestra di dati su cui è valido, dove i dati stessi
            fanno trappola, e come funziona — senza fingersi un modello — il generatore automatico di fatti notevoli.
          </p>
        </header>

        {/* 1. La rarità e la sua finestra */}
        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Come si calcola la rarità
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Ogni evento del catalogo (es. &quot;vittoria partendo 10° o peggio&quot;) è un predicato valutato su ogni
            unità osservabile — una gara, un risultato pilota×gara, una coppia team×gara, a seconda dell&apos;evento.
            La rarità è semplicemente:
          </p>
          <div className="bg-panel border border-graphite p-6 font-mono text-sm text-white">
            rarità = occorrenze / unità osservabili nella finestra di copertura
          </div>
          <p className="text-text-secondary leading-relaxed">
            Il denominatore non è mai &quot;tutte le 1125 gare del dataset&quot; per definizione: è quante di quelle
            gare rientrano nella finestra in cui il campo da cui l&apos;evento dipende esiste davvero. &quot;Mai successo prima&quot; nel nostro strumento significa sempre e solo &quot;mai da quando
            il dato esiste&quot; — non un assoluto storico. È per questo che ogni numero mostrato nell&apos;interfaccia
            porta con sé la sua finestra, sempre visibile e mai in un tooltip nascosto: due eventi con la stessa
            rarità ma finestre diverse (uno su 46 gare, uno su 1114) non sono confrontabili, e l&apos;interfaccia deve
            impedire visivamente quel confronto scorretto.
          </p>
        </section>

        {/* 2. Le finestre per famiglia */}
        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Le finestre di copertura, per famiglia
          </h2>
          <p className="text-text-secondary leading-relaxed">
            La finestra non è una scelta editoriale: è imposta da quali dati esistono per quel tipo di evento. Questa
            tabella è generata dal catalogo stesso, non scritta a mano: se domani si aggiunge un evento con una
            finestra diversa, la riga compare qui da sola.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-graphite text-left text-text-secondary">
                  <th className="py-2 pr-4">Famiglia</th>
                  <th className="py-2 pr-4">Copertura</th>
                  <th className="py-2 pr-4">Gare nella finestra</th>
                  <th className="py-2">Cosa abilita</th>
                </tr>
              </thead>
              <tbody>
                {finestre.map((f) => (
                  <tr key={f.famiglia} className="border-b border-graphite/40">
                    <td className="py-2 pr-4 text-white font-bold">{NOME_FAMIGLIA[f.famiglia] ?? f.famiglia}</td>
                    <td className="py-2 pr-4 text-white font-mono">
                      {f.annoDa}–{f.annoA}
                    </td>
                    <td className="py-2 pr-4 text-white font-mono">{f.gare}</td>
                    <td className="py-2 text-text-secondary">{COSA_ABILITA_FAMIGLIA[f.famiglia] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Le cinque trappole nei dati */}
        <section className="space-y-6 bg-panel border border-graphite p-8">
          <h2 className="font-condensed text-3xl font-bold text-white uppercase tracking-wider">
            Le cinque trappole nei dati
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Non sono ostacoli nascosti: sono il contenuto di questa pagina, e la prova che il gruppo ha guardato i
            dati sul serio prima di scrivere una riga di codice.
          </p>
          <ol className="list-decimal pl-6 space-y-4 text-text-secondary leading-relaxed">
            <li>
              <span className="text-white font-bold">Indianapolis 500 — {trappole.indy500.numeroGare} gare.</span> Le
              gare a Indianapolis {trappole.indy500.annoDa}-{trappole.indy500.annoA}{" "}
              erano la 500 Miglia: contava per
              il mondiale ma non era una gara di Formula 1. Inquina i record (la &quot;rimonta più grande di
              sempre&quot; risulterebbe altrimenti Indy 1957, 30 posizioni). Escluse dalla finestra di ogni evento,
              disattivabile dall&apos;utente con una spiegazione.
            </li>
            <li>
              <span className="text-white font-bold">
                &quot;Ritiro&quot; ≠ &quot;non partito&quot; — {trappole.tassonomiaRitiri.numeroDidNotQualify} Did not
                qualify.
              </span>{" "}
              Contati come ritiri, gonfierebbero ogni statistica di affidabilità degli anni &apos;80-&apos;90.
              Tassonomia esplicita, statusId per statusId, in {trappole.tassonomiaRitiri.categorie.length} categorie:{" "}
              {trappole.tassonomiaRitiri.categorie.join(", ")}.
            </li>
            <li>
              <span className="text-white font-bold">
                Campi vuoti — {trappole.campiVuoti.percentualePositionVuota}% di position vuoto.
              </span>{" "}
              Su {trappole.campiVuoti.numeroRisultati.toLocaleString("it-IT")} risultati,{" "}
              {trappole.campiVuoti.numeroPositionVuota.toLocaleString("it-IT")}{" "}
              non hanno una posizione di arrivo (i
              non classificati). Ogni evento dichiara da quali campi dipende: le unità con quel campo mancante escono
              dal denominatore, non vengono contate come &quot;non è successo&quot;.
            </li>
            <li>
              <span className="text-white font-bold">Grid = 0.</span> {trappole.gridZero.descrizione}
            </li>
            <li>
              <span className="text-white font-bold">Punti non comparabili tra ere.</span>{" "}
              {trappole.puntiNonComparabili.descrizione}
            </li>
          </ol>
        </section>

        {/* 4. Il punteggio di notevolezza */}
        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Il punteggio di notevolezza
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Data una gara, il generatore automatico valuta tutti gli eventi del catalogo e restituisce quelli
            occorsi, ordinati per notevolezza:
          </p>
          <div className="bg-panel border border-graphite p-6 font-mono text-sm text-white space-y-1">
            <div>notevolezza = {pesiNotevolezza.rarita} · (1 − rarità normalizzata)</div>
            <div>
              &nbsp;&nbsp;&nbsp;&nbsp;+ {pesiNotevolezza.siccita} · siccità normalizzata
            </div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;+ {pesiNotevolezza.pesoEditoriale} · peso editoriale dell&apos;evento</div>
          </div>
          <p className="text-text-secondary leading-relaxed">
            I tre pesi sono dichiarati a mano: la rarità pura premierebbe sempre gli eventi assurdi e irrilevanti, la
            siccità da sola premierebbe i ritorni banali, il peso editoriale (0-1, assegnato una volta per evento nel
            catalogo) tiene conto del fatto che &quot;prima vittoria in carriera&quot; interessa più di &quot;quinto
            posto partendo settimo&quot;.
          </p>
          <p className="text-text-secondary leading-relaxed">
            <strong className="text-white">Non è un modello</strong>: è una regola di ordinamento trasparente e
            ispezionabile, e va presentata così — è la differenza tra uno strumento onesto e una scatola nera.
          </p>
        </section>

        {/* 5. Eredità v2 */}
        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Eredità v2: il costo del pit stop
          </h2>
          <p className="text-text-secondary leading-relaxed">
            La famiglia &quot;neutralizzazioni&quot; della tabella qui sopra si appoggia sul lavoro della versione
            precedente del progetto. Non usiamo il tempo passato fisicamente in corsia box: quel numero è quasi
            identico in gara normale e sotto Safety Car. Guardiamo invece a quanto un pilota perde, sul giro di
            entrata e su quello di uscita, rispetto al <em>riferimento</em>: la sua baseline personale in condizioni
            normali, il ritmo di chi non si è fermato sotto neutralizzazione (perché sotto Safety Car rallenta tutto
            il gruppo, non solo chi è ai box).
          </p>
          <div className="bg-panel border border-graphite p-6">
            <PitCostDiagram />
          </div>
          <p className="text-text-secondary leading-relaxed">
            <span className="text-white font-bold">Limite dichiarato, non risolto:</span>{" "}
            l&apos;aggancio tra le due
            fonti dati (le finestre di Safety Car/Virtual Safety Car da OpenF1, i tempi sul giro da Ergast/Kaggle) è
            per numero di giro intero. Funziona bene per la Safety Car piena, che dura diversi giri, ma per la Virtual
            Safety Car — spesso 1 o 2 giri soli — non cattura <em>in che punto del giro</em>{" "}
            è scattata la
            neutralizzazione: un pilota può aver percorso quasi tutto il giro a ritmo verde e solo l&apos;ultimo
            tratto sotto VSC. Per questo gli sconti sotto VSC restano, nei dati, meno puliti di quelli sotto Safety
            Car piena. Quando manca un riferimento di gruppo affidabile (meno di 3 piloti puliti nello stesso giro,
            tipico quando quasi tutti si fermano insieme) il pit viene scartato dal calcolo invece che stimato su un
            confronto inaffidabile — anche questo tramite un valore di riserva dichiarato quando serve un fallback (
            {params.boxFallbackCostSeconds}s, la mediana dell&apos;intero campione).
          </p>

          <h3 className="font-condensed text-xl font-bold text-white uppercase tracking-wider pt-2">
            Il risultato negativo dello spike sulla decisione
          </h3>
          <p className="text-text-secondary leading-relaxed">
            La v2 aveva provato a modellare quando conviene fermarsi sotto neutralizzazione (BOX) e quando conviene
            restare in pista (STAY). Aggregando centinaia di decisioni, nessuna coppia di variabili ovvie mostrava un
            confine visibile tra chi guadagnava posizioni e chi ne perdeva — solo nuvole di punti sovrapposte. Le due
            variabili con un segnale reale (traffico, margine da chi sta dietro) combinate in un indice pesato
            arrivavano a correlare con l&apos;esito solo 0,34-0,36 con l&apos;esito a 5 giri: un vantaggio statistico
            reale ma debole, con le distribuzioni di chi guadagna e chi perde chiaramente diverse in media ma
            fortemente sovrapposte.
          </p>
          <p className="text-text-secondary leading-relaxed">
            Nel frame di questo progetto quel risultato negativo <strong className="text-white">non è un problema</strong>:
            era fatale quando la tesi era &quot;ti aiutiamo a decidere&quot;, non lo è per uno strumento descrittivo
            che lo riporta come limite misurato. Due variabili e un grafico a due assi non bastano a predire una
            scelta di gara — e riportarlo qui, invece di nasconderlo, è la stessa regola di onestà che vale per le
            finestre di copertura qui sopra.
          </p>
        </section>

        <p className="text-sm text-neutral-gray">
          I numeri di questa pagina sono letti da{" "}
          <code className="text-white">public/data/params.json</code>,{" "}
          <code className="text-white">public/data/events/index.json</code> e{" "}
          <code className="text-white">public/data/races-index.json</code>, generati dalla pipeline che calcola i
          numeri del resto del sito (<code className="text-white">data-layer/scripts/build_all.py</code> e{" "}
          <code className="text-white">data-layer/scripts/build_events.py</code>): non sono scritti a mano qui, quindi
          non possono disallinearsi dal codice che li usa davvero.
        </p>

        <div>
          <Link href="/" className="text-racing-red hover:text-white transition-colors font-condensed uppercase tracking-widest text-sm">
            ← Torna alla home
          </Link>
        </div>
      </div>
    </main>
  );
}
