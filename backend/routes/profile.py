from fastapi import APIRouter, Depends, HTTPException, status
from models.user import MedicalHistory, UserResponse
from database import get_db
from utils.dependencies import get_current_user
from bson import ObjectId

router = APIRouter()

@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return current_user

@router.put("/profile", response_model=UserResponse)
async def update_profile(medical_history: MedicalHistory, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    # Update only the medical history part for now
    update_data = {"$set": {"medical_history": medical_history.dict()}}
    
    await db.Users.update_one(
        {"_id": ObjectId(current_user["id"])},
        update_data
    )
    
    # Fetch updated user
    updated_user = await db.Users.find_one({"_id": ObjectId(current_user["id"])})
    if updated_user:
        updated_user["id"] = str(updated_user["_id"])
        return updated_user
    raise HTTPException(status_code=500, detail="Failed to update profile")
