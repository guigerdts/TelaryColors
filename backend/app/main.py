"""Application entry point.

Boot: ``python -m uvicorn app.main:app`` from the backend venv
(never the PATH ``uvicorn`` binary — broken Termux stub).

Single-origin deployment: this app serves the built SPA and the REST
API from one origin (no CORS). Routers and the static mount land in
later slices (modules / Phase 8); this factory only assembles the app.
"""

from fastapi import FastAPI

from app.core.config import settings


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    app = FastAPI(title=settings.app_name)
    return app


app = create_app()