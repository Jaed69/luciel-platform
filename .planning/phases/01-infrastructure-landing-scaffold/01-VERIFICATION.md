---
phase: 01-infrastructure-landing-scaffold
verified: 2026-07-03T02:05:00Z
status: human_needed
score: 18/23 must-haves verified
behavior_unverified: 5 # Live-site SCs — code wired, behavior not exercisable in-repo (deploy gate)
overrides_applied: 0
behavior_unverified_items:
  - truth: "curl -I https://luciel.dev returns HTTP 200 with a Let's Encrypt certificate (SC-1)"
    test: "On VPS after deploy: curl -I https://luciel.dev"
    expected: "HTTP/2 200 + LE cert (staging then prod), no browser warnings"
    why_human: "Needs live VPS + Cloudflare DNS + LE issuance. Code wired (landing Host(luciel.dev) + certresolver le) but behavior only exercisable at deploy time."
  - truth: "HTTP requests to luciel.dev redirect permanently to HTTPS (SC-2)"
    test: "On VPS: curl -I http://luciel.dev"
    expected: "301 -> https://luciel.dev"
    why_human: "traefik.yml has the redirect config (entryPoints.web.http.redirections to websecure, permanent:true) but live redirect needs running Traefik."
  - truth: "Wildcard DNS record means *.luciel.dev resolves to VPS (SC-3)"
    test: "dig +short test123.luciel.dev"
    expected: "VPS public IPv4"
    why_human: "Pure user Cloudflare action — no code to verify. bootstrap-host.sh docstring + 01-USER-SETUP.md document the @ + * A records (grey-cloud)."
  - truth: "Clean checkout + docker compose up -d starts stack using only .env.example (SC-4)"
    test: "On fresh VPS: git clone, cp .env.example .env, fill, bootstrap-host.sh, docker compose up -d"
    expected: "traefik + landing containers up, luciel.dev serves"
    why_human: "Needs VPS + first GHCR image (CI triggers on next apps/landing/** push to main). compose uses image: not build:; workflow wired to produce the image."
  - truth: "Traefik dashboard reachable at traefik.luciel.dev, shows luciel.dev router + cert resolver (SC-5)"
    test: "curl -u admin:<pass> https://traefik.luciel.dev/dashboard/"
    expected: "200 + dashboard JSON/HTML showing landing router with certresolver=le"
    why_human: "Needs running stack + dashboard basicAuth creds from .env. Dashboard router labels present (Host(traefik.luciel.dev), api@internal, basicAuth middleware)."
human_verification:
  - test: "Deploy gate — run 01-USER-SETUP.md end-to-end on the VPS"
    expected: "All 5 Phase-1 SCs green: curl -I https://luciel.dev → 200 + LE cert; curl -I http://luciel.dev → 301; dig wildcard → VPS IP; docker compose up -d from clean checkout; traefik dashboard reachable."
    why_human: "Live-site validation requires Cloudflare DNS, VPS, first GHCR image, and LE issuance. Explicitly out of scope for in-repo verification per phase critical_context. Documented in 01-USER-SETUP.md."
---

# Phase 01: Infrastructure + Landing Scaffold Verification Report

**Phase Goal:** A visitor can load `https://luciel.dev` over a valid Let's Encrypt certificate behind Traefik, with the stack reproducible from `docker compose up -d`.
**Verified:** 2026-07-03T02:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

