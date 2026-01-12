#!/usr/bin/env bash
set -euo pipefail

FILE="${CLAUDE_FILE_PATH:-}"

if [[ -z "$FILE" ]]; then
  exit 0
fi

case "$FILE" in
  *.ts|*.tsx)
    if command -v npx >/dev/null 2>&1; then
      npx --yes prettier --write "$FILE" >/dev/null 2>&1 || true
    fi
    ;;
esac
