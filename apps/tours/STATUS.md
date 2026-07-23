# STATUS.md — Tours Panel Contable

Doc de seguimiento: qué se implementó, contra qué requerimiento, y qué queda pendiente de verificar. Complementa `README.md` (stack/deploy) y `CLAUDE.md` (mapa de arquitectura para dev). Actualizar cada vez que se cierre una mejora relevante.

## Qué es

Panel contable interno de partida doble para agencia de tours/hotel en Cusco. Reemplaza sistema Excel/VBA (password hardcodeada "2808", sin rastro de auditoría, comisiones calculadas a mano). No es app de reserva de tours cara al cliente — todo es back-office (`tours.luciel.dev`, sin rutas públicas). Primer módulo de un mini-ERP planeado; diseñado para que un futuro módulo (café/Basílica) se enchufe al core sin tocarlo.

Stack: Next.js 16 (App Router, Turbopack) + React 19 + NextAuth Credentials + Tailwind v4 · FastAPI 0.136 + SQLAlchemy 2.0 async + aiosqlite + Pydantic v2 + bcrypt + alembic · SQLite WAL · Traefik (tours-web público, tours-api solo interno).

## Línea de tiempo de mejoras

### Fase 02.1 — build inicial (`7dd0294`..`c725cf4`)

- Scaffold `apps/tours/{web,api}` + docker-compose + Traefik labels + `.env.example`
- Core contable FastAPI: modelos SQLAlchemy, `audit_log` automático (`before_flush` + ContextVar), partida doble validada en Python con enteros-centavos, resolver de comisiones de 4 niveles, JWT auth, seed idempotente — 19 tests
- UI Next.js: login, RBAC middleware, formulario de ventas con preview de comisión en vivo (`/simular` debounced), tabla de ventas, CRUD catálogos, admin usuarios, librería de componentes
- Liquidaciones: máquina de estados abrir/cerrar (genera/revierte asientos de comisión), dashboard `/saldos` + `/tours_pendientes`, RBAC de backend (vendedor no ve datos ajenos ni por API directa) — 32 tests
- Dashboard UI (4 stat cards + filtros), páginas de liquidaciones, visor de auditoría (diff JSON, password_hash redactado), tab de comisiones
- CI matrix [landing, tours-web, tours-api], fixes de build/deploy (public/ faltante, sintaxis Dockerfile, regeneración de `.env` en VPS desde secrets, bug de NextAuth JWE vs JWS que rompía login-ok-pero-401-en-todo)

### Fase 02.1.1 — CRUD catálogos + gestión usuarios (`89832b2`..`cd9b042`)

- Catálogos: PUT (preserva `activo`) + DELETE con 409 si hay referencias FK; RBAC relajado a admin+contabilidad — 41 tests
- `/usuarios`: CRUD completo admin-only, cambio de password self-service y admin-reset, guard de último-admin, guard de auto-borrado, email duplicado → 409, `password_hash` nunca en response/audit — 58 tests
- `proxyJson` helper compartido + endpoint `POST /catalogos/{entidad}/{id}` de restaurar (gap que dejó el Plan 01: frontend lo referenciaba, backend nunca lo tuvo)
- `CatalogoFormModal` + `UsuarioFormModal`, página `/perfil`, `/admin/usuarios` conectado a API real — 15 tests frontend + 61 backend
- Fixes: 4 acciones de UI que llamaban a nada (NewLiquidacionModal, ComisionReglaFormModal, VentaEditModal, catálogos POST) wireadas a endpoints que ya existían en el backend; `'use client'` faltante rompía build Turbopack; `signOut()` en server action no limpiaba cookie de sesión

## Requerimientos (`.planning/REQUIREMENTS.md`) vs. estado real

| Req | Descripción | Doc dice | Estado real |
|-----|-------------|----------|--------------|
| TOURS-01..10 | Scaffold, auth, core contable, módulo tours, comisiones, audit_log, liquidaciones, dashboard mínimo | `[x]` Complete | Confirmado por commits fase 02.1 |
| — | Fase 02.1.1 (catálogos CRUD, usuarios) | `ROADMAP.md` tiene checkboxes `[ ]` sin marcar | Implementado y testeado (commits arriba) — **doc desactualizado, no el código** |

