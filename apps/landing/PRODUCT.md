# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences, weighted equally (confirmed 2026-10-23):

- **Technical recruiters and hiring teams for AI/ML roles**, deciding whether to interview Jhamil Peña. They skim fast, look for proof of shipped work, and judge craft from the site itself.
- **Businesses with manual, paper- or spreadsheet-bound processes**, mostly in Peru, deciding whether AI can take that work off their plate and whether this person can deliver it. Example: a Cusco tour agency and hotel that ran sales, commissions and settlements in Excel with VBA macros.

Both read the site in English (root) or Spanish (`/es/`).

## Product Purpose

luciel.dev is a productized portfolio: a personal content hub at the root plus real, working tools, each on its own subdomain, built in one public monorepo. Success is a recruiter or a client leaving convinced that Jhamil builds AI that works in the real world, and getting in touch.

## Positioning

Both claims together (confirmed):

1. **Paper becomes data.** The work turns documents and manual processes (paper, Excel, unstructured PDFs) into AI-backed systems running in production: the tours back-office and the faculty accreditation assistant.
2. **Real tools, not demos.** Every project is live and in use, with its open source as the proof.

Thesis in the site's own words: "Technology is worth nothing until it finds a use in the real world. I build AI that does."

## Operating Context

- Recruiters arrive from LinkedIn, CVs and shared links; clients from referrals and shared links. Open Graph cards per page exist for both (`public/og/`).
- The accreditation lab (`/lab/accreditation/`) lets visitors replay an audit of synthetic sample documents: read, convert, analyze, audit, report, with every finding pointing to its source page.
- The site has two views of every section, Surface and Depth (switch button or the D key): the result, and how it is built.

## Capabilities and Constraints

- Astro static site, zero-JS by default; client JS stays under 2 kB per page, and that figure is a public claim on the site.
- Self-hosted fonts only; nothing loaded from another domain.
- English is the default locale; Spanish lives under `/es/` with Spanish slugs. Facts must be identical across locales.
- The only personal contact data allowed in pages is `jhamil.pcardenas@luciel.dev`; a PII test enforces it (it flags long digit runs, including SVG path numbers).
- Google AdSense is planned but not active; content and technical compliance must stay ready for it.
- Planned, not built: an on-device "ask about my work" model, and chess against a model.

## Brand Commitments

- Name: luciel.dev; person: Jhamil Peña, AI / ML engineer, Computer Science at UPC, Lima, Peru.
- The Surface/Depth dimension switch is global across the site and stays.
- The "paper becomes data" concept stays; its current visual execution is open to replacement (owner judged it generic and AI-looking, 2026-10-23).

## Evidence on Hand

- Tours back-office: live, login-only, used daily by a real client. The client is not named. Screenshots may be shown only with fictitious data.
- Accreditation assistant: in development, faculty project built with a classmate under faculty supervision; prompt caching cut system-prompt tokens by about 90% on repeated queries.
- Accreditation lab: synthetic sample documents and generic criteria (`src/data/lab.ts`), not a real accreditation framework.
- Trajectory and roles in `src/i18n/en.ts` (Basílica Café, UPC, IEEE CIS / ComSoc UPC, Credicorp Capital internship).
- Source: github.com/Jaed69/luciel-platform.
- Absent, never fabricate: testimonials, client names or logos, metrics beyond those stated, pricing.

## Product Principles

1. Show the working thing before describing it.
2. Every claim is sourced and verifiable, in both languages.
3. The site itself is evidence of craft: weight, speed and detail are part of the pitch.
4. Speak to recruiters and clients in one voice: concrete problem, what was built, what changed.
