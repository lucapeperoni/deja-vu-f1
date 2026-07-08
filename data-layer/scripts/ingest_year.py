import asyncio
import argparse
import structlog
from app.clients.openf1_client import OpenF1Client
from scripts.ingest_session import ingest_session

logger = structlog.get_logger(__name__)

async def ingest_year(year: int, skip_heavy: bool = True):
    client = OpenF1Client()
    logger.info(f"Fetching all Race sessions for the year {year}...")
    
    try:
        # Recuperiamo tutte le sessioni di tipo "Race" per quell'anno
        sessions_data = await client.get_sessions(year=year)
        
        # Filtriamo solo le gare (non le prove o qualifiche)
        race_sessions = [s for s in sessions_data if s.get("session_name") == "Race"]
        
        if not race_sessions:
            logger.warning(f"No race sessions found for year {year}")
            return

        logger.info(f"Found {len(race_sessions)} races for {year}. Starting batch ingestion...")
        
        for i, session in enumerate(race_sessions, 1):
            session_key = session.get("session_key")
            meeting_name = session.get("meeting_name", "Unknown")
            
            logger.info("=" * 60)
            logger.info(f"🏁 [{i}/{len(race_sessions)}] Ingesting {meeting_name} (Session: {session_key})")
            logger.info("=" * 60)
            
            # Non usiamo --skip-heavy via argparse, ma passiamo True/False internamente
            # Purtroppo la funzione `ingest_session` al momento non prende `skip_heavy`
            # come parametro. Andremo ad aggiornare ingest_session.py per accettarlo.
            await ingest_session(session_key, year, skip_heavy=skip_heavy)
            
            logger.info(f"✅ {meeting_name} ingestion successful!")
            # Evitiamo di floddare l'API tutta in una volta
            await asyncio.sleep(2)
            
        logger.info("🎉 All races ingested successfully!")
        
    except Exception as e:
        logger.error(f"Batch ingestion failed: {str(e)}")
    finally:
        await client.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest all race sessions for a specific year")
    parser.add_argument("--year", type=int, default=2021, help="Year to ingest")
    parser.add_argument("--skip-heavy", action="store_true", default=True, help="Skip heavy endpoints")
    args = parser.parse_args()
    
    asyncio.run(ingest_year(args.year, args.skip_heavy))
