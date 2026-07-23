"""apps/tours/api/tests/test_tipos_tour.py

/tours — dedicated CRUD for tipos de tour (D-29). Unlike the generic
/catalogos/{entidad} dispatcher, this exposes descripcion/tiempo/precio
fields end-to-end. RBAC: admin+contabilidad mutate (D-13), any authed reads.
"""
from datetime import datetime, timezone

import jwt
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

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


async def test_post_tipo_tour_admin_ok(client):
    r = await client.post(
        "/tours",
        json={"codigo": "T-TEST", "nombre": "Test Tour", "descripcion": "desc", "tiempo": "3 horas", "precio_default": 100, "precio_default_usd": 28},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["tiempo"] == "3 horas"
    assert data["precio_default"] == 100
    assert data["activo"] is True


async def test_post_tipo_tour_vendedor_403(client):
    r = await client.post(
        "/tours",
        json={"codigo": "T-TEST", "nombre": "Test Tour"},
        headers={"Authorization": f"Bearer {_token('vendedor')}"},
    )
    assert r.status_code == 403


async def test_get_tours_any_authed(client):
    r = await client.get("/tours", headers={"Authorization": f"Bearer {_token('vendedor')}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_put_tipo_tour_updates_precio_tiempo_descripcion(client):
    created = await client.post(
        "/tours",
        json={"codigo": "T-EDIT", "nombre": "Editable"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    tour_id = created.json()["id"]

    r = await client.put(
        f"/tours/{tour_id}",
        json={"codigo": "T-EDIT", "nombre": "Editable", "descripcion": "nueva desc", "tiempo": "Full day", "precio_default": 250, "precio_default_usd": 70},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["descripcion"] == "nueva desc"
    assert data["tiempo"] == "Full day"
    assert data["precio_default"] == 250


async def test_delete_tipo_tour_blocked_by_reference_409(client, async_engine):
    created = await client.post(
        "/tours",
        json={"codigo": "T-REF", "nombre": "Referenced"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    tour_id = created.json()["id"]

    from app.models.tours import ComisionReglas
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        session.add(ComisionReglas(vendedor_id=None, tour_id=tour_id, porcentaje=10))
        await session.commit()

    r = await client.delete(f"/tours/{tour_id}", headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r.status_code == 409, r.text
    referencias = r.json()["detail"]["referencias"]
    assert {"tabla": "comision_reglas", "count": 1} in referencias


async def test_delete_then_restore_tipo_tour(client):
    created = await client.post(
        "/tours",
        json={"codigo": "T-DEL", "nombre": "Deletable"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    tour_id = created.json()["id"]

    r = await client.delete(f"/tours/{tour_id}", headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r.status_code == 200

    listed = await client.get("/tours", headers={"Authorization": f"Bearer {_token('admin')}"})
    row = next(t for t in listed.json() if t["id"] == tour_id)
    assert row["activo"] is False

    r2 = await client.post(f"/tours/{tour_id}/restore", headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r2.status_code == 200
    listed2 = await client.get("/tours", headers={"Authorization": f"Bearer {_token('admin')}"})
    row2 = next(t for t in listed2.json() if t["id"] == tour_id)
    assert row2["activo"] is True
