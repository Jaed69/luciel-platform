"""apps/tours/api/tests/conftest.py

Wave 0 fixtures (VALIDATION.md). In-memory aiosqlite + httpx ASGI client.
All imports are lazy inside fixtures so `pytest --collect-only` works even
before Task 2 lands models/audit/database.py.

Task 2 will populate `app.models`, `app.audit.current_user_id`, `app.database.Base`
— this conftest will then light up automatically.
"""
import asyncio
import contextlib
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


@pytest_asyncio.fixture
async def async_engine():
    """In-memory aiosqlite engine, recreated per test for isolation."""
    from sqlalchemy.ext.asyncio import create_async_engine
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False},
    )
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def async_session(async_engine):
    """Async session bound to in-memory engine. Task 2 will create_all models first."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
    sessionmaker = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)
    async with async_engine.begin() as conn:
        with contextlib.suppress(Exception):
            # Task 2 defines Base; if absent (Task 1 only), skip schema creation.
            from app.database import Base
            await conn.run_sync(Base.metadata.create_all)
    async with sessionmaker() as session:
        yield session


@pytest_asyncio.fixture
async def client(async_engine) -> AsyncIterator[AsyncClient]:
    """ASGI client bound to app.main. Schema created if Task 2 models exist."""
    from app.main import app
    async with async_engine.begin() as conn:
        with contextlib.suppress(Exception):
            from app.database import Base
            await conn.run_sync(Base.metadata.create_all)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def authed(async_session):
    """Set current_user_id ContextVar (Task 2's app.audit) to a synthetic admin id=1."""
    with contextlib.suppress(Exception):
        from app.audit import current_user_id
        current_user_id.set(1)
    return {"id": 1, "email": "admin@tours.luciel.dev", "role": "admin", "name": "Admin"}