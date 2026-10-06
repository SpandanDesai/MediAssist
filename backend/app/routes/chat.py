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
            for item in conversation.get("messages") or []:
                if item.get("role") in {"user", "assistant"} and item.get("content"):
                    history.append({"role": item["role"], "content": item["content"]})

    # Merge optional client context into profile context for richer grounding.
    ctx_parts = [part for part in (profile_context(user), payload.context) if part]
    merged_context = chr(10).join(ctx_parts) if ctx_parts else None

    result = await consult_text(
        payload.message,
        conversation_id=payload.conversation_id,
        history=history[-12:],
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
        messages = list(conversation.get("messages") or [])
        messages.extend([user_message, assistant_message])
        updated = await database.update_one(
            "conversations",
            {"_id": conversation["_id"]},
            {
                "messages": messages,
                "preview": payload.message[:180],
                "title": conversation.get("title") or _title_from_message(payload.message),
            },
        )
        conversation_id = str((updated or conversation)["_id"])
    else:
        created = await database.insert_one(
            "conversations",
            {
                "user_id": str(user["_id"]),
                "title": _title_from_message(payload.message),
                "preview": payload.message[:180],
                "modality": "chat",
                "messages": [user_message, assistant_message],
                "updated_at": now,
            },
        )
        conversation_id = str(created["_id"])

    result.conversation_id = conversation_id
    return result
