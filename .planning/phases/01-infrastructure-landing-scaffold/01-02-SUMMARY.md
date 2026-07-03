---
phase: 01-infrastructure-landing-scaffold
plan: 2
subsystem: infra
tags: [github-actions, ci-cd, ghcr, docker-buildx, qemu, arm64]

# Dependency graph
requires:
  - phase: 01-01
    provides: apps/landing/Dockerfile (root context, multi-stage) + docker-compose.yml landing image ref (ghcr.io/${GITHUB_USER}/luciel-platform-landing:latest)
provides:
  - GitHub Actions workflow that builds arm64 landing image and pushes to GHCR (sha-<short> + latest)
  - Closes deploy loop: push to main -> CI build -> GHCR -> VPS docker compose pull
  - Reproducible image pipeline (QEMU + buildx + GHA cache) — VPS only pulls, never builds
affects: [02-content-hub, 04-tool-pilot-rtk]

# Tech tracking
tech-stack:
  added: [actions/checkout@v4, docker/setup-qemu-action@v3, docker/setup-buildx-action@v3, docker/login-action@v3, docker/metadata-action@v5, docker/build-push-action@v6]
  patterns: [GHCR push via GITHUB_TOKEN (no separate PAT), arm64 cross-build via QEMU on x86 runners, BuildKit GHA cache (cache-from/cache-to type=gha,mode=max), sha+latest dual tag for rollback + compose pull]

key-files:
  created:
    - .github/workflows/release.yml
  modified: []

key-decisions:
  - "Build context = repo root (.), file = ./apps/landing/Dockerfile — Dockerfile uses root-relative COPY paths for pnpm workspace lockfile (confirmed by reading apps/landing/Dockerfile; matches 01-01 SUMMARY key-decision). Plan's CRITICAL note was correct."
  - "GHCR login uses secrets.GITHUB_TOKEN with permissions: packages:write — no separate PAT needed for push from Actions (T-01-08). VPS still uses GHCR_PAT for pull if package is private (USER-SETUP)."
  - "Trigger filters on apps/landing/** and the workflow file itself — avoids rebuilds for unrelated changes (e.g. .planning/, traefik/)."
  - "Tag scheme type=sha,prefix=sha- + type=raw,value=latest on default branch — sha tags give rollback capability, latest matches docker-compose.yml pull ref."

patterns-established:
  - "Pattern: per-app CI workflow = build arm64 image via QEMU + push to ghcr.io/<owner>/<repo>-<app>:latest. Future apps (rtk, graph, hackathons) reuse this skeleton by changing IMAGE_NAME suffix and paths filter."
  - "Pattern: GITHUB_TOKEN (auto-provisioned per-run, scoped packages:write) for GHCR push from Actions — no long-lived PAT in the CI path."

requirements-completed: [INFR-04]

coverage:
  - id: D1
    description: "GitHub Actions workflow (.github/workflows/release.yml) that builds the arm64 landing image via QEMU+buildx and pushes to GHCR with sha-<short>+latest tags, GHA cache, GITHUB_TOKEN auth, triggered on push to main when apps/landing/** or the workflow file changes"
    requirement: INFR-04
    verification:
      - kind: other
        ref: "test -f .github/workflows/release.yml && grep setup-qemu-action && grep linux/arm64 && grep ghcr.io && grep build-push-action → WORKFLOW_VALID; python3 yaml.safe_load → YAML_VALID"
        status: pass
    human_judgment: true
    rationale: "Workflow file is structurally valid and matches all plan criteria, but the arm64 build has not executed against GHCR (no push to main with apps/landing/** change since commit), and the image does not yet exist on GHCR. INFR-04's true acceptance is the live LE cert on https://luciel.dev — that requires the user's VPS deploy (bootstrap-host.sh + docker compose up -d) which this workflow enables but does not perform. Deploy gate is user-tracked per 01-USER-SETUP.md."

# Metrics
duration: 1min
completed: 2026-07-03
status: complete
---

# Phase 01 Plan 02: GitHub Actions arm64 CI/CD → GHCR Summary

**`.github/workflows/release.yml` builds the arm64 landing image via QEMU+buildx on x86 runners and pushes to GHCR with sha-<short>+latest tags using GITHUB_TOKEN — closes the deploy loop so `docker compose up -d` pulls a real image.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-07-03T06:53:59Z
- **Completed:** 2026-07-03T06:54:45Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `.github/workflows/release.yml` created — single `build-and-push` job, runs-on `ubuntu-latest`, permissions `contents: read` + `packages: write`.
- QEMU (`docker/setup-qemu-action@v3`) + Buildx (`docker/setup-buildx-action@v3`) emulate arm64 on x86 runners — VPS target is Oracle A1 aarch64 (D-06), GitHub runners are x86_64 only.
- GHCR login via `secrets.GITHUB_TOKEN` (T-01-08 mitigation: scoped token, no separate PAT for the CI push).
- `docker/metadata-action@v5` emits `sha-<short>` + `latest` tags on the default branch — `latest` matches `docker-compose.yml` landing service `image:` ref; `sha-*` provides rollback.
- `docker/build-push-action@v6` with `context: .` (repo root) + `file: ./apps/landing/Dockerfile` — matches the Dockerfile's root-relative COPY paths (pnpm workspace needs the root lockfile, per 01-01 SUMMARY key-decision). `platforms: linux/arm64`, `push: true`, GHA cache (`cache-from: type=gha`, `cache-to: type=gha,mode=max`).
- Trigger: push to `main` with `paths: ['apps/landing/**', '.github/workflows/release.yml']` — no rebuild on unrelated changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: GitHub Actions arm64 build → GHCR workflow** — `26b8884` (feat)

