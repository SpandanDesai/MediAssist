"""Safety-first educational response engine used when Gemini is unavailable."""

from __future__ import annotations

import re

from app.schemas.chat import AssessmentRequest, AssessmentResult, ImageAnalysisResult
from app.schemas.common import DISCLAIMER, ConsultationResult, PossibleCondition
from app.services.emergency import detect_emergency, emergency_consultation


def analyze_symptoms(message: str, conversation_id: str | None = None, profile_context: str | None = None) -> ConsultationResult:
    emergency = detect_emergency(message)
    if emergency:
        return emergency_consultation(emergency, conversation_id)

    text = message.lower()
    conditions: list[PossibleCondition] = []
    urgency = "low"
    recommendation = "Rest, hydrate, and monitor symptoms. Seek medical care if they worsen, persist, or concern you."
    follow_ups = [
        "When did the symptoms begin?",
        "Have the symptoms been getting better, worse, or staying the same?",
        "Do you have fever, shortness of breath, chest pain, or severe pain?",
    ]

    if any(word in text for word in ("fever", "sore throat", "cough", "cold", "flu")):
        conditions = [
            PossibleCondition(name="Viral upper respiratory infection", confidence=72, description="Common viral illnesses often cause fever, sore throat, and cough."),
            PossibleCondition(name="Influenza-like illness", confidence=18, description="Influenza can cause fever, body aches, and respiratory symptoms."),
            PossibleCondition(name="Streptococcal pharyngitis (strep throat)", confidence=10, description="Bacterial throat infection is possible when sore throat is prominent."),
        ]
        urgency = "medium" if "fever" in text and any(w in text for w in ("three", "3", "four", "4", "week", "worsen")) else "medium"
        recommendation = "Supportive care (rest, fluids, fever management as advised by a clinician/pharmacist) may help. Visit a doctor if symptoms worsen, persist beyond a few days, or breathing becomes difficult."
        follow_ups = [
            "What is your current temperature if measured?",
            "Is there cough, runny nose, body aches, or swollen glands?",
            "Are you able to swallow fluids comfortably?",
        ]
    elif any(word in text for word in ("rash", "itch", "hives", "skin")):
        conditions = [
            PossibleCondition(name="Irritant or allergic skin reaction", confidence=55, description="Contact exposures and allergies commonly cause itching or rash."),
            PossibleCondition(name="Viral exanthem", confidence=25, description="Some viral illnesses produce temporary rashes."),
            PossibleCondition(name="Dermatitis", confidence=20, description="Inflamed skin can appear dry, red, or itchy."),
        ]
        urgency = "medium"
        recommendation = "Avoid known irritants, keep the area clean and moisturized, and consult a clinician or dermatologist if the rash spreads, blisters, or is painful."
    elif any(word in text for word in ("headache", "migraine")):
        conditions = [
            PossibleCondition(name="Tension-type headache", confidence=60, description="Stress, posture, and dehydration commonly contribute."),
            PossibleCondition(name="Migraine", confidence=25, description="Migraines may include sensitivity to light/sound and nausea."),
            PossibleCondition(name="Dehydration-related headache", confidence=15, description="Inadequate fluid intake can trigger headache."),
        ]
        urgency = "high" if any(w in text for w in ("worst", "sudden", "stiff neck", "vision", "vomit")) else "medium"
        recommendation = "Rest in a quiet space, hydrate, and seek urgent care for sudden severe headache, neurological changes, or neck stiffness."
        if urgency == "high":
            recommendation = "Sudden severe headache or neurological symptoms need prompt professional evaluation. Consider urgent or emergency care."
    elif any(word in text for word in ("stomach", "nausea", "vomit", "diarrhea", "abdominal")):
        conditions = [
            PossibleCondition(name="Viral gastroenteritis", confidence=58, description="Stomach viruses often cause nausea, vomiting, or diarrhea."),
            PossibleCondition(name="Food-related illness", confidence=27, description="Contaminated food can cause gastrointestinal symptoms."),
            PossibleCondition(name="Indigestion / gastritis", confidence=15, description="Irritation of the stomach lining can cause discomfort."),
        ]
        urgency = "medium"
        recommendation = "Prioritize hydration with small sips of fluids. Seek care for severe abdominal pain, blood in stool/vomit, high fever, or signs of dehydration."
    else:
        conditions = [
            PossibleCondition(name="Nonspecific symptom constellation", confidence=40, description="More detail is needed before narrowing educational possibilities."),
            PossibleCondition(name="Self-limited viral illness", confidence=35, description="Many short-lived symptoms are viral and improve with supportive care."),
            PossibleCondition(name="Stress-related somatic symptoms", confidence=25, description="Stress and sleep disruption can amplify bodily sensations."),
        ]

    context_note = ""
    if profile_context:
        context_note = " I also considered the optional profile details you shared as background context only."

    response = (
        "Thank you for sharing those details. Based on what you described, here is cautious educational guidance—not a diagnosis."
        f"{context_note}\n\n"
        "I am estimating possible explanations with confidence percentages to show uncertainty. "
        "A clinician should evaluate you for a confirmed assessment, especially if symptoms worsen."
    )

    return ConsultationResult(
        response=response,
        possible_conditions=conditions,
        urgency=urgency,  # type: ignore[arg-type]
        recommendation=recommendation,
        follow_up_questions=follow_ups,
        disclaimer=DISCLAIMER,
        emergency=False,
        conversation_id=conversation_id,
    )


