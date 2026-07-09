import fs from "fs";
import path from "path";
import Link from "next/link";
import {
  PIT_CONTEXT_LEGEND,
  PIT_CONTEXT_LABELS,
  PIT_CONTEXT_COLORS,
  OUTCOME_LEGEND,
  OUTCOME_LABELS,
  NEUTRALIZATION_ACCENT_COLOR,
  MUTED_FILL_COLOR,
  TEXT_MUTED_COLOR,
  TEXT_PRIMARY_COLOR,
  HIGHLIGHT_COLOR,
} from "@/lib/colors";

// Pagina /methodology (docs/PROGETTAZIONE.md, sezioni 5 e 10): spiega, per
// un lettore non tecnico, i numeri dietro la tesi del progetto. Le soglie
// NON sono scritte a mano qui: si leggono da public/data/params.json, lo
// stesso file che la pipeline (data-layer/scripts/build_all.py) genera
// dalle costanti Python realmente usate nel calcolo — se un domani quelle
// costanti cambiano, questa pagina cambia da sola, non c'è un secondo
// posto dove il numero possa disallinearsi.

interface Params {
  tyreAgeMinLaps: number;
  trafficMinCars: number;
  postEventOutcomeOffsetLaps: number;
  justBeforeMaxLaps: number;
  justAfterMaxLaps: number;
  baselineWindowLaps: number;
  baselineMinCleanLaps: number;
  minGreenStopsForConfidence: number;
  fieldReferenceMinSamples: number;
}

