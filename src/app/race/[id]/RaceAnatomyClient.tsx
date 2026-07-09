'use client';

import RaceAnatomyTimeline, { type RaceData } from './RaceAnatomyTimeline';
import OpportunityWindow from './OpportunityWindow';
import PitCostDumbbell from './PitCostDumbbell';
import EventSlopeChart from './EventSlopeChart';
import TeammateMirror from './TeammateMirror';
import { PIT_CONTEXT_LEGEND } from '@/lib/colors';
import { RaceInteractionProvider, useRaceInteraction } from './RaceInteractionContext';

// Le 5 viste della pagina gara condividono un unico stato di interazione
// (docs/PROGETTAZIONE.md, sezione 7 "interazione comune" e sezione 8,
// categorie di Yi et al.): pilota evidenziato (hover, select), pilota
// bloccato (click), intervallo di giri dal brush della race trace
// (filter), evento di neutralizzazione selezionato (explore/connect —
// sincronizza lo slope chart e la matrice). Centralizzato in
// RaceInteractionContext invece che in useState qui, così ogni vista lo
// legge/scrive direttamente senza dover far passare 6 prop per ognuna.
export default function RaceAnatomyClient({ raceData }: { raceData: RaceData }) {
  const defaultEventId = raceData.neutralizations[0]?.eventId ?? null;

  return (
    <RaceInteractionProvider defaultEventId={defaultEventId}>
      <RaceAnatomyContent raceData={raceData} />
    </RaceInteractionProvider>
  );
}

function RaceAnatomyContent({ raceData }: { raceData: RaceData }) {
  const { highlightedDriverId, brushRange } = useRaceInteraction();

  return (
    <div className="flex flex-col gap-12">
      <section>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h2 className="font-condensed text-2xl font-bold uppercase text-white">Race Anatomy Timeline</h2>
            <p className="text-sm text-text-secondary">
              Passa il mouse su una linea o su un nome pilota per evidenziarlo in tutte le viste della pagina,
              clicca per bloccare l&apos;evidenziazione. Trascina sull&apos;asse dei giri per selezionare un
              intervallo.
            </p>
          </div>
          <div className="flex gap-4 flex-wrap">
            {PIT_CONTEXT_LEGEND.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-gray">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        <RaceAnatomyTimeline raceData={raceData} />

        {/* Altezza sempre riservata (mai montati/smontati): un paragrafo che
            appare e scompare a ogni hover sposta il layout sotto di sé,
            spostando anche il grafico su cui si trova il cursore — genera
            un ciclo di hover-on/hover-off che sullo schermo si vede come
            un tremolio. Il contenuto cambia, l'altezza no. */}
        <p className="mt-3 text-xs text-neutral-gray h-4">
          {brushRange ? `Intervallo selezionato: giro ${brushRange.startLap} – giro ${brushRange.endLap}` : " "}
        </p>
        <p className="mt-1 text-xs text-neutral-gray h-4">
          {highlightedDriverId ? `Pilota evidenziato: ${highlightedDriverId}` : " "}
        </p>
      </section>

      <section>
        <div className="mb-6">
          <h2 className="font-condensed text-2xl font-bold uppercase text-white">Gli sconti</h2>
          <p className="text-sm text-text-secondary">
            Uno sconto per pit stop: a destra chi ha guadagnato secondi, a sinistra chi ne ha persi rispetto al
            prezzo di listino. Trascina sulla race trace qui sopra per filtrare per intervallo di giri.
          </p>
        </div>
        <PitCostDumbbell raceData={raceData} />
      </section>

      <section>
        <div className="mb-6">
          <h2 className="font-condensed text-2xl font-bold uppercase text-white">La classifica deformata</h2>
          <p className="text-sm text-text-secondary">
            Posizioni al momento della neutralizzazione a sinistra, posizioni 3 giri dopo la fine del ciclo di
            soste a destra. Le linee che si incrociano sono i posti guadagnati o persi per effetto dell&apos;evento.
            Scegliere l&apos;evento qui o cliccare una colonna nella matrice qui sotto fa la stessa cosa.
          </p>
        </div>
        <EventSlopeChart raceData={raceData} />
      </section>

      <section>
        <div className="mb-6">
          <h2 className="font-condensed text-2xl font-bold uppercase text-white">La matrice della lotteria</h2>
          <p className="text-sm text-text-secondary">
            Per ogni neutralizzazione, chi ha sfruttato la finestra, chi ne è rimasto escluso, chi l&apos;ha pagata
            piena. Passa il mouse su una riga o su una cella per i dettagli, clicca l&apos;intestazione di una
            colonna per sincronizzarla con la classifica deformata qui sopra.
          </p>
        </div>
        <OpportunityWindow raceData={raceData} />
      </section>

      <section>
        <div className="mb-6">
          <h2 className="font-condensed text-2xl font-bold uppercase text-white">Stesso box, fortuna diversa</h2>
          <p className="text-sm text-text-secondary">
            Due compagni di squadra davanti alla stessa neutralizzazione: chi si è fermato gratis, chi ha pagato
            prezzo pieno o è rimasto escluso. Unica vista del sito dove è ammesso il colore team.
          </p>
        </div>
        <TeammateMirror raceData={raceData} />
      </section>
    </div>
  );
}
