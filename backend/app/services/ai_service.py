"""Gemini-backed consultation, transcription, TTS helpers, and vision services.

Uses the Dr. Homie–compatible GeminiMedicalAgent for chat, image, and voice.
Falls back to the local rules engine when GEMINI_API_KEY is missing.
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import get_settings
from app.schemas.chat import ImageAnalysisResult, VoiceResponse
from app.schemas.common import DISCLAIMER, ConsultationResult, PossibleCondition
from app.services.emergency import detect_emergency, emergency_consultation
from app.services.gemini_agent import VISION_EXTRA, VOICE_EXTRA, get_gemini_agent
from app.services.rules_engine import analyze_image_notes, analyze_symptoms

logger = logging.getLogger(__name__)


def _conditions_from_raw(raw: Any) -> list[PossibleCondition]:
    if not isinstance(raw, list):
        return []
    out: list[PossibleCondition] = []
    for item in raw:
        if isinstance(item, str):
            out.append(PossibleCondition(name=item))
            continue
        if not isinstance(item, dict):
            continue
        confidence = item.get("confidence", item.get("probability"))
        try:
            confidence_val = float(confidence) if confidence is not None else None
        except (TypeError, ValueError):
            confidence_val = None
        if confidence_val is not None and confidence_val <= 1:
            confidence_val *= 100
        out.append(
            PossibleCondition(
                name=str(item.get("name") or item.get("condition") or "Possible condition"),
                confidence=confidence_val,
                description=str(item["description"]) if item.get("description") else None,
            )
        )
    return out


def _consultation_from_dict(data: dict[str, Any], conversation_id: str | None) -> ConsultationResult:
    urgency = str(data.get("urgency") or "low").lower()
    if urgency not in {"low", "medium", "high", "emergency"}:
        urgency = "medium"
    return ConsultationResult(
        response=str(
            data.get("response")
            or data.get("user_message")
            or data.get("message")
            or "Here is cautious educational guidance."
        ),
        possible_conditions=_conditions_from_raw(
            data.get("possible_conditions") or data.get("top_conditions") or data.get("conditions")
        ),
        urgency=urgency,  # type: ignore[arg-type]
        recommendation=str(data["recommendation"]) if data.get("recommendation") else None,
        follow_up_questions=[str(q) for q in (data.get("follow_up_questions") or []) if q],
        disclaimer=str(data.get("disclaimer") or DISCLAIMER),
        emergency=bool(data.get("emergency")) or urgency == "emergency",
        conversation_id=conversation_id,
    )


def _gemini_ready() -> bool:
    return get_gemini_agent().configured


async def consult_text(
    message: str,
    *,
    conversation_id: str | None = None,
    history: list[dict[str, str]] | None = None,
    profile_context: str | None = None,
) -> ConsultationResult:
    emergency = detect_emergency(message)
    if emergency:
        return emergency_consultation(emergency, conversation_id)

    if not _gemini_ready():
        return analyze_symptoms(message, conversation_id, profile_context)

    user_content = message
    if profile_context:
        user_content = f"Optional patient profile context:\n{profile_context}\n\nUser message:\n{message}"

    try:
        data = await get_gemini_agent().generate(user_text=user_content, history=history)
        result = _consultation_from_dict(data, conversation_id)
        if result.emergency or detect_emergency(result.response):
            category = detect_emergency(message) or detect_emergency(result.response) or "urgent symptoms"
            return emergency_consultation(category, conversation_id)
        return result
    except Exception as exc:
        logger.exception("Gemini chat failed: %s", exc)
        return analyze_symptoms(message, conversation_id, profile_context)


async def consult_image(
    image_bytes: bytes,
    mime_type: str,
    notes: str | None = None,
    conversation_id: str | None = None,
) -> ImageAnalysisResult:
    if notes:
        emergency = detect_emergency(notes)
        if emergency:
            base = emergency_consultation(emergency, conversation_id)
            return ImageAnalysisResult(
                **base.model_dump(),
                description="Emergency language detected in notes accompanying the image.",
                visible_abnormalities=[],
                severity="emergency",
                advice=base.recommendation,
            )

    if not _gemini_ready():
        return analyze_image_notes(notes, conversation_id)

    prompt = notes or "Please cautiously describe visible findings and educational possibilities."

    try:
        data = await get_gemini_agent().generate(
            user_text=prompt,
            image_bytes=image_bytes,
            image_mime=mime_type,
            extra_instruction=VISION_EXTRA,
        )
        base = _consultation_from_dict(data, conversation_id)
        return ImageAnalysisResult(
            **base.model_dump(),
            description=str(data.get("description") or "Cautious visual observations only."),
            visible_abnormalities=[str(x) for x in (data.get("visible_abnormalities") or []) if x],
            severity=str(data.get("severity") or base.urgency),
            advice=str(data.get("advice") or base.recommendation or ""),
        )
    except Exception as exc:
        logger.exception("Gemini vision failed: %s", exc)
        return analyze_image_notes(notes, conversation_id)


def _guess_audio_mime(filename: str) -> str:
    lower = (filename or "").lower()
    if lower.endswith(".wav"):
        return "audio/wav"
    if lower.endswith(".mp3"):
        return "audio/mpeg"
    if lower.endswith(".ogg"):
        return "audio/ogg"
    if lower.endswith(".m4a"):
        return "audio/mp4"
    if lower.endswith(".webm"):
        return "audio/webm"
    return "audio/webm"


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Ask Gemini to transcribe speech; used when a plain transcript is needed."""

    if not _gemini_ready():
        return "Voice consultation received. Configure GEMINI_API_KEY to enable speech understanding."

    try:
        data = await get_gemini_agent().generate(
            user_text=(
                "Transcribe the attached audio as accurately as possible. "
                "Return JSON with at least transcript set to the spoken words."
            ),
            audio_bytes=audio_bytes,
            audio_mime=_guess_audio_mime(filename),
            extra_instruction=VOICE_EXTRA,
        )
        transcript = data.get("transcript") or data.get("response") or data.get("user_message")
        return str(transcript or "I could not transcribe that audio clearly.")
    except Exception as exc:
        logger.exception("Gemini transcription failed: %s", exc)
        return "I could not transcribe that audio clearly. Please try again or type your symptoms."


