"""Deterministic emergency phrase detection before model processing."""

from __future__ import annotations

import re

from app.schemas.common import (
    DISCLAIMER,
    ConsultationResult,
    CrisisResource,
    NearbyFacility,
    PossibleCondition,
)

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


def crisis_resources_for(category: str) -> list[CrisisResource]:
    """Return category-aware crisis/help resources for the emergency action pack."""
    resources: list[CrisisResource] = [
        CrisisResource(
            label="Local emergency services",
            detail="Call your local emergency number now (112, 911, or your regional equivalent).",
            phone="112",
        ),
    ]
    if category == "suicidal ideation":
        resources.extend(
            [
                CrisisResource(
                    label="International Association for Suicide Prevention",
                    detail="Find local crisis lines and emotional support resources by country.",
                    url="https://www.iasp.info/suicidalthoughts/",
                ),
                CrisisResource(
                    label="Talk to someone nearby",
                    detail="If possible, stay with a trusted person until you can reach emergency or crisis support.",
                ),
            ]
        )
    elif category in {"chest pain / cardiac concern", "breathing difficulty", "stroke symptoms", "anaphylaxis"}:
        resources.append(
            CrisisResource(
                label="Go to the nearest emergency department",
                detail="If calling an ambulance would take longer than reaching an ER safely, go now and tell staff these are emergency symptoms.",
            )
        )
    elif category == "infant high fever":
        resources.append(
            CrisisResource(
                label="Pediatric urgent evaluation",
                detail="Infants with high fever need prompt clinician evaluation—do not wait for fever-reducing medicine to ‘confirm’ improvement.",
            )
        )
    return resources


def emergency_consultation(
    category: str,
    conversation_id: str | None = None,
    *,
    nearest_hospitals: list[NearbyFacility] | None = None,
) -> ConsultationResult:
    hospitals = nearest_hospitals or []
    hospital_lines = ""
    if hospitals:
        hospital_lines = "\n\nNearest facilities we found near you:\n" + "\n".join(
            f"- {h.name}"
            + (f" ({h.distance_km} km)" if h.distance_km is not None else "")
            + (f" — {h.phone}" if h.phone else "")
            for h in hospitals[:3]
        )

    return ConsultationResult(
        response=(
            f"⚠ Medical emergency detected ({category}).\n\n"
            "Stop using this assistant for triage and seek emergency care immediately.\n\n"
            "1. Call local emergency services now.\n"
            "2. Go to the nearest emergency department if it is safer and faster.\n"
            "3. If someone is with you, ask them to stay until help arrives."
            f"{hospital_lines}"
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
        emergency_category=category,
        crisis_resources=crisis_resources_for(category),
        nearest_hospitals=hospitals,
    )


async def enrich_emergency_with_location(
    result: ConsultationResult,
    *,
    latitude: float | None,
    longitude: float | None,
) -> ConsultationResult:
    """Attach nearest facilities when the client shares coordinates during an emergency."""
    if not result.emergency or latitude is None or longitude is None:
        return result
    try:
        from app.services.hospitals import find_nearby_hospitals

        nearby = await find_nearby_hospitals(latitude, longitude, radius=8000)
        facilities: list[NearbyFacility] = []
        for hospital in nearby.hospitals[:5]:
            maps_url = (
                f"https://www.openstreetmap.org/?mlat={hospital.latitude}&mlon={hospital.longitude}"
                f"#map=16/{hospital.latitude}/{hospital.longitude}"
            )
            facilities.append(
                NearbyFacility(
                    id=hospital.id,
                    name=hospital.name,
                    type=hospital.type,
                    distance_km=hospital.distance,
                    address=hospital.address,
                    phone=hospital.phone,
                    latitude=hospital.latitude,
                    longitude=hospital.longitude,
                    maps_url=maps_url,
                )
            )
        if not facilities:
            return result
        category = result.emergency_category or "urgent symptoms"
        return emergency_consultation(
            category,
            result.conversation_id,
            nearest_hospitals=facilities,
        )
    except Exception:
        return result
