#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPS_DIR="${AKALYNTH_OPS_ROOT:-$(cd "$ROOT_DIR/../.." && pwd)}"
cd "$ROOT_DIR"

echo "[council-dao-deploy-permit-v1] proof lane AKALYNTH_COUNCIL_DAO_DEPLOY_PERMIT_V1"
echo "[council-dao-deploy-permit-v1] commit: $(git rev-parse HEAD)"

echo "[council-dao-deploy-permit-v1] codex sample contract verifier"
npm -w apps/server run verify:council-dao-deploy-permit-v1

echo "[council-dao-deploy-permit-v1] ops gate + human ack verifier (includes v2 regression)"
"$OPS_DIR/scripts/verify-council-dao-deploy-permit-v1.sh"

echo "[council-dao-deploy-permit-v1] deploy permit checks passed"