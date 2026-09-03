"""Design CRUD with 1–7 color cardinality + audit (designs spec).

- ``GET /designs`` lists designs (with nested colors).
- ``POST /designs`` creates one (201): name uniqueness (409), the 1–7 color
  cardinality enforced in the request transaction (422, Spanish message),
  distinct colors (409), and every referenced Pantone color must exist
  (404). A ``design.create`` audit row is written in the same transaction.
- ``GET/PATCH/DELETE /designs/{id}`` — read/update/delete by id (404
  missing). Update replaces the whole color set when ``color_ids`` is
  provided (delete-orphan removes stale links, cardinality re-checked);
  delete cascades to the design's ``design_colors`` rows and audits
  ``design.delete``.

Routes admit admin OR operator (plant-level work per the designs spec,
unlike the admin-only users router). Every write action records an audit
row with the acting user; read-only requests never log (access-logs spec).
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_roles
from app.modules.access_logs.service import log_action
from app.modules.designs.models import Design, DesignColor
from app.modules.designs.schemas import DesignCreate, DesignOut, DesignUpdate
from app.modules.pantone_colors.models import PantoneColor
from app.modules.users.models import Role, User

router = APIRouter(prefix="/designs", tags=["designs"])

MIN_COLORS = 1
MAX_COLORS = 7


def _validate_color_ids(db: Session, color_ids: list[int]) -> None:
    """Reject invalid color sets with Spanish details.

    Runs inside the request transaction before anything is flushed: SQLite
    cannot CHECK a cross-row count, so the 1–7 cardinality is enforced here
    (design ADR-6), alongside distinctness and color existence.
    """
    if not MIN_COLORS <= len(color_ids) <= MAX_COLORS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El diseño debe tener entre 1 y 7 colores",
        )
    if len(set(color_ids)) != len(color_ids):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El diseño no puede repetir el mismo color",
        )
    for pantone_color_id in color_ids:
        if db.get(PantoneColor, pantone_color_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Color Pantone no encontrado",
            )


def _ensure_name_free(db: Session, name: str, exclude_id: int | None = None) -> None:
    """Raise 409 when another design already owns ``name``."""
    stmt = select(Design).where(Design.name == name)
    if exclude_id is not None:
        stmt = stmt.where(Design.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un diseño con ese nombre",
        )


@router.get("", response_model=list[DesignOut])
def list_designs(
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(Role.admin, Role.operator)),
) -> list[Design]:
    return db.scalars(select(Design).order_by(Design.id)).all()


@router.get("/{design_id}", response_model=DesignOut)
def get_design(
    design_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(Role.admin, Role.operator)),
) -> Design:
    design = db.get(Design, design_id)
    if design is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diseño no encontrado",
        )
    return design


@router.post("", response_model=DesignOut, status_code=status.HTTP_201_CREATED)
def create_design(
    payload: DesignCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.admin, Role.operator)),
) -> Design:
    _ensure_name_free(db, payload.name)
    _validate_color_ids(db, payload.color_ids)
    design = Design(
        name=payload.name,
        paint_type=payload.paint_type,
        client=payload.client,
        notes=payload.notes,
        created_by=user.id,
    )
    design.colors = [
        DesignColor(pantone_color_id=color_id) for color_id in payload.color_ids
    ]
    db.add(design)
    db.flush()  # assign the design id before auditing in the same transaction
    log_action(db, user.id, "design.create")
    db.commit()
    db.refresh(design)
    return design


@router.patch("/{design_id}", response_model=DesignOut)
def update_design(
    design_id: int,
    payload: DesignUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.admin, Role.operator)),
) -> Design:
    design = db.get(Design, design_id)
    if design is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diseño no encontrado",
        )
    if payload.name is not None:
        _ensure_name_free(db, payload.name, exclude_id=design.id)
        design.name = payload.name
    if payload.paint_type is not None:
        design.paint_type = payload.paint_type
    if payload.color_ids is not None:
        _validate_color_ids(db, payload.color_ids)
        # Explicitly delete old colors before inserting new ones to avoid
        # UNIQUE constraint conflicts (delete-orphan cascade alone may not
        # flush in the right order).
        for old_color in list(design.colors):
            db.delete(old_color)
        db.flush()
        design.colors = [
            DesignColor(pantone_color_id=color_id) for color_id in payload.color_ids
        ]
    if payload.client is not None:
        design.client = payload.client
    if payload.notes is not None:
        design.notes = payload.notes
    log_action(db, user.id, "design.update")
    db.commit()
    db.refresh(design)
    return design


@router.delete("/{design_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_design(
    design_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.admin, Role.operator)),
) -> Response:
    design = db.get(Design, design_id)
    if design is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diseño no encontrado",
        )
    db.delete(design)  # cascades to the design's design_colors rows
    log_action(db, user.id, "design.delete")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)