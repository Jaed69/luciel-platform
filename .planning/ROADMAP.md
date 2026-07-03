# Roadmap: luciel-platform

## Overview

A phased build of a self-hosted "productized portfolio" on `luciel.dev`: a content hub (root domain) + subdomain-per-tool architecture behind Traefik, monetized via Google AdSense. Phase order is non-negotiable — the root domain content must be complete and live before tools, because AdSense requires substantial original text on the root before monetizing subdomains. Each phase delivers a live, working result on the internet.

**Mode:** mvp — each phase is a vertical slice delivering an end-to-end user capability, not a horizontal layer.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Infrastructure + Landing Scaffold** - Traefik + DNS + Let's Encrypt + minimal `luciel.dev` live over HTTPS
- [ ] **Phase 2: Content Hub** - Home, blog (5-8 real articles), Projects page, navigation, RSS, OG tags, 404
- [ ] **Phase 3: Legal + AdSense Readiness** - Privacy/Terms/Contact pages + sitemap/robots/ads.txt/GSC + per-article SEO
- [ ] **Phase 4: First Tool Pilot (rtk) + Pattern Documentation** - `rtk.luciel.dev` working end-to-end + `docs/adding-a-new-app.md`

## Phase Details

### Phase 1: Infrastructure + Landing Scaffold
**Goal**: A visitor can load `https://luciel.dev` over a valid Let's Encrypt certificate behind Traefik, with the stack reproducible from `docker compose up -d`.
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05, INFR-06, CONT-01
**Open decisions**: Landing framework — **Astro 7 vs Next.js 16**. Project research strongly recommends Astro (zero-JS output = best AdSense/SEO baseline; root domain is mostly static content + blog). Default: Astro unless a concrete interactivity need surfaces during planning. Resolution required at the start of Phase 1's first plan.
**Success Criteria** (what must be TRUE):
  1. `curl -I https://luciel.dev` returns HTTP 200 with a Let's Encrypt certificate (not self-signed), trusted by browsers without warnings
  2. HTTP requests to `luciel.dev` redirect permanently to HTTPS
  3. A wildcard DNS record means `*.luciel.dev` resolves to the VPS — verified by adding a throwaway Host rule for a fresh subdomain and seeing Traefik serve it
  4. The entire stack starts from a clean checkout via `docker compose up -d` using only `.env.example` (DNS + secrets configured), no manual config edits
  5. The Traefik dashboard is reachable and shows the `luciel.dev` router with a valid cert resolver
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Monorepo scaffold + Astro 7 landing + Traefik stack + bootstrap + verify scripts
- [ ] 01-02-PLAN.md — GitHub Actions arm64 CI/CD → GHCR pipeline

### Phase 2: Content Hub
**Goal**: Visitors find a complete, navigable content site at `luciel.dev` with original technical articles — the SEO surface that future AdSense monetization depends on.
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: CONT-02, CONT-03, CONT-04, CONT-05, CONT-09, CONT-10, CONT-11, CONT-12
**Success Criteria** (what must be TRUE):
  1. Home page presents a personal intro, the project philosophy, and a tool directory listing planned tools with "coming soon" entries
  2. The blog lists 5-8 articles, each readable end-to-end, with syntax-highlighted code blocks (Shiki/bright)
  3. Every page is reachable via header and footer navigation; following all internal links produces no 404s
  4. `/rss.xml` serves a valid Atom/RSS feed containing all published posts
  5. Each page has Open Graph tags (title, description, image) so link previews render on social platforms
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Legal + AdSense Readiness
**Goal**: The site satisfies all legal and Google AdSense acceptance prerequisites — ready for the user to apply to AdSense manually (the agent never auto-applies).
**Mode**: mvp
**Depends on**: Phase 2
**Requirements**: CONT-06, CONT-07, CONT-08, SEOA-01, SEOA-02, SEOA-03, SEOA-04, SEOA-05, SEOA-06, SEOA-07
**Success Criteria** (what must be TRUE):
  1. Privacy Policy, Terms of Use, and a Contact page are live and linked from the footer on every page
  2. `sitemap.xml` and `robots.txt` (including a `Mediapartners-Google` rule) are reachable at the root
  3. Google Search Console ownership of `luciel.dev` is verified (DNS or HTML file method)
  4. Each blog post has a unique meta description, canonical URL, and Article structured data (schema.org)
  5. A representative blog page passes Core Web Vitals — no JS hydration blocking the largest contentful paint (Astro zero-JS output)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: First Tool Pilot (rtk) + Pattern Documentation
**Goal**: A real, working tool runs at `rtk.luciel.dev` with its own Let's Encrypt cert and content page, and the reproducible "add a new subdomain" path is documented from the actual steps taken.
**Mode**: mvp
**Depends on**: Phase 3
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, TOOL-07, DOCS-01, DOCS-02
**Research flag**: The specific rtk tool domain (token optimization use case) needs a spike during planning — existing tools, UX shape, and whether a FastAPI backend is even required or the tool is pure-frontend compute.
**Success Criteria** (what must be TRUE):
  1. `rtk.luciel.dev` loads over HTTPS with its own valid Let's Encrypt certificate (separate from root)
  2. A user can complete a real task end-to-end and get a correct, meaningful result — not a stub or placeholder
  3. `rtk.luciel.dev` has a content page (600+ words) explaining the problem the tool solves, alongside the interactive widget
  4. `docs/adding-a-new-app.md` captures the actual commands and files used to build rtk — a second subdomain can be added by following it without reinventing the process
  5. `.env.example` is updated with any rtk-required variables (or confirmed unchanged if rtk needs none)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure + Landing Scaffold | 0/2 | In progress | - |
| 2. Content Hub | 0/0 | Not started | - |
| 3. Legal + AdSense Readiness | 0/0 | Not started | - |
| 4. First Tool Pilot (rtk) + Pattern Documentation | 0/0 | Not started | - |