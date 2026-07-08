import fs from 'fs';
import path from 'path';

// Define the types that match the JSON output
export interface Rivalry {
    id: string;
    year: number;
    constructorId: number;
    driverAId: number;
    driverBId: number;
    sharedRaces: number;
    stats: {
        raceWinsA: number; raceWinsB: number;
        qualyWinsA: number; qualyWinsB: number; validQualy: number;
        totalPointsA: number; totalPointsB: number;
        teamPointsShareA: number;
        medianPosDelta: number; medianGridDelta: number;
    };
    metrics: {
        TDI: number;
        rivalryBalanceScore: number;
        teamDependency: number;
    };
}

export interface RaceComparison {
    raceId: number; year: number; round: number;
    constructorId: number; driverA: number; driverB: number;
    posA: number; posB: number;
    pointsA: number; pointsB: number;
    gridA: number | null; gridB: number | null;
    statusA: number; statusB: number;
    raceWinner: number | null; qualyWinner: number | null;
    gridDelta: number | null; posDelta: number | null;
}

export interface DriverIndex { id: number; ref: string; name: string; code: string; }
export interface ConstructorIndex { id: number; ref: string; name: string; }

// Use Next.js process.cwd() for the root of the project
const DATA_DIR = path.join(process.cwd(), 'public/data');

function readJsonFile<T>(filename: string): T[] {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.error(`Data file not found: ${filePath}`);
        return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T[];
}

// Caching in memory for the server
let rivalriesCache: Rivalry[] | null = null;
let driversCache: DriverIndex[] | null = null;
let constructorsCache: ConstructorIndex[] | null = null;
let raceComparisonsCache: RaceComparison[] | null = null;

export async function getRivalries(): Promise<Rivalry[]> {
    if (!rivalriesCache) {
        rivalriesCache = readJsonFile<Rivalry>('season-rivalries.json');
    }
    return rivalriesCache;
}

export async function getDriversMap(): Promise<Map<number, DriverIndex>> {
    if (!driversCache) {
        driversCache = readJsonFile<DriverIndex>('drivers-index.json');
    }
    return new Map(driversCache.map(d => [d.id, d]));
}

export async function getConstructorsMap(): Promise<Map<number, ConstructorIndex>> {
    if (!constructorsCache) {
        constructorsCache = readJsonFile<ConstructorIndex>('constructors-index.json');
    }
    return new Map(constructorsCache.map(c => [c.id, c]));
}

// Derived queries
export async function getHighlightRivalries() {
    const rivalries = await getRivalries();
    // Only consider meaningful rivalries
    const valid = rivalries.filter(r => r.sharedRaces >= 10);
    
    if (valid.length === 0) return null;

    // Most balanced (lowest TDI absolute)
    const balanced = [...valid].sort((a, b) => Math.abs(a.metrics.TDI) - Math.abs(b.metrics.TDI))[0];
    
    // Most dominant (highest TDI absolute)
    const dominant = [...valid].sort((a, b) => Math.abs(b.metrics.TDI) - Math.abs(a.metrics.TDI))[0];
    
    // Most dependent team
    const dependent = [...valid].sort((a, b) => b.metrics.teamDependency - a.metrics.teamDependency)[0];

    return { balanced, dominant, dependent };
}

export async function getRivalryRaceComparisons(driverAId: number, driverBId: number, year: number, constructorId: number): Promise<RaceComparison[]> {
    if (!raceComparisonsCache) {
        raceComparisonsCache = readJsonFile<RaceComparison>('race-comparisons.json');
    }
    return raceComparisonsCache.filter(rc => 
        rc.year === year && 
        rc.constructorId === constructorId && 
        rc.driverA === driverAId && 
        rc.driverB === driverBId
    ).sort((a, b) => a.round - b.round);
}