In-repo structural truths (from PLAN must_haves) — all VERIFIED. Live-site roadmap SCs — present + wired, behavior not exercisable in-repo (deploy gate).

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | docker compose config returns valid YAML with traefik + landing services | ✓ VERIFIED | `docker compose config` → COMPOSE_VALID; services traefik + landing |
| 2 | Traefik static config has web (:80) + websecure (:443) entrypoints with HTTP→HTTPS redirect | ✓ VERIFIED | traefik/traefik.yml L9-19: web.redirections.entryPoint.to=websecure, scheme=https, permanent=true |
| 3 | ACME config via CLI args with env interpolation, NOT in traefik.yml | ✓ VERIFIED | 0 `certificatesResolvers` in traefik.yml; 4 ACME CLI args in compose command: email/storage/caServer/httpchallenge |
| 4 | docker-compose.yml uses image: not build: for landing | ✓ VERIFIED | 1 `ghcr.io` ref, 0 `build:` keys |
| 5 | Docker socket :ro, no-new-privileges:true, non-root user on Traefik | ✓ VERIFIED | `/var/run/docker.sock:/var/run/docker.sock:ro`; `no-new-privileges:true`; `user: "65532:65532"` |
| 6 | Dashboard router at traefik.luciel.dev with basicAuth middleware | ✓ VERIFIED | 5 dashboard label matches: Host(traefik.luciel.dev), api@internal, entrypoints=websecure, certresolver=le, middlewares=dashboard-auth, basicauth.users=${USER}:${HASH} |
| 7 | acme.json bind-mounted, path gitignored, bootstrap enforces chmod 600 | ✓ VERIFIED | `git check-ignore traefik/letsencrypt/acme.json` → ignored; bootstrap L38-42: mkdir + touch + chmod 600 + chown 65532 |
| 8 | Astro 7 project builds with zero-JS static output | ✓ VERIFIED | `pnpm --filter @luciel/landing build` exit 0 → dist/index.html; 0 `<script>` tags in dist/index.html |
| 9 | Multi-stage Dockerfile: node:22-slim build → nginx:alpine runtime | ✓ VERIFIED | apps/landing/Dockerfile L5 `FROM node:22-slim AS build`, L14 `FROM nginx:alpine AS runtime`, EXPOSE 8080 |
| 10 | bootstrap-host.sh: Docker official repo, traefik-public network, ufw 22/80/443 | ✓ VERIFIED | bootstrap L15-21 official docker repo (arm64), L24 `docker network create traefik-public`, L27-32 ufw 22/80/443 + default deny + enable |
| 11 | .env.example has all 7 vars (ACME_EMAIL, LE_CA_SERVER, LE_STAGING, TRAEFIK_DASHBOARD_USER, TRAEFIK_DASHBOARD_PASS_HASH, GHCR_PAT, GITHUB_USER) | ✓ VERIFIED | 7 lines starting uppercase; all 7 vars present |
| 12 | verify-staging.sh + verify-prod.sh check cert issuer via openssl s_client | ✓ VERIFIED | both scripts: `openssl s_client -connect luciel.dev:443 -servername luciel.dev \| openssl x509 -noout -issuer` → grep STAGING / Let's Encrypt\|R3\|R10 |
| 13 | Workflow triggers on push to main when apps/landing/** or workflow file changes | ✓ VERIFIED | release.yml L5-10: on.push.branches=[main], paths=['apps/landing/**', '.github/workflows/release.yml'] |
| 14 | Workflow builds arm64 Docker image using QEMU emulation | ✓ VERIFIED | `docker/setup-qemu-action@v3`; `platforms: linux/arm64` |
| 15 | Image pushed to ghcr.io with sha-<short> + latest tags | ✓ VERIFIED | metadata-action: `type=sha,prefix=sha-` + `type=raw,value=latest,enable={{is_default_branch}}` |
| 16 | Uses docker/setup-qemu-action + docker/setup-buildx-action | ✓ VERIFIED | both steps present (L28, L31) |
| 17 | GHCR login uses GITHUB_TOKEN (no separate PAT) | ✓ VERIFIED | login-action password: `secrets.GITHUB_TOKEN`; permissions: `packages: write` |
| 18 | BuildKit cache enabled (cache-from: type=gha) | ✓ VERIFIED | `cache-from: type=gha`, `cache-to: type=gha,mode=max` |
| 19 | SC-1: curl -I https://luciel.dev → 200 + LE cert | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code wired (landing Host(luciel.dev) + certresolver le); needs VPS deploy — see Human Verification |
| 20 | SC-2: HTTP→HTTPS permanent redirect | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | traefik.yml redirect config present; needs running Traefik |
| 21 | SC-3: Wildcard *.luciel.dev DNS resolves to VPS | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | No code path — pure user Cloudflare action; documented in bootstrap docstring + USER-SETUP |
| 22 | SC-4: Clean checkout + docker compose up -d works with only .env.example | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | compose uses image: (needs first GHCR image from CI); needs VPS |
| 23 | SC-5: Traefik dashboard reachable, shows luciel.dev router + cert resolver | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | dashboard router labels present; needs running stack + .env creds |

**Score:** 18/23 truths verified (5 present, behavior-unverified — deploy gate)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| pnpm-workspace.yaml | apps/* glob + pnpm v11 settings | ✓ VERIFIED | packages: ['apps/*'], onlyBuiltDependencies: [esbuild], minimumReleaseAge: 0 |
| package.json | root workspace, private, type module | ✓ VERIFIED | {private:true, name:luciel-platform, type:module, packageManager:pnpm@11.9.0} |
| apps/landing/package.json | @luciel/landing, astro^7 + mdx/sitemap/rss, tailwind v4 | ✓ VERIFIED | all 6 deps present |
| apps/landing/astro.config.mjs | static output, site luciel.dev, mdx/sitemap integrations, tailwind in vite.plugins | ✓ VERIFIED | site 'https://luciel.dev', output 'static', integrations [mdx(), sitemap()], vite.plugins [tailwindcss()] |
| apps/landing/tsconfig.json | extends astro/tsconfigs/strict | ✓ VERIFIED | extends astro/tsconfigs/strict |
| apps/landing/src/pages/index.astro | UI-SPEC placeholder, zero client JS | ✓ VERIFIED | coral chip, luciel.dev display, "Under construction", "Nothing here yet", GitHub link; zero `<script>` in dist |
| apps/landing/src/layouts/Layout.astro | minimal HTML5 shell, imports tokens.css | ✓ VERIFIED | doctype + meta charset/viewport + slot, imports tokens.css |
| apps/landing/src/styles/tokens.css | @theme block with DESIGN.md tokens | ✓ VERIFIED | 24 colors, 3 font families, 12 type roles, 8 spacing, 7 radii |
| apps/landing/src/content/blog/.gitkeep | Content Collections dir hook | ✓ VERIFIED | empty .gitkeep present |
| apps/landing/Dockerfile | multi-stage node:22-slim → nginx:alpine:8080, root context | ✓ VERIFIED | L5/L14, root-relative COPY paths, EXPOSE 8080 |
| apps/landing/nginx/nginx.conf | listen 8080, root /usr/share/nginx/html, gzip, try_files + 404 | ✓ VERIFIED | all present |
| apps/landing/.dockerignore | node_modules/dist/.env/.git/.planning/traefik/scripts | ✓ VERIFIED | all 7 entries + *.log |
| traefik/traefik.yml | static config, NO certificatesResolvers | ✓ VERIFIED | web/websecure + redirect, docker provider, 0 certResolvers |
| docker-compose.yml | traefik + landing services, traefik-public external | ✓ VERIFIED | both services, external network, ACME CLI args, dashboard labels |
| .env.example | 7 required vars | ✓ VERIFIED | all 7 present |
| .gitignore | .env, traefik/letsencrypt/, node_modules/, dist/, .astro/ | ✓ VERIFIED | all covered; acme.json git check-ignore confirmed |
| scripts/bootstrap-host.sh | idempotent VPS prep, executable | ✓ VERIFIED | 755, Docker official repo, ufw, fail2ban, acme.json chmod 600 |
| scripts/verify-staging.sh | openssl s_client → grep STAGING, executable | ✓ VERIFIED | 755, correct pattern |
| scripts/verify-prod.sh | openssl s_client → grep LE/R3/R10, executable | ✓ VERIFIED | 755, correct pattern |
| .github/workflows/release.yml | arm64 CI → GHCR, sha+latest, GITHUB_TOKEN, GHA cache | ✓ VERIFIED | YAML valid; all markers present; context:. + file:./apps/landing/Dockerfile |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| Traefik labels on landing container | Host(luciel.dev) route → nginx:8080 | docker-compose.yml landing labels (Host(luciel.dev), websecure, certresolver le) → landing:8080 (nginx default) | ✓ WIRED | landing service has routing labels; nginx listens 8080 (Docker default port mapping via Traefik docker provider) |
| docker-compose.yml command args | Traefik ACME config (email, caServer) | CLI args with ${ACME_EMAIL}/${LE_CA_SERVER} interpolation | ✓ WIRED | 4 ACME CLI args present, env vars declared in .env.example |
| bootstrap-host.sh → traefik-public network | docker compose up -d succeeds | `docker network create traefik-public` (idempotent) + compose `external: true` | ✓ WIRED | bootstrap creates network; compose references it external |
| GHCR image tag in docker-compose.yml | CI workflow output | `ghcr.io/${GITHUB_USER}/luciel-platform-landing:latest` ↔ workflow IMAGE_NAME `${{ github.repository_owner }}/luciel-platform-landing` + `type=raw,value=latest` | ✓ WIRED | repository_owner == GITHUB_USER; tag scheme matches |
| Workflow build context | Dockerfile structure | `context: .` + `file: ./apps/landing/Dockerfile` ↔ Dockerfile root-relative COPYs | ✓ WIRED | Dockerfile COPYs root package.json + pnpm-lock.yaml; workflow context is repo root |

### Data-Flow Trace (Level 4)

N/A — Phase 1 is infra/scaffold. No dynamic data rendering. index.astro renders static placeholder copy (no fetch, no store, no props from external state). tokens.css is a structural hook, not data-driven.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Astro build produces static HTML | `pnpm --filter @luciel/landing build` | exit 0, dist/index.html + sitemap generated in 179ms | ✓ PASS |
| Zero client JS in output | `grep -c '<script' apps/landing/dist/index.html` | 0 | ✓ PASS |
| Placeholder copy matches UI-SPEC | grep UI-SPEC phrases in dist/index.html | all 4 present (Under construction, luciel.dev, Nothing here yet, View source on GitHub) | ✓ PASS |
| docker compose config valid | `docker compose config > /dev/null` | exit 0 | ✓ PASS |
| acme.json gitignored | `git check-ignore traefik/letsencrypt/acme.json` | matched → exit 0 | ✓ PASS |
| Scripts executable | `test -x` on all 3 scripts | all 755 | ✓ PASS |
| Workflow YAML valid | `python3 -c "import yaml; yaml.safe_load(...)"` | YAML_VALID | ✓ PASS |

### Probe Execution

N/A — no `scripts/*/tests/probe-*.sh` declared in PLAN or conventional locations. Phase validation uses the verify-*.sh scripts (openssl s_client against live luciel.dev) which require the deployed VPS — routed to human verification (deploy gate).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| INFR-01 | 01-01 | Traefik web/websecure + HTTP-01 ACME + HTTP→HTTPS redirect | ✓ SATISFIED (in-repo) | traefik.yml + compose ACME CLI args; live redirect = deploy gate |
| INFR-02 | 01-01 | docker-compose.yml root + Traefik service + shared network | ✓ SATISFIED | compose valid, traefik + landing services, traefik-public external |
| INFR-03 | 01-01 | DNS A @ + wildcard * → VPS | ⚠️ DEFERRED (user) | No code path — Cloudflare action. Documented in bootstrap docstring L7-11 + 01-USER-SETUP.md |
| INFR-04 | 01-02 | LE staging/prod verified, curl -I https://luciel.dev 200 + valid cert | ⚠️ DEFERRED (deploy) | CI workflow wired to produce arm64 image; verify-staging.sh + verify-prod.sh executable. Live cert needs VPS deploy |
| INFR-05 | 01-01 | .env.example with all required vars | ✓ SATISFIED | 7 vars present |
| INFR-06 | 01-01 | traefik/traefik.yml static config, certs in gitignored volume | ✓ SATISFIED | traefik.yml present; acme.json path gitignored |
| CONT-01 | 01-01 | apps/landing/ serving luciel.dev as root (Astro 7) | ✓ SATISFIED (in-repo) | Astro 7 app builds to dist/index.html; compose wires Host(luciel.dev). Live serving = deploy gate |

No orphaned requirements — all 7 phase-1 reqs claimed by plans (01-01: INFR-01,02,03,05,06,CONT-01; 01-02: INFR-04).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | none | — | No TBD/FIXME/XXX markers in phase files. `ponytail:` comments in index.astro are deliberate documented simplifications (ponytail skill convention) — not debt. |

### Human Verification Required

### 1. Deploy Gate — run 01-USER-SETUP.md end-to-end on the VPS

**Test:** On the Oracle A1 VPS — (a) Cloudflare: create A records `@` + `*` → VPS IPv4 (grey-cloud), disable Always-Use-HTTPS; (b) `cp .env.example .env`, fill ACME_EMAIL / TRAEFIK_DASHBOARD_PASS_HASH / GITHUB_USER; (c) push an `apps/landing/**` change to main → CI builds arm64 image → GHCR; (d) `sudo bash scripts/bootstrap-host.sh`; (e) `docker compose up -d`; (f) verify staging → flip to prod → verify prod.
**Expected:** All 5 Phase-1 SCs green — `curl -I https://luciel.dev` → 200 + LE cert; `curl -I http://luciel.dev` → 301; `dig +short test123.luciel.dev` → VPS IP; clean checkout + `docker compose up -d` works; `curl -u admin:<pass> https://traefik.luciel.dev/dashboard/` → 200.
**Why human:** Live-site validation requires Cloudflare DNS, VPS, first GHCR image, and LE issuance. Explicitly out of scope for in-repo verification per phase critical_context. Documented in 01-USER-SETUP.md.

### Gaps Summary

No in-repo gaps. All 18 structural must-have truths VERIFIED. All 20 artifacts present, substantive, wired (Level 1-3). No anti-patterns, no debt markers. 5 roadmap SCs are behavior-dependent on a live VPS deploy — code is wired (Traefik labels, ACME config, CI pipeline, verify scripts all present and correct) but the live behavior is the documented deploy gate (01-USER-SETUP.md), explicitly out of scope for this verification per the phase critical_context.

The phase delivers a complete, reproducible walking skeleton: push to main → CI builds arm64 image → GHCR → VPS `docker compose up -d` pulls and serves `https://luciel.dev` over LE. The only remaining step is the user's deploy action.

---

_Verified: 2026-07-03T02:05:00Z_
_Verifier: the agent (gsd-verifier)_