Nota aparte: `REQUIREMENTS.md` sección "Out of Scope" todavía lista *"User authentication/login — sin cuentas de usuario en el alcance actual"*. Eso es del brief original pre-Tours; quedó obsoleto desde que TOURS-04 implementó auth. No bloquea nada, pero conviene limpiarlo si se vuelve a tocar ese doc.

## Gaps y pendientes abiertos

- **UAT sin cerrar** (`.planning/phases/02.1.1-.../02.1.1-UAT.md`, `status: testing`): 11/16 checks pasaron (respaldados por tests automáticos), pero **4 quedan pendientes de verificación en vivo** contra `tours.luciel.dev` — nunca confirmados, solo cubiertos por unit tests:
  - Backend CRUD Surface Confirmation
  - Frontend RBAC Live Flow
  - CatalogoFormModal Agregar+Editar
  - Restaurar action
  - Un quinto check (Cold Start Smoke Test) está `skipped` — se decidió probarlo directo en producción.
- **Alembic**: solo existe la migración inicial (`001_initial_schema`). El mecanismo real de sync de schema es `create_all` en cada arranque, que es idempotente pero **no altera tablas existentes**. Cualquier cambio de schema sobre datos ya desplegados necesita revisión alembic explícita — riesgo estructural, no un TODO puntual.
- **Dashboard con gráficos + export Excel/PDF**: diferido explícitamente a "2.1.x", sin fase planeada todavía.
- **Archivos sin gitignorear en raíz del repo** (no específico de tours, pero señalado en `STATE.md`): `ssh-key-2026-07-03.key(.pub)`, `DESIGN.md`, `luciel-platform-brief.md` — revisar `.gitignore`.

## Cambios recientes (esta sesión)

