"""Authentication primitives — bcrypt hashing and JWT (design ADR-1).

Passwords are hashed directly with bcrypt (NOT passlib, which is unmaintained
and incompatible with bcrypt 4.x/5.x). bcrypt silently truncates input past 72
bytes, so ``hash_password`` enforces the limit explicitly (design key
learning #5); schema-level validation pairs with this guard.

JWT encode/decode (HS256, 12h expiry) lands here too but is exercised in the
auth slice (Phase 3); this module is where they belong.
"""

import bcrypt

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
