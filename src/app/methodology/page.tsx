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
  VERDICT_COLORS,
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
  boxFallbackCostSeconds: number;
  verdictGainThreshold: number;
  verdictLossThreshold: number;
  combinedIndexWeights: { trafficFraction: number; gapBehind: number };
  minSamplesForTyreRegression: number;
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

// --- Diagramma statico del rientro previsto -------------------------------
// Cinque auto al giro del deploy (colonna sinistra, ordinate per tempo
// cumulato). Chi sceglierebbe BOX viene proiettato in avanti del costo atteso
// (§5.6): anche i rivali che boxano davvero si spostano, non solo il pilota in
// esame — è la correzione trovata nello spike P1.1 (senza, il pilota sembrava
// scivolare più indietro del reale). La posizione di rientro prevista è
// 1 + quanti restano davanti nel tempo proiettato. SVG statico apposta:
// l'idea non cambia gara per gara, solo i numeri nella scheda decisione.
function RejoinDiagram() {
  const before = [
    { id: "TU", y: 40, boxes: true },
    { id: "A", y: 76, boxes: false },
    { id: "B", y: 112, boxes: true },
    { id: "C", y: 148, boxes: false },
    { id: "D", y: 184, boxes: true },
  ];
  // Tempo proiettato: chi boxa si sposta in avanti (in basso); "TU" boxa e
  // finisce dietro ad A e C, che restano fermi al loro tempo del giro.
  const after = [
    { id: "A", y: 40 },
    { id: "C", y: 76 },
    { id: "TU", y: 112 },
    { id: "B", y: 148 },
    { id: "D", y: 184 },
  ];
  const leftX = 70;
  const rightX = 330;

  return (
    <svg
      viewBox="0 0 400 230"
      width="100%"
      role="img"
      aria-label="Diagramma: la posizione di rientro prevista conta quante auto, proiettate in avanti se boxano, restano davanti al pilota in esame"
    >
      <text x={leftX} y={16} fontSize={11} textAnchor="middle" fill={TEXT_MUTED_COLOR}>
        al giro del deploy
      </text>
      <text x={rightX} y={16} fontSize={11} textAnchor="middle" fill={TEXT_MUTED_COLOR}>
        tempo proiettato (se boxi)
      </text>

      {before.map((d) => {
        const isYou = d.id === "TU";
        const target = after.find((a) => a.id === d.id)!;
        return (
          <g key={d.id}>
            <line
              x1={leftX + 14}
              y1={d.y}
              x2={rightX - 14}
              y2={target.y}
              stroke={isYou ? HIGHLIGHT_COLOR : MUTED_FILL_COLOR}
              strokeWidth={isYou ? 2 : 1}
              strokeDasharray={d.boxes ? undefined : "3 3"}
            />
            <circle
              cx={leftX}
              cy={d.y}
              r={12}
              fill={isYou ? VERDICT_COLORS.GAINED : MUTED_FILL_COLOR}
            />
            <text x={leftX} y={d.y + 4} fontSize={10} textAnchor="middle" fill={TEXT_PRIMARY_COLOR}>
              {d.id}
            </text>
          </g>
        );
      })}
      {after.map((d) => {
        const isYou = d.id === "TU";
        return (
          <g key={d.id}>
            <circle
              cx={rightX}
              cy={d.y}
              r={12}
              fill={isYou ? VERDICT_COLORS.GAINED : MUTED_FILL_COLOR}
            />
            <text x={rightX} y={d.y + 4} fontSize={10} textAnchor="middle" fill={TEXT_PRIMARY_COLOR}>
              {d.id}
            </text>
          </g>
        );
      })}

      <text x={rightX + 26} y={112 + 4} fontSize={11} fill={HIGHLIGHT_COLOR}>
        ← rientri 3°
      </text>
      <text x={20} y={222} fontSize={11} fill={TEXT_MUTED_COLOR}>
        tratteggio = non boxa in questa finestra, resta al tempo del deploy
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

        {/* 3. Etichette ed esiti */}
        <section className="space-y-8">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Le etichette dei pit, e l&apos;esito di ogni scelta
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

        {/* 4. Lo snapshot della decisione */}
        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Lo snapshot della decisione: le due opzioni
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Per ogni pilota, a ogni neutralizzazione, ricostruiamo la decisione com&apos;era in quel momento — non con
            il senno di poi. Da posizione, gap con chi sta davanti e dietro, età e mescola delle gomme, soste già
            fatte rispetto a quelle tipiche di quella gara, e quanti altri si stanno fermando nella stessa finestra,
            quantifichiamo le due opzioni che il muretto aveva davanti:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-white">
            <li>
              <strong>BOX</strong> — il costo atteso è la mediana dello sconto effettivo (§5.1-5.3) dei pit affidabili
              già avvenuti in quello stesso evento; se l&apos;evento non ne ha nessuno, usiamo un valore di riserva
              dichiarato ({params.boxFallbackCostSeconds}s, la mediana dell&apos;intero campione). Da questo costo
              deriviamo la <strong>posizione di rientro prevista</strong>: proiettiamo in avanti il tempo cumulato di
              ogni pilota che boxa davvero in quella finestra (anche i rivali, non solo il pilota in esame — altrimenti
              lo si farebbe scivolare più indietro di quanto accadrà per davvero) e contiamo quante auto restano
              proiettate davanti.
            </li>
            <li>
              <strong>STAY</strong> — la posizione si conserva, le gomme restano le stesse; il costo è solo
              differito: se serve ancora una sosta, prima o poi si paga il prezzo pieno (§5.2), con la scommessa
              implicita che arrivi un&apos;altra neutralizzazione (la caoticità del circuito, sotto).
            </li>
          </ul>
          <div className="bg-panel border border-graphite p-6">
            <RejoinDiagram />
          </div>
          <p className="text-text-secondary leading-relaxed">
            Nel disegno, il pilota evidenziato boxa: nel tempo proiettato due rivali che restano fuori (tratteggiati,
            fermi al loro tempo del giro del deploy) lo scavalcano, mentre chi boxa insieme a lui si sposta anch&apos;esso
            in avanti. La posizione di rientro prevista conta solo chi resta davanti nel tempo proiettato — è una
            stima, non un replay di gara: il suo errore tipico è dichiarato più sotto, tra i limiti.
          </p>
        </section>

        {/* 5. Cos'è la scelta giusta */}
        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Cos&apos;è la &quot;scelta giusta&quot;, e perché non simuliamo il controfattuale
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Diamo un verdetto retrospettivo a ogni scelta guardando il delta di posizioni 5 giri dopo la fine della
            finestra: guadagnato se il pilota è salito di almeno{" "}
            {params.verdictGainThreshold} posizione, perso se ne ha perse almeno {Math.abs(params.verdictLossThreshold)}
            , pari negli altri casi (incluso quando il dato non è calcolabile). Nessuna simulazione: guardiamo cosa è
            successo davvero in pista.
          </p>
          <p className="text-text-secondary leading-relaxed">
            Per rafforzare il verdetto nei casi-storia, lo confrontiamo con il <strong>gemello</strong>: il pilota
            vicino in classifica, nelle stesse condizioni, che ha scelto l&apos;opposto. Il gemello perfetto è il
            compagno di squadra — stessa macchina, stesso muretto — che rende la vista &quot;stesso box, fortuna
            diversa&quot; un esperimento naturale: l&apos;unica variabile che cambia davvero è la scelta.
          </p>
          <p className="text-text-secondary leading-relaxed">
            Deliberatamente <strong>non</strong> costruiamo una classifica controfattuale simulando la gara che
            sarebbe successa con la scelta opposta: richiederebbe di modellare sorpassi, difesa della posizione e gap
            reali in pista, cose che i nostri dati (tempi per giro, non telemetria) non permettono di ricostruire in
            modo difendibile. Il confronto con il gemello dà lo stesso tipo di risposta — &quot;cosa succede a chi ha
            scelto diversamente, in condizioni simili&quot; — usando solo cose che sono davvero accadute.
          </p>
        </section>

        {/* 6. L'indice combinato */}
        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            La mappa del &quot;quando conviene&quot;: l&apos;indice combinato
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Aggregando centinaia di decisioni BOX, la domanda diventa: quali condizioni distinguono chi ha guadagnato
            posizioni da chi ne ha perse? Abbiamo provato prima le coppie di variabili più ovvie in uno scatter a due
            assi (margine dietro × età gomme, età gomme × fase di gara, soste fatte × età gomme, margine dietro ×
            soste fatte): <strong>nessuna mostrava un confine visibile</strong> tra chi guadagna e chi perde — solo
            nuvole di punti sovrapposte. Per questo la mappa in home non è uno scatter: un confine netto a 2 assi non
            c&apos;è nei dati, e disegnarlo comunque sarebbe disonesto.
          </p>
          <p className="text-text-secondary leading-relaxed">
            Le due variabili con un segnale reale, misurato correlando ciascuna da sola con l&apos;esito a 5 giri tra
            chi ha scelto BOX, sono il <strong>traffico</strong> (quota del gruppo che si ferma nella stessa finestra:
            correlazione 0,28 — chi si ferma in tanti si &quot;salva&quot; a vicenda) e il <strong>margine dietro</strong>{" "}
            (correlazione 0,18). Le combiniamo in un indice unico, pesato in proporzione a quelle correlazioni
            individuali (pesi dichiarati a mano, non ottimizzati sui dati — il campione di casi BOX guadagnato/perso è
            troppo piccolo per un fit affidabile senza overfitting):
          </p>
          <div className="bg-panel border border-graphite p-6 font-mono text-sm text-white">
            indice combinato = {params.combinedIndexWeights.trafficFraction} × z-score(traffico) +{" "}
            {params.combinedIndexWeights.gapBehind} × z-score(margine dietro)
          </div>
          <p className="text-text-secondary leading-relaxed">
            Sull&apos;intero campione, l&apos;indice combinato correla con l&apos;esito a 5 giri{" "}
            <strong>0,34-0,36</strong> (verificato stabile su due metà casuali del campione). È più del segnale di
            ciascuna variabile presa da
            sola, ma resta un segnale <strong>debole</strong>: le distribuzioni di chi guadagna e chi perde, sull&apos;indice,
            hanno medie chiaramente diverse ma si sovrappongono pesantemente. Per questo la mappa in home confronta
            due distribuzioni sovrapposte (non un confine), e il testo la dichiara esplicitamente come una{" "}
            <strong>tendenza statistica</strong> — un vantaggio reale ma modesto — mai come una previsione: lo
            strumento aiuta la decisione, non la sostituisce.
          </p>
        </section>

        {/* 7. Sorpassabilità e caoticità */}
        <section className="space-y-6">
          <h2 className="font-condensed text-3xl font-bold text-racing-red uppercase tracking-wider">
            Il contesto del circuito: sorpassabilità e caoticità
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Due parametri di circuito completano la scheda decisione, calcolati sui nostri stessi dati:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-white">
            <li>
              <strong>Sorpassabilità</strong> — la media dei cambi di posizione tra giri verdi consecutivi, per
              circuito, sulle due stagioni: quanto si muove normalmente la classifica quando la pista non è
              neutralizzata (la stessa decisione vale l&apos;opposto a Monaco e a Monza). L&apos;abbiamo provata come
              possibile terza variabile dell&apos;indice combinato, ma non porta segnale (correlazione con l&apos;esito
              ≈ -0,10, come l&apos;età gomme): <strong>non entra nell&apos;indice</strong>, resta solo un filtro di
              contesto dichiarato nella mappa (es. per confrontare le distribuzioni solo sulle piste dove sorpassare è
              più facile).
            </li>
            <li>
              <strong>Caoticità</strong> — quante neutralizzazioni (SC + VSC) ha avuto quella pista, sommate sulle
              due stagioni del campione: è la base della scommessa implicita di STAY (&quot;arriverà un&apos;altra
              Safety Car?&quot;). È una stima grezza su solo 2 stagioni per pista — poche gare per pista per dirla con
              sicurezza — dichiarata come tale, non un tasso di probabilità affidabile.
            </li>
          </ul>
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
            Nessun metodo è perfetto. Questi sono i limiti che conosciamo e che non abbiamo risolto — li dichiariamo
            qui invece di lasciarli scoperti.
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
            <li>
              <span className="text-white font-bold">La posizione di rientro prevista è una stima, non un replay.</span>{" "}
              Nello spike sulla gara campione l&apos;errore mediano tra posizione prevista e posizione reale dopo la
              finestra è di 1 posizione: buono per giudicare il senso della scelta, non un numero da leggere alla
              singola posizione come fosse certo.
            </li>
            <li>
              <span className="text-white font-bold">L&apos;indice combinato della mappa è una tendenza, non una certezza.</span>{" "}
              Correla con l&apos;esito a 5 giri 0,34-0,36: un vantaggio statistico reale, misurato su tutto il
              campione, ma le distribuzioni di chi guadagna e chi perde si sovrappongono pesantemente. Non è, e non
              vuole essere, una regola che predice il singolo caso.
            </li>
            <li>
              <span className="text-white font-bold">La caoticità del circuito poggia su sole 2 stagioni.</span> Il
              conteggio delle neutralizzazioni per pista (2023-2024) è la scommessa implicita dietro STAY, ma con
              1-2 gare per pista a stagione è una stima grezza, non un tasso di probabilità storico affidabile.
            </li>
            <li>
              <span className="text-white font-bold">I piloti senza bisogno di fermarsi non entrano nella mappa.</span>{" "}
              Chi era in categoria NOT_NEEDED (aveva già completato le soste previste) resta visibile nella matrice
              della lotteria ma è escluso dalla mappa e dall&apos;indice combinato: non è una decisione box/stay
              reale, includerlo sposterebbe le distribuzioni senza motivo.
            </li>
            <li>
              <span className="text-white font-bold">Le gare bagnate non hanno un trattamento a parte.</span> Come
              in v1, la pioggia non è un parametro della decisione: cambia radicalmente i riferimenti (gomme,
              tempi, convenienza del box) e trattarla assieme al resto avrebbe sporcato tutte le altre metriche —
              un limite dichiarato, non un caso raro da inseguire.
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
