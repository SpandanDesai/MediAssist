from fastapi import APIRouter, Depends, HTTPException, status
from models.chat import ChatRequest, ChatResponse, Message
from database import get_db
from utils.dependencies import get_current_user
from services.openai_service import generate_chat_response
from datetime import datetime
from bson import ObjectId

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    conversation_id = request.conversation_id
    messages = []
    
    if conversation_id:
        conversation = await db.Conversations.find_one({"_id": ObjectId(conversation_id), "user_id": current_user["id"]})
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        messages = conversation.get("messages", [])
    else:
        # Create a new conversation
        new_conv = {
            "user_id": current_user["id"],
            "created_at": datetime.utcnow(),
            "messages": []
        }
        result = await db.Conversations.insert_one(new_conv)
        conversation_id = str(result.inserted_id)
        
    # Append user message
    user_msg = {"role": "user", "content": request.message}
    messages.append(user_msg)
    
    # Generate AI response
    ai_content = await generate_chat_response(messages)
    
    # Handle emergency
    if ai_content.startswith("EMERGENCY_DETECTED"):
        ai_content = "⚠ Medical Emergency Detected\n\nCall emergency services immediately. Go to the nearest hospital."
        
    ai_msg = {"role": "assistant", "content": ai_content}
    messages.append(ai_msg)
    
    # Update conversation in DB
    await db.Conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {"$set": {"messages": messages, "updated_at": datetime.utcnow()}}
    )
    
    return ChatResponse(response=ai_content, conversation_id=conversation_id)
