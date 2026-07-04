"""apps/tours/api/tests/test_rbac.py

Role-based access control:
- 401 without Authorization header
- 403 with vendedor role on /audit-log (D-24)
- 200 with admin role on /audit-log
- 403 with vendedor role on POST /agencias
"""
import json
from datetime import datetime, timezone

import jwt
import pytest

from app.config import settings


pytestmark = pytest.mark.asyncio


def _token(role: str, user_id: int = 1) -> str:
    """Mint a JWT as NextAuth would (HS256 with shared NEXTAUTH_SECRET — D-02)."""
    payload = {
        "sub": str(user_id),
        "email": f"{role}@tours.luciel.dev",
        "role": role,
        "name": role,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    return jwt.encode(payload, settings.NEXTAUTH_SECRET, algorithm=settings.JWT_ALGORITHM)


async def test_audit_log_no_token_returns_401(client):
    """No Authorization header → 401."""
    r = await client.get("/audit-log")
    assert r.status_code == 401


async def test_audit_log_vendedor_returns_403(client):
    """Vendedor cannot read /audit-log (D-24)."""
    r = await client.get(
        "/audit-log",
        headers={"Authorization": f"Bearer {_token('vendedor', user_id=2)}"},
    )
    assert r.status_code == 403


async def test_audit_log_admin_returns_200(client):
    """Admin can read /audit-log."""
    r = await client.get(
        "/audit-log",
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 200


async def test_post_agencia_vendedor_returns_403(client):
    """Vendedor cannot create agencias."""
    r = await client.post(
        "/catalogos/agencias",
        json={"codigo": "AG-XYZ", "nombre": "Test"},
        headers={"Authorization": f"Bearer {_token('vendedor', user_id=2)}"},
    )
    assert r.status_code == 403