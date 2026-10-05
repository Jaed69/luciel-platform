#!/usr/bin/env bash
# check-env.sh — gate for a decrypted production env file. Exits non-zero when it is not deployable.
#  1. No value is still the __FILL_ME__ placeholder.
#  2. IMAGE_TAG is absent (the deploy computes it per release).
#  3. Every variable docker-compose.yml requires via ${VAR:?...} is present and non-empty.
# Prints variable NAMES only, never values (CI log safety).
#
# Usage: scripts/check-env.sh <decrypted-env-file> [compose-file]
set -euo pipefail

file="${1:?usage: check-env.sh <env-file> [compose-file]}"
compose="${2:-docker-compose.yml}"
fail=0

# Values are read by parsing, never by sourcing: bcrypt hashes contain `$`.
val() { sed -n "s/^$1=//p" "$file" | head -n1; }

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|'#'*) continue ;; esac
  key="${line%%=*}"
  if [ "${line#*=}" = "__FILL_ME__" ]; then
    echo "placeholder not replaced: $key" >&2; fail=1
  fi
done < "$file"

if grep -q '^IMAGE_TAG=' "$file"; then
  echo "IMAGE_TAG must not be set in the env file (computed per deploy)" >&2; fail=1
fi

for key in $(grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*:\?' "$compose" | sed 's/^\${//; s/:?$//' | sort -u); do
  if [ -z "$(val "$key")" ]; then
    echo "required by $compose but missing/empty: $key" >&2; fail=1
  fi
done

exit "$fail"
