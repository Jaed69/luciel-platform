# Feature: deploy-followups

## Objective
Fix the non-blocking deploy-pipeline warnings raised by the approved reviews of
`chore/infra-hardening` and `chore/sops-env`.

## Scope (authorized by user: "soluciona los avisos pendientes")
- F1 — Deploy sha skew: VPS resets to `origin/main` but IMAGE_TAG comes from the
  triggering commit. Reset to the exact `github.sha` instead.
- F2 — Stale `latest` retag race: unchanged apps are retagged from `latest`, which
  can be stale or skip changes from dropped/concurrent runs. Decide per app by
  diffing the app's paths against the revision recorded in its current `latest`
  image (OCI label `org.opencontainers.image.revision`), and serialize workflow runs.
- F3 — Config rollback gap: rollback restores IMAGE_TAG + git checkout but `.env`
  content comes from the new commit. Keep `.env.prev` and restore it on rollback.
- F4 — First deploy has no rollback target: document clearly (one-time, inherent).
- F5 — `scripts/check-env.sh` has no automated test: add a small test run in CI.
- F6 — docs/operations.md inaccuracies (lines ~18-20) and readability nits.

Out of scope: tours-web lint errors, `.env.example` removal (needs user decision).

Stacked on `chore/sops-env` (branch `fix/deploy-followups`).

## TDD
No unit runner for workflow/infra. Checks: new check-env test script (RED/GREEN),
actionlint, `bash -n` on deploy script, local simulation of the per-app change logic.

## Tasks
- [x] T1 — F1..F6. Route: delegated (writer trigger: workflow + scripts + docs).

## Progress / evidence
- T1 done: exact-sha reset (F1); per-app build decision vs `latest` revision label via
  scripts/needs-build.sh + workflow-level concurrency, dorny/paths-filter removed (F2); `.env.prev`
  restore on rollback and pull failure (F3); first-deploy message + docs (F4); scripts/test-check-env.sh
  11 cases, RED vs broken copy then GREEN, runs in deploy job (F5); ops doc rewritten (F6).
  Parent checks: test-check-env exit 0, actionlint exit 0. Simulations of deploy + F2 logic by writer.

- Accumulated review (3 branches vs main, lineage review-3b2b603ad3e6bc2c): correction requested for
  pnpm `--offline` with a cold cache mount. Not reproducible: pnpm 11 ignores `npm_config_store_dir`
  and stores packages in the fetch layer (/root/.local/share/pnpm/store, 611M), so the cache mount is
  unused. Applied `--prefer-offline` (a0a97cc) -> validated, APPROVED, acknowledged.
- Open follow-ups: make pnpm use the cache mount (`--store-dir`), restore doc order in operations.md
  (do not delete DB before a successful restore), rollback profile read from new env, failed tag as
  next rollback target when there was no previous tag, needs-build.sh tests.

## Next step
Review + push (user authorized push of this follow-up).
