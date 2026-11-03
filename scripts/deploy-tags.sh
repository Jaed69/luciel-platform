#!/usr/bin/env bash
# deploy-tags.sh — image-tag bookkeeping for the deploy, run ON THE VPS from the checkout.
#
# env/tags.env records which image tag each app runs; app repos rewrite one line of it
# (scripts/record-tag.sh) and that commit triggers the deploy. These values are written
# into .env and sourced to pull, so they are validated whole before they are trusted.
#
#   validate <tags-file>
#     Exit 0 when every non-comment line is exactly NAME=sha-<7 hex>; non-zero otherwise.
#
#   resolve <tags-file> <env-file>
#     Print the tag lines .env must carry DURING the pull: the value the VPS already runs,
#     so a failed pull never leaves .env naming an image that was never pulled. An app with
#     no previous value falls back to the new tag — its first deploy has no older image.
#
# Usage: scripts/deploy-tags.sh validate|resolve <tags-file> [env-file]
set -euo pipefail

cmd="${1:?usage: deploy-tags.sh validate|resolve <tags-file> [env-file]}"
tags="${2:?usage: deploy-tags.sh validate|resolve <tags-file> [env-file]}"

if [ ! -f "$tags" ]; then
  echo "no such tags file: $tags" >&2
  exit 1
fi

# Whole-line match: a substring check would accept `sha-2b5beb8;id` or a trailing space.
valid_line() { printf '%s' "$1" | grep -qxE '[A-Z][A-Z0-9_]*=sha-[0-9a-f]{7}'; }

case "$cmd" in
  validate)
    fail=0
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in ''|'#'*) continue ;; esac
      if ! valid_line "$line"; then
        # Name only: the line is echoed nowhere else, but keep the habit of the other scripts.
        echo "malformed line in $tags (expected NAME=sha-<7 hex>): ${line%%=*}" >&2
        fail=1
      fi
    done < "$tags"
    exit "$fail"
    ;;
  resolve)
    env_file="${3-}"
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in ''|'#'*) continue ;; esac
      if ! valid_line "$line"; then
        echo "malformed line in $tags — run validate first" >&2
        exit 1
      fi
      name="${line%%=*}"
      current=""
      if [ -n "$env_file" ] && [ -f "$env_file" ]; then
        current="$(sed -n "s/^${name}=//p" "$env_file" | head -n1)"
      fi
      if [ -n "$current" ]; then
        echo "${name}=${current}"
      else
        echo "$line"
      fi
    done < "$tags"
    ;;
  *)
    echo "unknown command: $cmd (expected validate or resolve)" >&2
    exit 2
    ;;
esac
