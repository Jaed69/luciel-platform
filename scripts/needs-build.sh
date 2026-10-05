#!/usr/bin/env bash
# needs-build.sh — does an app image have to be rebuilt for HEAD? Exit 0 = build, 1 = keep `latest`.
# Compares HEAD with the commit recorded in the app's current `latest` image
# (OCI label org.opencontainers.image.revision), so the answer does not depend on which
# earlier pushes were seen or dropped. Build when the revision is missing/unknown to this
# clone (needs full history) or any of the app's paths differ from it.
#
# Usage: scripts/needs-build.sh <latest-revision-or-empty> <path>...
set -eu

rev="${1-}"
shift

[ -n "$rev" ] || exit 0
git cat-file -e "${rev}^{commit}" 2>/dev/null || exit 0
git diff --quiet "$rev" HEAD -- "$@" && exit 1
exit 0
