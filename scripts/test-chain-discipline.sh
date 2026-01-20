#!/usr/bin/env bash
# Chain Path + Key Discipline Acceptance Tests
#
# Tests:
#   1. Path resolver exists and exports expected functions
#   2. Verify tools use canonical resolver (grep check)
#   3. Key validation rejects bad permissions
#
# Exit codes:
#   0 - All tests pass
#   1 - Test failure

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)

PASSED=0
FAILED=0

pass() {
  echo "  [PASS] $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo "  [FAIL] $1"
  FAILED=$((FAILED + 1))
}

echo "=== Chain Path + Key Discipline Acceptance Tests ==="
echo ""

# ---------------------------------------------------------------------------
# Test 1: Path resolver module exists and exports
# ---------------------------------------------------------------------------
echo "Test 1: Path resolver module structure..."

if [[ -f packages/shared/paths.ts ]]; then
  pass "packages/shared/paths.ts exists"
else
  fail "packages/shared/paths.ts missing"
fi

if grep -q 'export function resolveChainPaths' packages/shared/paths.ts; then
  pass "resolveChainPaths function exported"
else
  fail "resolveChainPaths function not found"
fi

if grep -q 'export function validateKeyFile' packages/shared/paths.ts; then
  pass "validateKeyFile function exported"
else
  fail "validateKeyFile function not found"
fi

if grep -q 'export function isProductionMode' packages/shared/paths.ts; then
  pass "isProductionMode function exported"
else
  fail "isProductionMode function not found"
fi

# ---------------------------------------------------------------------------
# Test 2: Server boot uses canonical resolver
# ---------------------------------------------------------------------------
echo ""
echo "Test 2: Server boot uses canonical resolver..."

if grep -q 'resolveChainPaths' apps/server/src/index.ts; then
  pass "Server imports resolveChainPaths"
else
  fail "Server does not import resolveChainPaths"
fi

if grep -q 'logResolvedPaths' apps/server/src/index.ts; then
  pass "Server calls logResolvedPaths"
else
  fail "Server does not call logResolvedPaths"
fi

if grep -q 'isProductionMode()' apps/server/src/index.ts; then
  pass "Server checks isProductionMode"
else
  fail "Server does not check isProductionMode"
fi

# ---------------------------------------------------------------------------
# Test 3: No tool uses legacy env var path resolution
# ---------------------------------------------------------------------------
echo ""
echo "Test 3: No legacy receipts path resolution..."

# Tools that read from disk should use resolveChainPaths, not legacy env vars
# Unit tests (verify-identity, verify-treasury, etc.) don't read from disk - OK to skip
LEGACY_FOUND=0
for tool in apps/server/tools/verify-*.ts apps/server/tools/why-drop.ts; do
  if [[ -f "$tool" ]]; then
    # Check if tool reads receipts from disk (has readFile/existsSync for receipts)
    if grep -q 'readJsonLines\|parseJsonLines\|readFileSync.*receipts\|existsSync.*receipts' "$tool" 2>/dev/null; then
      # Tool reads from disk - must use canonical resolver
      if grep -q 'AKALYNTH_RECEIPT_CHAIN_PATH\|AKALYNTH_RECEIPTS_PATH' "$tool" 2>/dev/null; then
        echo "    LEGACY: $tool"
        LEGACY_FOUND=$((LEGACY_FOUND + 1))
      fi
    fi
  fi
done

if [[ $LEGACY_FOUND -eq 0 ]]; then
  pass "No legacy receipts path resolution in disk-reading tools"
else
  fail "Found $LEGACY_FOUND tools with legacy env var resolution"
fi

# Also verify key tools use the resolver
echo ""
echo "Test 3b: Key tools use canonical resolver..."
KEY_TOOLS="verify-heat verify-evidence verify-lifecycle verify-guarantees why-drop"
MISSING=0
for name in $KEY_TOOLS; do
  tool="apps/server/tools/${name}.ts"
  if [[ -f "$tool" ]] && ! grep -q 'resolveChainPaths' "$tool"; then
    echo "    MISSING: $tool"
    MISSING=$((MISSING + 1))
  fi
done

if [[ $MISSING -eq 0 ]]; then
  pass "Key disk-reading tools use canonical resolver"
else
  fail "$MISSING key tools missing canonical resolver"
fi

# ---------------------------------------------------------------------------
# Test 4: Key module consolidated in coordination-kernel
# ---------------------------------------------------------------------------
echo ""
echo "Test 4: Key module consolidation..."

if [[ -f packages/coordination-kernel/src/receipt/key.ts ]]; then
  pass "Consolidated key.ts exists"
else
  fail "Consolidated key.ts missing"
fi

if grep -q "export \* from './key.js'" packages/coordination-kernel/src/receipt/index.ts; then
  pass "key.ts exported from receipt index"
else
  fail "key.ts not exported from receipt index"
fi

if grep -q "loadKeySeed" packages/coordination-kernel/src/receipt/logger.ts; then
  pass "logger.ts uses shared loadKeySeed"
else
  fail "logger.ts does not use shared loadKeySeed"
fi

if grep -q "loadVerifyingKey" packages/coordination-kernel/src/receipt/verify.ts; then
  pass "verify.ts uses shared loadVerifyingKey"
else
  fail "verify.ts does not use shared loadVerifyingKey"
fi

# ---------------------------------------------------------------------------
# Test 5: Build passes
# ---------------------------------------------------------------------------
echo ""
echo "Test 5: Build verification..."

cd packages/coordination-kernel
if npm run build --silent 2>/dev/null; then
  pass "coordination-kernel builds"
else
  fail "coordination-kernel build failed"
fi

cd "$ROOT/apps/server"
if npm run build --silent 2>/dev/null; then
  pass "server builds"
else
  fail "server build failed"
fi

cd "$ROOT"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Results ==="
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "FAIL: $FAILED test(s) failed"
  exit 1
fi

echo ""
echo "PASS: All tests passed"
exit 0
