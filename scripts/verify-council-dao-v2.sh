#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPS_DIR="${AKALYNTH_OPS_ROOT:-$(cd "$ROOT_DIR/../.." && pwd)}"
cd "$ROOT_DIR"

echo "[council-dao-v2] proof lane AKALYNTH_COUNCIL_DAO_V2"
echo "[council-dao-v2] commit: $(git rev-parse HEAD)"

echo "[council-dao-v2] codex sample contract verifier"
npm -w apps/server run verify:council-dao-v2

echo "[council-dao-v2] ops gate + ledger verifier (includes v1 regression)"
"$OPS_DIR/scripts/verify-council-dao-v2.sh"

echo "[council-dao-v2] council treasury reputation checks passed"