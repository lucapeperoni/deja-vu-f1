// Dai fatti notevoli della scheda gara (v3: eventId + parametri del
// catalogo, public/data/facts/<slug>.json) alla situazione v4 (Déjà vu,
// roadmap D6.1, PROGETTAZIONE-v4 §7.6): ogni fatto della scheda diventa
// una frase già compilata, con lo slot "dove" = il circuito di quella gara,
// così il click risponde a "questo fatto, qui: è già successo?".
//
// La mappa è scritta a mano ed è parziale: i fatti v3 che non hanno un
// equivalente atomico (pit stop sotto neutralizzazione, doppio ritiro dello
// stesso team, "nessuno dei primi 3 in griglia sul podio") restituiscono
// null e la scheda non mostra il link — meglio nessun link che uno
// sbagliato.

import type { Situazione } from "./motore";

type Parametri = Record<string, number | string>;

function n(par: Parametri, k = "N"): number | undefined {
  const v = par[k];
  return typeof v === "number" ? v : v !== undefined ? Number(v) : undefined;
}

export function situazioneDaEventoV3(eventId: string, parametri: Parametri, circuitRef: string): Situazione | null {
  const dove = { tipo: "circuito", circuitRef } as const;
  const N = n(parametri);
  const s = (cosa: Situazione["cosa"]): Situazione => ({ cosa, dove });
  switch (eventId) {
    case "vittoria_da_griglia":
      return s([{ id: "vince" }, { id: "parte_o_peggio", parametro: N ?? 10 }]);
    case "podio_da_griglia":
      return s([{ id: "podio" }, { id: "parte_o_peggio", parametro: N ?? 10 }]);
    case "pole_finita_con_ritiro":
      return s([{ id: "pole" }, { id: "ritiro" }]);
    case "margine_vittoria":
      return s([{ id: "margine_sotto", parametro: N ?? 1 }]);
    case "vittoria_oltre_n_minuti":
      return s([{ id: "margine_sopra", parametro: (N ?? 1) * 60 }]);
    case "meno_di_n_classificati":
      return s([{ id: "meno_di_n_classificati", parametro: N ?? 10 }]);
    case "nessun_ritiro":
      return s([{ id: "nessun_ritiro" }]);
    case "doppietta":
      return s([{ id: "doppietta" }]);
    case "tripletta":
      return s([{ id: "tripletta" }]);
    case "prima_vittoria_in_carriera":
      return s([{ id: "prima_vittoria" }]);
    case "primo_podio_in_carriera":
      return s([{ id: "primo_podio" }]);
    case "prima_pole_in_carriera":
      return s([{ id: "prima_pole" }]);
    case "vittoria_al_debutto":
      return s([{ id: "vince" }, { id: "debutto" }]);
    case "podio_al_debutto":
      return s([{ id: "podio" }, { id: "debutto" }]);
    case "prima_vittoria_pilota_su_circuito":
      return s([{ id: "prima_vittoria_su_circuito" }]);
    case "nessun_cambio_di_leader":
      return s([{ id: "nessun_cambio_leader" }]);
    case "almeno_n_piloti_al_comando":
      return s([{ id: "almeno_n_leader", parametro: N ?? 4 }]);
    case "vittoria_ultimo_giro":
      return s([{ id: "cambio_leader_ultimo_giro" }]);
    case "rimonta_almeno_n_posizioni":
      return s([{ id: "guadagna_posizioni", parametro: N ?? 5 }]);
    case "vincitore_con_almeno_n_soste":
      return s([{ id: "vince" }, { id: "soste_almeno", parametro: N ?? 3 }]);
    case "pilota_con_almeno_n_soste":
      return s([{ id: "soste_almeno", parametro: N ?? 3 }]);
    case "gara_con_almeno_n_neutralizzazioni":
      return s([{ id: "almeno_n_neutralizzazioni", parametro: N ?? 1 }]);
    default:
      return null;
  }
}
