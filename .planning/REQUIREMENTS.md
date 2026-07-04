# Requirements: luciel-platform

**Defined:** 2026-07-02
**Core Value:** Cada subdominio nuevo entrega una herramienta funcional que resuelve un problema real, acompañada de contenido genuino, sobre infraestructura reproducible versionada en git.

## v1 Requirements

### Infrastructure

- [x] **INFR-01**: Traefik reverse proxy configurado con entrypoints web/websecure, HTTP-01 challenge para Let's Encrypt, y redirect HTTP→HTTPS
- [x] **INFR-02**: `docker-compose.yml` raíz con Traefik como servicio + network compartida para todas las apps
- [x] **INFR-03**: DNS configurado (registro A para `@` + wildcard `*` apuntando al VPS)
- [x] **INFR-04**: Let's Encrypt staging y prod verificados — `curl -I https://luciel.dev` devuelve 200 con cert válido
- [x] **INFR-05**: `.env.example` en raíz con todas las variables requeridas (email Let's Encrypt, secrets)
- [x] **INFR-06**: `traefik/traefik.yml` con config estática, certs en volumen gitignored

### Content Hub

- [x] **CONT-01**: App `apps/landing/` sirviendo `luciel.dev` como raíz (Astro 7 o Next.js — decidir en Phase 1)
- [ ] **CONT-02**: Home page con presentación personal + filosofía del proyecto + directorio de herramientas (entradas "próximamente" para herramientas no lanzadas)
- [ ] **CONT-03**: Blog con 5-8 artículos reales basados en proyectos técnicos existentes (simulador tráfico multi-agente, AGRODROID, sistema RAG, pipeline ABET)
- [ ] **CONT-04**: Blog usa MDX en Content Collections, con syntax highlighting (Shiki) para código
- [ ] **CONT-05**: Página "Proyectos" con herramientas planeadas y su estado
- [ ] **CONT-06**: Página de Privacidad (generada con Termly/iubenda, personalizada con disclosura de AdSense y cookies)
- [ ] **CONT-07**: Página de Términos de Uso
- [ ] **CONT-08**: Página de Contacto (formulario o email)
- [ ] **CONT-09**: Página 404 personalizada
- [ ] **CONT-10**: Navegación completa del sitio (header + footer global con enlaces a todas las secciones)
- [ ] **CONT-11**: RSS/Atom feed del blog generado automáticamente
- [ ] **CONT-12**: Open Graph tags en todas las páginas (title, description, image)

### SEO and AdSense Preparation

- [ ] **SEOA-01**: `sitemap.xml` auto-generado y accesible en raíz
- [ ] **SEOA-02**: `robots.txt` con reglas apropiadas, incluyendo `Mediapartners-Google` para el crawler de AdSense
- [ ] **SEOA-03**: `ads.txt` en raíz (creado cuando se tenga el ID de AdSense)
- [ ] **SEOA-04**: Google Search Console verificado
- [ ] **SEOA-05**: Core Web Vitals optimizados (Astro output zero-JS, imágenes optimizadas, lazy loading)
- [ ] **SEOA-06**: Structured data (Article schema) en páginas de blog
- [ ] **SEOA-07**: Cada página del blog tiene meta description única + canonical URL

### Tours — Panel Contable Hotel (Phase 02.1 INSERTED)

- [x] **TOURS-01**: Nueva carpeta `apps/tours/` con Next.js 16 + TypeScript (App Router) + Tailwind, siguiendo el patrón Traefik labels como `apps/landing/`
- [x] **TOURS-02**: Backend FastAPI + SQLAlchemy async + SQLite WAL (no Postgres — override explícito evaluado y rechazado por YAGNI a esta escala)
- [ ] **TOURS-03**: Traefik router para `tours.luciel.dev` con cert Let's Encrypt propio (HTTP-01, per-subdomain, no wildcard cert)
- [x] **TOURS-04**: Auth NextAuth/Credentials + bcrypt + tabla `usuarios` con roles `admin` / `vendedor` / `contabilidad` (reemplaza contraseña hardcodeada "2808" del VBA)
- [x] **TOURS-05**: Core contable de partida doble: `cuentas` / `asientos` / `asiento_lineas` con balance validado en FastAPI dentro de la transacción (no SQL trigger)
- [x] **TOURS-06**: Módulo Tours con `tours_catalogo` / `liquidaciones` / `tours_servicios` (con `asiento_id` FK al core, `metadata` JSONB híbrido para campos variables) — separado del core, sin tocarlo
- [x] **TOURS-07**: `comision_reglas` con prioridad determinística 1-4 (vendedor+tour > vendedor > tour > default global no borrable), endpoint `/simular` para probar antes de guardar
- [x] **TOURS-08**: `audit_log` registra cada INSERT/UPDATE/DELETE con `usuario_id` + timestamp + `datos_antes` / `datos_despues` (resuelve el borrado sin rastro de la macro VBA)
- [ ] **TOURS-09**: Liquidaciones: abrir + cerrar; el cierre genera asientos de distribución/comisión automáticamente (reemplaza suma manual de Sandra en fila Egreso)
- [ ] **TOURS-10**: Dashboard mínimo: filtros por fecha/agencia/vendedor/moneda + tabla + totales de saldo por cuenta (sin gráficos — full dashboard + charts + export → 2.1.x deferred)

### Tools — First Pilot (rtk)

- [ ] **TOOL-01**: Nueva carpeta `apps/rtk/` siguiendo el mismo patrón que `apps/landing/`
- [ ] **TOOL-02**: Dockerfile para la app rtk, con labels de Traefik para `rtk.luciel.dev`
- [ ] **TOOL-03**: Backend FastAPI (si la herramienta lo requiere) con conexión a SQLite WAL
- [ ] **TOOL-04**: Frontend Next.js 16 (App Router) con la interfaz del optimizador de tokens
- [ ] **TOOL-05**: Página de contenido junto a la herramienta (600+ palabras explicando el problema que resuelve)
- [ ] **TOOL-06**: SSL funcionando — `rtk.luciel.dev` accesible por HTTPS con cert Let's Encrypt válido
- [ ] **TOOL-07**: La herramienta es funcional end-to-end (no demo vacío)

### Documentation and Reproducibility

- [ ] **DOCS-01**: `docs/adding-a-new-app.md` con el checklist real del proceso seguido en TOOL-01 a TOOL-06
- [ ] **DOCS-02**: `.env.example` actualizado después de agregar cada app nueva

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Additional Tools

- **TOOL2-01**: Segunda herramienta (`graph.luciel.dev` — code-graph visualizer)
- **TOOL2-02**: Tercera herramienta (`hackathons.luciel.dev` — hackathon radar con Tavily/SerpApi + LLM filter + SQLite dedup)
- **TOOL2-03**: Herramientas adicionales siguiendo el checklist `docs/adding-a-new-app.md`

### Shared Components

- **SHARED-01**: `packages/ui` con componentes compartidos (crear solo cuando 2+ apps repitan el mismo patrón)
- **SHARED-02**: Componentes reutilizables de analytics/AdSense

## Out of Scope

| Feature | Reason |
|---------|--------|
| PostgreSQL | SQLite WAL suficiente para tráfico bajo-medio. Migrar solo con evidencia real de contención. |
| Kubernetes | Escala no lo justifica. Docker Compose es correcto para single-VPS. |
| User authentication/login | Sin cuentas de usuario en el alcance actual. Añade superficie de seguridad sin beneficio. |
| Comments system (Disqus, Giscus) | Carga de moderación sin beneficio para el alcance actual. AdSense policy risk con UGC. |
| OAuth / Magic link / 2FA | No hay autenticación que proteger. |
| Headless CMS (Strapi, Sanity) | Overhead innecesario para blog técnico < 100 artículos. MDX en git es suficiente. |
| Cloudflare/nginx frente a Traefik | Capa extra de complejidad. Traefik enfrenta internet directamente. |
| Analytics (GA/Plausible/Umami) | Solo AdSense scripts por ahora. Sin GA ni trackers adicionales. |
| API monetization / paywalls | Cambia fundamentalmente el producto. AdSense es suficiente. |
| Video posts | Storage/bandwidth alto. Contenido técnico es texto + código. |
| Mobile app | Web-first. Responsive design cubre mobile. |
| Streamlit para herramientas | No indexable por Google. Complica AdSense. Next.js es el estándar. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 1 | Complete |
| INFR-03 | Phase 1 | Complete |
| INFR-04 | Phase 1 | Complete |
| INFR-05 | Phase 1 | Complete |
| INFR-06 | Phase 1 | Complete |
| CONT-01 | Phase 1 | Complete |
| CONT-02 | Phase 2 | Pending |
| CONT-03 | Phase 2 | Pending |
| CONT-04 | Phase 2 | Pending |
| CONT-05 | Phase 2 | Pending |
| CONT-09 | Phase 2 | Pending |
| CONT-10 | Phase 2 | Pending |
| CONT-11 | Phase 2 | Pending |
| CONT-12 | Phase 2 | Pending |
| TOURS-01 | Phase 02.1 | Complete |
| TOURS-02 | Phase 02.1 | Complete |
| TOURS-03 | Phase 02.1 | Pending |
| TOURS-04 | Phase 02.1 | Complete |
| TOURS-05 | Phase 02.1 | Complete |
| TOURS-06 | Phase 02.1 | Complete |
| TOURS-07 | Phase 02.1 | Complete |
| TOURS-08 | Phase 02.1 | Complete |
| TOURS-09 | Phase 02.1 | Pending |
| TOURS-10 | Phase 02.1 | Pending |
| CONT-06 | Phase 3 | Pending |
| CONT-07 | Phase 3 | Pending |
| CONT-08 | Phase 3 | Pending |
| SEOA-01 | Phase 3 | Pending |
| SEOA-02 | Phase 3 | Pending |
| SEOA-03 | Phase 3 | Pending |
| SEOA-04 | Phase 3 | Pending |
| SEOA-05 | Phase 3 | Pending |
| SEOA-06 | Phase 3 | Pending |
| SEOA-07 | Phase 3 | Pending |
| TOOL-01 | Phase 4 | Pending |
| TOOL-02 | Phase 4 | Pending |
| TOOL-03 | Phase 4 | Pending |
| TOOL-04 | Phase 4 | Pending |
| TOOL-05 | Phase 4 | Pending |
| TOOL-06 | Phase 4 | Pending |
| TOOL-07 | Phase 4 | Pending |
| DOCS-01 | Phase 4 | Pending |
| DOCS-02 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-02*
*Last updated: 2026-07-04 — added TOURS-01..10 for Phase 02.1 INSERTED*
