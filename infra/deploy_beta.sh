#!/usr/bin/env bash
# Akalynth Beta Deploy Script
# Usage: ./infra/deploy_beta.sh [tag|branch]
# Example: ./infra/deploy_beta.sh v1.0.3-world-law

set -euo pipefail

REPO_ROOT="/opt/akalynth"
HEALTH_URL="https://beta-api.akalynth.com/v1/health"
SERVICE_NAME="akalynth"

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

# 3. Install dependencies
log "Installing dependencies..."
npm ci --ignore-scripts

# 3.1 Rebuild native deps (CI-safe)
log "Rebuilding native modules (better-sqlite3)..."
if npm rebuild better-sqlite3; then
    log "better-sqlite3 rebuild OK"
else
    warn "better-sqlite3 rebuild failed; falling back to full npm rebuild"
    npm rebuild
fi

# 3.2 Sanity: ensure module loads
log "Verifying better-sqlite3 can load..."
node -e "require('better-sqlite3'); console.log('better-sqlite3 OK')" >/dev/null
log "Native module load verified"

# 4. Build shared package
log "Building shared package..."
npm -w packages/shared run build

# 5. Build server
log "Building server..."
npm -w apps/server run build

# 6. Pre-flight: verify build exists
if [[ ! -f "$REPO_ROOT/dist/server/apps/server/src/index.js" ]]; then
    err "Build failed: dist/server/apps/server/src/index.js not found"
    exit 1
fi
log "Build verified"

# 7. Restart service
log "Restarting $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"

# 8. Wait for service to be ready
log "Waiting for service to start..."
sleep 3

# 9. Health check
log "Checking health at $HEALTH_URL..."
for i in {1..10}; do
    if curl -sf "$HEALTH_URL" | grep -q '"ok":true'; then
        log "Health check passed!"
        break
    fi
    if [[ $i -eq 10 ]]; then
        err "Health check failed after 10 attempts"
        err "=== Last 30 lines of journalctl ==="
        sudo journalctl -u "$SERVICE_NAME" --since "2 min ago" --no-pager | tail -30
        err "=== Caddy status ==="
        sudo systemctl status caddy --no-pager | head -10 || true
        exit 1
    fi
    warn "Attempt $i/10 failed, retrying..."
    sleep 2
done

# 10. Quick cert/origin sanity
log "Verifying TLS chain..."
if curl -sI "$HEALTH_URL" 2>/dev/null | grep -qi "cloudflare\|caddy"; then
    log "TLS chain OK (Cloudflare → Caddy → Node)"
else
    warn "Could not verify TLS chain (may still be OK)"
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
