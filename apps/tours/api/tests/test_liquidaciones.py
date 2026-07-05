"""apps/tours/api/tests/test_liquidaciones.py

Liquidaciones state machine (D-11/D-13/D-16/D-17/D-19):
- close genera asientos de comisión (501/201) por vendedor + asigna codigo LIQ-AAAA-NNN
- close pre-checks abortan si costos faltantes
- reopen genera asientos de reversión (swap debe/haber) + estado=reverted + desbloquea tours
- reopen + nueva liquidación en el mismo rango genera codigo incrementado
- PUT/DELETE /tours_servicios/{id} con liquidación cerrada → 409 (D-14)
"""
from datetime import date, datetime, timezone

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


async def _registrar_venta(client, *, vendedor_id: int = 1, monto: float = 100, costo: float | None = 60, fecha: str = "2026-07-04") -> dict:
    payload = {
        "tour_id": 1,
        "vendedor_id": vendedor_id,
        "agencia_id": 1,
        "forma_pago_id": 1,
        "moneda": "PEN",
        "monto": monto,
        "costo": costo,
        "fecha": fecha,
    }
    r = await client.post("/ventas", json=payload, headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 201, r.text
    return r.json()


async def test_close_genera_asientos(client, async_engine):
    """Close → asientos de comisión (débito 501-COSTOS-COMISIONES + crédito 201-COMISIONES-POR-PAGAR), codigo LIQ-AAAA-NNN, estado=cerrada."""
    # Two ventas for vendedor 1, both with costos.
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=60, fecha="2026-07-04")
    await _registrar_venta(client, vendedor_id=1, monto=200, costo=120, fecha="2026-07-05")

    # Create the liquidación covering both.
    r = await client.post(
        "/liquidaciones",
        json={"fecha_desde": "2026-07-01", "fecha_hasta": "2026-07-31"},
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert r.status_code == 201, r.text
    liq = r.json()
    liq_id = liq["id"]

    # All tours in range should now be assigned automatically (POST /liquidaciones auto-assign).
    from app.models.tours import ToursServicios
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        rows = (await session.execute(select(ToursServicios).where(ToursServicios.liquidacion_id == liq_id))).scalars().all()
        assert len(rows) == 2

    # Close the liquidación.
    r = await client.post(f"/liquidaciones/{liq_id}/close", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200, r.text
    closed = r.json()
    assert closed["codigo"] is not None
    assert closed["codigo"].startswith("LIQ-2026-")
    assert closed["estado"] == "cerrada"

    # Asientos de comisión were generated: 501-COSTOS-COMISIONES debit and 201-COMISIONES-POR-PAGAR credit.
    from app.models.core import AsientoLineas, Cuentas
    from app.models.tours import LiquidacionAsientos
    async with factory() as session:
        asientos_pivots = (await session.execute(select(LiquidacionAsientos).where(LiquidacionAsientos.liquidacion_id == liq_id, LiquidacionAsientos.tipo == "cierre"))).scalars().all()
        assert len(asientos_pivots) >= 1
        for pivot in asientos_pivots:
            lineas = (await session.execute(select(AsientoLineas).where(AsientoLineas.asiento_id == pivot.asiento_id))).scalars().all()
            debe_total = sum(float(l.debe) for l in lineas)
            haber_total = sum(float(l.haber) for l in lineas)
            assert abs(debe_total - haber_total) < 1e-6, "Asiento debe cuadrar"
            # Find 501-COSTOS-COMISIONES debit + 201-COMISIONES-POR-PAGAR credit
            cuentas = {(await session.execute(select(Cuentas).where(Cuentas.id == l.cuenta_id))).scalar_one().codigo: l for l in lineas}
            assert "501-COSTOS-COMISIONES" in cuentas, f"Asiento should debit 501-COSTOS-COMISIONES — got {list(cuentas)}"
            assert float(cuentas["501-COSTOS-COMISIONES"].debe) > 0
            assert float(cuentas["501-COSTOS-COMISIONES"].haber) == 0
            assert "201-COMISIONES-POR-PAGAR" in cuentas
            assert float(cuentas["201-COMISIONES-POR-PAGAR"].haber) > 0
            assert float(cuentas["201-COMISIONES-POR-PAGAR"].debe) == 0

        # Liquidación estado persisted.
        from app.models.tours import Liquidaciones
        liq_row = (await session.execute(select(Liquidaciones).where(Liquidaciones.id == liq_id))).scalar_one()
        assert liq_row.estado.value == "cerrada"
        assert liq_row.codigo is not None


async def test_close_precheck_aborts(client):
    """Close con tour sin costo → 422 con lista de problemas y liquidación sigue abierta."""
    # One venta WITHOUT costo (costo=None).
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=None, fecha="2026-07-10")

    r = await client.post(
        "/liquidaciones",
        json={"fecha_desde": "2026-07-01", "fecha_hasta": "2026-07-31"},
        headers={"Authorization": f"Bearer {_token()}"},
    )
    liq_id = r.json()["id"]

    r = await client.post(f"/liquidaciones/{liq_id}/close", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 422, r.text
    body = r.json()
    assert "errors" in body or "detail" in body
    # Liquidación sigue abierta.
    r2 = await client.get(f"/liquidaciones/{liq_id}", headers={"Authorization": f"Bearer {_token()}"})
    assert r2.json()["estado"] == "abierta"


async def test_reopen_reverts(client, async_engine):
    """Reopen → asientos de reversión swap debe/haber; estado=reverted; tours desbloqueados."""
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=60, fecha="2026-07-04")

    r = await client.post(
        "/liquidaciones",
        json={"fecha_desde": "2026-07-01", "fecha_hasta": "2026-07-31"},
        headers={"Authorization": f"Bearer {_token()}"},
    )
    liq_id = r.json()["id"]

    r = await client.post(f"/liquidaciones/{liq_id}/close", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200, r.text

    from app.models.core import AsientoLineas
    from app.models.tours import LiquidacionAsientos, ToursServicios, Liquidaciones
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        closing_ids = [p.asiento_id for p in (await session.execute(select(LiquidacionAsientos).where(LiquidacionAsientos.liquidacion_id == liq_id, LiquidacionAsientos.tipo == "cierre"))).scalars().all()]
    assert len(closing_ids) >= 1

    # Reopen
    r = await client.post(f"/liquidaciones/{liq_id}/reopen", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["estado"] == "revertida"

    async with factory() as session:
        # New reversion asientos generated.
        rev_pivots = (await session.execute(select(LiquidacionAsientos).where(LiquidacionAsientos.liquidacion_id == liq_id, LiquidacionAsientos.tipo == "reversion"))).scalars().all()
        assert len(rev_pivots) == len(closing_ids)
        for rev in rev_pivots:
            lineas_rev = (await session.execute(select(AsientoLineas).where(AsientoLineas.asiento_id == rev.asiento_id))).scalars().all()
            assert abs(sum(float(l.debe) for l in lineas_rev) - sum(float(l.haber) for l in lineas_rev)) < 1e-6
            # Find original asiento lines by metadata.asiento_original_id
        # Liquidación row estado persisted.
        liq_row = (await session.execute(select(Liquidaciones).where(Liquidaciones.id == liq_id))).scalar_one()
        assert liq_row.estado.value == "revertida"
        assert liq_row.reopen_count >= 1
        # Tours desbloqueados.
        tours = (await session.execute(select(ToursServicios).where(ToursServicios.liquidacion_id == liq_id))).scalars().all()
        assert len(tours) == 0, "tours_servicios.liquidacion_id must be NULL after reopen"


async def test_reopen_then_reclose_generates_codigo_incrementado(client):
    """Reopen LIQ-2026-001 → nueva liquidación al recerrar recibe LIQ-2026-002 (D-16)."""
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=60, fecha="2026-07-04")

    r = await client.post(
        "/liquidaciones",
        json={"fecha_desde": "2026-07-01", "fecha_hasta": "2026-07-31"},
        headers={"Authorization": f"Bearer {_token()}"},
    )
    liq1_id = r.json()["id"]

    r = await client.post(f"/liquidaciones/{liq1_id}/close", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200, r.text
    code1 = r.json()["codigo"]
    assert code1 == "LIQ-2026-001"

    # Reopen.
    r = await client.post(f"/liquidaciones/{liq1_id}/reopen", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200

    # New liquidación over the same range (tours should be unassigned now).
    r = await client.post(
        "/liquidaciones",
        json={"fecha_desde": "2026-07-01", "fecha_hasta": "2026-07-31"},
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert r.status_code == 201, r.text
    liq2_id = r.json()["id"]

    r = await client.post(f"/liquidaciones/{liq2_id}/close", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200, r.text
    code2 = r.json()["codigo"]
    assert code2 == "LIQ-2026-002", f"second liquidación should be LIQ-2026-002 — got {code2}"


async def test_tour_en_cerrada_no_editable(client):
    """PUT /tours_servicios/{id} con liquidación cerrada → 409 (D-14)."""
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=60, fecha="2026-07-04")

    r = await client.post(
        "/liquidaciones",
        json={"fecha_desde": "2026-07-01", "fecha_hasta": "2026-07-31"},
        headers={"Authorization": f"Bearer {_token()}"},
    )
    liq_id = r.json()["id"]

    # Look up the tour_servicio id via GET /ventas.
    r = await client.get("/ventas", headers={"Authorization": f"Bearer {_token()}"})
    ts_id = r.json()[0]["id"]

    r = await client.post(f"/liquidaciones/{liq_id}/close", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200

    # Now PUT should be refused with 409.
    r = await client.put(
        f"/tours_servicios/{ts_id}",
        json={"monto": 999},
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert r.status_code == 409, r.text
    assert r.json()["detail"] == "Tour en liquidación cerrada, reabre primero"

    # DELETE should also be refused with 409.
    r = await client.delete(f"/tours_servicios/{ts_id}", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 409
    assert r.json()["detail"] == "Tour en liquidación cerrada, reabre primero"