"""apps/tours/api/tests/test_schema_isolation.py

SC#9 — schema separation: tablas core NO referencian tablas tours; tablas tours
FK a core (asiento_id, usuario_id via audit_log). Futuros módulos (café) pueden
agregar sus tablas sin tocar core.
"""
import pytest

from sqlalchemy import inspect as sqla_inspect


pytestmark = pytest.mark.asyncio


async def test_schema_isolation_core_vs_tours(async_engine):
    """Core tables = {usuarios, contactos, cuentas, asientos, asiento_lineas, audit_log, modulos}.
    Tours tables = {agencias, vendedores, tours_catalogo, formas_pago, monedas, comision_reglas,
    liquidaciones, tours_servicios, liquidacion_asientos}.
    FKs core ← tours (asiento_id, usuario_id via audit_log) — no FKs tours ← core in metadata.
    """
    def _fn(conn):
        insp = sqla_inspect(conn)
        core_tables = {"usuarios", "contactos", "cuentas", "asientos", "asiento_lineas", "audit_log", "modulos"}
        tours_tables = {
            "agencias", "vendedores", "tours_catalogo", "formas_pago", "monedas",
            "comision_reglas", "liquidaciones", "tours_servicios", "liquidacion_asientos",
        }
        all_tables = set(insp.get_table_names())
        assert core_tables.issubset(all_tables), f"Missing core tables: {core_tables - all_tables}"
        assert tours_tables.issubset(all_tables), f"Missing tours tables: {tours_tables - all_tables}"

        # FKs in core tables MUST NOT reference tours tables.
        for core in core_tables:
            for fk in insp.get_foreign_keys(core):
                ref = fk["referred_table"]
                assert ref not in tours_tables, f"core table '{core}' has FK to tours table '{ref}' —schema isolation broken (SC#9)"

        # FKs in tours tables MUST reference either tours or core.
        for t in tours_tables:
            for fk in insp.get_foreign_keys(t):
                ref = fk["referred_table"]
                assert ref in core_tables | tours_tables, f"tours table '{t}' has FK to unknown table '{ref}'"

    async with async_engine.connect() as conn:
        await conn.run_sync(_fn)