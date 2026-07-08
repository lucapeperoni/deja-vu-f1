import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data/raw');
const OUT_DIR = path.join(__dirname, '../public/data');

// Types based on the CSV schema
interface Race { raceId: number; year: number; round: number; circuitId: number; name: string; date: string; }
interface Driver { driverId: number; driverRef: string; forename: string; surname: string; code: string; }
interface Constructor { constructorId: number; constructorRef: string; name: string; }
interface Status { statusId: number; status: string; }
interface Result {
    resultId: number; raceId: number; driverId: number; constructorId: number;
    number: number | null; grid: number | null; position: number | null;
    positionOrder: number; points: number; laps: number; statusId: number;
    milliseconds: number | null; fastestLapRank: number | null;
}
interface Qualifying {
    qualifyId: number; raceId: number; driverId: number; constructorId: number;
    number: number; position: number; q1: string; q2: string; q3: string;
}

// Helper to parse CSV
function parseCSV<T>(filename: string, transform?: (val: string, field: string | number) => any): T[] {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return [];
    }
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const result = Papa.parse<any>(fileContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transform: (value, field) => {
            if (value === '\\N' || value === '') return null;
            if (transform) return transform(value, field);
            return value;
        }
    });
    return result.data as T[];
}

async function main() {
    console.log('Starting preprocessing...');

    // Load datasets
    console.log('Loading datasets...');
    const races = parseCSV<Race>('races.csv');
    const drivers = parseCSV<Driver>('drivers.csv');
    const constructors = parseCSV<Constructor>('constructors.csv');
    const status = parseCSV<Status>('status.csv');
    const results = parseCSV<Result>('results.csv');
    const qualifying = parseCSV<Qualifying>('qualifying.csv');

    if (!races.length || !results.length) {
        console.error('Core datasets (races.csv, results.csv) are missing or empty. Please ensure CSVs are in data/raw.');
        return;
    }

    console.log(`Loaded ${results.length} results from ${races.length} races.`);

    // =========================================================================
    // STEP 1: INDEXING
    // =========================================================================
    const racesMap = new Map<number, Race>(races.map(r => [r.raceId, r]));
    const driversMap = new Map<number, Driver>(drivers.map(d => [d.driverId, d]));
    const constructorsMap = new Map<number, Constructor>(constructors.map(c => [c.constructorId, c]));
    
    // Group qualifying by raceId and driverId for quick lookup
    const qualyMap = new Map<string, Qualifying>();
    for (const q of qualifying) {
        qualyMap.set(`${q.raceId}-${q.driverId}`, q);
    }

    // =========================================================================
    // STEP 2: BUILD RACE PAIRINGS
    // =========================================================================
    // For each race, group results by constructorId
    const raceConstructorResults = new Map<string, Result[]>();
    for (const res of results) {
        const key = `${res.raceId}-${res.constructorId}`;
        if (!raceConstructorResults.has(key)) raceConstructorResults.set(key, []);
        raceConstructorResults.get(key)!.push(res);
    }

    const teammateRaceComparisons: any[] = [];
    const rivalryMap = new Map<string, any>(); // key: "year-constructorId-driverA-driverB" (sorted driver IDs)

    for (const [key, teamResults] of raceConstructorResults.entries()) {
        if (teamResults.length < 2) continue; // No teammates in this race for this constructor
        
        // Ensure we only compare pairs (if 3 drivers, compare all combinations, though rare)
        for (let i = 0; i < teamResults.length; i++) {
            for (let j = i + 1; j < teamResults.length; j++) {
                const resA = teamResults[i];
                const resB = teamResults[j];
                
                // Sort to ensure A is always the lower driverId for consistency in the key
                const [driver1, driver2] = resA.driverId < resB.driverId ? [resA, resB] : [resB, resA];
                
                const race = racesMap.get(driver1.raceId);
                if (!race) continue;
                
                const qualy1 = qualyMap.get(`${driver1.raceId}-${driver1.driverId}`);
                const qualy2 = qualyMap.get(`${driver2.raceId}-${driver2.driverId}`);

                // Basic race comparison
                const posA = driver1.positionOrder;
                const posB = driver2.positionOrder;
                const raceWinner = posA < posB ? driver1.driverId : (posA > posB ? driver2.driverId : null);

                // Basic qualy comparison
                let qualyWinner = null;
                let gridDelta = null;
                if (qualy1 && qualy2 && qualy1.position !== null && qualy2.position !== null) {
                    qualyWinner = qualy1.position < qualy2.position ? driver1.driverId : (qualy1.position > qualy2.position ? driver2.driverId : null);
                }
                
                if (driver1.grid && driver2.grid && driver1.grid > 0 && driver2.grid > 0) {
                    gridDelta = driver2.grid - driver1.grid; // positive if driver1 is ahead
                }

                const comparison = {
                    raceId: race.raceId,
                    year: race.year,
                    round: race.round,
                    constructorId: driver1.constructorId,
                    driverA: driver1.driverId,
                    driverB: driver2.driverId,
                    posA, posB,
                    pointsA: driver1.points, pointsB: driver2.points,
                    gridA: driver1.grid, gridB: driver2.grid,
                    statusA: driver1.statusId, statusB: driver2.statusId,
                    raceWinner,
                    qualyWinner,
                    gridDelta,
                    posDelta: posB - posA
                };
                teammateRaceComparisons.push(comparison);

                // Add to rivalry
                const rivalryKey = `${race.year}-${driver1.constructorId}-${driver1.driverId}-${driver2.driverId}`;
                if (!rivalryMap.has(rivalryKey)) {
                    rivalryMap.set(rivalryKey, {
                        id: rivalryKey,
                        year: race.year,
                        constructorId: driver1.constructorId,
                        driverA: driver1.driverId,
                        driverB: driver2.driverId,
                        races: []
                    });
                }
                rivalryMap.get(rivalryKey).races.push(comparison);
            }
        }
    }

    // =========================================================================
    // STEP 3: AGGREGATE RIVALRIES AND CALCULATE TDI
    // =========================================================================
    const MIN_RACES = 5; // Configurable threshold
    const rivalries = Array.from(rivalryMap.values()).filter(r => r.races.length >= MIN_RACES).map(r => {
        let raceWinsA = 0, raceWinsB = 0;
        let qualyWinsA = 0, qualyWinsB = 0, validQualy = 0;
        let totalPointsA = 0, totalPointsB = 0;
        let posDeltas: number[] = [];
        let gridDeltas: number[] = [];

        for (const race of r.races) {
            if (race.raceWinner === r.driverA) raceWinsA++;
            if (race.raceWinner === r.driverB) raceWinsB++;
            
            if (race.qualyWinner !== null) {
                validQualy++;
                if (race.qualyWinner === r.driverA) qualyWinsA++;
                if (race.qualyWinner === r.driverB) qualyWinsB++;
            }
            
            totalPointsA += race.pointsA;
            totalPointsB += race.pointsB;
            
            if (race.posDelta !== null) posDeltas.push(race.posDelta);
            if (race.gridDelta !== null) gridDeltas.push(race.gridDelta);
        }

        // Calculate metrics
        const sharedRaces = r.races.length;
        const raceWinRateA = raceWinsA / (raceWinsA + raceWinsB || 1); // Avoid div by zero
        
        let teamPointsShareA = 0.5; // Default if 0 points scored by both
        if (totalPointsA + totalPointsB > 0) {
            teamPointsShareA = totalPointsA / (totalPointsA + totalPointsB);
        }

        const medianPosDelta = posDeltas.length ? posDeltas.sort((a,b)=>a-b)[Math.floor(posDeltas.length/2)] : 0;
        const medianGridDelta = gridDeltas.length ? gridDeltas.sort((a,b)=>a-b)[Math.floor(gridDeltas.length/2)] : 0;

        // TDI Components
        const h2hRaceNorm = (raceWinsA - raceWinsB) / sharedRaces; 
        const h2hQualyNorm = validQualy > 0 ? (qualyWinsA - qualyWinsB) / validQualy : 0;
        const pointShareNorm = (totalPointsA + totalPointsB > 0) ? (teamPointsShareA - 0.5) * 2 : 0;
        
        // Normalize deltas (e.g., max expected difference is ~10 positions for meaningful scale)
        const posDeltaNorm = Math.max(-1, Math.min(1, medianPosDelta / 10));
        const gridDeltaNorm = Math.max(-1, Math.min(1, medianGridDelta / 10));

        // TDI Weights (sum to 1)
        const weights = { race: 0.30, qualy: 0.25, points: 0.20, pos: 0.15, grid: 0.10 };
        let TDI_raw = 
            (h2hRaceNorm * weights.race) + 
            (h2hQualyNorm * weights.qualy) + 
            (pointShareNorm * weights.points) + 
            (posDeltaNorm * weights.pos) + 
            (gridDeltaNorm * weights.grid);
            
        // Scale to [-100, 100]
        const TDI = Math.round(TDI_raw * 100);
        const rivalryBalanceScore = 100 - Math.abs(TDI);
        const teamDependency = Math.abs(teamPointsShareA - (1 - teamPointsShareA));

        return {
            id: r.id,
            year: r.year,
            constructorId: r.constructorId,
            driverAId: r.driverA,
            driverBId: r.driverB,
            sharedRaces,
            stats: {
                raceWinsA, raceWinsB,
                qualyWinsA, qualyWinsB, validQualy,
                totalPointsA, totalPointsB,
                teamPointsShareA,
                medianPosDelta, medianGridDelta
            },
            metrics: {
                TDI,
                rivalryBalanceScore,
                teamDependency
            }
        };
    });

    // Sort rivalries chronologically and then by team
    rivalries.sort((a, b) => b.year - a.year || a.constructorId - b.constructorId);

    // =========================================================================
    // STEP 4: EXPORT DATA
    // =========================================================================
    if (!fs.existsSync(OUT_DIR)) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    console.log('Writing output files...');
    fs.writeFileSync(path.join(OUT_DIR, 'season-rivalries.json'), JSON.stringify(rivalries));
    
    // Create compact indexes
    const dIndex = drivers.map(d => ({ id: d.driverId, ref: d.driverRef, name: `${d.forename} ${d.surname}`, code: d.code }));
    fs.writeFileSync(path.join(OUT_DIR, 'drivers-index.json'), JSON.stringify(dIndex));
    
    const cIndex = constructors.map(c => ({ id: c.constructorId, ref: c.constructorRef, name: c.name }));
    fs.writeFileSync(path.join(OUT_DIR, 'constructors-index.json'), JSON.stringify(cIndex));

    fs.writeFileSync(path.join(OUT_DIR, 'race-comparisons.json'), JSON.stringify(teammateRaceComparisons));

    console.log('Preprocessing complete!');
}

main().catch(console.error);
