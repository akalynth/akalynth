#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "[forgehold-missing-shipment-v1] commit: $(git rev-parse HEAD)"
npm -w apps/server run verify:forgehold-missing-shipment-v1
npm -w apps/server run verify:forgehold-ashglass-evidence
echo "[forgehold-missing-shipment-v1] passed"