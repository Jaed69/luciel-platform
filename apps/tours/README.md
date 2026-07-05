# Tours Panel Contable — Hotel/Agencia Cusco

Aplicación contable para agencias de tours en Cusco. Frontend Next.js 16 + backend FastAPI + SQLite WAL, desplegado en `https://tours.luciel.dev` con cert HTTPS Let's Encrypt real vía Traefik.

## Stack

- **Frontend** — Next.js 16 (App Router, Turbopack) + React 19 + NextAuth Credentials + Tailwind v4 (`@tailwindcss/postcss`).
- **Backend** — FastAPI 0.136 + SQLAlchemy 2.0 async + aiosqlite + Pydantic v2 + pyjwt + bcrypt + alembic.
- **DB** — SQLite WAL (single-host mmacross named Docker volume `tours-db-data`).
- **Reverse proxy** — Traefik v3.7 (compartido con landing + futuras apps).

## Dev local

El proyecto usa pnpm workspaces + uv (Python). Requiere Node 22+ y Python 3.13+.

```bash
# Workspace install (desde repo raíz — pnpm-workspace.yaml referencia apps/tours/web)
pnpm install

# tours-web (Next.js dev server)
pnpm --filter @luciel-platform/tours dev
# → http://localhost:3000

# tours-api (FastAPI dev server)
cd apps/tours/api
uv sync
uv run uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/health
```

Para end-to-end local, tours-web debe alcanzar tours-api via Docker DNS (`http://tours-api:8000`). En dev fuera de Docker, define `TOURS_API_URL=http://localhost:8000` en `.env` local.

## Build

Las imágenes Docker se construyen con contexto raíz (`.`) para landing y tours-web (necesitan `pnpm-workspace.yaml` + lockfile), pero **`apps/tours/api`** usa `context: apps/tours/api` (Dockerfile self-contained). El workflow de CI matrix gestiona esto automáticamente (ver `.github/workflows/release.yml`).

```bash
# From repo root (compose usa imágenes GHCR — no build local necesario en prod):
docker compose pull tours-web tours-api
docker compose up -d tours-web tours-api
```

Para build manual de imágenes:

```bash
docker build -t luciel-platform-tours-web -f apps/tours/web/Dockerfile .
docker build -t luciel-platform-tours-api -f apps/tours/api/Dockerfile apps/tours/api
```

## Test

```bash
# Backend pytest
cd apps/tours/api
uv run pytest tests/ -x

# Frontend vitest
cd apps/tours/web
pnpm vitest run

# Frontend build
cd apps/tours/web
pnpm build
```

## Schema migrations

Alembic gestiona el schema. El startup del contenedor tours-api ejecuta (`app/main.py:lifespan`):

```python
async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.create_all)
```

…que es idempotente (CREATE IF NOT EXISTS). Para migrations explícitas en dev:

```bash
cd apps/tours/api
uv run alembic upgrade head
```

Seed inicial (chart of cuentas + admin user + default comisión 50/50 + catálogos demo) es idempotente — corre en startup y solo inserta si la tabla `cuentas` está vacía.

## Deploy (CI)

Push a `main` dispara `.github/workflows/release.yml` (D-04 matrix):

1. **build-and-push** matrix job sobre `[landing, tours-web, tours-api]` — QEMU emula arm64 (VPS target), Buildx push a GHCR con tags `sha-<short>` + `latest`.
2. **deploy** job SSH al VPS (`appleboy/ssh-action@v1`) ejecuta:
   - `git fetch origin && git reset --hard origin/main` — sincroniza el `docker-compose.yml` + configs del VPS con `main` (fix del bug donde el VPS se quedaba en Phase 01 compose cuando main ya tenía tours-web/tours-api).
   - Regenera `.env` desde GitHub repo secrets (heredoc) — vars nunca viven en git, VPS siempre sincronizado, sin edits manuales. Traefik never se toca (D-01 — infra existed desde Phase 1).
   - `docker compose pull landing tours-web tours-api` (login GHCR previo solo si `GHCR_PAT` set)
   - `docker compose up -d landing tours-web tours-api`
   - `docker image prune -f`

### GitHub repo secrets requeridos

Setea con `gh secret set NAME -b "value"` desde elrepo raíz:

