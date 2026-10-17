"""Redirects dosing and medication-change questions to a clinician or pharmacist.

Deterministic and runs before any model call. Errs on the side of redirecting.
"""

from __future__ import annotations

import re

from app.schemas.common import DISCLAIMER, ConsultationResult

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
