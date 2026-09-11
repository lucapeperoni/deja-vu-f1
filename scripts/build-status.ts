// Genera public/data/situazioni/status.json: statusId → com'è finita la gara
// per quel pilota, in italiano.
//
// La colonna `statoCat` delle situazioni distingue solo quattro categorie
// (classificato, non partito, guasto, incidente): basta per contare i fatti,
// non per raccontare una gara — "si è ritirato" e "si è ritirato per il
// cambio al giro 12" non sono la stessa frase. Ergast la causa precisa ce
// l'ha (`data/raw/status.csv`, 137 valori usati nei dati); qui si traduce e
// si spedisce, che è l'unico modo per averla nel browser.
//
// Le stringhe non tradotte restano in inglese: meglio "Halfshaft" che una
// traduzione inventata, e la lista si allunga quando serve.
//
//   npm run build:status

import fs from "node:fs";
import path from "node:path";

const IT: Record<string, string> = {
  Finished: "al traguardo",
  Disqualified: "squalificato",
  Accident: "incidente",
  Collision: "contatto",
  "Collision damage": "danni da contatto",
  "Spun off": "testacoda",
  Engine: "motore",
  Gearbox: "cambio",
  Transmission: "trasmissione",
  Clutch: "frizione",
  Hydraulics: "impianto idraulico",
  Electrical: "impianto elettrico",
  Brakes: "freni",
  Suspension: "sospensioni",
  "Fuel system": "impianto carburante",
  "Fuel pump": "pompa della benzina",
  "Fuel leak": "perdita di carburante",
  "Out of fuel": "benzina finita",
  "Oil leak": "perdita d'olio",
  "Oil pressure": "pressione dell'olio",
  Overheating: "surriscaldamento",
  Radiator: "radiatore",
  Ignition: "accensione",
  Throttle: "acceleratore",
  Steering: "sterzo",
  Differential: "differenziale",
  Halfshaft: "semiasse",
  Driveshaft: "albero di trasmissione",
  Wheel: "ruota",
  Tyre: "gomme",
  "Puncture": "foratura",
  Turbo: "turbo",
  "Power Unit": "power unit",
  Handling: "assetto",
  Withdrew: "ritirato dalla gara",
  Retired: "ritirato",
  "Not classified": "non classificato",
  "Did not qualify": "non qualificato",
  "Did not prequalify": "non prequalificato",
  Injury: "infortunio",
  Illness: "malattia",
  Fatal: "incidente mortale",
  "Injured": "infortunato",
  Battery: "batteria",
  Alternator: "alternatore",
  Exhaust: "scarico",
  "Water leak": "perdita d'acqua",
  "Water pump": "pompa dell'acqua",
  Vibrations: "vibrazioni",
  Physical: "condizione fisica",
  Fire: "incendio",
  Damage: "danni",
  Distributor: "spinterogeno",
  Magneto: "magnete",
  Supercharger: "compressore",
  Spark: "candele",
  "Rear wing": "ala posteriore",
  "Front wing": "ala anteriore",
  Chassis: "telaio",
  Driver: "problema del pilota",
  "Driver Seat": "sedile",
  Safety: "ragioni di sicurezza",
  "Safety concerns": "ragioni di sicurezza",
  "Engine misfire": "motore irregolare",
  "Engine fire": "motore in fiamme",
  "Mechanical": "guasto meccanico",
  "Technical": "problema tecnico",
  "Debris": "detriti",
  "Excluded": "escluso",
  "Eligibility": "non ammesso",
  "Launch control": "launch control",
  "Track rod": "tirante dello sterzo",
  "Pneumatics": "impianto pneumatico",
  "ERS": "ERS",
  "Seat": "sedile",
  "Oil pump": "pompa dell'olio",
  "Cooling system": "impianto di raffreddamento",
  "Heat shield fire": "scudo termico in fiamme",
  "Broken wing": "ala rotta",
  "Undertray": "fondo",
  "Brake duct": "condotto dei freni",
  "Crankshaft": "albero motore",
  "Piston": "pistone",
  "Valve": "valvola",
  "Camshaft": "albero a camme",
  "Stalled": "spento in griglia",
  "Did not start": "non partito",
  "Refuelling": "rifornimento",
  "Power loss": "perdita di potenza",
  "Rear suspension": "sospensione posteriore",
  "Front suspension": "sospensione anteriore",
  "Wheel nut": "dado della ruota",
  "Wheel rim": "cerchio",
  "Drivetrain": "trasmissione",
  "Electronics": "elettronica",
  "Spark plugs": "candele",
  "Fuel pressure": "pressione del carburante",
  "Wheel bearing": "cuscinetto della ruota",
  Injection: "iniezione",
  Axle: "semiasse",
  "Oil pipe": "tubo dell'olio",
  "Driver unwell": "pilota non in condizione",
  "Water pressure": "pressione dell'acqua",
  Fuel: "carburante",
  "Fatal accident": "incidente mortale",
  "Fuel pipe": "tubo del carburante",
  "Water pipe": "tubo dell'acqua",
  "Oil line": "circuito dell'olio",
  "Fuel rig": "colonnina del rifornimento",
  "Tyre puncture": "foratura",
  "Not restarted": "non ripartito",
  "Engine blew": "motore esploso",
};

function traduci(s: string): string {
  const giri = s.match(/^\+(\d+) Laps?$/);
  if (giri) return `+${giri[1]} ${giri[1] === "1" ? "giro" : "giri"}`;
  return IT[s] ?? s;
}

const righe = fs.readFileSync(path.join(process.cwd(), "data", "raw", "status.csv"), "utf8").trim().split("\n").slice(1);
const out: Record<number, string> = {};
for (const riga of righe) {
  const m = riga.match(/^(\d+),"?(.*?)"?$/);
  if (m) out[Number(m[1])] = traduci(m[2]);
}

const fuori = path.join(process.cwd(), "public", "data", "situazioni", "status.json");
fs.writeFileSync(fuori, JSON.stringify(out));
const tradotti = Object.values(out).filter((v) => /[àèéìòù]|^[a-z+]/.test(v)).length;
console.log(`scritto ${fuori} — ${Object.keys(out).length} stati, ${tradotti} in italiano`);
