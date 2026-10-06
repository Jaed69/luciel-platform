# Feature: github-portfolio

## Objective
Make the GitHub profile and the flagship projects read as a professional AI/software engineering
portfolio for CV and job applications.

## Problem
- Profile: no bio/website, hireable off; profile README has placeholder contact links
  (`linkedin.com/`, `tu_usuario`, `tuemail@example.com`), contradictory semester and a stale stack.
- 35 original public repos: ~5 with descriptions, 0 topics, 0 homepage links; duplicates and
  course-work names dilute the strong ones.
- luciel-platform (the flagship) has no root README; AGENTS.md still opens with "Empty scaffold".

## Scope (user-confirmed featured set, 2026-10-06)
luciel-platform, Traductor-Lenguaje-Senas-GRU, Smart-Trafic-v2.0, Med-Asistance, UPC-LLM-AWS,
NAO_PET, antlr-cpp-statistical-interpreter, Datafest. More projects may be added later.

## Constraints
- Artifacts in English (international AI market); no invented claims: every statement about a
  project must come from its code/README.
- Remote GitHub changes are public: READMEs for other repos go through PRs the user merges;
  archiving/privatizing repos is only proposed, never executed without explicit OK.
- No personal contact data is published unless the user provides it.
- TDD: not applicable (documentation only; no behavior change).

## Tasks
- [x] P1 — Root README for luciel-platform + fix stale AGENTS.md header
      (route: delegated writer; mapping needs 4+ files).
      Evidence: 23 relative links resolve; commands match package.json/docs; rollback, cap_drop,
      read_only claims spot-checked in release.yml/docker-compose.yml. Commit 46b27d9.
      Follow-ups found: apps/tours/README.md is stale (old secrets, QEMU, Py 3.13); Let's Encrypt
      email in traefik/traefik.yml and Supabase URL/anon key in apps/lemon are committed (review).
- [x] P2 — Analyze the 7 featured repos; draft README improvements, description, topics
      (route: 2 delegated read-only analysts, drafts to scratchpad repos-a/drafts, repos-b/drafts).
      Verdicts: UPC-LLM-AWS strong (license "Uso interno UPC" — confirm publishable);
      Datafest strong methodology but 9/10 commits by nakato156 (confirm user's role);
      Smart-Trafic-v2.0, Traductor-GRU, NAO_PET, antlr ok (no measured results / no demo media);
      Med-Asistance weak (Phase 0 scaffold, 2 commits by "Claude") -> drop from featured for now.
      Privacy: student codes in Smart-traffic notebook and Fisher_All README; antlr claims MIT
      without LICENSE and unsupported metrics ("95%+ coverage"); NAO_PET .pt weights in history.
- [x] P3 — Apply featured-repo READMEs via PRs; set descriptions/topics/homepage (remote).
      Featured set now 6 (Med-Asistance dropped). Route: delegated writer opening PRs.
      PRs (#1 each, antlr #2): Traductor-Lenguaje-Senas-GRU, Smart-Trafic-v2.0, UPC-LLM-AWS,
      NAO_PET, antlr-cpp-statistical-interpreter, Datafest. Spanish originals kept as README.es.md.
      Descriptions + topics set on all 6; no homepage (no live demos). Unverifiable claims removed
      (metrics, MIT without LICENSE, coverage). Merge pending (user).
- [x] P4 — Rewrite profile README (repo Jaed69/Jaed69) + profile bio/website (remote).
      Contact source: user's CV (2026-10-06): email jhamil.pcardenas@luciel.dev; phone NOT
      published; LinkedIn URL not provided. Bio/website: gh token lacks `user` scope ->
      user sets them manually in GitHub settings.
      Profile README PR: Jaed69/Jaed69#1 (reviewed by parent: CV facts only, no phone/LinkedIn).
      Merged. User decision: UPC-LLM-AWS -> private (institutional); profile row unlinked in
      Jaed69/Jaed69#2. Bio/URL/hireable: user sets manually (gh token lacks `user` scope).
- [x] P5 — Curation (user-approved 2026-10-06). Archived: Smart-traffic (superseded by v2.0),
      ContSmart (2-commit template; ConSmart is the real one). Private: Trabajo_Final, Se-ales,
      ING-SOF-2024-2, War-Tragedy, Modspack, Practica_Angular, Final_Proyect_IA, Salvacion,
      ABET-UPC (institutional). Verified via gh api. Pins (UI-only) set by user: luciel-platform,
      Datafest, Smart-Trafic-v2.0, NAO_PET, Traductor-Lenguaje-Senas-GRU, antlr interpreter.

## Checks
- Every link in each README resolves (live demos, repo paths).
- Claims cross-checked against the source repo.

## Next step
Done. Follow-ups (not in scope): 19 Dependabot alerts on luciel-platform; measured results
(accuracy/metrics, demo media) for featured AI repos; projects page on luciel.dev (Content Hub).
