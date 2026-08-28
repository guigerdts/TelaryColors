"""Authentication endpoints (auth spec).

``POST /auth/login`` accepts an OAuth2 password form, verifies the
password with bcrypt (never passlib), updates ``last_access_at`` and
audits the login in the same transaction, then issues a 12h HS256 JWT.
``GET /auth/me`` resolves the bearer token into the current user.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.security import (
    MAX_PASSWORD_BYTES,
    create_access_token,
    verify_password,
)
from app.db.base import utcnow
from app.modules.access_logs.service import log_action
from app.modules.auth.schemas import LoginResponse
from app.modules.users.models import User
from app.modules.users.schemas import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> LoginResponse:
    # bcrypt truncates past 72 bytes silently (design key learning #5):
    # reject at the boundary before any comparison or hashing.
    if len(form.password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La contraseña supera el límite de 72 bytes de bcrypt",
        )

    user = db.scalar(select(User).where(User.username == form.username))
    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Same-transaction audit: update last_access_at + login row, then commit
    # (design "Auth Flow": commit before issuing the token).
    user.last_access_at = utcnow()
    log_action(db, user.id, "login")
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.username)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user