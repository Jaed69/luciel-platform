# Feature: legal-adsense

## Objective
Phase 3 (Legal + AdSense readiness) for `luciel.dev`: everything the agent can do so the user can
apply to Google AdSense manually (the agent never applies).

## Problem
The site has no privacy policy, terms or contact page, no robots.txt, and loads fonts from Google
Fonts (visitor IPs reach Google). AdSense review requires the legal pages and crawler access.

## Scope (user-confirmed, 2026-10-06)
- In: Privacy (CONT-06), Terms (CONT-07), Contact (CONT-08), footer links on every page,
  `robots.txt` with `Mediapartners-Google` (SEOA-02), `/sitemap.xml` reachable at root (SEOA-01),
  self-hosted fonts (privacy + CWV, SEOA-05).
- Published contact email: `jhamil.pcardenas@luciel.dev` (user choice).
- Out / user-owned: `ads.txt` (needs the AdSense publisher ID, SEOA-03), Google Search Console
  verification via DNS TXT (SEOA-04), applying to AdSense.
- Deferred to the blog (C5): Article structured data and per-post meta (SEOA-06, SEOA-07).

## Constraints
- English copy. Legal text describes only what the site actually does (verified in repo):
  static Astro site on a single Oracle ARM VPS behind Traefik (access logs enabled), no analytics,
  no cookies today; AdSense (Google cookies) disclosed as planned. Peru Law 29733 referenced.
  Not legal advice; the user reviews the wording.
- The email may appear only on legal/contact pages and the footer; the no-PII test guard is
  narrowed to allow exactly this address and still reject phones and other emails.
- Stacked on `feat/content-hub` (PR #33). Tests: `pnpm --filter @luciel/landing test`.
- TDD: strict (RED before GREEN), node:test against dist.

## Tasks
- [ ] L1 — Self-host fonts (@fontsource packages), remove Google Fonts links; update tests.
- [ ] L2 — Privacy, Terms and Contact pages + footer links; narrow the PII guard.
- [ ] L3 — robots.txt with Mediapartners-Google + sitemap line; `/sitemap.xml` at root; 404
      excluded from the sitemap.

## Acceptance criteria
- `/privacy/`, `/terms/`, `/contact/` built, linked from every page's footer, with OG/canonical.
- No request to fonts.googleapis.com / fonts.gstatic.com in any built page.
- `dist/robots.txt` allows all, names `Mediapartners-Google`, points to the sitemap.
- `/sitemap.xml` resolves in dist (or via nginx) and lists every public page except 404.

## Delivery
- Strategy: ask-on-risk; forecast ~350 authored lines. PR stacked on feat/content-hub.

## Progress
- 2026-10-06: document created; branch `feat/legal-adsense` from `feat/content-hub` (71952fd).

## Next step
L1–L3 via one delegated writer.
