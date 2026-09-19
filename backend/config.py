from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    firebase_service_account_path: Optional[str] = None
    firebase_service_account_json: Optional[str] = None  # base64 JSON for cloud

    gemini_api_key: Optional[str] = None

    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_from_number: Optional[str] = None

    cors_origins: str = "http://localhost:8443,http://localhost:5173"
    app_env: str = "development"
    app_port: int = 8000

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def twilio_configured(self) -> bool:
        return bool(self.twilio_account_sid and self.twilio_auth_token and self.twilio_from_number)

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)

settings = Settings()
