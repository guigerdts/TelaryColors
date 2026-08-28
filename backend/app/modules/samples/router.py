"""Sample CRUD + photo upload routes (samples spec, design module layout).

- ``POST /samples`` creates one (201, status defaults to
  ``archivada_reutilizable`` — register = near-miss, design ADR-6),
  validating the ``pantone_target_id`` anchor exists (404 otherwise).
- ``GET /samples?pantone_target_id=&status=`` lists samples newest-first,
  capped at the 5 newest when both filters are given (S6/S7 reusable
  listing; design ADR-6 "cap 5").
- ``GET/PATCH /samples/{sample_id}`` — read/update by id (404 missing).
  PATCH is scoped to ``status``/``photo_url``/``notes``; ``pantone_target_id``
  is immutable post-create and any attempt is rejected (400, never silently
  ignored). A status change audits ``sample.status`` in the same transaction;
  a non-status update audits ``sample.update``. There is NO DELETE route —
  samples are never hard-deleted (405).
- ``POST /samples/upload`` validates and stores a photo (slice B, spec
  "Photo Upload Validation"): size → declared allowlist → magic-byte
  agreement, stored under a server-generated ``uuid4().hex`` name
  (design ADR-3).
- ``POST /samples/{sample_id}/promote`` atomically promotes a reusable
  sample into a NEW formula (design ADR-4, spec "Atomic Promote"): 404 for
  a missing sample, 409 unless the sample is ``archivada_reutilizable``.
  One transaction creates the formula (its ``pantone_color_id`` derived from
  the sample's ``pantone_target_id``), marks the sample ``aprobada`` + sets
  ``formula_id``, and audits a single ``sample.promote`` row; any mid-way
  failure rolls the transaction back (S14).

These routes are authenticated (any user, admin OR operator — unlike the
admin-only users router, per design roles). Every domain write records an
audit row with the acting user; read-only requests never log. The upload
endpoint stores a file but writes no domain audit row of its own.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.db.enums import SampleStatus
from app.modules.access_logs.service import log_action
from app.modules.formulas.models import Formula, FormulaIngredient
from app.modules.pantone_colors.models import PantoneColor
from app.modules.samples.models import Sample
from app.modules.samples.schemas import (
    PromoteOut,
    SampleCreate,
    SampleOut,
    SamplePromote,
    SampleUpdate,
)
from app.modules.samples.uploads import UploadError, classify_upload
from app.modules.users.models import User

router = APIRouter(prefix="/samples", tags=["samples"])

# Reusable listing window (design ADR-6, spec S6/S7): at most the 5 newest.
_REUSABLE_LISTING_CAP = 5


def _ensure_pantone_target_exists(db: Session, pantone_target_id: int) -> None:
    if db.get(PantoneColor, pantone_target_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Color Pantone no encontrado",
        )


def _get_sample_or_404(db: Session, sample_id: int) -> Sample:
    sample = db.get(Sample, sample_id)
    if sample is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Muestra no encontrada",
        )
    return sample


@router.get("", response_model=list[SampleOut])
def list_samples(
    pantone_target_id: int | None = None,
    sample_status: SampleStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[Sample]:
    """List samples newest-first; cap 5 when filter by target AND status."""
    query = select(Sample)
    if pantone_target_id is not None:
        query = query.where(Sample.pantone_target_id == pantone_target_id)
    if sample_status is not None:
        query = query.where(Sample.status == sample_status)
    if pantone_target_id is not None and sample_status is not None:
        query = query.limit(_REUSABLE_LISTING_CAP)
    return db.scalars(query.order_by(Sample.created_at.desc(), Sample.id.desc())).all()


@router.get("/{sample_id}", response_model=SampleOut)
def get_sample(
    sample_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Sample:
    return _get_sample_or_404(db, sample_id)


@router.post("", response_model=SampleOut, status_code=status.HTTP_201_CREATED)
def create_sample(
    payload: SampleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Sample:
    _ensure_pantone_target_exists(db, payload.pantone_target_id)
    sample = Sample(
        pantone_target_id=payload.pantone_target_id,
        photo_url=payload.photo_url,
        notes=payload.notes,
        status=SampleStatus.archivada_reutilizable,  # register = near-miss
        created_by=user.id,
    )
    db.add(sample)
    db.flush()  # assign the id before auditing in the same transaction
    log_action(db, user.id, "sample.create")
    db.commit()
    db.refresh(sample)
    return sample


@router.patch("/{sample_id}", response_model=SampleOut)
def update_sample(
    sample_id: int,
    payload: SampleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Sample:
    sample = _get_sample_or_404(db, sample_id)
    if payload.pantone_target_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El color Pantone objetivo no se puede modificar",
        )
    status_changed = False
    if payload.status is not None and payload.status != sample.status:
        sample.status = payload.status
        status_changed = True
    if payload.photo_url is not None:
        sample.photo_url = payload.photo_url
    if payload.notes is not None:
        sample.notes = payload.notes
    if status_changed:
        log_action(db, user.id, "sample.status")
    elif payload.photo_url is not None or payload.notes is not None:
        log_action(db, user.id, "sample.update")
    db.commit()
    db.refresh(sample)
    return sample


@router.post("/upload", status_code=status.HTTP_201_CREATED)
def upload_sample_photo(
    photo: UploadFile = File(..., description="JPEG, PNG or WebP image (max 5 MiB)"),
    _user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Validate and store a sample photo; return its single-origin URL.

    The client-supplied filename never reaches the filesystem: the file is
    validated (413 oversized / 415 declared type not allowed / 400 magic-
    byte agreement), then written as ``{uuid4().hex}.{ext}`` inside
    ``settings.upload_dir`` — path traversal is impossible.
    """
    declared = photo.content_type or ""
    data = photo.file.read(settings.max_upload_bytes + 1)
    try:
        extension = classify_upload(declared, data, settings.max_upload_bytes)
    except UploadError as error:
        raise HTTPException(
            status_code=error.status_code, detail=error.detail
        ) from error

    name = f"{uuid.uuid4().hex}.{extension}"
    directory = Path(settings.upload_dir)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / name).write_bytes(data)
    return {"photo_url": f"/uploads/{name}"}


@router.post("/{sample_id}/promote", response_model=PromoteOut, status_code=status.HTTP_201_CREATED)
def promote_sample(
    sample_id: int,
    payload: SamplePromote,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Atomically promote a reusable sample into a formula (design ADR-4).

    One transaction creates a new ``Formula`` (its ``pantone_color_id`` derived
    from the sample's ``pantone_target_id`` — never client-supplied), flushes to
    assign the formula id, marks the sample ``aprobada`` and links ``formula_id``,
    and writes exactly ONE ``sample.promote`` audit row. Any mid-way failure
    rolls the whole transaction back so nothing persists (spec S14).
    """
    sample = _get_sample_or_404(db, sample_id)
    if sample.status != SampleStatus.archivada_reutilizable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La muestra debe estar archivada como reutilizable",
        )
    try:
        formula = Formula(
            pantone_color_id=sample.pantone_target_id,  # derive, never client-supplied
            name=payload.name,
            notes=payload.notes,
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
        db.flush()  # assign formula.id before linking the sample
        sample.status = SampleStatus.aprobada
        sample.formula_id = formula.id
        log_action(db, user.id, "sample.promote")
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(sample)
    db.refresh(formula)
    return {"formula": formula, "sample": sample}