**Plan metadata:** `<pending final commit>` (docs: complete plan)

## Files Created/Modified

- `.github/workflows/release.yml` — arm64 CI pipeline. QEMU+buildx setup, GHCR login via GITHUB_TOKEN, metadata-action for sha+latest tags, build-push-action with root context + app Dockerfile + GHA cache. Trigger: push to main on apps/landing/** or workflow file.

## Decisions Made

- **Build context confirmed as repo root:** Read `apps/landing/Dockerfile` before writing the workflow — it `COPY package.json pnpm-lock.yaml ./` and `COPY apps/landing/package.json apps/landing/` from the root. Set `context: .` + `file: ./apps/landing/Dockerfile`. The plan's CRITICAL note was correct; no adjustment needed.
- **GITHUB_TOKEN for push (not PAT):** `permissions: packages: write` on the job gives the auto-provisioned `GITHUB_TOKEN` write access to GHCR. No separate PAT in the CI path. The `GHCR_PAT` in `.env.example` is only for the VPS pull (if the GHCR package stays private) — orthogonal to CI.
- **Tag scheme mirrored docker-compose.yml:** `type=sha,prefix=sha-` gives `sha-26b8884` (rollback ref); `type=raw,value=latest,enable={{is_default_branch}}` gives `:latest` (what `docker-compose.yml` pulls). Aligned with D-10 (`image:` not `build:`).

## Deviations from Plan

None - plan executed exactly as written. The plan's CRITICAL note anticipated possible Dockerfile-context adjustment; verifying the Dockerfile confirmed the root context was correct, so no adjustment was required.

## Issues Encountered

None.

## User Setup Required

No new USER-SETUP entries — this plan only adds the CI workflow. The deploy gate remains as documented in [01-USER-SETUP.md](./01-USER-SETUP.md):

- Push to `main` with a change under `apps/landing/**` (or this workflow file) to trigger the first build. The workflow does not run on the commit that adds it alone (path filter matches, but the trigger only fires on the *next* qualifying push to main).
- After CI publishes, set the GHCR package visibility to public (recommended) so the VPS can pull without `GHCR_PAT`. Or keep private and use `GHCR_PAT` + `bootstrap-host.sh`'s `docker login` step.
- INFR-04 live-cert verification (`scripts/verify-prod.sh` after LE staging→prod cutover) still depends on the VPS deploy — this plan enables it; the user executes it.

## Next Phase Readiness

- **Phase 1 complete.** Walking skeleton is fully wired: scaffold (01-01) + CI pipeline (01-02). Once the user pushes an `apps/landing/**` change to `main`, GHCR will receive the arm64 image and `docker compose up -d` on the bootstrap VPS pulls it.
- **Deploy gate (user-tracked):** Cloudflare DNS (`@` + `*` A → VPS), `.env` filled, `bootstrap-host.sh` run, `docker compose up -d`, LE staging→prod flip, `scripts/verify-staging.sh` + `scripts/verify-prod.sh` + `curl -I https://luciel.dev`. See 01-USER-SETUP.md.
- **Ready for Phase 2** (Content Hub). The landing image pipeline is now self-perpetuating — Phase 2 just edits `apps/landing/src/*` and pushes; CI rebuilds automatically.
- **Pattern reuse:** Future per-app workflows (rtk in Phase 4) follow this skeleton — change `IMAGE_NAME` suffix, paths filter, and Dockerfile path.

## Self-Check: PASSED

- Created file exists: `[ -f .github/workflows/release.yml ]` ✓
- Task commit exists in `git log`: `26b8884` ✓
- Plan-level verify re-run: `test -f` ✓, `grep setup-qemu-action` ✓, `grep linux/arm64` ✓, `grep ghcr.io` ✓, `grep build-push-action` ✓ → `WORKFLOW_VALID`; `python3 -c "import yaml; yaml.safe_load(...)"` → `YAML_VALID`.
- Image name alignment: workflow `IMAGE_NAME = ${{ github.repository_owner }}/luciel-platform-landing` ↔ docker-compose.yml `image: ghcr.io/${GITHUB_USER}/luciel-platform-landing:latest` ✓ (repository_owner == GITHUB_USER env).
- Build context alignment: workflow `context: .` + `file: ./apps/landing/Dockerfile` ↔ Dockerfile root-relative COPYs ✓.

---
*Phase: 01-infrastructure-landing-scaffold*
*Completed: 2026-07-03*