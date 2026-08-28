"""Shared domain enums stored as VARCHAR columns.

SQLite has no native enum type, so each enum maps to a ``String`` column via
``sa.Enum(..., native_enum=False)``. This keeps the schema simple and portable
while still validating values on the Python side (design ADR "enums as Python
enum with String column"). ``PaintType`` is shared by ``pantone_colors`` and
``designs``; ``Unit`` is owned by ``formula_ingredients``.
"""

from enum import Enum


class PaintType(str, Enum):
    reactiva = "reactiva"
    pigmento = "pigmento"


class Unit(str, Enum):
    g = "g"
    kg = "kg"
