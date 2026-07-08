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

        # Le transizioni SC/VSC vanno riconosciute solo dai messaggi con
        # category "SafetyCar": i messaggi Flag/CLEAR sono per settore (es.
        # "CLEAR IN TRACK SECTOR 7") e non hanno nulla a che fare con
        # l'inizio/fine di una neutralizzazione. Usarli come segnale di
        # chiusura (come faceva la versione precedente) chiude la finestra
        # SC/VSC quasi subito ogni volta che compare un CLEAR di settore in
        # coincidenza, anche di un solo secondo, con il deployment.
        is_safety_car_message = category == "SAFETYCAR"

        # State transitions
        # Nota: "VIRTUAL SAFETY CAR DEPLOYED" contiene "SAFETY CAR DEPLOYED"
        # come sottostringa, quindi il controllo VSC deve venire PRIMA di
        # quello SC, altrimenti ogni VSC verrebbe scambiata per una SC.
        if is_safety_car_message and "VIRTUAL SAFETY CAR DEPLOYED" in message:
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

        elif is_safety_car_message and "SAFETY CAR DEPLOYED" in message:
            if current_state != "SC":
                if current_event:
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

        elif is_safety_car_message and current_state == "SC" and (
            "SAFETY CAR IN THIS LAP" in message or "SAFETY CAR THROUGH THE PIT LANE" in message
        ):
            if current_event:
                current_event.end_time = date
                current_event.duration_seconds = (date - current_event.start_time).total_seconds()
                events.append(current_event)
                current_event = None
                current_state = "GREEN"

        elif is_safety_car_message and current_state == "VSC" and "VIRTUAL SAFETY CAR ENDING" in message:
            if current_event:
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
