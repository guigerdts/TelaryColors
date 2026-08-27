"""Declarative base for all ORM models plus a shared UTC clock helper.

Module models (users, pantone_colors, formulas, designs, ...) inherit
from ``Base``; Alembic imports this module so a single initial migration
sees every table.

Timestamps are stored as naive-UTC datetimes (SQLite has no native timezone
type). ``utcnow`` is the single source of the application clock (design
ADR-8: UTC everywhere).
"""

from datetime import datetime, timezone

from sqlalchemy.orm import DeclarativeBase


def utcnow() -> datetime:
    """Return the current UTC time as a naive datetime for SQLite storage."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    """Common base class for all Telary Color ORM models."""