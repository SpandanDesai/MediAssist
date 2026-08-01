from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from utils.dependencies import get_current_user
from database import get_db
from services.openai_service import client, generate_chat_response
import tempfile
import os
from datetime import datetime
from bson import ObjectId

router = APIRouter()

@router.post("/voice")
async def voice_endpoint(
    audio_file: UploadFile = File(...),
    conversation_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
        content = await audio_file.read()
        temp_audio.write(content)
        temp_audio_path = temp_audio.name
        
    try:
        # Transcribe with Whisper
        with open(temp_audio_path, "rb") as audio:
            transcription = await client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio
            )
        user_text = transcription.text
        
        # Process chat response
        messages = []
        if conversation_id:
            conversation = await db.Conversations.find_one({"_id": ObjectId(conversation_id), "user_id": current_user["id"]})
            if conversation:
                messages = conversation.get("messages", [])
        else:
            new_conv = {
                "user_id": current_user["id"],
                "created_at": datetime.utcnow(),
                "messages": []
            }
            result = await db.Conversations.insert_one(new_conv)
            conversation_id = str(result.inserted_id)
            
        messages.append({"role": "user", "content": user_text})
        
        ai_content = await generate_chat_response(messages)
        
        if ai_content.startswith("EMERGENCY_DETECTED"):
            ai_content = "⚠ Medical Emergency Detected\n\nCall emergency services immediately. Go to the nearest hospital."
            
        messages.append({"role": "assistant", "content": ai_content})
        
        # Update conversation in DB
        await db.Conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"messages": messages, "updated_at": datetime.utcnow()}}
        )
        
        # Generate TTS audio
        tts_response = await client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=ai_content
        )
        
        # We can either return the audio binary or save it and return URL. 
        # For simplicity in this endpoint, we'll return the AI text, user text, and base64 audio.
        import base64
        audio_base64 = base64.b64encode(tts_response.content).decode('utf-8')
        
        return {
            "conversation_id": conversation_id,
            "user_text": user_text,
            "ai_text": ai_content,
            "audio_base64": audio_base64
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
