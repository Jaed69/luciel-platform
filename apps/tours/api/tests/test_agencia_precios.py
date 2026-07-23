"""apps/tours/api/tests/test_agencia_precios.py

/agencia-precios — precio de lista por agencia×tour (D-30). Admin+contabilidad
mutate (D-13 level), any authed reads. Seed already has 3 agencias + 9 tours.
"""
from datetime import datetime, timezone

import jwt
import pytest

from app.config import settings

pytestmark = pytest.mark.asyncio


def _token(role: str, user_id: int = 1) -> str:
    payload = {
        "sub": str(user_id),
        "email": f"{role}@tours.luciel.dev",
        "role": role,
        "name": role,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    return jwt.encode(payload, settings.NEXTAUTH_SECRET, algorithm=settings.JWT_ALGORITHM)


async def test_post_agencia_precio_admin_ok(client):
    r = await client.post(
        "/agencia-precios",
        json={"agencia_id": 1, "tour_id": 1, "precio": 100, "precio_usd": 28},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["precio"] == 100
    assert data["activo"] is True


async def test_post_agencia_precio_vendedor_403(client):
    r = await client.post(
        "/agencia-precios",
        json={"agencia_id": 1, "tour_id": 1, "precio": 100},
        headers={"Authorization": f"Bearer {_token('vendedor')}"},
    )
    assert r.status_code == 403


async def test_post_agencia_precio_duplicate_409(client):
    body = {"agencia_id": 1, "tour_id": 1, "precio": 100}
    r = await client.post("/agencia-precios", json=body, headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r.status_code == 201
    r2 = await client.post("/agencia-precios", json=body, headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r2.status_code == 409, r2.text


async def test_get_agencia_precios_any_authed(client):
    r = await client.get("/agencia-precios", headers={"Authorization": f"Bearer {_token('vendedor')}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_put_agencia_precio_updates(client):
    created = await client.post(
        "/agencia-precios",
        json={"agencia_id": 2, "tour_id": 1, "precio": 100},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    precio_id = created.json()["id"]
    r = await client.put(
        f"/agencia-precios/{precio_id}",
        json={"agencia_id": 2, "tour_id": 1, "precio": 150, "precio_usd": 45},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["precio"] == 150


async def test_delete_agencia_precio(client):
    created = await client.post(
        "/agencia-precios",
        json={"agencia_id": 3, "tour_id": 1, "precio": 100},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    precio_id = created.json()["id"]
    r = await client.delete(f"/agencia-precios/{precio_id}", headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r.status_code == 200
