# Phase 01: User Setup Required

**Generated:** 2026-07-03
**Updated:** 2026-07-04 (post-deploy — see "Real Deploy Findings" below)
**Phase:** 01-infrastructure-landing-scaffold
**Status:** Complete ✓ — scaffold live at https://luciel.dev with LE production cert

These items require human access to external dashboards/accounts. The agent automated everything else (code, config, scripts). The stack cannot go live until these are done.

## Environment Variables

Copy `.env.example` → `.env` on the VPS, then fill:

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [x] | ~~`ACME_EMAIL`~~ | **REMOVED** — ACME email + caServer now live in `traefik/traefik.yml` (see "Bug #4" below for why) | — |
| [x] | ~~`LE_CA_SERVER`~~ | **REMOVED** — same reason | — |
| [x] | ~~`LE_STAGING`~~ | **REMOVED** — staging/prod flip is a one-line edit in `traefik/traefik.yml` (`caServer` line) | — |
| [x] | `TRAEFIK_DASHBOARD_USER` | Choose a dashboard username (default `admin`) | `.env` |
| [x] | `TRAEFIK_DASHBOARD_PASS_HASH` | Run: `htpasswd -nbB <user> '<password>'` (or `openssl passwd -apr1 '<password>'`) — escape every `$` as `$$` (see "Bug #3" below) | `.env` |
| [x] | `GITHUB_USER` | Your GitHub username in **lowercase** (e.g. `jaed69`, not `Jaed69`) — see "Bug #2" below | `.env` |
| [x] | `GHCR_PAT` | Leave EMPTY if GHCR package is public (recommended). If private: GitHub → Settings → Developer settings → PAT (read:packages) | `.env` |

## Account Setup

