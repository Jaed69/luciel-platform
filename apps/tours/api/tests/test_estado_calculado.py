"""apps/tours/api/tests/test_estado_calculado.py

D-33 #2 — estado calculado (not persisted) on agencia/tour listings:
  - agencia: "operativa" if >=1 active AgenciaTourPrecio links it, else
    "sin_tours_vinculados".
  - tour: "disponible_para_venta" if >=1 active AgenciaTourPrecio links it,
    else "sin_agencia_vinculada".
Covers /agencias, /catalogos/agencias, and /tours (seed has 3 agencias, 9
tours, 0 agencia_tour_precios — nothing vinculado until a test links one).
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


async def _link(client, agencia_id: int, tour_id: int, precio: float = 100) -> None:
    r = await client.post(
        "/agencia-precios",
        json={"agencia_id": agencia_id, "tour_id": tour_id, "precio": precio},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 201, r.text


async def test_agencia_sin_vinculos_es_sin_tours_vinculados(client):
    r = await client.get("/agencias", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200, r.text
    row = next(a for a in r.json() if a["id"] == 1)
    assert row["estado"] == "sin_tours_vinculados"


async def test_agencia_con_vinculo_activo_es_operativa(client):
    await _link(client, agencia_id=1, tour_id=1)
    r = await client.get("/agencias", headers={"Authorization": f"Bearer {_token()}"})
    row = next(a for a in r.json() if a["id"] == 1)
    assert row["estado"] == "operativa"
    # untouched agencia stays sin_tours_vinculados
    other = next(a for a in r.json() if a["id"] == 2)
    assert other["estado"] == "sin_tours_vinculados"


async def test_catalogos_agencias_alias_also_exposes_estado(client):
    await _link(client, agencia_id=1, tour_id=1)
    r = await client.get("/catalogos/agencias", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200, r.text
    row = next(a for a in r.json() if a["id"] == 1)
    assert row["estado"] == "operativa"


async def test_catalogos_vendedores_estado_is_null(client):
    """estado only means something for agencias — other catalogs get None."""
    r = await client.get("/catalogos/vendedores", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200, r.text
    assert all(row["estado"] is None for row in r.json())


async def test_tour_sin_vinculos_es_sin_agencia_vinculada(client):
    r = await client.get("/tours", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200, r.text
    row = next(t for t in r.json() if t["id"] == 1)
    assert row["estado"] == "sin_agencia_vinculada"


async def test_tour_con_vinculo_activo_es_disponible_para_venta(client):
    await _link(client, agencia_id=1, tour_id=1)
    r = await client.get("/tours", headers={"Authorization": f"Bearer {_token()}"})
    row = next(t for t in r.json() if t["id"] == 1)
    assert row["estado"] == "disponible_para_venta"
    other = next(t for t in r.json() if t["id"] == 2)
    assert other["estado"] == "sin_agencia_vinculada"


async def test_tour_estado_ignores_inactive_precio(client, async_engine):
    """A soft-deleted (activo=false) AgenciaTourPrecio does not count."""
    await _link(client, agencia_id=1, tour_id=1)
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from app.models.tours import AgenciaTourPrecio

    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        row = (await session.execute(select(AgenciaTourPrecio))).scalars().one()
        row.activo = False
        session.add(row)
        await session.commit()

    r = await client.get("/tours", headers={"Authorization": f"Bearer {_token()}"})
    row = next(t for t in r.json() if t["id"] == 1)
    assert row["estado"] == "sin_agencia_vinculada"
