import os
import json
from pathlib import Path
from sqlalchemy.orm import Session
from app.db.base import SessionLocal
from app.db.models.core import Session as SessionModel, RaceControlMessage, PitStop, Lap, Position, Interval
from app.metrics.neutralization_events import build_neutralization_events
from app.metrics.effective_pit_loss import calculate_pit_cost
import structlog

logger = structlog.get_logger(__name__)

def export_sessions_to_json():
    # Definiamo la cartella del frontend (F1Analytics/public/data/races)
    base_dir = Path(__file__).resolve().parent.parent.parent
    frontend_data_dir = base_dir / "public" / "data" / "races"
    
    # Assicuriamoci che la directory esista
    frontend_data_dir.mkdir(parents=True, exist_ok=True)
    
    db: Session = SessionLocal()
    try:
        # Troviamo tutte le gare nel database
        sessions = db.query(SessionModel).filter_by(is_race_session=True).all()
        # Se is_race_session non è popolato, estraiamo tutte le sessioni disponibili:
        if not sessions:
            sessions = db.query(SessionModel).all()
            
        session_map = {s.session_key: s for s in sessions}
        
        if not sessions:
            logger.warning("Nessuna sessione trovata nel database.")
            # Tentativo brutale: vediamo se ci sono dati di messaggi associati a session_key unici
            distinct_keys = db.query(RaceControlMessage.session_key).distinct().all()
            session_keys = [k[0] for k in distinct_keys]
        else:
            session_keys = [s.session_key for s in sessions]
            
        if not session_keys:
            logger.error("Database completamente vuoto.")
            return

        logger.info(f"Trovate {len(session_keys)} sessioni da esportare. Inizio esportazione...")
        
        for session_key in session_keys:
            logger.info(f"Esportazione sessione {session_key}...")
            
            # 1. Recupero Dati Grezzi
            rc_msgs = db.query(RaceControlMessage).filter_by(session_key=session_key).order_by(RaceControlMessage.date).all()
            pit_stops = db.query(PitStop).filter_by(session_key=session_key).order_by(PitStop.date).all()
            
            rc_dicts = [{"category": m.category, "flag": m.flag, "message": m.message, "date": m.date} for m in rc_msgs]
            pit_dicts = [{"driver_number": p.driver_number, "lap_number": p.lap_number, "date": p.date, "pit_duration": p.pit_duration} for p in pit_stops]
            
            # 2. Calcolo Metriche
            neutralizations = build_neutralization_events(session_key, rc_dicts)
            neut_dicts = [n.dict() for n in neutralizations]
            pit_impacts = calculate_pit_cost(pit_dicts, neut_dicts)
            
            # Formattiamo le date e i nomi per il frontend JSON
            safe_neut_dicts = []
            for i, n in enumerate(neut_dicts):
                safe_neut_dicts.append({
                    "eventId": f"neut-{i+1}",
                    "type": "Safety Car" if n.get('event_type') == "SC" else "Virtual SC" if n.get('event_type') == "VSC" else "Red Flag",
                    "startLap": n.get('start_lap'),
                    "endLap": n.get('end_lap'),
                    "durationSeconds": n.get('duration_seconds'),
                    "startTime": n['start_time'].isoformat() if n.get('start_time') else None,
                    "endTime": n['end_time'].isoformat() if n.get('end_time') else None,
                })
                
            safe_pit_impacts = []
            for p in pit_impacts:
                p_dict = p.dict()
                safe_pit_impacts.append({
                    "driverNumber": p_dict.get('driver_number'),
                    "lapNumber": p_dict.get('lap_number'),
                    "pitDuration": p_dict.get('pit_duration'),
                    "neutralizationType": p_dict.get('neutralization_type'),
                    "neutralizationDiscount": p_dict.get('neutralization_discount'),
                    "baselineCost": 20.0, # default placeholder se non calcolato
                    "date": p_dict['date'].isoformat() if p_dict.get('date') else None
                })
            
            session_obj = session_map.get(session_key)
            
            # 3. Assemblaggio JSON
            export_payload = {
                "session_key": session_key,
                "meeting_key": session_obj.meeting_key if session_obj else None,
                "season": session_obj.year if session_obj else None,
                "raceName": session_obj.session_name if session_obj else "Race",
                "country": session_obj.country_name if session_obj else "",
                "neutralizations": safe_neut_dicts,
                "pit_stops": safe_pit_impacts,
                "totalLaps": max([p.get('lap_number', 0) for p in pit_dicts]) if pit_dicts else 0, # fallback estimation
                "stats": {
                    "total_neutralizations": len(safe_neut_dicts),
                    "total_pit_stops": len(safe_pit_impacts)
                }
            }
            
            # 4. Scrittura su disco
            output_file = frontend_data_dir / f"{session_key}.json"
            with open(output_file, "w") as f:
                json.dump(export_payload, f, indent=2)
                
            logger.info(f"Esportato {output_file.name} con {len(safe_pit_impacts)} pit stops.")
            
    except Exception as e:
        logger.error(f"Errore durante l'esportazione: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    export_sessions_to_json()
