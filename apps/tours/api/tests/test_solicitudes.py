"""apps/tours/api/tests/test_solicitudes.py

/solicitudes — feedback/mejora/bug tickets (D-28).
Any authed role creates; non-admin sees only their own; admin sees all + can
resolve with a `respuesta`, setting resuelto_por/resuelto_en.
"""
import json
from datetime import datetime, timezone

import jwt
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.config import settings

pytestmark = pytest.mark.asyncio


def _token(role: str, user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "email": f"{role}{user_id}@tours.luciel.dev",
        "role": role,
        "name": role,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    return jwt.encode(payload, settings.NEXTAUTH_SECRET, algorithm=settings.JWT_ALGORITHM)


async def _create_vendedor(client, email="vendedor@tours.luciel.dev", username="vendedor1") -> int:
    r = await client.post(
        "/usuarios",
        json={"email": email, "username": username, "password": "longenough", "rol": "vendedor"},
        headers={"Authorization": f"Bearer {_token('admin', 1)}"},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def test_post_solicitud_as_vendedor_ok(client):
    vendedor_id = await _create_vendedor(client)
    r = await client.post(
        "/solicitudes",
        json={"titulo": "Botón roto", "descripcion": "El botón no responde", "tipo": "bug", "pagina_origen": "/ventas"},
        headers={"Authorization": f"Bearer {_token('vendedor', vendedor_id)}"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["estado"] == "abierto"
    assert data["creado_por"] == vendedor_id
    assert data["prioridad"] == "media"


async def test_get_solicitudes_non_admin_sees_only_own(client):
    v1 = await _create_vendedor(client, "v1@tours.luciel.dev", "vend1")
    v2 = await _create_vendedor(client, "v2@tours.luciel.dev", "vend2")
    await client.post(
        "/solicitudes",
        json={"titulo": "De v1", "descripcion": "x", "tipo": "mejora"},
        headers={"Authorization": f"Bearer {_token('vendedor', v1)}"},
    )
    await client.post(
        "/solicitudes",
        json={"titulo": "De v2", "descripcion": "x", "tipo": "mejora"},
        headers={"Authorization": f"Bearer {_token('vendedor', v2)}"},
    )
    r = await client.get("/solicitudes", headers={"Authorization": f"Bearer {_token('vendedor', v1)}"})
    assert r.status_code == 200
    titles = [s["titulo"] for s in r.json()]
    assert titles == ["De v1"]


async def test_get_solicitudes_admin_sees_all_with_estado_filter(client):
    v1 = await _create_vendedor(client)
    await client.post(
        "/solicitudes",
        json={"titulo": "Ticket 1", "descripcion": "x", "tipo": "solicitud"},
        headers={"Authorization": f"Bearer {_token('vendedor', v1)}"},
    )
    r = await client.get("/solicitudes", headers={"Authorization": f"Bearer {_token('admin', 1)}"})
    assert r.status_code == 200
    assert len(r.json()) == 1

    r2 = await client.get("/solicitudes?estado=resuelto", headers={"Authorization": f"Bearer {_token('admin', 1)}"})
    assert r2.status_code == 200
    assert r2.json() == []


async def test_put_solicitud_admin_resolves_with_respuesta(client, async_engine):
    v1 = await _create_vendedor(client)
    created = await client.post(
        "/solicitudes",
        json={"titulo": "Ticket", "descripcion": "x", "tipo": "bug"},
        headers={"Authorization": f"Bearer {_token('vendedor', v1)}"},
    )
    solicitud_id = created.json()["id"]

    r = await client.put(
        f"/solicitudes/{solicitud_id}",
        json={"estado": "resuelto", "respuesta": "Ya se arregló"},
        headers={"Authorization": f"Bearer {_token('admin', 1)}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["estado"] == "resuelto"
    assert data["respuesta"] == "Ya se arregló"
    assert data["resuelto_por"] == 1
    assert data["resuelto_en"] is not None


async def test_put_solicitud_non_admin_403(client):
    v1 = await _create_vendedor(client)
    created = await client.post(
        "/solicitudes",
        json={"titulo": "Ticket", "descripcion": "x", "tipo": "bug"},
        headers={"Authorization": f"Bearer {_token('vendedor', v1)}"},
    )
    solicitud_id = created.json()["id"]
    r = await client.put(
        f"/solicitudes/{solicitud_id}",
        json={"estado": "resuelto"},
        headers={"Authorization": f"Bearer {_token('vendedor', v1)}"},
    )
    assert r.status_code == 403


async def test_post_solicitud_writes_audit_log(client, async_engine):
    v1 = await _create_vendedor(client)
    await client.post(
        "/solicitudes",
        json={"titulo": "Ticket audit", "descripcion": "x", "tipo": "bug"},
        headers={"Authorization": f"Bearer {_token('vendedor', v1)}"},
    )
    from app.models.core import AuditLog
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        audit = (await session.execute(
            select(AuditLog).where(AuditLog.tabla == "solicitudes", AuditLog.operacion == "I")
        )).scalars().first()
        assert audit is not None
        datos = json.loads(audit.datos_despues)
        assert datos["titulo"] == "Ticket audit"
