#!/usr/bin/env bash
# Build the beta Android APK, refresh the server update manifest + accepted
# distribution identity, and print publish steps.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT/apps/android"
APK_OUT="$ANDROID_DIR/app/build/outputs/apk/beta/app-beta.apk"
MANIFEST_PATH="$ROOT/infra/android/beta-client-update.json"
VERIFY_SCRIPT="$ROOT/scripts/verify_beta_android_distribution.sh"
IDENTITY_DIR="$ROOT/docs/decisions/AKALYNTH_ANDROID_BETA_V15_LAYOUT_STABILIZE"
IDENTITY_PATH="$IDENTITY_DIR/android-distribution-identity.v15.json"

log() { printf '[beta-apk] %s\n' "$1"; }

# Preflight: currently published identity must still verify (fail-closed base).
"$VERIFY_SCRIPT"

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

if [[ ! -f "$IDENTITY_DIR/DECISION.md" ]]; then
  printf 'Missing advance decision for v%s: %s/DECISION.md\n' \
    "$source_version_code" "$IDENTITY_DIR" >&2
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

mkdir -p "$IDENTITY_DIR"
cat > "$IDENTITY_PATH" <<JSON
{
  "schema_version": "akalynth.accepted_android_distribution_identity.v1",
  "decision_id": "AKALYNTH_ANDROID_BETA_V15_LAYOUT_STABILIZE",
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

identity_sha256="$(sha256sum "$IDENTITY_PATH" | awk '{print $1}')"

# Pin verifier to the newly sealed identity (path + content digest).
python3 - "$VERIFY_SCRIPT" "$IDENTITY_PATH" "$identity_sha256" <<'PY'
from pathlib import Path
import sys
verify = Path(sys.argv[1])
identity = Path(sys.argv[2])
digest = sys.argv[3]
text = verify.read_text()
# Replace ACCEPTED_IDENTITY path assignment
import re
rel = identity.as_posix()
root_token = 'ROOT/'
# store path relative to ROOT using the same style as before
# identity is under ROOT/...
try:
    rel_path = identity.relative_to(verify.parent.parent)
except ValueError:
    rel_path = identity
rel_posix = rel_path.as_posix()
text2, n1 = re.subn(
    r'ACCEPTED_IDENTITY="\$\{ROOT\}/[^"]+"',
    f'ACCEPTED_IDENTITY="${{ROOT}}/{rel_posix}"',
    text,
    count=1,
)
text3, n2 = re.subn(
    r'ACCEPTED_IDENTITY_SHA256="[0-9a-f]{64}"',
    f'ACCEPTED_IDENTITY_SHA256="{digest}"',
    text2,
    count=1,
)
if n1 != 1 or n2 != 1:
    raise SystemExit(f"failed to pin verifier (n1={n1} n2={n2})")
# Allow decision_id for v13 authority (still akalynth.accepted_android_distribution_identity.v1)
text3 = text3.replace(
    'if accepted["decision_id"] != "AKALYNTH_BETA_RELEASE_REPAIR_V1":\n'
    '    raise SystemExit("accepted Android identity decision_id is not release authority")',
    'if accepted["decision_id"] not in (\n'
    '    "AKALYNTH_BETA_RELEASE_REPAIR_V1",\n'
    '    "AKALYNTH_ANDROID_BETA_V15_LAYOUT_STABILIZE",\n'
    '):\n'
    '    raise SystemExit("accepted Android identity decision_id is not release authority")',
)
verify.write_text(text3)
print(f"pinned verifier → {rel_posix} sha256={digest}")
PY

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

# Stage APK under evidence for the PR (host publish is still operator custody).
EVIDENCE_DIR="$ROOT/evidence/android-beta-v${version_code}"
mkdir -p "$EVIDENCE_DIR"
cp -f "$APK_OUT" "$EVIDENCE_DIR/${PUBLIC_APK_NAME}"
cp -f "$sha_sidecar" "$EVIDENCE_DIR/${PUBLIC_APK_NAME}.sha256"
cp -f "$MANIFEST_PATH" "$EVIDENCE_DIR/beta-client-update.json"
cp -f "$IDENTITY_PATH" "$EVIDENCE_DIR/android-distribution-identity.v${version_code}.json"

AKALYNTH_ANDROID_APK_FILE="$APK_OUT" \
  "$VERIFY_SCRIPT"

log "Built: $APK_OUT"
log "SHA-256: $sha256"
log "Size: $size_bytes bytes"
log "Manifest: $MANIFEST_PATH"
log "Identity: $IDENTITY_PATH"
log "Evidence: $EVIDENCE_DIR"
log "Commit: $commit_sha"
cat <<EOF

Publish steps (operator custody — not done by this script):
1. Copy APK + checksum to beta web host:
     scp "$EVIDENCE_DIR/${PUBLIC_APK_NAME}" \\
         ops-dev-01:/var/www/akalynth-beta/download/${PUBLIC_APK_NAME}
     scp "$EVIDENCE_DIR/${PUBLIC_APK_NAME}.sha256" \\
         ops-dev-01:/var/www/akalynth-beta/download/${PUBLIC_APK_NAME}.sha256
2. Install update manifest on beta-api host:
     scp "$MANIFEST_PATH" ops-dev-01:/etc/akalynth/android/beta-client-update.json
     # set AKALYNTH_ANDROID_BETA_UPDATE_JSON to that path and restart beta-api
3. Verify:
     curl -sS 'https://beta-api.akalynth.com/v1/client/android-update?lane=beta' | jq .
     curl -sSI "https://beta.akalynth.com/download/${PUBLIC_APK_NAME}" | head
4. Existing beta clients with version_code < ${version_code} self-update on next app start.

EOF
