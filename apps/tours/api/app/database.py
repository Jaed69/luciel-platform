"""apps/tours/api/app/database.py

Async SQLAlchemy engine + sessionmaker. SQLite WAL mode enabled on every
new connection (Pitfall 3). Base declarative class lives here so models can
subclass it and migrations/conftest can reach metadata.
"""
from sqlalchemy import event
from sqlalchemy.orm import DeclarativeBase, sessionmaker as _sm  # noqa: F401
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings


class Base(DeclarativeBase):
    """Declarative base shared by core + tours models."""
    pass


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@event.listens_for(engine.sync_engine, "connect")
def _enable_sqlite_pragmas(dbapi_conn, _conn_record):
    """Pitfall 3: enable WAL + FK enforcement on every new SQLite connection."""
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL;")
    cur.execute("PRAGMA foreign_keys=ON;")
    cur.close()


async def get_session() -> AsyncSession:
    """FastAPI dependency — yields an async session. Caller manages commit/rollback."""
    async with async_session_factory() as session:
        yield session