None — no new accounts required (Cloudflare, GitHub, Let's Encrypt accounts assumed to exist).

## Dashboard Configuration

### Cloudflare (REQUIRED before `docker compose up` — HTTP-01 fails without it)

- [x] **Create DNS A record: `@` → VPS public IPv4**
  - Location: Cloudflare Dashboard → DNS → Records → Add record
  - Type: `A`, Name: `@`, IPv4: `<your VPS public IPv4>`, Proxy status: **DNS-only (grey-cloud, proxy OFF)**
- [x] **Create DNS A record: `*` → VPS public IPv4**
  - Location: Cloudflare Dashboard → DNS → Records → Add record
  - Type: `A`, Name: `*`, IPv4: `<your VPS public IPv4>`, Proxy status: **DNS-only (grey-cloud, proxy OFF)**
- [x] **Delete `www` CNAME if it has Proxied (orange-cloud) status**
  - The wildcard `*` A record already resolves `www` → VPS directly. A Proxied CNAME overrides the wildcard and intercepts the LE HTTP-01 challenge via Cloudflare's edge.
- [x] **Disable "Always Use HTTPS"** (or add exception for `/.well-known/acme-challenge/*`)
  - Location: Cloudflare Dashboard → SSL/TLS → Edge Certificates
  - Why: Cloudflare edge redirect can intercept the LE HTTP-01 challenge before it reaches Traefik. With grey-cloud this usually doesn't apply, but verify if issuance fails.

### Oracle Cloud Infrastructure (REQUIRED — VCN Security List blocks inbound by default)

- [x] **Add Ingress Rule for port 80 (HTTP)**
  - Location: OCI Console → Networking → Virtual Cloud Networks → <your VCN> → Security Lists → Default Security List → Add Ingress Rules
  - Source CIDR: `0.0.0.0/0`, IP Protocol: `TCP`, Destination Port Range: `80`, Description: `HTTP for Traefik HTTP-01 ACME challenge`
  - Without this, LE staging/prod servers get `Timeout during connect` and challenge fails. UFW on the VPS is NOT sufficient — OCI's network firewall drops packets before they reach the host.
- [x] **Add Ingress Rule for port 443 (HTTPS)**
  - Same location, Source CIDR: `0.0.0.0/0`, Protocol: `TCP`, Destination Port Range: `443`, Description: `HTTPS for Traefik TLS`
- [x] **Verify NSG if your instance uses Network Security Groups**
  - Some OCI instance wizards attach an NSG in addition to the Security List. Check Instance → Attached VNICs → VNIC → Network Security Groups — if any NSG is listed, add the same 80/443 ingress rules there too.

### GitHub (REQUIRED for VPS to pull the landing image)

- [x] **Set GHCR package visibility to public** (recommended — anonymous pull, no PAT needed on VPS)
  - Location: GitHub → Settings → Packages → `luciel-platform-landing` → Package settings → Visibility → Public
  - Skip if: You prefer private packages (then `GHCR_PAT` in `.env` is required)

## Verification

After completing setup + deploying on the VPS:

```bash
# On the VPS, from repo root:
cp .env.example .env
# edit .env with the values above (mind the $$ escaping and lowercase GITHUB_USER)
sudo bash scripts/bootstrap-host.sh
docker compose up -d

# Verify staging cert (uses staging caServer in traefik.yml):
bash scripts/verify-staging.sh
# Expected: "✓ Staging cert confirmed: issuer=...(STAGING)..."

# Flip staging → prod:
# 1. Edit traefik/traefik.yml — comment staging caServer, uncomment prod one
# 2. Commit + push
# 3. On VPS: git pull && rm traefik/letsencrypt/acme.json \
#            && touch traefik/letsencrypt/acme.json \
#            && chown 65532:65532 traefik/letsencrypt/acme.json \
#            && chmod 600 traefik/letsencrypt/acme.json \
#            && docker compose up -d --force-recreate traefik
# 4. Wait 60-120s for new cert issuance
bash scripts/verify-prod.sh
# Expected: "✓ Production LE cert confirmed: issuer=...(Let's Encrypt)..."

# Phase 1 success criteria:
curl -I https://luciel.dev        # HTTP/2 200, no -k needed
curl -I http://luciel.dev        # 308 -> https
curl -u admin:<password> https://traefik.luciel.dev/dashboard/  # 200
```

## Real Deploy Findings (2026-07-04)

Six pitfalls surfaced during the actual deploy that were not in the initial scaffold. Each is annotated with its fix so future redeploys / phase 2+ don't repeat the cycle.

### Bug #1 — Oracle Cloud VCN Security List blocks inbound 80/443 by default

**Symptom:** `curl: (28) Connection timed out` from outside the VPS, even though UFW allows 80/443 and Traefik listens on 0.0.0.0:80. LE challenge fails with `Timeout during connect (likely firewall problem)`.

**Cause:** Oracle Cloud A1 free tier creates a VCN with a default Security List that only opens SSH (port 22) for inbound. Inbound 80/443 are dropped at the network layer before the host ever sees the packet — UFW cannot help.

**Fix:** Add Ingress Rules for TCP 80 and 443 (source `0.0.0.0/0`) in OCI Console → Networking → VCN → Security Lists → Default Security List. Verify NSG rules too if your instance has one. See "Oracle Cloud Infrastructure" section above.

**Bug in scaffold** (ponytail-debt): `scripts/bootstrap-host.sh` only configures host UFW; it cannot touch OCI network firewall. Document this in README and add a pre-flight check that hits `http://<VPS-IP>/` from outside and fails fast with actionable guidance if OCI is blocking.

### Bug #2 — `GITHUB_USER` must be lowercase

**Symptom:** `docker compose pull landing` fails with:
```
failed to resolve source image: ghcr.io/Jaed69/luciel-platform-landing:latest:
invalid reference format: repository name (Jaed69/luciel-platform-landing)
must be lowercase
```

**Cause:** GitHub usernames are case-displayed (`Jaed69`), but Docker / GHCR normalize registry paths to **lowercase**. `docker-compose.yml` interpolates `${GITHUB_USER}` verbatim into the image ref — uppercase produces an invalid Docker reference.

**Fix:** `.env` must set `GITHUB_USER=jaed69` (lowercase). The CI workflow `release.yml` uses `${{ github.repository_owner }}` which GitHub returns lowercase automatically — only the VPS `.env` is at risk. `.env.example` now documents this on the `GITHUB_USER` line.

### Bug #3 — `$$` escaping in `.env` for bcrypt / apr1 password hashes

**Symptom:**
```
WARN[0000] The "CEG8vUnK" variable is not set. Defaulting to a blank string.
WARN[0000] The "gu0G8IHHAXYBFLBmTOMrU0" variable is not set. Defaulting to a blank string.
```

**Cause:** Docker Compose interpolates `$VARNAME` inside `.env` values. A bcrypt hash like `$2y$05$salt$hash` or apr1 hash like `$apr1$salt$hash` contains multiple `$` — Compose sees `$apr1`, `$salt`, `$hash` as variable references, substitutes them with empty strings, and the resulting hash is garbage. Single quotes `'...'` around the value do NOT help — Compose treats them as literal characters in the value.

**Fix:** Escape every `$` as `$$` in the `.env` value:
```
TRAEFIK_DASHBOARD_PASS_HASH=$$apr1$$CEG8vUnK$$gu0G8IHHAXYBFLBmTOMrU0
```
Compose will pass a single `$` to Traefik, and basicAuth will accept the hash. `.env.example` now documents this on the `TRAEFIK_DASHBOARD_PASS_HASH` line.

### Bug #4 — ACME resolver must live in `traefik.yml`, not in `docker-compose.yml` CLI args

**Symptom:** Traefik logs:
```
ERR Router uses a nonexistent certificate resolver
  certificateResolver=le routerName=landing@docker
  certificateResolver=le routerName=dashboard@docker
INF Starting provider *acme.ChallengeTLSALPN
  # but never *acme.ChallengeHTTP
```

**Cause:** Traefik v3 treats the three static-config sources (config file, CLI args, env vars) as **mutually exclusive**: it evaluates them in that order, uses the first it finds, and silently ignores the others. When `traefik.yml` is bind-mounted at `/etc/traefik/traefik.yml` (the default search path), Traefik loads the file and ignores the `command:` args in `docker-compose.yml` entirely — so the `le` resolver defined via CLI args was never registered, and routers referencing `certresolver=le` failed.

**Fix:** Move `certificatesResolvers.le` into `traefik/traefik.yml` structurally. The `email`, `caServer`, `storage`, and `httpChallenge.entryPoint` are all there. Email and caServer are not secrets — LE does not publish the contact email in production certificates. Staging → prod flip is a single-line edit in `traefik.yml` (comment one `caServer` line, uncomment the other). See commit `11ca005`.

### Bug #5 — `acme.json` ownership must be `65532:65532`, not `deploy:deploy`

**Symptom:** After `Register...` log, Traefik goes silent — no `Obtaining certificate`, no `certificate obtained`. Issue persists across `docker compose restart traefik`. `acme.json` size grows (28KB) but no cert is ever served from LE.

**Cause:** The Traefik Docker image default user is `65532:65532`. When you bind-mount `./traefik/letsencrypt/acme.json:/acme.json`, the host file's uid:gid is preserved inside the container. If you created `acme.json` as `deploy` (uid 1002 on the host), Traefik (running as 65532 in the container) cannot read or write it. Worse: stale failed-challenge state persisted in the file puts Traefik in exponential backoff — even after fixing ownership, Traefik waits hours before retrying.

**Fix:** Always reset `acme.json` cleanly when moving between staging/prod or starting fresh:
```bash
docker compose stop traefik
rm traefik/letsencrypt/acme.json
touch traefik/letsencrypt/acme.json
chown 65532:65532 traefik/letsencrypt/acme.json
chmod 600 traefik/letsencrypt/acme.json
docker compose up -d --force-recreate traefik
```
`bootstrap-host.sh` does this correctly at lines 38-42, but the file can be re-created manually outside the script — that's where it goes wrong.

**Bug in scaffold** (ponytail-debt): `bootstrap-host.sh` uses a relative path `traefik/letsencrypt/acme.json` which resolves from the script's CWD. If you run the script from outside the repo root, it creates `acme.json` in the wrong directory. Fix: resolve paths relative to `${BASH_SOURCE[0]}`.

### Bug #6 — Traefik needs explicit `loadbalancer.server.port` label for non-80 backends

**Symptom:** `curl -kI https://luciel.dev` returns `HTTP/2 502 Bad Gateway` even though the cert was correctly obtained. Logs show requests hitting Traefik and being forwarded to `http://172.18.0.2:80` but backend not responding (0ms response time — connection refused).

**Cause:** The Astro landing's Dockerfile uses nginx:alpine with `listen 8080` (non-privileged port, per `nginx.conf`) and `EXPOSE 8080`. Traefik's Docker provider, when no `loadbalancer.server.port` label is set, defaults to port `80` for the backend. Since nginx listens on 8080, not 80, Traefik's connection to the container on port 80 gets refused → 502.

**Fix:** Add this label to the `landing` service in `docker-compose.yml`:
```yaml
- "traefik.http.services.landing.loadbalancer.server.port=8080"
```
See commit `88257f7`.

## Deploy order (recommended for fresh VPS)

```
1. Cloudflare DNS (@, * A records → VPS IPv4, DNS-only)
2. Cloudflare disable "Always Use HTTPS"; delete Proxied www CNAME if any
3. Oracle Cloud OCI Security List: open inbound 80 + 443 (source 0.0.0.0/0)
4. On VPS as root:
   - useradd -m -s /bin/bash deploy && usermod -aG docker deploy
   - su - deploy && git clone <repo> ~/luciel-platform && cd ~/luciel-platform
   - cp .env.example .env && nano .env   # fill TRAEFIK_DASHBOARD_PASS_HASH ($$-escaped), GITHUB_USER (lowercase)
   - mkdir -p traefik/letsencrypt && touch traefik/letsencrypt/acme.json
   - chmod 600 traefik/letsencrypt/acme.json && chown 65532:65532 traefik/letsencrypt/acme.json
   - exit   # back to root
   - bash /home/deploy/luciel-platform/scripts/bootstrap-host.sh
   - su - deploy && cd ~/luciel-platform && docker compose up -d
5. Verify staging cert: openssl s_client -connect luciel.dev:443 -servername luciel.dev </dev/null 2>/dev/null | openssl x509 -noout -issuer
   # Expected: issuer with "(STAGING)" prefix
6. After staging green: edit traefik/traefik.yml (flip caServer), commit, push, VPS git pull, reset acme.json, recreate traefik
7. Verify production cert: same openssl command → issuer without "(STAGING)" prefix
8. curl -I https://luciel.dev → 200, browser lock solid green
```

---

**Once all items complete:** Mark status as "Complete" at top of file.

**Status:** Complete ✓ — verified 2026-07-04 with LE production cert (issuer `CN = YR1`, no staging prefix) and `curl -I https://luciel.dev` returning `HTTP/2 200` without `-k`.