"""apps/tours/api/tests/test_dashboard.py

Dashboard endpoints:
- GET /dashboard/saldos (filtros fecha/agencia/vendedor/moneda, agrupación por cuenta)
- GET /dashboard/tours_pendientes (tours_servicios con liquidacion_id NULL ordenados por fecha asc)
- RBAC role-forcing (T-02.1-14): vendedor no puede leer datos de otro vendedor via ?vendedor_id=99
"""
import json
from datetime import date, datetime, timezone

import jwt
import pytest

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


async def test_saldos_filter_by_fecha(client):
    """POST 3 asientos en fecha X con monto PEN → GET /dashboard/saldos entre fecha_desde/fecha_hasta."""
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=50, fecha="2026-07-04")
    await _registrar_venta(client, vendedor_id=1, monto=200, costo=80, fecha="2026-07-05")
    await _registrar_venta(client, vendedor_id=1, monto=300, costo=120, fecha="2026-07-06")

    r = await client.get(
        "/dashboard/saldos?fecha_desde=2026-07-01&fecha_hasta=2026-07-31",
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert r.status_code == 200, r.text
    rows = r.json()
    saldos_by_code = {row["codigo"]: row for row in rows}
    assert "101-CAJA-PEN" in saldos_by_code, "caja soles should be present"
    assert "401-INGRESOS-TOURS-PEN" in saldos_by_code
    assert "501-COSTOS-TOURS-PEN" in saldos_by_code
    assert "202-AGENCIAS-POR-PAGAR-PEN" in saldos_by_code
    # costo ahora es deuda con la agencia (D-30), no sale de caja al vender.
    # Caja PEN: debe=100+200+300=600, sin descuento de costo. saldo=600.
    caja = saldos_by_code["101-CAJA-PEN"]
    assert abs(float(caja["saldo"]) - 600.0) < 1e-3, f"caja PEN saldo: {caja}"
    # Agencias por pagar PEN: haber=costos=50+80+120=250, debe=0. saldo (debe-haber) = -250.
    agencias_por_pagar = saldos_by_code["202-AGENCIAS-POR-PAGAR-PEN"]
    assert abs(float(agencias_por_pagar["saldo"]) - (-250.0)) < 1e-3, f"agencias por pagar PEN saldo: {agencias_por_pagar}"


async def test_saldos_filter_by_vendedor(client):
    """GET /dashboard/saldos?vendedor_id=1 → solo asientos de tours where vendedor_id=1."""
    # Need a second vendedor; seed.py adds V-001 (id=1) only. Add via /vendedores? That's a POST admin-only.
    headers = {"Authorization": f"Bearer {_token()}"}
    # Add second vendedor via direct /catalogos/vendedores endpoint? The Plan 01 router exposes /vendedores only as GET. POST is via /catalogos/{entidad}.
    r = await client.post(
        "/catalogos/vendedores",
        json={"codigo": "V-002", "nombre": "Vendedor dos"},
        headers=headers,
    )
    assert r.status_code == 201, r.text

    # Two ventas: one each.
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=40, fecha="2026-07-04")
    await _registrar_venta(client, vendedor_id=2, monto=300, costo=120, fecha="2026-07-04")

    r = await client.get(
        "/dashboard/saldos?fecha_desde=2026-07-01&fecha_hasta=2026-07-31&vendedor_id=1",
        headers=headers,
    )
    assert r.status_code == 200, r.text
    rows = r.json()
    caja = next(r_ for r_ in rows if r_["codigo"] == "101-CAJA-PEN")
    # Filter vendedor_id=1 → only monto 100 reaches caja. Costo ya no descuenta caja (D-30).
    assert abs(float(caja["saldo"]) - 100.0) < 1e-3, f"vendedor 1 saldo: {caja}"


