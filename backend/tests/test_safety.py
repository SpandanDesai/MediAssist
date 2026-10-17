from app.services.emergency import detect_emergency
from app.services.medication_guard import is_overdose_concern, needs_medication_guard
from app.services.rules_engine import analyze_symptoms


def test_chest_pain_is_detected():
    assert detect_emergency("I have crushing chest pain") is not None


def test_routine_symptom_not_flagged():
    assert detect_emergency("I have a mild headache") is None


def test_dosage_question_is_guarded():
    assert needs_medication_guard("How many mg of ibuprofen can I take?")


def test_plain_symptom_question_not_guarded():
    assert not needs_medication_guard("I have a sore throat and a mild fever")


def test_overdose_language_detected():
    assert is_overdose_concern("I think I took too many tablets")


def test_rules_engine_never_claims_diagnosis():
    result = analyze_symptoms("fever and sore throat")
    assert "diagnos" in result.response.lower()
    assert result.emergency is False


def test_suicidal_ideation_has_dedicated_crisis_guidance():
    category = detect_emergency("I feel like I want to end my life and hurt myself")
    assert category == "suicidal ideation"

    from app.services.emergency import emergency_consultation
    result = emergency_consultation(category)
    assert result.emergency is True
    assert result.emergency_category == "suicidal ideation"
    # Must provide empathetic response with specific hotlines (e.g. 988, Tele-MANAS, Samaritans)
    assert "988" in result.response
    assert "not have to go through this alone" in result.response.lower()
    # Ensure crisis resources include 988 and international/trusted contacts
    helpline_numbers = [r.phone for r in result.crisis_resources if r.phone]
    assert "988" in helpline_numbers
    assert any("telemanas" in (r.url or "") or "14416" in (r.phone or "") for r in result.crisis_resources)


def test_rules_engine_never_overclaims_with_numeric_probabilities():
    from app.services.rules_engine import analyze_symptoms
    result = analyze_symptoms("I have a bad cough, fever, and sore throat")
    for condition in result.possible_conditions:
        # Confidence should be None rather than arbitrary hardcoded probability numbers like 72%
        assert condition.confidence is None
        assert "heuristic match" in condition.name
    assert "not statistical probabilities" in result.response.lower()


def test_image_notes_fallback_does_not_hallucinate_visual_observations():
    from app.services.rules_engine import analyze_image_notes
    result = analyze_image_notes()
    # It must state that automated analysis is unavailable rather than returning canned observations
    assert "unavailable" in result.response.lower() or "offline" in result.response.lower()
    assert len(result.visible_abnormalities) == 0
    assert "describe" in result.response.lower()


def test_image_re_encoding_and_exif_stripping():
    import io
    from PIL import Image
    from fastapi import UploadFile
    from app.services.validation import validate_image_upload
    import pytest

    # Create an in-memory image with dummy EXIF metadata
    img = Image.new("RGB", (100, 100), color="blue")
    exif = img.getexif()
    exif[0x010e] = "Test Image Description / Metadata"
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    buf.seek(0)

    upload_file = UploadFile(filename="test_skin.jpg", file=buf, headers={"content-type": "image/jpeg"})

    import asyncio
    sanitized_bytes, mime = asyncio.run(validate_image_upload(upload_file))

    assert mime == "image/jpeg"
    # Load sanitized image and verify EXIF tag was stripped
    sanitized_img = Image.open(io.BytesIO(sanitized_bytes))
    clean_exif = sanitized_img.getexif()
    assert 0x010e not in clean_exif

