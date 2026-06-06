#!/usr/bin/env bash
set -euo pipefail

apk_url="${AKALYNTH_BETA_APK_URL:-https://beta.akalynth.com/download/akalynth-beta.apk}"
sha_url="${AKALYNTH_BETA_APK_SHA256_URL:-${apk_url}.sha256}"
package_name="${AKALYNTH_ANDROID_PACKAGE:-com.akalynth.client}"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

apk_path="$tmp_dir/akalynth-beta.apk"
sha_path="$tmp_dir/akalynth-beta.apk.sha256"

printf 'Downloading APK: %s\n' "$apk_url"
curl -fsSL "$apk_url" -o "$apk_path"

printf 'Downloading checksum: %s\n' "$sha_url"
curl -fsSL "$sha_url" -o "$sha_path"

expected_hash="$(awk '{print $1}' "$sha_path")"
actual_hash="$(sha256sum "$apk_path" | awk '{print $1}')"

if [[ -z "$expected_hash" ]]; then
  printf 'APK smoke failed: checksum file did not contain a SHA-256 value.\n' >&2
  exit 1
fi

if [[ "$expected_hash" != "$actual_hash" ]]; then
  printf 'APK smoke failed: checksum mismatch.\n' >&2
  printf '  expected: %s\n' "$expected_hash" >&2
  printf '  actual:   %s\n' "$actual_hash" >&2
  exit 1
fi

apk_size="$(stat -c '%s' "$apk_path")"
printf 'APK checksum OK: %s (%s bytes)\n' "$actual_hash" "$apk_size"

if ! command -v adb >/dev/null 2>&1; then
  printf 'ADB not found; install/launch smoke skipped.\n'
  exit 0
fi

device_count="$(adb devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }')"
if [[ "$device_count" -eq 0 ]]; then
  printf 'No ADB device connected; install/launch smoke skipped.\n'
  exit 0
fi

printf 'Installing APK on connected ADB device...\n'
adb install -r "$apk_path"
printf 'Launching package: %s\n' "$package_name"
adb shell monkey -p "$package_name" 1 >/dev/null
printf 'APK installed and launch intent sent.\n'
