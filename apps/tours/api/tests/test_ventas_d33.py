"""apps/tours/api/tests/test_ventas_d33.py

D-33 — venta modal UX backend pieces living on /ventas:
  #4 motivo_costo/motivo_monto validation (closed enum, merged into
     tours_servicios.metadata_ alongside notas).
  #5 GET /ventas/check-duplicado.
  #6 DELETE /ventas/{id} — undo within a 10s window.
"""
import json
from datetime import date, datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.config import settings

pytestmark = pytest.mark.asyncio


def _token(role: str = "admin", user_id: int = 1, vendedor_id: int | None = None) -> str:
    payload = {
        "sub": str(user_id),
        "email": f"{role}@tours.luciel.dev",
        "role": role,
        "name": role,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    if vendedor_id is not None:
        payload["vendedor_id"] = str(vendedor_id)
    return jwt.encode(payload, settings.NEXTAUTH_SECRET, algorithm=settings.JWT_ALGORITHM)


def _venta_payload(**overrides) -> dict:
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
    payload.update(overrides)
    return payload


# --------------------------------------------------------------------------- #
# #4 — motivo_costo / motivo_monto
# --------------------------------------------------------------------------- #
async def test_venta_motivo_valido_es_aceptado_y_mezclado_con_notas(client, async_engine):
    payload = _venta_payload(
        metadata={"notas": "nota original"},
        motivo_costo="convenio_desactualizado",
        motivo_monto="descuento_especial",
    )
    r = await client.post("/ventas", json=payload, headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 201, r.text
    tour_servicio_id = r.json()["tour_servicio_id"]

    from app.models.tours import ToursServicios
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        ts = (await session.execute(select(ToursServicios).where(ToursServicios.id == tour_servicio_id))).scalar_one()
        md = json.loads(ts.metadata_)
        assert md == {
            "notas": "nota original",
            "motivo_costo": "convenio_desactualizado",
            "motivo_monto": "descuento_especial",
        }


async def test_venta_motivo_invalido_retorna_422(client):
    payload = _venta_payload(motivo_costo="no_es_un_motivo_valido")
    r = await client.post("/ventas", json=payload, headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 422, r.text


async def test_venta_sin_motivo_no_setea_metadata(client, async_engine):
    payload = _venta_payload()
    r = await client.post("/ventas", json=payload, headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 201, r.text
    tour_servicio_id = r.json()["tour_servicio_id"]

    from app.models.tours import ToursServicios
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        ts = (await session.execute(select(ToursServicios).where(ToursServicios.id == tour_servicio_id))).scalar_one()
        assert ts.metadata_ is None


# --------------------------------------------------------------------------- #
# #5 — GET /ventas/check-duplicado
# --------------------------------------------------------------------------- #
async def test_check_duplicado_true_when_exact_match_exists(client):
    payload = _venta_payload(tour_id=2, agencia_id=1, monto=150, fecha="2026-07-10")
    r = await client.post("/ventas", json=payload, headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 201, r.text

    r2 = await client.get(
        "/ventas/check-duplicado?tour_id=2&agencia_id=1&monto=150&fecha=2026-07-10",
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert r2.status_code == 200, r2.text
    data = r2.json()
    assert data["duplicado"] is True
    assert data["venta_id"] is not None


async def test_check_duplicado_false_when_no_match(client):
    r = await client.get(
        "/ventas/check-duplicado?tour_id=3&agencia_id=1&monto=999&fecha=2026-07-10",
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["duplicado"] is False
    assert data["venta_id"] is None


async def test_check_duplicado_vendedor_scoped_to_own(client):
    """A vendedor's duplicado check does not see another vendedor's matching venta."""
    payload = _venta_payload(tour_id=4, agencia_id=1, monto=200, fecha="2026-07-11", vendedor_id=1)
    r = await client.post("/ventas", json=payload, headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 201, r.text

    r2 = await client.get(
        "/ventas/check-duplicado?tour_id=4&agencia_id=1&monto=200&fecha=2026-07-11",
        headers={"Authorization": f"Bearer {_token('vendedor', user_id=2, vendedor_id=2)}"},
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["duplicado"] is False


# --------------------------------------------------------------------------- #
# #6 — DELETE /ventas/{id}
# --------------------------------------------------------------------------- #
async def _crear_venta(client, **overrides) -> dict:
    r = await client.post("/ventas", json=_venta_payload(**overrides), headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 201, r.text
    return r.json()


async def test_delete_venta_owner_success_hard_deletes(client, async_engine):
    venta = await _crear_venta(client, vendedor_id=1)
    tour_servicio_id = venta["tour_servicio_id"]
    asiento_id = venta["asiento_id"]

    r = await client.delete(
        f"/ventas/{tour_servicio_id}",
        headers={"Authorization": f"Bearer {_token('vendedor', user_id=1, vendedor_id=1)}"},
    )
    assert r.status_code == 204, r.text

    from app.models.core import AsientoLineas, Asientos
    from app.models.tours import ToursServicios
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        assert (await session.execute(select(ToursServicios).where(ToursServicios.id == tour_servicio_id))).scalar_one_or_none() is None
        assert (await session.execute(select(Asientos).where(Asientos.id == asiento_id))).scalar_one_or_none() is None
        assert (await session.execute(select(AsientoLineas).where(AsientoLineas.asiento_id == asiento_id))).scalars().all() == []


async def test_delete_venta_non_owner_vendedor_403(client):
    venta = await _crear_venta(client, vendedor_id=1)
    r = await client.delete(
        f"/ventas/{venta['tour_servicio_id']}",
        headers={"Authorization": f"Bearer {_token('vendedor', user_id=2, vendedor_id=2)}"},
    )
    assert r.status_code == 403, r.text


async def test_delete_venta_admin_can_delete_any(client):
    venta = await _crear_venta(client, vendedor_id=1)
    r = await client.delete(
        f"/ventas/{venta['tour_servicio_id']}",
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 204, r.text


async def test_delete_venta_ya_liquidada_409(client, async_engine):
    venta = await _crear_venta(client, vendedor_id=1)

    from app.models.tours import ToursServicios, Liquidaciones
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        liq = Liquidaciones(fecha_desde=date(2026, 1, 1), fecha_hasta=date(2026, 12, 31))
        session.add(liq)
        await session.flush()
        ts = (await session.execute(select(ToursServicios).where(ToursServicios.id == venta["tour_servicio_id"]))).scalar_one()
        ts.liquidacion_id = liq.id
        session.add(ts)
        await session.commit()

    r = await client.delete(
        f"/ventas/{venta['tour_servicio_id']}",
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 409, r.text


async def test_delete_venta_window_expired_409(client, async_engine):
    venta = await _crear_venta(client, vendedor_id=1)

    from app.models.tours import ToursServicios
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        ts = (await session.execute(select(ToursServicios).where(ToursServicios.id == venta["tour_servicio_id"]))).scalar_one()
        ts.creado_en = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=30)
        session.add(ts)
        await session.commit()

    r = await client.delete(
        f"/ventas/{venta['tour_servicio_id']}",
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 409, r.text


async def test_delete_venta_not_found_404(client):
    r = await client.delete("/ventas/999999", headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r.status_code == 404, r.text