async def synthesize_speech(text: str) -> str | None:
    """Optional TTS via Gemini speech models; returns None when unavailable."""

    settings = get_settings()
    agent = get_gemini_agent()
    if not agent.configured:
        return None

    # Prefer a dedicated TTS model when the key can reach it; otherwise skip audio.
    tts_model = settings.gemini_tts_model
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/{tts_model}:generateContent"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": text[:4000]}]}],
            "generationConfig": {
                "response_modalities": ["AUDIO"],
                "speech_config": {
                    "voice_config": {
                        "prebuilt_voice_config": {"voice_name": settings.gemini_tts_voice}
                    }
                },
            },
        }
        import ssl

        import httpx

        try:
            verify: ssl.SSLContext | bool = ssl.create_default_context()
        except Exception:
            verify = True
        async with httpx.AsyncClient(timeout=60.0, verify=verify) as client:
            response = await client.post(url, params={"key": agent.api_key}, json=payload)
            if not response.is_success:
                logger.warning("Gemini TTS unavailable: %s %s", response.status_code, response.text[:200])
                return None
            data = response.json()
            parts = ((((data.get("candidates") or [{}])[0].get("content") or {}).get("parts")) or [])
            for part in parts:
                inline = part.get("inlineData") or part.get("inline_data") or {}
                audio_b64 = inline.get("data")
                mime = inline.get("mimeType") or inline.get("mime_type") or "audio/mpeg"
                if audio_b64:
                    return f"data:{mime};base64,{audio_b64}"
    except Exception as exc:
        logger.warning("Gemini TTS unavailable: %s", exc)
    return None


async def consult_voice(
    audio_bytes: bytes,
    filename: str,
    *,
    conversation_id: str | None = None,
    history: list[dict[str, str]] | None = None,
    profile_context: str | None = None,
) -> VoiceResponse:
    """Run voice consult through the same Homie Gemini agent (audio + optional profile)."""

    if not _gemini_ready():
        transcript = "Voice consultation received. Configure GEMINI_API_KEY to enable speech understanding."
        result = analyze_symptoms(transcript, conversation_id, profile_context)
        return VoiceResponse(**result.model_dump(), transcript=transcript, audio_url=None)

    prompt = (
        "Please listen to this voice note, transcribe what the user said, "
        "and provide educational medical guidance in the required JSON format."
    )
    if profile_context:
        prompt = f"Optional patient profile context:\n{profile_context}\n\n{prompt}"

    try:
        data = await get_gemini_agent().generate(
            user_text=prompt,
            history=history,
            audio_bytes=audio_bytes,
            audio_mime=_guess_audio_mime(filename),
            extra_instruction=VOICE_EXTRA,
        )
        result = _consultation_from_dict(data, conversation_id)
        transcript = str(data.get("transcript") or "Voice note received.")
        if detect_emergency(transcript) or result.emergency or detect_emergency(result.response):
            category = (
                detect_emergency(transcript)
                or detect_emergency(result.response)
                or "urgent symptoms"
            )
            emergency = emergency_consultation(category, conversation_id)
            spoken = emergency.response
            if emergency.recommendation:
                spoken = f"{emergency.response}\n\nRecommendation: {emergency.recommendation}"
            audio_url = await synthesize_speech(spoken)
            return VoiceResponse(**emergency.model_dump(), transcript=transcript, audio_url=audio_url)

        spoken = result.response
        if result.recommendation:
            spoken = f"{result.response}\n\nRecommendation: {result.recommendation}"
        audio_url = await synthesize_speech(spoken)
        return VoiceResponse(**result.model_dump(), transcript=transcript, audio_url=audio_url)
    except Exception as exc:
        logger.exception("Gemini voice consult failed: %s", exc)
        transcript = await transcribe_audio(audio_bytes, filename)
        result = await consult_text(
            transcript,
            conversation_id=conversation_id,
            history=history,
            profile_context=profile_context,
        )
        spoken = result.response
        if result.recommendation:
            spoken = f"{result.response}\n\nRecommendation: {result.recommendation}"
        audio_url = await synthesize_speech(spoken)
        return VoiceResponse(**result.model_dump(), transcript=transcript, audio_url=audio_url)
