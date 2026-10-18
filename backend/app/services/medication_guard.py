"""Redirects dosing and medication-change questions to a clinician or pharmacist.

Deterministic and runs before any model call. Errs on the side of redirecting.
"""

from __future__ import annotations

import re
from typing import Any

from app.schemas.common import DISCLAIMER, ConsultationResult
from app.utils.serializers import str_list

_DOSE_INTENT = re.compile(
    r"\b(how (much|many)|dose|dosage|dosing|mg|milligrams?|ml of|double (my|the)|"
    r"stop taking|quit taking|skip (my |the )?dose|combine|mix with|take with|"
    r"safe to take|overdose|too much)\b",
    re.I,
)
_MEDICATION = re.compile(
    r"\b(paracetamol|acetaminophen|tylenol|ibuprofen|advil|aspirin|naproxen|antibiotics?|"
    r"amoxicillin|azithromycin|insulin|warfarin|metformin|prednisone|steroids?|opioids?|"
    r"tramadol|codeine|oxycodone|benzodiazepines?|xanax|diazepam|sertraline|fluoxetine|"
    r"antidepressants?|medicines?|medications?|medicine|tablets?|pills?|capsules?|drugs?)\b",
    re.I,
)

GUARD_RESPONSE = (
    "I can't recommend specific doses, advise on stopping or changing a medicine, or say whether "
    "medicines can be combined. Those decisions depend on your age, weight, kidney and liver "
    "function, pregnancy status, and other medicines you take. Please check with a pharmacist "
    "or the clinician who prescribed it."
)

OVERDOSE_RESPONSE = (
    "If you think you have taken too much of a medicine, or someone else has, treat it as urgent. "
    "Call your local emergency number now, or contact a poison control centre. Do not wait for symptoms."
)


def needs_medication_guard(text: str) -> bool:
    if not text:
        return False
    return bool(_DOSE_INTENT.search(text) and _MEDICATION.search(text))


def is_overdose_concern(text: str) -> bool:
    return bool(re.search(r"\b(overdos\w*|took too (much|many)|too many (pills|tablets))\b", text or "", re.I))


def medication_consultation(text: str, conversation_id: str | None = None) -> ConsultationResult:
    if is_overdose_concern(text):
        return ConsultationResult(
            response=OVERDOSE_RESPONSE,
            urgency="emergency",
            recommendation="Call local emergency services or a poison control centre immediately.",
            follow_up_questions=[],
            disclaimer=DISCLAIMER,
            emergency=True,
            conversation_id=conversation_id,
        )
    return ConsultationResult(
        response=GUARD_RESPONSE,
        urgency="medium",
        recommendation="Speak with a pharmacist or prescribing clinician before changing or combining any medicine.",
        follow_up_questions=[],
        disclaimer=DISCLAIMER,
        emergency=False,
        conversation_id=conversation_id,
    )


def _mentions(text: str, names: list[str]) -> list[str]:
    """Return the ledger names that appear (word-boundary) in the query text."""
    lowered = (text or "").lower()
    hits: list[str] = []
    for name in names:
        if not name:
            continue
        if re.search(r"\b" + re.escape(name.lower()) + r"\b", lowered):
            hits.append(name)
    return hits


def profile_conflicts(user_doc: dict[str, Any] | None, text: str) -> dict[str, list[str]]:
    """Match a query against the user's structured allergy/medication ledgers.

    Returns allergy hits (highest concern) and current-medication mentions.
    Deterministic and educational — it only flags for professional confirmation.
    """
    if not user_doc:
        return {"allergy": [], "medication": []}
    allergies = str_list(user_doc.get("allergy_list")) + _split_free_text(user_doc.get("allergies"))
    medications = str_list(user_doc.get("medication_list")) + _split_free_text(user_doc.get("current_medications"))
    return {
        "allergy": _mentions(text, allergies),
        "medication": _mentions(text, medications),
    }


ALLERGY_CONFLICT_RESPONSE = (
    "You've listed an allergy to {allergy} in your profile, and this question is about the "
    "same medicine or substance. Please confirm with a pharmacist or the prescribing clinician "
    "before taking anything — do not rely on this assistant to clear a possible allergy conflict."
)


def _split_free_text(value: object) -> list[str]:
    """Best-effort split of a free-text allergy/medication field into tokens."""
    if not value or not isinstance(value, str):
        return []
    return [part.strip() for part in re.split(r"[,;\n]+", value) if part.strip()]


def profile_review(
    user_doc: dict[str, Any] | None,
    text: str,
    conversation_id: str | None = None,
) -> ConsultationResult | None:
    """Return an educational caution when a query touches a known ledger entry."""
    conflicts = profile_conflicts(user_doc, text)
    if conflicts["allergy"]:
        allergy = conflicts["allergy"][0]
        return ConsultationResult(
            response=ALLERGY_CONFLICT_RESPONSE.format(allergy=allergy),
            urgency="high",
            recommendation=f"Confirm the possible {allergy} allergy conflict with a pharmacist or clinician before use.",
            follow_up_questions=[],
            disclaimer=DISCLAIMER,
            emergency=False,
            conversation_id=conversation_id,
        )
    if conflicts["medication"] and needs_medication_guard(text):
        return ConsultationResult(
            response=(
                f"This looks like a dosing or combining question about {conflicts['medication'][0]}, "
                "which you've listed as a current medication. I can't advise on doses or combining "
                "medicines — please check with a pharmacist or prescriber."
            ),
            urgency="medium",
            recommendation="Speak with a pharmacist or prescribing clinician before changing or combining any medicine.",
            follow_up_questions=[],
            disclaimer=DISCLAIMER,
            emergency=False,
            conversation_id=conversation_id,
        )
    return None
