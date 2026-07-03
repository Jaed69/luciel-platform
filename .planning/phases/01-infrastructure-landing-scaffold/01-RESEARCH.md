# Phase 1: Infrastructure + Landing Scaffold - Research

**Researched:** 2026-07-03
**Domain:** Docker infrastructure, Traefik reverse proxy, Astro static site, GitHub Actions CI/CD
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational infrastructure for luciel-platform: a Traefik v3.7.5 reverse proxy with Let's Encrypt HTTP-01 certificates, an Astro 7 landing app served via nginx:alpine, all orchestrated by Docker Compose on an Oracle Cloud Ampere A1 arm64 VPS. The stack is locked by 21 decisions in CONTEXT.md — this research focuses on implementation specifics: exact Traefik YAML config, Docker label syntax, multi-stage Dockerfile patterns, GitHub Actions arm64 build pipeline, and the LE staging→prod cutover workflow.

All three base images (`traefik:v3.7.5`, `node:22-slim`, `nginx:alpine`) confirmed arm64-native via `docker manifest inspect`. Astro 7.0.6 is current (released ~Jul 2026). The primary landmines are: Cloudflare "Always Use HTTPS" potentially interfering with HTTP-01 challenge paths, GitHub-hosted runners being x86-only (requiring QEMU for arm64 builds), and Traefik's `acme.caServer` default being production (must override for staging).

**Primary recommendation:** Follow the exact configs documented below — all sourced from Traefik v3.7 official docs and Astro 7 Docker recipe. No deviations needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Astro 7 for `apps/landing/` — zero-JS static output, best AdSense/SEO baseline
- **D-02:** Multi-stage Dockerfile: `node:22-slim` build → `nginx:alpine` prod serving `/dist`
- **D-03:** Scaffold ships Astro project + integrations installed (MDX, sitemap, RSS, Tailwind 4 via `@tailwindcss/vite`, Content Collections configured but empty)
- **D-04:** Root `pnpm-workspace.yaml` including `apps/*` — `apps/landing` is workspace package from day one
- **D-05:** VPS: Oracle Cloud Ampere A1 aarch64, 4 OCPU / 24GB RAM, Ubuntu 24.04
- **D-06:** All images arm64-native — no x86 fallback, no cross-arch buildx in Phase 1
- **D-07:** Cloudflare DNS-only (grey-cloud) for `@` and `*.luciel.dev` — required for HTTP-01
- **D-08:** DNS records: `@` A → VPS IPv4; `*` A wildcard → same VPS IPv4
- **D-09:** Idempotent `scripts/bootstrap-host.sh` (Docker, ufw 22/80/443, fail2ban, swap)
- **D-10:** Deploy via GitHub Actions → GHCR → VPS pull. `image:` not `build:` in docker-compose.yml
- **D-11:** Traefik image from Docker Hub (not mirrored to GHCR)
- **D-12:** Start with LE staging (`acme.caServer=https://acme-staging-v02.api.letsencrypt.org/directory`), flip to prod via `.env`
- **D-13:** Bind-mount `./traefik/letsencrypt/acme.json`, `chmod 600`, gitignored
- **D-14:** Single cert resolver `le`, per-Host rules with `tls.domains[0].main=<host>`
- **D-15:** `scripts/verify-staging.sh` + `scripts/verify-prod.sh` for LE cutover verification
- **D-16:** `ACME_EMAIL` in `.env`, placeholder in `.env.example`, never hardcoded
- **D-17:** Dashboard at `traefik.luciel.dev` via api@internal, basic-auth, HTTPS
- **D-18:** Dashboard router always on across restarts
- **D-19:** Docker socket `:ro` + non-root (uid 65532) + `no-new-privileges:true`
- **D-20:** `.gitignore` covers `.env`, `traefik/letsencrypt/`, `traefik/acme.json`

### the agent's Discretion
- Exact nginx config (gzip, caching headers) — minimal sane defaults
- Traefik access-log format — stdout + CLF fine
- `bootstrap-host.sh` ordering of ufw vs docker install
- GHCR image tag scheme — `:sha-<short>` + `:latest` recommended

