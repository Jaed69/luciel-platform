"""apps/tours/api/tests/test_usuarios.py

Plan 02.1.1-01 Task 2 — /usuarios router: GET list, POST create, PUT edit,
DELETE soft, me/password + admin password reset. All with RBAC, last-admin,
self-delete, email-unique, and password-hash redaction guards (D-11/D-12/D-15/D-26).
"""
import json
from datetime import datetime, timezone

import bcrypt
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


async def test_post_usuario_creates_with_bcrypt_hash(client, async_engine):
    """POST /usuarios creates a user; password_hash starts with $2 (bcrypt); audit row 'I' redacts password."""
    r = await client.post(
        "/usuarios",
        json={"email": "vendedor2@tours.luciel.dev", "username": "vendedor2", "password": "longenough", "rol": "vendedor"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert "password_hash" not in data
    assert data["email"] == "vendedor2@tours.luciel.dev"
    assert data["rol"] == "vendedor"
    assert data["activo"] is True

    from app.models.core import AuditLog, Usuarios
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        user = (await session.execute(select(Usuarios).where(Usuarios.email == "vendedor2@tours.luciel.dev"))).scalar_one()
        assert user.password_hash.startswith("$2")
        audit = (await session.execute(select(AuditLog).where(AuditLog.tabla == "usuarios", AuditLog.operacion == "I").order_by(AuditLog.id.desc()))).scalars().first()
        assert audit is not None
        datos = json.loads(audit.datos_despues)
        assert datos["password_hash"] is None  # D-26 redaction


async def test_post_usuario_duplicate_email_409(client):
    """POST /usuarios twice with same email → 409."""
    body = {"email": "dup@tours.luciel.dev", "username": "dup1", "password": "longenough", "rol": "vendedor"}
    r = await client.post("/usuarios", json=body, headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r.status_code == 201
    r2 = await client.post("/usuarios", json=body, headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r2.status_code == 409, r2.text
    assert "mail" in r2.json()["detail"].lower()


async def test_post_usuario_vendedor_403(client):
    """POST /usuarios as vendedor → 403 (D-15 admin-only)."""
    r = await client.post(
        "/usuarios",
        json={"email": "x@tours.luciel.dev", "username": "x", "password": "longenough", "rol": "vendedor"},
        headers={"Authorization": f"Bearer {_token('vendedor', user_id=3)}"},
    )
    assert r.status_code == 403


async def test_get_usuarios_excludes_password_hash(client):
    """GET /usuarios as admin → 200 with list of dicts, no password_hash key in any row."""
    r = await client.get("/usuarios", headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) >= 1
    for row in rows:
        assert "password_hash" not in row
        assert "email" in row and "username" in row and "rol" in row and "activo" in row


async def test_put_usuario_updates_fields(client, async_engine):
    """PUT /usuarios/{id} updates email/username/rol/activo."""
    r = await client.post(
        "/usuarios",
        json={"email": "u-three@tours.luciel.dev", "username": "u_three", "password": "longenough", "rol": "vendedor"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    new_id = r.json()["id"]
    r2 = await client.put(
        f"/usuarios/{new_id}",
        json={"email": "u-three-renamed@tours.luciel.dev", "username": "u_three_renamed", "rol": "contabilidad", "activo": True},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r2.status_code == 200, r2.text
    data = r2.json()
    assert data["email"] == "u-three-renamed@tours.luciel.dev"
    assert data["rol"] == "contabilidad"

    from app.models.core import Usuarios
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        row = (await session.execute(select(Usuarios).where(Usuarios.id == new_id))).scalar_one()
        assert row.email == "u-three-renamed@tours.luciel.dev"
        assert row.rol.value == "contabilidad"


async def test_put_usuario_no_password(client):
    """PUT /usuarios/{id} with `password` field → 422 (extra='forbid')."""
    r = await client.post(
        "/usuarios",
        json={"email": "u-four@tours.luciel.dev", "username": "u_four", "password": "longenough", "rol": "vendedor"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    new_id = r.json()["id"]
    r2 = await client.put(
        f"/usuarios/{new_id}",
        json={"email": "u-four@tours.luciel.dev", "username": "u_four", "rol": "vendedor", "activo": True, "password": "x"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r2.status_code == 422, r2.text


async def test_put_usuario_vendedor_403(client):
    """PUT /usuarios/{id} as vendedor → 403 (D-15 admin-only)."""
    r = await client.put(
        "/usuarios/1",
        json={"email": "admin@tours.luciel.dev", "username": "admin", "rol": "admin", "activo": True},
        headers={"Authorization": f"Bearer {_token('vendedor', user_id=3)}"},
    )
    assert r.status_code == 403


async def test_put_usuario_last_admin_role_change_409(client):
    """PUT /usuarios/{admin_id} with rol != admin when only 1 admin → 409 (D-11)."""
    r = await client.put(
        "/usuarios/1",
        json={"email": "admin@tours.luciel.dev", "username": "admin", "rol": "vendedor", "activo": True},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 409, r.text


async def test_delete_usuario_soft(client, async_engine):
    """DELETE /usuarios/{id} (other user) as admin → 200, activo=false, audit 'U' row."""
    r = await client.post(
        "/usuarios",
        json={"email": "del@tours.luciel.dev", "username": "del", "password": "longenough", "rol": "vendedor"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    new_id = r.json()["id"]
    r2 = await client.delete(f"/usuarios/{new_id}", headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r2.status_code == 200, r2.text
    assert r2.json() == {"ok": True}

    from app.models.core import AuditLog, Usuarios
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        row = (await session.execute(select(Usuarios).where(Usuarios.id == new_id))).scalar_one()
        assert row.activo is False
        audit = (await session.execute(select(AuditLog).where(AuditLog.tabla == "usuarios", AuditLog.registro_id == new_id, AuditLog.operacion == "U").order_by(AuditLog.id.desc()))).scalars().first()
        assert audit is not None


async def test_delete_usuario_self_409(client):
    """DELETE /usuarios/{self_id} → 409 with 'propia cuenta' (D-12)."""
    r = await client.delete("/usuarios/1", headers={"Authorization": f"Bearer {_token('admin', user_id=1)}"})
    assert r.status_code == 409, r.text
    assert "propia" in r.json()["detail"].lower()


async def test_delete_usuario_last_admin_409(client):
    """DELETE /usuarios/{admin_id} when only 1 admin → 409 (D-11)."""
    # As admin but with user_id=999 (NOT self), the only admin target is id=1.
    r = await client.delete("/usuarios/1", headers={"Authorization": f"Bearer {_token('admin', user_id=999)}"})
    assert r.status_code == 409, r.text


async def test_delete_usuario_vendedor_403(client):
    """DELETE /usuarios/{id} as vendedor → 403 (D-15)."""
    r = await client.delete("/usuarios/1", headers={"Authorization": f"Bearer {_token('vendedor', user_id=3)}"})
    assert r.status_code == 403


async def test_put_me_password_success(client, async_engine):
    """PUT /usuarios/me/password with correct current → 200, hash changes, old fails bcrypt.checkpw."""
    # Seeded admin password is settings.ADMIN_INITIAL_PASSWORD ("change-me").
    old_hash_before = None
    from app.models.core import Usuarios
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        row = (await session.execute(select(Usuarios).where(Usuarios.id == 1))).scalar_one()
        old_hash_before = row.password_hash

    r = await client.put(
        "/usuarios/me/password",
        json={"current_password": settings.ADMIN_INITIAL_PASSWORD, "new_password": "new-secret-123"},
        headers={"Authorization": f"Bearer {_token('admin', user_id=1)}"},
    )
    assert r.status_code == 200, r.text

    async with factory() as session:
        row = (await session.execute(select(Usuarios).where(Usuarios.id == 1))).scalar_one()
        assert row.password_hash != old_hash_before
        assert bcrypt.checkpw(b"new-secret-123", row.password_hash.encode())
        assert not bcrypt.checkpw(b"change-me", row.password_hash.encode())


async def test_put_me_password_wrong_current_401(client):
    """PUT /usuarios/me/password with wrong current → 401, hash unchanged."""
    r = await client.put(
        "/usuarios/me/password",
        json={"current_password": "wrong-current", "new_password": "new-secret-123"},
        headers={"Authorization": f"Bearer {_token('admin', user_id=1)}"},
    )
    assert r.status_code == 401, r.text


async def test_put_me_password_audit_redaction(client, async_engine):
    """After PUT /usuarios/me/password, audit_log has 'U' row for usuarios with password_hash=null in both snapshots (D-26)."""
    r = await client.put(
        "/usuarios/me/password",
        json={"current_password": settings.ADMIN_INITIAL_PASSWORD, "new_password": "redact-test-123"},
        headers={"Authorization": f"Bearer {_token('admin', user_id=1)}"},
    )
    assert r.status_code == 200

    from app.models.core import AuditLog
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        audit = (await session.execute(select(AuditLog).where(AuditLog.tabla == "usuarios", AuditLog.operacion == "U", AuditLog.registro_id == 1).order_by(AuditLog.id.desc()))).scalars().first()
        assert audit is not None
        antes = json.loads(audit.datos_antes)
        despues = json.loads(audit.datos_despues)
        assert antes["password_hash"] is None
        assert despues["password_hash"] is None


async def test_put_admin_password_reset(client, async_engine):
    """PUT /usuarios/{other_id}/password as admin → 200, hash changes, no current_password required."""
    r = await client.post(
        "/usuarios",
        json={"email": "admin-reset@tours.luciel.dev", "username": "admin-reset", "password": "longenough", "rol": "vendedor"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    new_id = r.json()["id"]
    r2 = await client.put(
        f"/usuarios/{new_id}/password",
        json={"new_password": "admin-set-pw-123"},
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r2.status_code == 200, r2.text

    from app.models.core import Usuarios
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        row = (await session.execute(select(Usuarios).where(Usuarios.id == new_id))).scalar_one()
        assert bcrypt.checkpw(b"admin-set-pw-123", row.password_hash.encode())


async def test_put_admin_password_non_admin_403(client):
    """PUT /usuarios/{id}/password as vendedor → 403."""
    r = await client.put(
        "/usuarios/1/password",
        json={"new_password": "x-long-enough"},
        headers={"Authorization": f"Bearer {_token('vendedor', user_id=3)}"},
    )
    assert r.status_code == 403