#!/usr/bin/env bash
# verify-staging.sh — confirm luciel.dev serves a LE STAGING cert (D-15, INFR-04).
set -euo pipefail

issuer=$(echo | openssl s_client -connect luciel.dev:443 -servername luciel.dev 2>/dev/null \
  | openssl x509 -noout -issuer 2>/dev/null) || true

if echo "$issuer" | grep -q "STAGING"; then
  echo "✓ Staging cert confirmed: $issuer"
  exit 0
fi

echo "✗ Not a staging cert: ${issuer:-<no issuer retrieved>}"
exit 1
