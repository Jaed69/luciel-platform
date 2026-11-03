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
run_case "stray APRUEBO_TAG fails" fail "$good"$'\nAPRUEBO_TAG=sha-abc1234'
run_case 'value with $ passes' pass $'REQUIRED_A=$2y$10$abc.DEF/ghi\nREQUIRED_B=b'
run_case "value with quotes passes" pass $'REQUIRED_A="quoted"\nREQUIRED_B=it\'s'
run_case "value with = passes" pass $'REQUIRED_A=a=b==\nREQUIRED_B=b'
run_case "no trailing newline passes" pass "$(printf 'REQUIRED_A=a\nREQUIRED_B=b')"

# --- optional tags file: declares the deployed image tag per app ---------------------
# Rules 1 (placeholder) and 2 (stray computed tags) stay scoped to the env file; the
# ${VAR:?} completeness check sees the env file AND the tags file together.
cat > "$tmp/tags-compose.yml" <<'YML'
services:
  app:
    image: ghcr.io/o/app:${LEMON_TAG:?set LEMON_TAG}
    environment:
      A: ${REQUIRED_A:?set REQUIRED_A}
YML

# tags_case <name> <expected> <env content> <tags content|__MISSING__>
tags_case() {
  local name="$1" expect="$2" env_content="$3" tags_content="$4" got=pass
  printf '%s\n' "$env_content" > "$tmp/case.env"
  local tags="$tmp/case.tags.env"
  rm -f "$tags"
  if [ "$tags_content" != "__MISSING__" ]; then
    printf '%s\n' "$tags_content" > "$tags"
  fi
  bash "$check" "$tmp/case.env" "$tmp/tags-compose.yml" "$tags" >/dev/null 2>&1 || got=fail
  if [ "$got" = "$expect" ]; then
    echo "ok   - $name"
  else
    echo "FAIL - $name (expected $expect, got $got)"; failures=$((failures + 1))
  fi
}

echo "# tags file"
tags_case "tag supplied by the tags file passes" pass 'REQUIRED_A=a' 'LEMON_TAG=sha-2b5beb8'
tags_case "tags file comments and blanks pass" pass 'REQUIRED_A=a' $'# recorded by app repos\n\nLEMON_TAG=sha-2b5beb8'
tags_case "tag missing from both fails" fail 'REQUIRED_A=a' 'OTHER_TAG=sha-2b5beb8'
tags_case "empty tag fails" fail 'REQUIRED_A=a' 'LEMON_TAG='
tags_case "env var still required when tags file is given" fail 'OTHER=x' 'LEMON_TAG=sha-2b5beb8'
tags_case "malformed tag value fails" fail 'REQUIRED_A=a' 'LEMON_TAG=latest'
tags_case "tag with the wrong hex length fails" fail 'REQUIRED_A=a' 'LEMON_TAG=sha-2b5beb'
tags_case "lowercase name in the tags file fails" fail 'REQUIRED_A=a' $'LEMON_TAG=sha-2b5beb8\nlemon_tag=sha-2b5beb8'
tags_case "tag in the env file is still refused" fail $'REQUIRED_A=a\nIMAGE_TAG=sha-2b5beb8' 'LEMON_TAG=sha-2b5beb8'
tags_case "a declared tag may live in the tags file" pass 'REQUIRED_A=a' $'LEMON_TAG=sha-2b5beb8\nAPRUEBO_TAG=sha-d09db04'
tags_case "missing tags file fails" fail 'REQUIRED_A=a' '__MISSING__'

if [ "$failures" -ne 0 ]; then
  echo "$failures test(s) failed" >&2
  exit 1
fi
echo "all tests passed"
