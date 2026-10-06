# Feature: content-hub

## Objective
Turn `luciel.dev` (apps/landing) from an "under construction" page into the Phase 2 content hub,
starting with the shared site shell and the Projects page (CONT-05, CONT-10, CONT-12).

## Problem
The landing is a single placeholder page: no header/footer navigation, no Open Graph tags, no
Projects page, no 404, no blog content. Phase 3 (legal pages + AdSense) depends on this phase.

## Scope (user-confirmed, 2026-10-06)
- Projects page lists only what lives in this monorepo: `tours` (live, login-only back-office) and
  the planned tools from `.planning/PROJECT.md` (rtk, graph, hackathons) as "planned".
- `lemon` is excluded for now (personal memory book, `noindex`); easy to add later.
- External projects (traffic simulator, AGRODROID, RAG, ABET) are out of the Projects page.

## Constraints
- Site copy in English (`<html lang="en">`); no invented claims: every statement about a project
  must come from README.md, apps/tours/STATUS.md or .planning docs.
- Design tokens from root `DESIGN.md` (already in `apps/landing/src/styles/tokens.css`).
- Navigation only links to pages that exist (no 404s, ROADMAP Phase 2 criterion 3).
- Static output, zero client JS by default (AdSense/SEO baseline).
- TDD: strict (global CLAUDE.md). Landing has no test runner; checks use `node:test` (no new
  dependency) against the built `dist/`: `pnpm --filter @luciel/landing build` then
  `node --test "apps/landing/tests/*.test.mjs"` (quoted glob; a bare directory fails on Node 24).
  RED must be observed before implementation.

## Tasks
- [x] C1 — Site shell: Layout with per-page title/description/canonical/Open Graph/Twitter tags and
      default OG image; global Header + Footer navigation; dist checks for OG tags on every page
      and internal links that resolve. (route: delegated writer; 2+ non-trivial files)
      Evidence: RED 5 failing (canonical, header/nav, projects missing); GREEN 4/4 site-shell.
      OG image visually checked. Commit af68518.
- [x] C2 — Projects page `/projects/`: typed project data module + page + header/footer link.
      (route: delegated writer, same thread as C1)
      Evidence: RED (dist/projects/index.html missing); GREEN 7/7; parent re-ran build + tests
      (7/7) and checked every claim in src/data/projects.ts against README/STATUS/PROJECT.md.
      Commit 608b0e8.
- [x] R — Review follow-ups from C1–C2 reliability review (approved, acknowledged): og:image must
      exist in dist, clear message when dist/ is missing, projects badge text + tours links.
      Evidence: RED via temporary bogus og:image path; GREEN. Commit cbd282b.
- [x] C3 — Home page: personal intro, project philosophy, tool directory (CONT-02).
      Intro sourced only from the user's CV (user-provided 2026-10-06); no phone, email,
      references, metrics or class rank. Philosophy from .planning/PROJECT.md; directory reuses
      src/data/projects.ts. Evidence: RED 5 failing; GREEN 16/16. Commit f15a5e1.
- [x] C4 — Custom 404 page (CONT-09). nginx already had `error_page 404 /404.html;` (now tested).
      Evidence: RED (dist/404.html missing); GREEN. Commit 088ec13.
      Parent re-ran build + tests (16/16) and grepped dist/src for personal data (none).
- [x] C6 — Visual redesign v1 (user-approved concept 2026-10-06, modelled on ashwingupta.dev):
      dark autumn tokens + Bricolage Grotesque / IBM Plex Sans / JetBrains Mono; HUD header with
      Lima clock, coordinates and scroll depth; home as hero, readouts, case studies
      (Context/Approach/System/Outcome: tours + accreditation assistant), scroll-lit trajectory,
      stack; projects and 404 restyled. CSS-only motion behind @supports + reduced-motion, content
      visible at rest; client JS budget < 1 kB (clock + depth). Also closes review notes: test for
      header aria-current, planned-card test fails when a card is missing, build-then-test script.
      Reference: https://claude.ai/artifact/RFJ2r6amQJYLdJ4xLspzHY (route: delegated writer).
      Evidence: RED per test group (mutations reverted); GREEN 29/29 via
      `pnpm --filter @luciel/landing test` (builds first). Contrast ≥ 4.5:1 for every text token on
      every surface (faint, rust, wine lightened). Headless Edge screenshots at desktop and 400px
      checked by parent; parent switched case facets to 2×2 and made #main focusable.
      Commits 27e1cde, 3ea4c3e, 5f4c757, 5808c7b, 69f9879 and the parent's polish commit.
      Also: projects data gained `access: 'login' | 'public'`; fragment links are verified.
- [ ] C5 — Blog: content collection + MDX + Shiki, list/detail pages, RSS (CONT-03/04/11).
      Needs the user's real articles; nothing is written on their behalf.

## Acceptance criteria (C1–C2)
- Every built HTML page has og:title, og:description, og:image, og:url and a canonical link.
- Every internal `href` in `dist/` resolves to a built file.
- `/projects/` lists tours (live) and rtk/graph/hackathons (planned) with text sourced from repo docs.
- `astro build` succeeds.

## Delivery
- Strategy: ask-on-risk. Forecast C1–C2: ~350 authored lines.
- Branch: `feat/content-hub` (from main 54c96f2).

## Progress
- 2026-10-06: feature document created; C1 and C2 done (af68518, 608b0e8); review approved.
- 2026-10-06: R, C3, C4 done (cbd282b, f15a5e1, 088ec13).

- 2026-10-06: intro split (a9738c0); design research (two rounds); C6 redesign done.

## Next step
C5 blog (needs the user's real articles), then push and PR for the branch.
