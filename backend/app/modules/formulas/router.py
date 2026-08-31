"""Formula CRUD with nested ingredients + Pantone link (formulas spec).

- ``GET /formulas`` lists formulas (with nested ingredients).
- ``POST /formulas`` creates one (201), validating the referenced
  ``pantone_color_id`` exists (404 otherwise) and carrying nested ingredients.
- ``GET/PATCH/DELETE /formulas/{id}`` — read/update/delete by id (404 missing);
  delete cascades to the formula's ingredients.

These routes are authenticated (any user, admin OR operator — unlike the
admin-only users router, per design roles). Every write action records an
audit row with the acting user (read-only requests never log). The formula's
``created_by`` is the acting user, captured at create time.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.modules.access_logs.service import log_action
from app.modules.designs.models import Design, FormulaDesign
from app.modules.designs.schemas import DesignOut
from app.modules.formulas.models import Formula, FormulaIngredient
from app.modules.formulas.schemas import (
    FormulaCreate,
    FormulaDetailOut,
    FormulaOut,
    FormulaUpdate,
)
from app.modules.pantone_colors.models import PantoneColor
from app.modules.users.models import User

router = APIRouter(prefix="/formulas", tags=["formulas"])


def _ensure_pantone_exists(db: Session, pantone_color_id: int) -> None:
    if db.get(PantoneColor, pantone_color_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Color Pantone no encontrado",
        )


@router.get("", response_model=list[FormulaOut])
def list_formulas(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[Formula]:
    return db.scalars(select(Formula).order_by(Formula.id)).all()


@router.get("/{formula_id}/detail", response_model=FormulaDetailOut)
def get_formula_detail(
    formula_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> FormulaDetailOut:
    """Rich formula ficha (formula-designs spec "Formula Detail Endpoint",
    design D6): the formula (with its ingredients) plus the list of its linked
    designs merged across ``auto`` and ``manual`` sources.

    ``designs`` is a real ``SELECT DISTINCT`` over the ``formula_designs``
    join, so a design never appears twice even if a pair were ever duplicated
    at the application layer — the ``UNIQUE(formula_id, design_id)`` pair
    already prevents a true duplicate at the data layer, and the DISTINCT is
    the belt-and-suspenders guarantee the spec requires. A formula with no
    links returns an empty list; a missing formula 404s with the module's
    exact detail. Read-only, never audits.
    """
    formula = db.get(Formula, formula_id)
    if formula is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fórmula no encontrada",
        )
    designs = db.scalars(
        select(Design)
        .distinct()
        .join(FormulaDesign, FormulaDesign.design_id == Design.id)
        .where(FormulaDesign.formula_id == formula_id)
        .order_by(Design.id)
    ).all()
    return FormulaDetailOut(
        **FormulaOut.model_validate(formula).model_dump(),
        designs=[DesignOut.model_validate(d) for d in designs],
    )


@router.get("/{formula_id}", response_model=FormulaOut)
def get_formula(
    formula_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Formula:
    formula = db.get(Formula, formula_id)
    if formula is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fórmula no encontrada",
        )
    return formula


@router.post("", response_model=FormulaOut, status_code=status.HTTP_201_CREATED)
def create_formula(
    payload: FormulaCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Formula:
    _ensure_pantone_exists(db, payload.pantone_color_id)
    formula = Formula(
        name=payload.name,
        notes=payload.notes,
        pantone_color_id=payload.pantone_color_id,
        created_by=user.id,
    )
    formula.ingredients = [
        FormulaIngredient(
            colorant=ing.colorant,
            quantity=ing.quantity,
            unit=ing.unit,
        )
        for ing in payload.ingredients
    ]
    db.add(formula)
    db.flush()  # assign the id before auditing in the same transaction
    log_action(db, user.id, "formula.create")
    db.commit()
    db.refresh(formula)
    return formula


@router.patch("/{formula_id}", response_model=FormulaOut)
def update_formula(
    formula_id: int,
    payload: FormulaUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Formula:
    formula = db.get(Formula, formula_id)
    if formula is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fórmula no encontrada",
        )
    if payload.pantone_color_id is not None:
        _ensure_pantone_exists(db, payload.pantone_color_id)
        formula.pantone_color_id = payload.pantone_color_id
    if payload.name is not None:
        formula.name = payload.name
    if payload.notes is not None:
        formula.notes = payload.notes
    if payload.ingredients is not None:
        formula.ingredients = [
            FormulaIngredient(
                colorant=ing.colorant,
                quantity=ing.quantity,
                unit=ing.unit,
            )
            for ing in payload.ingredients
        ]
    log_action(db, user.id, "formula.update")
    db.commit()
    db.refresh(formula)
    return formula


@router.delete("/{formula_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_formula(
    formula_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    formula = db.get(Formula, formula_id)
    if formula is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fórmula no encontrada",
        )
    db.delete(formula)  # cascades to the formula's ingredients
    log_action(db, user.id, "formula.delete")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
