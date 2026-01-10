#!/usr/bin/env bash
set -euo pipefail

HOOK_MODE="${1:-}"
if [[ "$HOOK_MODE" == "--hook=pretooluse" ]]; then
  # guard runs before Claude executes Bash commands
  :
fi

# 1) Linux-only policy enforcement
UNAME="$(uname -s || true)"
if [[ "$UNAME" != "Linux" ]]; then
  echo "Akalynth policy: Linux-only dev + Android client. Current OS: $UNAME"
  exit 1
fi

# 2) Block common Windows command patterns (defensive)
# (This doesn't stop you from writing docs; it prevents accidental Windows-only instructions.)
if [[ -n "${CLAUDE_LAST_BASH_COMMAND:-}" ]]; then
  CMD="$CLAUDE_LAST_BASH_COMMAND"
  if echo "$CMD" | grep -Eqi '(powershell|cmd\.exe|winget|choco|scoop|msbuild|dotnet\\|\\\\)'; then
    echo "Blocked Windows-specific command by policy."
    exit 1
  fi
fi

# 3) If we're in a git repo, ensure no huge accidental blobs staged
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # warn on large staged files
  LARGE="$(git diff --cached --numstat 2>/dev/null | awk '$1 ~ /^[0-9]+$/ && $1 > 2000 {print}')"
  if [[ -n "$LARGE" ]]; then
    echo "Large staged diff detected. Consider splitting commit."
  fi
fi

exit 0
