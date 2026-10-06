# Feature: major-deps-upgrade

## Objective
Take the major dependency upgrades Dependabot proposed, deliberately and verified,
then restrict Dependabot to patch/minor (security updates keep flowing).

## Decisions
- Node target is **26** (LTS on 2026-10-28; Node 24 leaves active support on
  2026-10-20, source: endoflife.date). Not 24.
- `@types/node` follows the runtime major (26).
- Python 3.14 + SQLAlchemy 2.1 only after the image installs from `uv.lock`
  (before, the image resolved the newest versions allowed by pyproject ranges,
  so production could run versions no test ran).
- One PR per step; each verified with tests + image build + Trivy before merge.

## Tasks
- [x] S1 — tours-api image installs exact versions from `uv.lock` (hash-verified).
      Evidence: 25/25 lock packages match `pip freeze` in the image (colorama is
      Windows-only), `/health` 200. Commit dd25bac. Review assess: medium, under_budget.
- [x] S2 — Node 26 for landing/lemon/tours-web images + `@types/node` 26.
      Evidence: PR #23 (e79093d, 334ca1a). Images built + Trivy clean in run for 4eb587a;
      deployed by the #24 run (retagged, same content); all hosts 200.
      Note: #22/#23 runs failed on tours-api Trivy (anyio CVE-2026-63374), fixed by PR #24
      (anyio 4.15.1); deploy was skipped, production untouched until #24.
- [x] S3 — Python 3.14 + SQLAlchemy `<2.2` (tours-api, 148 tests).
      Python 3.14.7-slim image, `.python-version` 3.14 (CI `uv run` tests on 3.14),
      `requires-python >=3.14`, `sqlalchemy[asyncio]>=2.1,<2.2` -> 2.1.3. Supersedes #8, #14.
      Evidence: 148 passed on 3.14.6 locally; image 3.14.7 / SQLAlchemy 2.1.3 / greenlet 3.5.3,
      Trivy CRITICAL (fixed) exit 0, container healthy + `/health` 200.
- [ ] S4 — Test tooling: vitest 5, jsdom 30, @testing-library/jest-dom 7.
- [ ] S5 — Dependabot ignores semver-major; close superseded major PRs
      (#8, #10-#17).

## Next step
S4 (test tooling majors).
