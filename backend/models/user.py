from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class MedicalHistory(BaseModel):
    blood_group: Optional[str] = None
    known_allergies: List[str] = []
    chronic_diseases: List[str] = []
    emergency_contact: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserDB(UserBase):
    id: str = Field(alias="_id")
    hashed_password: str
    medical_history: MedicalHistory = MedicalHistory()
    created_at: datetime = datetime.utcnow()

class UserResponse(UserBase):
    id: str
    medical_history: MedicalHistory
