# Project Research Summary

**Project:** luciel-platform
**Domain:** Self-hosted monorepo platform — content hub (luciel.dev) + subdomain-per-tool (rtk.luciel.dev, graph.luciel.dev, etc.) with Traefik reverse proxy and AdSense monetization
**Researched:** 2026-07-02
**Confidence:** HIGH

## Executive Summary

This is a solo-developer self-hosted platform with two distinct halves: a **content hub** (blog + portfolio on the root domain) and **interactive tools** (each on its own subdomain). The content hub drives SEO and AdSense revenue; the tools demonstrate technical capability and provide the interactive surface that keeps users engaged. Research consensus is clear: build the content foundation before the tools, use Astro for the landing (static, SEO-optimized), Next.js for tool UIs, and Docker Compose + Traefik for a unified but decoupled infrastructure.

The recommended approach is a phased build: infrastructure first (Traefik + Docker), then content (Astro landing with blog), then legal/AdSense prep, then the first tool end-to-end. Each phase produces a live, working result. The biggest strategic risk is building tools before content — AdSense requires substantial original text on the root domain, and the landing must be complete before monetization can start. The second-biggest risk is SQLite data loss from Docker volumes. Phase order must be enforced, and backups must be automated from the first tool that touches a database.

The key architectural insight driving roadmap structure: **independence.** Each subdomain app has its own Dockerfile, own database (SQLite WAL on named volume), and own dependencies. They share only the Traefik network. This means phases are naturally stackable — you can add a new tool without touching anything else. But it also means Phase 3 (first tool) must do the hard work of establishing the reusable pattern that all future tools follow.

## Key Findings

### Recommended Stack

Two-framework strategy: Astro 7 for the landing (static output, zero-JS baseline, best AdSense/SEO), Next.js 16 for tool subdomains (interactive React UIs where needed). FastAPI backs tools that need server-side compute. SQLite WAL on named Docker volumes for persistence — no Postgres until proven write contention. Traefik v3.7 handles all routing and Let's Encrypt SSL automatically via Docker labels.

**Core technologies:**
- **Traefik v3.7.x**: Reverse proxy + Let's Encrypt HTTP-01 per subdomain. Auto-discovers new apps via Docker labels. No config file edits needed to add a subdomain.
- **Docker Compose v2.32+**: Single root `docker-compose.yml` orchestrates all apps. No K8s complexity justified at this scale.
- **Astro 7.0.x**: Landing/content hub. Zero JS output by default = best for AdSense. Content Collections + MDX for blog. Rust-based Sätteri pipeline for fast builds.
- **Next.js 16.2.x**: Tool subdomain frontends. App Router, React Server Components, Turbopack. Required where client-side interactivity is needed.
- **FastAPI 0.136.x**: Async Python backend for tools that need server-side compute. Pydantic models, auto OpenAPI docs.
- **SQLite 3.51+ (WAL)**: Primary database. No separate DB server. Named Docker volumes. WAL mode for concurrent reads. Migrate to Postgres only on evidence of write contention.
- **Node.js 22.x LTS**: Runtime for Astro/Next.js builds and dev. Active LTS.

**Key version constraints:**
- Astro 7 requires Node 22+. Next.js 16 requires Node 20+ (recommend 22).
- Traefik v3.7 requires Docker API ≥ 1.44 (Docker Engine 24+).
- Python 3.13 slim is the ideal Docker base for FastAPI services.
- Tailwind v4 is a CSS-first rewrite — use `@tailwindcss/vite` plugin, not `tailwind.config.js`.

### Expected Features

**Must have (table stakes):**
- HTTPS with valid SSL certs per subdomain — Traefik + Let's Encrypt handles this
- Responsive design — Tailwind 4 + framework defaults
- Core Web Vitals — Astro's zero-JS output gives excellent baseline
- Privacy Policy + Terms of Service — required by law and AdSense
- Contact page — trust signal
- Sitemap.xml + RSS feed — SEO and RSS reader requirements
- Social meta tags (Open Graph) — link previews
- Blog with searchable content, syntax highlighting — core of content strategy
- Tool context/content page — each subdomain needs text around tools for indexing
- Clear navigation — header nav + tool directory page
- 404 page — professionalism

**Should have (competitive):**
- Tool directory page showing all tools with descriptions and status
- Per-tool "how it works" content for AdSense compliance
- Code snippets with syntax highlighting (Shiki/bright in MDX)
- "Built with" tech badges on tools
- SEO-optimized tool content (unique meta description per subdomain)
- Tool-specific Open Graph images
- Quick deploy pattern for new tools (< 1 day add a subdomain)

