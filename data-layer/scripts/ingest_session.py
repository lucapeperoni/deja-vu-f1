import asyncio
import argparse
from dateutil.parser import parse
from app.clients.openf1_client import OpenF1Client
from app.db.base import SessionLocal
from app.db.models.core import Meeting, Session, RaceControlMessage, Lap, PitStop, Position, Interval
from app.db.base import Base, engine
import structlog
from app.config.settings import settings

logger = structlog.get_logger()

def safe_parse_date(date_str):
    if not date_str:
        return None
    try:
        return parse(date_str)
    except:
        return None

async def ingest_session(session_key: int, year: int):
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
    client = OpenF1Client()
    db = SessionLocal()
    
    try:
        logger.info(f"Starting ingestion for session {session_key}")
        
        # 1. Fetch Basic Session Info (to get meeting_key)
        # Note: OpenF1 /sessions endpoint returns a list
        sessions_data = await client.get_sessions(session_key=session_key)
        if not sessions_data:
            logger.error("Session not found")
            return
            
        session_raw = sessions_data[0]
        meeting_key = session_raw.get('meeting_key')
        
        # Insert Session
        session_record = db.query(Session).filter_by(session_key=session_key).first()
        if not session_record:
            session_record = Session(
                session_key=session_key,
                meeting_key=meeting_key,
                session_name=session_raw.get('session_name'),
                session_type=session_raw.get('session_type'),
                date_start=safe_parse_date(session_raw.get('date_start')),
                date_end=safe_parse_date(session_raw.get('date_end')),
                gmt_offset=session_raw.get('gmt_offset'),
                year=session_raw.get('year'),
                country_name=session_raw.get('country_name'),
                location=session_raw.get('location'),
                is_race_session=session_raw.get('session_type') == 'Race'
            )
            db.add(session_record)
            db.commit()

        # 2. Fetch Race Control
        rc_data = await client.get_race_control(session_key=session_key, meeting_key=meeting_key, year=year)
        logger.info(f"Fetched {len(rc_data)} race control messages")
        
        # Clear old data for idempotency
        db.query(RaceControlMessage).filter_by(session_key=session_key).delete()
        
        for msg in rc_data:
            rc_record = RaceControlMessage(
                session_key=session_key,
                meeting_key=meeting_key,
                date=safe_parse_date(msg.get('date')),
                lap_number=msg.get('lap_number'),
                category=msg.get('category'),
                flag=msg.get('flag'),
                scope=msg.get('scope'),
                sector=msg.get('sector'),
                driver_number=msg.get('driver_number'),
                message=msg.get('message'),
                raw_payload=msg
            )
            db.add(rc_record)
        
        db.commit()

        # 3. Fetch Pit Stops
        pit_data = await client.get_pit_stops(session_key=session_key, meeting_key=meeting_key, year=year)
        logger.info(f"Fetched {len(pit_data)} pit stops")
        
        db.query(PitStop).filter_by(session_key=session_key).delete()
        for pit in pit_data:
            pit_record = PitStop(
                session_key=session_key,
                meeting_key=meeting_key,
                driver_number=pit.get('driver_number'),
                date=safe_parse_date(pit.get('date')),
                lap_number=pit.get('lap_number'),
                pit_duration=pit.get('pit_duration')
            )
            db.add(pit_record)
            
        db.commit()

        # 4. Fetch Laps
        if not args.skip_heavy:
            logger.info("Fetching Laps...")
            laps_data = await client.get_laps(session_key=session_key, meeting_key=meeting_key, year=year)
            db.query(Lap).filter_by(session_key=session_key).delete()
            for lap in laps_data:
                lap_record = Lap(
                    session_key=session_key,
                    meeting_key=meeting_key,
                    driver_number=lap.get('driver_number'),
                    lap_number=lap.get('lap_number'),
                    date_start=safe_parse_date(lap.get('date_start')),
                    lap_duration=lap.get('lap_duration'),
                    is_pit_out_lap=lap.get('is_pit_out_lap', False),
                    duration_sector_1=lap.get('duration_sector_1'),
                    duration_sector_2=lap.get('duration_sector_2'),
                    duration_sector_3=lap.get('duration_sector_3')
                )
                db.add(lap_record)
            db.commit()
            
            logger.info("Fetching Positions...")
            pos_data = await client.get_positions(session_key=session_key, meeting_key=meeting_key, year=year)
            db.query(Position).filter_by(session_key=session_key).delete()
            for pos in pos_data:
                pos_record = Position(
                    session_key=session_key,
                    meeting_key=meeting_key,
                    driver_number=pos.get('driver_number'),
                    date=safe_parse_date(pos.get('date')),
                    position=pos.get('position')
                )
                db.add(pos_record)
            db.commit()
            
            logger.info("Fetching Intervals...")
            int_data = await client.get_intervals(session_key=session_key, meeting_key=meeting_key, year=year)
            db.query(Interval).filter_by(session_key=session_key).delete()
            for inv in int_data:
                # Convert string gaps to floats if necessary here (simplification for now)
                gap_raw = inv.get('gap_to_leader')
                gap_val = float(gap_raw) if isinstance(gap_raw, (int, float)) else None
                
                int_record = Interval(
                    session_key=session_key,
                    meeting_key=meeting_key,
                    driver_number=inv.get('driver_number'),
                    date=safe_parse_date(inv.get('date')),
                    gap_to_leader=gap_val
                )
                db.add(int_record)
            db.commit()
        
        logger.info("Ingestion complete!")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Ingestion failed: {str(e)}")
    finally:
        db.close()
        await client.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest a specific session from OpenF1")
    parser.add_argument("--session-key", type=int, required=True, help="Session key to ingest")
    parser.add_argument("--year", type=int, default=2024, help="Year of the session")
    parser.add_argument("--skip-heavy", action="store_true", help="Skip heavy endpoints like laps, intervals, and positions")
    args = parser.parse_args()
    
    asyncio.run(ingest_session(args.session_key, args.year))
