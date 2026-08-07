#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${AKALYNTH_ANDROID_MANIFEST:-${ROOT}/infra/android/beta-client-update.json}"
APK_FILE="${AKALYNTH_ANDROID_APK_FILE:-}"
ACCEPTED_IDENTITY="${ROOT}/docs/decisions/AKALYNTH_ANDROID_BETA_LONG_VERSION_V1/android-distribution-identity.json"
ACCEPTED_IDENTITY_SHA256="109ff486c2e89b303d104f22fa913c61e4176cca1e69e2824725f95863af793e"

if [[ -n "${AKALYNTH_ANDROID_ACCEPTED_IDENTITY:-}" ]]; then
  echo "AKALYNTH_ANDROID_ACCEPTED_IDENTITY override is forbidden" >&2
  exit 1
fi

python3 - "$MANIFEST" "$APK_FILE" "$ACCEPTED_IDENTITY" "$ACCEPTED_IDENTITY_SHA256" <<'PY'
import datetime
import hashlib
import json
import pathlib
import re
import sys
from urllib.parse import urlparse

manifest_path = pathlib.Path(sys.argv[1])
apk_path = pathlib.Path(sys.argv[2]) if sys.argv[2] else None
accepted_identity_path = pathlib.Path(sys.argv[3])
accepted_identity_sha256 = sys.argv[4]
try:
    data = json.loads(manifest_path.read_text())
except FileNotFoundError:
    raise SystemExit(f"manifest not found: {manifest_path}")
except json.JSONDecodeError as error:
    raise SystemExit(f"manifest is malformed JSON: {error}")
try:
    accepted_identity_bytes = accepted_identity_path.read_bytes()
    accepted = json.loads(accepted_identity_bytes)
except FileNotFoundError:
    raise SystemExit(f"accepted Android identity not found: {accepted_identity_path}")
except json.JSONDecodeError as error:
    raise SystemExit(f"accepted Android identity is malformed JSON: {error}")
if hashlib.sha256(accepted_identity_bytes).hexdigest() != accepted_identity_sha256:
    raise SystemExit("accepted Android identity digest does not match Release Repair v1 authority")

required = {
    "ok",
    "lane",
    "version_code",
    "version_name",
    "apk_url",
    "apk_sha256",
    "size_bytes",
    "required",
    "published_at",
}
missing = sorted(required.difference(data))
if missing:
    raise SystemExit(f"manifest missing fields: {', '.join(missing)}")
if data["ok"] is not True or data["lane"] != "beta":
    raise SystemExit("manifest must identify the active beta lane")
if type(data["version_code"]) is not int or data["version_code"] < 1:
    raise SystemExit("version_code must be a positive integer")
if not isinstance(data["version_name"], str) or not data["version_name"]:
    raise SystemExit("version_name must be a non-empty string")
if not isinstance(data["required"], bool):
    raise SystemExit("required must be boolean")
if type(data["size_bytes"]) is not int or data["size_bytes"] < 1:
    raise SystemExit("size_bytes must be a positive integer")
if not re.fullmatch(r"[0-9a-f]{64}", data["apk_sha256"]):
    raise SystemExit("apk_sha256 must be lowercase SHA-256")
if not isinstance(data["published_at"], str):
    raise SystemExit("published_at must be a UTC RFC 3339 timestamp")
try:
    published_at = datetime.datetime.fromisoformat(data["published_at"].replace("Z", "+00:00"))
except ValueError:
    raise SystemExit("published_at must be a valid UTC RFC 3339 timestamp")
if not data["published_at"].endswith("Z") or published_at.utcoffset() != datetime.timedelta(0):
    raise SystemExit("published_at must be a UTC RFC 3339 timestamp")

url = urlparse(data["apk_url"])
expected_name = f"akalynth-beta-v{data['version_code']}.apk"
if url.scheme != "https" or url.netloc != "beta.akalynth.com":
    raise SystemExit("apk_url must use the beta HTTPS distribution host")
if url.params or url.query or url.fragment:
    raise SystemExit("apk_url parameters, query, and fragment are forbidden")
if url.path != f"/download/{expected_name}":
    raise SystemExit(
        f"apk_url must use immutable versioned name {expected_name}; got {url.path}"
    )

accepted_required = {
    "schema_version",
    "decision_id",
    "lane",
    "version_code",
    "version_name",
    "apk_url",
    "apk_sha256",
    "size_bytes",
    "required",
    "published_at",
}
if set(accepted) != accepted_required:
    raise SystemExit("accepted Android identity has unexpected or missing fields")
if accepted["schema_version"] != "akalynth.accepted_android_distribution_identity.v1":
    raise SystemExit("accepted Android identity schema_version is unsupported")
if accepted["decision_id"] not in (
    "AKALYNTH_BETA_RELEASE_REPAIR_V1",
    "AKALYNTH_ANDROID_BETA_V13_UI_CHROME",
    "AKALYNTH_ANDROID_BETA_V14_ASSETS_FIX",
    "AKALYNTH_ANDROID_BETA_V15_LAYOUT_STABILIZE",
    "AKALYNTH_ANDROID_BETA_V16_CHROME_CLEAN",
    "AKALYNTH_ANDROID_BETA_V17_ITEM_ICONS",
    "AKALYNTH_ANDROID_BETA_LONG_VERSION_V1",
):
    raise SystemExit("accepted Android identity decision_id is not release authority")
for field in (
    "lane",
    "version_code",
    "version_name",
    "apk_url",
    "apk_sha256",
    "size_bytes",
    "required",
    "published_at",
):
    if data[field] != accepted[field]:
        raise SystemExit(
            f"manifest {field} does not match accepted identity: "
            f"actual={data[field]!r} accepted={accepted[field]!r}"
        )

if apk_path:
    if not apk_path.is_file():
        raise SystemExit(f"APK not found: {apk_path}")
    digest = hashlib.sha256(apk_path.read_bytes()).hexdigest()
    size = apk_path.stat().st_size
    if digest != data["apk_sha256"]:
        raise SystemExit(
            f"APK SHA-256 mismatch: actual={digest} manifest={data['apk_sha256']}"
        )
    if size != data["size_bytes"]:
        raise SystemExit(
            f"APK size mismatch: actual={size} manifest={data['size_bytes']}"
        )

print(
    "beta Android distribution manifest verified "
    f"version_code={data['version_code']} apk={expected_name} "
    f"authority={accepted['decision_id']}"
)
PY
