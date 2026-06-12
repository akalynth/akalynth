#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() {
  echo "❌ $*" >&2
  exit 1
}

scan_paths=(
  "$ROOT_DIR/packages"
  "$ROOT_DIR/apps/server/src"
  "$ROOT_DIR/apps/debug-client/src"
  "$ROOT_DIR/apps/android/app/src/main"
  "$ROOT_DIR/apps/android/app/src/test"
)

for path in "${scan_paths[@]}"; do
  [[ -e "$path" ]] || die "Missing scan path: $path"
done

matches="$(
  grep -RIn "create_character" "${scan_paths[@]}" \
    --exclude-dir=build \
    --exclude-dir=dist \
    --exclude='*.jsonl' \
    2>/dev/null || true
)"

if [[ -n "$matches" ]]; then
  echo "$matches" >&2
  die "Legacy WebSocket create_character path found. Use account/session/CSRF POST /v1/characters instead."
fi

echo "✅ No legacy create_character protocol path found"
