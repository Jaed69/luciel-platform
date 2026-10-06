#!/usr/bin/env bash
# verify-prod.sh — post-deploy smoke test (D-15, INFR-04). Exits non-zero on failure.
#  1. luciel.dev serves a production Let's Encrypt cert.
#  2. Every public host answers over HTTPS with a 2xx/3xx (cert is verified, so a
#     Traefik default/self-signed cert fails here too).
#
# Usage: scripts/verify-prod.sh [host ...]   (default: all platform hosts)
# VERIFY_RESOLVE_IP=127.0.0.1 makes every request hit that IP instead of public DNS;
# the deploy job sets it so the check does not depend on the VPS reaching its own
# public address. TLS name and cert validation are unchanged.
set -euo pipefail

hosts=("$@")
[ ${#hosts[@]} -eq 0 ] && hosts=(luciel.dev lemon.luciel.dev tours.luciel.dev)
ip="${VERIFY_RESOLVE_IP:-}"
connect="${ip:-luciel.dev}"

issuer=$(echo | openssl s_client -connect "$connect:443" -servername luciel.dev 2>/dev/null \
  | openssl x509 -noout -issuer 2>/dev/null) || true

if ! echo "$issuer" | grep -qE "Let's Encrypt|R3|R10"; then
  echo "✗ Not a production LE cert: ${issuer:-<no issuer retrieved>}"
  exit 1
fi
echo "✓ Production LE cert confirmed: $issuer"

fail=0
for host in "${hosts[@]}"; do
  args=(-s -o /dev/null -w '%{http_code}' --max-time 10 --retry 5 --retry-delay 3 --retry-connrefused)
  [ -n "$ip" ] && args+=(--resolve "$host:443:$ip")
  code=$(curl "${args[@]}" "https://$host/" 2>/dev/null) || code=000
  if [[ "$code" =~ ^[23] ]]; then
    echo "✓ $host -> $code"
  else
    echo "✗ $host -> $code"
    fail=1
  fi
done
exit $fail
