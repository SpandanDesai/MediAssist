"""Health and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter

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
        "gemini_configured": bool(settings.gemini_api_key),
        "openai_configured": bool(settings.openai_api_key),
        "mongodb_error": database.connection_error,
    }
