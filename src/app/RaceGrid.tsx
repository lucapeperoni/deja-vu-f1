import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import clsx from "clsx";

export interface RaceGridEntry {
  id: string;
  year: number;
  round: number;
  name: string;
  circuit: string;
  totalNeutralizations: number;
}

interface Props {
  races: RaceGridEntry[];
  caseRaceIds: string[];
}

// Griglia gare della home (docs/PROGETTAZIONE.md, sezione 6): niente D3 qui,
// sono card di navigazione verso la pagina gara — il terzo atto del
// racconto ("doveva fermarsi?") si vede lì, nella matrice scelta × esito.
// Le 3 gare-caso (sezione 9) sono segnalate perché sono quelle raccontate
// a fondo nella relazione.
export default function RaceGrid({ races, caseRaceIds }: Props) {
  const caseSet = new Set(caseRaceIds);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {races.map((race) => {
        const isCase = caseSet.has(race.id);
        return (
          <Link
            key={race.id}
            href={`/race/${race.id}`}
            className={clsx(
              "group block bg-panel border transition-all duration-300 relative overflow-hidden",
              isCase
                ? "border-yellow-500/40 hover:border-yellow-500 hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]"
                : "border-graphite hover:border-racing-red hover:shadow-[0_0_30px_rgba(220,0,0,0.15)]"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="p-6 relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div
                  className={clsx(
                    "text-xs font-bold tracking-widest uppercase px-2 py-1 rounded-sm flex items-center gap-1",
                    isCase ? "text-yellow-500 bg-yellow-500/10" : "text-racing-red bg-racing-red/10"
                  )}
                >
                  {isCase && <Star className="w-3 h-3" />}
                  {race.year} · R{race.round}
                </div>
                <ArrowRight className="w-5 h-5 text-neutral-gray group-hover:text-white group-hover:-rotate-45 transition-all duration-300" />
              </div>

              <h4 className="font-condensed text-2xl text-white font-bold uppercase tracking-tight mb-1 group-hover:translate-x-1 transition-transform">
                {race.name}
              </h4>
              <div className="text-text-secondary text-sm mb-6 uppercase tracking-wider truncate">{race.circuit}</div>

              <div className="flex gap-4 border-t border-graphite/50 pt-4">
                <div>
                  <div className="text-[11px] text-neutral-gray uppercase tracking-widest">Neutralizzazioni</div>
                  <div className="text-white font-condensed font-bold">{race.totalNeutralizations}</div>
                </div>
                {isCase && (
                  <div>
                    <div className="text-[11px] text-yellow-500 uppercase tracking-widest">Gara studio</div>
                    <div className="text-yellow-500 font-condensed font-bold">Raccontata in relazione</div>
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
      {races.length === 0 && (
        <div className="col-span-full text-center py-12 text-neutral-gray border border-graphite border-dashed">
          Nessun dato gara trovato in public/data/index.json
        </div>
      )}
    </div>
  );
}
