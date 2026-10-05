#!/usr/bin/env bash
# needs-build.sh — does an app image have to be rebuilt for HEAD?
# Prints `build` or `skip` (exit 0 either way; a non-zero exit is a script error, which the
# caller must treat as `build`). Compares HEAD with the commit recorded in the app's current
# `latest` image (OCI label org.opencontainers.image.revision), so the answer does not depend
# on which earlier pushes were seen or dropped. `build` when the revision is missing/unknown
# to this clone (needs full history) or any of the app's paths differ from it.
#
# Usage: scripts/needs-build.sh <latest-revision-or-empty> <path>...
set -eu

rev="${1-}"
shift

if [ -z "$rev" ] || ! git cat-file -e "${rev}^{commit}" 2>/dev/null; then
  echo build
elif git diff --quiet "$rev" HEAD -- "$@"; then
  echo skip
else
  echo build
fi
