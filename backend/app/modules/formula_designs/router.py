"""Formula↔design link endpoint + shared idempotent upsert (formula-designs
spec; design D4/D5).

``POST /formulas/{formula_id}/designs`` links an EXISTING design to the
formula with ``source=manual`` (200). A missing formula or design 404s with
the owning module's Spanish detail; nothing is written. Because the helper
below is shared, the manual endpoint and the register-transaction auto-link
(design D6) are idempotent the same way: a pair that already exists returns
the existing row with its ORIGINAL ``source`` preserved, writes no duplicate,
and audits nothing new — ``formula_design.create`` is recorded only for a
genuinely new pair, inside the same transaction the caller commits.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_roles
from app.db.enums import DesignSource
from app.modules.access_logs.service import log_action
from app.modules.designs.models import Design, FormulaDesign
from app.modules.formula_designs.schemas import (
    FormulaDesignCreate,
    FormulaDesignOut,
)
from app.modules.formulas.models import Formula
from app.modules.users.models import Role, User

router = APIRouter(prefix="/formulas", tags=["formula-designs"])


def upsert_formula_design(
    db: Session,
    *,
    formula_id: int,
    design_id: int,
    source: DesignSource,
    user_id: int,
) -> FormulaDesign:
    """Idempotent (formula, design) upsert (design D4/D5).

    Returns the EXISTING row when the pair is already linked — the original
    ``source`` is preserved and nothing is written or audited. For a NEW
    pair: stages the row, flushes to assign its id, and audits
    ``formula_design.create`` with the acting user in the same transaction
    the caller commits (callers never commit inside this helper, so a later
    failure rolls the link back with everything else — design D6/D7).
    """
    existing = db.scalar(
        select(FormulaDesign).where(
            FormulaDesign.formula_id == formula_id,
            FormulaDesign.design_id == design_id,
        )
    )
    if existing is not None:
        return existing
    link = FormulaDesign(
        formula_id=formula_id, design_id=design_id, source=source
    )
    db.add(link)
    db.flush()
    log_action(db, user_id, "formula_design.create")
    return link


@router.post("/{formula_id}/designs", response_model=FormulaDesignOut)
def link_design_to_formula(
    formula_id: int,
    payload: FormulaDesignCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.admin, Role.operator)),
) -> FormulaDesign:
    """Manually link one design to a formula (``source=manual``, design D5).

    Both ends must exist before anything is written; re-linking an existing
    pair is idempotent (returns the existing row, source untouched).
    """
    if db.get(Formula, formula_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fórmula no encontrada",
        )
    if db.get(Design, payload.design_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diseño no encontrado",
        )
    link = upsert_formula_design(
        db,
        formula_id=formula_id,
        design_id=payload.design_id,
        source=DesignSource.manual,
        user_id=user.id,
    )
    db.commit()
    db.refresh(link)
    return link