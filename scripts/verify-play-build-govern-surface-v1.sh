#!/usr/bin/env bash
# AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1 — repo + ops verifier chain.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPS="${AKALYNTH_OPS_ROOT:-$(cd "$ROOT/../.." && pwd)}"
cd "$ROOT"

NODE="${NODE:-}"
if [[ -z "$NODE" ]]; then
  if command -v node >/dev/null 2>&1; then
    NODE="$(command -v node)"
  else
    NODE="$(ls -t "$HOME"/.vscode-server/cli/servers/*/server/node 2>/dev/null | head -1 || true)"
  fi
fi
[[ -n "$NODE" && -x "$NODE" ]] || { echo "verify-play-build-govern-surface-v1: node not found" >&2; exit 127; }

"$NODE" ./node_modules/tsx/dist/cli.mjs apps/server/tools/verify-play-build-govern-surface-v1.ts
"$NODE" ./node_modules/tsx/dist/cli.mjs apps/server/tools/verify-builder-draft-namespace-v1.ts
"$NODE" ./node_modules/tsx/dist/cli.mjs apps/server/tools/verify-builder-preview-api-v1.ts
"$NODE" ./node_modules/tsx/dist/cli.mjs apps/server/tools/verify-builder-preview-runtime-v1.ts
"$NODE" ./node_modules/tsx/dist/cli.mjs apps/server/tools/verify-builder-operator-review-v1.ts
"$NODE" ./apps/debug-client/scripts/verify-builder-panel-v1.mjs
"$NODE" ./node_modules/tsx/dist/cli.mjs packages/shared/test/builderDraft.test.ts
"$OPS/scripts/verify-play-build-govern-surface-v1.sh"

echo "verify-play-build-govern-surface-v1: repo + ops chain passed"