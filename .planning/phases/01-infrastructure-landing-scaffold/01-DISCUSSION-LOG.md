# Phase 1: Infrastructure + Landing Scaffold - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 1-Infrastructure + Landing Scaffold
**Areas discussed:** Landing framework, VPS + DNS, Let's Encrypt staging vs prod, Traefik dashboard + Docker socket

---

## Landing Framework

### Q1 — Framework choice
| Option | Description | Selected |
|--------|-------------|----------|
| Astro 7 (recommended) | Zero-JS static output = best AdSense/SEO baseline. Research + STACK.md recommend. React islands via @astrojs/react if contact form needs interactivity. | ✓ |
| Next.js 16 (App Router) | Fallback only if significant client-side interactivity at root (dashboards, real-time data). Ships React runtime + hydration per page — works against AdSense/SEO. | |
| Astro + reserve React islands now | Astro 7 baseline + install @astrojs/react in scaffold for future contact form. Slightly more setup, zero behavior change in Phase 1. | |

**User's choice:** Astro 7 (recommended)
**Notes:** Locks framework for Phases 2–3 too. Resolves the ROADMAP Phase 1 open decision.

### Q2 — Static build serving
| Option | Description | Selected |
|--------|-------------|----------|
| nginx:alpine serving /dist (recommended) | Multi-stage Dockerfile: node:22-slim build → nginx:alpine serves astro build output. Lightest prod image (~50MB), no Node runtime in prod. | ✓ |
| node:22-slim running astro preview | Single-stage Node container running astro preview in prod. Heavier, preview server not officially recommended for production. | |
| caddy file-server | Caddy as static server. Auto-certs redundant (Traefik handles cert). Adds non-stdlib dependency. | |

**User's choice:** nginx:alpine serving /dist (recommended)

### Q3 — Scaffold breadth
| Option | Description | Selected |
|--------|-------------|----------|
| Bare 200-OK placeholder (ponytail) | One minimal index.astro returning 200. No Content Collections, MDX, sitemap, RSS, Tailwind yet. Phase 1 only needs the 200. | |
| Astro + integrations installed (recommended) | Scaffold Astro 7 + @astrojs/mdx, @astrojs/sitemap, @astrojs/rss, @astrojs/tailwind (Tailwind 4 via @tailwindcss/vite), Content Collections configured but empty. No real content. Phase 2 starts from configured base. | ✓ |
| Full home page shell (over-reach) | Layout + header/nav + footer + home page with intro/philosophy placeholders. Pulls Phase 2 work (CONT-02) into Phase 1. Violates phase ordering. | |

**User's choice:** Astro + integrations installed (recommended)

