"""Authentication routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import database
from app.schemas.auth import LoginRequest, SignupRequest
from app.schemas.common import TokenResponse
from app.services.rate_limit import auth_limiter, client_key
from app.utils.serializers import serialize_user

router = APIRouter(tags=["auth"])


async def _signup(payload: SignupRequest, request: Request) -> TokenResponse:
    auth_limiter.check(client_key(request))
    email = payload.email.lower().strip()
    existing = await database.find_one("users", {"email": email})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    document = await database.insert_one(
        "users",
        {
            "name": payload.name.strip(),
            "email": email,
            "password_hash": hash_password(payload.password),
            "age": payload.age,
            "gender": payload.gender,
            "blood_group": None,
            "allergies": None,
            "medical_history": None,
            "chronic_diseases": None,
            "emergency_contact": None,
        },
    )
    token = create_access_token(str(document["_id"]))
    return TokenResponse(access_token=token, user=serialize_user(document))


async def _login(payload: LoginRequest, request: Request) -> TokenResponse:
    auth_limiter.check(client_key(request))
    email = payload.email.lower().strip()
    user = await database.find_one("users", {"email": email})
    if not user or not verify_password(payload.password, str(user.get("password_hash") or "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password.")
    token = create_access_token(str(user["_id"]))
    return TokenResponse(access_token=token, user=serialize_user(user))


@router.post("/auth/signup", response_model=TokenResponse)
@router.post("/signup", response_model=TokenResponse, include_in_schema=False)
async def signup(payload: SignupRequest, request: Request) -> TokenResponse:
    return await _signup(payload, request)


@router.post("/auth/login", response_model=TokenResponse)
@router.post("/login", response_model=TokenResponse, include_in_schema=False)
async def login(payload: LoginRequest, request: Request) -> TokenResponse:
    return await _login(payload, request)
