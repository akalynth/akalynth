#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[forgehold-ashglass-evidence] proof lane AKALYNTH_FORGEHOLD_ASHGLASS_EVIDENCE_V1"
echo "[forgehold-ashglass-evidence] commit: $(git rev-parse HEAD)"

echo "[forgehold-ashglass-evidence] focused Act II evidence verifier"
npm -w apps/server run verify:forgehold-ashglass-evidence

echo "[forgehold-ashglass-evidence] onward route survey regression"
npm -w apps/server run verify:route-surveys

echo "[forgehold-ashglass-evidence] forgehold ashglass evidence checks passed"