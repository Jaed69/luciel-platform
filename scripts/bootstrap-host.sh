#!/usr/bin/env bash
# bootstrap-host.sh — idempotent VPS prep for luciel-platform (D-09).
#
# Run on a fresh Ubuntu 24.04 arm64 VPS (Oracle Cloud Ampere A1) as root/sudo.
# Can be run from any CWD — paths resolve relative to the script location.
#
# External prerequisites (cannot be automated — see 01-USER-SETUP.md):
#   Cloudflare DNS:
#     1. A record:  @  -> VPS public IPv4, DNS-only (grey-cloud, proxy OFF)
#     2. A record:  *  -> VPS public IPv4, DNS-only (grey-cloud, proxy OFF)
#     3. Disable "Always Use HTTPS" (or add Page Rule exception for /.well-known/acme-challenge/*)
#   Oracle Cloud VCN Security List:
#     4. Ingress rule: TCP 80, source 0.0.0.0/0   (LE HTTP-01 challenge)
#     5. Ingress rule: TCP 443, source 0.0.0.0/0  (HTTPS)
#     Without OCI ingress rules, UFW alone is insufficient — packets are dropped
#     at the network layer before reaching the host.
#
set -euo pipefail

# Resolve repo root from script location so CWD doesn't matter.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ACME_DIR="$REPO_ROOT/traefik/letsencrypt"
ACME_FILE="$ACME_DIR/acme.json"

# 1. Install Docker from official repo (not apt default docker.io — Pitfall anti-pattern)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update

# Ubuntu 24.04 ships docker-compose-v2 which conflicts with docker-compose-plugin
# (both install /usr/libexec/docker/cli-plugins/docker-compose). If docker compose
# already works, skip the plugin install. Otherwise force-overwrite the conflict.
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
else
  # docker-ce / cli / containerd still need install; only the compose plugin is skipped
  apt-get install -y -o Dpkg::Options::="--force-overwrite" docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

# 2. Create traefik-public network (idempotent — Pitfall 4)
docker network create traefik-public 2>/dev/null || true

# 3. Firewall: allow 22/80/443, default deny incoming
# (Note: this only affects host UFW — OCI Security List must also allow 80/443 inbound)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable

# 4. fail2ban for SSH brute-force protection (T-01-07)
apt-get install -y fail2ban
systemctl enable --now fail2ban

# 5. Prepare acme.json (chmod 600 + chown 65532 per D-13, D-19, Pitfall 2)
# Traefik image runs as uid 65532 inside the container; bind-mount preserves
# host uid:gid, so the host file must be owned by 65532 for Traefik to read/write.
mkdir -p "$ACME_DIR"
touch "$ACME_FILE"
chmod 600 "$ACME_FILE"
chown 65532:65532 "$ACME_FILE"

# 6. GHCR auth (only if PAT provided — public packages need none)
if [ -n "${GHCR_PAT:-}" ] && [ -n "${GITHUB_USER:-}" ]; then
  echo "$GHCR_PAT" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin
fi

echo "✓ Host bootstrapped. Next:"
echo "    cp $REPO_ROOT/.env.example $REPO_ROOT/.env"
echo "    nano $REPO_ROOT/.env   # fill TRAEFIK_DASHBOARD_PASS_HASH (\$\$-escaped), GITHUB_USER (lowercase)"
echo "    cd $REPO_ROOT && docker compose up -d"