import os
from pydantic_settings import BaseSettings
from typing import Optional

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_ANON_KEY: Optional[str] = None

    # WhatsApp gateway settings are optional in local development and must be
    # supplied through the environment in deployed environments.
    WA_BASE_URL: Optional[str] = None
    WA_API_KEY: Optional[str] = None
    WA_SESSION_ID: Optional[str] = None

    # Resend Email Settings
    RESEND_API_KEY: Optional[str] = os.getenv("RESEND_API_KEY", None)
    RESEND_FROM_EMAIL: str = os.getenv("RESEND_FROM_EMAIL", "Krenox <verify@wisedev.online>")

    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://krenox.vercel.app")
    PORT: int = 8000

    class Config:
        env_file = ENV_PATH if os.path.exists(ENV_PATH) else ".env"
        extra = "ignore"

settings = Settings()
