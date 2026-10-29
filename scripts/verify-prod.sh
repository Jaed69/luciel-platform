#!/usr/bin/env bash
# verify-prod.sh — post-deploy smoke test (D-15, INFR-04). Exits non-zero on failure.
#  1. luciel.dev serves a production Let's Encrypt cert.
#  2. Every public host answers over HTTPS with a 2xx/3xx (cert is verified, so a
#     Traefik default/self-signed cert fails here too).
#
# Each host is asked up to VERIFY_ATTEMPTS times (default 15), VERIFY_INTERVAL seconds apart
# (default 2), until it answers 2xx/3xx. Traefik applies container changes after a short
# throttle, so right after `compose up --wait` reports a recreated container healthy, its
# router can be missing for a moment and Traefik answers 404. curl's own --retry never
# retries a 404, so without this the deploy rolled back a healthy release.
#
# Usage: scripts/verify-prod.sh [host[/path] ...]   (default: all platform hosts, plus the
# Apruebo API health path)
# VERIFY_RESOLVE_IP=127.0.0.1 makes every request hit that IP instead of public DNS;
# the deploy job sets it so the check does not depend on the VPS reaching its own
# public address. TLS name and cert validation are unchanged.
set -euo pipefail

hosts=("$@")
[ ${#hosts[@]} -eq 0 ] && hosts=(luciel.dev lemon.luciel.dev tours.luciel.dev apruebo.luciel.dev apruebo.luciel.dev/api/health)
ip="${VERIFY_RESOLVE_IP:-}"
connect="${ip:-luciel.dev}"
attempts="${VERIFY_ATTEMPTS:-15}"
interval="${VERIFY_INTERVAL:-2}"

issuer=$(echo | openssl s_client -connect "$connect:443" -servername luciel.dev 2>/dev/null \
  | openssl x509 -noout -issuer 2>/dev/null) || true

if ! echo "$issuer" | grep -qE "Let's Encrypt|R3|R10"; then
  echo "✗ Not a production LE cert: ${issuer:-<no issuer retrieved>}"
  exit 1
fi
echo "✓ Production LE cert confirmed: $issuer"

fail=0
for target in "${hosts[@]}"; do
  host="${target%%/*}"
  path="/"
  [ "$target" != "$host" ] && path="/${target#*/}"
  args=(-s -o /dev/null -w '%{http_code}' --max-time 10 --retry 5 --retry-delay 3 --retry-connrefused)
  [ -n "$ip" ] && args+=(--resolve "$host:443:$ip")
  try=1
  while :; do
    code=$(curl "${args[@]}" "https://$host$path" 2>/dev/null) || code=000
    [[ "$code" =~ ^[23] ]] && break
    [ "$try" -ge "$attempts" ] && break
    try=$((try + 1))
    sleep "$interval"
  done
  note=""
  [ "$try" -gt 1 ] && note=" (try $try of $attempts)"
  if [[ "$code" =~ ^[23] ]]; then
    echo "✓ $target -> $code$note"
  else
    echo "✗ $target -> $code$note"
    fail=1
  fi
done
exit $fail
