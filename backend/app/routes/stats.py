"""Read-only aggregated health trends for the user dashboard."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.stats import HealthStats, HighRiskConversation, RiskTrendPoint

router = APIRouter(tags=["stats"])

_VALID_URGENCY = {"low", "medium", "high", "emergency"}


def _iso(value: object) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value or "")


@router.get("/stats", response_model=HealthStats)
async def health_stats(
    user: CurrentUser,
    window: int = Query(default=100, ge=10, le=500),
) -> HealthStats:
    user_id = str(user["_id"])

    conversations = await database.find_many(
        "conversations", {"user_id": user_id}, sort=[("updated_at", -1)], limit=window
    )
    reports = await database.find_many("reports", {"user_id": user_id}, limit=window)
    assessments = await database.find_many(
        "assessments", {"user_id": user_id}, sort=[("created_at", -1)], limit=window
    )
    images = await database.find_many("images", {"user_id": user_id}, limit=window)

    modality: dict[str, int] = {}
    urgency: dict[str, int] = {}
    recent_high_risk: list[HighRiskConversation] = []
    for conversation in conversations:
        key = str(conversation.get("modality") or "chat")
        modality[key] = modality.get(key, 0) + 1
        # last_urgency is denormalized onto the conversation when a turn is stored.
        detected = str(conversation.get("last_urgency") or "").lower()
        if detected in _VALID_URGENCY:
            urgency[detected] = urgency.get(detected, 0) + 1
        if detected in {"high", "emergency"} and len(recent_high_risk) < 5:
            recent_high_risk.append(
                HighRiskConversation(
                    id=str(conversation.get("_id") or conversation.get("id")),
                    title=str(conversation.get("title") or "Health consultation"),
                    urgency=detected,
                    updated_at=_iso(conversation.get("updated_at") or conversation.get("created_at")),
                )
            )

    trend = [
        RiskTrendPoint(
            created_at=_iso(row.get("created_at")),
            risk_score=int(row.get("risk_score") or 0),
            risk_level=str(row.get("risk_level") or "moderate"),
        )
        for row in reversed(assessments)
    ]

    return HealthStats(
        counts={
            "conversations": len(conversations),
            "reports": len(reports),
            "assessments": len(assessments),
            "images": len(images),
        },
        conversations_by_modality=modality,
        urgency_distribution=urgency,
        assessment_trend=trend,
        recent_high_risk=recent_high_risk,
        window=window,
    )
