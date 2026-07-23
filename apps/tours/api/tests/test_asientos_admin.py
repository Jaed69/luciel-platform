"""apps/tours/api/tests/test_asientos_admin.py

D-06 — admin-only POST /asientos tool for TC-interno manual asientos.
- admin can create a balanced single-moneda asiento
- vendedor gets 403
- unbalanced body gets 422 with "Asiento no cuadra"
- TC-interno metadata scenario persists with metadata.tipo='tc_interno'
"""
from datetime import datetime, timezone

import jwt
import pytest
from sqlalchemy import select

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


async def test_admin_can_post_balanced_asiento(client):
    """Admin can post a balanced single-moneda asiento — D-06 admin TC tool."""
    r = await client.post(
        "/asientos",
        json={
            "fecha": "2026-07-04",
            "concepto": "Asiento manual",
            "lineas": [
                {"cuenta_id": 1, "debe": 100, "haber": 0},  # 101-CAJA-PEN
                {"cuenta_id": 6, "debe": 0, "haber": 100},  # 401-INGRESOS-TOURS-PEN
            ],
        },
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["asiento_id"] > 0
    assert len(data["lineas"]) == 2
    assert data["lineas"][0]["codigo"] == "101-CAJA-PEN"


async def test_post_asientos_vendedor_returns_403(client):
    """Vendedor cannot POST /asientos."""
    r = await client.post(
        "/asientos",
        json={
            "fecha": "2026-07-04",
            "concepto": "x",
            "lineas": [
                {"cuenta_id": 1, "debe": 100, "haber": 0},
                {"cuenta_id": 6, "debe": 0, "haber": 100},
            ],
        },
        headers={"Authorization": f"Bearer {_token('vendedor', user_id=2)}"},
    )
    assert r.status_code == 403


async def test_post_asientos_unbalanced_returns_422(client):
    """Unbalanced body → 422 with 'Asiento no cuadra' detail."""
    r = await client.post(
        "/asientos",
        json={
            "fecha": "2026-07-04",
            "concepto": "bad",
            "lineas": [
                {"cuenta_id": 1, "debe": 100, "haber": 0},
                {"cuenta_id": 6, "debe": 0, "haber": 99},
            ],
        },
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 422
    assert "no cuadra" in r.json()["detail"]


async def test_post_asientos_tc_interno_metadata(client, async_engine):
    """TC-interno scenario: metadata carries {tipo:'tc_interno', tc_elegido, justificacion}.

    Plan note: a TC interno that mixes PEN and USD in one asiento violates D-08 (single-moneda).
    The proper TC interno posts a single-moneda asiento using the TC adjustment account
    (672-GAN-PERD-TC is PEN), with metadata.tipo='tc_interno' to flag it for audit.
    Here: débito 101-CAJA-PEN 100, crédito 672-GAN-PERD-TC 100 — both PEN, balanced.
    """
    # Chart seed order: 101-CAJA-PEN=1, ..., 672-GAN-PERD-TC=11 (D-30 inserted 2 agencias-por-pagar accounts before 401)
    r = await client.post(
        "/asientos",
        json={
            "fecha": "2026-07-04",
            "concepto": "TC interno manual (PEN adjustment)",
            "lineas": [
                {"cuenta_id": 1, "debe": 100, "haber": 0},  # 101-CAJA-PEN
                {"cuenta_id": 11, "debe": 0, "haber": 100},  # 672-GAN-PERD-TC (PEN)
            ],
            "metadata": {"tipo": "tc_interno", "tc_elegido": 3.7, "justificacion": "Sunat 2026-07-04"},
        },
        headers={"Authorization": f"Bearer {_token('admin')}"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["asiento_id"] > 0
    # audit_log should capture the asiento with metadata.tipo='tc_interno'
    from app.models.core import AuditLog
    from sqlalchemy.ext.asyncio import async_sessionmaker
    import json as _json
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        row = (await session.execute(
            select(AuditLog).where(AuditLog.tabla == "asientos").order_by(AuditLog.id.desc())
        )).scalars().first()
        assert row is not None
        despues = _json.loads(row.datos_despues)
        # metadata_ column is JSON-serialized by SQLAlchemy; check it parses with tipo=tc_interno
        md = despues.get("metadata_") or despues.get("metadata")
        if isinstance(md, str):
            md = _json.loads(md)
        assert md is not None and md.get("tipo") == "tc_interno"