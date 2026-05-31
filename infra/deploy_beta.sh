#!/usr/bin/env bash
# Akalynth Beta Deploy Script
# NOTE: this file name is historical; it is retained for existing runbooks and operators.
# Default deploy health target is the active API: https://api.akalynth.com/v1/health.
# Set AKALYNTH_HEALTH_URL to override for beta or alternate lanes.
# Usage: ./infra/deploy_beta.sh [tag|branch]
# Example: ./infra/deploy_beta.sh v1.0.3-world-law

set -euo pipefail

REPO_ROOT="/opt/akalynth"
HEALTH_URL="${AKALYNTH_HEALTH_URL:-https://api.akalynth.com/v1/health}"
SERVICE_NAME="akalynth"
# Startup grace before the first health probe. Bumped from 3s to avoid racing
# DB-replay cold starts. Override with AKALYNTH_STARTUP_GRACE if needed.
STARTUP_GRACE="${AKALYNTH_STARTUP_GRACE:-10}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $1"; }
err() { echo -e "${RED}[deploy]${NC} $1" >&2; }
info() { echo -e "${CYAN}[deploy]${NC} $1"; }

cd "$REPO_ROOT"

# Show current state before deploy
CURRENT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
# Full SHA of the pre-deploy HEAD; used as the rollback target if the new build
# fails its health check. Captured before any checkout so it is unambiguous.
ROLLBACK_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
info "Current running: $CURRENT_SHA ($(git describe --tags --always 2>/dev/null || echo 'no tag'))"

# 1. Determine target ref
TARGET_REF="${1:-}"
if [[ -z "$TARGET_REF" ]]; then
    warn "No ref specified, pulling latest from current branch"
    TARGET_REF=$(git rev-parse --abbrev-ref HEAD)
fi

log "Deploying: $TARGET_REF"

# 2. Fetch and checkout
log "Fetching latest..."
git fetch --all --tags --prune

log "Checking out $TARGET_REF..."
git checkout "$TARGET_REF"

if git rev-parse "refs/tags/$TARGET_REF" &>/dev/null; then
    log "Tag detected, already at exact ref"
else
    log "Pulling latest for branch..."
    git pull --ff-only origin "$TARGET_REF" || warn "Pull skipped (not a tracking branch)"
fi

COMMIT=$(git rev-parse --short HEAD)
log "At commit: $COMMIT"

# --- Reusable build/restart/health steps (used by deploy and rollback) ---

# Install deps, rebuild native modules, build packages + server, verify artifact.
build_and_verify() {
    log "Installing dependencies..."
    npm ci --ignore-scripts

    log "Rebuilding native modules (better-sqlite3)..."
    if npm rebuild better-sqlite3; then
        log "better-sqlite3 rebuild OK"
    else
        warn "better-sqlite3 rebuild failed; falling back to full npm rebuild"
        npm rebuild
    fi

    log "Verifying better-sqlite3 can load..."
    node -e "require('better-sqlite3'); console.log('better-sqlite3 OK')" >/dev/null
    log "Native module load verified"

    log "Building workspace packages..."
    npm run build:packages

    log "Building server..."
    npm -w apps/server run build

    if [[ ! -f "$REPO_ROOT/dist/server/apps/server/src/index.js" ]]; then
        err "Build failed: dist/server/apps/server/src/index.js not found"
        return 1
    fi
    log "Build verified"
}

# Restart the service, wait out the startup grace, then poll the health endpoint.
# Returns non-zero if the service is not healthy after the retries.
restart_and_check() {
    log "Restarting $SERVICE_NAME..."
    sudo systemctl restart "$SERVICE_NAME"

    log "Waiting ${STARTUP_GRACE}s for service to start (DB-replay cold start)..."
    sleep "$STARTUP_GRACE"

    log "Checking health at $HEALTH_URL..."
    local i
    for i in {1..10}; do
        if curl -sf "$HEALTH_URL" | grep -q '"ok":true'; then
            log "Health check passed!"
            return 0
        fi
        warn "Attempt $i/10 failed, retrying..."
        sleep 2
    done

    err "Health check failed after 10 attempts"
    err "=== Last 30 lines of journalctl ==="
    sudo journalctl -u "$SERVICE_NAME" --since "2 min ago" --no-pager | tail -30
    err "=== Caddy status ==="
    sudo systemctl status caddy --no-pager | head -10 || true
    return 1
}

# Roll back to the pre-deploy commit, rebuild, restart, and re-check.
# Exits non-zero if rollback itself cannot be completed.
rollback() {
    if [[ -z "$ROLLBACK_SHA" ]]; then
        err "No rollback target captured; cannot auto-roll back. Manual intervention required."
        exit 1
    fi
    warn "Rolling back to previous commit $ROLLBACK_SHA..."
    if ! git checkout --force "$ROLLBACK_SHA"; then
        err "Rollback checkout to $ROLLBACK_SHA failed. Manual intervention required."
        exit 1
    fi
    if ! build_and_verify; then
        err "Rollback rebuild failed. Manual intervention required."
        exit 1
    fi
    if ! restart_and_check; then
        err "Rollback health check FAILED — service is down on both new and previous commit."
        err "Manual intervention required."
        exit 1
    fi
    warn "=== Rollback complete: now running previous commit $ROLLBACK_SHA ==="
    warn "Investigate the failed deploy of $COMMIT before retrying."
    exit 1
}

# 3-6. Build the target ref.
build_and_verify

# 7-9. Restart and health check; roll back on failure.
if ! restart_and_check; then
    err "Deploy of $COMMIT failed health check; initiating rollback."
    rollback
fi

# 10. Quick proxy/origin sanity
log "Verifying proxy/origin chain..."
if curl -sD - -o /dev/null "$HEALTH_URL" 2>/dev/null | grep -qi "cloudflare\|caddy"; then
    log "Proxy/origin chain OK"
else
    warn "Could not verify proxy/origin chain (may still be OK)"
fi

# 11. Show status
echo ""
log "=== Deploy complete ==="
echo "  From:   $CURRENT_SHA"
echo "  To:     $COMMIT ($TARGET_REF)"
echo "  Time:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  Health: $HEALTH_URL"
echo ""
sudo systemctl status "$SERVICE_NAME" --no-pager | head -10

echo ""
info "Git status:"
git status -sb
if [[ "$(git rev-parse --abbrev-ref HEAD)" == "HEAD" ]]; then
    warn "Detached HEAD detected; returning to main"
    git checkout main || warn "Failed to switch back to main"
    info "Git status:"
    git status -sb
fi
