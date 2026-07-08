from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.db.models.core import Session as SessionModel, RaceControlMessage, PitStop
from app.metrics.neutralization_events import build_neutralization_events
from app.metrics.effective_pit_loss import calculate_pit_cost

router = APIRouter()

@router.get("/{session_key}/race-dynamics")
def get_race_dynamics(session_key: int, db: Session = Depends(get_db)):
    """
    Returns the full Race Dynamics analytical payload for a given session.
    """
    # 1. Verify session exists
    session_record = db.query(SessionModel).filter(SessionModel.session_key == session_key).first()
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found in local database")
        
    # 2. Fetch raw data
    rc_msgs = db.query(RaceControlMessage).filter(RaceControlMessage.session_key == session_key).all()
    pit_stops = db.query(PitStop).filter(PitStop.session_key == session_key).all()
    
    # 3. Convert to dicts for metric engines
    rc_dicts = [
        {"category": m.category, "flag": m.flag, "message": m.message, "date": m.date} 
        for m in rc_msgs
    ]
    
    pit_dicts = [
        {"driver_number": p.driver_number, "lap_number": p.lap_number, "date": p.date, "pit_duration": p.pit_duration}
        for p in pit_stops
    ]
    
    # 4. Compute Metrics
    neutralizations = build_neutralization_events(session_key, rc_dicts)
    
    # Convert neutralizations to dict for pit cost calculator
    neut_dicts = [n.dict() for n in neutralizations]
    pit_impacts = calculate_pit_cost(pit_dicts, neut_dicts)
    
    # 5. Return Aggregated Response
    return {
        "session_key": session_key,
        "session_name": session_record.session_name,
        "neutralization_events": neut_dicts,
        "pit_cost_impacts": [p.dict() for p in pit_impacts],
        "confidence": {
            "level": "HIGH" if len(rc_dicts) > 0 and len(pit_dicts) > 0 else "LOW",
            "score": 0.95 if len(rc_dicts) > 0 else 0.1
        }
    }
