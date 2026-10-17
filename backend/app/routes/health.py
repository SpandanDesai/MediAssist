"""Health and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.core.config import get_settings
from app.db.database import database

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
        "storage": "memory" if database.using_memory else "mongodb",
        "ai_provider": "gemini" if bool(settings.gemini_api_key) else "rules-engine-fallback",
        "gemini_configured": bool(settings.gemini_api_key),
        "mongodb_error": database.connection_error,
    }


@router.get("/ready")
async def ready(response: Response) -> dict:
    """Readiness: fails when production is configured without a real secret or database."""
    settings = get_settings()
    problems: list[str] = []
    if settings.is_production:
        if settings.secret_key.startswith("development-only") or len(settings.secret_key) < 32:
            problems.append("SECRET_KEY is weak or default")
        if database.using_memory:
            problems.append("MongoDB not connected")
        if not settings.cors_origins:
            problems.append("FRONTEND_ORIGINS is empty")
    if problems:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"ready": False, "problems": problems}
    return {"ready": True, "problems": []}
