# Architecture Patterns

**Domain:** Self-hosted monorepo platform with Traefik reverse proxy, subdomain-per-tool
**Researched:** 2026-07-02

## Recommended Architecture

```
Internet → [Ports 80/443] → Traefik v3.7 (reverse proxy)
                              │
                              │ Docker auto-discovery (labels)
                              │ Let's Encrypt HTTP-01 per subdomain
                              │ shared traefik-public network
                              │
         ┌────────────────────┼──────────────────────────┐
         ▼                    ▼                          ▼
   landing.luciel.dev    rtk.luciel.dev           graph.luciel.dev
   (Astro 7 static      (Next.js 16 +             (Next.js 16 +
    files served by       FastAPI backend)          FastAPI backend)
    Traefik directly
    or via nginx)
         │                    │                          │
         │                    ▼                          ▼
         │              SQLite WAL                  SQLite WAL
         │              (named volume)              (named volume)
         │
    MDX Content
    Collections
    (blog + pages)
```

**Key design rule:** Each subdomain app is completely independent. They share only the Traefik reverse proxy network. No shared database, no shared API, no shared state. This is intentional — it means:
- One broken app cannot affect others
- Each app can be deployed/updated independently
- AdSense runs per-subdomain anyway
- No cross-contamination of data

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Traefik | Reverse proxy, SSL termination, Docker auto-discovery, HTTP-01 ACME | Docker socket (read-only), Let's Encrypt, all apps via `traefik-public` network |
| Landing (Astro 7) | Root domain content: home, blog, tool directory, legal pages | Filesystem (MDX content), Build-time only (static output) |
| Tool Frontend (Next.js 16) | Interactive tool UI per subdomain | Its own FastAPI backend (internal Docker network) |
| Tool Backend (FastAPI) | Business logic, computation, DB access per tool | SQLite DB file on named volume |
| SQLite (WAL) | Data persistence | Single FastAPI process (per tool) |
| App Dockerfile | Containerized, reproducible build per tool | Base images from Docker Hub |

### Data Flow (Typical Tool Request)

```
1. User → https://rtk.luciel.dev/analyze
2. DNS → VPS IP (A record + wildcard match)
3. Traefik receives on :443
   - Matches Host(`rtk.luciel.dev`)
   - Checks TLS cert (Let's Encrypt, auto-obtained)
   - Routes to container `rtk-frontend:
4. Next.js receives request
   - Server-renders the page (React Server Component)
   - For API data: fetches from http://rtk-backend:8000 (internal Docker network)
5. FastAPI handles API request
   - Queries SQLite (aiosqlite, async)
   - Returns JSON
6. Next.js renders full page HTML
7. Traefik sends response to user
```

## Patterns to Follow

### Pattern 1: Monorepo with Independent App Deployments

**What:** Each app has its own Dockerfile, own dependencies, own port. The `docker-compose.yml` at root only orchestrates them. No shared build artifacts across apps.

**When:** Always. This is the core architecture decision.

**Why:** Keeps apps decoupled. A `pnpm install` in one tool doesn't break another. One app can use Python 3.12 while another uses 3.13. CI/CD can target individual apps.

**Example structure:**
```
apps/
  landing/
    Dockerfile
    astro.config.mjs
    src/
      content/blog/   # MDX articles
      pages/
      components/
  rtk/
    frontend/
      Dockerfile
      app/
    backend/
      Dockerfile
      main.py
```

### Pattern 2: Traefik Labels as "DNS for Containers"

**What:** Adding a new subdomain is purely adding labels to a Docker Compose service. No config files edited.

**When:** Every new app.

**Example:**
```yaml
services:
  new-tool:
    build: ./apps/new-tool
    networks:
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.new-tool.rule=Host(`tool.luciel.dev`)"
      - "traefik.http.routers.new-tool.entrypoints=websecure"
      - "traefik.http.routers.new-tool.tls=true"
      - "traefik.http.routers.new-tool.tls.certresolver=letsencrypt"
      # Next.js runs on port 3000 internally:
      - "traefik.http.services.new-tool.loadbalancer.server.port=3000"
