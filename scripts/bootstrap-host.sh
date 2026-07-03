#!/usr/bin/env bash
# bootstrap-host.sh — idempotent VPS prep for luciel-platform (D-09).
#
# Run on a fresh Ubuntu 24.04 arm64 VPS (Oracle Cloud Ampere A1) as root/sudo,
# from the repo root after `git clone`.
#
# Cloudflare DNS — do this BEFORE running, or LE HTTP-01 will fail (D-07, D-08):
#   1. A record:  @  -> VPS public IPv4, DNS-only (grey-cloud, proxy OFF)
#   2. A record:  *  -> VPS public IPv4, DNS-only (grey-cloud, proxy OFF)
#   3. SSL/TLS -> Edge Certificates -> disable "Always Use HTTPS"
#      (or add a Page Rule exception for /.well-known/acme-challenge/*)
#
set -euo pipefail

# 1. Install Docker from official repo (not apt default docker.io — Pitfall anti-pattern)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 2. Create traefik-public network (idempotent — Pitfall 4)
docker network create traefik-public 2>/dev/null || true

# 3. Firewall: allow 22/80/443, default deny incoming
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
mkdir -p traefik/letsencrypt
touch traefik/letsencrypt/acme.json
chmod 600 traefik/letsencrypt/acme.json
chown 65532:65532 traefik/letsencrypt/acme.json

# 6. GHCR auth (only if PAT provided — public packages need none)
if [ -n "${GHCR_PAT:-}" ] && [ -n "${GITHUB_USER:-}" ]; then
  echo "$GHCR_PAT" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin
fi

echo "✓ Host bootstrapped. Next: cp .env.example .env, fill secrets, docker compose up -d"
