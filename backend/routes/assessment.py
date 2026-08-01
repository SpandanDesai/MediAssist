from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from utils.dependencies import get_current_user
from services.openai_service import client
import json

router = APIRouter()

class AssessmentRequest(BaseModel):
    smoking: str
    alcohol: str
    exercise: str
    diet: str
    sleep: str
    stress: str

@router.post("/assessment")
async def generate_assessment(request: AssessmentRequest, current_user: dict = Depends(get_current_user)):
    SYSTEM_PROMPT = """
    You are an AI Health Risk Assessor.
    Based on the user's lifestyle choices, calculate a health score from 0 to 100 (where 100 is perfectly healthy).
    Provide the score, risk level (Low, Moderate, High), some suggestions, and preventive tips.
    Output ONLY in valid JSON format with the following keys:
    {
      "risk_score": 85,
      "risk_level": "Low",
      "suggestions": ["suggestion1", "suggestion2"],
      "preventive_tips": ["tip1", "tip2"],
      "disclaimer": "This is an AI assessment and not a medical diagnosis. Please consult a doctor for personalized advice."
    }
    """
    
    user_data = f"""
    Smoking: {request.smoking}
    Alcohol: {request.alcohol}
    Exercise: {request.exercise}
    Diet: {request.diet}
    Sleep: {request.sleep}
    Stress: {request.stress}
    """
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_data}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        
        result_json = json.loads(response.choices[0].message.content)
        return result_json
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
