"""Personal vitals request/response models.

The Vitals Tracker stores user-owned time-series readings (weight, blood
pressure, resting heart rate, glucose, ...) that supplement the lifestyle
check-in. Values are treated strictly as user-entered observations; nothing
here is interpreted as a clinical measurement.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

VitalKind = Literal[
    "weight_kg",
    "height_cm",
    "systolic_bp",
    "diastolic_bp",
    "resting_hr",
    "temperature_c",
    "spo2_pct",
    "glucose_mgdl",
    "bmi",
]

# Display unit is derived from the kind so clients never have to trust a
# user-supplied unit string. Kept in the schema (not the route) so both the
# route and any future serializer share one source of truth.
UNIT_BY_KIND: dict[str, str] = {
    "weight_kg": "kg",
    "height_cm": "cm",
    "systolic_bp": "mmHg",
    "diastolic_bp": "mmHg",
    "resting_hr": "bpm",
    "temperature_c": "\u00b0C",
    "spo2_pct": "%",
    "glucose_mgdl": "mg/dL",
    "bmi": "kg/m\u00b2",
}


class VitalCreate(BaseModel):
    kind: VitalKind
    value: float = Field(..., gt=0, lt=10_000)
    note: str | None = Field(default=None, max_length=500)
    # ISO date or datetime; stored verbatim after parse-then-normalise.
    recorded_at: str | None = Field(default=None, max_length=40)


class VitalOut(BaseModel):
    id: str
    kind: VitalKind
    value: float
    unit: str
    note: str | None = None
    recorded_at: str
    created_at: str