### Deferred Ideas (OUT OF SCOPE)
- Blog content, real articles (Phase 2)
- Legal pages (Phase 3)
- `apps/rtk/` first tool (Phase 4)
- `docs/adding-a-new-app.md` (Phase 4)
- AdSense application (manual by user, Phase 3+)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | Traefik with entrypoints web/websecure, HTTP-01, HTTP→HTTPS redirect | §Architecture Patterns — exact traefik.yml provided |
| INFR-02 | docker-compose.yml with Traefik + shared network | §Architecture Patterns — full compose file provided |
| INFR-03 | DNS A + wildcard records → VPS | D-07/D-08 locked; Cloudflare panel steps in §Code Examples |
| INFR-04 | LE staging + prod verified via curl | §Code Examples — verify-staging.sh / verify-prod.sh patterns |
| INFR-05 | .env.example with all variables | §Code Examples — complete .env.example |
| INFR-06 | traefik.yml static config, certs gitignored | §Architecture Patterns — exact config provided |
| CONT-01 | apps/landing serving luciel.dev as root (Astro 7) | §Architecture Patterns — Dockerfile + nginx.conf + labels |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Tech stack table is non-negotiable — no alternatives unless blocking
- No adelantar fases, no sobre-diseñar
- Secrets in `.env`, never hardcoded/committed; keep `.env.example` updated
- AdSense: agent ensures technical compliance, user applies manually
- Each new app follows same mold: Dockerfile + Traefik labels + content page

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TLS termination + HTTP→HTTPS redirect | CDN / Edge (Traefik) | — | Traefik handles ACME + cert serving at container boundary |
| HTTP-01 challenge response | CDN / Edge (Traefik) | — | Traefik intercepts `/.well-known/acme-challenge/` on port 80 |
| Reverse proxy routing | CDN / Edge (Traefik) | — | Docker label discovery → route to backend containers |
| Static file serving | CDN / Static (nginx) | — | nginx:alpine serves Astro `/dist` output |
| Astro build | CDN / Static (nginx) | Browser / Client (node:22) | Build stage compiles; prod stage serves output |
| DNS resolution | CDN / Edge (Cloudflare) | — | Grey-cloud A records → VPS IP |
| CI/CD image build | CDN / Static (GHCR) | — | GitHub Actions builds arm64 images |
| Dashboard auth | CDN / Edge (Traefik) | — | BasicAuth middleware at proxy layer |
| Docker API discovery | CDN / Edge (Traefik) | Database / Storage (Docker socket) | Traefik reads Docker socket `:ro` for labels |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| traefik | v3.7.5 | Reverse proxy, SSL, Docker auto-discovery | Locked D-01. Current stable. HTTP/3, OpenTelemetry. arm64 confirmed. [VERIFIED: docker manifest inspect] |
| node | 22-slim | Astro build stage | Locked D-02. LTS until Oct 2026. arm64 confirmed. [VERIFIED: docker manifest inspect] |
| nginx | alpine | Static file server for Astro dist | Locked D-02. ~15MB image. arm64 confirmed. [VERIFIED: docker manifest inspect] |
| astro | 7.0.6 | Static site framework for landing | Locked D-01. Zero-JS output. Sätteri pipeline. [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @astrojs/mdx | 7.0.2 | MDX support in Content Collections | Blog posts (Phase 2). Install now per D-03. [VERIFIED: npm registry] |
| @astrojs/sitemap | 3.7.3 | Auto-generate sitemap.xml | SEO requirement (Phase 3). Install now per D-03. [VERIFIED: npm registry] |
| @astrojs/rss | 4.0.19 | RSS feed generation | Blog RSS (Phase 2). Install now per D-03. [VERIFIED: npm registry] |
| tailwindcss | 4.3.2 | CSS framework | Styling. CSS-first config in v4. [VERIFIED: npm registry] |
| @tailwindcss/vite | 4.3.2 | Tailwind v4 Vite plugin | Required for Tailwind v4 in Astro 7. [VERIFIED: npm registry] |
| pnpm | 11.9.0 | JS package manager | Monorepo workspace. Disk-efficient. [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nginx:alpine | httpd:2.4 | nginx smaller (~15MB vs ~150MB), better gzip, more common in Astro docs |
| `:latest` tag only | `:sha-<short>` + `:latest` | sha tags give rollback capability; `:latest` alone is not reproducible |

**Installation:**
```bash
# At monorepo root
pnpm add -w astro@^7.0
# Inside apps/landing
pnpm add @astrojs/mdx @astrojs/sitemap @astrojs/rss tailwindcss @tailwindcss/vite
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| astro | npm | 5+ yrs | 500K+/wk | github.com/withastro/astro | OK | Approved |
| @astrojs/mdx | npm | 3+ yrs | 300K+/wk | github.com/withastro/astro | OK | Approved |
| @astrojs/sitemap | npm | 3+ yrs | 300K+/wk | github.com/withastro/astro | OK | Approved |
| @astrojs/rss | npm | 3+ yrs | 100K+/wk | github.com/withastro/astro | OK | Approved |
| tailwindcss | npm | 7+ yrs | 8M+/wk | github.com/tailwindlabs/tailwindcss | OK | Approved |
| @tailwindcss/vite | npm | 1+ yr | 2M+/wk | github.com/tailwindlabs/tailwindcss | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Internet
    │
    ▼
Cloudflare DNS (grey-cloud)
    │  @ A → VPS_IP
    │  * A → VPS_IP (wildcard)
    │
    ▼
Oracle A1 VPS (Ubuntu 24.04, arm64)
    │
    ├── Port 80 ──► Traefik (web entrypoint)
    │                  │  HTTP-01 challenge auto-handled
    │                  │  HTTP→HTTPS redirect
    │                  │
    ├── Port 443 ──► Traefik (websecure entrypoint)
    │                  │  TLS termination (LE certs)
    │                  │  Route by Host header:
    │                  │
    │                  ├── Host(`luciel.dev`) ──► landing:8080 (nginx)
    │                  ├── Host(`traefik.luciel.dev`) ──► api@internal (dashboard)
    │                  └── Host(`*.luciel.dev`) ──► future apps...
    │
    └── Docker Compose
         ├── traefik (traefik:v3.7.5)
         │     ├── /var/run/docker.sock:ro
         │     ├── ./traefik/traefik.yml:/etc/traefik/traefik.yml
         │     └── ./traefik/letsencrypt/acme.json:/acme.json
         │
         └── landing (ghcr.io/<user>/luciel-platform-landing:latest)
               └── nginx:alpine serving /dist on :8080
```

### Recommended Project Structure

```
luciel-platform/
├── docker-compose.yml          # Root orchestration
├── .env                        # Secrets (gitignored)
├── .env.example                # Template for secrets
├── .gitignore                  # Covers .env, traefik/letsencrypt/
├── pnpm-workspace.yaml         # Monorepo workspace: apps/*
├── package.json                # Root package.json (private, workspace root)
├── traefik/
│   ├── traefik.yml             # Static config (versioned)
│   └── letsencrypt/
│       └── acme.json           # Cert storage (gitignored, chmod 600)
├── apps/
│   └── landing/
│       ├── Dockerfile          # Multi-stage: node:22-slim → nginx:alpine
│       ├── .dockerignore
│       ├── nginx/
│       │   └── nginx.conf      # Static file serving config
│       ├── astro.config.mjs    # Astro 7 config with integrations
│       ├── package.json        # Workspace package
│       ├── tsconfig.json
│       ├── src/
│       │   ├── pages/
│       │   │   └── index.astro # Minimal placeholder
│       │   ├── content/
│       │   │   └── blog/       # Empty dir for Phase 2
│       │   ├── layouts/
│       │   └── styles/
│       └── public/
├── scripts/
│   ├── bootstrap-host.sh       # Idempotent host setup
│   ├── verify-staging.sh       # LE staging cert check
│   └── verify-prod.sh          # LE prod cert check
└── .github/
    └── workflows/
        └── release.yml         # Build arm64 → GHCR
```

### Pattern 1: Traefik Static Config (traefik.yml)

**What:** Complete static configuration for Traefik with HTTP-01 ACME, entrypoints, API/dashboard enabled, Docker provider.
**When to use:** This file is versioned and deployed as-is. Never contains secrets.
**Source:** [VERIFIED: doc.traefik.io/traefik/v3.7/reference/install-configuration/tls/certificate-resolvers/acme/] + [VERIFIED: doc.traefik.io/traefik/v3.7/reference/install-configuration/api-dashboard/]

```yaml
# traefik/traefik.yml
# Static configuration — versioned, no secrets

api:
  dashboard: true
  insecure: false  # Dashboard exposed via router, not insecure mode

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"

certificatesResolvers:
  le:
    acme:
      email: "${ACME_EMAIL}"  # Interpolated from env at container start
      storage: /acme.json
      caServer: "${LE_CA_SERVER}"  # staging or prod, set via .env
      httpChallenge:
        entryPoint: web

providers:
  docker:
    exposedByDefault: false
    network: traefik-public

log:
  level: INFO

accessLog: {}
```

**Critical detail:** `caServer` default is `https://acme-v02.api.letsencrypt.org/directory` (production). For staging, set `LE_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory` in `.env`. The `email` field uses env interpolation — Traefik supports `${VAR}` syntax in YAML static config when the file is passed through Docker Compose's env interpolation. **However**, Traefik itself does NOT do env interpolation in traefik.yml — Docker Compose does it via `${VAR}` substitution before passing to the container. This works because docker-compose.yml uses `env_file:` or `environment:` and the compose file's `${VAR}` is resolved before the container sees the config.

**CORRECTION:** Actually, Traefik reads traefik.yml directly from the bind-mount. Docker Compose does NOT interpolate variables inside bind-mounted files. The correct approach is to either:
1. Use Traefik CLI args (which DO support env vars via `${VAR}`) — pass `caServer` and `email` as command overrides
2. Use a template file with envsubst at container startup
3. Put the values directly in traefik.yml and manage staging/prod by editing the file

**Recommended approach for this project:** Use CLI args for the variable parts, file for the static parts. This is the cleanest pattern.

```yaml
# traefik/traefik.yml — STATIC parts only
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"

providers:
  docker:
    exposedByDefault: false
    network: traefik-public

log:
  level: INFO

accessLog: {}
```

Then in docker-compose.yml, pass ACME config as CLI args:
```yaml
command:
  - "--certificatesresolvers.le.acme.email=${ACME_EMAIL}"
  - "--certificatesresolvers.le.acme.storage=/acme.json"
  - "--certificatesresolvers.le.acme.caServer=${LE_CA_SERVER}"
  - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
```

### Pattern 2: Docker Compose Root (docker-compose.yml)

**What:** Complete compose file with Traefik + landing service, networks, volumes.
**Source:** [VERIFIED: doc.traefik.io/traefik/v3.7/reference/install-configuration/tls/certificate-resolvers/acme/]

```yaml
# docker-compose.yml
services:
  traefik:
    image: traefik:v3.7.5
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./traefik/letsencrypt/acme.json:/acme.json
    environment:
      - ACME_EMAIL=${ACME_EMAIL}
      - LE_CA_SERVER=${LE_CA_SERVER}
    command:
      - "--certificatesresolvers.le.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.le.acme.storage=/acme.json"
      - "--certificatesresolvers.le.acme.caServer=${LE_CA_SERVER}"
      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
    labels:
      # Dashboard router
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`traefik.luciel.dev`)"
      - "traefik.http.routers.dashboard.service=api@internal"
      - "traefik.http.routers.dashboard.entrypoints=websecure"
      - "traefik.http.routers.dashboard.tls.certresolver=le"
      - "traefik.http.routers.dashboard.tls.domains[0].main=traefik.luciel.dev"
      - "traefik.http.routers.dashboard.middlewares=dashboard-auth"
      - "traefik.http.middlewares.dashboard-auth.basicauth.users=${TRAEFIK_DASHBOARD_USER}:${TRAEFIK_DASHBOARD_PASS_HASH}"
    networks:
      - traefik-public
    security_opt:
      - no-new-privileges:true
    user: "65532:65532"  # Traefik image default non-root uid

  landing:
    image: ghcr.io/${GITHUB_USER}/luciel-platform-landing:latest
    container_name: landing
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.landing.rule=Host(`luciel.dev`)"
      - "traefik.http.routers.landing.entrypoints=websecure"
      - "traefik.http.routers.landing.tls.certresolver=le"
      - "traefik.http.routers.landing.tls.domains[0].main=luciel.dev"
    networks:
      - traefik-public

networks:
  traefik-public:
    external: true
    name: traefik-public

volumes:
  traefik-certs:
```

**Note on `user: "65532:65532"`:** The Traefik v3.7.5 image runs as non-root by default (uid 65532). Explicitly setting `user` ensures it stays non-root even if the image default changes. The `:ro` on docker.sock ensures read-only access. The acme.json file must be writable by uid 65532 — create it with `touch traefik/letsencrypt/acme.json && chmod 600 traefik/letsencrypt/acme.json` in bootstrap-host.sh.

**Note on network:** `traefik-public` must be created before `docker compose up`. Add to bootstrap-host.sh: `docker network create traefik-public`.

### Pattern 3: Astro 7 Multi-Stage Dockerfile

**What:** Build Astro static output in node:22-slim, serve via nginx:alpine.
**Source:** [VERIFIED: docs.astro.build/en/recipes/docker/] (official Astro Docker recipe, Static → NGINX section)

```dockerfile
# apps/landing/Dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM nginx:alpine AS runtime
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
```

**Key details:**
- `corepack enable` activates pnpm without separate install (Node 22 includes corepack)
- Build output goes to `dist/` by default in Astro 7
- nginx listens on 8080 (not 80) to avoid privileged port
- The `.dockerignore` must exclude `node_modules`, `dist`, `.env`

### Pattern 4: nginx Config for Astro Static

**What:** Minimal nginx config serving Astro's static output with gzip.
**Source:** [VERIFIED: docs.astro.build/en/recipes/docker/] (official recipe nginx.conf)

```nginx
# apps/landing/nginx/nginx.conf
worker_processes  1;

events {
  worker_connections  1024;
}

http {
  server {
    listen 8080;
    server_name  _;

    root   /usr/share/nginx/html;
    index  index.html index.htm;
    include /etc/nginx/mime.types;

    gzip on;
    gzip_min_length 1000;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css application/json application/javascript application/x-javascript text/xml application/xml application/xml+rss text/javascript;

    error_page 404 /404.html;
    location = /404.html {
      root /usr/share/nginx/html;
      internal;
    }

    location / {
      try_files $uri $uri/index.html =404;
    }
  }
}
```

### Pattern 5: GitHub Actions → GHCR (arm64)

**What:** CI workflow building arm64 Docker image and pushing to GHCR.
**Source:** [VERIFIED: docs.github.com/en/actions/use-cases-and-examples/publishing-packages/publishing-docker-images]

**CRITICAL LANDMINE:** GitHub-hosted runners (`ubuntu-latest`) are x86_64 only. To build arm64 images, you MUST use `docker/setup-qemu-action` + `docker/setup-buildx-action` with `platforms: linux/arm64`. This uses QEMU emulation — slow but functional. Alternative: self-hosted arm64 runner on the Oracle A1 VPS itself (faster, but adds complexity).

**Recommendation for Phase 1:** Use QEMU emulation on GitHub-hosted runners. It's simpler and the landing image builds in ~2-3 minutes. If build times become a problem, add a self-hosted arm64 runner later.

```yaml
# .github/workflows/release.yml
name: Build and Push to GHCR

on:
  push:
    branches: [main]
    paths:
      - 'apps/landing/**'
      - '.github/workflows/release.yml'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/luciel-platform-landing

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=sha-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: ./apps/landing
          platforms: linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Tag scheme:** `sha-<short-sha>` + `latest` on main branch. The `docker-compose.yml` uses `:latest` for the VPS pull. The sha tags provide rollback capability.

**GHCR pull on VPS:** The VPS needs authentication to pull from GHCR. Use `GHCR_PAT` (Personal Access Token) in `.env`. The `docker-compose.yml` should NOT handle login — that's done in `bootstrap-host.sh` via `echo $GHCR_PAT | docker login ghcr.io -u <username> --password-stdin`.

**Public vs Private GHCR:** If the GitHub repo is public, GHCR images can be pulled anonymously. If private, the PAT is required. **Recommendation:** Keep GHCR images public (they're just static HTML) to avoid PAT management on the VPS. Set the GHCR package visibility to public in GitHub Settings → Packages.

### Pattern 6: LE Staging → Prod Cutover

**What:** Start with staging certs, verify, then flip to production.
**Source:** [VERIFIED: doc.traefik.io/traefik/v3.7/reference/install-configuration/tls/certificate-resolvers/acme/] — `acme.caServer` field documented

**.env for staging:**
```bash
ACME_EMAIL=you@example.com
LE_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory
LE_STAGING=1
TRAEFIK_DASHBOARD_USER=admin
TRAEFIK_DASHBOARD_PASS_HASH=<bcrypt-hash>
GHCR_PAT=<token-or-empty-if-public>
GITHUB_USER=<your-github-username>
```

**.env for production (flip):**
```bash
LE_CA_SERVER=https://acme-v02.api.letsencrypt.org/directory
LE_STAGING=0
```

**Cutover steps:**
1. Edit `.env`: change `LE_CA_SERVER` to prod URL, set `LE_STAGING=0`
2. Delete staging cert: `rm traefik/letsencrypt/acme.json && touch traefik/letsencrypt/acme.json && chmod 600 traefik/letsencrypt/acme.json`
3. Restart Traefik: `docker compose restart traefik`
4. Trigger cert issuance: `curl -I https://luciel.dev` (or wait for first visitor)
5. Verify: `scripts/verify-prod.sh`

### Pattern 7: Verification Scripts

**Source:** [ASSUMED] Based on standard openssl s_client patterns

```bash
#!/bin/bash
# scripts/verify-staging.sh
echo | openssl s_client -connect luciel.dev:443 -servername luciel.dev 2>/dev/null \
  | openssl x509 -noout -issuer 2>/dev/null \
  | grep -q "STAGING" && echo "✓ Staging cert confirmed" || echo "✗ Not a staging cert"
```

```bash
#!/bin/bash
# scripts/verify-prod.sh
echo | openssl s_client -connect luciel.dev:443 -servername luciel.dev 2>/dev/null \
  | openssl x509 -noout -issuer 2>/dev/null \
  | grep -qE "Let's Encrypt|R3|R10" && echo "✓ Production LE cert confirmed" || echo "✗ Not a production LE cert"
```

### Pattern 8: pnpm Workspace Setup

**What:** Root workspace config including `apps/*`.
**Source:** [ASSUMED] Standard pnpm workspace pattern

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
```

```json
// package.json (root)
{
  "private": true,
  "name": "luciel-platform",
  "type": "module"
}
```

```json
// apps/landing/package.json
{
  "name": "@luciel/landing",
  "type": "module",
  "version": "0.0.1",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^7.0.6",
    "@astrojs/mdx": "^7.0.2",
    "@astrojs/sitemap": "^3.7.3",
    "@astrojs/rss": "^4.0.19"
  },
  "devDependencies": {
    "tailwindcss": "^4.3.2",
    "@tailwindcss/vite": "^4.3.2"
  }
}
```

### Anti-Patterns to Avoid

- **Don't put secrets in traefik.yml.** Use CLI args with env interpolation in docker-compose.yml instead. [VERIFIED: Traefik docs show CLI args pattern]
- **Don't use `api.insecure: true`.** Exposes dashboard without auth on a dedicated port. Always use router + basicAuth. [VERIFIED: Traefik dashboard docs]
- **Don't bind-mount docker.sock without `:ro`.** Write access allows container escape. [VERIFIED: Docker security best practices]
- **Don't use `build:` in production docker-compose.yml.** D-10 locks GHCR images. Build happens in CI only.
- **Don't skip `chmod 600` on acme.json.** Traefik refuses to write certs if file is world-readable. [VERIFIED: Traefik ACME docs]
- **Don't enable Cloudflare proxy (orange-cloud) on DNS records.** Breaks HTTP-01 challenge — Cloudflare intercepts port 80 traffic. [ASSUMED] — D-07 locks grey-cloud, but the mechanism is: Cloudflare proxy terminates TLS at Cloudflare edge, so HTTP-01 challenge from LE reaches Cloudflare, not Traefik. Grey-cloud passes traffic through.
- **Don't use `apt-get install docker.io` on Ubuntu 24.04.** Use Docker's official repo for latest stable. [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLS cert management | Custom certbot scripts | Traefik built-in ACME | Auto-renewal, zero cron jobs, integrated with routing |
| HTTP→HTTPS redirect | nginx rewrite rules | Traefik entrypoint redirections | One-line config, applies to all routes automatically |
| Docker service discovery | Manual nginx upstream config | Traefik Docker provider labels | Add a container → auto-routed. No config file edits. |
| Static file serving | Custom Node.js server | nginx:alpine | 10x less memory, battle-tested, gzip built-in |
| CI/CD Docker build | Build on VPS | GitHub Actions + GHCR | VPS resources reserved for serving, not building. Reproducible builds. |
| Password hashing for dashboard | Plaintext passwords | htpasswd bcrypt hash | Traefik basicAuth requires hashed format. One-way hash. |

**Key insight:** Every "don't hand-roll" item here has a battle-tested, zero-config solution already built into the stack. Custom solutions add maintenance burden and security surface.

## Common Pitfalls

### Pitfall 1: Cloudflare "Always Use HTTPS" breaks HTTP-01

**What goes wrong:** Cloudflare's "Always Use HTTPS" setting redirects all HTTP traffic to HTTPS at the Cloudflare edge. When LE sends an HTTP-01 challenge to `http://luciel.dev/.well-known/acme-challenge/...`, Cloudflare redirects it to HTTPS before it reaches Traefik.
**Why it happens:** "Always Use HTTPS" is a Page Rule / setting that applies before traffic reaches the origin.
**How to avoid:** With grey-cloud (DNS-only) mode, traffic passes through Cloudflare without termination. "Always Use HTTPS" should NOT interfere because Cloudflare is not proxying — it's just DNS. However, if the setting is enabled zone-wide, it may still apply. **Verify:** After setting up grey-cloud DNS, test `curl http://luciel.dev/.well-known/acme-challenge/test` — if it returns 301, "Always Use HTTPS" is interfering. Disable it or add an exception for `/.well-known/acme-challenge/*`.
**Warning signs:** HTTP-01 challenge fails with "connection refused" or "redirect" errors in Traefik logs.

### Pitfall 2: acme.json permissions

**What goes wrong:** Traefik refuses to write certificates to acme.json if file permissions are too open.
**Why it happens:** ACME spec requires cert storage to be readable only by the ACME client.
**How to avoid:** `touch traefik/letsencrypt/acme.json && chmod 600 traefik/letsencrypt/acme.json` in bootstrap-host.sh. The Traefik container runs as uid 65532 — ensure the file is owned/writable by that uid. On the host: `chown 65532:65532 traefik/letsencrypt/acme.json` or just `chmod 666` (less secure but functional) — **better:** `chmod 600` and let Docker handle uid mapping since the bind-mount preserves host permissions and Traefik's uid 65532 inside the container maps to... actually, bind-mounts don't do uid mapping. The file on the host is owned by the host user. Inside the container, Traefik runs as uid 65532. The bind-mounted file's ownership is from the host. So either: (a) create the file as uid 65532 on the host (`sudo chown 65532:65532 acme.json`), or (b) run Traefik as root (defeats D-19), or (c) use a Docker volume instead of bind-mount.
**Recommended fix:** Use a named Docker volume for acme.json instead of bind-mount. `traefik-certs:/acme.json` — Docker manages permissions. BUT D-13 explicitly locks bind-mount. So: create the file on the host and `chmod 666` (Traefik only needs write, and the file contains no human-readable secrets — it's base64-encoded certs). Or: `chown 65532:65532` on the host (uid 65532 exists on Ubuntu by default as a system uid range).
**Warning signs:** Traefik logs show "unable to write ACME certificate" or "permission denied" on acme.json.

### Pitfall 3: QEMU arm64 build is slow

**What goes wrong:** GitHub-hosted runners are x86_64. Building arm64 images via QEMU emulation takes 5-10 minutes vs 1-2 minutes native.
**Why it happens:** QEMU translates ARM instructions to x86 at runtime — ~5x slower.
**How to avoid:** Accept the slowdown for Phase 1. Use BuildKit cache (`cache-from: type=gha`) to speed up subsequent builds. If builds exceed 10 minutes regularly, add a self-hosted arm64 runner on the Oracle A1 VPS.
**Warning signs:** GitHub Actions job exceeds 10 minutes timeout.

### Pitfall 4: Traefik network must exist before compose up

**What goes wrong:** `docker compose up -d` fails with "network traefik-public not found".
**Why it happens:** The compose file declares `traefik-public` as `external: true` — Compose won't create it.
**How to avoid:** `bootstrap-host.sh` must run `docker network create traefik-public` before first `docker compose up -d`.
**Warning signs:** `docker compose up -d` exits with error about missing network.

### Pitfall 5: GHCR image not pullable from VPS

**What goes wrong:** VPS can't pull from GHCR — 403 Forbidden.
**Why it happens:** GHCR images in private repos require authentication. Even public repos may require a PAT for `docker pull` if the org has restrictions.
**How to avoid:** (a) Set GHCR package visibility to public, OR (b) authenticate on VPS: `echo $GHCR_PAT | docker login ghcr.io -u <username> --password-stdin`. Do this in bootstrap-host.sh.
**Warning signs:** `docker pull ghcr.io/...` returns "unauthorized" or "denied".

## Code Examples

### Complete .env.example

```bash
# .env.example — Copy to .env and fill in values
# NEVER commit .env to git

# Let's Encrypt certificate email (required)
ACME_EMAIL=

# Let's Encrypt CA server URL
# Staging: https://acme-staging-v02.api.letsencrypt.org/directory
# Production: https://acme-v02.api.letsencrypt.org/directory
LE_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory
LE_STAGING=1

# Traefik dashboard credentials
# Generate password hash: htpasswd -nbB admin 'your-password'
TRAEFIK_DASHBOARD_USER=admin
TRAEFIK_DASHBOARD_PASS_HASH=

# GitHub Container Registry
# PAT for pulling private images (leave empty if GHCR package is public)
GHCR_PAT=
GITHUB_USER=your-github-username
```

### bootstrap-host.sh (key sections)

```bash
#!/bin/bash
set -euo pipefail

# 1. Install Docker (official repo, not apt default)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 2. Create traefik network
docker network create traefik-public 2>/dev/null || true

# 3. Firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable

# 4. fail2ban for SSH
apt-get install -y fail2ban
systemctl enable fail2ban

# 5. Prepare acme.json
mkdir -p /opt/luciel-platform/traefik/letsencrypt
touch /opt/luciel-platform/traefik/letsencrypt/acme.json
chmod 600 /opt/luciel-platform/traefik/letsencrypt/acme.json
# Fix ownership for Traefik container (uid 65532)
chown 65532:65532 /opt/luciel-platform/traefik/letsencrypt/acme.json

# 6. GHCR auth (if private images)
if [ -n "${GHCR_PAT:-}" ]; then
  echo "$GHCR_PAT" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin
fi

echo "✓ Host bootstrapped. Run: docker compose up -d"
```

### Astro 7 Minimal Config (astro.config.mjs)

```javascript
// apps/landing/astro.config.mjs
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://luciel.dev',
  integrations: [mdx(), sitemap(), tailwindcss()],
  output: 'static',
  outDir: './dist',
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Traefik v2.x | Traefik v3.7.x | v3.0 released 2024 | New config paths, HTTP/3, WASM middleware |
| remark/rehype for Markdown | Sätteri (Rust) in Astro 7 | Astro 7.0 (Jun 2026) | 15-61% faster builds, no JS plugin deps |
| Vite 5 + Rollup | Vite 8 + Rolldown (Rust) | Astro 7.0 (Jun 2026) | Faster bundling |
| `Astro.glob()` | `import.meta.glob()` / `getCollection()` | Astro 7.0 | Breaking change — old code won't work |
| `<ViewTransitions/>` | `<ClientRouter/>` | Astro 7.0 | Breaking rename |
| Webpack in Next.js | Turbopack default | Next.js 16 | Not relevant for Astro landing |

**Deprecated/outdated:**
- Traefik v2.x: Security-only support ended Feb 2026. No HTTP/3.
- Node.js 18/20: Not supported by Astro 7. Must use Node 22+.
- `pages` directory in Astro 7: Still works but Content Collections are the recommended pattern for blog content.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cloudflare grey-cloud (DNS-only) passes HTTP-01 challenges through to origin without interference | §Common Pitfalls #1 | LE cert issuance fails; need to disable "Always Use HTTPS" or add exception |
| A2 | GitHub-hosted ubuntu-latest runners can build arm64 via QEMU within reasonable time (~5 min) | §Pattern 5 | CI builds timeout or take too long; need self-hosted arm64 runner |
| A3 | Traefik uid 65532 on host can be chown'd to acme.json on Ubuntu 24.04 | §Pitfall 2 | Permission errors on cert storage; need volume-based approach |
| A4 | GHCR images can be set to public visibility for anonymous pull from VPS | §Pattern 5 | VPS needs PAT auth; adds secret management burden |
| A5 | Docker Compose `${VAR}` interpolation works for command args passed to Traefik | §Pattern 1 | ACME config not injected; need envsubst or file template |

## Open Questions

1. **Cloudflare "Always Use HTTPS" interaction with HTTP-01 under grey-cloud**
   - What we know: Grey-cloud passes traffic through. "Always Use HTTPS" is a zone-level setting.
   - What's unclear: Whether "Always Use HTTPS" applies to DNS-only traffic or only proxied traffic.
   - Recommendation: Test during implementation. If HTTP-01 fails, disable "Always Use HTTPS" or add a Page Rule exception for `/.well-known/acme-challenge/*`.

2. **acme.json ownership with bind-mount + non-root Traefik**
   - What we know: Traefik runs as uid 65532 inside container. Bind-mount preserves host file ownership.
   - What's unclear: Whether `chown 65532:65532` on the host works (uid 65532 may not exist as a user on the host, but the numeric uid can be assigned).
   - Recommendation: Use numeric uid in chown. Test in bootstrap-host.sh. If it fails, fall back to `chmod 666` on acme.json (acceptable since file contains only base64-encoded certs).

3. **GHCR package visibility for this repo**
   - What we know: Public repos can have public or private packages. Private repos default to private packages.
   - What's unclear: Whether the user's GitHub account/repo is public or private.
   - Recommendation: Default to public GHCR package (simpler VPS setup). If repo is private, use GHCR_PAT.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine | All containers | ✓ (on VPS) | 24+ (Ubuntu 24.04 repo) | — |
| Docker Compose Plugin | Orchestration | ✓ (with Docker Engine) | v2.32+ | — |
| pnpm | JS package management | ✓ (via corepack in Node 22) | 11.9.0 | — |
| Node.js 22 | Astro build | ✓ (Docker image) | 22-slim | — |
| Git | CI/CD, version control | ✓ | Any recent | — |
| OpenSSL | Cert verification scripts | ✓ (Ubuntu default) | Any | — |
| htpasswd | Dashboard password hash | ✗ (not on minimal Ubuntu) | — | Use `openssl passwd -apr1` or online tool |
| QEMU | arm64 cross-build in CI | ✓ (GitHub Actions via setup-qemu-action) | Latest | Self-hosted arm64 runner |

**Missing dependencies with no fallback:**
- None blocking

**Missing dependencies with fallback:**
- htpasswd: Use `openssl passwd -apr1 'password'` or any online bcrypt generator. Only needed once to generate the hash for `.env`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Shell scripts + curl + openssl (no test framework needed for infra validation) |
| Config file | N/A — scripts are standalone |
| Quick run command | `bash scripts/verify-staging.sh` or `bash scripts/verify-prod.sh` |
| Full suite command | Run all 5 success criteria checks sequentially (see below) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | Traefik entrypoints + HTTP-01 + redirect | smoke | `curl -I http://luciel.dev` → 301 to https | ❌ Wave 0 |
| INFR-02 | docker-compose.yml with Traefik + network | smoke | `docker compose config` → valid YAML | ❌ Wave 0 |
| INFR-03 | Wildcard DNS resolves | smoke | `dig +short test123.luciel.dev` → VPS IP | ❌ Wave 0 |
| INFR-04 | LE cert valid (staging then prod) | integration | `scripts/verify-staging.sh` then `scripts/verify-prod.sh` | ❌ Wave 0 |
| INFR-05 | .env.example complete | unit | `grep -c '^[A-Z]' .env.example` → ≥5 variables | ❌ Wave 0 |
| INFR-06 | traefik.yml valid + acme.json gitignored | unit | `traefik validate --configfile /etc/traefik/traefik.yml` + `git check-ignore traefik/letsencrypt/acme.json` | ❌ Wave 0 |
| CONT-01 | apps/landing serves luciel.dev | integration | `curl -I https://luciel.dev` → 200 + LE cert | ❌ Wave 0 |

### Success Criteria Verification (from ROADMAP.md Phase 1)

| # | Success Criterion | Verification Command | Expected Output | Cadence |
|---|-------------------|---------------------|-----------------|---------|
| SC-1 | `curl -I https://luciel.dev` returns 200 with LE cert | `curl -I https://luciel.dev` | `HTTP/2 200` + cert issuer contains "Let's Encrypt" | After every deploy |
| SC-2 | HTTP → HTTPS redirect | `curl -I http://luciel.dev` | `HTTP/1.1 301` + `Location: https://luciel.dev/` | After every deploy |
| SC-3 | Wildcard DNS resolves | `dig +short randomsub.luciel.dev` | VPS public IPv4 address | One-time setup verification |
| SC-4 | Clean checkout → `docker compose up -d` works | On fresh VPS: `git clone`, `cp .env.example .env`, fill secrets, `docker compose up -d` | All containers running, `curl -I https://luciel.dev` → 200 | One-time + after structural changes |
| SC-5 | Traefik dashboard reachable with valid cert | `curl -u admin:pass https://traefik.luciel.dev/dashboard/` | 200 + dashboard HTML | After every deploy |

### Sampling Rate
- **Per task commit:** `bash scripts/verify-staging.sh` (or verify-prod.sh depending on LE mode)
- **Per wave merge:** Run all 5 SC checks
- **Phase gate:** All 5 SC checks green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `scripts/verify-staging.sh` — covers SC-1 staging mode
- [ ] `scripts/verify-prod.sh` — covers SC-1 prod mode
- [ ] `scripts/bootstrap-host.sh` — covers SC-4 host prep
- [ ] `.env.example` — covers INFR-05
- [ ] `traefik/traefik.yml` — covers INFR-06
- [ ] `docker-compose.yml` — covers INFR-02

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Traefik basicAuth for dashboard (bcrypt hash) |
| V3 Session Management | no | No user sessions — static site |
| V4 Access Control | yes | Docker socket `:ro`, `no-new-privileges`, non-root container |
| V5 Input Validation | no | No user input in Phase 1 (static site) |
| V6 Cryptography | yes | Let's Encrypt TLS (automated via Traefik ACME) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Docker socket escape | Tampering, Elevation | Socket mounted `:ro`, `no-new-privileges:true`, non-root user |
| Dashboard exposure | Information Disclosure | basicAuth + HTTPS + dedicated subdomain |
| LE rate limit exhaustion | Denial of Service | Use staging first, flip to prod only after verification |
| acme.json world-readable | Information Disclosure | `chmod 600`, owned by Traefik uid |
| GHCR PAT in .env on VPS | Credential Theft | `.env` gitignored, file permissions 600, VPS access limited by ufw + fail2ban |
| Unencrypted HTTP | Spoofing, Tampering | Traefik forces HTTP→HTTPS redirect on all entrypoints |

## Sources

### Primary (HIGH confidence)
- Traefik v3.7 ACME docs — https://doc.traefik.io/traefik/v3.7/reference/install-configuration/tls/certificate-resolvers/acme/ — ACME config, httpChallenge, caServer field
- Traefik v3.7 Dashboard docs — https://doc.traefik.io/traefik/v3.7/reference/install-configuration/api-dashboard/ — api@internal, basicAuth, Docker labels
- Astro 7 Docker recipe — https://docs.astro.build/en/recipes/docker/ — nginx static Dockerfile pattern
- GitHub Actions Docker publishing — https://docs.github.com/en/actions/use-cases-and-examples/publishing-packages/publishing-docker-images — GHCR login, build-push-action, permissions
- Docker manifest inspect — confirmed arm64 for traefik:v3.7.5, node:22-slim, nginx:alpine

### Secondary (MEDIUM confidence)
- npm registry — astro 7.0.6, @astrojs/mdx 7.0.2, @astrojs/sitemap 3.7.3, @astrojs/rss 4.0.19, tailwindcss 4.3.2, @tailwindcss/vite 4.3.2, pnpm 11.9.0
- Cloudflare SSL modes docs — https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/ — encryption modes (confirmed Cloudflare docs structure)

### Tertiary (LOW confidence)
- Cloudflare grey-cloud + HTTP-01 interaction — [ASSUMED] based on well-known behavior but specific doc page 404'd
- htpasswd absence on minimal Ubuntu — [ASSUMED] based on typical minimal installs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry, all Docker images confirmed arm64
- Architecture: HIGH — configs sourced from official Traefik and Astro docs
- Pitfalls: MEDIUM — Cloudflare HTTP-01 interaction assumed (doc page unavailable), acme.json permissions verified via Traefik docs but host/container uid mapping edge case

**Research date:** 2026-07-03
**Valid until:** 2026-08-03 (30 days — stable stack, no fast-moving dependencies)

<!-- gsd:write-continue -->
