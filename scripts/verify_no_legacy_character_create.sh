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

android_ui_matches="$(
  grep -RInE 'onCreate: \(name: String, sex: CharacterSex\)|onCreate = \{ [^,]+, [^,]+ ->|onCharacterCreated: \(name: String, sex' \
    "$ROOT_DIR/apps/android/app/src/main" \
    "$ROOT_DIR/apps/android/app/src/androidTest" \
    2>/dev/null || true
)"

if [[ -n "$android_ui_matches" ]]; then
  echo "$android_ui_matches" >&2
  die "Stale Android character create UI callback found. Character creation UI must emit name, world_id, sex, and outfit_id."
fi

for literal in \
  'onCreate: (name: String, worldId: String, sex: CharacterSex, outfitId: String) -> Unit' \
  'CharacterCreateScreen_WorldSelector' \
  'CharacterCreateScreen_OutfitSelector' \
  'CharacterCreateScreen_World_high_city' \
  'CharacterCreateScreen_Outfit_female_mage'; do
  if ! grep -RInF "$literal" "$ROOT_DIR/apps/android/app/src/main" "$ROOT_DIR/apps/android/app/src/androidTest" >/dev/null; then
    die "Missing Android account-character v2 UI proof literal: $literal"
  fi
done

for android_catalog_literal in \
  'fun `load worlds uses v1 worlds and filters legacy ids`()' \
  'fun `load outfits uses v1 outfits and filters invalid catalog entries`()' \
  'assertEquals("/v1/worlds", requestedPath())' \
  'assertEquals("/v1/outfits", requestedPath())'; do
  if ! grep -Fq "$android_catalog_literal" "$ROOT_DIR/apps/android/app/src/test/java/com/akalynth/client/network/IdentityApiAccountCharacterTest.kt"; then
    die "Missing Android account-character catalog route proof: $android_catalog_literal"
  fi
done

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

ui_doc_matches="$(
  grep -RInE 'No outfit picker in v0|Starter outfit auto-assigned|TBD \(server: world_state PlayerPublic\)|onCharacterCreated: \(name: String, sex|Emits \(name, sex\)|createEmitsCorrectData' \
    "$ROOT_DIR/docs/UI_PROPOSAL.md" \
    "$ROOT_DIR/docs/UI_IMPLEMENTATION_PROPOSAL.md" \
    "$ROOT_DIR/docs/UI_MAPPING_CHECKLIST.md" \
    "$ROOT_DIR/docs/UI_REGRESSION_MATRIX.md" \
    2>/dev/null || true
)"

if [[ -n "$ui_doc_matches" ]]; then
  echo "$ui_doc_matches" >&2
  die "Stale UI character creation docs found. UI docs must describe account-character v2 with world_id, sex, and outfit_id."
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

if ! grep -Fq 'test:web-economy' "$ROOT_DIR/package.json"; then
  die "Root verify:account-character must include server test:web-economy gameplay route proof."
fi

if ! grep -Fq ':app:compileDebugAndroidTestKotlin' "$ROOT_DIR/package.json"; then
  die "Root verify:account-character must compile Android character UI androidTest sources."
fi

if ! grep -Fq "run('npm', ['run', 'test:web-economy']);" "$ROOT_DIR/apps/server/tools/verify-server.mjs"; then
  die "Server verify:quick must include test:web-economy gameplay route proof."
fi

for server_literal in \
  "HTTP GET /v1/worlds is public" \
  "HTTP GET /v1/outfits is public" \
  "HTTP GET /v1/outfits filters by sex"; do
  if ! grep -Fq "$server_literal" "$ROOT_DIR/apps/server/tools/verify-character-v2.test.ts"; then
    die "Missing server account-character catalog route proof: $server_literal"
  fi
done

for gameplay_doc in "$ROOT_DIR/README.md" "$ROOT_DIR/docs/CURRENT_STAGE.md" "$ROOT_DIR/docs/V1_SCOPE.md" "$ROOT_DIR/scripts/README.md"; do
  if ! grep -Fq 'shop/work/property gameplay route proof' "$gameplay_doc"; then
    die "Missing account-character gameplay route proof wording in ${gameplay_doc#$ROOT_DIR/}"
  fi
done

for android_ui_doc in "$ROOT_DIR/README.md" "$ROOT_DIR/scripts/README.md"; do
  if ! grep -Fq 'Android character UI compile' "$android_ui_doc"; then
    die "Missing Android character UI compile wording in ${android_ui_doc#$ROOT_DIR/}"
  fi
done

echo "✅ No legacy create_character protocol path found"
