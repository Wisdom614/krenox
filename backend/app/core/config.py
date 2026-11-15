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
    # Comma-separated exact origins. Never use a wildcard with credentials.
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,https://krenox.vercel.app")
    PORT: int = 8000

    class Config:
        env_file = ENV_PATH if os.path.exists(ENV_PATH) else ".env"
        extra = "ignore"

    @property
    def cors_origins(self) -> list[str]:
        origins = {origin.strip().rstrip("/") for origin in self.CORS_ORIGINS.split(",") if origin.strip()}
        origins.add(self.FRONTEND_URL.strip().rstrip("/"))
        return sorted(origins)

settings = Settings()
