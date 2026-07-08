from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel
import statistics

class PitCostImpact(BaseModel):
    pit_stop_id: str
    driver_number: int
    event_id: Optional[str] = None
    expected_green_pit_loss: float
    observed_effective_pit_loss: float
    neutralization_discount_seconds: float
    eligibility_status: str

def calculate_pit_cost(pit_stops: List[Dict], neutralizations: List[Dict]) -> List[PitCostImpact]:
    """
    Calculate the effective pit loss and neutralization discount.
    """
    results = []
    
    # 1. Establish Green Baseline
    # Filter pit stops that are NOT under any neutralization
    green_stops = []
    for pit in pit_stops:
        date = pit.get('date')
        if not date: continue
        
        is_green = True
        for n in neutralizations:
            if n.get('start_time') and n.get('end_time'):
                if n['start_time'] <= date <= n['end_time']:
                    is_green = False
                    break
        if is_green and pit.get('pit_duration'):
            green_stops.append(pit['pit_duration'])
            
    # Calculate median green pit loss
    baseline = 22.0 # Default fallback
    if len(green_stops) > 3:
        baseline = statistics.median(green_stops)
        
    # 2. Calculate impact for each stop
    for pit in pit_stops:
        date = pit.get('date')
        duration = pit.get('pit_duration')
        if not date or not duration:
            continue
            
        associated_event = None
        for n in neutralizations:
            if n.get('start_time') and n.get('end_time'):
                # Check if pit stop falls within the neutralization window
                if n['start_time'] <= date <= n['end_time']:
                    associated_event = n['event_id']
                    break
                    
        # In a full implementation, observed_loss would be gap_before - gap_after. 
        # Here we use pit_duration as a simplified proxy for demonstration.
        observed_loss = duration
        discount = baseline - observed_loss if associated_event else 0.0
        
        results.append(PitCostImpact(
            pit_stop_id=f"pit-{pit.get('driver_number')}-{pit.get('lap_number')}",
            driver_number=pit.get('driver_number', 0),
            event_id=associated_event,
            expected_green_pit_loss=baseline,
            observed_effective_pit_loss=observed_loss,
            neutralization_discount_seconds=discount,
            eligibility_status="Eligible" if associated_event else "Green"
        ))
        
    return results
