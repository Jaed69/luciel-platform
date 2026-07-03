# Domain Pitfalls

**Domain:** Self-hosted monorepo platform with Traefik reverse proxy, subdomain-per-tool, AdSense monetization
**Researched:** 2026-07-02

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Choosing Next.js for the Landing (Content-Heavy Root)

**What goes wrong:** The root domain is mostly static content: blog posts, personal bio, project directory. If built with Next.js, every page ships React runtime + hydration JSON + split JS chunks, even for purely text content. This creates two problems: (1) larger payload = slower page loads, hurting Core Web Vitals, (2) Google crawlers see heavier DOM, and AdSense review has rejected sites for JS-heavy pages that hide visible content from crawlers.

**Why it happens:** Developer familiarity ("I know React/Next.js") or wanting a single framework across all apps.

**Consequences:** Harder AdSense approval, slower pages, more optimization work for worse outcomes.

**Prevention:** Use Astro 7 for the landing. Astro outputs zero JS by default, pure HTML, parser-friendly for crawlers. It can still embed React components as islands where interactivity is needed (contact form, newsletter).

**Detection:** If `apps/landing` is set up with Next.js, change to Astro before Phase 2 content work begins.

### Pitfall 2: Building Tools Before Content (Wrong Order)

**What goes wrong:** The developer builds the fun technical tools first (graph visualizer, hackathon radar) and defers the blog content. When AdSense review comes, there's insufficient content on the root domain. AdSense rejects. The developer must then scramble to write articles.

**Why it happens:** Technical work is more fun than writing. The "I'll write later" trap.

**Consequences:** Wasted tool-building effort that can't be monetized. Delayed AdSense revenue. Demotivation.

**Prevention:** Enforce the phase order. Root domain content (blog + pages) must be complete and live before building the first tool. The brief explicitly states this — respect it.

**Detection:** If the team starts building a tool Dockerfile before the Astro blog has 5+ articles, stop and reprioritize.

### Pitfall 3: SQLite in Production Without Backup Strategy

**What goes wrong:** The VPS disk fails, the Docker volume gets corrupted, or someone deletes the wrong container. The SQLite `.db` file lives in a named Docker volume — if the VPS dies, the data is gone unless backed up externally.

**Why it happens:** SQLite is "just a file" — easy to forget it needs the same backup discipline as Postgres.

**Consequences:** Permanent data loss of tool data (user-generated content, computed results).

**Prevention:** From the first tool with a database, implement automated backups. SQLite's `.backup()` API is safe on live databases (creates a consistent snapshot). Backup to a separate volume or external storage.

**Detection:** If a FastAPI tool uses SQLite but has no backup script, add it immediately.

### Pitfall 4: Traefik HTTP-01 Rate Limiting with Many Subdomains

**What goes wrong:** Each subdomain triggers a separate ACME certificate request. Let's Encrypt rate limit is 50 certificates per week for the same domain (luciel.dev). Adding 10 subdomains quickly is fine. But if certificates need renewal and the Let's Encrypt server has issues, some domains may fail to get certs.

**Why it happens:** HTTP-01 is per-subdomain, not a wildcard cert. This was the explicit decision (simpler, no DNS API keys).

**Consequences:** A subdomain loses its cert and starts showing browser security warnings.

**Prevention:** Monitor Traefik logs for ACME errors. Set up cert expiry alerts (Traefik dashboard shows this). With < 20 subdomains, rate limits won't be hit under normal operation.

**Detection:** Traefik logs show `acme: error: 429 too many requests` or certs stop renewing. Monitor at 40+ subdomains or after a mass restart.

## Moderate Pitfalls

### Pitfall 1: Mixing Python Dependencies Across Tools

**What goes wrong:** Two FastAPI backends share the same Python environment or venv. A dependency upgrade for one tool breaks the other.

**Prevention:** Each tool has its own Docker container with its own `pyproject.toml` / `requirements.txt`. Completely isolated environments.

### Pitfall 2: Over-Scoping the First Tool

**What goes wrong:** The first tool (rtk) tries to do too much: complex UI, multiple API routes, database, background tasks, external integrations. It takes months instead of days.

**Prevention:** First tool MUST be simple. No external dependencies. Pure computation that doesn't need scraping or third-party APIs. Get it working end-to-end first, then add features.

### Pitfall 3: Not Documenting the "New App" Pattern

**What goes wrong:** Each new tool is built differently because there's no documented standard. Some use port 3000, some 4321. Some have Dockerfile, some don't.

