# Roadmap: luciel-platform

## Overview

A phased build of a self-hosted "productized portfolio" on `luciel.dev`: a content hub (root domain) + subdomain-per-tool architecture behind Traefik, monetized via Google AdSense. Phase order is non-negotiable — the root domain content must be complete and live before tools, because AdSense requires substantial original text on the root before monetizing subdomains. Each phase delivers a live, working result on the internet.

**Mode:** mvp — each phase is a vertical slice delivering an end-to-end user capability, not a horizontal layer.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure + Landing Scaffold** - Traefik + DNS + Let's Encrypt + minimal `luciel.dev` live over HTTPS (completed 2026-07-03)
- [ ] **Phase 2: Content Hub** - Home, blog (5-8 real articles), Projects page, navigation, RSS, OG tags, 404
- [x] **Phase 02.1: Tours — Panel contable hotel** (INSERTED) - Sistema contable para hotel/agencia de tours de Cusco, reemplaza Excel con macros; primer módulo de mini-ERP (completed 2026-07-05)
- [ ] **Phase 3: Legal + AdSense Readiness** - Privacy/Terms/Contact pages + sitemap/robots/ads.txt/GSC + per-article SEO
- [ ] **Phase 4: First Tool Pilot (rtk) + Pattern Documentation** - `rtk.luciel.dev` working end-to-end + `docs/adding-a-new-app.md`

## Phase Details

### Phase 1: Infrastructure + Landing Scaffold

**Goal**: A visitor can load `https://luciel.dev` over a valid Let's Encrypt certificate behind Traefik, with the stack reproducible from `docker compose up -d`.
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05, INFR-06, CONT-01
**Open decisions**: Landing framework — **Astro 7 vs Next.js 16**. Project research strongly recommends Astro (zero-JS output = best AdSense/SEO baseline; root domain is mostly static content + blog). Default: Astro unless a concrete interactivity need surfaces during planning. Resolution required at the start of Phase 1's first plan.
**Success Criteria** (what must be TRUE):

  1. `curl -I https://luciel.dev` returns HTTP 200 with a Let's Encrypt certificate (not self-signed), trusted by browsers without warnings
  2. HTTP requests to `luciel.dev` redirect permanently to HTTPS
  3. A wildcard DNS record means `*.luciel.dev` resolves to the VPS — verified by adding a throwaway Host rule for a fresh subdomain and seeing Traefik serve it
  4. The entire stack starts from a clean checkout via `docker compose up -d` using only `.env.example` (DNS + secrets configured), no manual config edits
  5. The Traefik dashboard is reachable and shows the `luciel.dev` router with a valid cert resolver

**Plans**: 2/2 plans complete

Plans:

- [x] 01-01-PLAN.md — Monorepo scaffold + Astro 7 landing + Traefik stack + bootstrap + verify scripts
- [x] 01-02-PLAN.md — GitHub Actions arm64 CI/CD → GHCR pipeline

### Phase 2: Content Hub

**Goal**: Visitors find a complete, navigable content site at `luciel.dev` with original technical articles — the SEO surface that future AdSense monetization depends on.
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: CONT-02, CONT-03, CONT-04, CONT-05, CONT-09, CONT-10, CONT-11, CONT-12
**Success Criteria** (what must be TRUE):

  1. Home page presents a personal intro, the project philosophy, and a tool directory listing planned tools with "coming soon" entries
  2. The blog lists 5-8 articles, each readable end-to-end, with syntax-highlighted code blocks (Shiki/bright)
  3. Every page is reachable via header and footer navigation; following all internal links produces no 404s
  4. `/rss.xml` serves a valid Atom/RSS feed containing all published posts
  5. Each page has Open Graph tags (title, description, image) so link previews render on social platforms

**Plans**: TBD

Plans:

- [ ] 02-01: TBD

### Phase 02.1: Tours — Panel contable hotel (INSERTED)

