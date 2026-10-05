# Operations

Single Oracle ARM VPS, Docker Compose + Traefik. Everything below runs on the VPS in `DEPLOY_PATH`.

## How a deploy works

`.github/workflows/release.yml` on push to `main`:

1. Builds arm64 images natively (`ubuntu-24.04-arm`) for the apps that changed only. Each app's
   checks run first (tours-api `pytest`, tours-web `test`; landing/lemon have none), the image is
   pushed as `sha-<7>`, scanned with Trivy (fixable CRITICAL fails the run) and only then tagged
   `latest`. Apps that did not change get `sha-<7>` copied from their `latest` (no rebuild).
2. Decrypts `env/production.env` on the runner (SOPS, validated: no placeholders, no missing required
   vars), SSHs to the VPS, `git reset --hard origin/main`, regenerates `.env` from it,
   then `docker compose pull` + `up -d --remove-orphans --wait` for the whole stack
   (Traefik, docker-socket-proxy, apps). `.env` switches to `IMAGE_TAG=sha-<7>` only after the pull.
3. Runs `scripts/verify-prod.sh` (LE cert + HTTPS 2xx/3xx on every host).
4. If step 2 or 3 fails, it restores the previous `IMAGE_TAG` **and** the previous git checkout
   (recreating Traefik if its static config differs), brings the stack back up and fails the run.
   A failed `pull` aborts before anything is touched (`.env` and the checkout stay as they were).
   The very first deploy on a fresh VPS has no previous tag, so nothing to roll back to.

`traefik/traefik.yml` is static config: the deploy recreates Traefik when it changed.
Files in `traefik/dynamic/` hot-reload.

## Manual rollback

```sh
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-<previous7>/' .env
docker compose up -d --remove-orphans --wait   # add --profile backup if backups are on
```

Find tags with `docker images | grep luciel-platform`. The next CI deploy overwrites
`.env`, so revert or fix `main` before it runs.

## Backups (Litestream, opt-in)

Set these in `env/production.env` (any S3-compatible bucket: Cloudflare R2, OCI Object Storage):
`LITESTREAM_BUCKET`, `LITESTREAM_ENDPOINT`, `LITESTREAM_REGION` (`auto` for R2),
`LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY`.
The deploy enables the `backup` profile only when `LITESTREAM_ACCESS_KEY_ID` is non-empty.
Check: `docker logs tours-backup`.

## Restore from backup

```sh
docker compose --profile backup stop tours-web tours-api tours-backup
docker run --rm --env-file .env -v tours-db-data:/data \
  -v "$PWD/apps/tours/litestream:/etc/litestream:ro" --entrypoint sh \
  litestream/litestream:0.5.17 -c \
  'rm -f /data/tours.db /data/tours.db-wal /data/tours.db-shm && litestream restore -config /etc/litestream/litestream.yml /data/tours.db'
docker compose --profile backup up -d --wait
```

## Monitoring

Nothing here alerts on downtime. Point an external uptime monitor (UptimeRobot,
Better Stack, ...) at each public host: `luciel.dev`, `lemon.luciel.dev`, `tours.luciel.dev`.

## Configuration & secrets

App configuration lives in `env/production.env`, encrypted with [SOPS](https://github.com/getsops/sops)
+ [age](https://github.com/FiloSottile/age) and committed. Only these stay as GitHub secrets:
`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DEPLOY_PATH` and `SOPS_AGE_KEY` (the age private key).
The deploy decrypts the file on the runner, masks every value, and refuses to deploy while any
value is `__FILL_ME__` or a variable required by `docker-compose.yml` (`${VAR:?...}`) is empty
(`scripts/check-env.sh`). `IMAGE_TAG` is not in the file: the deploy computes it.

- **Edit production:** `sops edit env/production.env`, commit, push to `main` (config-only changes
  deploy without rebuilding images). Write values verbatim, no quotes; the bcrypt hash in
  `TRAEFIK_DASHBOARD_PASS_HASH` keeps its `$` signs.
- **Add a variable:** add the line with `sops edit env/production.env` and reference it in
  `docker-compose.yml`. No workflow change.
- **Local dev:** `docker compose --env-file env/development.env up -d`. It holds dummy values only.
  Personal overrides go in `env/<name>.local.env` (gitignored), passed as a later `--env-file`.
- **Key backup:** the age private key is `%APPDATA%\sops\age\keys.txt` (Windows) or
  `~/.config/sops/age/keys.txt`. Keep a copy in a password manager. Losing it means losing
  every production secret. Never commit it.
- **Rotate the key:** generate a new key, put its public key in `.sops.yaml` (`age:`), run
  `sops updatekeys env/production.env`, update the `SOPS_AGE_KEY` GitHub secret, then retire the old key.

### One-time migration from per-variable secrets

1. `gh secret set SOPS_AGE_KEY < path/to/keys.txt`
2. `sops edit env/production.env`: replace every `__FILL_ME__` with the real value (copy them from
   the VPS `.env`), commit and push.
3. After the first successful deploy, delete the obsolete GitHub secrets: `NEXTAUTH_SECRET`,
   `NEXTAUTH_URL`, `JWT_ALGORITHM`, `ADMIN_INITIAL_PASSWORD`, `TRAEFIK_DASHBOARD_USER`,
   `TRAEFIK_DASHBOARD_PASS_HASH`, `GHCR_OWNER`, `GHCR_PAT`, `LITESTREAM_*`.
