from pathlib import Path

ROOT = Path(r"c:\Users\Spandan\Documents\GitHub\MediAssist")

# ========== chat.py schema: lat/lng ==========
chat_schema = ROOT / "backend/app/schemas/chat.py"
text = chat_schema.read_text(encoding="utf-8")
old = '''class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: str | None = None
    context: str | None = Field(default=None, max_length=4000)'''
new = '''class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: str | None = None
    context: str | None = Field(default=None, max_length=4000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)'''
if old not in text:
    raise SystemExit("ChatRequest pattern missing")
chat_schema.write_text(text.replace(old, new), encoding="utf-8")

old_ar = '''class AssessmentResult(BaseModel):
    risk_score: int = Field(ge=0, le=100)
    risk_level: str
    suggestions: list[str]
    preventive_tips: list[str]
    disclaimer: str'''
new_ar = '''class AssessmentResult(BaseModel):
    id: str | None = None
    risk_score: int = Field(ge=0, le=100)
    risk_level: str
    suggestions: list[str]
    preventive_tips: list[str]
    disclaimer: str
    created_at: str | None = None
    chat_prompts: list[str] = Field(default_factory=list)'''
text = chat_schema.read_text(encoding="utf-8")
if old_ar not in text:
    raise SystemExit("AssessmentResult pattern missing")
chat_schema.write_text(text.replace(old_ar, new_ar), encoding="utf-8")
print("OK chat schema")

# ========== assessment route persistence ==========
(ROOT / "backend/app/routes/assessment.py").write_text('''"""Lifestyle health risk assessment routes."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.chat import AssessmentRequest, AssessmentResult
from app.services.rules_engine import assess_lifestyle

router = APIRouter(tags=["assessment"])


def _chat_prompts_for(result: AssessmentResult) -> list[str]:
    prompts: list[str] = []
    for suggestion in result.suggestions[:3]:
        prompts.append(f"I want help acting on this: {suggestion}")
    if result.risk_level in {"elevated", "high"}:
        prompts.append("My lifestyle risk score came back elevated — what should I prioritize first?")
    if not prompts:
        prompts.append("Help me keep up healthy habits based on my recent check-in.")
    return prompts


@router.post("/assessment", response_model=AssessmentResult)
async def run_assessment(payload: AssessmentRequest, user: CurrentUser) -> AssessmentResult:
    result = assess_lifestyle(payload)
    result.chat_prompts = _chat_prompts_for(result)
    now = datetime.now(UTC)
    stored = await database.insert_one(
        "assessments",
        {
            "user_id": str(user["_id"]),
            "inputs": payload.model_dump(),
            "risk_score": result.risk_score,
            "risk_level": result.risk_level,
            "suggestions": result.suggestions,
            "preventive_tips": result.preventive_tips,
            "chat_prompts": result.chat_prompts,
            "disclaimer": result.disclaimer,
            "created_at": now,
        },
    )
    result.id = str(stored["_id"])
    result.created_at = now.isoformat()
    return result


@router.get("/assessment/history", response_model=list[AssessmentResult])
async def assessment_history(user: CurrentUser) -> list[AssessmentResult]:
    rows = await database.find_many(
        "assessments",
        {"user_id": str(user["_id"])},
        sort=[("created_at", -1)],
        limit=12,
    )
    out: list[AssessmentResult] = []
    for row in rows:
        created = row.get("created_at")
        out.append(
            AssessmentResult(
                id=str(row["_id"]),
                risk_score=int(row.get("risk_score") or 0),
                risk_level=str(row.get("risk_level") or "moderate"),
                suggestions=list(row.get("suggestions") or []),
                preventive_tips=list(row.get("preventive_tips") or []),
                disclaimer=str(row.get("disclaimer") or ""),
                created_at=created.isoformat() if hasattr(created, "isoformat") else str(created or ""),
                chat_prompts=list(row.get("chat_prompts") or []),
            )
        )
    return out
''', encoding="utf-8")
print("OK assessment routes")

# ========== chat route: context + location ==========
(ROOT / "backend/app/routes/chat.py").write_text('''"""Text consultation routes."""

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
    merged_context = "\\n\\n".join(ctx_parts) if ctx_parts else None

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
''', encoding="utf-8")
print("OK chat route")
