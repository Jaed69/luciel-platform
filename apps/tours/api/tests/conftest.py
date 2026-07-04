"""apps/tours/api/tests/conftest.py

Wave 0 fixtures (VALIDATION.md). In-memory aiosqlite + httpx ASGI client.
All app imports are lazy inside fixtures so `pytest --collect-only` works.

NOTE: we set DATABASE_URL=sqlite+aiosqlite:///:memory: at module load so the
app's engine (imported at test-collection time via `from app.config import settings`)
binds to an in-memory DB, not the production /data/tours.db path. In tests we
override `get_session` to use a test-specific engine + sessionmaker so every
request hits the same in-memory DB we create schema on.
"""
import contextlib
import os
from collections.abc import AsyncIterator

# Force in-memory DB BEFORE any app import — module-level import of
# app.config in test files reads os.environ at import time.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("NEXTAUTH_SECRET", "test-secret-at-least-32-bytes-long!!")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool


@pytest_asyncio.fixture
async def async_engine():
    """In-memory aiosqlite engine with StaticPool — all sessions share one DB
    (default :memory: gives each connection its own DB, which breaks request↔test isolation)."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    try:
        yield engine
    finally:
        await engine.dispose()


async def _create_schema(engine) -> None:
    """Create all tables on the given engine if Task 2 models exist."""
    from app.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@pytest_asyncio.fixture
async def async_session(async_engine):
    """Async session bound to in-memory engine with schema created."""
    await _create_schema(async_engine)
    factory = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(async_engine) -> AsyncIterator[AsyncClient]:
    """ASGI client with get_session overridden to use the test engine.

    Creates schema + seeds once per test. Every request hits the same in-memory DB.
    """
    from app.main import app
    from app.dependencies import get_session
    from app.seed import run_if_empty

    await _create_schema(async_engine)
    factory = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)

    # Seed once per test.
    async with factory() as session:
        await run_if_empty(session)
        await session.commit()

    async def _override_get_session() -> AsyncSession:
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = _override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def authed(async_session):
    """Set current_user_id ContextVar (Task 2's app.audit) to a synthetic admin id=1."""
    with contextlib.suppress(Exception):
        from app.audit import current_user_id
        current_user_id.set(1)
    return {"id": 1, "email": "admin@tours.luciel.dev", "role": "admin", "name": "Admin"}