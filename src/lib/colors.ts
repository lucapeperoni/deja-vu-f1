// Palette condivisa da tutte le viste (docs/PROGETTAZIONE.md, sezione 7:
// "il colore codifica SEMPRE l'etichetta del pit, MAI il team", eccetto la
// vista 5). Cinque colori categoriali, derivati dalla palette Okabe-Ito
// (colorblind-safe): nessun verde nel set, per evitare qualunque ambiguità
// rosso/verde con la categoria "fregato" (JUST_BEFORE).

export type PitContext =
  | "GREEN"
  | "UNDER_VSC"
  | "UNDER_SC"
  | "JUST_BEFORE"
  | "JUST_AFTER";

export const PIT_CONTEXT_COLORS: Record<PitContext, string> = {
  GREEN: "#94a3b8", // grigio ardesia: condizione normale, nessun evento
  UNDER_VSC: "#56b4e9", // azzurro: sconto sotto Virtual Safety Car
  UNDER_SC: "#0072b2", // blu intenso: sconto sotto Safety Car piena
  JUST_BEFORE: "#d55e00", // vermiglio: il "fregato", pagato prezzo pieno appena prima
  // Arancio Okabe-Ito, non la porpora originaria (#cc79a7): simulando
  // protanopia e deuteranopia (matrici Machado-Oliveira-Fernandes 2009) la
  // porpora cadeva a una distanza RGB di soli ~20 punti da GREEN sotto
  // deuteranopia (~41 sotto protanopia) — praticamente indistinguibile.
  // L'arancio porta la distanza minima tra tutte le coppie a 61-75 punti
  // in entrambe le simulazioni (task 5.2, passata di accessibilità).
  JUST_AFTER: "#e69f00",
};

export const PIT_CONTEXT_LABELS: Record<PitContext, string> = {
  GREEN: "In verde",
  UNDER_VSC: "Sotto VSC",
  UNDER_SC: "Sotto Safety Car",
  JUST_BEFORE: "Fregato (prezzo pieno)",
  JUST_AFTER: "Appena dopo la fine",
};

export function pitContextColor(context: string): string {
  return PIT_CONTEXT_COLORS[context as PitContext] ?? PIT_CONTEXT_COLORS.GREEN;
}

export const PIT_CONTEXT_LEGEND: { key: PitContext; label: string; color: string }[] = (
  Object.keys(PIT_CONTEXT_COLORS) as PitContext[]
).map((key) => ({ key, label: PIT_CONTEXT_LABELS[key], color: PIT_CONTEXT_COLORS[key] }));

// Bande di neutralizzazione sullo sfondo della race trace: due luminosità
// della stessa tinta gialla (coerente col dominio, bandiera gialla), non
// una delle 5 categoriali sopra — sono uno sfondo, non un'etichetta di pit.
export const NEUTRALIZATION_BAND_COLORS = {
  SC: "rgba(234, 179, 8, 0.28)", // più scura: evento più impattante
  VSC: "rgba(234, 179, 8, 0.12)", // più chiara
};

// Colore di evidenziazione delle linee al hover/click: deliberatamente
// fuori dalla palette dei contesti pit, per non creare un sesto significato
// che si confonde con le etichette.
export const HIGHLIGHT_COLOR = "#f8fafc";
export const DEFAULT_LINE_COLOR = "#4b5563";

// Accento del dominio "neutralizzazione" (bandiera gialla): testo delle
// bande SC/VSC, intestazioni di evento, linee di riferimento. Non è
// un'etichetta di pit né un esito — è un terzo significato ("qui c'è un
// evento/riferimento"), tenuto volutamente fuori da PIT_CONTEXT_COLORS e
// OUTCOME_COLORS. Un'unica costante invece di "#eab308" ripetuto a mano in
// ogni vista (task 5.2, passata di qualità).
export const NEUTRALIZATION_ACCENT_COLOR = "#eab308";

// Colore delle tappe di racconto (task 5.1): marcatori numerati sulla race
// trace e stato attivo nel pannello. Riusa il rosso di brand (--racing-red
// in globals.css) invece di un'altra tinta ad hoc, per restare coerente
// con l'identità visiva del sito fuori dai grafici D3.
export const STORY_ACCENT_COLOR = "#e10600";

