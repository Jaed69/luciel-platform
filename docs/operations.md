# Operations

Single Oracle ARM VPS, Docker Compose + Traefik. Everything below runs on the VPS in `DEPLOY_PATH`.

## How a deploy works

`.github/workflows/release.yml` on push to `main`:

1. Builds arm64 images and pushes them to GHCR tagged `sha-<7>` (and `latest`).
2. SSHs to the VPS, `git reset --hard origin/main`, regenerates `.env` from GitHub secrets
   with `IMAGE_TAG=sha-<7>`, then `docker compose pull` + `up -d --remove-orphans --wait`
   for the whole stack (Traefik, docker-socket-proxy, apps).
3. Runs `scripts/verify-prod.sh` (LE cert + HTTPS 2xx/3xx on every host).
4. If step 2 or 3 fails, it rewrites `IMAGE_TAG` to the previous value, brings the stack
   back up and fails the run. A failed `pull` aborts before anything is touched.

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
