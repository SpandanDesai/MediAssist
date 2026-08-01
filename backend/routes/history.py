from fastapi import APIRouter, Depends, HTTPException
from utils.dependencies import get_current_user
from database import get_db
from bson import ObjectId

router = APIRouter()

@router.get("/history")
async def get_history(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.Conversations.find({"user_id": current_user["id"]}).sort("created_at", -1)
    conversations = await cursor.to_list(length=100)
    
    for conv in conversations:
        conv["id"] = str(conv["_id"])
        del conv["_id"]
        
    return {"conversations": conversations}

@router.delete("/history/{conversation_id}")
async def delete_history(conversation_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    result = await db.Conversations.delete_one({"_id": ObjectId(conversation_id), "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"message": "Conversation deleted successfully"}
