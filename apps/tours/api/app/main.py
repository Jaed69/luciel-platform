"""apps/tours/api/app/main.py

FastAPI entrypoint for tours-api. Task 2 adds:
- routers: auth, core, tours
- lifespan: alembic upgrade head + seed.run_if_empty + WAL PRAGMA (already on connect)
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings

logger = logging.getLogger("tours-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """On startup: run alembic upgrade head + seed if empty. WAL is already enabled per-connection."""
    # Defer imports so the module imports cleanly even before models exist.
    from app.database import engine
    from app.models import Base
    from app.seed import run_if_empty
    from app.database import async_session_factory

    # Ensure schema exists (works in dev without alembic CLI; in prod alembic upgrade head runs first).
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session_factory() as session:
        await run_if_empty(session)
        await session.commit()
    yield


app = FastAPI(
    title="tours-api",
    description="Panel contable para agencias de tours — Phase 02.1 luciel-platform.",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


# Register routers (import after app is defined to avoid circular imports).
from app.routers import auth as auth_router  # noqa: E402
from app.routers import core as core_router  # noqa: E402
from app.routers import solicitudes as solicitudes_router  # noqa: E402
from app.routers import tipos_tour as tipos_tour_router  # noqa: E402
from app.routers import tours as tours_router  # noqa: E402
from app.routers import usuarios as usuarios_router  # noqa: E402

app.include_router(auth_router.router)
app.include_router(core_router.router)
app.include_router(solicitudes_router.router)
app.include_router(tipos_tour_router.router)
app.include_router(tours_router.router)
app.include_router(usuarios_router.router)