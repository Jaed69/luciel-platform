#!/usr/bin/env bash
# test-record-tag.sh — behavior tests for scripts/record-tag.sh (plain bash, no framework).
# Writes a throwaway tags file and checks the bump decision and the resulting bytes.
# RECORD_TAG overrides the script under test.
#
# Usage: bash scripts/test-record-tag.sh
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${RECORD_TAG:-$here/record-tag.sh}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

failures=0

# seed <content...> — writes $tmp/tags.env
seed() { printf '%s\n' "$@" > "$tmp/tags.env"; }

# ok_case <name> <expected stdout> <var> <tag>
ok_case() {
  local name="$1" expect="$2" var="$3" tag="$4" got rc
  got="$(bash "$script" "$tmp/tags.env" "$var" "$tag" 2>&1)"; rc=$?
  if [ "$rc" -eq 0 ] && [ "$got" = "$expect" ]; then
    echo "ok   - $name"
  else
    echo "FAIL - $name (rc=$rc, expected '$expect', got '$got')"; failures=$((failures + 1))
  fi
}

# fail_case <name> <var> <tag> [file]
fail_case() {
  local name="$1" var="$2" tag="$3" file="${4:-$tmp/tags.env}" rc
  bash "$script" "$file" "$var" "$tag" >/dev/null 2>&1; rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "ok   - $name"
  else
    echo "FAIL - $name (expected non-zero exit, got 0)"; failures=$((failures + 1))
  fi
}

# file_is <name> <expected full content>
file_is() {
  local name="$1" expect="$2" got
  got="$(cat "$tmp/tags.env")"
  if [ "$got" = "$expect" ]; then
    echo "ok   - $name"
  else
    echo "FAIL - $name"; printf 'expected:\n%s\ngot:\n%s\n' "$expect" "$got"; failures=$((failures + 1))
  fi
}

echo "# bump"
seed 'LEMON_TAG=sha-1111111' 'LANDING_TAG=sha-2222222'
ok_case "bumps an existing var" changed LEMON_TAG sha-aaaaaaa
file_is "only the target line changed" 'LEMON_TAG=sha-aaaaaaa
LANDING_TAG=sha-2222222'

echo "# idempotence"
seed 'LEMON_TAG=sha-aaaaaaa'
ok_case "same tag is a no-op" unchanged LEMON_TAG sha-aaaaaaa
file_is "file untouched when unchanged" 'LEMON_TAG=sha-aaaaaaa'

echo "# the var must already be declared"
seed 'LEMON_TAG=sha-1111111'
fail_case "missing var line fails" TOURS_TAG sha-aaaaaaa
file_is "file untouched when the var is missing" 'LEMON_TAG=sha-1111111'

echo "# prefix safety"
seed 'TOURS_TAG=sha-1111111' 'TOURS_TAG_API=sha-2222222'
ok_case "bumps the exact var, not its prefix sibling" changed TOURS_TAG sha-bbbbbbb
file_is "prefix sibling untouched" 'TOURS_TAG=sha-bbbbbbb
TOURS_TAG_API=sha-2222222'

echo "# comments and blank lines survive"
seed '# tags recorded by app repos' '' 'LEMON_TAG=sha-1111111'
ok_case "bumps below a comment" changed LEMON_TAG sha-ccccccc
file_is "comment and blank line preserved" '# tags recorded by app repos

LEMON_TAG=sha-ccccccc'

echo "# malformed input is refused"
seed 'LEMON_TAG=sha-1111111'
fail_case "tag without the sha- prefix fails" LEMON_TAG 1111111
fail_case "tag with too few hex chars fails" LEMON_TAG sha-111111
fail_case "tag with too many hex chars fails" LEMON_TAG sha-11111111
fail_case "tag with non-hex chars fails" LEMON_TAG sha-zzzzzzz
fail_case "tag with a newline fails" LEMON_TAG 'sha-1111111
LEMON_TAG=sha-evilevil'
fail_case "tag with sed metacharacters fails" LEMON_TAG 'sha-111111|x'
fail_case "lowercase var fails" lemon_tag sha-aaaaaaa
fail_case "var with a slash fails" 'LEMON/TAG' sha-aaaaaaa
fail_case "empty var fails" '' sha-aaaaaaa
file_is "file untouched by every refused input" 'LEMON_TAG=sha-1111111'

echo "# missing file"
fail_case "missing tags file fails" LEMON_TAG sha-aaaaaaa "$tmp/nope.env"

echo
if [ "$failures" -eq 0 ]; then
  echo "all tests passed"
else
  echo "$failures test(s) failed"; exit 1
fi
