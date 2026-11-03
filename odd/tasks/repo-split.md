# Feature: repo-split

## Objective
Give every app its own repo while `luciel-platform` becomes the deployment (config) repo:
app repos build and push their image, then record the new tag in `env/tags.env` here; that
commit triggers the existing deploy. Branch `chore/repo-split-groundwork`. Delivery:
`ask-on-risk`. Checks: plain-bash script tests + YAML parse (no actionlint locally).

## Problem
`luciel-platform` does two jobs at once: it holds the code of 4 apps and it is the deploy
platform. The user wants independent repos per project without touching the Oracle VPS by
hand. `apruebo` already works this way, but it passes its tag through a
`repository_dispatch` payload, so the tag lives only in the VPS `.env` — git is not the
source of truth, and a superseded run loses the tag (see `release.yml` `on:` comment).

## Specs
- S1 — Each app lives in its own repo and owns its code, tests, Dockerfile and lockfile.
- S2 — A single reusable workflow holds the build contract (arm64 runner, pinned action
  SHAs, Trivy gate on fixable CRITICAL, `sha-<7>` tag, promote to `latest`). App repos pass
  inputs; they never copy the steps. Without this the split becomes 4 diverging copies of
  the same YAML.
- S3 — The deployed tag of every app is committed in `env/tags.env` in this repo, plain
  text. Rollback of one app = revert that commit. The deploy reads the file; no tag arrives
  by workflow payload.
- S4 — A tag is recorded only for a variable the deployment repo already declares; a
  malformed tag or variable name is refused and the file is left untouched (its values
  reach a remote shell).
- S5 — `docker-compose.yml` pins each app with its own `${<APP>_TAG:?}` — strict, so a
  missing tag fails the deploy instead of silently serving `latest`.
- S6 — Migration is one app per PR: the app leaves and its build is dropped from
  `release.yml` in the same change. Never an app with no build or with two builds.
- S7 — The deploy job, its smoke test and its rollback keep working unchanged throughout.
- S8 — `apps/tours/litestream/` and `apps/apruebo/litestream/` stay here: the backup
  sidecars bind-mount them, so they are platform config, not app code.

## Tasks
- [x] T1 — S2, S4. Reusable `build-and-release.yml` + `scripts/record-tag.sh` with
      `scripts/test-record-tag.sh`, wired into the deploy job's guard steps.
      Route: inline (small, understood, additive). RED observed (7 failures, script
      absent) then GREEN 21/21.
- [ ] T2 — S1, S3, S5, S6. Migrate `lemon`: new repo via `git subtree split`, its caller
      workflow, `env/tags.env` seeded with `LEMON_TAG`, compose points at it, lemon leaves
      the build matrix. Route: inline.
- [ ] T3 — S1, S3, S5, S6. Migrate `landing` (has `tests/`). Route: inline.
- [ ] T4 — S1, S3, S5, S6. Migrate `tours` (two images, `pytest` + `vitest`). Route: inline.
- [ ] T5 — S3, S6. Move `apruebo` off `repository_dispatch` onto `env/tags.env`; delete the
      dispatch path, `IMAGE_TAG`, the `changes`/`build`/`retag` jobs, `needs-build.sh` and
      the root pnpm files. Route: inline.
- [ ] T6 — Secret inventory table in `docs/operations.md`; update `README.md`, `AGENTS.md`.

## Manual steps for the user (cannot be automated)
- Create one fine-grained PAT per app repo, `contents: write` scoped to
  `Jaed69/luciel-platform` ONLY, and set it as `PLATFORM_DEPLOY_TOKEN` in that app repo.
  Fine-grained PATs cannot be created via API/CLI.
- Decide public or private per app repo. PUBLIC gets the free native arm64 runner
  (`ubuntu-24.04-arm`, the workflow default). PRIVATE has no free arm64 runner and must
  call the workflow with `runner: ubuntu-24.04` and `emulate: true` — a slower QEMU
  cross-build, which is exactly what `Jaed69/apruebo` already does today.
- Store each PAT in the password manager with its expiry noted.

## Image name change
In-repo apps publish as `ghcr.io/jaed69/luciel-platform-<app>`. From its own repo an app
publishes as `ghcr.io/jaed69/<app>` (as `apruebo` already does). Each migration PR updates
the compose `image:` accordingly; the old packages stay in place, untouched.

## Log
- L1 — User request (verbatim): "Acualemnte, manejo un servidro clud en oracle clud, Y subi
  pryecot desplegado ahi por github, que podria hacer para qye no este en un solo repor cada
  proyecto que desida desplegar ahi, para no tocar siempre la clud, pense en tener un repo
  con los datos unicos dedepliegue y que ahi se envieno o no se en generla como lo haria
  peudes invertigac omco se hace en el mundo profesisonal actuakemente, es lo que esta en
  luciel plataformas"
- L2 — Follow-up (verbatim): "Ya genial algo mas, en caso de qeu necesit entara al servidor,
  como ppdir aguarda mis contrase;as, ssh o clatrase;as de puclica privada, paar asi tener,
  en github o en otro servidor seguro ay qeu la compuradora no es buen lugar, , peudoc
  ambiasr de siste oeprativo como ahora, y deliniarse y eso no serib bueno, asi mismo como
  clases provas tipo .env, que me pasan, o de mas, pense en un repo rpivado con eso
  roganizado, o no se cuals eria la mejro forma de hacerlo" — answered in the plan's secrets
  annex; no code change in this feature beyond T6's secret inventory.
- L3 — 2026-11-02. Chosen pattern: app repo / config repo separation. Rejected keeping the
  tag in a dispatch payload (the current apruebo weakness): the tag is committed instead, so
  git is the source of truth and rollback is `git revert`.
- L4 — 2026-11-02. Sequencing decision: no transitional shim. `IMAGE_TAG` (in-repo apps) and
  the per-app `<APP>_TAG` variables coexist during the migration; `IMAGE_TAG` is deleted in
  T5 once the last app has left. Each app's PR is self-contained and deployable.
- L5 — 2026-11-02. Baseline before any change: in-repo apps run `sha-560374e` (HEAD, last
  successful push deploy); `apruebo` runs `sha-d09db04` (its last successful build, which
  dispatched the 2026-10-30T04:05:30Z deploy). These seed `env/tags.env` in T2-T5.
- L6 — 2026-11-02. T1 done. The tag rewrite lives in `scripts/record-tag.sh` rather than
  inline in the reusable workflow, so it is testable and the file format has one owner; the
  reusable workflow runs it out of the deployment-repo clone it already makes.
- L7 — 2026-11-02. Verified: `luciel-platform` is PUBLIC and builds on `ubuntu-24.04-arm`;
  `Jaed69/apruebo` is PRIVATE and builds on `ubuntu-24.04` with
  `docker/setup-qemu-action` because free native arm64 runners are public-repo only. So the
  reusable workflow cannot hardcode the runner: it takes `runner` + `emulate`, defaulting to
  the native arm64 path. This also makes T5 possible — private `apruebo` can call the same
  workflow instead of keeping its own copy of the build steps.
