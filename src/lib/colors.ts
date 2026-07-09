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
  JUST_AFTER: "#cc79a7", // porpora: fermato appena dopo la fine della finestra
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
  NEUTRAL: "#334155", // grigio scuro: nessuna delle precedenti, quasi "assente"
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
