"""MediAssist FastAPI application entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.database import database
from app.routes import assessment, auth, chat, health, history, hospitals, image, profile, reports, voice

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mediassist")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    await database.connect()
    logger.info(
        "MediAssist API ready (storage=%s, openai=%s)",
        "memory" if database.using_memory else "mongodb",
        "yes" if settings.openai_api_key else "fallback-rules",
    )
    yield
    await database.disconnect()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="Educational multimodal healthcare assistant API. Not a medical diagnosis service.",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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

    @application.get("/")
    async def root() -> dict[str, str]:
        return {
            "message": "MediAssist AI API",
            "docs": "/docs",
            "health": f"{prefix}/health",
        }

    return application


app = create_app()
