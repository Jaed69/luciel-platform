#!/usr/bin/env bash
# test-check-env.sh — behavior tests for scripts/check-env.sh (plain bash, no framework).
# Run in CI before the deploy decrypts anything. CHECK_ENV overrides the script under test.
#
# Usage: bash scripts/test-check-env.sh
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="${CHECK_ENV:-$here/check-env.sh}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Minimal compose file: two required vars, one optional.
cat > "$tmp/compose.yml" <<'YML'
services:
  app:
    environment:
      A: ${REQUIRED_A:?set REQUIRED_A}
      B: ${REQUIRED_B:?set REQUIRED_B}
      C: ${OPTIONAL_C:-default}
YML

failures=0
# run_case <name> <expected: pass|fail> <env file content>
run_case() {
  local name="$1" expect="$2" content="$3" got=pass
  printf '%s\n' "$content" > "$tmp/case.env"
  bash "$check" "$tmp/case.env" "$tmp/compose.yml" >/dev/null 2>&1 || got=fail
  if [ "$got" = "$expect" ]; then
    echo "ok   - $name"
  else
    echo "FAIL - $name (expected $expect, got $got)"; failures=$((failures + 1))
  fi
}

good=$'REQUIRED_A=a\nREQUIRED_B=b'

run_case "all good passes" pass "$good"
run_case "comments and blank lines pass" pass $'# comment\n\nREQUIRED_A=a\nREQUIRED_B=b'
run_case "placeholder fails" fail $'REQUIRED_A=__FILL_ME__\nREQUIRED_B=b'
run_case "placeholder in optional var fails" fail "$good"$'\nOPTIONAL_C=__FILL_ME__'
run_case "missing required var fails" fail "REQUIRED_A=a"
run_case "empty required var fails" fail $'REQUIRED_A=a\nREQUIRED_B='
run_case "stray IMAGE_TAG fails" fail "$good"$'\nIMAGE_TAG=sha-abc1234'
run_case 'value with $ passes' pass $'REQUIRED_A=$2y$10$abc.DEF/ghi\nREQUIRED_B=b'
run_case "value with quotes passes" pass $'REQUIRED_A="quoted"\nREQUIRED_B=it\'s'
run_case "value with = passes" pass $'REQUIRED_A=a=b==\nREQUIRED_B=b'
run_case "no trailing newline passes" pass "$(printf 'REQUIRED_A=a\nREQUIRED_B=b')"

if [ "$failures" -ne 0 ]; then
  echo "$failures test(s) failed" >&2
  exit 1
fi
echo "all tests passed"
