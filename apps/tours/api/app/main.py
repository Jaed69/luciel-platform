"""apps/tours/api/app/main.py

FastAPI entrypoint for tours-api. Task 1 only exposes /health.
Task 2 will add router imports + lifespan: alembic upgrade + seed + WAL PRAGMA.
"""
from fastapi import FastAPI

app = FastAPI(
    title="tours-api",
    description="Panel contable para agencias de tours — Phase 02.1 luciel-platform.",
    version="0.1.0",
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}