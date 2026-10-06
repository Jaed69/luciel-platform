#!/usr/bin/env bash
# test-needs-build.sh — behavior tests for scripts/needs-build.sh (plain bash, no framework).
# Builds a throwaway git repo and checks the build/skip decision. NEEDS_BUILD overrides the
# script under test.
#
# Usage: bash scripts/test-needs-build.sh
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${NEEDS_BUILD:-$here/needs-build.sh}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git_() { git -C "$tmp" -c core.autocrlf=false -c user.name=test -c user.email=test@example.com "$@"; }
commit_file() { # <path> <content>
  mkdir -p "$tmp/$(dirname "$1")"
  printf '%s\n' "$2" > "$tmp/$1"
  git_ add -A && git_ commit -q -m "change $1"
}

git_ init -q
commit_file apps/a/file.txt one
commit_file shared.txt one
base="$(git_ rev-parse HEAD)"   # revision recorded in a hypothetical `latest` image

failures=0
# check <name> <expected: build|skip> <revision> <path>...
check() {
  local name="$1" expect="$2" rev="$3" got
  shift 3
  got="$(cd "$tmp" && bash "$script" "$rev" "$@" 2>/dev/null)"
  if [ "$got" = "$expect" ]; then
    echo "ok   - $name"
  else
    echo "FAIL - $name (expected '$expect', got '$got')"; failures=$((failures + 1))
  fi
}

check "empty revision builds" build "" apps/a
check "unknown revision builds" build "0123456789abcdef0123456789abcdef01234567" apps/a
check "revision equal to HEAD skips" skip "$base" apps/a shared.txt

commit_file apps/b/file.txt one
check "unrelated path changed skips" skip "$base" apps/a shared.txt

commit_file apps/a/file.txt two
check "own path changed builds" build "$base" apps/a shared.txt

commit_file apps/a/file.txt one   # content back to the original, but history moved on
check "path changed then reverted skips" skip "$base" apps/a

commit_file shared.txt two
check "shared path changed builds" build "$base" apps/a shared.txt

if [ "$failures" -ne 0 ]; then
  echo "$failures test(s) failed" >&2
  exit 1
fi
echo "all tests passed"