**Defer (v2+):**
- Additional tools beyond the first one (validate pattern first)
- Complex tools with external API dependencies (hackathon radar needing Tavily/SerpApi)
- Comments section
- Headless CMS (MDX in-repo is correct for < 100 articles)
- User authentication/login system (not in project scope)
- Analytics beyond AdSense built-in reports

### Architecture Approach

The platform uses a **star topology** where Traefik sits at the center routing traffic from the internet to independent subdomain apps over a shared Docker network (`traefik-public`). Each app is completely self-contained — its own Dockerfile, its own dependencies, its own SQLite database on a named volume. No shared state, no shared API, no shared database across apps. This means one broken app cannot affect others, each can be deployed independently, and there's no cross-contamination of data.

**Major components:**
1. **Traefik** — Reverse proxy, SSL termination, Docker auto-discovery via labels. Single entry point for all subdomains.
2. **Astro Landing** — Static site generator for luciel.dev. MDX Content Collections for blog. Zero-JS output served as static files (directly by Traefik or via nginx).
3. **Next.js Tool Frontends** — Interactive React UIs per subdomain. Server Components, each communicates only with its own FastAPI backend over internal Docker network.
4. **FastAPI Backends** — Per-tool async Python API. Flat structure (main.py until > 5 endpoints, then routers/). No service/repository abstraction layer until copy-pasted 3+ times.
5. **SQLite WAL (per tool)** — Each tool gets its own database on a named Docker volume. WAL mode with busy_timeout for concurrent reads.

**Key patterns:**
- Monorepo (`apps/`) with independent Dockerfiles per app
- Traefik labels as the sole routing mechanism — no config file edits to add a subdomain
- Multi-stage Docker builds (build stage → production stage, no dev deps in prod images)
- SQLite backup via `.backup()` API before any tool data goes live
- MDX Content Collections for type-safe blog frontmatter

**Scalability ceiling:** ~5K daily visitors on a $10-20/month VPS (2 vCPU, 4 GB RAM). SQLite is the first bottleneck, but for a personal platform with < 100 daily active tool users, this will never be reached.

### Critical Pitfalls

1. **Next.js for the landing instead of Astro** — Every page ships React runtime + hydration JSON, even for pure text. Google crawlers see heavier DOM. AdSense has rejected JS-heavy sites. **Prevention:** Use Astro 7 for the landing. Zero-JS output by default. Embed React islands only where needed (contact form).

2. **Building tools before content** — The fun technical work gets done first, AdSense review finds insufficient content on the root domain, and the developer scrambles to write articles. **Prevention:** Enforce phase order. Root domain content (5-8 articles + legal pages) must be live and complete before building the first tool.

3. **SQLite in production without backup strategy** — Docker volume gets corrupted or VPS dies, data is gone. SQLite is "just a file" and easy to forget. **Prevention:** Automate `.backup()` API from Day 1 of the first tool with a database. Backup to a separate volume or external storage.

4. **AdSense applied too early** — 2 blog posts and a placeholder page get rejected. Domain is now flagged, re-application harder. **Prevention:** Wait for 5-8 substantial original articles, complete legal pages, no broken links, clear navigation, site live for 1-2 weeks.

5. **Over-scoping the first tool** — First tool (rtk) tries to do complex UI, multiple API routes, external integrations. Takes months instead of days. **Prevention:** First tool must be pure computation with no external API dependencies. Get it working end-to-end first, then add features.

## Implications for Roadmap

Based on combined research, the following phase structure produces viable, working results at each step with minimal rework risk. Each phase is designed so the output is live on the internet — no "big bang" deployment.

### Phase 1: Infrastructure Foundation (Traefik + Docker + DNS)
**Rationale:** Nothing works without this. Traefik must be running, SSL must work, Docker Compose must orchestrate before any app can be live. This is the dependency root of the entire DAG.
**Delivers:** `luciel.dev` returning a Traefik 404 page over HTTPS. DNS (A + wildcard) configured. Docker Compose root with `traefik-public` network. Let's Encrypt HTTP-01 working.
**Addresses:** Table stakes — HTTPS, responsive (nothing yet), fast page load (nothing yet)
**Uses:** Traefik v3.7, Docker Compose v2.32+, Let's Encrypt
**Avoids:** Pitfall — Traefik HTTP-01 rate limiting (only 1-2 subdomains initially). Docker socket security (non-root user, read-only mount, `no-new-privileges`).
**Research flag:** Standard patterns. Well-documented. Skip deep research.

