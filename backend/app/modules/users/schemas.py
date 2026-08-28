"""Pydantic schemas for the users API (users spec; design module layout).

``UserOut`` is the public profile: it never exposes ``password_hash``.
``UserCreate`` hashes at the router and validates bcrypt's 72-byte limit
at the schema level (design ADR-1, key learning #5). ``UserUpdate``
supports partial updates of ``full_name`` and ``role``; ``username`` is
the immutable identity (it is the JWT ``sub``).
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.security import MAX_PASSWORD_BYTES
from app.modules.users.models import Role


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str | None
    role: Role
    last_access_at: datetime | None
    created_at: datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    full_name: str | None = Field(default=None, max_length=100)
    password: str
    role: Role = Role.operator  # least privilege by default

    @field_validator("password")
    @classmethod
    def _password_within_bcrypt_limit(cls, value: str) -> str:
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError("La contraseña supera el límite de 72 bytes de bcrypt")
        return value


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=100)
    role: Role | None = None