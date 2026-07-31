"""PDF medical-report generation with ReportLab."""

from __future__ import annotations

import io
from datetime import UTC, datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.schemas.common import DISCLAIMER


def build_report_pdf(
    *,
    user_name: str,
    title: str,
    symptoms: str,
    conversation_text: str,
    possible_conditions: list[dict[str, Any]],
    recommendations: str,
    urgency: str | None = None,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.7 * inch, bottomMargin=0.7 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleCustom", parent=styles["Heading1"], textColor=colors.HexColor("#0EA5E9"), spaceAfter=8)
    heading = ParagraphStyle("HeadingCustom", parent=styles["Heading2"], fontSize=13, textColor=colors.HexColor("#0F172A"), spaceBefore=12, spaceAfter=6)
    body = ParagraphStyle("BodyCustom", parent=styles["BodyText"], leading=14, spaceAfter=6)
    small = ParagraphStyle("SmallCustom", parent=styles["BodyText"], fontSize=9, textColor=colors.HexColor("#64748B"), leading=12)

    story: list[Any] = []
    story.append(Paragraph("MediAssist AI Medical Report", title_style))
    story.append(Paragraph("Educational summary — not a medical diagnosis", small))
    story.append(Spacer(1, 8))

    meta = [
        ["Patient / user", user_name],
        ["Report title", title],
        ["Generated", datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")],
        ["Urgency estimate", urgency or "Not specified"],
    ]
    table = Table(meta, colWidths=[1.7 * inch, 4.5 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F0F9FF")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#BAE6FD")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)

    story.append(Paragraph("Symptoms / concern", heading))
    story.append(Paragraph((symptoms or "Not provided").replace("\n", "<br/>"), body))

    story.append(Paragraph("Conversation summary", heading))
    story.append(Paragraph((conversation_text or "No conversation attached.").replace("\n", "<br/>"), body))

    story.append(Paragraph("Possible conditions (educational estimates)", heading))
    if possible_conditions:
        for item in possible_conditions:
            name = item.get("name") or "Possible condition"
            confidence = item.get("confidence")
            description = item.get("description") or ""
            conf_text = f" ({round(float(confidence))}%)" if confidence is not None else ""
            story.append(Paragraph(f"• <b>{name}</b>{conf_text}<br/>{description}", body))
    else:
        story.append(Paragraph("No condition estimates were recorded for this report.", body))

    story.append(Paragraph("Recommendations", heading))
    story.append(Paragraph((recommendations or "Discuss findings with a qualified clinician.").replace("\n", "<br/>"), body))

    story.append(Paragraph("Disclaimer", heading))
    story.append(Paragraph(DISCLAIMER, small))

    doc.build(story)
    return buffer.getvalue()
