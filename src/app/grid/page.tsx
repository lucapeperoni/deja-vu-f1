import { getRivalries, getDriversMap, getConstructorsMap } from '@/lib/data';
import RivalryGridInteractive from './RivalryGridInteractive';

export default async function GridPage() {
  const rivalries = await getRivalries();
  const driversMap = await getDriversMap();
  const constructorsMap = await getConstructorsMap();

  // Convert Maps to plain objects for passing to client component
  const drivers = Object.fromEntries(driversMap.entries());
  const constructors = Object.fromEntries(constructorsMap.entries());

  return (
    <main className="flex-1 flex flex-col p-6 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
        <header className="mb-8">
          <h1 className="font-condensed text-4xl font-bold uppercase tracking-wide">Rivalry Grid</h1>
          <p className="text-text-secondary mt-2">
            Panoramica storica delle rivalità interne. Colore scuro/rosso indica dominanza, grigio indica equilibrio.
          </p>
        </header>

        <RivalryGridInteractive 
          initialRivalries={rivalries} 
          drivers={drivers} 
          constructors={constructors} 
        />
      </div>
    </main>
  );
}
