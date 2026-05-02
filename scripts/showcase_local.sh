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

echo "[showcase] debug client build"
cd apps/debug-client
npm run build

echo "[showcase] preflight complete"
