import os
from pydantic_settings import BaseSettings
from typing import Optional

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_ANON_KEY: Optional[str] = None

    # WA-AKG Gateway Settings
    WA_BASE_URL: str = "https://akg.wisedev.online"
    WA_API_KEY: str = "wag_HHOZAgSD74TEXvdbutSttNKbJYDCAsMT"
    WA_SESSION_ID: str = "9p9jve"

    # Resend Email Settings
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM_EMAIL: str = "Krenox <verify@wisedev.online>"

    FRONTEND_URL: str = "http://localhost:3000"
    PORT: int = 8000

    class Config:
        env_file = ENV_PATH if os.path.exists(ENV_PATH) else ".env"
        extra = "ignore"

settings = Settings()
