from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel

class NeutralizationEvent(BaseModel):
    event_id: str
    session_key: int
    event_type: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    confidence_level: str = "HIGH"

def build_neutralization_events(session_key: int, rc_messages: List[Dict]) -> List[NeutralizationEvent]:
    """
    Reconstruct SC and VSC events from race control messages using a State Machine.
    """
    events = []
    current_state = "GREEN"
    current_event: Optional[NeutralizationEvent] = None
    event_counter = 1
    
    # Sort messages by date to ensure chronological order
    sorted_msgs = sorted([m for m in rc_messages if m.get('date')], key=lambda x: x['date'])
    
    for msg in sorted_msgs:
        category = (msg.get('category') or "").upper()
        flag = (msg.get('flag') or "").upper()
        message = (msg.get('message') or "").upper()
        date = msg.get('date')
        
        # State transitions
        if "SAFETY CAR DEPLOYED" in message or flag == "SAFETY CAR":
            if current_state != "SC":
                if current_event:
                    # Close previous event if it was VSC
                    current_event.end_time = date
                    current_event.duration_seconds = (date - current_event.start_time).total_seconds()
                    events.append(current_event)
                
                current_state = "SC"
                current_event = NeutralizationEvent(
                    event_id=f"{session_key}-sc-{event_counter}",
                    session_key=session_key,
                    event_type="SAFETY_CAR",
                    start_time=date
                )
                event_counter += 1
                
        elif "VIRTUAL SAFETY CAR" in message or "VSC DEPLOYED" in message or flag == "VIRTUAL SAFETY CAR":
            if current_state != "VSC":
                if current_event:
                    # Rare but possible: SC to VSC (usually it's VSC to SC)
                    current_event.end_time = date
                    current_event.duration_seconds = (date - current_event.start_time).total_seconds()
                    events.append(current_event)
                    
                current_state = "VSC"
                current_event = NeutralizationEvent(
                    event_id=f"{session_key}-vsc-{event_counter}",
                    session_key=session_key,
                    event_type="VIRTUAL_SAFETY_CAR",
                    start_time=date
                )
                event_counter += 1
                
        elif "GREEN FLAG" in flag or "CLEAR" in flag or "ENDING" in message:
            if current_state in ["SC", "VSC"] and current_event:
                current_event.end_time = date
                current_event.duration_seconds = (date - current_event.start_time).total_seconds()
                events.append(current_event)
                current_event = None
                current_state = "GREEN"
                
    # If session ends under SC/VSC
    if current_event and not current_event.end_time:
        current_event.confidence_level = "MEDIUM"
        events.append(current_event)
        
    return events
