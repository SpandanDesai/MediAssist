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
