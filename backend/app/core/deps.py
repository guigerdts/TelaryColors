"""FastAPI dependencies (DI).

``get_db`` yields the per-request session used by all module routers.
``get_current_user`` resolves the authenticated user from the bearer
token (401 for missing/invalid/expired tokens). ``require_roles``
restricts an endpoint to a set of roles (403 for others). Together they
protect every authenticated route (auth spec, design ADR-1/3).
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.modules.users.models import Role, User

__all__ = ["get_db", "get_current_user", "require_roles"]

# Swagger "Authorize" points at the real login endpoint (OAuth2 password flow).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from the bearer token (401 otherwise).

    Returns 401 before any business logic runs, per auth spec
    "DI-based Authentication Dependencies".
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autorizado: token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        raise unauthorized
    username = payload.get("sub")
    if username is None:
        raise unauthorized
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        raise unauthorized
    return user


def require_roles(*roles: Role):
    """Dependency factory: admit users whose role is in ``roles`` (403 else)."""

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado: rol sin permiso para esta operación",
            )
        return current_user

    return dependency