"""Deterministic emergency phrase detection before model processing."""

from __future__ import annotations

import re

from app.schemas.common import DISCLAIMER, ConsultationResult, PossibleCondition

EMERGENCY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("chest pain / cardiac concern", re.compile(r"\b(chest pain|heart attack|crushing (chest|pain)|pain radiating to (arm|jaw))\b", re.I)),
    ("breathing difficulty", re.compile(r"\b(difficulty breathing|short(ness)? of breath|cannot breathe|can't breathe|not breathing|choking)\b", re.I)),
    ("stroke symptoms", re.compile(r"\b(stroke|face droop|facial droop|sudden (weakness|numbness|confusion|slurred speech)|arm weakness|can't speak|cannot speak)\b", re.I)),
    ("severe bleeding", re.compile(r"\b(severe bleeding|bleeding heavily|uncontrolled bleeding|blood gushing)\b", re.I)),
    ("loss of consciousness", re.compile(r"\b(unconscious|loss of consciousness|passed out|unresponsive|fainted and (not|won't) wake)\b", re.I)),
    ("suicidal ideation", re.compile(r"\b(suicid(e|al)|kill myself|end my life|want to die|self[- ]harm)\b", re.I)),
    ("infant high fever", re.compile(r"\b(high fever).{0,40}\b(infant|baby|newborn|months? old)\b|\b(infant|baby|newborn).{0,40}\b(high fever)\b", re.I)),
    ("seizure", re.compile(r"\b(seizure|convulsion|fitting)\b", re.I)),
    ("anaphylaxis", re.compile(r"\b(anaphylaxis|throat (is )?closing|severe allergic reaction|swollen tongue)\b", re.I)),
]


def detect_emergency(text: str) -> str | None:
    """Return a short emergency category label when high-risk language is present."""
    for label, pattern in EMERGENCY_PATTERNS:
        if pattern.search(text or ""):
            return label
    return None


def emergency_consultation(category: str, conversation_id: str | None = None) -> ConsultationResult:
    return ConsultationResult(
        response=(
            f"⚠ Medical emergency detected ({category}).\n\n"
            "Stop using this assistant for triage and seek emergency care immediately.\n\n"
            "1. Call local emergency services now.\n"
            "2. Go to the nearest emergency department if it is safer and faster.\n"
            "3. If someone is with you, ask them to stay until help arrives."
        ),
        possible_conditions=[
            PossibleCondition(
                name="Possible medical emergency",
                confidence=95,
                description="Language consistent with a time-sensitive medical emergency was detected.",
            )
        ],
        urgency="emergency",
        recommendation="Call emergency services immediately and go to the nearest hospital. Do not wait for an AI response.",
        follow_up_questions=[],
        disclaimer=DISCLAIMER,
        emergency=True,
        conversation_id=conversation_id,
    )
