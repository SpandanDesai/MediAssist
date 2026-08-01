from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from utils.dependencies import get_current_user
from database import get_db
from services.openai_service import client
import base64
from datetime import datetime

router = APIRouter()

SYSTEM_PROMPT = """
You are an AI Vision Healthcare Assistant. Analyze the provided medical image.
CRITICAL RULES:
1. Describe the image and detect visible abnormalities.
2. List possible conditions with confidence percentages.
3. Assess severity (Low, Medium, High).
4. Provide advice. If severe, recommend a nearby hospital. If uncertain, recommend a specialist (e.g., dermatologist).
5. NEVER claim certainty. Always state this is an AI analysis and not a medical diagnosis.
Format your response in Markdown.
"""

@router.post("/image")
async def image_endpoint(
    image_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    # Read and encode image to base64
    content = await image_file.read()
    base64_image = base64.b64encode(content).decode('utf-8')
    mime_type = image_file.content_type
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": [
                    {"type": "text", "text": "Please analyze this image based on your instructions."},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64_image}"}}
                ]}
            ],
            max_tokens=800,
        )
        ai_response = response.choices[0].message.content
        
        # Save image analysis to DB
        image_record = {
            "user_id": current_user["id"],
            "filename": image_file.filename,
            "mime_type": mime_type,
            "analysis": ai_response,
            "created_at": datetime.utcnow()
        }
        await db.Images.insert_one(image_record)
        
        return {"analysis": ai_response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
