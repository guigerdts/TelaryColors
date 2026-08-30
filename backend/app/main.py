"""Application entry point.

Boot: ``python -m uvicorn app.main:app`` from the backend venv
(never the PATH ``uvicorn`` binary — broken Termux stub).

Single-origin deployment (base spec REQ-04, design ADR-2): this app serves
the REST API under /api/v1 AND the built SPA from the same origin — no
CORS. Stored photo uploads are served at /uploads through a guarded static
route mounted before the SPA. The SPA build is served from ``frontend/dist``
at ``/`` whenever the directory exists at app-creation time; without a
build the mount is skipped (html=True needs the directory to exist), so
API-only deployments and the test suite are unaffected.
"""

from pathlib import Path

from fastapi import FastAPI
from starlette.routing import Match, Route
from starlette.staticfiles import StaticFiles

from app.core.config import settings
from app.modules.access_logs.router import router as access_logs_router
from app.modules.auth.router import router as auth_router
from app.modules.designs.router import router as designs_router
from app.modules.formulas.router import router as formulas_router
from app.modules.inventory.router import router as inventory_router
from app.modules.pantone_colors.router import router as pantone_router
from app.modules.samples.router import router as samples_router
from app.modules.samples.uploads import _UploadsRoute
from app.modules.users.router import router as users_router

API_PREFIX = "/api/v1"

# Repo-root-relative SPA build: backend/app/main.py → parents[2] == repo root.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


class _SPARoute(Route):
    """Serve the built SPA at ``/`` without ever shadowing the REST tree.

    A plain ``Mount("/", StaticFiles(...))`` matches every path, so any
    route registered after it (e.g. tests' dynamic routes) is shadowed.
    This route instead yields (``Match.NONE``) for non-HTTP scopes and for
    any path under ``/api/`` or ``/uploads/``, letting the router keep
    walking to the API and uploads routes; everything else is served from
    ``frontend/dist`` with ``html=True`` (directory requests return
    ``index.html``). The ``/uploads/`` guard mirrors ``_UploadsRoute`` so
    the SPA catch-all can never capture upload paths even if the upload
    route is re-ordered (ADR-2 double guard, order-independent).
    """

    def matches(self, scope):
        if scope.get("type") != "http":
            return Match.NONE, scope
        path = scope["path"]
        if path.startswith("/api/") or path == "/uploads" or path.startswith(
            "/uploads/"
        ):
            return Match.NONE, scope
        return super().matches(scope)


def _mount_spa(app: FastAPI) -> None:
    """Serve the SPA build at ``/`` when a build exists (single-origin).

    The route is appended LAST so the REST routes keep matching first.
    CORS is never enabled — browser and API share one origin (ADR-2).
    """
    if FRONTEND_DIST.is_dir():
        app.router.routes.append(
            _SPARoute(
                "/{path:path}",
                StaticFiles(directory=FRONTEND_DIST, html=True),
                name="spa",
                include_in_schema=False,
            )
        )


def create_app() -> FastAPI:
    """Build the FastAPI application with the versioned REST routers."""
    app = FastAPI(title=settings.app_name)
    app.include_router(auth_router, prefix=API_PREFIX)
    app.include_router(users_router, prefix=API_PREFIX)
    app.include_router(pantone_router, prefix=API_PREFIX)
    app.include_router(formulas_router, prefix=API_PREFIX)
    app.include_router(designs_router, prefix=API_PREFIX)
    app.include_router(inventory_router, prefix=API_PREFIX)
    app.include_router(access_logs_router, prefix=API_PREFIX)
    app.include_router(samples_router, prefix=API_PREFIX)
    # Guarded /uploads static mount BEFORE the SPA catch-all (design ADR-2):
    # neither tree can shadow the other, in either registration order.
    app.router.routes.append(_UploadsRoute())
    _mount_spa(app)
    return app


app = create_app()