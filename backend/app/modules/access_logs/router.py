"""Admin-only audit read endpoint (access-logs spec).

``GET /access-logs`` returns every audit row (login events and resource
mutations) ordered by timestamp descending (newest first; id as a stable
tiebreak for rows written in the same tick). It is admin-only — the audit
trail is a management surface, unlike the plant-level designs/formulas
CRUD. Reading the log is itself read-only: it never writes an audit row
(spec "Read-only action not logged").
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_roles
from app.modules.access_logs.models import AccessLog
from app.modules.access_logs.schemas import AccessLogOut
from app.modules.users.models import Role, User

router = APIRouter(prefix="/access-logs", tags=["access-logs"])


@router.get("", response_model=list[AccessLogOut])
def list_access_logs(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.admin)),
) -> list[AccessLog]:
    return db.scalars(
        select(AccessLog).order_by(AccessLog.timestamp.desc(), AccessLog.id.desc())
    ).all()