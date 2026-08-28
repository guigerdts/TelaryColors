"""Alembic environment — single script_directory shared by all revisions.

Imports every module's models so ``Base.metadata`` holds all seven tables
before autogenerate/compare runs. The target URL resolution order is:
1. ``DATABASE_URL`` env var (tests set this to a temp file), else
2. ``app.core.config.settings.database_url`` (default ``backend/data/app.db``).
"""

from logging.config import fileConfig
import os

from sqlalchemy import engine_from_config, pool
from alembic import context

from app.core.config import settings
from app.db.base import Base

# Register every module's tables on Base.metadata before comparing.
import app.modules.users.models  # noqa: F401
import app.modules.access_logs.models  # noqa: F401
import app.modules.pantone_colors.models  # noqa: F401
import app.modules.formulas.models  # noqa: F401
import app.modules.designs.models  # noqa: F401

# this is the Alembic Config object
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

database_url = os.environ.get("DATABASE_URL", settings.database_url)
config.set_main_option("sqlalchemy.url", database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL to stdout)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connect to the engine)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