### Phase 2: Astro Landing + Blog Content
**Rationale:** Content comes before tools because AdSense needs text, not tools. Astro is the correct framework for this (see Pitfall 1). This phase produces the SEO surface that future monetization depends on.
**Delivers:** Astro 7 landing at `luciel.dev` with home page, blog (5+ articles from existing projects), tool directory page (list of planned tools with "coming soon" status), about page. MDX content with syntax highlighting. RSS feed, sitemap, Open Graph tags. Tailwind 4 styling.
**Addresses:** Table stakes — sitemap, RSS, OG tags, blog, navigation, 404 page. Differentiators — code snippets, tech badges, tool directory.
**Uses:** Astro 7, Content Collections, MDX, Shiki/bright, `@astrojs/sitemap`, `@astrojs/rss`, Tailwind 4
**Avoids:** Pitfall — building tools before content (prevents wrong order). Next.js for landing (uses Astro instead). AdSense too early (content not yet sufficient, but foundation is laid).
**Architecture:** Astro Content Collections pattern for blog. Static build output served via Traefik (or nginx).
**Research flag:** Standard patterns. Astro Content Collections are well-documented. No deep research needed.

### Phase 3: Legal + AdSense Preparation
**Rationale:** AdSense requires Privacy Policy and Terms of Service. These are low-complexity but blocking for monetization. This phase can run in parallel with Phase 2 content writing.
**Delivers:** Privacy Policy page, Terms of Service page, Contact page. SEO audit (no broken links, all pages accessible). Site live for minimum 1-2 weeks for content indexing.
**Addresses:** Table stakes — Privacy Policy, Terms of Service, Contact page. Laws (GDPR/CCPA).
**Uses:** Termly/iubenda for policy generation. Astro static pages.
**Avoids:** Pitfall — AdSense applied too early (site must be live with content before submitting).
**Research flag:** Standard patterns. No deep research needed, but re-verify current AdSense policies before applying.

### Phase 4: First Tool Pattern (rtk.luciel.dev)
**Rationale:** This is the most important technical phase. It establishes the reusable subdomain pattern that all future tools will follow. The first tool MUST be simple (pure computation, no external API dependencies) to get through quickly and validate the architecture end-to-end.
**Delivers:** `rtk.luciel.dev` live with a working Next.js frontend + FastAPI backend + SQLite WAL. Token optimization tool (or similar pure computation). Tool context page explaining what problem it solves, how it works, tech choices. Docker Compose service with correct labels. Multi-stage Dockerfile. SQLite on named volume with WAL mode.
**Addresses:** Table stakes — tool context/content page. Differentiators — per-tool "how it works" content, SEO-optimized tool content, quick deploy pattern (this is the pattern).
**Uses:** Next.js 16, FastAPI 0.136, SQLite WAL, aiosqlite, uvicorn, pydantic, Tailwind 4
**Avoids:** Pitfall — over-scoping first tool (keep it simple). SQLite without backup (implement `.backup()` API from day one). Mixed Python deps (isolated Docker per tool).
**Architecture:** Monorepo app pattern (`apps/rtk/frontend/` + `apps/rtk/backend/`). Traefik labels for routing. FastAPI bare-minimum pattern. Multi-stage Docker build.
**Research flag:** **Needs deeper research during planning.** First tool specifics (rtk use case) need domain research on token optimization tools. FastAPI + Next.js integration pattern is well-known but the specific tool domain needs spike/research.

### Phase 5: Pattern Documentation + Tool Expansion
**Rationale:** After the first tool validates the pattern, document it before building more. Without documentation, each subsequent tool reinvents the pattern differently (Pitfall 3 from moderate pitfalls).
**Delivers:** `docs/adding-a-new-app.md` with the actual commands and files used. Second tool live (graph visualizer or similar). Template structure for new tools.
**Addresses:** Differentiators — quick deploy pattern (proven < 1 day), tool directory updated.
**Uses:** Same stack as Phase 4. Pattern repeated.
**Avoids:** Pitfall — not documenting the "new app" pattern (docs written immediately after first tool validation).
**Research flag:** Standard patterns. The pattern is already established in Phase 4.

### Phase 6: AdSense Application
**Rationale:** AdSense must wait until the site has sufficient content and has been live for 1-2 weeks. This is the monetization trigger. It can overlap with Phase 5.
**Delivers:** AdSense application submitted. Ad slots placed on blog pages and tool pages (non-intrusive). Revenue tracking.
**Addresses:** Table stakes — AdSense monetization (the ultimate goal of the content strategy).
**Avoids:** Pitfall — AdSense applied too early (site has 5-8 articles, legal pages, clean navigation, live for 2 weeks).
**Research flag:** **Needs research during planning.** AdSense policies change frequently. Must re-verify current policy requirements before application. Plan for potential rejection and appeal process.

