// Genera public/data/world-land.json: i contorni delle terre emerse in
// GeoJSON, per il fondo della mappa dei circuiti (DoveMappa).
//
// La fonte è `world-atlas` (Natural Earth 1:110m, ~3 000 punti): sta nelle
// devDependencies e non finisce nel bundle — il sito legge solo il JSON
// prodotto qui. Le coordinate si tagliano a due decimali (~1 km, molto più
// fine del pixel a questa scala) perché il file dimezza di peso.
//
//   npx tsx scripts/build-world.ts

import fs from "node:fs";
import path from "node:path";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";

const DECIMALI = 2;

function arrotonda(x: unknown): unknown {
  if (typeof x === "number") return Math.round(x * 10 ** DECIMALI) / 10 ** DECIMALI;
  if (Array.isArray(x)) return x.map(arrotonda);
  return x;
}

const topo = JSON.parse(fs.readFileSync(require.resolve("world-atlas/land-110m.json"), "utf8")) as Topology;
// `feature` restituisce una FeatureCollection con dentro una sola Feature
// (tutte le terre in un MultiPolygon): si tiene quella, il sito non ha
// bisogno di distinguere i singoli paesi.
const collezione = topojson.feature(topo, topo.objects.land as never) as unknown as {
  features: { geometry: { type: string; coordinates: unknown } }[];
};
const g = collezione.features[0].geometry;
const geo = { type: "Feature", properties: {}, geometry: { type: g.type, coordinates: arrotonda(g.coordinates) } };

const fuori = path.join(process.cwd(), "public", "data", "world-land.json");
fs.writeFileSync(fuori, JSON.stringify(geo));
console.log(`scritto ${fuori} — ${(fs.statSync(fuori).size / 1024).toFixed(0)} kB`);
