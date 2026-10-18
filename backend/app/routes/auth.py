"""Authentication routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response, status
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import database
from app.schemas.auth import LoginRequest, SignupRequest
from app.schemas.common import TokenResponse
from app.services.rate_limit import auth_limiter, client_key
from app.utils.serializers import serialize_user

router = APIRouter(tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    """Attach the httpOnly session cookie for browser clients."""
    settings = get_settings()
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(key=settings.auth_cookie_name, path="/")


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
            "password_hash": await run_in_threadpool(hash_password, payload.password),
            "token_version": 1,
            "age": payload.age,
            "gender": payload.gender,
            "blood_group": None,
            "allergies": None,
            "medical_history": None,
            "chronic_diseases": None,
            "emergency_contact": None,
        },
    )
    token = create_access_token(str(document["_id"]), token_version=1)
    return TokenResponse(access_token=token, user=serialize_user(document))


async def _login(payload: LoginRequest, request: Request) -> TokenResponse:
    auth_limiter.check(client_key(request))
    email = payload.email.lower().strip()
    user = await database.find_one("users", {"email": email})
    password_ok = await run_in_threadpool(
        verify_password, payload.password, str(user.get("password_hash") or "")
    ) if user else False
    if not user or not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password.")
    current_version = int(user.get("token_version", 0))
    if current_version == 0:
        current_version = 1
        await database.update_one("users", {"_id": user["_id"]}, {"token_version": current_version})
    token = create_access_token(str(user["_id"]), token_version=current_version)
    return TokenResponse(access_token=token, user=serialize_user(user))


@router.post("/auth/signup", response_model=TokenResponse)
@router.post("/signup", response_model=TokenResponse, include_in_schema=False)
async def signup(payload: SignupRequest, request: Request, response: Response) -> TokenResponse:
    result = await _signup(payload, request)
    _set_session_cookie(response, result.access_token)
    return result


@router.post("/auth/login", response_model=TokenResponse)
@router.post("/login", response_model=TokenResponse, include_in_schema=False)
async def login(payload: LoginRequest, request: Request, response: Response) -> TokenResponse:
    result = await _login(payload, request)
    _set_session_cookie(response, result.access_token)
    return result


@router.post("/auth/logout")
async def logout(request: Request, response: Response) -> dict[str, str]:
    from app.core.security import decode_token_payload
    from fastapi.security.utils import get_authorization_scheme_param

    _clear_session_cookie(response)

    auth_header = request.headers.get("Authorization")
    scheme, param = get_authorization_scheme_param(auth_header)
    if not param and scheme.lower() != "bearer":
        param = request.cookies.get(get_settings().auth_cookie_name)
    if param:
        payload = decode_token_payload(param)
        if payload and payload.get("sub"):
            user = await database.find_one("users", {"_id": payload["sub"]})
            if user:
                new_version = int(user.get("token_version", 0)) + 1
                await database.update_one("users", {"_id": user["_id"]}, {"token_version": new_version})
    return {"message": "Successfully logged out."}