### Q4 — pnpm workspace setup
| Option | Description | Selected |
|--------|-------------|----------|
| pnpm workspaces now (recommended) | Root pnpm-workspace.yaml including apps/*. apps/landing is workspace package from day one. Phase 4 adds apps/rtk by dropping a folder. | ✓ |
| Flat (single apps/landing/package.json) | Each app independent package.json, no workspace link. Simpler but Phase 4 either stays flat or refactors. | |
| You decide | Agent picks; default would fall to pnpm workspaces now. | |

**User's choice:** pnpm workspaces now (recommended)

---

## VPS + DNS

### Q1 — VPS status
| Option | Description | Selected |
|--------|-------------|----------|
| Already provisioned | SSH access to a VPS with public IPv4. Capture provider + OS in CONTEXT.md. | ✓ |
| Not yet — pick provider | Need to provision a VPS during Phase 1. Phase 1 plan includes server provisioning + Docker install + firewall. | |
| You decide (document assumptions) | Agent documents generic Debian 12 VPS assumption with provider-agnostic install steps. | |

**User's choice:** Already provisioned

### Q2 — VPS provider + OS
**User's freeform reply:** Oracle Cloud, Ubuntu 24.04 minimal aarch64 Virtual machine, 4 core OCPU, 24 GB memory, 4 Gbps network bandwidth.

### Q3 — DNS provider
| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare (recommended) | Free, fast propagation. DNS-only mode (grey-cloud) — required so HTTP-01 reaches Traefik; proxy would break it. | ✓ |
| Namecheap / Porkbun / Name.com | Registrar-hosted DNS. Simpler, slower propagation. | |
| Oracle Cloud DNS | Consolidate everything in Oracle since VPS is Oracle Cloud. Less polished UI. | |
| You decide (Cloudflare DNS-only) | Agent defaults to Cloudflare in DNS-only mode. | |

**User's choice:** Cloudflare (recommended)

### Q4 — DNS records + host prep (multi-question)
**Q4a — DNS records:**
| Option | Description | Selected |
|--------|-------------|----------|
| @ A + *.luciel.dev A wildcard (recommended) | Two A records to VPS public IPv4: @ + * wildcard. All future subdomains resolve automatically. Satisfies Phase 1 success criterion #3. | ✓ |
| @ A + explicit per-subdomain A records | Add an A record manually per subdomain. Defeats "one-command new subdomain" goal. | |
| @ A + www CNAME + *.luciel.dev A | Adds explicit www CNAME alongside wildcard. Redundant (wildcard already covers www). | |

**User's choice:** @ A + *.luciel.dev A wildcard (recommended)

**Q4b — VPS host prep:**
| Option | Description | Selected |
|--------|-------------|----------|
| Include host prep in Phase 1 plan (recommended) | Idempotent scripts/bootstrap-host.sh: apt-get docker + compose plugin, ufw allow 22/80/443 + default deny, fail2ban, swap check, timezone. One pass to deploy-ready. | ✓ |
| Assume host already prepped | Skip host prep; plan starts from docker compose up -d. Not reproducible from clean VPS. | |
| You decide | Ship documented bootstrap runbook (idempotent — safe on prepped host). | |

**User's choice:** Include host prep in Phase 1 plan (recommended)

### Q5 — Deploy method
| Option | Description | Selected |
|--------|-------------|----------|
| Build on the VPS (recommended, ponytail) | SSH + git pull + docker compose up -d --build. Native arm64, no buildx, no registry. Matches success criterion #4. | |
| GitHub Actions → GHCR → pull on VPS | CI builds arm64 images, pushes to GHCR, VPS pulls. Reproducible + rollback-able. Adds workflow file + registry auth. | ✓ |
| Build on x86 dev box with buildx, scp tarball | Cross-compile, save tarball, scp, docker load. Most fragile. | |
| You decide | Agent picks Phase 1 builds on VPS directly. Revisit CI/CD later. | |

**User's choice:** GitHub Actions → GHCR → pull on VPS
**Notes:** Deviates from ponytail-recommended "build on VPS" in favor of reproducible CI pipeline. Researcher confirms GHCR free tier covers single-arch arm64 storage.

---

## Let's Encrypt Staging vs Prod

### Q1 — Staging or prod first
| Option | Description | Selected |
|--------|-------------|----------|
| Staging first, flip to prod after smoke (recommended) | Start with acme.caServer=staging; iterate without burning prod quota; once curl shows right SANs + 200, flip env var + restart. | ✓ |
| Prod directly (1 cert, well within quota) | Skip staging. Risk: misconfig hits 5-pending-authorizations/week limit. | |
| Both — staging default, prod toggle via env | LE_STAGING env selector in .env. Captures both behaviors without code changes. | |

**User's choice:** Staging first, flip to prod after smoke (recommended)

### Q2 — acme.json storage
| Option | Description | Selected |
|--------|-------------|----------|
| Bind-mount ./traefik/letsencrypt/acme.json (recommended) | Gitignored bind mount at STACK.md path. Easy cat | jq inspection, easy backup (single file), chmod 600. | ✓ |
| Named Docker volume (traefik-acme) | Docker-managed named volume. More isolated, harder to inspect. | |
| You decide (bind mount) | Agent picks bind mount — matches STACK.md. | |

**User's choice:** Bind-mount ./traefik/letsencrypt/acme.json (recommended)

### Q3 — Resolver topology + cutover + email (multi-question, delivered after interrupt)
User interrupted the question call and answered all three directly:

- **Resolver:** Single `le` resolver, per-Host rules (recommended) — one acme block, each router adds tls.domains[0].main. New subdomain = new router = auto new cert.
- **Cutover:** Automated test script in scripts/ — verify-staging.sh + verify-prod.sh via openssl s_client issuer grep. Repeatable, CI-ready later.
- **LE email:** ACME_EMAIL in .env (recommended) — gitignored, placeholder in .env.example, never hardcoded.

---

## Traefik Dashboard + Docker Socket

### Q1 — Dashboard exposure
| Option | Description | Selected |
|--------|-------------|----------|
| Subdomain + basic auth (recommended) | traefik.luciel.dev via labels (api@internal), HTTPS via wildcard, basic-auth middleware. No SSH tunnel needed. | ✓ |
| SSH tunnel only (localhost bind) | Bind dashboard to 127.0.0.1:8080; reach via ssh -L 8080:localhost:8080. Most secure, requires terminal each time. | |
| Subdomain + IP allowlist middleware | traefik.luciel.dev behind Traefik IP allowlist of home/office IPv4. Breaks on travel/dynamic IP. | |
| You decide (subdomain + basic-auth) | Agent picks option 1 — demonstrates Traefik labels mechanism end-to-end. | |

**User's choice:** Subdomain + basic auth (recommended)

### Q2 — Docker socket mount
| Option | Description | Selected |
|--------|-------------|----------|
| Read-only socket mount + non-root + no-new-privileges (recommended) | /var/run/docker.sock:/var/run/docker.sock:ro, uid 65532, security_opt no-new-privileges:true. One-change hardening. | ✓ |
| Plain r/w socket mount (minimal working first) | r/w socket; full host root via socket if Traefik compromised. Defer hardening to later. | |
| Socket proxy (tecnativa/docker-socket-proxy) | Separate container mediating socket access. Principled but adds service + network hop. YAGNI for solo VPS. | |
| You decide | Agent picks option 1 — :ro is one-character diff for real security gain. | |

**User's choice:** Read-only socket mount + non-root + no-new-privileges (recommended)

### Q3 — Dashboard persistence + .gitignore (multi-question)
**Q3a — Dashboard persistence:**
| Option | Description | Selected |
|--------|-------------|----------|
| Always on (recommended for Phase 1) | Dashboard router persists across restarts. Debugging surface for Phases 2–4. Basic-auth + HTTPS private. | ✓ |
| Toggle via env var (DASH_ENABLED=1) | Dashboard router only when DASH_ENABLED=1. Lower internet footprint long-term. | |
| You decide (always on) | Agent keeps always on — Phase 1 requires dashboard as success criterion #5. | |

**User's choice:** Always on (recommended for Phase 1)

**Q3b — .gitignore scope:**
| Option | Description | Selected |
|--------|-------------|----------|
| traefik/letsencrypt/ + .env + acme.json (recommended) | Scoped ignores for secreted files only. traefik.yml + docker-compose.yml versioned. .env.example tracks required vars. | ✓ |
| Whole traefik/ directory | Over-broad — traefik.yml is documented config you want versioned. | |
| You decide | Agent picks option 1 precisely. | |

**User's choice:** traefik/letsencrypt/ + .env + acme.json (recommended)

---

## Area wrap-ups

User selected "Next area" between areas 1→2, 2→3, and 3→4. After area 4 wrap-up, user also raised a project-level concern ("Ve A LA SIGUENTE AREA, pero antes, en el project indique que cambia automáticamente de modelos osea el /models, segun la tarea, eso si funcion correctamente, asi como el caveman también está activo") — captured as a deferred idea in CONTEXT.md (belongs in a future /gsd-quick to update PROJECT.md Key Decisions or a workspace config file, NOT a Phase 1 build item).

Final wrap-up: user selected "I'm ready for context" — no additional gray areas to explore.

---

## the agent's Discretion

Captured in CONTEXT.md §Implementation Decisions › the agent's Discretion:
- Exact nginx config (gzip, brotli, caching headers)
- Traefik access-log format and destination (stdout default)
- bootstrap-host.sh ordering of ufw vs docker install (must end with docker compose up -d working)
- GHCR image tag scheme (default :sha-<short> + :latest rolling tag)

## Deferred Ideas

Project-level (not Phase 1 scope):
- **Model auto-switching + caveman-active persistence** — user wants this indicated at project/workspace level so sessions switch models adaptively and caveman stays active. Belongs in a future /gsd-quick to update PROJECT.md Key Decisions or a workspace config file (`.opencode/`, `opencode.json`, `.claude/`). Not a Phase 1 implementation decision.

Belonging to later phases (reaffirmed, not deferred from this discussion):
- Blog content (5–8 articles) — Phase 2 (CONT-03)
- Home page intro/philosophy — Phase 2 (CONT-02)
- Legal pages (Privacy/Terms/Contact) — Phase 3 (CONT-06, CONT-07, CONT-08)
- 404, sitemap.xml content, robots.txt, ads.txt, GSC verification — Phase 3
- apps/rtk/ first tool + docs/adding-a-new-app.md — Phase 4
- SQLite backup strategy details — Phase 4 (per STATE.md blocker)