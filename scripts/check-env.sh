#!/usr/bin/env bash
# check-env.sh — gate for a decrypted production env file. Exits non-zero when it is not deployable.
#  1. No value in the env file is still the __FILL_ME__ placeholder.
#  2. IMAGE_TAG and APRUEBO_TAG are absent from the ENV file (a tag belongs in the tags
#     file, which app repos record, or is computed by the deploy — never in the secrets).
#  3. Every variable docker-compose.yml requires via ${VAR:?...} is present and non-empty,
#     looking in the env file and then in the tags file.
#  4. When a tags file is given, every one of its lines is exactly NAME=sha-<7 hex>. Its
#     values reach a remote shell and name the image that gets deployed, so nothing else
#     is accepted there.
# Prints variable NAMES only, never values (CI log safety).
#
# Usage: scripts/check-env.sh <decrypted-env-file> [compose-file] [tags-file]
set -euo pipefail

file="${1:?usage: check-env.sh <env-file> [compose-file] [tags-file]}"
compose="${2:-docker-compose.yml}"
tags="${3-}"
fail=0

# Values are read by parsing, never by sourcing: bcrypt hashes contain `$`.
val() {
  local v
  v="$(sed -n "s/^$1=//p" "$file" | head -n1)"
  if [ -z "$v" ] && [ -n "$tags" ] && [ -f "$tags" ]; then
    v="$(sed -n "s/^$1=//p" "$tags" | head -n1)"
  fi
  printf '%s' "$v"
}

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|'#'*) continue ;; esac
  key="${line%%=*}"
  if [ "${line#*=}" = "__FILL_ME__" ]; then
    echo "placeholder not replaced: $key" >&2; fail=1
  fi
done < "$file"

for key in IMAGE_TAG APRUEBO_TAG; do
  if grep -q "^${key}=" "$file"; then
    echo "$key must not be set in the env file (it belongs in the tags file)" >&2; fail=1
  fi
done

if [ -n "$tags" ]; then
  if [ ! -f "$tags" ]; then
    echo "no such tags file: $tags" >&2; fail=1
  else
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in ''|'#'*) continue ;; esac
      # Whole-line match: anything else could inject a variable into the remote .env.
      if ! [[ "$line" =~ ^[A-Z][A-Z0-9_]*=sha-[0-9a-f]{7}$ ]]; then
        echo "malformed line in $tags (expected NAME=sha-<7 hex>): ${line%%=*}" >&2; fail=1
      fi
    done < "$tags"
  fi
fi

for key in $(grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*:\?' "$compose" | sed 's/^\${//; s/:?$//' | sort -u); do
  if [ -z "$(val "$key")" ]; then
    echo "required by $compose but missing/empty: $key" >&2; fail=1
  fi
done

exit "$fail"
