from fastapi import APIRouter, HTTPException, status, Depends
from models.user import UserCreate, UserResponse, UserDB
from database import get_db
from services.auth import get_password_hash, verify_password, create_access_token
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

@router.post("/signup", response_model=Token)
async def signup(user: UserCreate):
    db = get_db()
    
    # Check if user exists
    existing_user = await db.Users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = get_password_hash(user.password)
    new_user = {
        "email": user.email,
        "name": user.name,
        "hashed_password": hashed_password,
        "medical_history": {},
        "created_at": datetime.utcnow()
    }
    
    result = await db.Users.insert_one(new_user)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(data={"sub": user_id})
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": user_id, "email": user.email, "name": user.name}}

@router.post("/login", response_model=Token)
async def login(credentials: LoginRequest):
    db = get_db()
    user = await db.Users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    if not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    user_id = str(user["_id"])
    access_token = create_access_token(data={"sub": user_id})
    
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": user_id, "email": user["email"], "name": user["name"]}}
