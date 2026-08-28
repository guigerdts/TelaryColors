"""Application entry point.

Boot: ``python -m uvicorn app.main:app`` from the backend venv
(never the PATH ``uvicorn`` binary — broken Termux stub).

Single-origin deployment: this app serves the REST API under /api/v1
and (from Phase 8) the built SPA from the same origin (no CORS, per
base spec "Single-Origin Deployment").
"""

from fastapi import FastAPI

from app.core.config import settings
from app.modules.auth.router import router as auth_router
from app.modules.designs.router import router as designs_router
from app.modules.formulas.router import router as formulas_router
from app.modules.pantone_colors.router import router as pantone_router
from app.modules.users.router import router as users_router

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    """Build the FastAPI application with the versioned REST routers."""
    app = FastAPI(title=settings.app_name)
    app.include_router(auth_router, prefix=API_PREFIX)
    app.include_router(users_router, prefix=API_PREFIX)
    app.include_router(pantone_router, prefix=API_PREFIX)
    app.include_router(formulas_router, prefix=API_PREFIX)
    app.include_router(designs_router, prefix=API_PREFIX)
    return app


app = create_app()