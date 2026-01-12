#!/usr/bin/env bash
# Akalynth Bootstrap Script (Debian Trixie-safe)
# Installs dependencies for the MMO server
# Linux only - will fail on other platforms

set -euo pipefail

# ============================================================================
# Platform check - Linux only
# ============================================================================
if [[ "$(uname -s)" != "Linux" ]]; then
    echo "ERROR: This script only runs on Linux."
    echo "Windows and macOS are not supported."
    exit 1
fi

# ============================================================================
# Root check
# ============================================================================
if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root (use sudo)."
    exit 1
fi

# ============================================================================
# Temp directory setup (avoid /tmp permission issues)
# ============================================================================
REAL_USER="${SUDO_USER:-$USER}"
REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)
TMP_DIR="${REAL_HOME}/.tmp"

mkdir -p "$TMP_DIR"
chown "$REAL_USER:$REAL_USER" "$TMP_DIR"
export TMPDIR="$TMP_DIR"

echo "=== Akalynth Bootstrap (Linux) ==="
echo "User: $REAL_USER"
echo "Temp: $TMP_DIR"
echo ""

# ============================================================================
# Update package lists
# ============================================================================
echo ">>> Updating package lists..."
apt-get update -qq

# ============================================================================
# Install base dependencies (Debian Trixie-safe, no software-properties-common)
# ============================================================================
echo ">>> Installing base dependencies..."
apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    build-essential \
    nodejs \
    npm

# ============================================================================
# Verify installations
# ============================================================================
echo ""
echo ">>> Verifying installations..."
echo "Node.js: $(node --version 2>/dev/null || echo 'NOT INSTALLED')"
echo "npm:     $(npm --version 2>/dev/null || echo 'NOT INSTALLED')"
echo "git:     $(git --version 2>/dev/null || echo 'NOT INSTALLED')"

# ============================================================================
# Done
# ============================================================================
echo ""
echo "=== Bootstrap complete ==="
echo ""
echo "Next steps:"
echo "  cd apps/server && npm install && npm run dev"
echo ""
