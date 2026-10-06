# Feature: infra-hardening

## Objective
Harden security, reliability and deploy speed of the monorepo platform layer
(compose, Traefik, CI/CD, Dockerfiles) without over-engineering.

## Problem
- Traefik mounts the raw Docker socket (`:ro` does not restrict the API).
- Single shared network: landing/lemon can reach tours-api.
- No security headers / rate limit; insecure default `change-me` password.
- No SQLite backup, no healthchecks, deploys `latest` with no smoke test/rollback.
- CI rebuilds all 4 apps on any change, under QEMU emulation, with no test gate.

## Scope (authorized)
Phases 1-3 of the improvement plan. Phase 4 (per-app compose `include:`,
templates, folder restructure) is a structural change and requires explicit
user confirmation per AGENTS.md — NOT in scope yet.

## Constraints
- Keep the existing mold (Dockerfile + Traefik labels); no new platforms.
- Do not push / merge — delivery is the user's decision.
- Secrets stay in GitHub secrets / `.env`, never committed.

## TDD
Strict TDD configured globally, but these are infra/config files with no unit
test runner. Checks used instead: `docker compose config`, local image
builds/runs where feasible, workflow YAML validation. Disclosed as a deviation.

## Tasks
- [x] T1 — Security (Phase 1): docker socket proxy, `tours-internal` network,
      container hardening (no-new-privileges, cap_drop, mem limits), Traefik
      security headers + rate limit middleware, required secrets (`:?`).
      Route: delegated (writer trigger: compose + traefik + dynamic config).
- [x] T2 — Reliability (Phase 2): healthchecks + depends_on, deploy by sha
      tag, post-deploy smoke test with automatic rollback, Litestream backup
      sidecar (opt-in profile), full-stack deploy that also applies Traefik changes.
      Route: delegated (compose + workflow + scripts).
- [x] T3 — Deploy speed (Phase 3): changed-apps-only matrix, native ARM
      runners (repo is PUBLIC), pnpm cache mounts, pinned base images,
      Dependabot, CI lint/test gate, Trivy scan, actions pinned.
      Route: delegated (workflow + Dockerfiles).

## Acceptance criteria
- `docker compose config` passes with a sample env.
- tours-api not attached to `traefik-public`.
- Traefik has no direct docker.sock mount.
- CI builds only changed apps natively on arm64 and deploys a pinned sha.

## Manual steps for the user (cannot be automated)
- `.env.example`: add `IMAGE_TAG` and `LITESTREAM_BUCKET/ENDPOINT/REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY`
  (file is permission-denied for the agent).
- Optional backups: create bucket (R2 or OCI) + the 5 `LITESTREAM_*` GitHub secrets.
- External uptime monitor pointing at each subdomain.
- First deploy has no previous IMAGE_TAG -> no automatic rollback that time.

## Progress / evidence
- Branch: `chore/infra-hardening`
- T1 done — commit 998bff3. `docker compose config -q` OK; missing ADMIN_INITIAL_PASSWORD fails loudly;
  socket-proxy denies POST/images (403); landing/tours-web/tours-api ran with read_only + cap_drop.
  traefik/socket-proxy keep caps (acme.json 600 needs DAC_OVERRIDE). Review assess: medium, under_budget.
- T2 done (partial: .env.example manual) — commit 96a43fb. compose config (default + backup profile) OK;
  greenlet RED (ImportError on fresh build) -> GREEN (/health 200), pytest 148 passed; deploy script bash -n OK.
  Review assess on T1+T2 slice: high (shell in workflow/scripts) -> review START -> consent requested.

- Review T1+T2 slice (lineage review-7015b91dca78f707): consent granted, 4 lenses, APPROVED, acknowledged
  (authority burned). Reviewed boundary -> 96a43fb. Advisory warnings on deploy pull/rollback folded into T3.
- T3 done — actionlint exit 0 (parent re-ran); deploy script bash -n OK; local builds OK
  (landing 53s cold, tours-api 20s, lemon 14s, tours-web 36s); compose config OK.
  tours-web lint gate is `continue-on-error` (2 pre-existing react-hooks errors on main);
  1 tours-web test is timezone-dependent locally (expected to pass on UTC runner — unverified).
  landing/lemon have no check scripts -> no CI gate.

- T3 commit c301de8. Review (lineage review-31e9bdad80310c88): consent granted, 4 lenses, APPROVED,
  acknowledged. Follow-up advisories: retag copies `latest`, which can be stale under concurrent
  pushes (fix: workflow-level concurrency or retag from last deployed sha); ops doc line 19 claim.

## Next step
Phase 4 (structural: per-app compose `include:`, templates, docs) awaits user confirmation.
Push / PR / merge are the user's decision.
