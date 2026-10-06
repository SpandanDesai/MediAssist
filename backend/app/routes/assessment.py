"""Lifestyle health risk assessment routes."""

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
