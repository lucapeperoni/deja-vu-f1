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


def parse_rc_messages(raw_messages: List[Dict]) -> List[Dict]:
    """Converte il campo 'date' dei messaggi OpenF1 grezzi (stringa ISO) in datetime."""
    parsed = []
    for m in raw_messages:
        date_str = m.get("date")
        if not date_str:
            continue
        parsed.append({**m, "date": datetime.fromisoformat(date_str)})
    return parsed


def build_lap_indexed_windows(session_key: int, rc_messages_parsed: List[Dict]):
    """
    build_neutralization_events lavora su timestamp; qui li convertiamo in
    numero di giro usando il campo lap_number che OpenF1 fornisce già per
    ogni messaggio di race control (non serve ricostruire l'orario di gara
    a partire dai tempi sul giro).

    Ritorna (windows, warnings): windows è una lista di dict pronti per
    NeutralizationWindow di effective_pit_loss.py
    ({event_id, type: "SC"|"VSC", start_lap, end_lap}).
    """
    lap_by_date = {
        m["date"]: m.get("lap_number") for m in rc_messages_parsed if m.get("lap_number") is not None
    }

    events = build_neutralization_events(session_key, rc_messages_parsed)

    windows = []
    warnings = []
    for e in events:
        start_lap = lap_by_date.get(e.start_time)
        end_lap = lap_by_date.get(e.end_time) if e.end_time else None

        if start_lap is None or end_lap is None:
            warnings.append(
                f"evento {e.event_id} ({e.event_type}) senza giro di inizio/fine "
                f"risolvibile (start_lap={start_lap}, end_lap={end_lap}); scartato."
            )
            continue

        windows.append(
            {
                "event_id": e.event_id,
                "type": "SC" if e.event_type == "SAFETY_CAR" else "VSC",
                "start_lap": start_lap,
                "end_lap": end_lap,
            }
        )

    return windows, warnings
