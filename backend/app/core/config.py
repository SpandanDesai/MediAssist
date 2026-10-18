"""Configuration loaded from environment variables and an optional .env file."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
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

    # Session cookie issued on login/signup. Kept httpOnly so browser JavaScript on
    # the frontend cannot read the token; the Authorization header is still accepted
    # for API clients and automated tests.
    auth_cookie_name: str = "access_token"
    auth_cookie_samesite: str = "lax"
    auth_cookie_secure: bool = False

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

    # Outbound-call resilience. A single Gemini request gets ``gemini_request_timeout``
    # seconds and the whole model-failover loop is bounded by ``gemini_overall_timeout``
    # so a slow provider can never make a consultation hang across every candidate model.
    gemini_request_timeout_seconds: float = Field(default=45.0, ge=5.0, le=180.0)
    gemini_overall_timeout_seconds: float = Field(default=110.0, ge=10.0, le=600.0)
    gemini_max_retries: int = Field(default=2, ge=0, le=5)
    # Overpass is best-effort for emergency facility lookups; keep it quick and back off
    # from a recently-failing endpoint instead of paying the full timeout every time.
    overpass_timeout_seconds: float = Field(default=12.0, ge=3.0, le=60.0)
    overpass_circuit_cooldown_seconds: int = Field(default=60, ge=0, le=600)

    # When True, rate limiting may use the X-Forwarded-For header. Enable only when
    # the API sits behind a trusted reverse proxy that overwrites this header;
    # otherwise clients could spoof it to evade limits.
    trust_proxy: bool = False

    # Upper bound on turns stored per conversation (in the messages collection). Older
    # turns are trimmed so very long threads stay bounded; the most recent are kept.
    max_conversation_messages: int = Field(default=400, ge=20, le=2000)

    # Lifetime of a signed, account-free report share link (minutes).
    report_share_expire_minutes: int = Field(default=60 * 24 * 7, ge=5, le=60 * 24 * 90)

    # Expose an aggregate, PHI-free ``/metrics`` counter snapshot for operators.
    # Only non-sensitive counts (requests, latency buckets, fallbacks) are emitted.
    enable_metrics: bool = True

    @model_validator(mode="after")
    def _guard_production(self) -> "Settings":
        if self.is_production and self.secret_key.startswith("development-only"):
            raise ValueError("SECRET_KEY must be set in production.")
        return self

    @property
    def cors_origins(self) -> list[str]:
        """Return a trimmed list, allowing production deployments to set one env var."""

        return [origin.strip().rstrip("/") for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cookie_secure(self) -> bool:
        """Cookies are always Secure in production, even if not explicitly set."""
        return self.auth_cookie_secure or self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()
