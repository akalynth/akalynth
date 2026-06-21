#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[chill-zone-showcase] proof lane AKALYNTH_CHILL_ZONE_SHOWCASE_CLOSURE_V1"
echo "[chill-zone-showcase] commit: $(git rev-parse HEAD)"

echo "[chill-zone-showcase] unit gather gate tests"
npm -w apps/server run test:gather

echo "[chill-zone-showcase] WS E2E gather→refine→deliver (both flags on)"
CHILL_ZONE_GATHER_ENABLED=1 CHILL_ZONE_REFINE_ENABLED=1 npm -w apps/server run test:gather-loop

echo "[chill-zone-showcase] debug-client gather wire authority"
npm -w apps/debug-client run verify:gather-client

echo "[chill-zone-showcase] chill-zone showcase closure checks passed"