**Goal**: Staff de hotel/agencia de tours registra ventas de tours, cobranzas y liquidaciones en un panel contable multi-usuario con core de partida doble, reemplazando el Excel con macros VBA; accesible en `https://tours.luciel.dev` con cert Let's Encrypt real. Primer inquilino de un mini-ERP modular (core contable + módulo Tours) — el módulo café/Basílica se agrega después sin rehacer el core.
**Mode**: mvp
**Depends on**: Phase 1 (reusa Traefik + DNS wildcard + GHCR CI; NO depende de Phase 2 Content Hub)
**Requirements**: TOURS-01, TOURS-02, TOURS-03, TOURS-04, TOURS-05, TOURS-06, TOURS-07, TOURS-08, TOURS-09, TOURS-10
**Open decisions**: Resueltos en pre-discusión (ver `02.1-CONTEXT.md`) — SQLite WAL (no Postgres), NextAuth/Credentials + bcrypt + TypeScript, no module_registry framework (YAGNI), no PWA, dashboard mínimo en 2.1 (full en 2.1.x), `packages/ui` local en `apps/tours/`, JSONB híbrido para campos variables, core contable de partida doble desde día 1, 2 plans (scaffold+CRUD / liquidaciones+dashboard+deploy), arranque limpio sin migración de datos Excel.
**Success Criteria** (what must be TRUE):

  1. `apps/tours/` corre detrás de Traefik con su propio cert Let's Encrypt en `tours.luciel.dev` (separate router, no wildcard cert)
  2. Usuario con rol `admin` / `vendedor` / `contabilidad` puede loguearse vía NextAuth Credentials + bcrypt y solo ve lo que su rol permite (vendedor no ve totales globales ni audit log)
  3. Registrar una venta de tour inserta `tours_servicios` + genera asiento balanceado en el core ledger (partida doble) en una sola transacción FastAPI + SQLAlchemy async — el balance debe = haber dentro de la tx, validado en Python no en trigger SQL
  4. Cada INSERT/UPDATE/DELETE deja entrada en `audit_log` con `usuario_id` + timestamp + datos_antes/datos_despues (la macro VBA actual borra sin rastro — esto lo resuelve)
  5. Una liquidación puede abrirse y cerrarse; el cierre genera los asientos de distribución/comisión automáticamente (reemplaza la suma manual de Sandra en la fila de Egreso)
  6. Las reglas de comisión usan precedencia determinística (vendedor+tour > vendedor > tour > default global); existe un default global no borrable; endpoint `/simular` permite probar antes de guardar
  7. El saldo por cuenta (caja soles, caja dólares, ingresos tours, costos tours) es consultable en un dashboard mínimo filtrable por fecha/agencia/vendedor/moneda — sin gráficos (full dashboard + charts + export Excel/PDF → 2.1.x)
  8. Los catálogos (agencias, tours, vendedores, formas de pago, monedas) son CRUD via admin UI — no texto libre en formularios (elimina errores de tipeo tipo "VALLE SAGRADO VIP" vs "Valle sagrado  vip")
  9. El schema separa core contable (`usuarios`, `contactos`, `cuentas`, `asientos`, `asiento_lineas`, `audit_log`, `modulos`) del módulo Tours (`tours_catalogo`, `liquidaciones`, `tours_servicios`, `comision_reglas`) — añadir un módulo futuro (café) no toca el core
  10. Reproducible desde clean checkout via `docker compose up -d` + `.env.example` (sin pasos manuales fuera de DNS ya configurado en Phase 1)

**Plans**: 2/2 plans complete

Plans:

- [x] 02.1-01-PLAN.md — Scaffold `apps/tours/{web,api}` + Traefik compose + FastAPI core de partida doble + audit_log estructural (before_flush + ContextVar) + auth NextAuth/Credentials + JWT bridge + catálogos CRUD + POST /ventas con asiento balanceado en una sola tx + /simular comisión + UI login/ventas/catálogos/usuarios (TOURS-01..08)
- [x] 02.1-02-PLAN.md — Liquidaciones state machine (abierta→cerrada→revertida) con asientos automáticos de comisión + pre-checks + reopen con reversión + dashboard mínimo filtrable (4 cards + tours pendientes) + auditoría viewer admin-only + comisiones reglas UI manager + CI matrix refactor (D-04) + deploy HTTPS prod (TOURS-03, TOURS-09, TOURS-10)

### Phase 02.1.1: Tours — CRUD catálogos + gestión usuarios (INSERTED)

