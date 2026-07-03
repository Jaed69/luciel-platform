# luciel-platform

## What This Is

Plataforma "portafolio productizado": un monorepo en `luciel.dev` que combina un hub de contenido raíz (presentación personal, filosofía, blog técnico, directorio de herramientas) con herramientas web reales y funcionales, cada una en su propio subdominio. No es un portafolio estático de capturas —son herramientas que resuelven problemas reales, con contenido genuino alrededor de cada una para pasar la revisión de Google AdSense y generar tráfico orgánico.

## Core Value

Cada subdominio nuevo debe entregar una herramienta funcional que resuelve un problema real, acompañada de contenido genuino —no demos vacíos—, sobre infraestructura reproducible versionada en git.

## Business Context

- **Customer**: Usuarios de herramientas técnicas + lectores del blog (tráfico orgánico)
- **Revenue model**: Google AdSense en dominio raíz y subdominios
- **Success metric**: AdSense aprobado + al menos 1 herramienta pública funcional con anuncios activos
- **Strategy notes**: `luciel-platform-brief.md` (raíz del repo) — fuente de verdad original

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Infraestructura base: Traefik + Docker Compose + dominio raíz con SSL válido
- [ ] Landing `luciel.dev` servida detrás de Traefik con certificado Let's Encrypt real
- [ ] Home con presentación personal + filosofía + directorio de herramientas
- [ ] Blog con 5-8 artículos reales basados en proyectos técnicos genuinos existentes
- [ ] Páginas legales: Privacidad, Términos de Uso, Contacto
- [ ] Sitio completo publicado sin 404/500, navegación funcional
- [ ] Primera herramienta piloto en subdominio (sin dependencias externas frágiles)
- [ ] Patrón "agregar subdominio nuevo" documentado en `docs/adding-a-new-app.md`
- [ ] Herramientas adicionales siguiendo el patrón reproducible (rtk → graph → hackathons)

### Out of Scope

- **PostgreSQL** — SQLite con WAL es suficiente hasta evidencia real de contención de escrituras
- **Kubernetes** — la escala no lo justifica; Docker Compose basta
- **OAuth/magic link/2FA** — no hay autenticación de usuario en el alcance actual
- **Streamlit para herramientas** — no indexable por Google, complica AdSense
- **Reverse proxy distinto a Traefik** — decisión no renegociable salvo bloqueante técnico
- **Aplicar a AdSense automáticamente** — el usuario lo hace manualmente desde el panel de Google
- **`packages/ui` compartido** — no crear hasta que 2+ apps repitan el mismo patrón
- **Scraping/APIs externas inestables en el piloto** — van después de validar el patrón

## Context

**Filosofía del proyecto:** herramientas que resuelven problemas reales, no demos vacías. Cada subdominio nuevo debe tener contenido genuino alrededor (no solo la herramienta sola) —eso es lo que permite pasar AdSense y generar tráfico orgánico. El orden de fases importa: el dominio raíz va primero porque AdSense requiere contenido sustancial aprobado antes de monetizar subdominios.

**Stack técnico (decisiones no renegociables sin confirmación explícita):**

| Decisión | Elección | Razón |
|---|---|---|
| Reverse proxy | Traefik | Descubrimiento automático vía Docker socket + SSL automático (Let's Encrypt). App nueva solo con labels. |
| Orquestación | Docker Compose | La escala no justifica K8s. Un solo `docker-compose.yml` raíz. |
| Backend | FastAPI (Python) | Async, tipado, OpenAPI gratis, consistente con stack ML/RAG existente. |
| DB inicial | SQLite con WAL | Suficiente para tráfico bajo-medio. Migrar a Postgres solo con evidencia de contención. |
| Frontend herramientas | Next.js | Indexable por Google, compatible con AdSense nativamente, demuestra frontend real. |
| Frontend landing | Next.js o Astro | Decidir en Phase 1 (Astro si mostly static+blog, Next si mucha interactividad). |
| DNS | Registro A root + wildcard `*` | Evita tocar DNS por cada subdominio nuevo. |
| SSL | Let's Encrypt vía HTTP-01 (no wildcard) | Más simple que DNS-01, sin API key del proveedor DNS. Cada subdominio saca su cert. |

**Estructura del monorepo:**

```
luciel-platform/
├── docker-compose.yml
├── .env.example
├── traefik/
│   ├── traefik.yml
│   └── letsencrypt/         # gitignored
├── apps/
│   ├── landing/              → luciel.dev (root)
│   └── (una carpeta por herramienta futura)
├── packages/
│   └── ui/                   # crear solo cuando 2+ apps repitan patrón
└── docs/
    └── adding-a-new-app.md   # checklist reproducible
```

**Herramientas candidatas identificadas (orden sugerido):**
1. `rtk.luciel.dev` (Phase 3 piloto — optimizador de tokens, sin dependencias frágiles)
2. `graph.luciel.dev` (code-graph)
3. `hackathons.luciel.dev` (hackathon radar — requiere Tavily/SerpApi + filtro LLM + SQLite con deduplicación por URL; dejar hasta que el patrón esté probado por fragilidad de fuentes externas)

**Contenido del blog — fuentes genuinas disponibles:**
Arquitectura del simulador de tráfico multi-agente, diseño de red AGRODROID, sistema RAG, pipeline ABET. Texto original, no traducciones ni contenido genérico.

## Constraints

- **Tech stack**: Tabla de decisiones arriba — no proponer alternativas salvo bloqueante técnico demostrado
- **Guardrails del agente**: No adelantar fases. No sobre-diseñar (solución más simple que cumpla el objetivo de la fase). Contenido real no relleno. Cada app nueva sigue el mismo molde (Dockerfile + labels Traefik + página de contenido). Confirmar antes de cambios estructurales (SQLite→Postgres, reverse proxy, restructurar carpetas).
- **Secretos**: API keys (Tavily/OpenAI/Anthropic, email Let's Encrypt) en `.env`, nunca hardcodeadas ni commiteadas. Mantener `.env.example` actualizado.
- **AdSense**: No aplicar automáticamente — el usuario lo hace manualmente. El agente solo asegura cumplimiento técnico y de contenido.
- **Orden de fases**: No saltar contenido por ir a la parte técnica "divertida". Fase 0 (entendimiento) debe confirmarse antes de empezar.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mapeo 1:1 brief→roadmap | El brief ya estructura fases claras con DoD; Fase 0 = gate de confirmación antes de Phase 1 | — Pending |
| Landing framework diferido a Phase 1 | Brief lo deja explícito como decisión de Fase 1; depende de si el root es mostly static (Astro) o interactivo (Next) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Business Context check — customer, revenue model, success metric still accurate?
4. Audit Out of Scope — reasons still valid?
5. Update Context with current state

---
*Last updated: 2026-07-02 after initialization*