- **Login por usuario o correo** (D-27): `/auth/login` ahora acepta `identifier` (email o username) en vez de solo `email`. Cambios: `LoginRequest.identifier` + lookup con `or_()` en `auth.py`; `Usuarios.username` pasó a `unique=True` (no lo tenía) + migración alembic `002_usuarios_username_unique`; `/usuarios` POST/PUT ahora también devuelve 409 en username duplicado (antes solo email); frontend (`login/page.tsx` + `lib/auth.ts`) usa un único campo "Correo o usuario". Cobertura nueva: `test_auth.py` (4 tests — no existía ningún test de auth antes), `test_post_usuario_duplicate_username_409`, `tests/login.test.tsx`. Decisión registrada en `.planning/phases/02.1.1-.../02.1.1-DISCUSSION-LOG.md` §8.
- **Sistema de solicitudes/feedback** (D-28): botón flotante global (`FeedbackButton.tsx`, montado en `(app)/layout.tsx`) accesible desde cualquier pantalla, abre modal para reportar bug/mejora/solicitud con tipo + prioridad, captura automática de `pagina_origen` vía `usePathname()`. Cualquier rol crea; no-admin ve solo sus tickets en `/solicitudes`; admin ve todos (+ filtro `?estado=`) y resuelve con `estado` + `respuesta` (setea `resuelto_por/resuelto_en`). Modelo `Solicitudes(Base, Auditable)` — audit trail automático, sin código extra. Migración `003_solicitudes`. Cobertura nueva: `test_solicitudes.py` (6 tests backend), `feedback-button.test.tsx` + `solicitudes.test.tsx` (7 tests frontend). Sin DELETE (mismo criterio que Liquidaciones: se descarta, no se borra).
- **Catálogo real de tipos de tour** (D-29): `ToursCatalogo` tenía `precio_default`/`precio_default_usd`/`moneda_default`/`descripcion` en el modelo pero **muertos en runtime** — el CRUD genérico de catálogos solo tocaba `codigo`/`nombre`. Se sacó `tours` del dispatcher genérico (`_CATALOG_MODELS`/`_REFERENCED_BY` en `core.py`) y se armó un router dedicado (`tipos_tour.py`) que expone todos los campos + un `tiempo` nuevo (texto libre, ej. "3 horas", "Full day"). Frontend: tab dedicada `TiposTourTab.tsx` dentro de `/catalogos/tours` (mismo patrón de early-return que ya usaba la tab "Comisiones"). Migración `004_tipos_tour` agrega la columna `tiempo` + upsert por `codigo` de los 9 tipos reales (7 Lagunas, City Tour Mañana/Tarde, Laguna Humantay, Valle Sagrado VIP/Tradicional, Motocross, Valle Sur, Machu Picchu), sin pisar el demo viejo si ya existía. Precio/tiempo/descripción quedan `NULL` — se completan desde el panel. Historial de cambios de precio: cubierto por `audit_log` existente, sin pantalla nueva. Cobertura: `test_tipos_tour.py` (6 tests backend), `tipos-tour.test.tsx` (3 tests frontend).
- **Precio por agencia + cuentas por pagar a agencias** (D-30): sembradas las 3 agencias reales (Cusco Top, Andean, Guty) reemplazando el demo. Nuevo `AgenciaTourPrecio` (precio de lista PEN/USD por agencia×tour, router dedicado `agencia_precios.py`). **Cambio contable real**: `costo` de una venta dejó de salir de caja al instante — ahora es deuda acumulada con la agencia (`post_venta_tour` credita `202-AGENCIAS-POR-PAGAR-{moneda}` en vez de `101-CAJA-{moneda}`; cuentas nuevas seedeadas). Nuevo `AgenciaPagos` registra pagos (depósito/comprobante + referencia/nota), postea el asiento inverso (débito pasivo / crédito caja) y expone `GET /agencias/{id}/saldo` (deuda actual por moneda, agrupado por agencia). `VentaFormModal` autocompleta `costo` desde el precio de lista de la agencia seleccionada (editable). Nuevo nav "Agencias" → lista con saldos → detalle con precios + historial de pagos + registrar pago. Migración `005_agencia_precio_pagos` (cuentas + tablas + upsert agencias, no rompe históricos). Se actualizaron 3 tests de `test_dashboard.py` y 1 de `test_asientos_admin.py` (ids de cuenta corridos por las 2 cuentas nuevas) que dependían del comportamiento contable viejo. Reporte comparativo de rendimiento por agencia: diferido a mejora futura. Cobertura: `test_agencia_precios.py` (6), `test_agencia_pagos.py` (5) backend; `agencia-detail.test.tsx` (4), `venta-form-precio.test.tsx` (1) frontend.

- **Fix producción: catálogos rotos + dropdown de tours vacío** (D-31): causa raíz — el deploy nunca corre alembic (solo `docker compose up`; el lifespan solo hacía `create_all`, que no altera tablas existentes, + seed gateado a DB vacía). La DB desplegada quedó sin la columna `tiempo` (todo `/tours` daba 500 → dropdowns y tab de catálogos vacíos) y sin las cuentas `202-AGENCIAS-POR-PAGAR` (toda venta con costo>0 fallaba). Además `alembic upgrade head` a ciegas no era opción: la DB de prod no tiene `alembic_version`. Fix: nuevo `app/schema_sync.py` con reconciliación idempotente en el arranque, en dos fases con orden obligatorio — `ensure_schema_structure` (columna `tiempo`, unique index de username) **antes** del seed, y `ensure_reference_data` (cuentas 202, 3 agencias, 9 tours, insert-si-no-existe por código) **después** del seed (invertirlo rompía el seed de DB fresca — detectado por simulación local del estado de prod, no por unit tests). Comentarios falsos de `main.py` sobre alembic corregidos; CLAUDE.md actualizado con el mecanismo real. Cobertura: `test_schema_sync.py` (3 tests: DB desactualizada sanada, idempotencia, DB fresca no-op) + simulación e2e del estado prod (`/tours` 200 con los 9 + venta con costo posteada OK).

**Gap estructural resuelto**: el ítem "Alembic solo tiene migración inicial / create_all no altera tablas" de la sección de gaps queda cerrado por D-31 — el drift ahora se reconcilia en cada arranque.

92 tests backend + 32 frontend, todo verde; build limpio.