```

### Pattern 3: Astro Content Collections for Blog

**What:** All blog posts are MDX files in `src/content/blog/` with typed frontmatter. Astro generates pages, sitemap, RSS.

**When:** Landing blog only. Tools get their own content if needed.

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    publishedAt: z.date(),
    description: z.string(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

### Pattern 4: FastAPI Bare Minimum

**What:** For small per-tool backends, keep it flat. Put routes in `main.py` until endpoints > 5, then split to `routers/`.

**When:** Every tool backend.

```python
# apps/rtk/backend/main.py
from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB, create tables
    await init_db()
    yield
    # Shutdown: nothing needed for SQLite

app = FastAPI(lifespan=lifespan)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared Docker Compose Dependencies

**What:** Making all services depend on each other, or trying to run multiple processes in one container.

**Why bad:** One broken service blocks everything. Harder to debug. Violates the independent-app principle.

**Instead:** Only shared dependency is the Traefik network. Each app stands alone.

### Anti-Pattern 2: Over-Architected FastAPI

**What:** Adding `services/`, `repositories/`, `unit_of_work/`, dependency injection containers for a 3-endpoint tool.

**Why bad:** The project's own brief says "prefer the simplest solution." These abstractions add files, imports, and mental overhead with zero benefit at this scale.

**Instead:** Flat `main.py` + `routers/` when needed. Add abstractions when you copy-paste the same pattern 3+ times.

### Anti-Pattern 3: Premature Postgres Setup

**What:** Replacing SQLite with Postgres "just in case" before any evidence of write contention.

**Why bad:** Adds a whole DB server to the Docker Compose. More memory, more config, more backup surface. The locked decision explicitly says "only if proven contention."

**Instead:** SQLite WAL. Benchmark if needed. Migrate only if `SQLITE_BUSY` appears in logs.

### Anti-Pattern 4: Mixing Build and Runtime in Docker

**What:** Using `node:22-slim` for runtime when the image was used for `npm run build`.

**Why bad:** Bloated production images. Includes dev dependencies, source maps, TypeScript source.

**Instead:** Multi-stage Docker builds:
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

# Stage 2: Production
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
ENV NODE_ENV=production
CMD ["node", "server.js"]
```

## Scalability Considerations

| Concern | At 100 users/day | At 10K users/day | At 1M users/day |
|---------|------------------|------------------|-----------------|
| HTTP/TLS | Traefik handles trivially | Traefik handles easily | May need Traefik tuning + CDN in front |
| Static content (landing) | No server needed (static files) | No server needed (CDN-cacheable) | Cloudflare/CDN |
| Next.js SSR | Single container, fine | Scale horizontally (+ containers) | Orchestrator needed (K8s at this point) |
| FastAPI compute | Single process | Scale workers (gunicorn, 2-4 workers) | Scale horizontally, add caching |
| SQLite WAL | Zero issues | OK for reads. Write contention possible with >1000 writes/s | Switch to Postgres + connection pooling |
| Build time | < 30s | < 1 min | < 5 min (cacheable layers) |
| Disk for backups | < 1 GB | < 10 GB | > 50 GB (at this point, move to Postgres) |

**Realistic ceiling:** This architecture handles ~5K daily visitors comfortably on a $10-20/month VPS (2 vCPU, 4 GB RAM). SQLite is the first bottleneck — but for personal platforms with < 100 daily active tool users, it will never be reached.

## Sources

- Traefik v3 Docker provider documentation (doc.traefik.io/traefik/v3.4/expose/docker/)
- Astro Content Collections documentation (docs.astro.build/en/guides/content-collections/)
- FastAPI best practices for small projects (fastapi.tiangolo.com)
- Simon Willison SQLite WAL Docker research (github.com/simonw/research/tree/main/sqlite-wal-docker-containers)
