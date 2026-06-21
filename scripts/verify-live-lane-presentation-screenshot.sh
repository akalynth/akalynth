#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[live-lane-screenshot] proof lane AKALYNTH_LIVE_BETA_STAGING_SCREENSHOT_PROOF_V1"
echo "[live-lane-screenshot] commit: $(git rev-parse HEAD)"

echo "[live-lane-screenshot] screenshot register contract verifier"
npm -w apps/server run verify:live-lane-presentation-screenshot

echo "[live-lane-screenshot] parent rookguard first30 presentation regression"
npm -w apps/server run verify:rookguard-first30-presentation

echo "[live-lane-screenshot] live lane presentation screenshot checks passed"