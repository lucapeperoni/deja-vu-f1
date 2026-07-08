from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    openf1_base_url: str = "https://api.openf1.org/v1"
    database_url: str = "sqlite:///./race_dynamics.db"
    raw_data_dir: str = "./data/raw"
    parquet_data_dir: str = "./data/parquet"
    cache_dir: str = "./data/cache"
    manifest_dir: str = "./data/manifests"
    
    openf1_max_requests_per_second: int = 3
    openf1_max_requests_per_minute: int = 30
    openf1_request_timeout_seconds: int = 30
    openf1_max_retries: int = 5
    
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'),
        env_file_encoding='utf-8'
    )

settings = Settings()
