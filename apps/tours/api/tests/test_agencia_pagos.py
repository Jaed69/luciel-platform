"""apps/tours/api/tests/test_agencia_pagos.py

/agencia-pagos — pagos registrados a una agencia (D-30). Cada pago postea un
asiento débito 202-AGENCIAS-POR-PAGAR-{moneda} / crédito 101-CAJA-{moneda},
reduciendo la deuda acumulada por `ToursServicios.costo`.
"""
from datetime import datetime, timezone

import jwt
import pytest
from sqlalchemy import select
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


async def _registrar_venta(client, *, agencia_id: int = 1, monto: float = 100, costo: float = 60, moneda: str = "PEN", fecha: str = "2026-07-04") -> dict:
    payload = {
        "tour_id": 1,
        "vendedor_id": 1,
        "agencia_id": agencia_id,
        "forma_pago_id": 1,
        "moneda": moneda,
        "monto": monto,
        "costo": costo,
        "fecha": fecha,
    }
    r = await client.post("/ventas", json=payload, headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 201, r.text
    return r.json()


async def test_saldo_agencia_reflects_costo_sin_pagos(client):
    await _registrar_venta(client, agencia_id=1, monto=100, costo=60)
    r = await client.get("/agencias/1/saldo", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200, r.text
    assert r.json()["PEN"] == 60
    assert r.json()["USD"] == 0


async def test_post_agencia_pago_reduces_saldo_and_posts_asiento(client, async_engine):
    await _registrar_venta(client, agencia_id=1, monto=100, costo=60)

    r = await client.post(
        "/agencia-pagos",
        json={"agencia_id": 1, "fecha": "2026-07-10", "monto": 60, "moneda": "PEN", "metodo": "deposito", "referencia": "DEP-001"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["asiento_id"] > 0

    r2 = await client.get("/agencias/1/saldo", headers={"Authorization": f"Bearer {_token()}"})
    assert r2.json()["PEN"] == 0

    from app.models.core import AsientoLineas, Cuentas
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        lineas = list((await session.execute(
            select(AsientoLineas, Cuentas.codigo)
            .join(Cuentas, Cuentas.id == AsientoLineas.cuenta_id)
            .where(AsientoLineas.asiento_id == data["asiento_id"])
        )).all())
        by_codigo = {codigo: ln for ln, codigo in lineas}
        assert float(by_codigo["202-AGENCIAS-POR-PAGAR-PEN"].debe) == 60
        assert float(by_codigo["101-CAJA-PEN"].haber) == 60


async def test_post_agencia_pago_vendedor_403(client):
    r = await client.post(
        "/agencia-pagos",
        json={"agencia_id": 1, "fecha": "2026-07-10", "monto": 60, "moneda": "PEN", "metodo": "deposito"},
        headers={"Authorization": f"Bearer {_token('vendedor')}"},
    )
    assert r.status_code == 403


async def test_saldo_agencia_no_mezcla_monedas_ni_agencias(client):
    await _registrar_venta(client, agencia_id=1, monto=100, costo=60, moneda="PEN")
    await _registrar_venta(client, agencia_id=1, monto=50, costo=20, moneda="USD")
    await _registrar_venta(client, agencia_id=2, monto=200, costo=90, moneda="PEN")

    r1 = await client.get("/agencias/1/saldo", headers={"Authorization": f"Bearer {_token()}"})
    assert r1.json() == {"agencia_id": 1, "PEN": 60, "USD": 20}

    r2 = await client.get("/agencias/2/saldo", headers={"Authorization": f"Bearer {_token()}"})
    assert r2.json() == {"agencia_id": 2, "PEN": 90, "USD": 0}


async def test_get_agencia_pagos_filter_by_agencia(client):
    await _registrar_venta(client, agencia_id=1, monto=100, costo=60)
    await _registrar_venta(client, agencia_id=2, monto=100, costo=40)
    await client.post(
        "/agencia-pagos",
        json={"agencia_id": 1, "fecha": "2026-07-10", "monto": 60, "moneda": "PEN", "metodo": "comprobante", "nota": "recibo #1"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    await client.post(
        "/agencia-pagos",
        json={"agencia_id": 2, "fecha": "2026-07-10", "monto": 40, "moneda": "PEN", "metodo": "deposito"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    r = await client.get("/agencia-pagos?agencia_id=1", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200
    pagos = r.json()
    assert len(pagos) == 1
    assert pagos[0]["agencia_id"] == 1
