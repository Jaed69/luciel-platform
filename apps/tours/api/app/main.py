"""apps/tours/api/app/main.py

FastAPI entrypoint for tours-api.
- routers: auth, core, solicitudes, tipos_tour, tours, usuarios, agencia_*
- lifespan: create_all + ensure_schema (D-31 idempotent drift healing) +
  seed.run_if_empty. Alembic is NOT run at boot — the deployed DB has no
  alembic_version table; migrations exist as dev/history only.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings

logger = logging.getLogger("tours-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """On startup: create_all (new tables) + ensure_schema (column/index/data
    drift, D-31) + seed if empty. WAL is already enabled per-connection."""
    # Defer imports so the module imports cleanly even before models exist.
    from app.database import engine
    from app.models import Base
    from app.schema_sync import ensure_reference_data, ensure_schema_structure
    from app.seed import run_if_empty
    from app.database import async_session_factory

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Order matters (D-31): structure fixes BEFORE seed (seed's ORM inserts need
    # the tiempo column), reference-data upserts AFTER seed (inserting chart
    # accounts first would trip run_if_empty's empty-cuentas gate on fresh DBs).
    await ensure_schema_structure(engine)
    async with async_session_factory() as session:
        await run_if_empty(session)
        await session.commit()
    await ensure_reference_data(engine)
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
from app.routers import agencia_pagos as agencia_pagos_router  # noqa: E402
from app.routers import agencia_precios as agencia_precios_router  # noqa: E402
from app.routers import auth as auth_router  # noqa: E402
from app.routers import core as core_router  # noqa: E402
from app.routers import solicitudes as solicitudes_router  # noqa: E402
from app.routers import tipos_tour as tipos_tour_router  # noqa: E402
from app.routers import tours as tours_router  # noqa: E402
from app.routers import usuarios as usuarios_router  # noqa: E402

app.include_router(agencia_pagos_router.router)
app.include_router(agencia_precios_router.router)
app.include_router(auth_router.router)
app.include_router(core_router.router)
app.include_router(solicitudes_router.router)
app.include_router(tipos_tour_router.router)
app.include_router(tours_router.router)
app.include_router(usuarios_router.router)