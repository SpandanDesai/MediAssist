"""Medical report generation and download routes."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Response, status

from app.db.database import database
from app.deps import CurrentUser
from app.schemas.chat import ReportRequest, ReportSummary
from app.schemas.common import DISCLAIMER
from app.services.pdf_report import build_report_pdf

router = APIRouter(tags=["reports"])


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
            created_at=str(item.get("created_at")),
            conversation_id=item.get("conversation_id"),
        )
        for item in reports
    ]


@router.post("/reports")
async def create_report(payload: ReportRequest, user: CurrentUser) -> Response:
    conversation = None
    symptoms = payload.symptoms or ""
    conversation_text = ""
    recommendations = payload.recommendations or ""
    conditions = [item.model_dump() for item in payload.possible_conditions]
    urgency = None
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

    pdf_bytes = build_report_pdf(
        user_name=str(user.get("name") or "MediAssist user"),
        title=title,
        symptoms=symptoms or "Not specified",
        conversation_text=conversation_text or symptoms or "No conversation attached.",
        possible_conditions=conditions,
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
            "possible_conditions": conditions,
            "recommendations": recommendations,
            "disclaimer": DISCLAIMER,
            "pdf": pdf_bytes,
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
    pdf = report.get("pdf")
    if pdf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file is unavailable.")
    if not isinstance(pdf, (bytes, bytearray)):
        pdf = bytes(pdf)
    headers = {"Content-Disposition": f'attachment; filename="mediassist-report-{report_id}.pdf"'}
    return Response(content=pdf, media_type="application/pdf", headers=headers)
