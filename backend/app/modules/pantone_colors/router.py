"""Pantone color CRUD + instant code search endpoints (pantone-colors spec).

- ``GET /pantone-colors?q=221`` returns colors whose ``code`` starts with the
  query (case-insensitive ``ilike``), an empty list when nothing matches.
- ``POST /pantone-colors`` creates a color (201; 409 duplicate code; 422 bad
  ``paint_type``). Omitted ``gamut`` falls back to ``C``.
- ``GET /pantone-colors/{id}`` / ``PATCH`` / ``DELETE`` — read/update/delete
  by id (404 missing).

These routes are authenticated (any user, admin OR operator — unlike the
admin-only users router, per design roles). Every write action records an
audit row with the acting user as ``user_id`` (read-only requests never log).
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.modules.access_logs.service import log_action
from app.modules.pantone_colors.models import PantoneColor
from app.modules.pantone_colors.schemas import (
    PantoneColorCreate,
    PantoneColorOut,
    PantoneColorUpdate,
)
from app.modules.users.models import User

router = APIRouter(prefix="/pantone-colors", tags=["pantone-colors"])


@router.get("", response_model=list[PantoneColorOut])
def list_pantone_colors(
    q: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[PantoneColor]:
    query = select(PantoneColor)
    if q:
        query = query.where(PantoneColor.code.ilike(q + "%"))
    return db.scalars(query.order_by(PantoneColor.code)).all()


@router.get("/{color_id}", response_model=PantoneColorOut)
def get_pantone_color(
    color_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> PantoneColor:
    color = db.get(PantoneColor, color_id)
    if color is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Color Pantone no encontrado",
        )
    return color


@router.post("", response_model=PantoneColorOut, status_code=status.HTTP_201_CREATED)
def create_pantone_color(
    payload: PantoneColorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PantoneColor:
    try:
        color = PantoneColor(
            code=payload.code,
            gamut=payload.gamut,
            paint_type=payload.paint_type,
        )
        db.add(color)
        db.flush()  # assign the id / surface uniqueness before auditing
        log_action(db, user.id, "pantone.create")
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un color con ese código",
        )
    db.refresh(color)
    return color


@router.patch("/{color_id}", response_model=PantoneColorOut)
def update_pantone_color(
    color_id: int,
    payload: PantoneColorUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PantoneColor:
    color = db.get(PantoneColor, color_id)
    if color is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Color Pantone no encontrado",
        )
    if payload.code is not None:
        color.code = payload.code
    if payload.gamut is not None:
        color.gamut = payload.gamut
    if payload.paint_type is not None:
        color.paint_type = payload.paint_type
    log_action(db, user.id, "pantone.update")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un color con ese código",
        )
    db.refresh(color)
    return color


@router.delete("/{color_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pantone_color(
    color_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    color = db.get(PantoneColor, color_id)
    if color is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Color Pantone no encontrado",
        )
    db.delete(color)
    log_action(db, user.id, "pantone.delete")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
