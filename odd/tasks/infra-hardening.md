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
- [ ] T1 — Security (Phase 1): docker socket proxy, `tours-internal` network,
      container hardening (no-new-privileges, cap_drop, mem limits), Traefik
      security headers + rate limit middleware, required secrets (`:?`).
      Route: delegated (writer trigger: compose + traefik + dynamic config).
- [ ] T2 — Reliability (Phase 2): healthchecks + depends_on, deploy by sha
      tag, post-deploy smoke test with automatic rollback, Litestream backup
      sidecar (opt-in profile), full-stack deploy that also applies Traefik changes.
      Route: delegated (compose + workflow + scripts).
- [ ] T3 — Deploy speed (Phase 3): changed-apps-only matrix, native ARM
      runners (repo is PUBLIC), pnpm cache mounts, pinned base images,
      Dependabot, CI lint/test gate, Trivy scan, actions pinned.
      Route: delegated (workflow + Dockerfiles).

## Acceptance criteria
- `docker compose config` passes with a sample env.
- tours-api not attached to `traefik-public`.
- Traefik has no direct docker.sock mount.
- CI builds only changed apps natively on arm64 and deploys a pinned sha.

## Manual steps for the user (cannot be automated)
- (filled in as tasks complete)

## Progress / evidence
- Branch: `chore/infra-hardening`

## Next step
T1.
