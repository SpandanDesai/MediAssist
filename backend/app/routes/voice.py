"""Voice consultation routes."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, File, Form, Request, UploadFile

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.chat import VoiceResponse
from app.services.ai_service import consult_voice
from app.services.conversations import append_messages, get_history
from app.services.rate_limit import client_key, upload_limiter
from app.services.validation import validate_audio_upload
from app.utils.serializers import profile_context

router = APIRouter(tags=["voice"])


@router.post("/voice", response_model=VoiceResponse)
async def voice_consultation(
    request: Request,
    user: CurrentUser,
    audio: UploadFile = File(...),
    conversation_id: str | None = Form(default=None),
) -> VoiceResponse:
    upload_limiter.check(client_key(request, str(user["_id"])))
    audio_bytes, filename = await validate_audio_upload(audio)

    history: list[dict[str, str]] = []
    conversation = None
    if conversation_id:
        conversation = await database.find_one(
            "conversations",
            {"_id": conversation_id, "user_id": str(user["_id"])},
        )
        if conversation:
            history = await get_history(str(conversation["_id"]), str(user["_id"]), n=12)

    result = await consult_voice(
        audio_bytes,
        filename,
        conversation_id=conversation_id,
        history=history,
        profile_context=profile_context(user),
    )

    now = datetime.now(UTC)
    transcript = result.transcript or "Voice message"
    user_message = {"id": str(uuid4()), "role": "user", "content": transcript, "created_at": now}
    assistant_message = {
        "id": str(uuid4()),
        "role": "assistant",
        "content": result.response,
        "created_at": now,
        "analysis": result.model_dump(exclude={"audio_url"}),
    }

    if conversation:
        conversation_id_out = str(conversation["_id"])
        await database.update_one(
            "conversations",
            {"_id": conversation_id_out},
            {"preview": transcript[:180], "modality": "voice"},
        )
    else:
        created = await database.insert_one(
            "conversations",
            {
                "user_id": str(user["_id"]),
                "title": (transcript[:72] + "…") if len(transcript) > 72 else transcript,
                "preview": transcript[:180],
                "modality": "voice",
                "message_count": 0,
                "updated_at": now,
            },
        )
        conversation_id_out = str(created["_id"])

    await append_messages(conversation_id_out, str(user["_id"]), [user_message, assistant_message])
    result.conversation_id = conversation_id_out
    return result