function readParams(): Params {
  const filePath = path.join(process.cwd(), "public", "data", "params.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Params;
}

// --- Diagramma statico del costo effettivo -------------------------------
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
      {/* Linea di riferimento (baseline) */}
      <line
        x1={20}
        x2={chartWidth + 20}
        y1={baseY - baselineHeight}
        y2={baseY - baselineHeight}
        stroke={NEUTRALIZATION_ACCENT_COLOR}
        strokeWidth={1}
        strokeDasharray="5 4"
      />
      {/* Ancorata sopra la barra più alta (non all'altezza della baseline):
          quella era la barra "pit" più alta della baseline stessa, quindi
          il testo ci finiva dietro. */}
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
              fill={isPit ? PIT_CONTEXT_COLORS.UNDER_SC : MUTED_FILL_COLOR}
              rx={3}
            />
            <text x={x + barWidth / 2} y={baseY + 18} fontSize={11} textAnchor="middle" fill={TEXT_MUTED_COLOR}>
              {lap.label}
            </text>
            {isPit && (
              <>
                {/* Parentesi che indica la parte di giro sopra il riferimento */}
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

  return (
    <main className="flex-1 bg-background text-foreground py-16 px-6">
      <div className="max-w-4xl mx-auto space-y-16">
        <header className="space-y-4">
          <h1 className="font-condensed text-5xl font-bold uppercase tracking-wide">Metodologia</h1>
          <p className="text-xl text-text-secondary leading-relaxed">
            Questa pagina spiega, senza formule oscure, come arriviamo ai numeri che il resto del sito mostra: cosa
            intendiamo per &quot;costo&quot; di un pit stop, perché parliamo di uno &quot;sconto&quot;, come
            classifichiamo ogni sosta e ogni pilota, e dove il metodo ha dei limiti che vale la pena dichiarare
            invece di nascondere.
          </p>
        </header>

        {/* 1. Il costo effettivo */}
        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Quanto costa davvero un pit stop
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Non usiamo il tempo passato fisicamente in corsia box: quel numero è quasi identico in gara normale e
            sotto Safety Car, quindi da solo non dice nulla sullo &quot;sconto&quot;. Guardiamo invece a quanto un
            pilota perde rispetto a chi, in quello stesso momento, non si è fermato. Un pit stop occupa due giri: il
            giro in cui il pilota entra ai box (rallenta, percorre la corsia, si ferma) e il giro successivo in cui
            ne esce (riparte, spesso più piano perché le gomme sono fredde). Per ciascuno dei due giri calcoliamo
            quanto sono più lenti del &quot;normale&quot; per quel momento della gara — chiamiamo questo normale il
            <em> riferimento</em>. Il costo effettivo del pit è la somma di queste due differenze.
          </p>
          <div className="bg-panel border border-graphite p-6">
            <PitCostDiagram />
          </div>
          <p className="text-text-secondary leading-relaxed">
            La parte delicata è cosa consideriamo &quot;normale&quot;, perché non è sempre lo stesso metro di
            paragone:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-white">
            <li>
              In un giro qualunque, senza Safety Car o Virtual Safety Car in corso, il riferimento è il ritmo
              abituale dello stesso pilota: la mediana dei suoi giri puliti (senza pit, senza neutralizzazioni) nei
              giri immediatamente vicini.
            </li>
            <li>
              In un giro sotto Safety Car o Virtual Safety Car, confrontare il pilota fermo ai box con il suo ritmo
              abituale sarebbe scorretto: sotto neutralizzazione rallenta <em>tutto il gruppo</em>, non solo chi si
              ferma. Il riferimento diventa allora il ritmo di chi, in quello stesso giro, non si è fermato — la
              condizione reale con cui il pilota ai box va confrontato.
            </li>
          </ul>
        </section>

        {/* 2. Il prezzo di listino */}
        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Il prezzo di listino, e perché la mediana
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Per dire che un pit stop sotto Safety Car è &quot;scontato&quot; serve un prezzo pieno con cui
            confrontarlo. Lo chiamiamo <em>prezzo di listino</em>: è la mediana del costo effettivo dei pit stop
            fatti in condizioni normali, in quella gara. Lo sconto di ogni singolo pit è poi semplicemente la
            differenza tra il prezzo di listino e il suo costo effettivo — positivo se quel pit è costato meno del
            solito, negativo se è costato di più (per esempio per traffico in corsia box).
          </p>
          <p className="text-text-secondary leading-relaxed">
            Usiamo la <strong>mediana</strong> e non la media perché un solo pit stop rovinato — una fermata lenta,
            un contatto, un errore ai box — sposterebbe una media molto più di quanto sia giusto, mentre la mediana
            resta quella che un pilota qualunque, in condizioni tipiche, avrebbe effettivamente pagato. Se in una
            gara ci sono meno di 4 pit in condizioni normali per calcolare una mediana affidabile, usiamo invece la
            mediana dello stesso circuito calcolata su entrambe le stagioni del campione.
          </p>
        </section>

        {/* 3. Etichette e lotteria */}
        <section className="space-y-8">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Le etichette dei pit, e gli esiti della lotteria
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Ogni pit stop riceve un&apos;etichetta in base a quando è avvenuto rispetto alla neutralizzazione più
            vicina — è anche il colore con cui compare nei grafici del sito:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PIT_CONTEXT_LEGEND.map((item) => (
              <div key={item.key} className="flex items-start gap-3 bg-panel border border-graphite p-4">
                <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: item.color }} />
                <div>
                  <div className="text-white font-condensed uppercase tracking-wide font-bold">{item.label}</div>
                  <div className="text-sm text-text-secondary mt-1">{pitContextRule(item.key, params)}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-text-secondary leading-relaxed">
            Se i due compagni di squadra si fermano nello stesso giro, aggiungiamo anche il segnale{" "}
            <span className="text-white font-bold">double stack</span>: il secondo dei due perde tempo in coda al
            primo, ed è il caso che la vista &quot;stesso box, fortuna diversa&quot; nelle pagine gara mette in
            evidenza.
          </p>

          <p className="text-text-secondary leading-relaxed">
            Per ogni neutralizzazione, ogni pilota — si sia fermato o no — riceve anche un esito, che è il cuore
            della domanda di ricerca del progetto (chi poteva prendere lo sconto, e chi no):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OUTCOME_LEGEND.map((item) => (
              <div key={item.key} className="flex items-start gap-3 bg-panel border border-graphite p-4">
                <div className="w-3 h-3 rounded-sm mt-1 shrink-0" style={{ backgroundColor: item.color }} />
                <div>
                  <div className="text-white font-condensed uppercase tracking-wide font-bold">{item.label}</div>
                  <div className="text-sm text-text-secondary mt-1">{outcomeRule(item.key, params)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Le soglie */}
        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Le soglie, e perché quei numeri
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Alcune regole qui sopra dipendono da soglie numeriche. Sono scelte dichiarate, non leggi fisiche: le
            spieghiamo invece di nasconderle dietro la formula.
          </p>
          <div className="space-y-4">
            <ThresholdRow
              value={`${params.tyreAgeMinLaps} giri`}
              title="Età minima delle gomme per essere escluso (LOCKED_OUT)"
              text="Un pilota che ha montato le gomme da meno di questa soglia difficilmente sceglierebbe di rifermarsi
              subito: sarebbe uno spreco di uno stint appena iniziato. Sotto questa soglia lo consideriamo escluso
              dalla finestra a prescindere dal traffico: le gomme, da sole, bastano a spiegare perché non si è
              fermato."
            />
            <ThresholdRow
              value={`${params.trafficMinCars} auto`}
              title="Auto entro cui si rientrerebbe, per essere escluso (LOCKED_OUT)"
              text="Se fermandosi un pilota rientrerebbe in pista a meno del tempo di un pit stop da almeno questo
              numero di vetture, il traffico da solo renderebbe la sosta poco conveniente: anche qui lo trattiamo
              come escluso dalla finestra, non come una scelta libera."
            />
            <ThresholdRow
              value={`${params.justBeforeMaxLaps} giri`}
              title="Finestra dei &quot;fregati&quot; (JUST_BEFORE)"
              text="Un pilota fermatosi entro questo numero di giri PRIMA dell'inizio della neutralizzazione ha
              pagato il prezzo pieno per un soffio di sfortuna: qualche giro dopo avrebbe preso lo sconto. La
              finestra è volutamente stretta, per non etichettare come &quot;sfortunati&quot; pit che in realtà non
              c'entrano nulla con l'evento."
            />
            <ThresholdRow
              value={`${params.justAfterMaxLaps} giri`}
              title="Finestra dei ritardatari (JUST_AFTER)"
              text="Un pilota fermatosi entro questo numero di giri DOPO la fine della neutralizzazione ha perso lo
              sconto per pochissimo. La finestra è più corta di quella dei &quot;fregati&quot; perché il traffico si
              scioglie in fretta una volta finita la neutralizzazione: il vantaggio residuo sparisce presto."
            />
          </div>
        </section>

        {/* 5. Limiti noti */}
        <section className="space-y-6 bg-panel border border-graphite p-8">
          <h2 className="font-condensed text-3xl font-bold text-white uppercase tracking-wider">
            I limiti che dichiariamo
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Nessun metodo è perfetto. Questi sono i tre limiti che conosciamo e che non abbiamo risolto — li
            dichiariamo qui invece di lasciarli scoperti.
          </p>
          <ol className="list-decimal pl-6 space-y-4 text-text-secondary leading-relaxed">
            <li>
              <span className="text-white font-bold">Il riferimento può poggiare su poche osservazioni.</span> Nelle
              gare con pochi pit in condizioni normali, sia la baseline personale di un pilota sia il prezzo di
              listino della gara si calcolano su un campione piccolo — nel codice, sotto {params.baselineMinCleanLaps}{" "}
              giri puliti per la baseline personale o meno di {params.minGreenStopsForConfidence}{" "}
              pit verdi per il
              prezzo di listino di gara. In quei casi il numero esiste, ma va letto con più cautela (è la stessa
              etichetta &quot;bassa confidenza&quot; che compare nei dati). Per il riferimento di gruppo sotto
              neutralizzazione, invece, non c&apos;è un numero incerto da leggere con cautela: se in un giro restano
              meno di {params.fieldReferenceMinSamples} piloti che non si sono fermati (tipico quando quasi tutto il
              gruppo pitta nella stessa finestra di Safety Car — è proprio il momento in cui conviene farlo), quel
              pit stop viene escluso dal calcolo invece di stimato su un confronto inaffidabile. Succede per il 6,3%
              dei pit stop del campione (quasi tutti sotto Safety Car piena, quasi mai sotto VSC): mancano dai
              grafici, non ci sono con un numero sbagliato.
            </li>
            <li>
              <span className="text-white font-bold">L&apos;aggancio tra le due fonti dati è per numero di giro intero.</span>{" "}
              Le finestre di Safety Car e Virtual Safety Car arrivano da OpenF1, i tempi sul giro da Ergast/Kaggle:
              li leghiamo per numero di giro. Funziona bene per la Safety Car piena, che dura diversi giri, ma per
              la Virtual Safety Car — spesso 1 o 2 giri soli — non cattura <em>in che punto del giro</em> è scattata
              la neutralizzazione: un pilota può aver percorso quasi tutto il giro a ritmo verde e solo l&apos;ultimo
              tratto sotto VSC. Per questo gli sconti sotto VSC sono, nei dati, meno puliti di quelli sotto Safety
              Car piena.
            </li>
            <li>
              <span className="text-white font-bold">Il traffico dopo il rientro non è simulato, solo soglia.</span>{" "}
              Non ricostruiamo cosa succede davvero in pista dopo che un pilota rientra dai box — sorpassi,
              difesa della posizione, gap reali. Il modello si limita a contare quante auto sarebbero entro il tempo
              di un pit stop ({params.trafficMinCars}, la soglia qui sopra) e a trattare quel numero come traffico
              sufficiente per considerare il pilota escluso. È una semplificazione dichiarata, non una stima del
              traffico reale.
            </li>
          </ol>
        </section>

        <p className="text-sm text-neutral-gray">
          Le soglie in questa pagina sono lette da <code className="text-white">public/data/params.json</code>,
          generato dalla stessa pipeline che calcola i numeri del sito (
          <code className="text-white">data-layer/scripts/build_all.py</code>): non sono scritte a mano qui, quindi
          non possono disallinearsi dal codice che le usa davvero.
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

function ThresholdRow({ value, title, text }: { value: string; title: string; text: string }) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 border-b border-graphite/60 pb-4">
      <div className="shrink-0 sm:w-28">
        <div className="font-condensed text-3xl font-bold text-white">{value}</div>
      </div>
      <div>
        <div className="text-white font-bold mb-1">{title}</div>
        <p className="text-sm text-text-secondary leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function pitContextRule(key: keyof typeof PIT_CONTEXT_LABELS, params: Params): string {
  switch (key) {
    case "GREEN":
      return "Nessuna neutralizzazione in corso né vicina: il pit paga il prezzo pieno, ed è la base con cui calcoliamo il prezzo di listino.";
    case "UNDER_VSC":
      return "Il pilota entra o esce ai box mentre è attiva la Virtual Safety Car: è uno dei pit che possono aver preso lo sconto.";
    case "UNDER_SC":
      return "Il pilota entra o esce ai box mentre è attiva la Safety Car piena: lo sconto atteso è di solito maggiore che sotto VSC.";
    case "JUST_BEFORE":
      return `Fermato entro ${params.justBeforeMaxLaps} giri prima dell'inizio della neutralizzazione: ha pagato il prezzo pieno per un soffio.`;
    case "JUST_AFTER":
      return `Fermato entro ${params.justAfterMaxLaps} giri dopo la fine della neutralizzazione: ha perso lo sconto per poco.`;
    default:
      return "";
  }
}

function outcomeRule(key: keyof typeof OUTCOME_LABELS, params: Params): string {
  switch (key) {
    case "EXPLOITED":
      return "Si è fermato durante la finestra di neutralizzazione: ha preso lo sconto.";
    case "FULL_PRICE":
      return `Si era fermato nei ${params.justBeforeMaxLaps} giri prima dell'inizio della finestra: fregato per poco.`;
    case "LOCKED_OUT":
      return `Non poteva approfittarne: gomme montate da meno di ${params.tyreAgeMinLaps} giri, oppure sarebbe rientrato dietro ad almeno ${params.trafficMinCars} auto.`;
    case "NOT_NEEDED":
      return "Aveva già completato le soste previste: la finestra non lo riguardava.";
    case "NEUTRAL":
      return "Nessuna delle categorie precedenti si applica con certezza a questo pilota per questo evento.";
    default:
      return "";
  }
}
