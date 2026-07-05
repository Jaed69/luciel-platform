"""apps/tours/api/tests/test_catalogos.py

Plan 02.1.1-01 Task 1 — PUT /catalogos/{entidad}/{id} (codigo/nombre, activo preserved),
DELETE /catalogos/{entidad}/{id} referential check (409 with `detail.referencias` list),
RBAC for POST/PUT/DELETE on catalogos relaxed to admin + contabilidad (D-13).
"""
from datetime import date, datetime, timezone

import jwt
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.config import settings


pytestmark = pytest.mark.asyncio


def _token(role: str = "admin", user_id: int = 1) -> str:
    payload = {
        "sub": str(user_id),
        "email": f"{role}@tours.luciel.dev",
        "role": role,
        "name": role,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    return jwt.encode(payload, settings.NEXTAUTH_SECRET, algorithm=settings.JWT_ALGORITHM)


async def test_put_catalogo_updates_codigo_nombre(client):
    """PUT /catalogos/agencias/1 with {codigo, nombre} as admin → 200, response reflects new values."""
    r = await client.put(
        "/catalogos/agencias/1",
        json={"codigo": "AG-001-RENAMED", "nombre": "Agencia demo renamed"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["codigo"] == "AG-001-RENAMED"
    assert data["nombre"] == "Agencia demo renamed"


async def test_put_catalogo_preserva_activo(client, async_engine):
    """PUT does NOT mention activo — DB row's activo stays unchanged (D-03)."""
    r = await client.put(
        "/catalogos/agencias/1",
        json={"codigo": "AG-001", "nombre": "Agencia demo"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 200

    from app.models.tours import Agencias
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        row = (await session.execute(__import__("sqlalchemy").select(Agencias).where(Agencias.id == 1))).scalar_one()
        assert row.activo is True


async def test_put_catalogo_contabilidad_acepta(client):
    """PUT /catalogos/agencias/1 as contabilidad → 200 (D-13)."""
    r = await client.put(
        "/catalogos/agencias/1",
        json={"codigo": "AG-001", "nombre": "Agencia demo"},
        headers={"Authorization": f"Bearer {_token('contabilidad', user_id=2)}"},
    )
    assert r.status_code == 200, r.text


async def test_put_catalogo_vendedor_rechazado(client):
    """PUT /catalogos/agencias/1 as vendedor → 403."""
    r = await client.put(
        "/catalogos/agencias/1",
        json={"codigo": "AG-001", "nombre": "x"},
        headers={"Authorization": f"Bearer {_token('vendedor', user_id=3)}"},
    )
    assert r.status_code == 403


async def test_delete_catalogo_en_uso_retorna_409(client, async_engine):
    """DELETE /catalogos/agencias/1 with tours_servicios referencing it → 409 + detail.referencias."""
    from app.models.core import Asientos
    from app.models.tours import ToursServicios
    from app.models.core import MonedaCodigo
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        asiento = Asientos(fecha=date(2024, 1, 1), concepto="test-fixture")
        session.add(asiento)
        await session.flush()
        ts = ToursServicios(
            tour_id=1,
            vendedor_id=1,
            agencia_id=1,
            forma_pago_id=1,
            moneda=MonedaCodigo.PEN,
            monto=100,
            fecha=date(2024, 1, 1),
            asiento_id=asiento.id,
        )
        session.add(ts)
        await session.commit()

    r = await client.delete(
        "/catalogos/agencias/1",
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 409, r.text
    detail = r.json()["detail"]
    assert "referencian" in detail["mensaje"]
    referencias = detail["referencias"]
    assert {"tabla": "tours_servicios", "count": 1} in referencias


async def test_delete_catalogo_sin_referencias_retorna_200(client, async_engine):
    """DELETE /catalogos/agencias/1 when no tours_servicios references it → 200 + activo=false in DB."""
    r = await client.delete(
        "/catalogos/agencias/1",
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}

    from app.models.tours import Agencias
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        row = (await session.execute(__import__("sqlalchemy").select(Agencias).where(Agencias.id == 1))).scalar_one()
        assert row.activo is False


async def test_delete_catalogo_contabilidad_acepta(client):
    """DELETE /catalogos/agencias/{id} (sin refs) as contabilidad → 200 (D-13)."""
    # First re-create the agencia since other tests may have soft-deleted it.
    # Use a fresh row by creating one first.
    r = await client.post(
        "/catalogos/agencias",
        json={"codigo": "AG-DEL-CON", "nombre": "Para borrar"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 201
    new_id = r.json()["id"]

    r2 = await client.delete(
        f"/catalogos/agencias/{new_id}",
        headers={"Authorization": f"Bearer {_token('contabilidad', user_id=2)}"},
    )
    assert r2.status_code == 200, r2.text


async def test_delete_catalogo_vendedor_rechazado(client):
    """DELETE /catalogos/agencias/{id} as vendedor → 403."""
    r = await client.post(
        "/catalogos/agencias",
        json={"codigo": "AG-DEL-VEN", "nombre": "Para vendedor"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    new_id = r.json()["id"]
    r2 = await client.delete(
        f"/catalogos/agencias/{new_id}",
        headers={"Authorization": f"Bearer {_token('vendedor', user_id=3)}"},
    )
    assert r2.status_code == 403


async def test_delete_catalogo_monedas_bloqueado_si_hay_cuentas(client):
    """DELETE /catalogos/monedas/1 (PEN) when cuentas reference it → 409 + referencias con cuentas."""
    r = await client.delete(
        "/catalogos/monedas/1",
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 409, r.text
    detail = r.json()["detail"]
    assert "referencian" in detail["mensaje"]
    referencias = detail["referencias"]
    cuentas_ref = [ref for ref in referencias if ref["tabla"] == "cuentas"]
    assert len(cuentas_ref) >= 1
    assert cuentas_ref[0]["count"] >= 1