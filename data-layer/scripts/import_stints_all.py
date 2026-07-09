"""
De-risking dell'ipotesi "l'eta' delle gomme del rivale rimasto fuori da una
neutralizzazione predice quanti giri impieghi a riscavalcarlo": scarica/cachea
gli stint OpenF1 (mescola + tyre_age_at_start) per tutte le 46 gare
2023-2024, cosi' la correlazione si puo' misurare sull'intero campione
invece che sulle sole 3 gare-caso (dove non c'era abbastanza varianza
nell'eta' gomme dei rivali per un singolo evento).

Esito della verifica (Python ad-hoc sul JSON prodotto da questo script,
non salvato a parte): su 263 coppie pilota-rivale con dato di riscavalco
noto, correlazione eta' gomme / giri-per-riscavalcare = 0,01 (SC: 0,11,
VSC: 0,01) — nessun segnale utilizzabile. Per questo la mescola/eta' gomme
NON alimenta nessuna metrica derivata: e' stata invece integrata solo come
dettaglio narrativo nelle 3 gare-caso, in `build_all.py`
(vedi CASE_RACE_SLUGS e attach_tyre_info).

Solo lettura/cache OpenF1: nessuna modifica allo schema di public/data/.

Uso (dalla cartella data-layer, con l'ambiente virtuale attivo):
    python scripts/import_stints_all.py
"""

import asyncio
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_LAYER_DIR = SCRIPT_DIR.parent
REPO_ROOT = DATA_LAYER_DIR.parent

sys.path.insert(0, str(DATA_LAYER_DIR))

from app.clients.openf1_client import OpenF1Client  # noqa: E402
from build_all import (  # noqa: E402
    ErgastData,
    YEARS,
    fetch_openf1_race_sessions_by_year,
    match_openf1_session,
    slugify,
)


async def main():
    ergast = ErgastData()
    client = OpenF1Client()
    try:
        results = []
        for year in YEARS:
            race_rows = ergast.races_for_years([year])
            sessions = await fetch_openf1_race_sessions_by_year(client, year)
            for race_row in race_rows:
                session = match_openf1_session(race_row, sessions)
                slug = slugify(race_row, ergast)
                if session is None:
                    print(f"{slug}: nessuna sessione OpenF1 agganciata, salto")
                    continue
                session_key = session["session_key"]
                meeting_key = session["meeting_key"]
                stints = await client.get_stints(session_key, meeting_key, year)
                print(f"{slug}: {len(stints)} stint")
                results.append({"slug": slug, "sessionKey": session_key, "stints": stints})

        out_path = SCRIPT_DIR / "_stints_all_raw.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(results, f)
        print(f"\nSalvato {out_path.relative_to(REPO_ROOT)} ({len(results)} gare).")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
