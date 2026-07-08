import httpx
import asyncio
import time
import json
import os
import hashlib
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential
from app.config.settings import settings
import structlog

logger = structlog.get_logger()

class OpenF1Client:
    def __init__(self):
        self.base_url = settings.openf1_base_url
        self.client = httpx.AsyncClient(timeout=settings.openf1_request_timeout_seconds)
        
        # Rate limiting state
        self._last_requests = []
        self._requests_this_minute = []

    async def _wait_for_rate_limit(self):
        now = time.time()
        
        # Clear old requests
        self._last_requests = [t for t in self._last_requests if now - t < 1.0]
        self._requests_this_minute = [t for t in self._requests_this_minute if now - t < 60.0]

        # Check seconds limit (max 3 per second)
        if len(self._last_requests) >= settings.openf1_max_requests_per_second:
            wait_time = 1.0 - (now - self._last_requests[0])
            if wait_time > 0:
                await asyncio.sleep(wait_time)
                
        now = time.time() # Update after potential sleep
        
        # Check minute limit (max 30 per minute for historical)
        if len(self._requests_this_minute) >= settings.openf1_max_requests_per_minute:
            wait_time = 60.0 - (now - self._requests_this_minute[0])
            if wait_time > 0:
                logger.info("Rate limit (minute) reached. Waiting...", wait_seconds=wait_time)
                await asyncio.sleep(wait_time)
                
        # Record this request
        record_time = time.time()
        self._last_requests.append(record_time)
        self._requests_this_minute.append(record_time)

    def _get_cache_path(self, endpoint: str, params: dict, year: int, meeting_key: int, session_key: int):
        # Create deterministic filename
        param_str = "_".join(f"{k}-{v}" for k, v in sorted(params.items()))
        filename = f"{endpoint}_{param_str}.json"
        
        dir_path = os.path.join(
            settings.raw_data_dir,
            str(year),
            str(meeting_key),
            str(session_key)
        )
        os.makedirs(dir_path, exist_ok=True)
        return os.path.join(dir_path, filename), dir_path

    def _save_manifest(self, endpoint, url, year, meeting_key, session_key, data, file_path, status_code=200):
        # Checksum
        data_str = json.dumps(data)
        checksum = hashlib.sha256(data_str.encode('utf-8')).hexdigest()
        
        manifest = {
            "endpoint": endpoint,
            "url": url,
            "year": year,
            "meeting_key": meeting_key,
            "session_key": session_key,
            "requested_at": datetime.utcnow().isoformat() + "Z",
            "status_code": status_code,
            "record_count": len(data) if isinstance(data, list) else 1,
            "checksum": checksum,
            "file_path": file_path,
            "completed": True
        }
        
        manifest_filename = f"{endpoint}_{session_key}_manifest.json"
        os.makedirs(settings.manifest_dir, exist_ok=True)
        manifest_path = os.path.join(settings.manifest_dir, manifest_filename)
        
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)

    @retry(
        stop=stop_after_attempt(settings.openf1_max_retries),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def _fetch(self, endpoint: str, params: dict, year: int = 0, meeting_key: int = 0, session_key: int = 0):
        url = f"{self.base_url}/{endpoint}"
        
        # Check cache
        file_path, _ = self._get_cache_path(endpoint, params, year, meeting_key, session_key)
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                logger.debug(f"Cache hit for {endpoint}", params=params)
                return json.load(f)
                
        await self._wait_for_rate_limit()
        
        logger.info(f"Fetching from API: {url}", params=params)
        response = await self.client.get(url, params=params)
        
        # Handle "No results found" gracefully (OpenF1 returns 404 or 400 for empty queries)
        if response.status_code in [404, 400] and "No results found" in response.text:
            logger.warning(f"No results found from API: {url}", params=params)
            return []
            
        response.raise_for_status()
        
        data = response.json()
        
        # Save Raw JSON
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
            
        # Save Manifest
        self._save_manifest(endpoint, str(response.url), year, meeting_key, session_key, data, file_path, response.status_code)
        
        return data

    # Public Methods
    async def get_sessions(self, **params):
        # Sessions might not be bound to a specific meeting/session yet in the hierarchy
        year = params.get('year', 0)
        return await self._fetch("sessions", params, year=year)
        
    async def get_race_control(self, session_key: int, meeting_key: int = 0, year: int = 0):
        return await self._fetch("race_control", {"session_key": session_key}, year, meeting_key, session_key)
        
    async def get_pit_stops(self, session_key: int, meeting_key: int = 0, year: int = 0):
        return await self._fetch("pit", {"session_key": session_key}, year, meeting_key, session_key)

    async def get_laps(self, session_key: int, meeting_key: int = 0, year: int = 0):
        return await self._fetch("laps", {"session_key": session_key}, year, meeting_key, session_key)
        
    async def get_intervals(self, session_key: int, meeting_key: int = 0, year: int = 0):
        return await self._fetch("intervals", {"session_key": session_key}, year, meeting_key, session_key)

    async def get_positions(self, session_key: int, meeting_key: int = 0, year: int = 0):
        return await self._fetch("position", {"session_key": session_key}, year, meeting_key, session_key)

    async def get_drivers(self, session_key: int, meeting_key: int = 0, year: int = 0):
        return await self._fetch("drivers", {"session_key": session_key}, year, meeting_key, session_key)

    async def close(self):
        await self.client.aclose()
