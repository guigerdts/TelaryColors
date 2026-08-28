"""add the samples table plus its supporting indexes

Revision ID: 0002_samples
Revises: 0001_initial
Create Date: 2026-08-28

Additive, handwritten migration that grows the schema from the seven original
tables (0001_initial) to eight by adding ``samples``. It only creates the new
table and its two lookup indexes ([``pantone_target_id``, ``status``]) and the
downgrade drops exactly those — no Fase 1 table is touched (design ADR / base
spec "Single Initial Migration"). Column types mirror the SQLAlchemy 2.0
model in ``app/modules/samples/models.py``: the ``status`` enum is stored as
VARCHAR (SQLite has no native enum), timestamps as naive-UTC DATETIME.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002_samples"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "samples",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "pantone_target_id",
            sa.Integer(),
            sa.ForeignKey("pantone_colors.id"),
            nullable=False,
        ),
        sa.Column(
            "formula_id",
            sa.Integer(),
            sa.ForeignKey("formulas.id"),
            nullable=True,
        ),
        sa.Column("photo_url", sa.String(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_samples_pantone_target_id", "samples", ["pantone_target_id"]
    )
    op.create_index("ix_samples_status", "samples", ["status"])


def downgrade() -> None:
    op.drop_index("ix_samples_status", table_name="samples")
    op.drop_index("ix_samples_pantone_target_id", table_name="samples")
    op.drop_table("samples")
