"""Audit helper used by module routers (access-logs spec).

Every data-mutating action and every successful login records one row in
``access_logs`` (user_id, timestamp, action) inside the same transaction
the router commits. Read-only requests never log.

Action names follow a ``<resource>.<verb>`` convention (``user.create``,
``user.update``, ``user.delete``) plus the bare ``login`` action for
authentication events.
"""

from sqlalchemy.orm import Session

from app.modules.access_logs.models import AccessLog


def log_action(db: Session, user_id: int, action: str) -> None:
    """Queue an audit row in the current session (committed by the caller)."""
    db.add(AccessLog(user_id=user_id, action=action))