// Testo delle etichette dentro gli SVG: due soli livelli, non i tanti grigi
// leggermente diversi che si erano accumulati vista per vista.
export const TEXT_MUTED_COLOR = "#9ca3af"; // etichette secondarie (nomi pilota non evidenziati, assi)
export const TEXT_PRIMARY_COLOR = "#e5e7eb"; // valori/numeri in evidenza su sfondo scuro
export const CONTRAST_TEXT_COLOR = "#0a0a0a"; // testo scuro sopra un marker/cella colorata chiara
export const WHITE_TEXT_COLOR = "#ffffff"; // testo chiaro sopra un accento pieno e scuro (es. STORY_ACCENT_COLOR)

// Riempimento "assente/non applicabile": stessa tinta di OUTCOME_COLORS.NEUTRAL
// qui sotto, ma usata anche fuori dalla matrice della lotteria (es. la mezza
// riga di "stesso box, fortuna diversa" quando un pilota non si è fermato) —
// un'unica costante invece di ripetere "#334155" a mano.
export const MUTED_FILL_COLOR = "#334155";

// Esiti della "matrice della lotteria" (vista 4, sezione 5.5 della
// specifica). Palette distinta da quella dei contesti pit sopra (schema
// diverso, appare in una vista diversa), ma con la stessa filosofia:
// derivata da Okabe-Ito, colorblind-safe, nessun rosso/verde a coppia.
// Il verde-bluastro (#009e73) è la variante di "verde" raccomandata per la
// sicurezza daltonica: resta distinguibile dal vermiglio anche per
// protanopia/deuteranopia, a differenza di un verde saturo puro.
// FULL_PRICE riusa deliberatamente lo stesso vermiglio di JUST_BEFORE nei
// contesti pit: sono la stessa storia (pagato prezzo pieno appena prima
// della finestra), vista da due componenti diversi.
export type PitOutcome = "EXPLOITED" | "FULL_PRICE" | "LOCKED_OUT" | "NOT_NEEDED" | "NEUTRAL";

export const OUTCOME_COLORS: Record<PitOutcome, string> = {
  EXPLOITED: "#009e73", // verde-bluastro: ha sfruttato la finestra, esito positivo
  FULL_PRICE: "#d55e00", // vermiglio: fregato, ha pagato prezzo pieno poco prima (= JUST_BEFORE)
  LOCKED_OUT: "#f0e442", // giallo: escluso dalla finestra (gomme fresche o traffico)
  NOT_NEEDED: "#64748b", // grigio medio: non gli serviva fermarsi
  NEUTRAL: MUTED_FILL_COLOR, // grigio scuro: nessuna delle precedenti, quasi "assente"
};

export const OUTCOME_LABELS: Record<PitOutcome, string> = {
  EXPLOITED: "Ha sfruttato la finestra",
  FULL_PRICE: "Fregato (prezzo pieno)",
  LOCKED_OUT: "Escluso dalla finestra",
  NOT_NEEDED: "Non gli serviva",
  NEUTRAL: "Nessuna delle precedenti",
};

export function outcomeColor(category: string): string {
  return OUTCOME_COLORS[category as PitOutcome] ?? OUTCOME_COLORS.NEUTRAL;
}

export const OUTCOME_LEGEND: { key: PitOutcome; label: string; color: string }[] = (
  Object.keys(OUTCOME_COLORS) as PitOutcome[]
).map((key) => ({ key, label: OUTCOME_LABELS[key], color: OUTCOME_COLORS[key] }));

// Indice combinato (§5.6/§7 vista 6, mappa "quando conviene" in home): due
// sole serie, guadagnato/perso, sull'esito a 5 giri delle sole decisioni
// BOX (NOT_NEEDED e NEUTRAL esclusi, v. §5.6). Riusa gli stessi due colori
// già validati per la matrice della lotteria (EXPLOITED/FULL_PRICE): stessa
// storia (esito positivo/negativo di un pit), stesse distanze colorblind-
// safe già verificate (task 5.2) — niente palette nuova da validare da capo.
export type Verdict = "GAINED" | "LOST" | "NEUTRAL";

