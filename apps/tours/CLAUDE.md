# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

`apps/tours` is **not** a customer-facing tour-booking app despite the name. It's an internal **double-entry accounting panel** ("Tours Panel Contable") for a hotel/tour agency in Cusco — sales entry, commission settlements, chart of accounts, catalogs, users, audit log. Frontend Next.js 16 + backend FastAPI + SQLite WAL, deployed at `https://tours.luciel.dev` via Traefik.

Stack: Next.js 16 (App Router, Turbopack) + React 19 + NextAuth Credentials + Tailwind v4 on the frontend; FastAPI 0.136 + SQLAlchemy 2.0 async + aiosqlite + Pydantic v2 + pyjwt + bcrypt + alembic on the backend. See `README.md` for the full stack/deploy write-up — this file is the day-to-day dev/architecture map.

## Commands

```bash
# Install (from repo root — pnpm-workspace.yaml references apps/tours/web)
pnpm install

# Frontend dev server → http://localhost:3000
pnpm --filter @luciel-platform/tours dev

# Backend dev server → http://localhost:8000/health
cd apps/tours/api && uv sync && uv run uvicorn app.main:app --reload --port 8000

# Backend tests
cd apps/tours/api && uv run pytest tests/ -x
# Single test file / test
uv run pytest tests/test_ventas.py -x
uv run pytest tests/test_ventas.py::test_name -x

# Frontend tests
cd apps/tours/web && pnpm vitest run
pnpm vitest run tests/dashboard.test.tsx   # single file

# Frontend build / typecheck
cd apps/tours/web && pnpm build

# Explicit schema migration (usually not needed — see Schema below)
cd apps/tours/api && uv run alembic upgrade head
```

Local end-to-end: tours-web reaches tours-api via Docker DNS (`http://tours-api:8000`) inside compose. Outside Docker, set `TOURS_API_URL=http://localhost:8000` in `.env`.

## Architecture

### Backend (`api/app/`)

- `main.py` — FastAPI entrypoint. `lifespan` runs `Base.metadata.create_all` (idempotent) + `seed.run_if_empty` on every startup — **this, not alembic, is the primary schema-sync mechanism** (see Schema below). Registers routers: `auth`, `core`, `tours`, `usuarios`.
- `routers/` — thin HTTP layer, split by domain:
  - `auth.py` — `POST /auth/login` (bcrypt → JWT).
  - `core.py` — catalogs + accounts: `/cuentas`, `/catalogos/{entidad}`, `/agencias`, `/vendedores`, `/tours`, `/formas-pago`, `/monedas`, `/comision-reglas`, manual `/asientos`.
  - `tours.py` — the transactional core: `/ventas`, `/simular`, `/liquidaciones` (+ `/close`, `/reopen`, `/precheck`), `/dashboard/saldos`, `/dashboard/tours_pendientes`, `/audit-log`.
  - `usuarios.py` — user CRUD + password endpoints (self + admin reset). **Not documented in the README's endpoint table** — check this file directly, don't trust the README as exhaustive here.
- `services/` — business logic invoked by routers, keep mutations here rather than in route handlers:
  - `accounting.py` — `post_asiento` / `post_venta_tour`: enforces double-entry balance in Python using integer cents (D-05), not a SQL trigger.
  - `commission.py` — `resolve_comision` / `simular_comision`: 4-level precedence resolution (D-09/D-10).
  - `liquidaciones.py` — `close_liquidacion` / `reopen_liquidacion` / `get_precheck`: settlement lifecycle (`abierta → cerrada → revertida`), generates/reverses commission asientos.
- `models/` — SQLAlchemy models, split `core.py` (Modulos, Contactos, Usuarios, Cuentas, Asientos/AsientoLineas, AuditLog, catalogs) and `tours.py` (ComisionReglas, Liquidaciones, LiquidacionAsientos, ToursServicios). All inherit `Base` + an `Auditable` mixin — audit trail is automatic via SQLAlchemy `before_flush` + a `current_user_id` ContextVar (D-21/D-23), not something routers opt into manually.
- `schemas/` — Pydantic request/response models, mirrors the `models/` split.