**Goal:** Cierra la brecha de CRUD que Phase 02.1 dejó abierta: catálogos (PUT codigo/nombre + referential check 409 con lista de referencias en DELETE + RBAC contabilidad además de admin), usuarios (CRUD completo con bcrypt + audit_log redaction + last-admin + self-delete + email-unicos guards), self-service password change en /perfil para cualquier rol, y Perfil + Catálogos visibles en el nav. Backend expone el surface; frontend wirea los modales + páginas + Route Handlers.
**Mode**: standard (granularity=standard; phase.mvp-mode=false per query)
**Depends on:** Phase 02.1
**Requirements**: TOURS-04, TOURS-06, TOURS-08 (gaps que Phase 02.1.1 cierra — ya estaban complete pero sin CRUD UI/backend)
**Open decisions**: Resueltos en pre-discusión (ver `02.1.1-CONTEXT.md`) — D-13 RBAC contabilidad para catalogos, D-18/D-19 referential check 409 con detalle.referencias, D-11 last-admin + D-12 self-delete guards, D-08/D-09 password endpoints con bcrypt, D-21 frontend muestra la lista de referencias en el toast, Restaurar via POST .../restore dedicado (D-03 corollary).
**Success Criteria** (what must be TRUE):
  1. `PUT /catalogos/{entidad}/{id}` actualiza codigo/nombre; preserva `activo`; admin y contabilidad pueden llamarlo; vendedor recibe 403
  2. `DELETE /catalogos/{entidad}/{id}` retorna 409 + `{"detail":{"mensaje":"...","referencias":[{"tabla":...,"count":N},...]}}` cuando hay referencias activas; retorna 200/204 cuando no
  3. `POST /usuarios` crea usuario con password hasheada con bcrypt; retorna 201 sin password_hash; email duplicado retorna 409; vendedor recibe 403
  4. `PUT /usuarios/{id}` edita email/username/rol/activo (NO password — endpoint dedicado); admin-only; rechaza cambio de rol que deje 0 admins con 409
  5. `DELETE /usuarios/{id}` soft-delete (activo=false); admin-only; rechaza self-delete y last-admin con 409
  6. `PUT /usuarios/me/password` requiere current_password correcta; hashea new_password; cualquier usuario autenticado puede usarlo; 401 si current es incorrecta
  7. `PUT /usuarios/{id}/password` admin-only; hashea new_password; NO requiere current_password
  8. Cada op CRUD sobre `usuarios` deja entrada en `audit_log` con `password_hash = null` en datos_antes/datos_despues (D-26 — verificado vía /admin/auditoria)
  9. Frontend `<CatalogoFormModal>` se abre para Agregar + Editar; submit POST/PUT; toast on success/error; 409 con detail.referencias se muestra en el toast (D-21)
  10. Frontend acción "Restaurar" reactiva item soft-deleted via POST /catalogos/{entidad}/{id}/restore
  11. Frontend `/admin/usuarios` renderiza usuarios reales desde /api/usuarios; Nuevo/Editar/Restablecer/Eliminar wired; self-delete y last-admin Eliminar links visualmente deshabilitados
  12. Frontend `/perfil` página permite cambio de contraseña para cualquier usuario autenticado
  13. Nav muestra "Perfil" para los 3 roles; "Catálogos" visible para admin + contabilidad (no solo admin)
  14. Middleware permite contabilidad en /catalogos; /perfil protegido (cualquier autenticado); /admin/* sigue admin-only

**Plans:** 2 plans

Plans:

- [ ] 02.1.1-01-PLAN.md — Backend: PUT catalogos + DELETE referential check + RBAC admin+contabilidad; nuevo /usuarios router (CRUD + 2 password endpoints) con guards + audit redaction (TOURS-04, TOURS-06, TOURS-08)
- [ ] 02.1.1-02-PLAN.md — Frontend: proxyJson helper + 5 Route Handlers + 2 modals (Catalogo/Usuario); /perfil + /admin/usuarios real fetch; catalogos page wired (Agregar/Editar/Restaurar); nav + middleware update (TOURS-04, TOURS-06, TOURS-08)

### Phase 3: Legal + AdSense Readiness

**Goal**: The site satisfies all legal and Google AdSense acceptance prerequisites — ready for the user to apply to AdSense manually (the agent never auto-applies).
**Mode**: mvp
**Depends on**: Phase 2
**Requirements**: CONT-06, CONT-07, CONT-08, SEOA-01, SEOA-02, SEOA-03, SEOA-04, SEOA-05, SEOA-06, SEOA-07
**Success Criteria** (what must be TRUE):

  1. Privacy Policy, Terms of Use, and a Contact page are live and linked from the footer on every page
  2. `sitemap.xml` and `robots.txt` (including a `Mediapartners-Google` rule) are reachable at the root
  3. Google Search Console ownership of `luciel.dev` is verified (DNS or HTML file method)
  4. Each blog post has a unique meta description, canonical URL, and Article structured data (schema.org)
  5. A representative blog page passes Core Web Vitals — no JS hydration blocking the largest contentful paint (Astro zero-JS output)

**Plans**: TBD

Plans:

- [ ] 03-01: TBD

### Phase 4: First Tool Pilot (rtk) + Pattern Documentation

**Goal**: A real, working tool runs at `rtk.luciel.dev` with its own Let's Encrypt cert and content page, and the reproducible "add a new subdomain" path is documented from the actual steps taken.
**Mode**: mvp
**Depends on**: Phase 3
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, TOOL-07, DOCS-01, DOCS-02
**Research flag**: The specific rtk tool domain (token optimization use case) needs a spike during planning — existing tools, UX shape, and whether a FastAPI backend is even required or the tool is pure-frontend compute.
**Success Criteria** (what must be TRUE):

  1. `rtk.luciel.dev` loads over HTTPS with its own valid Let's Encrypt certificate (separate from root)
  2. A user can complete a real task end-to-end and get a correct, meaningful result — not a stub or placeholder
  3. `rtk.luciel.dev` has a content page (600+ words) explaining the problem the tool solves, alongside the interactive widget
  4. `docs/adding-a-new-app.md` captures the actual commands and files used to build rtk — a second subdomain can be added by following it without reinventing the process
  5. `.env.example` is updated with any rtk-required variables (or confirmed unchanged if rtk needs none)

**Plans**: TBD

Plans:

- [ ] 04-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure + Landing Scaffold | 2/2 | Complete   | 2026-07-03 |
| 2. Content Hub | 0/0 | Not started | - |
| 3. Legal + AdSense Readiness | 0/0 | Not started | - |
| 4. First Tool Pilot (rtk) + Pattern Documentation | 0/0 | Not started | - |
