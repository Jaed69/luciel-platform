"""apps/tours/api/tests/test_comisiones.py

Comisiones: precedencia 4 niveles (D-09/D-10), default global non-deletable,
/simular interpreta monto como margen del preview.
"""
from datetime import datetime, timezone

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


async def test_precedence_all_4_levels(client):
    """Crea 4 reglas en cascada y valida resolve_comision por nivel.

    vendedor=1, tour=9 → 12% (vendedor+tour). Borrar vendedor+tour → 10% (vendedor only).
    Borrar vendedor-only → 8% (tour only). Borrar tour-only → 50% (default global).
    """
    headers = {"Authorization": f"Bearer {_token()}"}

    # vendedor-only rule needs vendedor id=1 (seeded) — tour-only needs tour id that exists.
    # tour_id=1 is the seeded City Tour Cusco. vendedor_id=1 is V-001.
    # Seed-vendedor-only rule.
    r = await client.post(
        "/comision-reglas",
        json={"vendedor_id": 1, "tour_id": None, "porcentaje": 10, "descripcion": "vendedor only 10"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    # tour-only rule (vendedor None, tour 1).
    r = await client.post(
        "/comision-reglas",
        json={"vendedor_id": None, "tour_id": 1, "porcentaje": 8, "descripcion": "tour only 8"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    # vendedor+tour specific (12%).
    r = await client.post(
        "/comision-reglas",
        json={"vendedor_id": 1, "tour_id": 1, "porcentaje": 12, "descripcion": "v+t 12"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    vt_row = r.json()

    # Level 1: vendedor+tour → 12%.
    r = await client.get("/simular?vendedor_id=1&tour_id=1&monto=100", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["porcentaje"] == 12, r.json()

    # Delete vendedor+tour row → fall to vendedor-only → 10%.
    vt_id = vt_row["id"]
    r = await client.delete(f"/comision-reglas/{vt_id}", headers=headers)
    assert r.status_code == 200
    r = await client.get("/simular?vendedor_id=1&tour_id=1&monto=100", headers=headers)
    assert r.json()["porcentaje"] == 10

    # Delete vendedor-only rule — find it via GET /comision-reglas.
    r = await client.get("/comision-reglas", headers=headers)
    rules = r.json()
    v_only = next(r_ for r_ in rules if r_["vendedor_id"] == 1 and r_["tour_id"] is None and r_["descripcion"] == "vendedor only 10")
    r = await client.delete(f"/comision-reglas/{v_only['id']}", headers=headers)
    assert r.status_code == 200
    r = await client.get("/simular?vendedor_id=1&tour_id=1&monto=100", headers=headers)
    assert r.json()["porcentaje"] == 8

    # Delete tour-only rule → fall to default global 50%.
    r = await client.get("/comision-reglas", headers=headers)
    rules = r.json()
    t_only = next(r_ for r_ in rules if r_["vendedor_id"] is None and r_["tour_id"] == 1 and r_["descripcion"] == "tour only 8")
    r = await client.delete(f"/comision-reglas/{t_only['id']}", headers=headers)
    assert r.status_code == 200
    r = await client.get("/simular?vendedor_id=1&tour_id=1&monto=100", headers=headers)
    assert r.json()["porcentaje"] == 50


async def test_default_global_no_deletable(client):
    """DELETE default global row → 400 (D-10)."""
    headers = {"Authorization": f"Bearer {_token()}"}
    r = await client.get("/comision-reglas", headers=headers)
    rules = r.json()
    default_global = next(r_ for r_ in rules if r_["vendedor_id"] is None and r_["tour_id"] is None)
    r = await client.delete(f"/comision-reglas/{default_global['id']}", headers=headers)
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == "No se puede eliminar la regla global por defecto"


async def test_simular_margen(client):
    """/simular monto=100 → porcentaje=50, comision=50 (margo input)."""
    headers = {"Authorization": f"Bearer {_token()}"}
    r = await client.get("/simular?vendedor_id=1&tour_id=1&monto=100", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["porcentaje"] == 50
    assert data["comision"] == 50  # 100 * 50/100 — monto interpreted as margen for preview.