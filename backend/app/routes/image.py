"""Medical image analysis routes."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, File, Form, Request, UploadFile

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.chat import ImageAnalysisResult
from app.services.ai_service import consult_image
from app.services.rate_limit import client_key, upload_limiter
from app.services.validation import validate_image_upload

router = APIRouter(tags=["image"])


@router.post("/image", response_model=ImageAnalysisResult)
async def analyze_image(
    request: Request,
    user: CurrentUser,
    image: UploadFile = File(...),
    notes: str | None = Form(default=None),
) -> ImageAnalysisResult:
    upload_limiter.check(client_key(request, str(user["_id"])))
    image_bytes, mime_type = await validate_image_upload(image)
    result = await consult_image(image_bytes, mime_type, notes=notes)

    now = datetime.now(UTC)
    title = "Image analysis"
    preview = (notes or result.description or "Medical image consultation")[:180]
    await database.insert_one(
        "images",
        {
            "user_id": str(user["_id"]),
            "filename": image.filename,
            "content_type": mime_type,
            "notes": notes,
            "analysis": result.model_dump(),
            "created_at": now,
        },
    )
    created = await database.insert_one(
        "conversations",
        {
            "user_id": str(user["_id"]),
            "title": title,
            "preview": preview,
            "modality": "image",
            "messages": [
                {
                    "id": str(uuid4()),
                    "role": "user",
                    "content": notes or "Uploaded a medical image for educational analysis.",
                    "created_at": now,
                },
                {
                    "id": str(uuid4()),
                    "role": "assistant",
                    "content": result.response,
                    "created_at": now,
                    "analysis": result.model_dump(),
                },
            ],
            "updated_at": now,
        },
    )
    result.conversation_id = str(created["_id"])
    return result
