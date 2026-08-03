"""Configuration loaded from environment variables and an optional .env file."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings. Secrets are intentionally supplied only via environment."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "MediAssist AI API"
    environment: str = "development"
    api_prefix: str = "/api"
    secret_key: str = "development-only-change-this-secret-before-deploying"
    access_token_expire_minutes: int = Field(default=60 * 24 * 7, ge=5, le=60 * 24 * 365)
    frontend_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    mongodb_uri: str | None = None
    mongodb_database: str = "mediassist"

    # Dr. Homie–compatible Gemini agent (used for chat, voice, and image analysis)
    gemini_api_key: str | None = None
    gemini_tts_model: str = "models/gemini-2.5-flash-preview-tts"
    gemini_tts_voice: str = "Kore"

    # Legacy OpenAI settings kept for compatibility; AI features now use Gemini.
    openai_api_key: str | None = None
    openai_chat_model: str = "gpt-4.1-mini"
    openai_vision_model: str = "gpt-4.1-mini"
    openai_transcription_model: str = "gpt-4o-mini-transcribe"
    openai_tts_model: str = "gpt-4o-mini-tts"
    openai_tts_voice: str = "alloy"

    overpass_url: str = "https://overpass-api.de/api/interpreter"
    max_upload_size_bytes: int = Field(default=10 * 1024 * 1024, ge=1024 * 1024, le=25 * 1024 * 1024)
    hospital_cache_ttl_seconds: int = Field(default=300, ge=30, le=3600)

    @property
    def cors_origins(self) -> list[str]:
        """Return a trimmed list, allowing production deployments to set one env var."""

        return [origin.strip().rstrip("/") for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
