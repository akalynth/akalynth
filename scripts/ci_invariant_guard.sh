#!/usr/bin/env bash
set -euo pipefail

# CI Invariant Guard
# Enforces API-first invariants from CLAUDE.md
# Fast, deterministic, no external dependencies

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { echo -e "  $*"; }
pass() { echo -e "\033[32m✅ $*\033[0m"; }
fail() { echo -e "\033[31m❌ $*\033[0m"; }
header() { echo -e "\n\033[1m$*\033[0m"; }

# Determine changed files
get_changed_files() {
  # Try origin/main first (PR context), fallback to HEAD~1 (push context)
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only HEAD~1 2>/dev/null || echo ""
  else
    git diff --name-only HEAD~1 2>/dev/null || echo ""
  fi
}

header "API-First Invariant Guard"
log "Repo: $ROOT_DIR"

CHANGED_FILES="$(get_changed_files)"

if [[ -z "$CHANGED_FILES" ]]; then
  log "No changed files detected (initial commit or clean state)"
  pass "Invariant guard: nothing to check"
  exit 0
fi

log "Changed files:"
echo "$CHANGED_FILES" | sed 's/^/    /'

# Categorize changes
PROTOCOL_CHANGED=0
HTTP_CHANGED=0
API_CHANGED=0
SERVER_SRC_CHANGED=0
SHARED_CHANGED=0
SCRIPTS_CHANGED=0
DOCS_ONLY=1

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  case "$file" in
    packages/shared/protocol.ts)
      PROTOCOL_CHANGED=1
      DOCS_ONLY=0
      ;;
    packages/shared/http.ts)
      HTTP_CHANGED=1
      DOCS_ONLY=0
      ;;
    apps/server/src/api/*)
      API_CHANGED=1
      DOCS_ONLY=0
      ;;
    apps/server/src/*)
      SERVER_SRC_CHANGED=1
      DOCS_ONLY=0
      ;;
    packages/shared/*)
      SHARED_CHANGED=1
      DOCS_ONLY=0
      ;;
    scripts/*)
      SCRIPTS_CHANGED=1
      DOCS_ONLY=0
      ;;
    docs/*|*.md|.gitignore|.github/*)
      # These don't break DOCS_ONLY
      ;;
    *)
      # Other files break DOCS_ONLY
      DOCS_ONLY=0
      ;;
  esac
done <<< "$CHANGED_FILES"

header "Invariants Triggered"

ERRORS=0

# Invariant A: Protocol changes require docs sync
if [[ "$PROTOCOL_CHANGED" -eq 1 ]]; then
  log "Invariant A: packages/shared/protocol.ts changed"
  if [[ ! -f "$ROOT_DIR/scripts/verify_protocol_sync.sh" ]]; then
    fail "Missing scripts/verify_protocol_sync.sh"
    ERRORS=$((ERRORS + 1))
  else
    pass "verify_protocol_sync.sh exists (will run in CI)"
  fi
fi

# Invariant B: HTTP/API changes require verify_mvp.sh
if [[ "$HTTP_CHANGED" -eq 1 ]] || [[ "$API_CHANGED" -eq 1 ]]; then
  log "Invariant B: HTTP API surface changed (packages/shared/http.ts or apps/server/src/api/**)"
  if [[ ! -f "$ROOT_DIR/scripts/verify_mvp.sh" ]]; then
    fail "Missing scripts/verify_mvp.sh"
    ERRORS=$((ERRORS + 1))
  else
    pass "verify_mvp.sh exists (will run in CI)"
  fi
fi

# Invariant C: Server src changes require verify_mvp.sh
if [[ "$SERVER_SRC_CHANGED" -eq 1 ]]; then
  log "Invariant C: apps/server/src/** changed"
  if [[ ! -f "$ROOT_DIR/scripts/verify_mvp.sh" ]]; then
    fail "Missing scripts/verify_mvp.sh"
    ERRORS=$((ERRORS + 1))
  else
    pass "verify_mvp.sh exists (will run in CI)"
  fi
fi

# Invariant D: Core verification always required for runtime changes
if [[ "$DOCS_ONLY" -eq 0 ]]; then
  log "Invariant D: Runtime changes detected"

  REQUIRED_SCRIPTS=("verify_protocol_sync.sh" "verify_mvp.sh")
  for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [[ ! -f "$ROOT_DIR/scripts/$script" ]]; then
      fail "Missing required script: scripts/$script"
      ERRORS=$((ERRORS + 1))
    fi
  done

  if [[ "$ERRORS" -eq 0 ]]; then
    pass "All required verification scripts exist"
  fi
else
  log "Docs-only change detected, skipping runtime invariant checks"
  pass "Docs-only changes are allowed"
fi

header "Summary"

if [[ "$ERRORS" -gt 0 ]]; then
  fail "Invariant guard failed with $ERRORS error(s)"
  log ""
  log "API-first invariants (from CLAUDE.md) require:"
  log "  - Protocol changes must sync with docs/PROTOCOL.md"
  log "  - HTTP/API changes must pass verify_mvp.sh"
  log "  - All runtime changes must pass full verification"
  exit 1
fi

pass "All invariants satisfied"
exit 0
