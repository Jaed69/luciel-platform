#!/usr/bin/env bash
# verify-prod.sh — confirm luciel.dev serves a production LE cert (D-15, INFR-04).
set -euo pipefail

issuer=$(echo | openssl s_client -connect luciel.dev:443 -servername luciel.dev 2>/dev/null \
  | openssl x509 -noout -issuer 2>/dev/null) || true

if echo "$issuer" | grep -qE "Let's Encrypt|R3|R10"; then
  echo "✓ Production LE cert confirmed: $issuer"
  exit 0
fi

echo "✗ Not a production LE cert: ${issuer:-<no issuer retrieved>}"
exit 1
