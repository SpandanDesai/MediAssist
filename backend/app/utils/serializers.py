"""Document serialization helpers shared by API routes."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.schemas.common import ConsultationResult, ConversationSummary, MessageOut, PossibleCondition, UserOut


def _iso(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value or "")


def serialize_user(document: dict[str, Any]) -> UserOut:
    return UserOut(
        id=str(document.get("_id") or document.get("id")),
        name=str(document.get("name") or document.get("full_name") or "MediAssist user"),
        email=str(document.get("email") or ""),
        age=document.get("age"),
        gender=document.get("gender"),
        blood_group=document.get("blood_group"),
        allergies=document.get("allergies"),
        medical_history=document.get("medical_history"),
        chronic_diseases=document.get("chronic_diseases"),
        current_medications=document.get("current_medications"),
        emergency_contact=document.get("emergency_contact"),
    )


def profile_context(document: dict[str, Any]) -> str:
    parts = []
    for label, key in [
        ("Age", "age"),
        ("Gender", "gender"),
        ("Blood group", "blood_group"),
        ("Allergies", "allergies"),
        ("Medical history", "medical_history"),
        ("Chronic diseases", "chronic_diseases"),
        ("Current medications", "current_medications"),
    ]:
        value = document.get(key)
        if value:
            parts.append(f"{label}: {value}")
    return "\n".join(parts)


def serialize_consultation(result: ConsultationResult) -> dict[str, Any]:
    return result.model_dump()


def serialize_message(message: dict[str, Any]) -> MessageOut:
    analysis = None
    raw = message.get("analysis")
    if isinstance(raw, dict):
        conditions: list[PossibleCondition] = []
        for item in raw.get("possible_conditions") or []:
            if isinstance(item, dict) and item.get("name"):
                confidence = item.get("confidence")
                try:
                    confidence_val = float(confidence) if confidence is not None else None
                except (TypeError, ValueError):
                    confidence_val = None
                conditions.append(
                    PossibleCondition(
                        name=str(item["name"]),
                        confidence=confidence_val,
                        description=str(item["description"]) if item.get("description") else None,
                    )
                )
        urgency = str(raw.get("urgency") or "low").lower()
        if urgency not in {"low", "medium", "high", "emergency"}:
            urgency = "low"
        analysis = ConsultationResult(
            response=str(raw.get("response") or message.get("content") or ""),
            possible_conditions=conditions,
            urgency=urgency,  # type: ignore[arg-type]
            recommendation=str(raw["recommendation"]) if raw.get("recommendation") else None,
            follow_up_questions=[str(q) for q in (raw.get("follow_up_questions") or []) if q],
            disclaimer=str(raw["disclaimer"]) if raw.get("disclaimer") else None,
            emergency=bool(raw.get("emergency")),
            conversation_id=str(raw["conversation_id"]) if raw.get("conversation_id") else None,
        )
    return MessageOut(
        id=str(message.get("id") or message.get("_id") or ""),
        role="assistant" if message.get("role") == "assistant" else "user",
        content=str(message.get("content") or ""),
        created_at=_iso(message.get("created_at")),
        analysis=analysis,
    )


def serialize_conversation(document: dict[str, Any], *, include_messages: bool = False) -> ConversationSummary:
    messages = None
    if include_messages:
        messages = [serialize_message(item) for item in document.get("messages") or []]
    return ConversationSummary(
        id=str(document.get("_id") or document.get("id")),
        title=str(document.get("title") or "Health consultation"),
        preview=document.get("preview"),
        updated_at=_iso(document.get("updated_at") or document.get("created_at")),
        messages=messages,
    )
