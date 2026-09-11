// Lettura dei JSON delle situazioni dal disco (solo server: usa `fs`).
// Il gemello puro è tabelle.ts; le pagine server leggono qui e passano i
// JSON grezzi come props al client, che decodifica una volta sola.

import fs from "fs";
import path from "path";
import type { DizionariJson, GareJson, RisultatiJson } from "./tabelle";

const DIR = path.join(process.cwd(), "public", "data", "situazioni");

export function leggiRisultatiJson(): RisultatiJson {
  return JSON.parse(fs.readFileSync(path.join(DIR, "risultati.json"), "utf8"));
}

export function leggiGareJson(): GareJson {
  return JSON.parse(fs.readFileSync(path.join(DIR, "gare.json"), "utf8"));
}

export function leggiDizionariJson(): DizionariJson {
  return JSON.parse(fs.readFileSync(path.join(DIR, "dizionari.json"), "utf8"));
}
