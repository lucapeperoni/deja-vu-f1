// Le ere regolamentari offerte nello slot "quando" e riconosciute dal
// parser, con anni dichiarati. Stanno in lib (non nel componente) perché
// le legge anche il parser, che gira pure fuori dal browser (verify).
export const ERE: { etichetta: string; annoDa: number; annoA: number }[] = [
  { etichetta: "Era ibrida", annoDa: 2014, annoA: 2024 },
  { etichetta: "Era V8", annoDa: 2006, annoA: 2013 },
  { etichetta: "Era V10", annoDa: 1989, annoA: 2005 },
  { etichetta: "Era turbo", annoDa: 1977, annoA: 1988 },
  { etichetta: "Era aspirata 3 litri", annoDa: 1966, annoA: 1976 },
  { etichetta: "Primi anni", annoDa: 1950, annoA: 1965 },
];
