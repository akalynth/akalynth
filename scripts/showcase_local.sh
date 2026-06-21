#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[showcase] Akalynth local showcase preflight"

echo "[showcase] commit:"
git rev-parse HEAD

echo "[showcase] protocol sync"
./scripts/verify_protocol_sync.sh

echo "[showcase] server build"
cd apps/server
npm run build

echo "[showcase] MVP verification"
cd "$ROOT_DIR"
./scripts/verify_mvp.sh

echo "[showcase] agent economy simulation proof"
cd apps/server
npm run verify:agent-economy-simulation

echo "[showcase] chill-zone gather→refine→deliver closure"
bash "$ROOT_DIR/scripts/verify-chill-zone-showcase.sh"

echo "[showcase] debug client build"
cd "$ROOT_DIR/apps/debug-client"
npm run build

echo "[showcase] preflight complete"
echo "[showcase] optional human demo: CHILL_ZONE_GATHER_ENABLED=1 CHILL_ZONE_REFINE_ENABLED=1 ALLOW_INSECURE_LOCAL=1 npm run dev (apps/server)"
