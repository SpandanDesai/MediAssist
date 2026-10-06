from pathlib import Path

ROOT = Path(r"c:\Users\Spandan\Documents\GitHub\MediAssist")

# --- common.py ---
common = ROOT / "backend/app/schemas/common.py"
text = common.read_text(encoding="utf-8")
old = '''class PossibleCondition(BaseModel):
    name: str
    confidence: float | None = Field(default=None, ge=0, le=100)
    description: str | None = None


class ConsultationResult(BaseModel):
    response: str
    possible_conditions: list[PossibleCondition] = Field(default_factory=list)
    urgency: UrgencyLevel = "low"
    recommendation: str | None = None
    follow_up_questions: list[str] = Field(default_factory=list)
    disclaimer: str = DISCLAIMER
    emergency: bool = False
    conversation_id: str | None = None'''
new = '''class PossibleCondition(BaseModel):
    name: str
    confidence: float | None = Field(default=None, ge=0, le=100)
    description: str | None = None


class CrisisResource(BaseModel):
    """Actionable help resource shown when emergency language is detected."""

    label: str
    detail: str
    phone: str | None = None
    url: str | None = None


class NearbyFacility(BaseModel):
    """Compact hospital/clinic card embedded in emergency responses."""

    id: str
    name: str
    type: str | None = None
    distance_km: float | None = None
    address: str | None = None
    phone: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    maps_url: str | None = None


class ConsultationResult(BaseModel):
    response: str
    possible_conditions: list[PossibleCondition] = Field(default_factory=list)
    urgency: UrgencyLevel = "low"
    recommendation: str | None = None
    follow_up_questions: list[str] = Field(default_factory=list)
    disclaimer: str = DISCLAIMER
    emergency: bool = False
    conversation_id: str | None = None
    emergency_category: str | None = None
    crisis_resources: list[CrisisResource] = Field(default_factory=list)
    nearest_hospitals: list[NearbyFacility] = Field(default_factory=list)'''
if old not in text:
    raise SystemExit("common.py pattern not found")
common.write_text(text.replace(old, new), encoding="utf-8")
print("OK common.py")
