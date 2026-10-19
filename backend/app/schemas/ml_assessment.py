"""Pydantic schemas for Machine Learning (UCI Obesity) model inference."""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class ObesityLifestyleInput(BaseModel):
    """Features expected by the lifestyle-only ML pipeline (14 features)."""

    model_config = ConfigDict(extra="forbid")

    Gender: Literal["Female", "Male"]
    Age: float = Field(..., ge=10.0, le=120.0, description="Age in years (e.g. 21.0)")
    family_history_with_overweight: Literal["yes", "no"] = Field(
        ..., description="Has a family member suffered or suffers from overweight?"
    )
    FAVC: Literal["yes", "no"] = Field(
        ..., description="Do you eat high caloric food frequently?"
    )
    FCVC: float = Field(
        ..., ge=1.0, le=3.0, description="Do you usually eat vegetables in your meals? (1: Never, 2: Sometimes, 3: Always)"
    )
    NCP: float = Field(
        ..., ge=1.0, le=4.0, description="How many main meals do you have daily? (1 to 4)"
    )
    CAEC: Literal["no", "Sometimes", "Frequently", "Always"] = Field(
        ..., description="Do you eat any food between meals?"
    )
    SMOKE: Literal["yes", "no"] = Field(..., description="Do you smoke?")
    CH2O: float = Field(
        ..., ge=1.0, le=3.0, description="How much water do you drink daily in liters? (1: <1L, 2: 1-2L, 3: >2L)"
    )
    SCC: Literal["yes", "no"] = Field(
        ..., description="Do you monitor the calories you eat daily?"
    )
    FAF: float = Field(
        ..., ge=0.0, le=3.0, description="How often do you have physical activity? (0: None, 1: 1-2 days, 2: 2-4 days, 3: 4-5 days)"
    )
    TUE: float = Field(
        ..., ge=0.0, le=2.0, description="Time using technology devices (0: 0-2 hours, 1: 3-5 hours, 2: >5 hours)"
    )
    CALC: Literal["no", "Sometimes", "Frequently", "Always"] = Field(
        ..., description="How often do you drink alcohol?"
    )
    MTRANS: Literal[
        "Automobile", "Motorbike", "Bike", "Public_Transportation", "Walking"
    ] = Field(..., description="Which transportation do you usually use?")


class ObesityAllFeaturesInput(ObesityLifestyleInput):
    """Extended schema including physical measurements (16 features total)."""

    Height: float = Field(..., ge=0.8, le=2.5, description="Height in meters (e.g. 1.70)")
    Weight: float = Field(..., ge=20.0, le=300.0, description="Weight in kilograms (e.g. 70.0)")


class ObesityPredictionResult(BaseModel):
    predicted_category: str
    category_label: str
    model: str
    class_probabilities: dict[str, float] | None = None
    disclaimer: str
    recommendations: list[str] = Field(default_factory=list)
