---
phase: 01-infrastructure-landing-scaffold
plan: 1
subsystem: infra
tags: [traefik, docker-compose, astro, nginx, letsenrypt, pnpm, tailwind]

# Dependency graph
requires:
  - phase: none
    provides: first phase (clean scaffold repo)
provides:
  - pnpm monorepo workspace (apps/*) — Phase 4 drops apps/rtk with zero config
  - Astro 7 static landing app at apps/landing (zero-JS, AdSense baseline)
  - Traefik v3.7.5 reverse proxy with HTTP-01 ACME, HTTP->HTTPS redirect, docker label discovery
  - docker-compose.yml root orchestration (traefik + landing services, traefik-public network)
  - Multi-stage Dockerfile pattern (node:22-slim build -> nginx:alpine runtime)
  - DESIGN.md token hook (tokens.css @theme — 24 colors, 12 type roles, 8 spacing, 7 radii)
  - bootstrap-host.sh idempotent VPS prep (Docker, ufw, fail2ban, acme.json chmod 600)
  - LE staging->prod cutover verify scripts (openssl s_client issuer check)
  - .env.example (7 vars) + .gitignore (secrets + certs + build artifacts)
affects: [02-content-hub, 03-legal-adsense, 04-tool-pilot-rtk]

# Tech tracking
tech-stack:
  added: [astro@^7.0.6, @astrojs/mdx@^7.0.2, @astrojs/sitemap@^3.7.3, @astrojs/rss@^4.0.19, tailwindcss@^4.3.2, @tailwindcss/vite@^4.3.2, pnpm@11.9.0, traefik:v3.7.5, node:22-slim, nginx:alpine]
  patterns: [pnpm workspace apps/*, Astro static zero-JS output, multi-stage Dockerfile build->nginx, Traefik CLI-arg ACME config (not YAML), docker label routing, bind-mounted acme.json chmod 600, LE staging-first cutover]

key-files:
  created:
    - pnpm-workspace.yaml
    - package.json
    - pnpm-lock.yaml
    - apps/landing/package.json
    - apps/landing/astro.config.mjs
    - apps/landing/tsconfig.json
    - apps/landing/src/pages/index.astro
    - apps/landing/src/layouts/Layout.astro
    - apps/landing/src/styles/tokens.css
    - apps/landing/src/content/blog/.gitkeep
    - apps/landing/Dockerfile
    - apps/landing/nginx/nginx.conf
    - apps/landing/.dockerignore
    - traefik/traefik.yml
    - docker-compose.yml
    - .env.example
    - .gitignore
    - scripts/bootstrap-host.sh
    - scripts/verify-staging.sh
    - scripts/verify-prod.sh
  modified: []

key-decisions:
  - "Tailwind v4 via @tailwindcss/vite registered in vite.plugins (not Astro integrations array) — @tailwindcss/vite is a Vite plugin, not an Astro integration. RESEARCH Pattern 8 misplaced it."
  - "pnpm v11.9 reads onlyBuiltDependencies + minimumReleaseAge from pnpm-workspace.yaml (not package.json pnpm field, which v11 ignores). esbuild allowlisted; minimumReleaseAge=0 because Astro 7.0.6 + integrations published 2026-07-02 (verified legitimate in 01-RESEARCH.md)."
  - "Dockerfile build context = repo root (not apps/landing) because pnpm workspace needs the root lockfile. COPY paths are root-relative. Plan 01-02 CI must set context: . + file: apps/landing/Dockerfile."
  - "Omitted the named traefik-certs volume from docker-compose.yml — D-13 locks bind-mount for acme.json; the named volume in RESEARCH Pattern 2 was unused/conflicting."
  - "Omitted redundant environment: block on traefik service — ACME email/caServer are interpolated by Compose into command args (the source of truth); Traefik does not read them from container env."

patterns-established:
  - "Pattern: add a subdomain = drop apps/<name>/ folder + add compose service with traefik labels. No DNS, no traefik.yml edits (wildcard DNS + per-Host routing)."
  - "Pattern: Traefik ACME config via CLI args in docker-compose.yml, NOT in traefik.yml — Traefik does not interpolate env vars in bind-mounted YAML."
  - "Pattern: pnpm workspace settings (onlyBuiltDependencies, minimumReleaseAge) live in pnpm-workspace.yaml under pnpm v11+."
  - "Pattern: DESIGN.md tokens captured once in tokens.css @theme; Phase 2 content consumes them — no per-page token redefinition."

requirements-completed: [INFR-01, INFR-02, INFR-03, INFR-05, INFR-06, CONT-01]

coverage:
  - id: D1
    description: "pnpm monorepo workspace + Astro 7 static landing scaffold (zero-JS, MDX/sitemap/RSS/Tailwind integrations, DESIGN.md token hook, UI-SPEC placeholder page)"
    requirement: CONT-01
    verification:
      - kind: other
        ref: "pnpm --filter @luciel/landing build -> dist/index.html (zero <script> tags, placeholder copy present)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Multi-stage Dockerfile (node:22-slim build -> nginx:alpine:8080) + nginx.conf serving Astro dist with gzip"
    requirement: INFR-02
    verification:
      - kind: other
        ref: "grep FROM/EXPOSE in apps/landing/Dockerfile (node:22-slim build, nginx:alpine runtime, EXPOSE 8080); nginx.conf listen 8080 + gzip"
        status: pass
    human_judgment: true
    rationale: "Dockerfile structure verified by inspection, but the image is not built in this plan — arm64 build executes in plan 01-02 CI. Runtime serving verified at deploy time."
  - id: D3
    description: "Traefik v3.7.5 static config (web/websecure, HTTP->HTTPS redirect, docker provider) + docker-compose orchestration (traefik + landing, ACME CLI args, dashboard basicAuth, socket :ro, non-root uid 65532, no-new-privileges)"
    requirement: INFR-01
    verification:
      - kind: other
        ref: "docker compose config (valid YAML); 4 certificatesresolvers CLI args; no-new-privileges present; GHCR image: not build:; network external"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ops scripts (bootstrap-host.sh idempotent VPS prep, verify-staging.sh + verify-prod.sh openssl issuer check) + .env.example (7 vars) + .gitignore (secrets/certs/artifacts)"
    requirement: INFR-05
    verification:
      - kind: other
        ref: "test -x on all 3 scripts; grep '^[A-Z]' .env.example = 7 (>=5); grep traefik/letsencrypt .gitignore; bootstrap has chmod 600 + chown 65532 + ufw 22/80/443 + fail2ban"
        status: pass
    human_judgment: true
    rationale: "Scripts are executable and structurally correct, but run on the VPS at deploy time — not executed against a live host or real LE cert in this plan. INFR-03 (DNS) and INFR-04 (live cert) require user Cloudflare action + VPS deploy (see 01-USER-SETUP.md)."

# Metrics
duration: 9min
completed: 2026-07-03
status: complete
---

# Phase 01 Plan 01: Monorepo + Astro Landing + Traefik Stack Summary

**Walking skeleton: pnpm monorepo + Astro 7 zero-JS landing + Traefik v3.7.5 ACME stack + bootstrap/verify ops scripts — `docker compose up -d` ready once GHCR image lands (plan 01-02).**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-03T06:38:10Z
- **Completed:** 2026-07-03T06:47:27Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- pnpm monorepo workspace (`apps/*`) with Astro 7 static landing — zero client JS, MDX/sitemap/RSS/Tailwind v4 integrations installed, DESIGN.md token hook landed (24 colors / 12 type roles / 8 spacing / 7 radii) for Phase 2 consumption.
- Astro build produces `dist/index.html` with the UI-SPEC placeholder (coral "Under construction" chip, "luciel.dev" display, "Nothing here yet" empty state, GitHub link) — zero `<script>` tags.
- Multi-stage Dockerfile (`node:22-slim` build → `nginx:alpine` runtime on :8080) with root-relative COPY paths for pnpm workspace lockfile.
- Traefik v3.7.5 static config: `web`/`websecure` entrypoints, permanent HTTP→HTTPS redirect, Docker provider (`exposedByDefault: false`, `traefik-public` network). ACME deliberately NOT in `traefik.yml` — passed via Compose CLI args (Traefik doesn't interpolate env in bind-mounted YAML).
- `docker-compose.yml`: traefik service (image `traefik:v3.7.5`, socket `:ro`, `no-new-privileges`, uid `65532`, dashboard router with basicAuth) + landing service (`image: ghcr.io/...` not `build:`, `Host(luciel.dev)` router, `certresolver=le`). `traefik-public` external network.
- `.env.example` with all 7 vars (ACME_EMAIL, LE_CA_SERVER, LE_STAGING, dashboard user/hash, GHCR_PAT, GITHUB_USER); `.gitignore` covers `.env`, `traefik/letsencrypt/`, `node_modules/`, `dist/`, `.astro/`.
- `bootstrap-host.sh` (idempotent): Docker official repo install, `traefik-public` network, ufw 22/80/443 + default deny, fail2ban, `acme.json` chmod 600 + chown 65532, GHCR auth, Cloudflare DNS docstring.
- `verify-staging.sh` + `verify-prod.sh`: `openssl s_client` → `x509 -issuer` → grep STAGING / Let's Encrypt R3/R10.

## Task Commits

Each task was committed atomically:

1. **Task 1: Monorepo scaffold + Astro 7 landing + Dockerfile** — `f141a2b` (feat)
2. **Task 2: Traefik config + docker-compose + secrets + bootstrap + verify scripts** — `8eb594a` (feat)

**Plan metadata:** `<pending final commit>` (docs: complete plan)

## Files Created/Modified

- `pnpm-workspace.yaml` — apps/* workspace + pnpm v11 settings (onlyBuiltDependencies, minimumReleaseAge)
- `package.json` / `pnpm-lock.yaml` — root workspace package + lockfile (447 entries)
- `apps/landing/package.json` — `@luciel/landing` workspace package (astro + integrations)
- `apps/landing/astro.config.mjs` — Astro 7 static, mdx/sitemap integrations, tailwindcss in vite.plugins
- `apps/landing/tsconfig.json` — extends astro/tsconfigs/strict
- `apps/landing/src/layouts/Layout.astro` — minimal HTML5 shell, imports tokens.css, zero JS
- `apps/landing/src/pages/index.astro` — UI-SPEC placeholder page (coral chip, display heading, empty state, GitHub link)
- `apps/landing/src/styles/tokens.css` — Tailwind v4 `@import "tailwindcss"` + `@theme` block (DESIGN.md tokens)
- `apps/landing/src/content/blog/.gitkeep` — Content Collections dir hook for Phase 2
- `apps/landing/Dockerfile` — multi-stage node:22-slim → nginx:alpine:8080, root context
- `apps/landing/nginx/nginx.conf` — listen 8080, gzip, try_files + 404 fallback
- `apps/landing/.dockerignore` — node_modules/dist/.env/.git/.planning/traefik/scripts
- `traefik/traefik.yml` — static config (no certificatesResolvers — ACME via CLI args)
- `docker-compose.yml` — traefik + landing services, traefik-public external network
- `.env.example` — 7 required variables
- `.gitignore` — secrets + certs + build artifacts
- `scripts/bootstrap-host.sh` — idempotent VPS prep (executable)
- `scripts/verify-staging.sh` — LE staging cert check (executable)
- `scripts/verify-prod.sh` — LE prod cert check (executable)

## Decisions Made

- **Tailwind v4 placement:** `@tailwindcss/vite` is a Vite plugin → registered in `vite.plugins`, NOT in Astro `integrations` array. RESEARCH Pattern 8 / plan action placed it in integrations, which caused a postcss ENOENT (postcss-import tried to resolve `tailwindcss` as a bare plugin path). Moved to vite.plugins → build passes.
- **pnpm v11 config home:** v11.9 ignores the `pnpm` field in `package.json` (warning: "no longer read"). Moved `onlyBuiltDependencies` + `minimumReleaseAge` to `pnpm-workspace.yaml`.
- **minimumReleaseAge override:** pnpm 11.9 default (1 day) blocked Astro 7.0.6 + 4 integrations published 2026-07-02. Set `minimumReleaseAge: 0` — all 5 packages verified legitimate in 01-RESEARCH.md Package Legitimacy table (first-party `github.com/withastro/astro`, [OK]/Approved).
- **esbuild build script:** v11 blocks postinstall scripts by default; esbuild allowlisted via `onlyBuiltDependencies` + `pnpm rebuild esbuild` to run its native-binary postinstall.
- **No named `traefik-certs` volume:** D-13 locks bind-mount for acme.json; RESEARCH Pattern 2's named volume was unused — omitted.
- **No `environment:` block on traefik service:** ACME email/caServer are interpolated by Compose into `command:` args (source of truth); Traefik reads them from CLI args, not container env. Removed redundant block.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm not installed + pnpm v11 supply-chain policy blocked Astro 7.0.6**
- **Found during:** Task 1 (pnpm install)
- **Issue:** Node 26 via mise has no corepack (dropped from Node 22+); pnpm absent. After `npm install -g pnpm@11`, v11.9's default `minimumReleaseAge` (1 day) rejected 5 freshly-published Astro packages (astro@7.0.6, @astrojs/mdx@7.0.2, @astrojs/markdown-remark@7.2.1, @astrojs/markdown-satteri@0.3.3, @astrojs/internal-helpers@0.10.1 — all published 2026-07-02). Build's deps-status-check ran `pnpm install` which failed the policy, blocking `astro build`.
- **Fix:** Installed pnpm 11.9.0 globally via npm (approved workspace manager per RESEARCH.md). Set `minimumReleaseAge: 0` in `pnpm-workspace.yaml` — all 5 packages are verified legitimate (first-party Astro, [OK] in RESEARCH Package Legitimacy table). Also allowlisted `esbuild` via `onlyBuiltDependencies` and ran `pnpm rebuild esbuild` to run its native-binary postinstall (first install skipped it).
- **Files modified:** `pnpm-workspace.yaml` (added `onlyBuiltDependencies: [esbuild]` + `minimumReleaseAge: 0`)
- **Verification:** `pnpm install` exits 0; `pnpm --filter @luciel/landing build` succeeds → `dist/index.html`
- **Committed in:** `f141a2b` (Task 1 commit)

**2. [Rule 1 - Bug] @tailwindcss/vite misplaced in Astro integrations array**
- **Found during:** Task 1 (astro build verification)
- **Issue:** Plan action + RESEARCH Pattern 8 registered `tailwindcss()` in the Astro `integrations:` array. `@tailwindcss/vite` exports a Vite plugin, not an Astro integration — it didn't activate, so postcss-import tried to resolve `tailwindcss` as a bare postcss plugin path → `ENOENT .../apps/landing/tailwindcss`. Build failed in 60ms.
- **Fix:** Moved `tailwindcss()` from `integrations:` to `vite: { plugins: [tailwindcss()] }`. mdx/sitemap remain in `integrations:`.
- **Files modified:** `apps/landing/astro.config.mjs`
- **Verification:** `astro build` succeeds in 141ms, `dist/index.html` generated with zero `<script>` tags and Tailwind classes resolved (coral chip, display heading render correctly).
- **Committed in:** `f141a2b` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking build-config, 1 bug)
**Impact on plan:** Both fixes necessary for the build to produce output. No scope creep — both are correctness fixes directly caused by the locked Astro 7 / pnpm v11 toolchain behaving as designed. The minimumReleaseAge override is safe (packages verified legitimate) and the Tailwind v4 placement matches official `@tailwindcss/vite` usage.

## Issues Encountered

- pnpm v11.9 auto-appended an `allowBuilds: esbuild: set this to true or false` placeholder block to `pnpm-workspace.yaml` after `pnpm rebuild`. Removed it — `onlyBuiltDependencies: [esbuild]` already covers the allowlist and the build passes without it.

## User Setup Required

**External services require manual configuration before the stack goes live.** See [01-USER-SETUP.md](./01-USER-SETUP.md) for:
- `.env` variables to fill (ACME_EMAIL, dashboard hash, GITHUB_USER, optional GHCR_PAT)
- Cloudflare DNS records (`@` + `*` A → VPS IPv4, grey-cloud) — REQUIRED for LE HTTP-01
- GHCR package visibility (public recommended)
- Verification commands (`scripts/verify-staging.sh`, `scripts/verify-prod.sh`, `curl -I https://luciel.dev`)

INFR-03 (DNS) and INFR-04 (live LE cert) are NOT validated by this plan — they require the user's Cloudflare action + a live VPS deploy. The plan delivered the reproducible path (bootstrap docstring + USER-SETUP + verify scripts); execution is user-tracked.

## Next Phase Readiness

- **Ready for plan 01-02** (GitHub Actions arm64 CI/CD → GHCR pipeline). The Dockerfile + docker-compose.yml + `.env.example` (GITHUB_USER, GHCR_PAT) are in place. Plan 01-02 must set `context: .` (repo root) + `file: apps/landing/Dockerfile` in the build-push-action (per the Dockerfile's root-context note) and tag `ghcr.io/${GITHUB_USER}/luciel-platform-landing` with `:sha-<short>` + `:latest`.
- **Deploy gate:** After 01-02 ships the image, the user runs `bootstrap-host.sh` + `docker compose up -d` on the VPS (with Cloudflare DNS + `.env` done per USER-SETUP) to validate Phase 1 success criteria #1–5.
- **No blockers** for plan 01-02.

## Self-Check: PASSED

- All 18 created files exist on disk (`[ -f ]` verified): pnpm-workspace.yaml, package.json, pnpm-lock.yaml, apps/landing/{package.json, astro.config.mjs, tsconfig.json, src/pages/index.astro, src/layouts/Layout.astro, src/styles/tokens.css, src/content/blog/.gitkeep, Dockerfile, nginx/nginx.conf, .dockerignore}, traefik/traefik.yml, docker-compose.yml, .env.example, .gitignore, scripts/{bootstrap-host.sh, verify-staging.sh, verify-prod.sh}, SUMMARY.md, USER-SETUP.md
- Task commits exist in `git log`: `f141a2b` (Task 1), `8eb594a` (Task 2)
- Plan-level verification re-run: `docker compose config` valid, 4 ACME CLI args, no-new-privileges present, GHCR `image:` (not `build:`), scripts executable, `.env.example` 7 vars, `.gitignore` covers certs, traefik.yml has no certificatesResolvers, `astro build` → dist/index.html with zero `<script>` tags.

---
*Phase: 01-infrastructure-landing-scaffold*
*Completed: 2026-07-03*
