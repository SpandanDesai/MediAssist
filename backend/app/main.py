"""MediAssist FastAPI application entrypoint."""

from __future__ import annotations

import json
import logging
import time
from contextlib import asynccontextmanager
from contextvars import ContextVar
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.db.database import database
from app.routes import (
    assessment,
    auth,
    chat,
    health,
    history,
    hospitals,
    image,
    medication,
    metrics,
    ml_assessment,
    profile,
    reminders,
    reports,
    stats,
    voice,
)
from app.services import metrics as metrics_service

# Correlates every log line from a single request; set by the middleware below.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

logger = logging.getLogger("mediassist")


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


class _JsonFormatter(logging.Formatter):
    """One JSON object per line so logs are machine-parseable in production."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def _configure_logging() -> None:
    root = logging.getLogger()
    if root.handlers and getattr(root.handlers[0], "_mediassist_json", False):
        return  # already configured (e.g. reload workers re-import)
    handler = logging.StreamHandler()
    handler.setFormatter(_JsonFormatter())
    handler.addFilter(_RequestIdFilter())
    handler._mediassist_json = True  # type: ignore[attr-defined]
    root.handlers = [handler]
    root.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    _configure_logging()
    settings = get_settings()
    await database.connect()
    logger.info(
        "MediAssist API ready (storage=%s, gemini=%s)",
        "memory" if database.using_memory else "mongodb",
        "yes" if settings.gemini_api_key else "fallback-rules",
    )
    yield
    await database.disconnect()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="1.1.0",
        description="Educational multimodal healthcare assistant API. Not a medical diagnosis service.",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        # Expose the pagination/report headers so the cross-origin SPA can read them.
        expose_headers=["Content-Disposition", "X-Has-More", "X-Oldest-Seq", "X-Report-Id", "X-Request-ID"],
    )

    @application.middleware("http")
    async def request_context(request: Request, call_next):
        """Attach a request id for log correlation and record traffic/latency metrics."""
        request_id = request.headers.get("X-Request-ID") or uuid4().hex
        token = request_id_ctx.set(request_id)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            request_id_ctx.reset(token)
        if settings.enable_metrics:
            metrics_service.increment("http_requests_total")
            if response.status_code >= 500:
                metrics_service.increment("http_5xx_total")
            if elapsed_ms >= 1000:
                metrics_service.increment("http_slow_total")
        response.headers["X-Request-ID"] = request_id
        return response

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
        """Return a consistent JSON envelope for unexpected server-side failures.

        HTTPException (and other FastAPI handlers) still take precedence, so this
        only catches genuine bugs. Details are logged, never exposed to clients.
        """
        logger.exception("Unhandled server error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected error occurred. Please try again."},
        )

    prefix = settings.api_prefix
    application.include_router(health.router, prefix=prefix)
    application.include_router(auth.router, prefix=prefix)
    application.include_router(profile.router, prefix=prefix)
    application.include_router(chat.router, prefix=prefix)
    application.include_router(voice.router, prefix=prefix)
    application.include_router(image.router, prefix=prefix)
    application.include_router(history.router, prefix=prefix)
    application.include_router(hospitals.router, prefix=prefix)
    application.include_router(reports.router, prefix=prefix)
    application.include_router(assessment.router, prefix=prefix)
    application.include_router(medication.router, prefix=prefix)
    application.include_router(stats.router, prefix=prefix)
    application.include_router(reminders.router, prefix=prefix)
    application.include_router(metrics.router, prefix=prefix)
    application.include_router(ml_assessment.router, prefix=prefix)

    @application.get("/")
    async def root() -> dict[str, str]:
        return {
            "message": "MediAssist AI API",
            "docs": "/docs",
            "health": f"{prefix}/health",
        }

    return application


app = create_app()
