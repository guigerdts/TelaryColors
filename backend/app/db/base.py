"""Declarative base for all ORM models.

Module models (users, pantone_colors, formulas, designs, ...) inherit
from ``Base``; Alembic imports this module so a single initial migration
sees every table.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Common base class for all Telary Color ORM models."""