### Phase Ordering Rationale

- **Infrastructure before content** — Traefik + DNS must work before any app can be live. Phase 1 is the absolute dependency root.
- **Content before tools** — AdSense needs text, needs the root domain to be complete. Building tools first is the #1 strategic risk.
- **Legal before monetization** — AdSense and legal compliance require policies in place. Low-effort but blocking.
- **First tool before documentation** — You can't document a pattern you haven't built. Phase 4 establishes the real pattern; Phase 5 captures it.
- **Pattern before expansion** — Without documentation, each new tool will diverge. Document first, then scale.
- **Monetization after content validation** — AdSense is the capstone, not the starting point. Site must be live, complete, and content-rich before applying.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (First Tool):** The specific tool domain (token optimization, RTK) needs spike/research on existing tools, algorithm choices, and how to structure the frontend UX. The Next.js+FastAPI integration pattern is standard, but the tool domain is not.
- **Phase 6 (AdSense):** AdSense policies change frequently. Must re-verify current requirements, slot placement rules, and rejection recovery process before planning this phase.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Infrastructure):** Traefik + Docker Compose + Let's Encrypt is extremely well-documented. The research in STACK.md provides concrete config.
- **Phase 2 (Landing):** Astro Content Collections + MDX blog is standard. Template scaffolding via `create-astro`.
- **Phase 3 (Legal):** Boilerplate policy pages. No deep research needed.
- **Phase 5 (Documentation + Expansion):** The pattern is already proven. Documentation is writing, not research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via official registries (npm, PyPI, Docker Hub). Traefik v3.7 current stable. Astro 7 confirmed with Sätteri pipeline, Vite 8. Next.js 16.2.10 confirmed. |
| Features | MEDIUM | Table stakes are well-understood from Web Dev standards. Differentiators derived from competitive analysis of similar self-hosted portfolio+tool sites. Anti-features validated against project brief. |
| Architecture | HIGH | Patterns are well-established: Traefik Docker auto-discovery, Astro Content Collections, FastAPI flat structure, SQLite WAL in Docker (Simon Willison research confirms). |
| Pitfalls | HIGH | Critical pitfalls validated against project brief guardrails and real-world AdSense rejection reports. SQLite backup risk from Simon Willison research. Docker security from Traefik docs. |

**Overall confidence:** HIGH

### Gaps to Address

- **First tool specifics (rtk):** The research assumes a "pure computation" tool but does not specify exactly what RTK does. The roadmap Phase 4 needs a spike on the actual tool domain before planning begins. This is the largest gap.
- **AdSense policy current state:** Policies change frequently. The research is a snapshot. Re-verify before Phase 6 planning. Specifically check: minimum content requirements, JS-heavy tool page policies, subdomain monetization rules.
- **DNS provider specifics:** Research assumes A + wildcard A record but doesn't specify provider or configuration steps. Needs resolution during Phase 1 planning.
- **Backup strategy details:** The research recommends automated SQLite backup but doesn't specify where (S3? rsync? separate volume?). Needs resolution during Phase 4 planning.
- **Deployment CI/CD:** Research doesn't address CI/CD. Is this manual `docker compose up -d` via SSH? Or GitHub Actions deploy? Needs a decision before Phase 4 (first tool deployment).

## Sources

### Primary (HIGH confidence)
- Docker Hub Traefik tags — `traefik:v3.7.5` current stable
- PyPI FastAPI — 0.136.1 current
- NPM Next.js — 16.2.10 current stable
- NPM Astro — 7.0.4 current stable
- Astro 7 release notes — Sätteri pipeline, Vite 8, Rust compiler
- SQLite WAL across Docker (Simon Willison, Apr 2026) — confirms WAL works correctly on same-host containers
- Traefik v3 docs — Docker provider, HTTP-01 ACME, security best practices

### Secondary (MEDIUM confidence)
- MDX vs headless CMS comparison (potapov.me) — validates MDX decision for solo blog
- Next.js vs Astro comparison (Vercel) — confirms Astro advantage for static content
- Node.js end-of-life schedule — confirms Node 22 correct choice
- Competitor analysis — self-hosted portfolio + tool sites
- Google AdSense Program Policies (current snapshot — re-verify)
- Let's Encrypt rate limits documentation

### Tertiary (LOW confidence)
- Tool domain specifics (rtk use case) — **not researched, needs spike/planning research**

---
*Research completed: 2026-07-02*
*Ready for roadmap: yes*
