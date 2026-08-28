"""Authentication primitives — bcrypt hashing and JWT (design ADR-1).

Passwords are hashed directly with bcrypt (NOT passlib, which is unmaintained
and incompatible with bcrypt 4.x/5.x). bcrypt silently truncates input past 72
bytes, so ``hash_password`` enforces the limit explicitly (design key
learning #5); schema-level validation pairs with this guard.

JWT encode/decode (HS256, 12h expiry): ``create_access_token`` signs the
user identity (``sub``) with the configured secret and expiry; levels of
``encode``/``decode`` use PyJWT directly, exercising the exact claim
handling ``get_current_user`` relies on.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings

MAX_PASSWORD_BYTES = 72


class PasswordTooLongError(ValueError):
    """Raised when a password exceeds bcrypt's 72-byte input limit."""


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt, enforcing the 72-byte guard."""
    payload = password.encode("utf-8")
    if len(payload) > MAX_PASSWORD_BYTES:
        raise PasswordTooLongError(
            f"Password exceeds the {MAX_PASSWORD_BYTES}-byte bcrypt limit"
        )
    return bcrypt.hashpw(payload, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Return True when ``password`` matches the stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"), password_hash.encode("utf-8")
        )
    except ValueError:
        # Malformed hash salt — never a successful match.
        return False


def create_access_token(
    subject: str, expires_delta: timedelta | None = None
) -> str:
    """Sign an HS256 JWT carrying ``subject`` as ``sub``.

    The token expires after the configured window (12h by default, auth
    spec "JWT Login"). ``exp`` is a UTC timestamp checked by
    ``decode_access_token``; expired tokens raise ``jwt.PyJWTError``.
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(hours=settings.access_token_expire_hours)
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Validate an HS256 JWT and return its claims.

    Raises ``jwt.PyJWTError`` (expired signature, bad signature, malformed
    token, ...) when the token is not acceptable.
    """
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