### Frontend (`web/src/app/`)

- `(app)/` route group — the authenticated shell (`layout.tsx` gates on session): dashboard (`page.tsx` + `_components/DashboardCards.tsx`), `ventas/`, `liquidaciones/[id]/`, `catalogos/[entidad]/` (generic CRUD page reused across all catalog entities, plus a `ComisionesTab`), `admin/usuarios/`, `admin/auditoria/`, `perfil/`.
- `api/` — Next.js Route Handlers that **proxy** to FastAPI rather than talk to a DB directly. Every proxying handler funnels through `api/_lib/proxy.ts::proxyJson(path, method, body)`, which pulls the JWT off the NextAuth session and forwards it as `Authorization: Bearer`, and passes the FastAPI response body/status through verbatim (so structured error bodies like `{detail: {mensaje, referencias}}` on 409 survive to the client unchanged). `simular`'s route is the one intentional exception — it forwards query params instead of a body, so it doesn't use `proxyJson` directly (see inline comment in that route file).
- `login/page.tsx` + `api/auth/[...nextauth]/route.ts` — NextAuth Credentials provider, JWT bridged to FastAPI via a shared `NEXTAUTH_SECRET` (D-02).
- No public/customer-facing routes exist — everything under `(app)/` is internal back-office.

### Schema / migrations

Alembic exists as dev history only (`migrations/versions/` 001-005) — **it never runs in prod**: the deployed DB was born via `create_all` and has no `alembic_version` table, so `alembic upgrade head` would fail on migration 001. The actual schema-sync mechanism at boot (lifespan in `main.py`, D-31) is: `create_all` (new tables) → `schema_sync.ensure_schema_structure` (column adds + indexes — must precede the seed, whose ORM inserts need current columns) → `seed.run_if_empty` (full seed, only on empty DB) → `schema_sync.ensure_reference_data` (insert-if-missing chart accounts / agencias / tipos de tour — must follow the seed, or its chart inserts would trip run_if_empty's empty-`cuentas` gate). When changing a model that already has deployed data, add the equivalent idempotent step to `app/schema_sync.py` (and optionally a matching alembic revision for history).

Seed data (chart of accounts + admin user + default 50/50 commission rule + demo catalogs) is idempotent, runs on startup, and only inserts when the `cuentas` table is empty.

## Requerimientos funcionales validados

Functional requirements and design decisions for this app are tracked as `D-NN` entries in `.planning/phases/` at the **repo root**, not inside `apps/tours/`. Don't re-derive rationale from scratch — check there first:

- `.planning/phases/02.1-tours-panel-contable-hotel/` — initial build (CONTEXT, DISCUSSION-LOG, RESEARCH, VALIDATION, UI-SPEC, PATTERNS). Decisions D-01 through D-16 (infra placement, JWT bridge, SQLite WAL, CI matrix, double-entry-in-Python, commission = margin not gross sale, single-currency-per-asiento, 4-level commission precedence, liquidación states, edit-lock on closed liquidaciones, código generation, etc.) — full list in `README.md`'s "Decisiones relevantes" section.
- `.planning/phases/02.1.1-tours-crud-cat-logos-gesti-n-usuarios/` — CRUD/catalog/user-management follow-up (DISCUSS-CHECKPOINT, CONTEXT, DISCUSSION-LOG, PATTERNS, UAT). Adds D-21/D-23 (audit trail mechanism), D-24 (audit-log admin-only), D-26 (password_hash redaction in audit_log), plus the usuarios/catalogos CRUD decisions not yet reflected in the README table.

When a change touches accounting balance rules, commission precedence, liquidación state transitions, or audit/RBAC behavior, check the relevant `D-NN` decision first — these encode constraints validated with the domain owner, not arbitrary implementation choices.
