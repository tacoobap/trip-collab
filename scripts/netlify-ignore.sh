#!/bin/bash
# Netlify runs this before every build to decide whether to bother.
#
# NOTE THE INVERTED EXIT CODES — this is Netlify's convention, not a typo:
#   exit 0        -> skip the build
#   exit non-zero -> run the build
#
# The rule is an allowlist of files that provably cannot reach `dist/` or the
# functions bundle. Anything else, and anything we can't work out, builds. A
# needless build costs a minute; a wrongly skipped one ships nothing and looks
# like Netlify is broken, so the two failures are not worth trading evenly.
set -uo pipefail

# Paths that never affect the built site. Deliberately narrow: `src/`, `public/`,
# `netlify/`, `index.html`, lockfiles and every config at the root are absent, so
# a change to any of them builds.
IGNORABLE='^(\.claude/|docs/|\.vscode/|\.gitignore$|\.env\.example$|[^/]*\.md$)'

build() { echo "netlify-ignore: building — $1"; exit 1; }

# No refs to compare (first build, cleared cache, rewritten history): build.
[ -n "${CACHED_COMMIT_REF:-}" ] || build "CACHED_COMMIT_REF is not set"
[ -n "${COMMIT_REF:-}" ]        || build "COMMIT_REF is not set"

if ! changed=$(git diff --name-only "$CACHED_COMMIT_REF" "$COMMIT_REF" 2>&1); then
  build "cannot diff $CACHED_COMMIT_REF..$COMMIT_REF ($changed)"
fi

# An empty diff means a manual retry or a re-run of the same commit. Someone
# asked for this build on purpose, so give them one.
[ -n "$changed" ] || build "no file changes between the two commits"

buildable=$(printf '%s\n' "$changed" | grep -vE "$IGNORABLE")
if [ -n "$buildable" ]; then
  echo "netlify-ignore: building — these changed files can affect the site:"
  printf '%s\n' "$buildable" | sed 's/^/  /'
  exit 1
fi

echo "netlify-ignore: skipping — only non-building files changed:"
printf '%s\n' "$changed" | sed 's/^/  /'
exit 0
