#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPS="${AKALYNTH_OPS_ROOT:-$(cd "$ROOT/../.." && pwd)}"
cd "$ROOT"
npm -w apps/server run verify:council-publish-play-permit-v1
"$OPS/scripts/verify-council-publish-play-permit-v1.sh"