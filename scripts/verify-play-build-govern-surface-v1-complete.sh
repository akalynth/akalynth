#!/usr/bin/env bash
# AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1 — full loop closure (PR-7..14).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPS="${AKALYNTH_OPS_ROOT:-$(cd "$ROOT/../.." && pwd)}"
CODEX="${AKALYNTH_CODEX_REPO:-$OPS/repos/akalynth-codex}"
cd "$ROOT"

NODE="${NODE:-}"
if [[ -z "$NODE" ]]; then
  if command -v node >/dev/null 2>&1; then
    NODE="$(command -v node)"
  else
    NODE="$(ls -t "$HOME"/.vscode-server/cli/servers/*/server/node 2>/dev/null | head -1 || true)"
  fi
fi
[[ -n "$NODE" && -x "$NODE" ]] || { echo "verify-play-build-govern-surface-v1-complete: node not found" >&2; exit 127; }

"$NODE" ./node_modules/tsx/dist/cli.mjs apps/server/tools/verify-builder-draft-namespace-v1.ts
"$NODE" ./node_modules/tsx/dist/cli.mjs apps/server/tools/verify-builder-preview-api-v1.ts
"$NODE" ./node_modules/tsx/dist/cli.mjs apps/server/tools/verify-builder-preview-runtime-v1.ts
"$NODE" ./node_modules/tsx/dist/cli.mjs apps/server/tools/verify-builder-operator-review-v1.ts
"$NODE" ./apps/debug-client/scripts/verify-builder-panel-v1.mjs
"$NODE" ./node_modules/tsx/dist/cli.mjs packages/shared/test/builderDraft.test.ts
"$NODE" ./node_modules/tsx/dist/cli.mjs apps/server/tools/verify-play-build-govern-public-v1.ts
"$NODE" "$CODEX/tools/project.mjs" >/dev/null
"$NODE" ./node_modules/tsx/dist/cli.mjs apps/server/tools/verify-play-build-govern-surface-v1-complete.ts
"$OPS/scripts/verify-play-build-govern-surface-v1-complete.sh"

echo "verify-play-build-govern-surface-v1-complete: full loop passed"