async def test_tours_pendientes(client):
    """N tours_servicios with liquidacion_id=NULL → GET /dashboard/tours_pendientes lista ordenada por fecha asc con dias_desde_venta."""
    # Register 3 ventas on different dates.
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=40, fecha="2026-06-10")
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=40, fecha="2026-07-01")
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=40, fecha="2026-07-04")

    r = await client.get(
        "/dashboard/tours_pendientes",
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 3, f"expected 3 pendientes, got {len(rows)}: {rows}"
    # Order ascending by fecha.
    fechas = [r_["fecha"] for r_ in rows]
    assert fechas == sorted(fechas), f"not ascending: {fechas}"
    # `dias_desde_venta` present.
    assert "dias_desde_venta" in rows[0]


async def test_dashboard_vendedor_forced_to_self(client):
    """T-02.1-14 regression: vendedor JWT + ?vendedor_id=99 → forzado a self.

    Seed 2 vendedores (id=1 own, id=99 other) cada uno con 2 ventas; with vendedor
    JWT (`sub`=1, role='vendedor') hitting `/dashboard/saldos?vendedor_id=99`,
    the response SHOULD only include rows bound to vendedor_id=1.

    Admin JWT with same query returns vendedor 99's rows.
    """
    headers_admin = {"Authorization": f"Bearer {_token('admin', user_id=1)}"}

    # Seed vendedor 2 and others (we'll use ids 1 and 2 since seeded above). Use vendedor_id=2 as "other".
    r = await client.post(
        "/catalogos/vendedores",
        json={"codigo": "V-OTHER", "nombre": "Vendedor other"},
        headers=headers_admin,
    )
    assert r.status_code == 201, r.text
    other_id = r.json()["id"]

    # Add 2 ventas for vendedor 1 and 2 for vendedor other.
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=40, fecha="2026-07-04")
    await _registrar_venta(client, vendedor_id=1, monto=100, costo=40, fecha="2026-07-04")
    await _registrar_venta(client, vendedor_id=other_id, monto=500, costo=200, fecha="2026-07-04")
    await _registrar_venta(client, vendedor_id=other_id, monto=500, costo=200, fecha="2026-07-04")

    # Vendedor JWT with sub=1 forcing override of vendedor_id=other.
    headers_v1 = {"Authorization": f"Bearer {_token('vendedor', user_id=1)}"}
    r = await client.get(
        f"/dashboard/saldos?fecha_desde=2026-07-01&fecha_hasta=2026-07-31&vendedor_id={other_id}",
        headers=headers_v1,
    )
    assert r.status_code == 200, r.text
    rows = r.json()
    # Vendedor 1 forced override means caja saldo only reflects vendedor 1's ventas (100+100=200, costo ya no descuenta caja, D-30).
    caja = next((r_ for r_ in rows if r_["codigo"] == "101-CAJA-PEN"), None)
    assert caja is not None
    assert abs(float(caja["saldo"]) - 200.0) < 1e-3, f"vendedor forced_to_self caja: {caja}"

    # Same test on /dashboard/tours_pendientes.
    r = await client.get(
        f"/dashboard/tours_pendientes?vendedor_id={other_id}",
        headers=headers_v1,
    )
    assert r.status_code == 200
    rows = r.json()
    # All pendientes must belong to vendedor_id=1 (the JWT sub).
    for row in rows:
        assert row["vendedor_id"] == 1, f"row should be forced to vendedor 1: {row}"

    # Admin JWT with vendedor_id=2 → returns vendedor 2's rows (no forcing).
    r = await client.get(
        f"/dashboard/saldos?fecha_desde=2026-07-01&fecha_hasta=2026-07-31&vendedor_id={other_id}",
        headers=headers_admin,
    )
    assert r.status_code == 200
    rows = r.json()
    caja = next((r_ for r_ in rows if r_["codigo"] == "101-CAJA-PEN"), None)
    assert caja is not None
    # Without forcing, admin sees vendedor other's caja: 500+500=1000 (costo ya no descuenta caja, D-30).
    assert abs(float(caja["saldo"]) - 1000.0) < 1e-3, f"admin can see other vendedor: {caja}"