#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERIFY="${ROOT}/scripts/verify_beta_android_distribution.sh"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/akalynth-android-distribution-test.XXXXXX")"
trap 'rm -rf -- "${TEMP_DIR}"' EXIT

manifest="${TEMP_DIR}/manifest.json"
cp -- "${ROOT}/infra/android/beta-client-update.json" "${manifest}"

run_verify() {
  AKALYNTH_ANDROID_MANIFEST="${manifest}" \
    "${VERIFY}" >/dev/null 2>&1
}

run_verify

python3 - "${manifest}" <<'PY'
import json
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
body = json.loads(path.read_text())
body["version_code"] = True
path.write_text(json.dumps(body) + "\n")
PY
if run_verify; then
  echo "boolean version_code was accepted" >&2
  exit 1
fi

cp -- "${ROOT}/infra/android/beta-client-update.json" "${manifest}"
python3 - "${manifest}" <<'PY'
import json
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
body = json.loads(path.read_text())
body["size_bytes"] = True
path.write_text(json.dumps(body) + "\n")
PY
if run_verify; then
  echo "boolean size_bytes was accepted" >&2
  exit 1
fi

cp -- "${ROOT}/infra/android/beta-client-update.json" "${manifest}"
python3 - "${manifest}" <<'PY'
import json
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
body = json.loads(path.read_text())
body["published_at"] = "not-a-time"
path.write_text(json.dumps(body) + "\n")
PY
if run_verify; then
  echo "invalid published_at was accepted" >&2
  exit 1
fi

cp -- "${ROOT}/infra/android/beta-client-update.json" "${manifest}"
python3 - "${manifest}" <<'PY'
import json
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
body = json.loads(path.read_text())
body["apk_sha256"] = "0" * 64
path.write_text(json.dumps(body) + "\n")
PY
if run_verify; then
  echo "manifest diverging from accepted identity was accepted" >&2
  exit 1
fi

if AKALYNTH_ANDROID_MANIFEST="${ROOT}/infra/android/beta-client-update.json" \
  AKALYNTH_ANDROID_ACCEPTED_IDENTITY="${manifest}" \
  "${VERIFY}" >/dev/null 2>&1; then
  echo "accepted Android identity override was accepted" >&2
  exit 1
fi

rm -- "${manifest}"
if run_verify; then
  echo "missing published manifest was accepted" >&2
  exit 1
fi

echo "beta Android distribution verifier tests passed"
