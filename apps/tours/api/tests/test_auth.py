"""apps/tours/api/tests/test_auth.py — POST /auth/login by email or username."""
import pytest


@pytest.mark.asyncio
async def test_login_by_email_ok(client):
    resp = await client.post("/auth/login", json={"identifier": "admin@tours.luciel.dev", "password": "change-me"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "admin@tours.luciel.dev"
    assert body["username"] == "admin"


@pytest.mark.asyncio
async def test_login_by_username_ok(client):
    resp = await client.post("/auth/login", json={"identifier": "admin", "password": "change-me"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "admin@tours.luciel.dev"
    assert body["username"] == "admin"


@pytest.mark.asyncio
async def test_login_invalid_password_401(client):
    resp = await client.post("/auth/login", json={"identifier": "admin", "password": "wrong"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_identifier_401(client):
    resp = await client.post("/auth/login", json={"identifier": "no-such-user", "password": "change-me"})
    assert resp.status_code == 401
