# Feature: landing-i18n

## Objective
Offer luciel.dev in English and Spanish. The owner lives in Peru and works with local clients.

## Scope (user-confirmed, 2026-10-06)
- English stays at the root (current URLs unchanged); Spanish lives under `/es/`
  (`/es/`, `/es/proyectos/`, `/es/privacidad/`, `/es/terminos/`, `/es/contacto/`).
- Every page exists in both languages: home, projects, 404, privacy, terms, contact.
- Language switcher in the HUD header that links to the equivalent page in the other language.
- `<html lang>`, `hreflang` alternates (en, es, x-default → en), per-locale canonical and
  `og:locale` (+ `og:locale:alternate`); sitemap includes both languages.
- Spanish copy: neutral professional Spanish (not regional slang), same facts as English;
  legal pages translated faithfully (Peru Law 29733 wording in Spanish).

## Constraints
- Astro built-in i18n routing (no new library); static output; client JS budget < 1 kB unchanged.
- One source of truth for project data and shared strings (typed dictionary per locale); no
  duplicated page markup where a shared component can take the locale.
- No invented claims in either language; no email/phone beyond the allowed contact address.
- Stacked on `fix/landing-review-followups` (PR #35) → #34.
- Tests: `pnpm --filter @luciel/landing test`; strict TDD (RED before GREEN).

## Tasks
- [x] I1 — i18n plumbing: Astro i18n config, locale dictionaries, Layout `lang`/hreflang/
      og:locale, header switcher, footer and nav localized; route map en↔es.
- [x] I2 — Spanish pages: home, projects, 404 (`/es/404` handling via nginx if needed).
- [x] I3 — Spanish legal pages: privacidad, terminos, contacto; sitemap covers both locales.

## Acceptance criteria
- Every English page has a Spanish twin and both link to each other via hreflang + switcher.
- `/es/...` pages have `lang="es"`, Spanish nav/footer, Spanish canonical.
- Existing English tests stay green; new tests cover both locales.

## Delivery
- Strategy: ask-on-risk; forecast ~600 authored lines (mostly translated copy). Stacked PR.

## Progress
- 2026-10-06: document created; branch `feat/landing-i18n` from `fix/landing-review-followups`.

- 2026-10-06: I1–I3 done (6f22d3d, 5faaf11, 23c3cc6). RED per task; GREEN 79/79. Parent re-ran tests
  and the real Docker image: all en/es routes 200; unknown /es/ path serves the Spanish 404
  (lang=es), unknown root path the English 404; hreflang en/es/x-default correct.
  Note: Spanish 404 builds to /es/404/index.html (Astro only special-cases root 404).

## Next step
User reviews Spanish copy (masculine job titles, usted in legal pages); then push + PR stacked on #35.
