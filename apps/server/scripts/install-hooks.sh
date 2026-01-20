#!/bin/bash
# Akalynth Phase Gate — Install Git Hooks
#
# Installs pre-commit hook that enforces Civil Guarantees G1-G15.
#
# Usage:
#   cd apps/server
#   ./scripts/install-hooks.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$SERVER_DIR")"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

echo "[install-hooks] Installing Akalynth Phase Gate..."

# Ensure hooks directory exists
mkdir -p "$HOOKS_DIR"

# Create pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash
# Akalynth Phase Gate — Pre-commit Hook
# Enforces Civil Guarantees G1-G15 before allowing commits.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "========================================"
echo "  Akalynth Phase Gate (pre-commit)"
echo "========================================"
echo ""

# Find server directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
if [ -d "$REPO_ROOT/server" ]; then
  SERVER_DIR="$REPO_ROOT/server"
elif [ -d "$REPO_ROOT/apps/server" ]; then
  SERVER_DIR="$REPO_ROOT/apps/server"
else
  echo -e "${RED}ERROR: server directory not found (expected server/ or apps/server/)${NC}"
  exit 1
fi

cd "$SERVER_DIR"

# Check if we're in a state where gate checks make sense
# Skip if no node_modules (fresh clone, npm install not run)
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}SKIP: node_modules not found (run npm install first)${NC}"
  exit 0
fi

# Run the guarantee gate
# Use --skip-build for speed if tsconfig hasn't changed
echo "Running Civil Guarantees Gate..."
if npx tsx tools/verify-guarantees.ts --skip-build; then
  echo -e "${GREEN}Gate passed. Proceeding with commit.${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}========================================"
  echo "  COMMIT BLOCKED"
  echo "  Civil Guarantee violation detected."
  echo "  Run: npx tsx tools/verify-guarantees.ts --verbose"
  echo -e "========================================${NC}"
  exit 1
fi
EOF

chmod +x "$HOOKS_DIR/pre-commit"

echo "[install-hooks] Pre-commit hook installed at: $HOOKS_DIR/pre-commit"
echo "[install-hooks] Done."
echo ""
echo "To test the hook manually:"
echo "  cd apps/server && npx tsx tools/verify-guarantees.ts"
echo ""
echo "To bypass the hook (emergency only):"
echo "  git commit --no-verify"
echo ""
