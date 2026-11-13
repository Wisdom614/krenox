from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_ANON_KEY: Optional[str] = None

    # WA-AKG Gateway Settings
    WA_BASE_URL: str = "https://akg.wisedev.online"
    WA_API_KEY: str = "wag_HHOZAgSD74TEXvdbutSttNKbJYDCAsMT"
    WA_SESSION_ID: str = "9p9jve"

    PORT: int = 8000

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