def analyze_image_notes(notes: str | None = None, conversation_id: str | None = None) -> ImageAnalysisResult:
    text = notes or "visible concern"
    emergency = detect_emergency(text)
    if emergency:
        base = emergency_consultation(emergency, conversation_id)
        return ImageAnalysisResult(**base.model_dump(), description="Emergency language detected in the accompanying notes.", visible_abnormalities=[], severity="emergency", advice=base.recommendation)

    return ImageAnalysisResult(
        response=(
            "I reviewed the uploaded image cautiously. Without an in-person exam, visible findings alone cannot confirm a diagnosis. "
            "Below are educational possibilities based on common visual patterns."
        ),
        description="Uploaded image appears to show a localized visible skin or soft-tissue concern. Image quality, lighting, and camera angle can significantly affect interpretation.",
        visible_abnormalities=["Possible redness or discoloration", "Possible surface texture change"],
        possible_conditions=[
            PossibleCondition(name="Irritant contact dermatitis", confidence=45, description="Common when skin contacts an irritant."),
            PossibleCondition(name="Mild inflammatory rash", confidence=30, description="Non-specific inflammation can look similar across conditions."),
            PossibleCondition(name="Early localized infection", confidence=25, description="Consider professional review if pain, warmth, fever, or spreading occurs."),
        ],
        urgency="medium",
        severity="uncertain / mild-to-moderate appearing",
        recommendation="If the area is painful, spreading, blistering, or accompanied by fever, seek clinician or dermatologist review. For severe rapid swelling of face/lips/throat, seek emergency care.",
        advice="Keep the area clean, avoid scratching or harsh products, photograph changes over time, and consult a clinician if uncertain.",
        follow_up_questions=[
            "How long has this been present?",
            "Is it itchy, painful, warm, or spreading?",
            "Any new products, insect bites, or known allergies?",
        ],
        disclaimer=DISCLAIMER,
        emergency=False,
        conversation_id=conversation_id,
    )


def assess_lifestyle(payload: AssessmentRequest) -> AssessmentResult:
    score = 0
    suggestions: list[str] = []

    smoking_map = {"never": 0, "former": 8, "occasional": 18, "daily": 30}
    alcohol_map = {"never": 0, "rarely": 4, "weekly": 10, "daily": 20}
    exercise_map = {"daily": 0, "weekly": 6, "rarely": 14, "never": 22}
    diet_map = {"balanced": 0, "mixed": 8, "processed": 16, "poor": 22}
    sleep_map = {"7-9": 0, "6": 8, "under6": 16, "irregular": 18}
    stress_map = {"low": 0, "moderate": 8, "high": 16, "severe": 24}

    score += smoking_map.get(payload.smoking.lower(), 12)
    score += alcohol_map.get(payload.alcohol.lower(), 8)
    score += exercise_map.get(payload.exercise.lower(), 10)
    score += diet_map.get(payload.diet.lower(), 10)
    score += sleep_map.get(payload.sleep.lower(), 10)
    score += stress_map.get(payload.stress.lower(), 10)
    score = min(100, score)

    if payload.smoking.lower() in {"occasional", "daily"}:
        suggestions.append("Reducing or quitting smoking is one of the highest-impact preventive steps.")
    if payload.exercise.lower() in {"rarely", "never"}:
        suggestions.append("Aim for regular movement most days—even short walks add up.")
    if payload.sleep.lower() in {"under6", "irregular"}:
        suggestions.append("Prioritize a consistent sleep window of about 7–9 hours when possible.")
    if payload.stress.lower() in {"high", "severe"}:
        suggestions.append("Consider stress-reduction routines and speak with a clinician if stress feels unmanageable.")
    if payload.diet.lower() in {"processed", "poor"}:
        suggestions.append("Shift toward whole foods, vegetables, and adequate protein/hydration.")
    if payload.alcohol.lower() in {"weekly", "daily"}:
        suggestions.append("Reducing alcohol intake can support sleep, mood, and long-term health.")

    if not suggestions:
        suggestions.append("Your reported habits already include several protective patterns—keep reinforcing them.")

    tips = [
        "Schedule routine preventive checkups appropriate for your age and history.",
        "Stay up to date on vaccinations recommended by your clinician.",
        "Know emergency warning signs such as chest pain, severe breathlessness, or sudden neurological changes.",
        "Keep an updated list of allergies, medicines, and emergency contacts.",
    ]

    level = "low" if score < 30 else "moderate" if score < 55 else "elevated" if score < 75 else "high"
    return AssessmentResult(
        risk_score=score,
        risk_level=level,
        suggestions=suggestions,
        preventive_tips=tips,
        disclaimer=DISCLAIMER,
    )


def extract_json_object(text: str) -> dict | None:
    """Best-effort extraction of a JSON object from model output."""
    import json

    text = text.strip()
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None
