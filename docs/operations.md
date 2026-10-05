# Operations

Single Oracle ARM VPS, Docker Compose + Traefik. Everything below runs on the VPS in `DEPLOY_PATH`.

## How a deploy works

`.github/workflows/release.yml` on push to `main`:

1. Builds arm64 images natively (`ubuntu-24.04-arm`) for the apps that changed only. Each app's
   checks run first (tours-api `pytest`, tours-web `test`; landing/lemon have none), the image is
   pushed as `sha-<7>`, scanned with Trivy (fixable CRITICAL fails the run) and only then tagged
   `latest`. Apps that did not change get `sha-<7>` copied from their `latest` (no rebuild).
2. SSHs to the VPS, `git reset --hard origin/main`, regenerates `.env` from GitHub secrets,
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

Set these GitHub secrets (any S3-compatible bucket: Cloudflare R2, OCI Object Storage):
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
