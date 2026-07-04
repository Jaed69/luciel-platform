"""apps/tours/api/tests/test_ventas.py

POST /ventas e2e + /simular + default global comisión (D-10).
"""
from datetime import date

import jwt
import pytest
from sqlalchemy import select

from app.config import settings


pytestmark = pytest.mark.asyncio


def _token(role: str = "admin", user_id: int = 1) -> str:
    from datetime import datetime, timezone
    payload = {
        "sub": str(user_id),
        "email": f"{role}@tours.luciel.dev",
        "role": role,
        "name": role,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    return jwt.encode(payload, settings.NEXTAUTH_SECRET, algorithm=settings.JWT_ALGORITHM)


async def test_post_venta_creates_asiento_and_tour_servicio(client):
    """POST /ventas → 201 with asiento_id + tour_servicio_id; tour_servicio row exists with FK."""
    payload = {
        "tour_id": 1,
        "vendedor_id": 1,
        "agencia_id": 1,
        "forma_pago_id": 1,
        "moneda": "PEN",
        "monto": 100,
        "costo": 0,
        "fecha": "2026-07-04",
    }
    r = await client.post("/ventas", json=payload, headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 201, r.text
    data = r.json()
    assert "asiento_id" in data and "tour_servicio_id" in data
    assert data["asiento_id"] > 0


async def test_venta_asiento_is_balanced(client, async_engine):
    """The asiento produced by POST /ventas has sum(debe)==sum(haber)."""
    payload = {
        "tour_id": 1,
        "vendedor_id": 1,
        "agencia_id": 1,
        "forma_pago_id": 1,
        "moneda": "PEN",
        "monto": 250,
        "costo": 0,
        "fecha": "2026-07-04",
    }
    r = await client.post("/ventas", json=payload, headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 201
    asiento_id = r.json()["asiento_id"]

    from app.models.core import AsientoLineas
    from sqlalchemy.ext.asyncio import async_sessionmaker
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        lineas = (await session.execute(select(AsientoLineas).where(AsientoLineas.asiento_id == asiento_id))).scalars().all()
        total_debe = sum(float(l.debe) for l in lineas)
        total_haber = sum(float(l.haber) for l in lineas)
        assert abs(total_debe - total_haber) < 1e-6, f"debe={total_debe} haber={total_haber}"


async def test_venta_tour_servicio_has_null_liquidacion(client, async_engine):
    """tour_servicio row has liquidacion_id=NULL after POST /ventas."""
    payload = {
        "tour_id": 1,
        "vendedor_id": 1,
        "agencia_id": 1,
        "forma_pago_id": 1,
        "moneda": "PEN",
        "monto": 80,
        "costo": 0,
        "fecha": "2026-07-04",
    }
    r = await client.post("/ventas", json=payload, headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 201
    tour_servicio_id = r.json()["tour_servicio_id"]

    from app.models.tours import ToursServicios
    from sqlalchemy.ext.asyncio import async_sessionmaker
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        ts = (await session.execute(select(ToursServicios).where(ToursServicios.id == tour_servicio_id))).scalar_one()
        assert ts.liquidacion_id is None


async def test_simular_returns_default_global_50(client):
    """/simular with no specific rule returns porcentaje=50 (default global seed — D-10)."""
    r = await client.get(
        "/simular?vendedor_id=1&tour_id=1&monto=100",
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["porcentaje"] == 50
    assert data["comision"] == 50  # 100 * 50/100