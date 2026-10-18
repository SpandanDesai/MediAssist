"""Text consultation routes."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Request

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.chat import ChatRequest
from app.schemas.common import ConsultationResult
from app.services.ai_service import consult_text
from app.services.conversations import append_messages, get_history
from app.services.emergency import enrich_emergency_with_location
from app.services.rate_limit import client_key, consultation_limiter
from app.utils.serializers import profile_context

router = APIRouter(tags=["chat"])


def _title_from_message(message: str) -> str:
    cleaned = " ".join(message.strip().split())
    return (cleaned[:72] + "…") if len(cleaned) > 72 else cleaned or "Health consultation"


@router.post("/chat", response_model=ConsultationResult)
async def chat(payload: ChatRequest, request: Request, user: CurrentUser) -> ConsultationResult:
    consultation_limiter.check(client_key(request, str(user["_id"])))
    conversation = None
    history: list[dict[str, str]] = []

    if payload.conversation_id:
        conversation = await database.find_one(
            "conversations",
            {"_id": payload.conversation_id, "user_id": str(user["_id"])},
        )
        if conversation:
            history = await get_history(str(conversation["_id"]), str(user["_id"]), n=12)

    # Optional client-supplied context is appended to the profile block, never trusted as instructions.
    profile = profile_context(user)
    if payload.context:
        extra = f"Additional context from the user: {payload.context.strip()}"
        profile = f"{profile}\n{extra}".strip() if profile else extra
    merged_context = profile or None

    result = await consult_text(
        payload.message,
        conversation_id=payload.conversation_id,
        history=history,
        profile_context=merged_context,
    )
    if result.emergency:
        result = await enrich_emergency_with_location(
            result,
            latitude=payload.latitude,
            longitude=payload.longitude,
        )

    now = datetime.now(UTC)
    user_message = {"id": str(uuid4()), "role": "user", "content": payload.message, "created_at": now}
    assistant_message = {
        "id": str(uuid4()),
        "role": "assistant",
        "content": result.response,
        "created_at": now,
        "analysis": result.model_dump(),
    }

    if conversation:
        conversation_id = str(conversation["_id"])
        await database.update_one(
            "conversations",
            {"_id": conversation_id},
            {
                "preview": payload.message[:180],
                "title": conversation.get("title") or _title_from_message(payload.message),
            },
        )
    else:
        created = await database.insert_one(
            "conversations",
            {
                "user_id": str(user["_id"]),
                "title": _title_from_message(payload.message),
                "preview": payload.message[:180],
                "modality": "chat",
                "message_count": 0,
                "updated_at": now,
            },
        )
        conversation_id = str(created["_id"])

    await append_messages(conversation_id, str(user["_id"]), [user_message, assistant_message])

    result.conversation_id = conversation_id
    return result
