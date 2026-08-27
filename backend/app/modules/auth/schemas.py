"""Pydantic schemas for the auth API (auth spec)."""

from pydantic import BaseModel

from app.modules.users.schemas import UserOut


class LoginResponse(BaseModel):
    """Successful login payload: the JWT plus the public user profile."""

    access_token: str
    token_type: str
    user: UserOut