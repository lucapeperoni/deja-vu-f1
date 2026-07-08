import fastf1
import pandas as pd
import json
import os

# Enable cache to speed up repeated runs
fastf1.Cache.enable_cache('data/cache')

def fetch_race_data(year, round_num):
    print(f"Loading data for {year} Round {round_num}...")
    session = fastf1.get_session(year, round_num, 'R')
    session.load(telemetry=False, weather=False) # Keep it light for now
    
    # 1. Extract Track Status (Neutralizations)
    track_status = session.track_status
    neutralizations = []
    
    current_event = None
    for _, row in track_status.iterrows():
        status = row['Status']
        timestamp = row['Time'].total_seconds()
        
        # 4 = SC, 6 = VSC, 5 = Red Flag
        if status in ['4', '6', '5'] and not current_event:
            event_type = 'Safety Car' if status == '4' else 'Virtual Safety Car' if status == '6' else 'Red Flag'
            current_event = {
                'type': event_type,
                'startTime': timestamp,
            }
        elif status == '1' and current_event:
            current_event['endTime'] = timestamp
            current_event['duration'] = timestamp - current_event['startTime']
            neutralizations.append(current_event)
            current_event = None
            
    # 2. Extract Pit Stops
    laps = session.laps
    pit_stops = laps[pd.notnull(laps['PitOutTime'])]
    
    stops_data = []
    for _, row in pit_stops.iterrows():
        stops_data.append({
            'driver': row['Driver'],
            'lap': int(row['LapNumber']),
            'pitInTime': row['PitInTime'].total_seconds() if pd.notnull(row['PitInTime']) else None,
            'pitOutTime': row['PitOutTime'].total_seconds(),
            'stationaryTime': row['PitStationaryTime'].total_seconds() if pd.notnull(row['PitStationaryTime']) else None
        })
        
    return {
        'neutralizations': neutralizations,
        'pitStops': stops_data
    }

if __name__ == '__main__':
    # Ensure cache and data dirs exist
    os.makedirs('data/cache', exist_ok=True)
    os.makedirs('public/data', exist_ok=True)
    
    # Example: 2021 Abu Dhabi Grand Prix (Round 22) - Famous SC finish
    try:
        data = fetch_race_data(2021, 22)
        with open('public/data/race-anatomy-2021-22.json', 'w') as f:
            json.dump(data, f, indent=2)
        print("Successfully exported race data.")
    except Exception as e:
        print(f"Error fetching FastF1 data: {e}")
