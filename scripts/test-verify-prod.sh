#!/usr/bin/env bash
# test-verify-prod.sh — behavior tests for scripts/verify-prod.sh (plain bash, no framework).
# Puts fake `curl` and `openssl` first on PATH: each host answers a scripted sequence of status
# codes (the last one repeats), and the cert issuer is scripted too. VERIFY_PROD overrides the
# script under test.
#
# Usage: bash scripts/test-verify-prod.sh
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${VERIFY_PROD:-$here/verify-prod.sh}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"

# openssl: `s_client` prints nothing; `x509` prints the scripted issuer.
cat > "$tmp/bin/openssl" <<'EOF'
#!/usr/bin/env bash
[ "$1" = "x509" ] && cat "$STUB/issuer"
exit 0
EOF
# curl: the last argument is the URL; answer the next scripted code for its host.
cat > "$tmp/bin/curl" <<'EOF'
#!/usr/bin/env bash
url="${!#}"; host="${url#https://}"; host="${host%%/*}"
codes="$STUB/codes-$host"
[ -f "$codes" ] || { printf 000; exit 0; }
printf '%s' "$(head -n1 "$codes")"
[ "$(wc -l < "$codes")" -gt 1 ] && sed -i '1d' "$codes"
exit 0
EOF
chmod +x "$tmp/bin/openssl" "$tmp/bin/curl"

failures=0
# scenario <issuer> <host>=<code,code,...>...: scripts the fakes for one run.
scenario() {
  rm -f "$tmp"/codes-*
  printf '%s\n' "$1" > "$tmp/issuer"
  shift
  local spec host
  for spec in "$@"; do
    host="${spec%%=*}"
    tr ',' '\n' <<< "${spec#*=}" > "$tmp/codes-$host"
  done
}
# check <name> <expected exit> <host>...: runs the script against the given hosts.
check() {
  local name="$1" expect="$2" got
  shift 2
  STUB="$tmp" PATH="$tmp/bin:$PATH" VERIFY_INTERVAL=0 VERIFY_ATTEMPTS=3 \
    bash "$script" "$@" > "$tmp/out" 2>&1
  got=$?
  if [ "$got" = "$expect" ]; then
    echo "ok   - $name"
  else
    echo "FAIL - $name (expected exit $expect, got $got)"; sed 's/^/       /' "$tmp/out"
    failures=$((failures + 1))
  fi
}

le="issuer=C = US, O = Let's Encrypt, CN = R10"

scenario "$le" a.test=200 b.test=307
check "every host answering passes" 0 a.test b.test

# Traefik answers 404 for a moment after a container turns healthy, until it loads the route.
scenario "$le" a.test=404,404,200
check "a host that starts answering within the attempts passes" 0 a.test

scenario "$le" a.test=200 b.test=404
check "a host that keeps answering 404 fails" 1 a.test b.test

scenario "$le" a.test=000,502,200
check "connection errors and 5xx are retried too" 0 a.test

scenario "issuer=CN = TRAEFIK DEFAULT CERT" a.test=200
check "a non-Let's Encrypt cert fails" 1 a.test

[ "$failures" -eq 0 ] && echo "all verify-prod tests passed" || { echo "$failures failing"; exit 1; }
