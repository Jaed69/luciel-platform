---
phase: 1
slug: infrastructure-landing-scaffold
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell scripts + curl + openssl (no test framework needed for infra validation) |
| **Config file** | N/A — scripts are standalone |
| **Quick run command** | `bash scripts/verify-staging.sh` or `bash scripts/verify-prod.sh` |
| **Full suite command** | Run all 5 success criteria checks sequentially |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bash scripts/verify-staging.sh` (or `verify-prod.sh` depending on LE mode)
- **After every plan wave:** Run all 5 SC checks
- **Before `/gsd-verify-work`:** All 5 SC checks must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INFR-01 | — | HTTP→HTTPS redirect | smoke | `curl -I http://luciel.dev` → 301 to https | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | INFR-02 | — | docker-compose.yml valid | smoke | `docker compose config` → valid YAML | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | INFR-03 | — | Wildcard DNS resolves | smoke | `dig +short test123.luciel.dev` → VPS IP | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | INFR-04 | T-1-04 | LE cert valid (staging then prod) | integration | `scripts/verify-staging.sh` then `scripts/verify-prod.sh` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | INFR-05 | — | .env.example complete | unit | `grep -c '^[A-Z]' .env.example` → ≥5 variables | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | INFR-06 | T-1-06 | traefik.yml valid + acme.json gitignored | unit | `traefik validate --configfile /etc/traefik/traefik.yml` + `git check-ignore traefik/letsencrypt/acme.json` | ❌ W0 | ⬜ pending |
| 01-01-07 | 01 | 1 | CONT-01 | — | apps/landing serves luciel.dev | integration | `curl -I https://luciel.dev` → 200 + LE cert | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-staging.sh` — covers SC-1 staging mode
- [ ] `scripts/verify-prod.sh` — covers SC-1 prod mode
- [ ] `scripts/bootstrap-host.sh` — covers SC-4 host prep
- [ ] `.env.example` — covers INFR-05
- [ ] `traefik/traefik.yml` — covers INFR-06
- [ ] `docker-compose.yml` — covers INFR-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser trust of LE prod cert | SC-1 | Requires real browser + real DNS + real LE prod cert | Open https://luciel.dev in browser, verify no cert warning, padlock icon present |
| Traefik dashboard UI | SC-5 | Requires running stack + real credentials | Open https://traefik.luciel.dev/dashboard/ in browser, login with credentials from .env |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
