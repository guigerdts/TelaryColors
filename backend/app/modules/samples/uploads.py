"""Photo upload validation and the guarded ``/uploads`` static route.

Hardening per samples spec "Photo Upload Validation" and design ADR-2/3:

- ``classify_upload`` rejects by size (413), by a declared type outside the
  JPEG/PNG/WebP allowlist (415), and by magic-byte/declared disagreement
  (400). The client-supplied content-type and filename are never trusted.
- ``_UploadsRoute`` serves stored uploads at ``/uploads`` through
  ``StaticFiles(html=False)``: no directory listings, no code execution,
  and an explicit ``Match.NONE`` guard outside its own tree so it can
  never shadow ``/api/`` routes (the SPA route guards back, ADR-2).
"""

from pathlib import Path

from starlette.responses import PlainTextResponse
from starlette.routing import Match, Route
from starlette.staticfiles import StaticFiles
from starlette.types import Receive, Scope, Send

from app.core.config import settings

# Allowed image types: the sniffed magic bytes must AGREE with the declared
# content-type (design ADR-3). The extension is derived from the sniffed
# type, never from the client filename.
_ALLOWED_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def sniff_image_type(data: bytes) -> str | None:
    """Detect the image type from magic bytes (JPEG/PNG/WebP), else None."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP":
        return "image/webp"
    return None


class UploadError(Exception):
    """Rejected upload: carries the HTTP status code and user-facing detail."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def classify_upload(declared: str, data: bytes, max_bytes: int) -> str:
    """Return the extension for an acceptable upload, or raise ``UploadError``.

    Checks run in design data-flow order: size (413), declared allowlist
    (415), then magic-byte agreement (400). The client filename never
    reaches this function — the caller stores under ``uuid4().hex`` + ext.
    """
    if len(data) > max_bytes:
        raise UploadError(413, "Archivo demasiado grande")
    if declared not in _ALLOWED_TYPES:
        raise UploadError(415, "Tipo de archivo no permitido")
    if sniff_image_type(data) != declared:
        raise UploadError(
            400, "El contenido del archivo no coincide con su tipo declarado"
        )
    return _ALLOWED_TYPES[declared]


class _StaticUploads:
    """ASGI app serving ``settings.upload_dir`` with no listings or execution.

    A class instance (not a plain function) so Starlette routes it through
    the ASGI path: ``StaticFiles(html=False)`` never renders a directory
    listing and serves only stored file bytes. The directory is resolved
    lazily from settings per request, so tests can redirect storage.

    A plain ``Route`` passes the full scope path through; like ``Mount`` we
    shape the child path by stripping the ``/uploads`` prefix before the
    static lookup (uploads are stored flat under the directory).
    """

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        directory = Path(settings.upload_dir)
        if not directory.is_dir():
            response = PlainTextResponse("Not Found", status_code=404)
            await response(scope, receive, send)
            return
        child_scope = {
            **scope,
            "path": scope["path"].removeprefix("/uploads") or "/",
        }
        mounted = StaticFiles(directory=directory, check_dir=False, html=False)
        await mounted(child_scope, receive, send)


class _UploadsRoute(Route):
    """Serve stored uploads at ``/uploads`` without listings or shadowing.

    Registered before ``_mount_spa`` in ``main.py`` and guarded here with an
    explicit ``Match.NONE`` for anything outside the ``/uploads`` tree, so
    neither the SPA catch-all nor the REST tree can shadow the other
    (design ADR-2, order-independent).
    """

    def __init__(self) -> None:
        super().__init__(
            "/uploads/{path:path}",
            _StaticUploads(),
            name="uploads",
            include_in_schema=False,
        )

    def matches(self, scope: Scope) -> tuple[Match, Scope]:
        if scope.get("type") != "http":
            return Match.NONE, scope
        path = scope["path"]
        if path != "/uploads" and not path.startswith("/uploads/"):
            return Match.NONE, scope
        return super().matches(scope)