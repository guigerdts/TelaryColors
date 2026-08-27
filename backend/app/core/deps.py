"""FastAPI dependencies (DI).

``get_db`` is the per-request session dependency used by all module
routers. ``get_current_user`` and ``require_roles`` land in the auth
slice (Phase 3) once the users module exists.
"""

from app.db.session import get_db

__all__ = ["get_db"]