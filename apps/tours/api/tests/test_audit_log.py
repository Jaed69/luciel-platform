"""apps/tours/api/tests/test_audit_log.py

Audit listener captures INSERT/UPDATE/DELETE + redacts password_hash (D-21/D-26).
"""
import json

import pytest
from sqlalchemy import select

from app.audit import current_user_id


pytestmark = pytest.mark.asyncio


async def test_insert_writes_audit_log(authed, async_session):
    """INSERT on an auditable table leaves an 'I' audit_log row."""
    from app.models.tours import Agencias
    from app.models.core import AuditLog

    async with async_session.begin():
        async_session.add(AgenciaInstance := Agencias(codigo="AG-TEST", nombre="Test agencia"))

    rows = (await async_session.execute(select(AuditLog).where(AuditLog.tabla == "agencias"))).scalars().all()
    assert len(rows) >= 1
    row = rows[-1]
    assert row.operacion == "I"
    assert row.usuario_id == 1  # set by authed fixture
    datos = json.loads(row.datos_despues)
    assert datos["codigo"] == "AG-TEST"
    assert row.datos_antes is None


async def test_update_captures_datos_antes(authed, async_session):
    """UPDATE on an auditable table leaves 'U' with datos_antes (committed_state — Pitfall 2)."""
    from app.models.tours import Agencias
    from app.models.core import AuditLog

    async with async_session.begin():
        async_session.add(Agencias(codigo="AG-U1", nombre="Before"))
    # mutate
    async with async_session.begin():
        agencia = (await async_session.execute(select(Agencias).where(Agencias.codigo == "AG-U1"))).scalar_one()
        agencia.nombre = "After"

    row = (await async_session.execute(select(AuditLog).where(AuditLog.tabla == "agencias", AuditLog.operacion == "U").order_by(AuditLog.id.desc()))).scalars().first()
    assert row is not None
    antes = json.loads(row.datos_antes)
    despues = json.loads(row.datos_despues)
    assert antes["nombre"] == "Before"
    assert despues["nombre"] == "After"


async def test_delete_captures_datos_antes(authed, async_session):
    """DELETE on an auditable table leaves 'D' with datos_antes and datos_despues=None."""
    from app.models.tours import FormasPago
    from app.models.core import AuditLog

    async with async_session.begin():
        async_session.add(FormasPago(nombre="ToDelete"))
    async with async_session.begin():
        fp = (await async_session.execute(select(FormasPago).where(FormasPago.nombre == "ToDelete"))).scalar_one()
        await async_session.delete(fp)

    row = (await async_session.execute(select(AuditLog).where(AuditLog.tabla == "formas_pago", AuditLog.operacion == "D").order_by(AuditLog.id.desc()))).scalars().first()
    assert row is not None
    antes = json.loads(row.datos_antes)
    assert antes["nombre"] == "ToDelete"
    assert row.datos_despues is None


async def test_password_hash_redacted_in_audit(authed, async_session):
    """Usuarios INSERT audit_log row has password_hash=None (D-26)."""
    from app.models.core import Usuarios, AuditLog, Rol

    async with async_session.begin():
        async_session.add(Usuarios(email="redact@tours.luciel.dev", username="redact", password_hash="secret-hash", rol=Rol.vendedor))

    row = (await async_session.execute(select(AuditLog).where(AuditLog.tabla == "usuarios").order_by(AuditLog.id.desc()))).scalars().first()
    assert row is not None
    datos = json.loads(row.datos_despues)
    assert datos["password_hash"] is None