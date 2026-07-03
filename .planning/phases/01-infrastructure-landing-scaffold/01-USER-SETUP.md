# Phase 01: User Setup Required

**Generated:** 2026-07-03
**Phase:** 01-infrastructure-landing-scaffold
**Status:** Incomplete

These items require human access to external dashboards/accounts. The agent automated everything else (code, config, scripts). The stack cannot go live until these are done.

## Environment Variables

Copy `.env.example` → `.env` on the VPS, then fill:

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `ACME_EMAIL` | Your real email — receives Let's Encrypt expiry notifications | `.env` |
| [ ] | `LE_CA_SERVER` | Staging URL (default in `.env.example`); flip to prod URL after staging verified | `.env` |
| [ ] | `LE_STAGING` | `1` while staging; `0` after prod cutover | `.env` |
| [ ] | `TRAEFIK_DASHBOARD_USER` | Choose a dashboard username (default `admin`) | `.env` |
| [ ] | `TRAEFIK_DASHBOARD_PASS_HASH` | Run: `htpasswd -nbB <user> '<password>'` (or `openssl passwd -apr1 '<password>'`) — paste the hash | `.env` |
| [ ] | `GITHUB_USER` | Your GitHub username (e.g. `Jaed69`) — used in `ghcr.io/${GITHUB_USER}/luciel-platform-landing` | `.env` |
| [ ] | `GHCR_PAT` | Leave EMPTY if GHCR package is public (recommended). If private: GitHub → Settings → Developer settings → PAT (read:packages) | `.env` |

## Account Setup

None — no new accounts required (Cloudflare, GitHub, Let's Encrypt accounts assumed to exist).

## Dashboard Configuration

### Cloudflare (REQUIRED before `docker compose up` — HTTP-01 fails without it)

- [ ] **Create DNS A record: `@` → VPS public IPv4**
  - Location: Cloudflare Dashboard → DNS → Records → Add record
  - Type: `A`, Name: `@`, IPv4: `<your VPS public IPv4>`, Proxy status: **DNS-only (grey-cloud, proxy OFF)**
- [ ] **Create DNS A record: `*` → VPS public IPv4**
  - Location: Cloudflare Dashboard → DNS → Records → Add record
  - Type: `A`, Name: `*`, IPv4: `<your VPS public IPv4>`, Proxy status: **DNS-only (grey-cloud, proxy OFF)**
- [ ] **Disable "Always Use HTTPS"** (or add exception for `/.well-known/acme-challenge/*`)
  - Location: Cloudflare Dashboard → SSL/TLS → Edge Certificates
  - Why: Cloudflare edge redirect can intercept the LE HTTP-01 challenge before it reaches Traefik. With grey-cloud this usually doesn't apply, but verify if issuance fails.

### GitHub (REQUIRED for VPS to pull the landing image)

- [ ] **Set GHCR package visibility to public** (recommended — anonymous pull, no PAT needed on VPS)
  - Location: GitHub → Settings → Packages → `luciel-platform-landing` → Package settings → Visibility → Public
  - Skip if: You prefer private packages (then `GHCR_PAT` in `.env` is required)

## Verification

After completing setup + deploying on the VPS:

```bash
# On the VPS, from repo root:
cp .env.example .env
# edit .env with the values above
sudo bash scripts/bootstrap-host.sh
docker compose up -d

# Verify staging cert (LE_STAGING=1):
bash scripts/verify-staging.sh
# Expected: "✓ Staging cert confirmed: issuer=...(STAGING)..."

# After flipping to prod (LE_CA_SERVER=prod URL, LE_STAGING=0, delete acme.json, restart traefik):
bash scripts/verify-prod.sh
# Expected: "✓ Production LE cert confirmed: issuer=...(Let's Encrypt)..."

# Phase 1 success criteria:
curl -I https://luciel.dev        # HTTP/2 200
curl -I http://luciel.dev        # 301 -> https
curl -u admin:<password> https://traefik.luciel.dev/dashboard/  # 200
```

---

**Once all items complete:** Mark status as "Complete" at top of file.
