"""apps/tours/api/tests/test_schema_sync.py

D-31 — ensure_schema: startup reconciliation for deployed DBs that predate
migrations 002-005. Prod runs create_all only (never alembic), so schema/data
drift must be healed idempotently at boot: the tours_catalogo.tiempo column,
the usuarios.username unique index, the 202 payable accounts, the 3 real
agencias, and the 9 real tour types.
"""
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

pytestmark = pytest.mark.asyncio

# Old prod chart — pre-D-30, no 202 accounts.
_OLD_CHART = [
    ("101-CAJA-PEN", "Caja (PEN)", "activo", "PEN"),
    ("101-CAJA-USD", "Caja (USD)", "activo", "USD"),
    ("201-COMISIONES-POR-PAGAR", "Comisiones por pagar", "pasivo", "PEN"),
    ("401-INGRESOS-TOURS-PEN", "Ingresos por tours (PEN)", "ingreso", "PEN"),
    ("401-INGRESOS-TOURS-USD", "Ingresos por tours (USD)", "ingreso", "USD"),
    ("501-COSTOS-TOURS-PEN", "Costos de tours (PEN)", "costo", "PEN"),
    ("501-COSTOS-TOURS-USD", "Costos de tours (USD)", "costo", "USD"),
    ("501-COSTOS-COMISIONES", "Costos por comisiones", "costo", "PEN"),
    ("672-GAN-PERD-TC", "Ganancia/Pérdida por tipo de cambio", "gasto", "PEN"),
]


async def _build_stale_prod_db(engine) -> None:
    """Recreate the deployed DB state: tours_catalogo WITHOUT tiempo, cuentas
    populated without the 202 accounts, only the old demo agencia/tour."""
    from app.models import Base

    async with engine.begin() as conn:
        # Old-shape tours_catalogo BEFORE create_all so IF NOT EXISTS skips it.
        await conn.execute(text("""
            CREATE TABLE tours_catalogo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo VARCHAR(32) NOT NULL UNIQUE,
                nombre VARCHAR(128) NOT NULL,
                descripcion TEXT,
                precio_default NUMERIC(12, 2),
                precio_default_usd NUMERIC(12, 2),
                moneda_default VARCHAR(3) NOT NULL DEFAULT 'PEN',
                activo BOOLEAN NOT NULL DEFAULT 1
            )
        """))
        # Old-shape agencia_tour_precios BEFORE create_all — precio NOT NULL (pre-D-32).
        await conn.execute(text("""
            CREATE TABLE agencia_tour_precios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agencia_id INTEGER NOT NULL REFERENCES agencias(id),
                tour_id INTEGER NOT NULL REFERENCES tours_catalogo(id),
                precio NUMERIC(12, 2) NOT NULL,
                precio_usd NUMERIC(12, 2),
                activo BOOLEAN NOT NULL DEFAULT 1,
                UNIQUE (agencia_id, tour_id)
            )
        """))
        await conn.run_sync(Base.metadata.create_all)
        for codigo, nombre, tipo, moneda in _OLD_CHART:
            await conn.execute(
                text("INSERT INTO cuentas (codigo, nombre, tipo, moneda, activo) VALUES (:c, :n, :t, :m, 1)"),
                {"c": codigo, "n": nombre, "t": tipo, "m": moneda},
            )
        await conn.execute(text("INSERT INTO agencias (codigo, nombre, activo) VALUES ('AG-001', 'Agencia demo', 1)"))
        await conn.execute(text("INSERT INTO tours_catalogo (codigo, nombre) VALUES ('T-001', 'City Tour Cusco')"))
        await conn.execute(text("INSERT INTO agencia_tour_precios (agencia_id, tour_id, precio) VALUES (1, 1, 120)"))


async def test_ensure_schema_heals_stale_prod_db(async_engine):
    from app.schema_sync import ensure_schema

    await _build_stale_prod_db(async_engine)
    await ensure_schema(async_engine)

    async with async_engine.begin() as conn:
        cols = [row[1] for row in (await conn.execute(text("PRAGMA table_info(tours_catalogo)"))).all()]
        assert "tiempo" in cols

        cuentas = {row[0] for row in (await conn.execute(text("SELECT codigo FROM cuentas"))).all()}
        assert "202-AGENCIAS-POR-PAGAR-PEN" in cuentas
        assert "202-AGENCIAS-POR-PAGAR-USD" in cuentas

        agencias = {row[0] for row in (await conn.execute(text("SELECT codigo FROM agencias"))).all()}
        assert {"AG-CUSCOTOP", "AG-ANDEAN", "AG-GUTY"}.issubset(agencias)
        assert "AG-001" in agencias  # old row untouched

        tours = {row[0] for row in (await conn.execute(text("SELECT codigo FROM tours_catalogo"))).all()}
        assert "T-7LAGUNAS" in tours and "T-MACHUPICCHU" in tours and len(tours) == 10  # 9 + old demo

        indexes = [row[1] for row in (await conn.execute(text("PRAGMA index_list(usuarios)"))).all()]
        assert "uq_usuarios_username" in indexes

        precio_info = next(
            row for row in (await conn.execute(text("PRAGMA table_info(agencia_tour_precios)"))).all() if row[1] == "precio"
        )
        assert precio_info[3] == 0, "precio should be nullable after heal"  # notnull flag
        old_row = (await conn.execute(
            text("SELECT precio FROM agencia_tour_precios WHERE agencia_id = 1 AND tour_id = 1")
        )).first()
        assert old_row is not None and float(old_row[0]) == 120.0  # data preserved through table rebuild


async def test_ensure_schema_is_idempotent(async_engine):
    from app.schema_sync import ensure_schema

    await _build_stale_prod_db(async_engine)
    await ensure_schema(async_engine)
    await ensure_schema(async_engine)  # second run: no error, no dupes

    async with async_engine.begin() as conn:
        n_tours = (await conn.execute(text("SELECT COUNT(*) FROM tours_catalogo"))).scalar_one()
        assert n_tours == 10
        n_202 = (await conn.execute(text("SELECT COUNT(*) FROM cuentas WHERE codigo LIKE '202%'"))).scalar_one()
        assert n_202 == 2
        n_precios = (await conn.execute(text("SELECT COUNT(*) FROM agencia_tour_precios"))).scalar_one()
        assert n_precios == 1  # table-rebuild heal ran twice, no duplication/data loss


async def test_ensure_schema_on_fresh_db_noop(async_engine):
    from app.models import Base
    from app.schema_sync import ensure_schema

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await ensure_schema(async_engine)
    await ensure_schema(async_engine)

    async with async_engine.begin() as conn:
        cols = [row[1] for row in (await conn.execute(text("PRAGMA table_info(tours_catalogo)"))).all()]
        assert "tiempo" in cols
