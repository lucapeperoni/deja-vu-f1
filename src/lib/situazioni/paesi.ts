// I paesi di circuits.csv (Ergast) sono in inglese: qui il nome italiano
// per la frase in chiaro e per lo slot "dove" (nota di D2.2 in ROADMAP-7).
// Chiave = valore esatto di `gare.paese`.
export const PAESI_IT: Record<string, string> = {
  Australia: "Australia", Malaysia: "Malesia", Bahrain: "Bahrain", Spain: "Spagna", Turkey: "Turchia",
  Monaco: "Monaco", Canada: "Canada", France: "Francia", UK: "Gran Bretagna", Germany: "Germania",
  Hungary: "Ungheria", Belgium: "Belgio", Italy: "Italia", Singapore: "Singapore", Japan: "Giappone",
  China: "Cina", Brazil: "Brasile", USA: "Stati Uniti", "United States": "Stati Uniti", UAE: "Emirati Arabi",
  Argentina: "Argentina", Portugal: "Portogallo", "South Africa": "Sudafrica", Mexico: "Messico",
  Korea: "Corea del Sud", Netherlands: "Olanda", Sweden: "Svezia", Austria: "Austria", Morocco: "Marocco",
  Switzerland: "Svizzera", India: "India", Russia: "Russia", Azerbaijan: "Azerbaijan", "Saudi Arabia": "Arabia Saudita",
  Qatar: "Qatar", Vietnam: "Vietnam",
};

export function paeseIt(paese: string): string {
  return PAESI_IT[paese] ?? paese;
}
