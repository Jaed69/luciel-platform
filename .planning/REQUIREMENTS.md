# Requirements: luciel-platform

**Defined:** 2026-07-02
**Core Value:** Cada subdominio nuevo entrega una herramienta funcional que resuelve un problema real, acompañada de contenido genuino, sobre infraestructura reproducible versionada en git.

## v1 Requirements

### Infrastructure

- [ ] **INFR-01**: Traefik reverse proxy configurado con entrypoints web/websecure, HTTP-01 challenge para Let's Encrypt, y redirect HTTP→HTTPS
- [ ] **INFR-02**: `docker-compose.yml` raíz con Traefik como servicio + network compartida para todas las apps
- [ ] **INFR-03**: DNS configurado (registro A para `@` + wildcard `*` apuntando al VPS)
- [ ] **INFR-04**: Let's Encrypt staging y prod verificados — `curl -I https://luciel.dev` devuelve 200 con cert válido
- [ ] **INFR-05**: `.env.example` en raíz con todas las variables requeridas (email Let's Encrypt, secrets)
- [ ] **INFR-06**: `traefik/traefik.yml` con config estática, certs en volumen gitignored

### Content Hub

- [ ] **CONT-01**: App `apps/landing/` sirviendo `luciel.dev` como raíz (Astro 7 o Next.js — decidir en Phase 1)
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
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Pending |
| INFR-03 | Phase 1 | Pending |
| INFR-04 | Phase 1 | Pending |
| INFR-05 | Phase 1 | Pending |
| INFR-06 | Phase 1 | Pending |
| CONT-01 | Phase 1 | Pending |
| CONT-02 | Phase 2 | Pending |
| CONT-03 | Phase 2 | Pending |
| CONT-04 | Phase 2 | Pending |
| CONT-05 | Phase 2 | Pending |
| CONT-09 | Phase 2 | Pending |
| CONT-10 | Phase 2 | Pending |
| CONT-11 | Phase 2 | Pending |
| CONT-12 | Phase 2 | Pending |
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
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-02*
*Last updated: 2026-07-02 after initial definition*
