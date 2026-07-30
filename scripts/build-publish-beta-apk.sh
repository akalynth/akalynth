#!/usr/bin/env bash
# Build the beta Android APK, refresh the server update manifest, and print publish steps.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT/apps/android"
APK_OUT="$ANDROID_DIR/app/build/outputs/apk/beta/app-beta.apk"
MANIFEST_PATH="$ROOT/infra/android/beta-client-update.json"

log() { printf '[beta-apk] %s\n' "$1"; }

"$ROOT/scripts/verify_beta_android_distribution.sh"

source_version_code="$(python3 - "$ANDROID_DIR/app/build.gradle.kts" <<'PY'
import re, pathlib
import sys
text = pathlib.Path(sys.argv[1]).read_text()
match = re.search(r'versionCode\s*=\s*(\d+)', text)
print(match.group(1) if match else "0")
PY
)"
published_version_code="$(python3 - "$MANIFEST_PATH" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
value = json.loads(path.read_text())["version_code"]
if type(value) is not int or value < 1:
    raise SystemExit("published Android version_code must be a positive integer")
print(value)
PY
)"

if [[ "$source_version_code" -le "$published_version_code" ]]; then
  printf 'Refusing Android identity reuse/regression: source versionCode=%s, published version_code=%s.\n' \
    "$source_version_code" "$published_version_code" >&2
  printf 'Advance the Android version under a separately authorized direct-client release before publishing.\n' >&2
  exit 1
fi

EXPECTED_PUBLIC_APK_NAME="akalynth-beta-v${source_version_code}.apk"
PUBLIC_APK_NAME="${AKALYNTH_BETA_APK_NAME:-${EXPECTED_PUBLIC_APK_NAME}}"
if [[ "$PUBLIC_APK_NAME" != "$EXPECTED_PUBLIC_APK_NAME" ]]; then
  printf 'Refusing mutable or mismatched Android artifact name: got=%s expected=%s.\n' \
    "$PUBLIC_APK_NAME" "$EXPECTED_PUBLIC_APK_NAME" >&2
  exit 1
fi

cd "$ANDROID_DIR"
log "Running unit tests..."
./gradlew testBetaUnitTest
log "Building beta APK..."
./gradlew assembleBeta

if [[ ! -f "$APK_OUT" ]]; then
  echo "Expected APK not found: $APK_OUT" >&2
  exit 1
fi

sha256="$(sha256sum "$APK_OUT" | awk '{print $1}')"
size_bytes="$(wc -c < "$APK_OUT" | tr -d ' ')"
version_code="$(python3 - <<'PY'
import re, pathlib
text = pathlib.Path("app/build.gradle.kts").read_text()
match = re.search(r'versionCode\s*=\s*(\d+)', text)
print(match.group(1) if match else "0")
PY
)"
if [[ "$version_code" != "$source_version_code" ]]; then
  printf 'Android version changed during build: preflight=%s built=%s.\n' \
    "$source_version_code" "$version_code" >&2
  exit 1
fi
version_name="$(python3 - <<'PY'
import re, pathlib
text = pathlib.Path("app/build.gradle.kts").read_text()
match = re.search(r'versionName\s*=\s*"([^"]+)"', text)
print(match.group(1) if match else "unknown")
PY
)"
published_at="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
commit_sha="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"

cat > "$MANIFEST_PATH" <<JSON
{
  "ok": true,
  "lane": "beta",
  "version_code": ${version_code},
  "version_name": "${version_name}",
  "apk_url": "https://beta.akalynth.com/download/${PUBLIC_APK_NAME}",
  "apk_sha256": "${sha256}",
  "size_bytes": ${size_bytes},
  "required": false,
  "published_at": "${published_at}"
}
JSON

sha_sidecar="${APK_OUT}.sha256"
printf '%s  %s\n' "$sha256" "$PUBLIC_APK_NAME" > "$sha_sidecar"

AKALYNTH_ANDROID_APK_FILE="$APK_OUT" \
  "$ROOT/scripts/verify_beta_android_distribution.sh"

log "Built: $APK_OUT"
log "SHA-256: $sha256"
log "Size: $size_bytes bytes"
log "Manifest: $MANIFEST_PATH"
log "Commit: $commit_sha"
cat <<EOF

Publish steps:
1. Copy APK to beta web host:
     scp "$APK_OUT" ops-dev-01:/var/www/akalynth-beta/download/${PUBLIC_APK_NAME}
     scp "$sha_sidecar" ops-dev-01:/var/www/akalynth-beta/download/${PUBLIC_APK_NAME}.sha256
2. Point beta-api at the manifest:
     export AKALYNTH_ANDROID_BETA_UPDATE_JSON=$MANIFEST_PATH
     # or copy $MANIFEST_PATH to the beta server and set the env there, then restart akalynth-beta.
3. Install on device — existing beta clients below version_code ${version_code} will auto-update on next launch.

EOF
