"""Aggregate, PHI-free operational metrics for operators/monitoring."""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, status

from app.core.config import get_settings
from app.db.database import database
from app.services import metrics as metrics_service

router = APIRouter(tags=["metrics"])


@router.get("/metrics")
async def metrics(x_metrics_key: str | None = Header(default=None)) -> dict[str, object]:
    """Return process counters plus runtime flags.

    Contains no user data — only aggregate operational counts. Disabled when
    ``ENABLE_METRICS`` is false so it can be turned off in shared environments.
    """
    settings = get_settings()
    if not settings.enable_metrics:
        return {"enabled": False}
    if settings.metrics_api_key and x_metrics_key != settings.metrics_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Metrics authentication required.")
    data = metrics_service.snapshot()
    return {
        "enabled": True,
        "storage": "memory" if database.using_memory else "mongodb",
        "gemini_configured": bool(settings.gemini_api_key),
        "counters": data,
    }
