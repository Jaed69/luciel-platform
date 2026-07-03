# Phase 1: Infrastructure + Landing Scaffold - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

A reproducible infrastructure stack (Traefik v3.7 + Docker Compose + Cloudflare DNS + Let's Encrypt HTTP-01) running on an Oracle Cloud Ampere A1 aarch64 VPS, serving `https://luciel.dev` over a valid LE cert starting from a `.env`-secrets-only clean checkout. Includes a minimal Astro 7 + nginx `apps/landing/` app at the root, a GitHub Actions → GHCR deploy pipeline, and a basic-auth-secured Traefik dashboard at `traefik.luciel.dev`.

**In scope:**
- `docker-compose.yml` root, Traefik service with HTTP-01 ACME, network `traefik-public`
- `traefik/traefik.yml` static config + `acme.json` bind mount (gitignored)
- `apps/landing/` Astro 7 project scaffold with MDX/sitemap/RSS/Tailwind integrations installed (no content)
- Multi-stage Dockerfile (node:22-slim build → nginx:alpine server) for arm64
- Cloudflare DNS records: `@` A + `*.luciel.dev` A wildcard → VPS IPv4 (DNS-only / grey-cloud)
- Idempotent `scripts/bootstrap-host.sh` runbook (Docker install, ufw 22/80/443, fail2ban, swap)
- `scripts/verify-staging.sh` + `scripts/verify-prod.sh` for LE staging→prod cutover test
- `.github/workflows/release.yml` → arm64 images → GHCR
- `.env.example` with ACME_EMAIL, GHCR_PAT, TRAEFIK_DASHBOARD_USER, TRAEFIK_DASHBOARD_PASS_HASH, LE_STAGING
- Root `pnpm-workspace.yaml` including `apps/*`
- Always-on Traefik dashboard router with basic-auth middleware
- Traefik Docker socket mount `:ro` + `no-new-privileges`

**Out of scope (Phase 2+ work):**
- Blog content, real articles, home page intro/philosophy (Phase 2 / CONT-02, CONT-03)
- Legal pages: Privacy, Terms, Contact (Phase 3 / CONT-06, CONT-07, CONT-08)
- 404 page, navigation, sitemap.xml content, robots.txt (Phase 2 / Phase 3)
- First tool (`apps/rtk/`) — Phase 4
- `docs/adding-a-new-app.md` — Phase 4
- AdSense application or ads.txt — manual by user, Phase 3+ prep
- Model auto-switching config / caveman-active mode persistence — project-level concern outside Phase 1

</domain>

<decisions>
## Implementation Decisions

### Landing Framework
- **D-01:** Astro 7 chosen for `apps/landing/` — zero-JS static output, best AdSense/SEO baseline (locks framework for Phases 2–3). Confirmed against PROJECT.md open decision; aligns with STACK.md + research SUMMARY.md.
- **D-02:** Multi-stage Dockerfile: `node:22-slim` build stage → `nginx:alpine` prod stage serving `/dist`. Lightest prod image (~50MB), no Node runtime in prod. Matches STACK.md "static files + Traefik, minimal overhead."
- **D-03:** Scaffold ships Astro project + integrations installed now (MDX, sitemap, RSS, Tailwind 4 via `@tailwindcss/vite`, Content Collections configured but empty). No real content — Phase 2 starts from configured base, not `npm init`.
- **D-04:** Root `pnpm-workspace.yaml` including `apps/*` set up in Phase 1. `apps/landing` is a workspace package from day one. Phase 4 adds `apps/rtk` by dropping a folder.

### VPS + DNS
- **D-05:** VPS already provisioned: Oracle Cloud Ampere A1 aarch64, 4 OCPU / 24GB RAM / 4 Gbps, Ubuntu 24.04 minimal.
- **D-06:** All images must be arm64-native (`nginx:alpine`, `traefik:v3.7.5`, `node:22-slim` all support arm64). No x86 fallback, no cross-arch buildx in Phase 1.
- **D-07:** Cloudflare for DNS, **DNS-only mode (grey-cloud proxy OFF)** for `@` and `*.luciel.dev` — required so HTTP-01 challenge reaches Traefik directly; Cloudflare proxy would break HTTP-01.
- **D-08:** DNS records: `@` A → VPS public IPv4 ; `*` A wildcard → same VPS IPv4. All future subdomains (rtk, graph, hackathons) resolve via wildcard — zero DNS edits per phase. Satisfies Phase 1 success criterion #3.
- **D-09:** Phase 1 plan includes idempotent `scripts/bootstrap-host.sh` (apt-get docker + docker compose plugin, ufw allow 22/80/443 + default deny incoming, fail2ban for SSH, swap check, timezone). Safe to run on a prepped host. Required for reproducible-from-clean-VPS success criterion #4.
- **D-10:** Deploy via GitHub Actions → GHCR → VPS pull. CI builds arm64 images, pushes to `ghcr.io/<user>/luciel-platform-landing:latest`. VPS pre-authenticated via `GHCR_PAT` in `.env`. `docker-compose.yml` uses `image:` not `build:`. Success criterion #4 still satisfied (clean checkout + `docker compose up -d` pulls published images).
- **D-11:** Traefik image `traefik:v3.7.5` pulled directly from Docker Hub (single VPS IP; well under the 100-pull/6h anonymous rate limit once `docker compose pull` happens daily). Not mirrored to GHCR.

### Let's Encrypt Staging vs Prod
- **D-12:** Start Traefik with `acme.caServer=https://acme-staging-v02.api.letsencrypt.org/directory` (LE staging). Iterate on labels/routing without burning prod quota. Once `curl -I https://luciel.dev` shows the right SANs + staging-issued 200, flip via `.env` (`LE_STAGING=0` or unset) and `docker compose up -d` to restart Traefik → re-issues prod cert on next request.
- **D-13:** Bind-mount `./traefik/letsencrypt/acme.json` (path gitignored, `chmod 600` enforced). Matches STACK.md pattern. Single-file backup target.
- **D-14:** Single cert resolver named `le`, per-Host rules. Each router adds `traefik.http.routers.<name>.tls.domains[0].main=<host>`. New subdomain = new router = Traefik auto-requests new cert. Matches STACK.md locked pattern (HTTP-01, per-subdomain certs, no wildcard cert).
- **D-15:** Cutover verified by `scripts/verify-staging.sh` (openssl s_client → grep STAGING issuer → exit 0 on match) and `scripts/verify-prod.sh` (grep LE R3/R10 prod issuer). Repeatable, runnable from CI later in Phase 3.
- **D-16:** `ACME_EMAIL` in `.env` (gitignored), placeholder in `.env.example`. Empty default → Traefik fails loudly if unset. Never hardcoded in `traefik.yml`.

### Traefik Dashboard + Docker Socket
- **D-17:** Dashboard exposed at `traefik.luciel.dev` via same Docker-labels mechanism (api@internal router), HTTPS via wildcard, secured by Traefik basic-auth middleware. `TRAEFIK_DASHBOARD_USER` + `TRAEFIK_DASHBOARD_PASS_HASH` (htpasswd bcrypt) in `.env`. Doubles as a working demo of "add a subdomain via labels."
- **D-18:** Dashboard router **always on** across restarts. Useful debugging surface for Phases 2–4 ("is my new router showing up?"). Basic-auth + HTTPS keeps it private.
- **D-19:** Docker socket mount `:ro` + Traefik runs as non-root (uid 65532, image default) + `security_opt: no-new-privileges:true`. Traefik needs only READ access to Docker API for label discovery — `:ro` enforces it. One-character config diff, real security gain.
- **D-20:** `.gitignore` covers `.env`, `traefik/letsencrypt/`, `traefik/acme.json` (anywhere under `traefik/`). `traefik/traefik.yml` and `docker-compose.yml` are versioned (static config, not secrets). `.env.example` tracks: `ACME_EMAIL`, `GHCR_PAT`, `TRAEFIK_DASHBOARD_USER`, `TRAEFIK_DASHBOARD_PASS_HASH`, `LE_STAGING`.

### the agent's Discretion
- Exact nginx config (gzip, brotli, caching headers) — researcher/planner may pick minimal sane defaults; defer tuning to a later SEO pass.
- Traefik access-log format and destination (stdout vs file on volume) — agent picks; default stdout + Traefik's CLF is fine for Phase 1.
- `bootstrap-host.sh` ordering of ufw vs docker install — agent picks as long as `docker compose up -d` works at the end.
- GHCR image tag scheme: `:latest`, `:sha-<short>`, or `:v<semver>` — agent picks; default `:sha-<short>` + `:latest` rolling tag for Phase 1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Core Value, Constraints (Tech stack table non-negotiable), Out of Scope (PostgreSQL/K8s/Streamlit/`packages/ui`-shared-early), and Key Decisions table.
- `.planning/REQUIREMENTS.md` — v1 requirements INFR-01…06 + CONT-01 mapped to Phase 1. Traceability table confirms scope.
- `.planning/ROADMAP.md` §Phase 1 — Goal, Mode=mvp, depends-on=Nothing, Open decision (landing framework — now resolved by D-01: Astro 7), Success Criteria #1–5.
- `.planning/STATE.md` — Identified research gaps (DNS specifics, backup strategy, CI/CD) — D-07, D-08, D-09, D-10 resolve the first and third; backup strategy deferred to Phase 4.

### Research
- `.planning/research/SUMMARY.md` §Recommended Stack + §Architecture Approach — informs Astro+nginx, Traefik labels, multi-stage Docker, SQLite-WAL-on-named-volumes (later phases).
- `.planning/research/STACK.md` (also embedded in `AGENTS.md` as GSD:stack) — Traefik v3.7.x, HTTP-01 challenge patterns, FastAPI project structure (later), SQLite + WAL in Docker operational concerns, blog/CMS MDX-in-repo decision, Alternatives Considered table, What NOT to Use list.
- `.planning/research/ARCHITECTURE.md` — Star topology, per-app isolation, `traefik-public` shared network.
- `.planning/research/PITFALLS.md` — Pitfall #1 (Next.js for landing instead of Astro) — directly supports D-01; Pitfall #2 (adheres to phase order) — D-21 below maintains it.

### Brief
- `luciel-platform-brief.md` (repo root) — original source of truth on philosophy ("no demos vacíos", real content, reproducible infra).

### Design
- `DESIGN.md` (repo root) — referenced from AGENTS.md; researcher/planner should skim for any UI/design tokens that the Astro scaffold should hook into (Tailwind 4 config, color tokens). Note: full content/design work is Phase 2, only structural hooks (tokens file presence) matter in Phase 1.

### No external ADRs
No standalone ADRs in repo. Project-level decisions live in `.planning/PROJECT.md` Key Decisions table.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None. Empty scaffold repository (only `AGENTS.md`, `DESIGN.md`, `luciel-platform-brief.md`, `.planning/`, `.git/` at session start). Phase 1 introduces the first committed code.

### Established Patterns
- GSD-planning artifacts in `.planning/` (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, research/) — the agent follows the documented Tech Stack table as non-negotiable.
- AGENTS.md embeds STACK.md content (version pins, Traefik config patterns, FastAPI minimal structure, SQLite WAL operational notes) — treat as the canonical stack reference.

### Integration Points
- `.planning/ROADMAP.md` Phase 1 → Phase 4 dependency: the Traefik labels pattern + `docker-compose.yml` root + `apps/landing/` folder shape established here becomes the template every future tool subdomain copies. Researcher/planner should design `apps/landing/` layout + Dockerfile + labels so a future `apps/rtk/` mirrors it (per DOCS-01 in Phase 4).
- GitHub Actions workflow + GHCR image-naming convention established here will be reused for every future app image. Pick a tag scheme that scales to multiple apps in one workflow (matrix or per-app workflow files — researcher's call).
- `pnpm-workspace.yaml` `apps/*` glob means Phase 4 `apps/rtk/` is automatically a workspace member. Phase 1 must NOT hardcode `apps/landing` paths in scripts that break for other apps.

</code_context>

<specifics>
## Specific Ideas

- Wildcard DNS is the long-tail lever: "add a new subdomain without touching DNS" is a recurring theme in the brief and research. Phase 1 is the last time DNS is touched — capture the exact Cloudflare panel steps in `scripts/bootstrap-host.sh` docstring or a `docs/dns-setup.md` stub (the latter can belong in Phase 4's `docs/adding-a-new-app.md` if `docs/` folder creation is deferred — researcher's call).
- "Build on the VPS" was explicitly rejected in favor of GHCR pipeline. Researcher should still confirm that the Oracle A1's 4 OCPU / 24 GB is not needed for build workload (it isn't — images are pulled pre-built), and that GHCR free tier covers the image storage for arm64 multi-arch (single-arch arm64 only is fine).
- The "model auto-switching" feature (/models per task) and caveman-active mode are project workspace config concerns the user raised — NOT Phase 1 build scope. If the user wants these reflected in PROJECT.md or a workspace config file, that's a separate `/gsd-quick` task outside this discussion.

</specifics>

<deferred>
## Deferred Ideas

### Project-level config (raised during Area 2 wrap-up)
- **Model auto-switching (`/models` per task) + caveman-mode persistence** — user wants this indicated at the project/workspace level so the working session switches models adaptively and caveman stays active. Not a Phase 1 implementation decision. Belongs in a future `/gsd-quick` to update `PROJECT.md` (Key Decisions or a new "Workspace Settings" section) or a workspace config file (`.opencode/`, `opencode.json`, or `.claude/`). Action when ready: `/gsd-quick "document workspace model auto-switch + caveman-active in project config"`.

### Belonging to later phases (not deferred from this discussion, just reaffirmed)
- Blog content (5–8 articles) — Phase 2 (CONT-03)
- Home page intro/philosophy — Phase 2 (CONT-02)
- Legal pages (Privacy/Terms/Contact) — Phase 3 (CONT-06, CONT-07, CONT-08)
- 404, sitemap.xml content, robots.txt, ads.txt, GSC verification — Phase 3
- `apps/rtk/` first tool + `docs/adding-a-new-app.md` — Phase 4
- SQLite backup strategy details — Phase 4 (per STATE.md blocker)

### Reviewed Todos (not folded)
None. `todo.match-phase 1` returned zero matches.

</deferred>

---

*Phase: 1-Infrastructure + Landing Scaffold*
*Context gathered: 2026-07-02*