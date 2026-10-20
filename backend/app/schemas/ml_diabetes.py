"""Pydantic schemas for the CDC diabetes ML model inference.

The feature fields use the dataset's numeric encodings, not user-friendly
values (see ``backend/app/ml/diabetes/diabetes_metadata.json``). For example
``Age`` is an age band from 1 to 13 (not age in years) and ``GenHlth`` ranges
from 1 (excellent) to 5 (poor). Callers must convert inputs correctly.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class DiabetesInput(BaseModel):
    """Exactly the 21 encoded columns expected by the trained model."""

    model_config = ConfigDict(extra="forbid")

    HighBP: int = Field(..., ge=0, le=1, description="Has high blood pressure? (0/1)")
    HighChol: int = Field(..., ge=0, le=1, description="Has high cholesterol? (0/1)")
    CholCheck: int = Field(..., ge=0, le=1, description="Cholesterol checked in past 5 years? (0/1)")
    BMI: int = Field(..., ge=10, le=100, description="Body mass index (integer, dataset-encoded)")
    Smoker: int = Field(..., ge=0, le=1, description="Currently a smoker? (0/1)")
    Stroke: int = Field(..., ge=0, le=1, description="Ever had a stroke? (0/1)")
    HeartDiseaseorAttack: int = Field(..., ge=0, le=1, description="Coronary heart disease or heart attack? (0/1)")
    PhysActivity: int = Field(..., ge=0, le=1, description="Physical activity in past month? (0/1)")
    Fruits: int = Field(..., ge=0, le=1, description="Consumes fruit? (0/1)")
    Veggies: int = Field(..., ge=0, le=1, description="Consumes vegetables? (0/1)")
    HvyAlcoholConsump: int = Field(..., ge=0, le=1, description="Heavy alcohol consumption? (0/1)")
    AnyHealthcare: int = Field(..., ge=0, le=1, description="Has any healthcare? (0/1)")
    NoDocbcCost: int = Field(..., ge=0, le=1, description="Did not see a doctor due to cost? (0/1)")
    GenHlth: int = Field(..., ge=1, le=5, description="General health rating (1: Excellent ... 5: Poor)")
    MentHlth: int = Field(..., ge=0, le=30, description="Days of poor mental health in past month (0-30)")
    PhysHlth: int = Field(..., ge=0, le=30, description="Days of poor physical health in past month (0-30)")
    DiffWalk: int = Field(..., ge=0, le=1, description="Serious difficulty walking? (0/1)")
    Sex: int = Field(..., ge=0, le=1, description="Sex as encoded by the dataset (0/1)")
    Age: int = Field(..., ge=1, le=13, description="Age as a dataset band from 1 to 13 (NOT age in years)")
    Education: int = Field(..., ge=1, le=6, description="Education level as encoded by the dataset (1-6)")
    Income: int = Field(..., ge=1, le=8, description="Annual household income as encoded by the dataset (1-8)")


class DiabetesPredictionResult(BaseModel):
    """Experimental survey-label classification. Not a clinical diagnosis."""

    model: str
    prediction: int = Field(..., ge=0, le=1)
    label: str
    decision_threshold: float
    model_score: float = Field(
        ...,
        description=(
            "Model's positive-class score used to apply the decision threshold. "
            "This is a raw model output, not a validated individual clinical probability."
        ),
    )
    notice: str