**Prevention:** After Phase 3, immediately write `docs/adding-a-new-app.md` that captures THE ACTUAL STEPS followed, not a theoretical process. Future tools must follow this document.

### Pitfall 4: AdSense Applied Too Early

**What goes wrong:** Applying to AdSense with only 2 blog posts and a placeholder landing page. Google rejects. The domain is now flagged and re-application is harder.

**Prevention:** Wait until the site has: (1) 5-8 substantial original articles, (2) complete legal pages, (3) no broken links or 404s, (4) clear navigation, (5) been live for 1-2 weeks. Let the user apply manually — never automate AdSense submission.

### Pitfall 5: Running `docker compose` on Production Without Non-Root User

**What goes wrong:** Docker socket exposed in Traefik with root access. A compromised container could escape to the host via the Docker socket.

**Prevention:** The VPS should run Docker as non-root (use Docker group). Mount the Docker socket read-only (`:ro`). Restrict Traefik's capabilities (`no-new-privileges:true`, drop all capabilities, add only specific needed ones).

## Minor Pitfalls

### Pitfall 1: Hardcoded Ports in Next.js Dockerfile

**What goes wrong:** Next.js defaults to port 3000. If the tool needs a different port (e.g., 4321 for Astro), it's hardcoded in both Dockerfile and Traefik labels. Change one but not the other = 502 error.

**Prevention:** Use `ENV PORT=3000` in Dockerfile and reference `traefik.http.services.X.loadbalancer.server.port=3000` in labels. Document which port each app uses.

### Pitfall 2: Astro 7 Breaking Changes

**What goes wrong:** Astro 6 content collections code uses `Astro.glob()` or `getEntryBySlug()` — both removed in Astro 7. Sätteri replaces remark/rehype by default.

**Prevention:** Start with Astro 7. If following Astro 6 tutorials, note that `Astro.glob()` → `import.meta.glob()` and `<ViewTransitions/>` → `<ClientRouter/>`.

### Pitfall 3: Tailwind v4 Config Syntax

**What goes wrong:** Following Tailwind v3 tutorials with `tailwind.config.js`. Tailwind v4 is CSS-first with `@import "tailwindcss"` in the main CSS file.

**Prevention:** Use `@tailwindcss/vite` plugin in both Astro and Next.js. Read Tailwind v4 docs, not v3 tutorials.

### Pitfall 4: Docker Image Tag `latest`

**What goes wrong:** Using `traefik:latest` or `python:latest` in production. A breaking change in a new image version silently breaks the deployment.

**Prevention:** Pin specific versions: `traefik:v3.7`, `python:3.13-slim`, `node:22-alpine`. Update pinned versions deliberately and test before deploying.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Traefik SSL setup | HTTP-01 challenge fails because port 80 isn't open or DNS isn't propagated | Test with `curl -I https://luciel.dev` from outside the VPS. Use `--log.level=DEBUG` on Traefik initially. |
| Phase 2: Blog content | Writing generic filler instead of real technical content | Only write about projects that already exist (simulador tráfico, AGRODROID, RAG, ABET). Original text, not translations. |
| Phase 2: Legal pages | Missing Privacy Policy or Terms before AdSense review | Generate with Termly/iubenda before applying to AdSense. |
| Phase 3: First tool DB setup | SQLite WAL not enabled, leading to `SQLITE_BUSY` errors on first concurrent use | Always run `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;` on every connection open. |
| Phase 3: First tool content | Tool page is just the UI widget with no explanatory text | Must include: what problem it solves, how it works, tech choices, related blog article link. |
| Phase 4: Pattern documentation | Writing generic "how to add an app" doc that doesn't match the actual steps | Write the doc AFTER building the first tool, capturing the real commands and files. |
| General: Secrets | API keys committed to git | Use `.env` with `.env.example`. Add `.env` to `.gitignore` early. Use `$VARIABLE` syntax in docker-compose.yml. |

## Sources

- Google AdSense Program Policies (current — re-verify before Phase 2)
- Let's Encrypt rate limits (letsencrypt.org/docs/rate-limits/)
- SQLite WAL mode caveats (sqlite.org/wal.html)
- Simon Willison SQLite Docker research (Apr 2026)
- Astro 6→7 migration guide (docs.astro.build)
- Traefik security best practices (doc.traefik.io/traefik)
- Project brief guardrails (luciel-platform-brief.md)
