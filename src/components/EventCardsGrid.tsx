"use client";

// Vista 1, seconda forma (roadmap R2.1, docs/ROADMAP-4.md): lo stesso
// catalogo di RarityScale, raggruppato per famiglia invece che su un unico
// asse di rarità. Nessun D3: ogni sezione è un'intestazione + una griglia
// CSS di EventCard (React puro).
//
// Riceve il catalogo COMPLETO (non deduplicato): dedupeToDefaultParams
// sceglie qui dentro un eventId per card, ma ogni EventCard riceve poi
// TUTTE le sue varianti di parametro (filtrate dallo stesso array), per
// poter cambiare risposta internamente senza una seconda richiesta.
//
// Filtro per famiglia (roadmap R4.2, facoltativo): stato locale, nessuna
// famiglia nascosta di default. A differenza della legenda di RarityScale
// (che solo evidenzia in hover, senza nascondere nulla), qui il click
// isola la famiglia scelta e nasconde le altre — un secondo click sulla
// stessa famiglia torna a mostrarle tutte.

import { useState } from "react";
import EventCard from "./EventCard";
import { dedupeToDefaultParams, type CatalogEventEntry } from "@/lib/eventCatalog";
import { FAMILY_LEGEND } from "@/lib/colors";

interface Props {
  catalog: CatalogEventEntry[];
}

export default function EventCardsGrid({ catalog }: Props) {
  const defaultEvents = dedupeToDefaultParams(catalog);
  const [isolatedFamily, setIsolatedFamily] = useState<string | null>(null);

  function toggleFamily(key: string) {
    setIsolatedFamily((prev) => (prev === key ? null : key));
  }

  const visibleFamilies = FAMILY_LEGEND.filter(
    (family) => isolatedFamily === null || family.key === isolatedFamily
  );

  return (
    <div>
      <div className="flex items-center gap-4 flex-wrap mb-8">
        {FAMILY_LEGEND.map((family) => {
          const isActive = isolatedFamily === null || isolatedFamily === family.key;
          return (
            <button
              key={family.key}
              type="button"
              onClick={() => toggleFamily(family.key)}
              aria-pressed={isolatedFamily === family.key}
              className={`flex items-center gap-2 text-xs uppercase tracking-widest transition-colors ${
                isActive ? "text-white" : "text-neutral-gray/40 hover:text-neutral-gray"
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/40"
                style={{ backgroundColor: family.color, opacity: isActive ? 1 : 0.4 }}
              />
              {family.label}
            </button>
          );
        })}
        {isolatedFamily !== null && (
          <button
            type="button"
            onClick={() => setIsolatedFamily(null)}
            className="text-xs uppercase tracking-widest text-racing-red hover:underline"
          >
            Mostra tutte
          </button>
        )}
      </div>

      <div className="flex flex-col gap-10">
        {visibleFamilies.map((family) => {
          // Stesso ordinamento di RarityScale.sorted: rarità decrescente, dal
          // più comune (in alto) al più raro (in fondo alla sezione).
          const familyEvents = defaultEvents
            .filter((e) => e.famiglia === family.key)
            .sort((a, b) => b.rarita - a.rarita);

          if (familyEvents.length === 0) return null;

          return (
            <section key={family.key}>
              <header className="flex items-center gap-3 mb-4 pb-2 border-b border-graphite">
                {/* Anello chiaro sempre presente (roadmap R4.1, passata di
                    contrasto): due colori di famiglia su nove (indigo di
                    griglia_e_risultato, vinaccia di team) scendono sotto 2:1
                    di contrasto contro lo sfondo quasi nero — ben sotto il
                    3:1 richiesto per un elemento grafico (WCAG 1.4.11). Un
                    bordo chiaro attorno al pallino lo rende sempre
                    distinguibile, senza cambiare la tinta di famiglia
                    condivisa con RarityScale. */}
                <span
                  className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/40"
                  style={{ backgroundColor: family.color }}
                />
                <h3 className="font-condensed text-2xl font-bold uppercase text-white">{family.label}</h3>
                <span className="text-xs text-neutral-gray">({familyEvents.length})</span>
              </header>
              {/* 2xl:grid-cols-5 in più (sezione ora larga fino a
                  max-w-[1600px] in page.tsx): senza questa colonna in più
                  restava ferma a 4 su schermi larghi, con dello spazio
                  vuoto a destra invece di un'altra card. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {familyEvents.map((event) => (
                  <EventCard key={event.eventId} variants={catalog.filter((v) => v.eventId === event.eventId)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
