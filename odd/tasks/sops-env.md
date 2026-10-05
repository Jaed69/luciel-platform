# Feature: sops-env

## Objective
Manage environment configuration as SOPS+age encrypted files in git, so adding or
changing a production variable means editing one file — no workflow edits, no
per-variable GitHub secrets — and local development uses separate dev values.

## Problem
Adding a variable required 4 edits (.env.example, `gh secret set`, workflow
`env:`/`envs:`, deploy heredoc) and production values were unreadable.

## Scope (authorized)
- `.sops.yaml` with the user's age public key
  `age16glph2hfw7py0250wn9hvs37xwsqwgw4uardl0w2ksxwy9tm7y8q8yse78`.
- `env/production.env` (SOPS-encrypted, committed) with placeholder values the
  user fills in via `sops edit` (agent has no access to real prod values).
- `env/development.env` (plain, committed, dummy dev-only values).
- Deploy job: decrypt on runner with single `SOPS_AGE_KEY` secret, ship to VPS,
  refuse to deploy placeholders / missing required keys.
- Docs update.

Stacked on `chore/infra-hardening` (branch `chore/sops-env`).

## Constraints
- Never commit the private key or decrypted prod values.
- Decrypted values must not be printed in CI logs.
- Keep VPS_HOST / VPS_USER / VPS_SSH_KEY / DEPLOY_PATH as GitHub secrets (needed
  before anything reaches the VPS).

## TDD
No unit test runner for infra config. Checks: sops encrypt/decrypt round trip,
actionlint, `bash -n` on deploy script, `docker compose --env-file env/development.env config -q`.

## Tasks
- [x] T1 — SOPS scaffolding + workflow decrypt/ship + guards + docs.
      Route: delegated (writer trigger: workflow + config + docs).

## Manual steps for the user
- Back up `%APPDATA%\sops\age\keys.txt` in a password manager (losing it = losing prod secrets).
- `gh secret set SOPS_AGE_KEY < %APPDATA%\sops\age\keys.txt`
- `sops edit env/production.env` and replace every placeholder with the real value.
- After the first successful deploy, delete obsolete per-variable GitHub secrets.

## Progress / evidence
- sops 3.13.3 + age 1.3.2 installed via winget; age key generated.
- T1 done: `.sops.yaml`, encrypted `env/production.env` (13 keys, 4 `__FILL_ME__`), `env/development.env`,
  `scripts/check-env.sh`, deploy decrypts with `SOPS_AGE_KEY` + masks + validates, docs updated.
  Parent checks: 17 `ENC[` lines, no `AGE-SECRET-KEY` in repo, check-env exit 1 with placeholders /
  exit 0 filled, actionlint exit 0. CI path (mask + GITHUB_ENV handoff) not yet run on a real runner.

## Next step
User manual steps above, then push / PR.
