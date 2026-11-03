#!/usr/bin/env bash
# record-tag.sh — point one app's tag variable at a new image tag in the tags file.
# Prints `changed` (file rewritten) or `unchanged` (already that tag); exits non-zero and
# leaves the file untouched on any refused input.
#
# The tags file is sourced by the deploy and its values reach a remote shell, so both the
# variable name and the tag are matched whole against a strict charset. That is what makes
# the in-place rewrite safe.
#
# The variable must ALREADY exist in the file: the deployment repo declares which apps it
# runs. Appending here would let a typo create a dead variable that never deploys anything.
#
# Usage: scripts/record-tag.sh <tags-file> <VAR_NAME> <sha-xxxxxxx>
set -eu

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <tags-file> <VAR_NAME> <sha-xxxxxxx>" >&2
  exit 2
fi

file="$1"
var="$2"
tag="$3"

# Whole-value matches: a line-based check (grep) would accept an embedded newline.
if ! [[ "$var" =~ ^[A-Z][A-Z0-9_]*$ ]]; then
  echo "refusing malformed variable name: ${var}" >&2
  exit 1
fi
if ! [[ "$tag" =~ ^sha-[0-9a-f]{7}$ ]]; then
  echo "refusing malformed tag: ${tag} (expected sha-<7 hex>)" >&2
  exit 1
fi
if [ ! -f "$file" ]; then
  echo "no such tags file: ${file}" >&2
  exit 1
fi

current="$(awk -v v="$var" 'index($0, v "=") == 1 { print substr($0, length(v) + 2); exit }' "$file")"
if [ -z "$current" ]; then
  echo "${file} has no ${var}= line — declare it there first" >&2
  exit 1
fi

if [ "$current" = "$tag" ]; then
  echo unchanged
  exit 0
fi

# Rewrite only the first matching line, byte-for-byte everywhere else (comments, blanks
# and ordering are part of the file's readability).
out="$(mktemp "${file}.XXXXXX")"
trap 'rm -f "$out"' EXIT
awk -v v="$var" -v t="$tag" '
  !done && index($0, v "=") == 1 { print v "=" t; done = 1; next }
  { print }
' "$file" > "$out"
cat "$out" > "$file"   # preserve the original file's mode and inode
echo changed
