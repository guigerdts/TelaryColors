"""SQLite engine and session factory.

The engine applies the pragmas the app relies on:
- ``PRAGMA foreign_keys=ON`` — FK enforcement (SQLite defaults off)
- ``PRAGMA journal_mode=WAL`` — LAN multi-user reads with one writer

Sessions are request-scoped and injected through ``app.core.deps.get_db``.
"""

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine as _sa_create_engine, event
from sqlalchemy.orm import Session, sessionmaker


def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


@lru_cache(maxsize=8)
def create_engine(database_url: str) -> Engine:
    """Build a cached engine; SQLite URLs get the WAL + FK pragmas."""
    kwargs = (
        {"connect_args": {"check_same_thread": False}}
        if database_url.startswith("sqlite")
        else {}
    )
    engine = _sa_create_engine(database_url, **kwargs)
    if engine.dialect.name == "sqlite":
        event.listen(engine, "connect", _set_sqlite_pragma)
    return engine


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Create a sessionmaker bound to ``engine``."""
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Dependency: yield a request-scoped session, always closed."""
    from app.core.config import settings

    session_factory = create_session_factory(create_engine(settings.database_url))
    db = session_factory()
    try:
        yield db
    finally:
        db.close()