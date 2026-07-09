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
