"""Sample photo upload route (samples spec "Photo Upload Validation").

Slice B exposes only ``POST /samples/upload``; CRUD and promote routes
arrive in later slices (Phase C / Phase F, design file map). The route
follows the formulas router convention: authenticated (any user), and the
filename/content-type from the client are never trusted — validation is
size → declared allowlist → magic-byte agreement, storage under a
server-generated ``uuid4().hex`` name (design ADR-3).
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.config import settings
from app.core.deps import get_current_user
from app.modules.samples.uploads import UploadError, classify_upload
from app.modules.users.models import User

router = APIRouter(prefix="/samples", tags=["samples"])


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