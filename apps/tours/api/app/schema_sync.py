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

        # 3. vendedores.usuario_id (D-32) — links a vendedor row to the Usuarios
        #    row that manages it. create_all can't add columns to an existing table.
        vend_cols = [row[1] for row in (await conn.execute(text("PRAGMA table_info(vendedores)"))).all()]
        if "usuario_id" not in vend_cols:
            logger.info("schema_sync: adding vendedores.usuario_id")
            await conn.execute(text("ALTER TABLE vendedores ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)"))
            await conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_vendedores_usuario_id ON vendedores (usuario_id)"
            ))

        # 4. agencia_tour_precios.precio nullable (D-32) — a price in a single
        # currency (USD-only or PEN-only) is now valid; AgenciaTourPrecioIn
        # enforces "at least one" at the API layer. SQLite has no ALTER COLUMN,
        # so relaxing NOT NULL means rebuilding the table (copy → drop → rename).
        # Safe: the router's own docstring confirms nothing else FKs into this
        # table, and this only runs when the old NOT NULL is still in place.
        precio_info = next(
            (row for row in (await conn.execute(text("PRAGMA table_info(agencia_tour_precios)"))).all() if row[1] == "precio"),
            None,
        )
        if precio_info is not None and precio_info[3] == 1:  # notnull flag set
            logger.info("schema_sync: relaxing agencia_tour_precios.precio to nullable")
            await conn.execute(text(
                "CREATE TABLE agencia_tour_precios_new ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "agencia_id INTEGER NOT NULL REFERENCES agencias(id), "
                "tour_id INTEGER NOT NULL REFERENCES tours_catalogo(id), "
                "precio NUMERIC(12, 2), "
                "precio_usd NUMERIC(12, 2), "
                "activo BOOLEAN NOT NULL DEFAULT 1, "
                "UNIQUE (agencia_id, tour_id))"
            ))
            await conn.execute(text(
                "INSERT INTO agencia_tour_precios_new (id, agencia_id, tour_id, precio, precio_usd, activo) "
                "SELECT id, agencia_id, tour_id, precio, precio_usd, activo FROM agencia_tour_precios"
            ))
            await conn.execute(text("DROP TABLE agencia_tour_precios"))
            await conn.execute(text("ALTER TABLE agencia_tour_precios_new RENAME TO agencia_tour_precios"))

        # 5. agencia_tour_precios.creado_en (D-33) — needed to tie-break which
        # agencia the venta modal defaults to when a tour has 2+ active prices.
        atp_cols = [row[1] for row in (await conn.execute(text("PRAGMA table_info(agencia_tour_precios)"))).all()]
        if "creado_en" not in atp_cols:
            logger.info("schema_sync: adding agencia_tour_precios.creado_en")
            # SQLite rejects ALTER TABLE ... ADD COLUMN with a non-constant
            # default (CURRENT_TIMESTAMP) — add nullable, then backfill.
            await conn.execute(text("ALTER TABLE agencia_tour_precios ADD COLUMN creado_en DATETIME"))
            await conn.execute(text(
                "UPDATE agencia_tour_precios SET creado_en = CURRENT_TIMESTAMP WHERE creado_en IS NULL"
            ))

        # 6. tours_servicios.creado_en (D-33) — needed for the DELETE
        # /ventas/{id} undo window (only allowed within 10s of creation).
        ts_cols = [row[1] for row in (await conn.execute(text("PRAGMA table_info(tours_servicios)"))).all()]
        if "creado_en" not in ts_cols:
            logger.info("schema_sync: adding tours_servicios.creado_en")
            await conn.execute(text("ALTER TABLE tours_servicios ADD COLUMN creado_en DATETIME"))
            await conn.execute(text(
                "UPDATE tours_servicios SET creado_en = CURRENT_TIMESTAMP WHERE creado_en IS NULL"
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

        # D-32 backfill — Usuarios(rol=vendedor) that predate the usuario_id
        # link (real accounts created before this feature shipped) need their
        # Vendedores row created now, or their RBAC (vendedor_id JWT claim)
        # resolves to nothing on next login. Insert-if-missing by usuario_id,
        # same codigo/nombre convention as the live auto-create in usuarios.py.
        linked_usuario_ids = {
            row[0] for row in (await conn.execute(
                text("SELECT usuario_id FROM vendedores WHERE usuario_id IS NOT NULL")
            )).all()
        }
        unlinked_vendedor_usuarios = (await conn.execute(
            text("SELECT id, username, activo FROM usuarios WHERE rol = 'vendedor'")
        )).all()
        for usuario_id, username, activo in unlinked_vendedor_usuarios:
            if usuario_id not in linked_usuario_ids:
                logger.info("schema_sync: backfilling vendedor link for usuario_id %s", usuario_id)
                await conn.execute(
                    text("INSERT INTO vendedores (codigo, nombre, activo, usuario_id) VALUES (:c, :n, :a, :u)"),
                    {"c": f"USR-{usuario_id}", "n": username, "a": activo, "u": usuario_id},
                )


async def ensure_schema(engine: AsyncEngine) -> None:
    """Full reconciliation: structure first, then reference data."""
    await ensure_schema_structure(engine)
    await ensure_reference_data(engine)
