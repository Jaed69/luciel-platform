"""apps/tours/api/app/schema_sync.py

D-31 — idempotent startup schema/data reconciliation.

Prod never runs alembic (the deployed DB was born via create_all and has no
alembic_version table, so `alembic upgrade head` would fail on migration 001).
create_all only creates missing tables — it never alters existing ones and the
seed is gated on an empty DB. This module heals that drift on every boot:
column additions, indexes, and reference-data upserts equivalent to migrations
002-005, safe to run on any DB state (fresh or stale) and safe to re-run.
"""
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.seed import AGENCIAS, CHART, TIPOS_TOUR

logger = logging.getLogger("tours-api")


async def ensure_schema_structure(engine: AsyncEngine) -> None:
    """Structural drift: column additions + indexes. MUST run before the seed —
    the seed inserts ToursCatalogo rows via ORM, which fails on an old table
    missing the tiempo column."""
    async with engine.begin() as conn:
        # 1. tours_catalogo.tiempo (mig 004) — create_all can't add columns.
        cols = [row[1] for row in (await conn.execute(text("PRAGMA table_info(tours_catalogo)"))).all()]
        if "tiempo" not in cols:
            logger.info("schema_sync: adding tours_catalogo.tiempo")
            await conn.execute(text("ALTER TABLE tours_catalogo ADD COLUMN tiempo VARCHAR(64)"))

        # 2. usuarios.username unique index (mig 002). Fails loudly if real
        #    duplicate usernames exist — that needs manual resolution anyway.
        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_username ON usuarios (username)"
        ))


async def ensure_reference_data(engine: AsyncEngine) -> None:
    """Data drift (migs 004/005): insert-if-missing by codigo. MUST run after
    the seed — inserting CHART accounts first would make run_if_empty (gated on
    an empty cuentas table) skip the full seed on a fresh DB."""
    async with engine.begin() as conn:
        existing_cuentas = {row[0] for row in (await conn.execute(text("SELECT codigo FROM cuentas"))).all()}
        for codigo, nombre, tipo, moneda in CHART:
            if codigo not in existing_cuentas:
                logger.info("schema_sync: inserting cuenta %s", codigo)
                await conn.execute(
                    text("INSERT INTO cuentas (codigo, nombre, tipo, moneda, activo) VALUES (:c, :n, :t, :m, 1)"),
                    {"c": codigo, "n": nombre, "t": tipo, "m": moneda},
                )

        existing_agencias = {row[0] for row in (await conn.execute(text("SELECT codigo FROM agencias"))).all()}
        for codigo, nombre in AGENCIAS:
            if codigo not in existing_agencias:
                logger.info("schema_sync: inserting agencia %s", codigo)
                await conn.execute(
                    text("INSERT INTO agencias (codigo, nombre, activo) VALUES (:c, :n, 1)"),
                    {"c": codigo, "n": nombre},
                )

        existing_tours = {row[0] for row in (await conn.execute(text("SELECT codigo FROM tours_catalogo"))).all()}
        for codigo, nombre in TIPOS_TOUR:
            if codigo not in existing_tours:
                logger.info("schema_sync: inserting tipo de tour %s", codigo)
                await conn.execute(
                    text("INSERT INTO tours_catalogo (codigo, nombre, moneda_default, activo) VALUES (:c, :n, 'PEN', 1)"),
                    {"c": codigo, "n": nombre},
                )


async def ensure_schema(engine: AsyncEngine) -> None:
    """Full reconciliation: structure first, then reference data."""
    await ensure_schema_structure(engine)
    await ensure_reference_data(engine)
