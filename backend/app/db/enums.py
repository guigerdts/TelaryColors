"""Shared domain enums stored as VARCHAR columns.

SQLite has no native enum type, so each enum maps to a ``String`` column via
``sa.Enum(..., native_enum=False)``. This keeps the schema simple and portable
while still validating values on the Python side (design ADR "enums as Python
enum with String column"). ``PaintType`` is shared by ``pantone_colors`` and
``designs``; ``Unit`` is owned by ``formula_ingredients``; ``SampleStatus`` is
owned by ``samples``; ``ItemType`` and ``TransactionType`` are owned by
``inventory_items``/``inventory_transactions`` (inventory spec "Inventory Data
Model", design ADR-5).
"""

from enum import Enum


class PaintType(str, Enum):
    reactiva = "reactiva"
    pigmento = "pigmento"


class Unit(str, Enum):
    g = "g"
    kg = "kg"


class SampleStatus(str, Enum):
    aprobada = "aprobada"
    archivada_reutilizable = "archivada_reutilizable"
    descartada = "descartada"


class ItemType(str, Enum):
    colorante = "colorante"
    insumo_pasta_madre = "insumo_pasta_madre"


class TransactionType(str, Enum):
    entrada = "entrada"
    consumo = "consumo"
    ajuste = "ajuste"


class DesignSource(str, Enum):
    auto = "auto"
    manual = "manual"
