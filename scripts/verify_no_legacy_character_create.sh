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
doc_paths=(
  "$ROOT_DIR/docs"
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

doc_matches="$(
  grep -RInE '\{"name":"Sovereign"\}|Success \(200\):|Guest accounts remain functional|Implement character creation flow|Proposed API surface \(specified in E4\)' "${doc_paths[@]}" \
    --include='CLIENT_CONTRACT_V0_1.md' \
    --include='ACCOUNT_CHARACTER_WORLD_MODEL.md' \
    2>/dev/null || true
)"

if [[ -n "$doc_matches" ]]; then
  echo "$doc_matches" >&2
  die "Stale account-character contract wording found. Document POST /v1/characters with account session, CSRF, world_id, sex, outfit_id, and 201 response."
fi

status_matches="$(
  grep -RInE 'Status: \*\*decided / no implementation\*\*|closed_account_portal_product_decision_recorded_no_implementation' \
    "$ROOT_DIR/docs/account-portal/AKALYNTH_ACCOUNT_PORTAL_PRODUCT_DECISION_V1/ACCOUNT_PORTAL_DECISION.md" \
    "$ROOT_DIR/docs/account-portal/AKALYNTH_ACCOUNT_PORTAL_PRODUCT_DECISION_V1/README.md" \
    2>/dev/null || true
)"

if [[ -n "$status_matches" ]]; then
  echo "$status_matches" >&2
  die "Stale account-portal status wording found. Current docs must distinguish the historical E0 receipt from later source implementation."
fi

site_doc_matches="$(
  grep -RInE "Today's .localStorage.-only preview|current pages are mockups storing data in the browser" \
    "$ROOT_DIR/docs/account-portal/AKALYNTH_ACCOUNT_PORTAL_PRODUCT_DECISION_V1/WEBSITE_PORTAL_ROLE.md" \
    2>/dev/null || true
)"

if [[ -n "$site_doc_matches" ]]; then
  echo "$site_doc_matches" >&2
  die "Stale website portal role wording found. Current docs must describe API-backed static frontend behavior without browser-local authority."
fi

sequence_matches="$(
  grep -RInE 'E6 brings Android to parity|should not start before the account \+ character|replace localStorage authority\. Keep honest preview wording where still mock' \
    "$ROOT_DIR/docs/account-portal/AKALYNTH_ACCOUNT_PORTAL_PRODUCT_DECISION_V1/IMPLEMENTATION_SEQUENCE.md" \
    "$ROOT_DIR/docs/account-portal/AKALYNTH_ACCOUNT_PORTAL_PRODUCT_DECISION_V1/ANDROID_PARITY_REQUIREMENTS.md" \
    2>/dev/null || true
)"

if [[ -n "$sequence_matches" ]]; then
  echo "$sequence_matches" >&2
  die "Stale account portal sequencing wording found. Current docs must distinguish source-level E5/E6 surfaces from production release proof."
fi

for status_doc in "$ROOT_DIR/docs/CURRENT_STAGE.md" "$ROOT_DIR/docs/V1_SCOPE.md"; do
  if ! grep -Fq 'Account-character entry v2' "$status_doc"; then
    die "Missing account-character entry v2 status in ${status_doc#$ROOT_DIR/}"
  fi
  if ! grep -Fq 'verify:account-character' "$status_doc"; then
    die "Missing account-character verifier reference in ${status_doc#$ROOT_DIR/}"
  fi
done

for index_doc in "$ROOT_DIR/README.md" "$ROOT_DIR/docs/README.md" "$ROOT_DIR/scripts/README.md"; do
  if ! grep -Fq 'verify:account-character' "$index_doc"; then
    die "Missing account-character verifier reference in ${index_doc#$ROOT_DIR/}"
  fi
done

echo "✅ No legacy create_character protocol path found"