| Secret | Uso |
|---|---|
| `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DEPLOY_PATH` | Conexión SSH + path del repo en VPS (Phase 01-02) |
| `NEXTAUTH_SECRET` | JWT HS256 firma (NextAuth + pyjwt bridge — D-02). Gen: `openssl rand -base64 48 \| tr -d '\n' \| head -c 64` |
| `ADMIN_INITIAL_PASSWORD` | Password seed admin@tours.luciel.dev. Gen: `openssl rand -base64 24 \| tr -d '\n' \| head -c 20` |
| `NEXTAUTH_URL` | `https://tours.luciel.dev` |
| `JWT_ALGORITHM` | `HS256` |
| `TRAEFIK_DASHBOARD_USER`, `TRAEFIK_DASHBOARD_PASS_HASH` | Traefik dashboard basic-auth (D-17) |
| `GHCR_OWNER` | Owner lowercase del namespace GHCR (default en compose: `jaed69`) |
| `GHCR_PAT` (optional) | PAT solo si GHCR package es private — login al pull |

Para agregar un nuevo var: (1) añade a `.env.example`, (2) `gh secret set`, (3) añade a `env:` + body del heredoc en `release.yml` deploy job.

Post-deploy verification:

```bash
curl -I https://tours.luciel.dev                            # esperado: 200, header 'server: Traefik'
openssl s_client -connect tours.luciel.dev:443 -servername tours.luciel.dev < /dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer                    # issuer=CN=R3 o E1 (Let's Encrypt real, NO self-signed)
```

## Endpoints API

| Método | Path | Descripción | Rol |
|--------|------|-------------|-----|
| POST | `/auth/login` | Login — bcrypt verify, returns JWT | público |
| POST | `/ventas` | Registra venta + asiento balanceado en misma tx (D-15) | admin/vendedor (propias) |
| GET | `/ventas` | Lista tours_servicios con filtros + auto-filter vendedor (T-02.1-08) | cualquier autenticado |
| GET | `/simular` | Preview comisión (resuelve precedencia 4 niveles — D-09/D-10) | cualquier autenticado |
| GET/POST/PUT/DELETE | `/comision-reglas` | CRUD reglas de comisión; DELETE default global → 400 | admin |
| POST | `/liquidaciones` | Crea liquidación abierta + auto-asigna tours_servicios in range with `liquidacion_id IS NULL` | admin/contabilidad |
| GET | `/liquidaciones[/{id}]` | Lista / detalle | admin/contabilidad; vendedor solo propias |
| POST | `/liquidaciones/{id}/close` | Cierra + genera asientos de comisión (501 dr / 201 cr) + LIQ-AAAA-NNN codigo | admin/contabilidad |
| POST | `/liquidaciones/{id}/reopen` | Reabre + genera asientos de reversión + estado=revertida | admin/contabilidad |
| GET | `/liquidaciones/{id}/precheck` | Pre-check failures list para UI strip | admin/contabilidad/vendedor (propias) |
| GET | `/dashboard/saldos` | Saldos por cuenta con filtros — RBAC role-forcing (T-02.1-14) | cualquier autenticado |
| GET | `/dashboard/tours_pendientes` | Tours con `liquidacion_id IS NULL` ordenados por fecha asc + `dias_desde_venta` | cualquier autenticado |
| GET | `/audit-log` | Audit log viewer — filtros usuario/tabla/operación | admin only (D-24) |
| PUT/DELETE | `/tours_servicios/{id}` | Editar/borrar venta — 409 si liquidación cerrada (D-14) | admin/vendedor (propias) |
| POST | `/asientos` | Admin manual asiento (TC interno — D-06) | admin |
| GET/POST/PUT/DELETE | `/cuentas`, `/catalogos/{entidad}`, `/agencias`, `/vendedores`, `/tours`, `/formas-pago`, `/monedas` | Catálogos — soft delete via `activo=false` | admin para mutaciones; cualquier autenticado para lectura |

## Decisiones relevantes

Link a `.planning/phases/02.1-tours-panel-contable-hotel/02.1-CONTEXT.md`:

- **D-01** tours-api interno (no Traefik router labels).
- **D-02** JWT bridge NextAuth ↔ FastAPI con `NEXTAUTH_SECRET` compartido.
- **D-03** SQLite WAL single-host via named Docker volume.
- **D-04** CI matrix sobre `[landing, tours-web, tours-app]` — GHCR + SSH VPS deploy.
- **D-05** Double-entry balance in Python (integer-cents), no SQL trigger.
- **D-07** Comisión = margen (ingreso − costo), no venta bruta.
- **D-08** Una sola moneda por asiento (PEN o USD, no mixto).
- **D-10** Precedencia 4 niveles + default global non-deletable.
- **D-11** Estados `abierta|cerrada|revertida`.
- **D-14** Tours en liquidación cerrada no editables (PUT/DELETE 409).
- **D-15** POST /ventas inserta tours_servicios + asiento en misma tx.
- **D-16** `codigo` LIQ-AAAA-NNN generado al cerrar, seq incremental por año.
- **D-21/D-23** Audit log via SQLAlchemy before_flush + ContextVar `current_user_id`.
- **D-26** `password_hash` redacted → null en audit_log.