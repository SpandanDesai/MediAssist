"""Medical report generation and download routes."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.chat import ReportRequest, ReportSummary
from app.schemas.common import DISCLAIMER
from app.services.pdf_report import build_report_pdf

router = APIRouter(tags=["reports"])


def _iso(value: object) -> str:
    return value.isoformat() if isinstance(value, datetime) else str(value or "")


def _render(
    user: dict,
    *,
    title: str,
    symptoms: str,
    conversation_text: str,
    conditions: list[dict[str, Any]],
    recommendations: str,
    urgency: str | None,
) -> bytes:
    return build_report_pdf(
        user_name=str(user.get("name") or "MediAssist user"),
        user_age=user.get("age"),
        user_gender=user.get("gender"),
        user_allergies=user.get("allergies"),
        user_medications=user.get("current_medications"),
        title=title,
        symptoms=symptoms or "Not specified",
        conversation_text=conversation_text or symptoms or "No conversation attached.",
        possible_conditions=conditions,
        recommendations=recommendations,
        urgency=urgency,
    )


@router.get("/reports", response_model=list[ReportSummary])
async def list_reports(user: CurrentUser) -> list[ReportSummary]:
    reports = await database.find_many(
        "reports",
        {"user_id": str(user["_id"])},
        sort=[("created_at", -1)],
        limit=50,
    )
    return [
        ReportSummary(
            id=str(item["_id"]),
            title=str(item.get("title") or "Medical report"),
            created_at=_iso(item.get("created_at")),
            conversation_id=item.get("conversation_id"),
        )
        for item in reports
    ]


@router.post("/reports")
async def create_report(payload: ReportRequest, user: CurrentUser) -> Response:
    symptoms = payload.symptoms or ""
    conversation_text = ""
    recommendations = payload.recommendations or ""
    conditions = [item.model_dump() for item in payload.possible_conditions]
    urgency: str | None = None
    title = payload.title or "MediAssist consultation report"

    if payload.conversation_id:
        conversation = await database.find_one(
            "conversations",
            {"_id": payload.conversation_id, "user_id": str(user["_id"])},
        )
        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
        title = payload.title or str(conversation.get("title") or title)
        lines = []
        for message in conversation.get("messages") or []:
            role = "You" if message.get("role") == "user" else "MediAssist"
            lines.append(f"{role}: {message.get('content')}")
            if message.get("role") == "user" and not symptoms:
                symptoms = str(message.get("content") or "")
            analysis = message.get("analysis") or {}
            if message.get("role") == "assistant" and analysis:
                if not conditions:
                    conditions = list(analysis.get("possible_conditions") or [])
                if not recommendations:
                    recommendations = str(analysis.get("recommendation") or "")
                urgency = analysis.get("urgency")
        conversation_text = "\n\n".join(lines)

    if not recommendations:
        recommendations = "Discuss these educational findings with a qualified clinician. Seek urgent care for severe or worsening symptoms."

    pdf_bytes = _render(
        user,
        title=title,
        symptoms=symptoms,
        conversation_text=conversation_text,
        conditions=conditions,
        recommendations=recommendations,
        urgency=urgency,
    )

    document = await database.insert_one(
        "reports",
        {
            "user_id": str(user["_id"]),
            "conversation_id": payload.conversation_id,
            "title": title,
            "symptoms": symptoms,
            "conversation_text": conversation_text,
            "possible_conditions": conditions,
            "recommendations": recommendations,
            "urgency": urgency,
            "disclaimer": DISCLAIMER,
            "created_at": datetime.now(UTC),
        },
    )

    headers = {
        "Content-Disposition": f'attachment; filename="mediassist-report-{document["_id"]}.pdf"',
        "X-Report-Id": str(document["_id"]),
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.get("/reports/{report_id}/download")
async def download_report(report_id: str, user: CurrentUser) -> Response:
    report = await database.find_one("reports", {"_id": report_id, "user_id": str(user["_id"])})
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    # Legacy reports stored the PDF bytes; serve them unchanged.
    legacy_pdf = report.get("pdf")
    if legacy_pdf is not None:
        pdf_bytes = bytes(legacy_pdf) if not isinstance(legacy_pdf, (bytes, bytearray)) else bytes(legacy_pdf)
    else:
        pdf_bytes = _render(
            user,
            title=str(report.get("title") or "Medical report"),
            symptoms=str(report.get("symptoms") or ""),
            conversation_text=str(report.get("conversation_text") or ""),
            conditions=list(report.get("possible_conditions") or []),
            recommendations=str(report.get("recommendations") or ""),
            urgency=report.get("urgency"),
        )

    headers = {"Content-Disposition": f'attachment; filename="mediassist-report-{report_id}.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
