"""Access-log ORM model — ``access_logs`` table (design Data Model,
access-logs spec).

A row records a data-mutating action or a login for a user. The FK to
``users`` never cascades on update, so a later profile change cannot
auto-modify an audit row (spec "Audit Record Integrity").
"""

from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utcnow


class AccessLog(Base):
    __tablename__ = "access_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
