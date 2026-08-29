#!/bin/bash
# Claude Code on the web clones into a fresh container with no node_modules, so
# the first build, lint or type-check of a session would otherwise pay a full
# install. Local checkouts already have their deps, so only run on the web.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$PROJECT_DIR"

npm install --no-audit --no-fund
