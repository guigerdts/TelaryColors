"""Admin-only user management endpoints (users spec).

- ``GET /users`` lists users (admin only).
- ``POST /users`` creates a user (201; 409 duplicate username; 422 for
  invalid role or a password over 72 bytes — bcrypt guard).
- ``PATCH /users/{id}`` changes ``full_name``/``role`` (404 missing).
- ``DELETE /users/{id}`` removes a user (404 missing; 409 when audit
  history references them — FK integrity, access-logs spec).

Every write action records an audit row with the acting admin as
``user_id`` (read-only requests never log, per access-logs spec).
The username is the immutable identity (it is the JWT ``sub``), so
updates never rename.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_roles
from app.core.security import hash_password
from app.modules.access_logs.service import log_action
from app.modules.users.models import Role, User
from app.modules.users.schemas import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.admin)),
) -> list[User]:
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(Role.admin)),
) -> User:
    duplicate = db.scalar(select(User).where(User.username == payload.username))
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese nombre",
        )
    user = User(
        username=payload.username,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.flush()  # assign the id before auditing in the same transaction
    log_action(db, admin.id, "user.create")
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(Role.admin)),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    log_action(db, admin.id, "user.update")
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(Role.admin)),
) -> Response:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    db.delete(user)
    log_action(db, admin.id, "user.delete")
    try:
        db.commit()
    except IntegrityError:
        # access_logs rows reference the user (FK, no cascade on delete):
        # removing them would silently destroy the audit trail.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: el usuario tiene actividad registrada",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)