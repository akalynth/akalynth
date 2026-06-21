#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[rookguard-first30-presentation] proof lane AKALYNTH_ROOKGUARD_FIRST30_PRESENTATION_V1"
echo "[rookguard-first30-presentation] commit: $(git rev-parse HEAD)"

echo "[rookguard-first30-presentation] focused presentation transcript verifier"
npm -w apps/server run verify:rookguard-first30-presentation

echo "[rookguard-first30-presentation] rookguard quest projection regression"
npm -w apps/server run verify:rookguard-quest

echo "[rookguard-first30-presentation] live WebSocket Codex Path e2e"
npm -w apps/server run verify:rookguard-codex-path

echo "[rookguard-first30-presentation] rookguard first30 presentation checks passed"