export const VERDICT_COLORS: Record<"GAINED" | "LOST", string> = {
  GAINED: OUTCOME_COLORS.EXPLOITED,
  LOST: OUTCOME_COLORS.FULL_PRICE,
};

export const VERDICT_LABELS: Record<"GAINED" | "LOST", string> = {
  GAINED: "Ha guadagnato posizioni",
  LOST: "Ha perso posizioni",
};

// Matrice della lotteria, vista 4 riorientata (§5.6/§7, task P3.2): le
// celle si colorano per scelta × esito, non più solo per la categoria v1
// (EXPLOITED/LOCKED_OUT/..., che resta raggiungibile con un toggle nel
// componente). Stessa coppia di tinte guadagnato/perso della mappa in
// home (VERDICT_COLORS): l'hue codifica sempre l'esito, in tutto il sito.
// La scelta (BOX vs STAY) si distingue per luminosità sulla STESSA tinta —
// BOX pieno, STAY una tinta più chiara — non con un'altra tinta: un hue in
// più avrebbe rotto la regola "il colore codifica una cosa sola" (sezione
// 7) proprio nella vista che più conta. FORCED riusa il giallo di
// LOCKED_OUT: è l'esatta stessa condizione vista dal lato scelta invece
// che esito (v. classify_choice in decision_snapshots.py). NOT_NEEDED
// riusa il grigio omonimo ma va reso "attenuato" nel componente
// (fill-opacity ridotta), non con un colore a parte: non è un quinto
// esito, è l'assenza di una decisione da giudicare.
export type DecisionCellCategory =
  | "BOX_GAINED"
  | "BOX_LOST"
  | "BOX_NEUTRAL"
  | "STAY_GAINED"
  | "STAY_LOST"
  | "STAY_NEUTRAL"
  | "FORCED"
  | "NOT_NEEDED";

export const DECISION_CELL_COLORS: Record<DecisionCellCategory, string> = {
  BOX_GAINED: VERDICT_COLORS.GAINED,
  BOX_LOST: VERDICT_COLORS.LOST,
  BOX_NEUTRAL: "#94a3b8", // stesso slate "condizione normale/nessun movimento" di PIT_CONTEXT_COLORS.GREEN
  STAY_GAINED: "#7fd4bb", // stessa tinta di BOX_GAINED, più chiara: guadagno anche restando fuori (raro)
  STAY_LOST: "#f0a875", // stessa tinta di BOX_LOST, più chiara
  STAY_NEUTRAL: "#94a3b8",
  FORCED: OUTCOME_COLORS.LOCKED_OUT,
  NOT_NEEDED: OUTCOME_COLORS.NOT_NEEDED,
};

export const DECISION_CELL_LABELS: Record<DecisionCellCategory, string> = {
  BOX_GAINED: "Si è fermato, ha guadagnato",
  BOX_LOST: "Si è fermato, ha perso",
  BOX_NEUTRAL: "Si è fermato, nessun cambio",
  STAY_GAINED: "È rimasto fuori, ha guadagnato",
  STAY_LOST: "È rimasto fuori, ha perso",
  STAY_NEUTRAL: "È rimasto fuori, nessun cambio",
  FORCED: "Scelta forzata (escluso dalla finestra)",
  NOT_NEEDED: "Non ne aveva bisogno",
};

export function decisionCellColor(category: string): string {
  return DECISION_CELL_COLORS[category as DecisionCellCategory] ?? DECISION_CELL_COLORS.STAY_NEUTRAL;
}

export const DECISION_CELL_LEGEND: { key: DecisionCellCategory; label: string; color: string }[] = (
  Object.keys(DECISION_CELL_COLORS) as DecisionCellCategory[]
).map((key) => ({ key, label: DECISION_CELL_LABELS[key], color: DECISION_CELL_COLORS[key] }));

// Colori team: usati SOLO dalla vista 5 (docs/PROGETTAZIONE.md, sezione 7,
// "l'unica eccezione è la vista 5, che ha un interruttore per passare ai
// colori team"). Da nessun'altra parte: altrove il colore codifica sempre
// l'etichetta del pit o l'esito, mai il team. Refs come in public/data/races
// (campo "team" di ogni pilota).
export const TEAM_COLORS: Record<string, string> = {
  ferrari: "#DC0000",
  red_bull: "#3671C6",
  mercedes: "#27F4D2",
  mclaren: "#FF8000",
  alpine: "#2293D1",
  aston_martin: "#229971",
  williams: "#64C4FF",
  alphatauri: "#5E8FAA",
  rb: "#6692FF",
  alfa: "#C92D4E",
  sauber: "#52E252",
  haas: "#B6BABD",
};

