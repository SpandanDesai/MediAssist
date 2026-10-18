"""Password and JWT primitives kept in one small audited module."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash

from app.core.config import get_settings

ALGORITHM = "HS256"
_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hash.verify(password, password_hash)
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, token_version: int = 0) -> str:
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": subject,
        "token_version": token_version,
        "exp": expires_at,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token_payload(token: str) -> dict | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except InvalidTokenError:
        return None


def create_share_token(report_id: str, user_id: str) -> str:
    """Issue a short-lived, scoped token granting account-free report access.

    A random ``jti`` identifies this specific link so it can later be revoked and
    its access counted independently of other links for the same report.
    """
    settings = get_settings()
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.report_share_expire_minutes)
    payload = {
        "sub": report_id,
        "uid": user_id,
        "scope": "report-share",
        "jti": uuid4().hex,
        "exp": expires_at,
        "iat": now,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_share_token(token: str) -> dict | None:
    """Validate a share token and return its payload, or None when invalid/expired."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[ALGORITHM],
            options={"require": ["exp"]},
        )
    except InvalidTokenError:
        return None
    if payload.get("scope") != "report-share":
        return None
    return payload
