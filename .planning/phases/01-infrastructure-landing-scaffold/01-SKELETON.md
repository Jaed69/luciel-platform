# Walking Skeleton — luciel-platform

**Phase:** 1
**Generated:** 2026-07-03

## Capability Proven End-to-End

> A visitor can load `https://luciel.dev` and receive HTTP 200 served by an Astro 7 static page behind Traefik v3.7.5 with a valid Let's Encrypt certificate, all reproducible from `docker compose up -d` on a clean VPS checkout.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Astro 7 (static output) | Zero-JS = best AdSense/SEO baseline. Root domain is content, not interactive app. (D-01) |
| Static file server | nginx:alpine | ~15MB image, battle-tested gzip, Astro official recipe. (D-02) |
| Reverse proxy | Traefik v3.7.5 | Auto-discovery via Docker labels, built-in ACME, HTTP-01 challenge. No config edits to add subdomains. (D-01, INFR-01) |
| Orchestration | Docker Compose v2.32+ | Single VPS, no K8s needed. Root `docker-compose.yml` for entire monorepo. |
| CI/CD | GitHub Actions → GHCR → VPS pull | arm64 images built in CI (QEMU), VPS only pulls. No build workload on VPS. (D-10) |
| DNS | Cloudflare grey-cloud (DNS-only) | `@` A + `*` A wildcard → VPS IPv4. Required for HTTP-01 passthrough. (D-07, D-08) |
| TLS | Let's Encrypt via Traefik ACME | HTTP-01 challenge, per-subdomain certs, auto-renewal. Staging-first cutover. (D-12, D-14) |
| Deployment target | Oracle Cloud Ampere A1 aarch64 | 4 OCPU / 24GB RAM, Ubuntu 24.04. arm64-native images only. (D-05, D-06) |
| Directory layout | `apps/<name>/` per subdomain, `traefik/` for proxy, `scripts/` for ops | Each app is isolated. Traefik labels wire routing. Adding a tool = drop folder + add compose service. |
| Monorepo | pnpm workspace (`apps/*`) | Disk-efficient. Phase 4 adds `apps/rtk` by dropping a folder — zero config changes. (D-04) |
| Dashboard | Traefik built-in at `traefik.luciel.dev` | basicAuth + HTTPS. Always-on debugging surface. (D-17, D-18) |
| Security | Docker socket `:ro`, non-root (uid 65532), `no-new-privileges` | Minimal attack surface. Dashboard behind auth. (D-19) |

## Stack Touched in Phase 1

- [x] Project scaffold (pnpm workspace, Astro 7 with MDX/sitemap/RSS/Tailwind 4 integrations, build via Docker)
- [x] Routing — placeholder page at `/` (index.astro)
- [x] Database — N/A (static site, no DB in Phase 1)
- [x] Deployment — `docker compose up -d` starts Traefik + landing; bootstrap-host.sh preps VPS
- [x] CI/CD — GitHub Actions builds arm64 image → GHCR; VPS pulls published image
- [x] TLS — Let's Encrypt HTTP-01 via Traefik ACME; staging→prod cutover scripts
- [x] Verification — verify-staging.sh + verify-prod.sh for cert validation

## Out of Scope (Deferred to Later Slices)

- Blog content (5-8 real articles) — Phase 2
- Home page intro / philosophy / tool directory — Phase 2
- Header + footer navigation — Phase 2
- Custom 404 page — Phase 2
- Legal pages (Privacy, Terms, Contact) — Phase 3
- SEO (sitemap.xml content, robots.txt, OG tags, structured data) — Phase 2/3
- AdSense application — manual by user, Phase 3+
- First tool (`apps/rtk/`) — Phase 4
- `docs/adding-a-new-app.md` — Phase 4
- SQLite / FastAPI backend — Phase 4 (first tool that needs it)
- `packages/ui` shared components — v2

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2:** Content Hub — Home page with intro/philosophy/tool directory, blog with 5-8 MDX articles, Projects page, navigation, RSS feed, OG tags, custom 404. All at `luciel.dev` (same Astro app, same Traefik route).
- **Phase 3:** Legal + AdSense Readiness — Privacy/Terms/Contact pages, sitemap.xml content, robots.txt, ads.txt, GSC verification, per-article SEO. Still `luciel.dev`.
- **Phase 4:** First Tool Pilot — `apps/rtk/` (Next.js 16 + optional FastAPI) at `rtk.luciel.dev` with its own Let's Encrypt cert. `docs/adding-a-new-app.md` documents the pattern.