export const TEAM_LABELS: Record<string, string> = {
  ferrari: "Ferrari",
  red_bull: "Red Bull",
  mercedes: "Mercedes",
  mclaren: "McLaren",
  alpine: "Alpine",
  aston_martin: "Aston Martin",
  williams: "Williams",
  alphatauri: "AlphaTauri",
  rb: "RB",
  alfa: "Alfa Romeo",
  sauber: "Sauber",
  haas: "Haas",
};

export function teamColor(team: string | null | undefined): string {
  if (!team) return DEFAULT_LINE_COLOR;
  return TEAM_COLORS[team] ?? DEFAULT_LINE_COLOR;
}

export function teamLabel(team: string | null | undefined): string {
  if (!team) return "—";
  return TEAM_LABELS[team] ?? team;
}

// Palette per FAMIGLIA del catalogo eventi (v3, docs/PROGETTAZIONE.md,
// sezione 7, "regola vincolante sul colore": il colore codifica SEMPRE la
// famiglia — variabile nominale — mai la rarità, che è quantitativa e va
// sulla posizione. Convenzione fissata qui perché la home (vista 1) è la
// prima vista v3 e tutte le viste successive (compositore, striscia
// storica, mappa) devono riusare questa stessa palette per famiglia.
//
// Base: la palette qualitativa di Paul Tol "muted" (9 tinte, pensata per
// restare distinguibile fino a ~9-12 classi categoriali sotto protanopia/
// deuteranopia/tritanopia — a differenza di Okabe-Ito, che ne offre solo
// 8 in tutto). Una tinta (il "sand" #DDCC77) è stata scartata perché troppo
// vicina al giallo già assegnato a "neutralizzazioni" qui sotto.
//
// "neutralizzazioni" non prende una tinta Tol: riusa
// NEUTRALIZATION_ACCENT_COLOR, lo stesso giallo-bandiera già usato in tutto
// il sito (v2) per quella famiglia — stesso significato, stesso colore,
// invece di una nona tinta arbitraria che avrebbe introdotto un'ambiguità
// con un accento già noto.
export type EventFamily =
  | "griglia_e_risultato"
  | "margine"
  | "gare_anomale"
  | "team"
  | "carriera"
  | "ritiri"
  | "comando_in_pista"
  | "strategia"
  | "neutralizzazioni";

export const FAMILY_COLORS: Record<EventFamily, string> = {
  griglia_e_risultato: "#332288", // indigo
  margine: "#117733", // verde
  gare_anomale: "#88CCEE", // ciano
  team: "#882255", // vinaccia
  carriera: "#44AA99", // verde acqua
  ritiri: "#999933", // oliva
  comando_in_pista: "#AA4499", // porpora
  strategia: "#CC6677", // rosa antico
  neutralizzazioni: NEUTRALIZATION_ACCENT_COLOR, // giallo, riuso dell'accento v2
};

export const FAMILY_LABELS: Record<EventFamily, string> = {
  griglia_e_risultato: "Griglia e risultato",
  margine: "Margine",
  gare_anomale: "Gare anomale",
  team: "Team",
  carriera: "Carriera",
  ritiri: "Ritiri",
  comando_in_pista: "Comando in pista",
  strategia: "Strategia",
  neutralizzazioni: "Neutralizzazioni",
};

export function familyColor(famiglia: string): string {
  return FAMILY_COLORS[famiglia as EventFamily] ?? DEFAULT_LINE_COLOR;
}

export function familyLabel(famiglia: string): string {
  return FAMILY_LABELS[famiglia as EventFamily] ?? famiglia;
}

export const FAMILY_LEGEND: { key: EventFamily; label: string; color: string }[] = (
  Object.keys(FAMILY_COLORS) as EventFamily[]
).map((key) => ({ key, label: FAMILY_LABELS[key], color: FAMILY_COLORS[key] }));
