# AGENTS.md

Empty scaffold repository. No codebase, commands, or conventions yet.

<!-- GSD:project-start source:PROJECT.md -->

## Project

**luciel-platform**

Plataforma "portafolio productizado": un monorepo en `luciel.dev` que combina un hub de contenido raíz (presentación personal, filosofía, blog técnico, directorio de herramientas) con herramientas web reales y funcionales, cada una en su propio subdominio. No es un portafolio estático de capturas —son herramientas que resuelven problemas reales, con contenido genuino alrededor de cada una para pasar la revisión de Google AdSense y generar tráfico orgánico.

**Core Value:** Cada subdominio nuevo debe entregar una herramienta funcional que resuelve un problema real, acompañada de contenido genuino —no demos vacíos—, sobre infraestructura reproducible versionada en git.

### Constraints

- **Tech stack**: Tabla de decisiones arriba — no proponer alternativas salvo bloqueante técnico demostrado
- **Guardrails del agente**: No adelantar fases. No sobre-diseñar (solución más simple que cumpla el objetivo de la fase). Contenido real no relleno. Cada app nueva sigue el mismo molde (Dockerfile + labels Traefik + página de contenido). Confirmar antes de cambios estructurales (SQLite→Postgres, reverse proxy, restructurar carpetas).
- **Secretos**: API keys (Tavily/OpenAI/Anthropic, email Let's Encrypt) en `.env`, nunca hardcodeadas ni commiteadas. Mantener `.env.example` actualizado.
- **AdSense**: No aplicar automáticamente — el usuario lo hace manualmente. El agente solo asegura cumplimiento técnico y de contenido.
- **Orden de fases**: No saltar contenido por ir a la parte técnica "divertida". Fase 0 (entendimiento) debe confirmarse antes de empezar.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Traefik | v3.7.x (v3.7.5) | Reverse proxy, SSL termination, Docker auto-discovery | Auto-wires new apps via Docker labels. HTTP-01 Let's Encrypt per subdomain. No config file edits to add a new app. v3.7 is current stable with HTTP/3, OpenTelemetry, WASM middleware. |
| Docker Compose | v2.32+ | Container orchestration | Single `docker-compose.yml` root for entire monorepo. No K8s complexity needed at this scale. |
| FastAPI | 0.136.x (0.136.1+) | Python async API framework | Async, typed, OpenAPI docs free. Matches user's existing ML/RAG Python stack. Minimal boilerplate for small per-tool backends. |
| Astro | 7.0.x (7.0.4) | Landing/content hub (luciel.dev root) | **See recommendation below (Next.js vs Astro)**. Zero-JS default output = best AdSense/SEO baseline. Content Collections + MDX for blog. |
| Next.js | 16.2.x (16.2.10) | Tool subdomain frontends | Full-stack React for interactive tools. Indexable by Google. AdSense-compatible ad placement. Required for tool UIs that need client-side state. |
| SQLite | 3.51.x (latest bundled with Python 3.13+) | Primary database (WAL mode) | No separate DB server. WAL mode handles concurrent reads during writes. Named Docker volume for persistence. Migrate to Postgres ONLY on evidence of write contention. |
| Node.js | 22.x LTS | Runtime for Astro/Next.js builds and dev | Active LTS until Oct 2026 (Maintenance until Apr 2027). Both Astro 7 and Next.js 16 require Node 22+. Safest production choice. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uvicorn | 0.34.x | ASGI server for FastAPI | Every FastAPI service. Standard. Production ASGI server. |
| pydantic | 2.11.x | Data validation, settings management | Every FastAPI service. Bundled with FastAPI. Use `BaseSettings` for env config. |
| aiosqlite | 0.21.x | Async SQLite access for FastAPI | When FastAPI needs async DB access. Wraps `sqlite3` in async context manager. |
| @astrojs/mdx | 7.x (bundled with Astro 7) | MDX support in Astro Content Collections | Blog posts in Astro landing. Content Collections + MDX = type-safe frontmatter, embedded components. |
| @astrojs/sitemap | 7.x | Sitemap generation | SEO requirement. Auto-generates sitemap.xml from all pages. |
| @astrojs/rss | 7.x | RSS feed for blog | Blog needs RSS for AdSense eligibility and reader engagement. |
| bright (Shiki) | 2.x | Syntax highlighting for code blocks | Technical blog requirement. Use Shiki-based highlighting in MDX posts. |
| tailwindcss | 4.x | CSS framework | Styling for both Astro landing and Next.js tools. Consistent design system. |
| next-mdx-remote | 5.x | Render MDX in Next.js | If any tool subdomain needs MDX content alongside interactive tool UI. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| uv | Python package manager (replaces pip) | Fast, deterministic. `uv pip install` or `uv sync`. By Astral (same as Ruff). |
| pnpm | JS package manager | Disk-efficient monorepo. Faster than npm. Use with `--filter` for per-app commands. |
| create-next-app | Next.js project scaffolding | Already familiar to the user. Use `--typescript --app --tailwind --eslint`. |
| create-astro | Astro project scaffolding | Use `--template basics` and `--add tailwind,mdx,sitemap`. |

## Installation

# Python (inside each FastAPI service)

# JS (at monorepo root, using pnpm)

# Traefik

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Astro 7 for landing | Next.js 16 for landing | Use Next if root needs SIGNIFICANT client-side interactivity (dashboards, real-time data, complex forms). Current brief: static content + blog = Astro wins. |
| SQLite + WAL | PostgreSQL | Use Postgres when SQLite shows write contention under concurrent load, OR if a future tool needs replication/HA. Not before. |
| MDX in-repo | Headless CMS (Strapi, Sanity, Contentful) | Use headless CMS if (a) non-technical editors create content, (b) content volume > 200 articles, (c) multi-platform content syndication needed. Solo technical blog < 100 articles = MDX wins. |
| Docker Compose | Kubernetes | Use K8s if (a) running across multiple nodes, (b) need auto-scaling, (c) team of 8+ managing infra. Never justified at this scale. |
| aiosqlite | SQLAlchemy async + aiosqlite | Use SQLAlchemy when (a) 3+ models with complex relationships, (b) migration path to Postgres is imminent, (c) need Alembic migrations. For small per-tool backends (1-3 tables), raw aiosqlite is less overhead. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Streamlit for tool frontends | Not indexable by Google. Complicates AdSense ad injection. Produces bloated HTML. | Next.js App Router |
| Pages Router in Next.js | Maintenance mode since Next.js 16. Async API shims removed. No new features. | App Router (default in Next.js 16) |
| Traefik v2.x | v2.11 entered security-only in Apr 2025, ends Feb 2026 (already passed). No HTTP/3, no OpenTelemetry. | Traefik v3.7.x |
| Webpack in Next.js | Turbopack is default in Next.js 16. Webpack-specific plugins need review. | Turbopack (built-in, no config) |
| NFS/CIFS for SQLite | WAL mode uses mmap — does NOT work over network filesystems. File locking broken. | Named Docker volumes on local host disk |
| tiangolo/uvicorn-gunicorn Docker image | Bloated, outdated. Runs gunicorn strategy which is wrong for FastAPI (uvicorn workers don't benefit). | `python:3.13-slim` + `CMD ["uvicorn", ...]` |

## Stack Patterns by Variant

### If landing is mostly static content + blog (current best bet → ASTRO):

- **Use Astro 7** for the root `luciel.dev`
- Content Collections for blog with MDX
- Zero-JS output for AdSense + SEO baseline
- Tailwind for styling
- Deploy as node:22 Docker container serving static files via Traefik (or use `astro build` + nginx static file serving behind Traefik)
- Astro 7 uses Rust-based Sätteri Markdown pipeline — faster builds, no remark/rehype dependency

### If landing needs significant interactivity (fallback → NEXT.JS):

- **Use Next.js 16** for the root
- App Router, React Server Components
- More JS shipped = more optimization work for AdSense/SEO
- Self-hosted behind Traefik with `next start`
- Cache Components (`"use cache"` directive) for static content

### For tool subdomains (ALWAYS NEXT.JS):

- Tools need real client-side interactivity (token optimizers, graph visualizers, etc.)
- Next.js 16, App Router
- Each tool is a standalone Next.js app in its own `apps/<name>` folder
- FastAPI backend only when the tool needs server-side compute (token counting, file processing, DB operations)

### For tool FastAPI backends:

- Module-per-resource pattern (NOT over-architected)
- Single file `main.py` for endpoints < 5
- Split to `app/routers/` when endpoints > 10
- Config via Pydantic `BaseSettings` from `.env`
- Keep it flat — no service/repository abstraction until you copy-paste the same query pattern 3 times

## Next.js vs Astro: Prescriptive Recommendation

| Criterion | Astro 7 | Next.js 16 | Winner |
|-----------|---------|------------|--------|
| Static output (AdSense baseline) | Zero JS by default. Pure HTML output. AdSense bots see content instantly. | Ships React runtime + hydration data with every page. More JS weight for crawlers. | Astro |
| SEO for content blog | Content Collections + MDX. Sätteri pipeline (Rust). Fast builds. | Good SEO but needs deliberate optimization to avoid hydration tax. | Astro (slightly) |
| Blog authoring DX | MDX in repo, git-based workflow. `astro:assets` for images. | MDX with `next-mdx-remote`. More boilerplate. | Astro |
| Self-hosting complexity | Static files + Traefik. Minimal overhead. | Node server runtime needed. `next start`. More memory. | Astro |
| AdSense compatibility | Clean HTML, no framework JS interference. Known to pass AdSense review without issues. | Can pass AdSense but requires careful optimization to avoid JS-related rejections. | Astro |
| Future interactivity ceiling | Can embed React islands. Good for limited interactivity (newsletter signup, contact form). | Full React. Unlimited interactivity. | Next.js |
| Ecosystem maturity | Smaller ecosystem. Fewer third-party libs. But growing fast. | Vast ecosystem. Battle-tested. Larger community. | Next.js |

- The landing is a content hub with blog, personal presentation, tool directory, and legal pages
- It needs minimal interactivity: a contact form, maybe a newsletter signup
- AdSense approval is a concrete success metric — cleaner HTML directly helps this
- The user is a solo developer — simpler deployment (static files) is better
- `Astro.glob()` removed → use `import.meta.glob()` or `getCollection()`
- `<ViewTransitions/>` renamed to `<ClientRouter/>`
- Node < 22 no longer supported
- Vite 8 with Rolldown (Rust bundler) — 15-61% faster builds
- Sätteri is default Markdown processor (not remark/rehype)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| astro@^7.0 | node@^22.12.0 | Node 18/20 not supported by Astro 7 |
| next@^16.2 | node@^20.x or ^22.x | Node 18 support dropped in Next.js 16 |
| fastapi@^0.136 | python@^3.10 (recommend 3.13) | Python 3.13 slim is ideal for Docker |
| traefik:v3.7 | Docker API ≥ 1.44 | Use modern Docker Engine (24+). v3.6.1+ fixed the Docker API negotiation bug. |
| pydantic@^2.11 | fastapi@^0.136 | Bundled, but pin explicitly for Docker reproducibility |
| tailwindcss@^4 | astro@^7, next@^16 | Tailwind v4 is a CSS-first rewrite. Works with `@tailwindcss/vite` plugin. |

## Traefik Configuration Patterns

### HTTP-01 Challenge with Per-Subdomain Certs (Non-Negotiable)

# traefik/traefik.yml (static config)

### Docker Compose Root Structure

# docker-compose.yml

### Labels Pattern for Adding a New Subdomain App

### HTTP-01 Specifics for Per-Subdomain Certs

- Each Host rule triggers a distinct ACME cert request
- Let's Encrypt rate limits: 50 certs/week — more than enough for this project
- HTTP-01 serves the challenge file on port 80 (Traefik handles this automatically)
- No DNS API keys needed (vs DNS-01)
- Certs are stored in `acme.json` — single file, NOT one file per domain
- This is the simplest setup and matches the locked decision

## FastAPI Project Structure (Minimal)

- `services/` or `repositories/` layers
- Dependency injection containers
- SQLAlchemy (use raw sqlite3/aiosqlite)
- Alembic migrations (manual schema versioning is adequate for single-developer tools)

## SQLite + WAL in Docker: Operational Concerns

### Named Volume (NOT Bind Mount for DB files)

### WAL Mode Configuration

# Always enable on every new connection:

### Backup Strategy

# SQLite Online Backup (safe for live DB)

### Key Facts Confirmed by Research (Simon Willison, Apr 2026)

- **Same-host Docker containers sharing a named volume: WAL works correctly.** The Linux kernel shared-memory mmap works across containers on the same host.
- **Cross-host (multi-node): WAL breaks.** Not relevant here (single host).
- **The `.db-shm` and `.db-wal` files are expected.** Do not delete them. They are part of the WAL protocol.
- **SQLite bug (fixed in 3.51.3):** Data race in WAL with concurrent writes from separate connections. Fixed in versions 3.51.3+ and 3.44.6+. The Python 3.13 bundled SQLite is 3.51+ and should include this fix.

## Blog/CMS Approach: MDX In-Repo (Recommended)

### Why MDX Over Headless CMS for THIS Project

| Factor | MDX in Repo | Headless CMS (Strapi/Sanity) |
|--------|-------------|------------------------------|
| Workflow | Write → commit → deploy | Write in admin UI → webhook → deploy |
| Friction for a solo dev | Low (editor + git) | Medium (CMS setup + webhook + API keys) |
| Version control | Native (git blame, history) | Limited (content API versions vary by CMS) |
| Content ↔ code coupling | Tight (components in MDX) | Loose (CMS blocks → API serialization) |
| Build time with 50 articles | < 2 seconds | Network fetch + build |
| Cost | $0 | Free tier limited or self-hosted infra |
| Non-technical editor support | Poor (needs git) | Excellent (admin panel) |

### Implementation

# apps/landing/src/content/blog/multi-agent-traffic-simulator.md

### When to Revisit This Decision

- Content volume exceeds 100 articles → consider headless CMS
- Non-technical co-author needs to publish → headless CMS
- Need multi-channel syndication (same content → web + newsletter + RSS + API) → headless CMS
- **None of these apply yet.** Start with MDX.

## Sources

- Docker Hub Traefik tags — `traefik:v3.7.5` current stable (June 2026). [Source](https://hub.docker.com/_/traefik/)
- GitHub Traefik releases — v3.7.5, v3.6.21 active. [Source](https://releasealert.dev/github/traefik/traefik)
- Traefik docs — v3.x release lifecycle: v3.6 active support, v3.7 latest. [Source](https://doc.traefik.io/traefik/deprecation/releases/)
- PyPI FastAPI — 0.136.1 current (Apr 2026). [Source](https://pypi.org/project/fastapi/)
- NPM Next.js — 16.2.10 current stable (Jul 2026). [Source](https://www.npmjs.com/package/next)
- NPM Astro — 7.0.4 current stable (Jun 30 2026). [Source](https://www.npmjs.com/package/astro)
- Astro 7 release — Vite 8, Rust compiler, Sätteri pipeline. [Source](https://github.com/withastro/astro/releases)
- SQLite WAL across Docker — Simon Willison research (Apr 2026). [Source](https://simonwillison.net/2026/Apr/7/sqlite-wal-docker-containers/)
- MDX vs headless CMS comparison. [Source](https://potapov.me/en/make/mdx-cms-alternative)
- Next.js vs Astro comparison (Vercel). [Source](https://vercel.com/i/astro-vs-next-js)
- Node.js end-of-life schedule. [Source](https://endoflife.date/nodejs)
- SQLite.org WAL mode documentation. [Source](https://sqlite.org/wal.html)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
