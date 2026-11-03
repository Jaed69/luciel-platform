#!/usr/bin/env bash
# test-deploy-tags.sh — behavior tests for scripts/deploy-tags.sh (plain bash, no framework).
# DEPLOY_TAGS overrides the script under test.
#
# Usage: bash scripts/test-deploy-tags.sh
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${DEPLOY_TAGS:-$here/deploy-tags.sh}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; shift; [ "$#" -gt 0 ] && printf '%s\n' "$@"; failures=$((failures + 1)); }

w="$tmp/wanted"
e="$tmp/env"

# --- validate -------------------------------------------------------------------------
echo "# validate"
v_case() { # <name> <pass|fail> <content...>
  local name="$1" expect="$2"; shift 2
  printf '%s\n' "$@" > "$w"
  local got=pass
  bash "$script" validate "$w" >/dev/null 2>&1 || got=fail
  [ "$got" = "$expect" ] && pass "$name" || fail "$name (expected $expect, got $got)"
}

v_case "well-formed tags pass" pass 'LEMON_TAG=sha-2b5beb8' 'TOURS_TAG=sha-560374e'
v_case "comments and blanks pass" pass '# recorded by app repos' '' 'LEMON_TAG=sha-2b5beb8'
v_case "empty file passes" pass ''
v_case "latest is refused" fail 'LEMON_TAG=latest'
v_case "short hex is refused" fail 'LEMON_TAG=sha-2b5beb'
v_case "long hex is refused" fail 'LEMON_TAG=sha-2b5beb81'
v_case "non-hex is refused" fail 'LEMON_TAG=sha-zzzzzzz'
v_case "missing sha- prefix is refused" fail 'LEMON_TAG=2b5beb8'
v_case "lowercase name is refused" fail 'lemon_tag=sha-2b5beb8'
v_case "empty value is refused" fail 'LEMON_TAG='
v_case "command substitution is refused" fail 'LEMON_TAG=sha-2b5beb8$(id)'
v_case "semicolon injection is refused" fail 'LEMON_TAG=sha-2b5beb8;id'
v_case "trailing space is refused" fail 'LEMON_TAG=sha-2b5beb8 '
v_case "leading space is refused" fail ' LEMON_TAG=sha-2b5beb8'
v_case "second malformed line is refused" fail 'LEMON_TAG=sha-2b5beb8' 'TOURS_TAG=latest'
v_case "missing file is refused" fail 'placeholder'
rm -f "$tmp/absent"; bash "$script" validate "$tmp/absent" >/dev/null 2>&1 \
  && fail "absent file is refused" || pass "absent file is refused"

# --- resolve --------------------------------------------------------------------------
# What .env must carry DURING the pull: the value the VPS already runs, so a failed pull
# never leaves .env naming an image that was never pulled. Only apps with no previous
# value fall back to the new tag (their first deploy).
echo "# resolve"
r_case() { # <name> <expected lines joined by \n> <wanted lines...> -- <env lines...>
  local name="$1" expect="$2"; shift 2
  local -a wanted=() envl=(); local seen=0
  for a in "$@"; do
    if [ "$a" = "--" ]; then seen=1; continue; fi
    if [ "$seen" = 0 ]; then wanted+=("$a"); else envl+=("$a"); fi
  done
  printf '%s\n' "${wanted[@]}" > "$w"
  if [ "${#envl[@]}" -gt 0 ]; then printf '%s\n' "${envl[@]}" > "$e"; else rm -f "$e"; fi
  local got
  got="$(bash "$script" resolve "$w" "$e" 2>&1)"
  [ "$got" = "$expect" ] && pass "$name" || fail "$name" "expected:" "$expect" "got:" "$got"
}

r_case "keeps the running tag, not the new one" \
  'LEMON_TAG=sha-1111111' \
  'LEMON_TAG=sha-2b5beb8' -- 'LEMON_TAG=sha-1111111' 'OTHER=x'
r_case "falls back to the new tag on a first deploy" \
  'LEMON_TAG=sha-2b5beb8' \
  'LEMON_TAG=sha-2b5beb8' -- 'OTHER=x'
r_case "falls back when there is no .env at all" \
  'LEMON_TAG=sha-2b5beb8' \
  'LEMON_TAG=sha-2b5beb8' --
r_case "handles each app independently" \
  $'LEMON_TAG=sha-1111111\nTOURS_TAG=sha-560374e' \
  'LEMON_TAG=sha-2b5beb8' 'TOURS_TAG=sha-560374e' -- 'LEMON_TAG=sha-1111111'
r_case "preserves the order of the tags file" \
  $'TOURS_TAG=sha-560374e\nLEMON_TAG=sha-2b5beb8' \
  'TOURS_TAG=sha-560374e' 'LEMON_TAG=sha-2b5beb8' --
r_case "ignores comments and blanks" \
  'LEMON_TAG=sha-1111111' \
  '# c' '' 'LEMON_TAG=sha-2b5beb8' -- 'LEMON_TAG=sha-1111111'
r_case "an empty value in .env is treated as absent" \
  'LEMON_TAG=sha-2b5beb8' \
  'LEMON_TAG=sha-2b5beb8' -- 'LEMON_TAG='
r_case "a name that is a prefix of another is not confused" \
  $'TOURS_TAG=sha-1111111\nTOURS_TAG_API=sha-2222222' \
  'TOURS_TAG=sha-aaaaaaa' 'TOURS_TAG_API=sha-bbbbbbb' -- 'TOURS_TAG=sha-1111111' 'TOURS_TAG_API=sha-2222222'
r_case "empty tags file resolves to nothing" '' '' --

echo
if [ "$failures" -eq 0 ]; then echo "all tests passed"; else echo "$failures test(s) failed"; exit 1; fi
