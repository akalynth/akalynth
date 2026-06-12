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

android_error_matches="$(
  grep -RInE 'Sign in first for account character creation|Session expired\. Sign out and sign in again\.|Verify your email before creating account characters\.|That name is already taken\.' \
    "$ROOT_DIR/apps/android/app/src/main" \
    2>/dev/null || true
)"

if [[ -n "$android_error_matches" ]]; then
  echo "$android_error_matches" >&2
  die "Stale Android account-character error copy found. Preserve IdentityApi account-character messages instead of remapping to older text."
fi

for android_activity_error_literal in \
  '"invalid_input" -> message.ifBlank { "Choose a valid name, world, sex, and outfit." }' \
  '"name_taken" -> message.ifBlank { "That character name is already taken." }' \
  '"character_not_found", "not_found" -> message.ifBlank { "That character is not available on the signed-in account." }' \
  '"not_authenticated", "csrf_missing", "csrf_failed", "email_unverified" -> message' \
  'Verify email before creating; existing characters can still be selected.'; do
  if ! grep -Fq "$android_activity_error_literal" "$ROOT_DIR/apps/android/app/src/main/java/com/akalynth/client/CharacterCreateActivity.kt"; then
    die "Missing Android activity account-character error proof literal: $android_activity_error_literal"
  fi
done

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
  'fun `create character posts session cookie csrf header and v2 body`()' \
  'fun `select character posts session cookie and csrf header`()' \
  'fun `create character maps invalid input to actionable message`()' \
  'fun `select character maps not found to account-scoped message`()' \
  'assertEquals("/v1/worlds", requestedPath())' \
  'assertEquals("/v1/outfits", requestedPath())' \
  'assertEquals("/v1/characters", request()["path"])' \
  'assertEquals("/v1/characters/select", request()["path"])' \
  'assertEquals("csrf-test", request()["csrf"])' \
  'assertEquals("Choose a valid name, world, sex, and outfit.", error?.message)' \
  'assertEquals("That character is not available on the signed-in account.", error?.message)'; do
  if ! grep -Fq "$android_catalog_literal" "$ROOT_DIR/apps/android/app/src/test/java/com/akalynth/client/network/IdentityApiAccountCharacterTest.kt"; then
    die "Missing Android account-character catalog route proof: $android_catalog_literal"
  fi
done

for android_token_scope_literal in \
  'val authToken = identityStore.getToken()' \
  'wsClient.send(LoginMessage(token = authToken))' \
  'wsClient.send(LoginMessage(guestToken = guestToken))' \
  'val storedToken = identityStore?.getToken()' \
  'val resolvedToken = listOf(authToken, this.authToken, storedToken)' \
  'put("token", resolvedToken)' \
  'put("guest_token", JSONObject.NULL)' \
  'No auth token present -> falling back to guest login'; do
  if ! grep -RInF "$android_token_scope_literal" "$ROOT_DIR/apps/android/app/src/main/java/com/akalynth/client" >/dev/null; then
    die "Missing Android token-scoped gameplay/login proof literal: $android_token_scope_literal"
  fi
done

for android_intent_only_literal in \
  'data class StartWorkContractMessage(' \
  '@SerialName("contract_type") val contractType: String = WorkContractType.TEMPLE_SWEEP' \
  'data class WorkTickMessage(' \
  '@SerialName("contract_id") val contractId: String' \
  'data class BuyHouseMessage(' \
  '@SerialName("property_id") val propertyId: String' \
  'data class ListHouseMessage(' \
  'val price: Int' \
  'data class UnlistHouseMessage(' \
  'is StartWorkContractMessage -> obj("start_work_contract")' \
  'is WorkTickMessage -> obj("work_tick") { put("contract_id", msg.contractId) }' \
  'is BuyHouseMessage -> obj("buy_house") { put("property_id", msg.propertyId) }' \
  'is ListHouseMessage -> obj("list_house")' \
  'is UnlistHouseMessage -> obj("unlist_house") { put("property_id", msg.propertyId) }'; do
  if ! grep -RInF "$android_intent_only_literal" "$ROOT_DIR/apps/android/app/src/main/java/com/akalynth/client/protocol" >/dev/null; then
    die "Missing Android intent-only gameplay protocol proof literal: $android_intent_only_literal"
  fi
done

for android_wire_authority_literal in \
  'fun `work gameplay messages omit client identity and coordinates`()' \
  'fun `property gameplay messages omit client identity and coordinates`()' \
  'private fun assertNoClientAuthorityFields(obj: JsonObject)' \
  'assertFalse("gameplay intent frame must not carry $field", obj.containsKey(field))' \
  'assertEquals("start_work_contract", startObj["type"]!!.jsonPrimitive.content)' \
  'assertEquals("work_tick", tickObj["type"]!!.jsonPrimitive.content)' \
  'assertEquals("buy_house", buyObj["type"]!!.jsonPrimitive.content)' \
  'assertEquals("list_house", listObj["type"]!!.jsonPrimitive.content)' \
  'assertEquals("unlist_house", unlistObj["type"]!!.jsonPrimitive.content)'; do
  if ! grep -Fq "$android_wire_authority_literal" "$ROOT_DIR/apps/android/app/src/test/java/com/akalynth/client/protocol/ProtocolParityTest.kt"; then
    die "Missing Android gameplay wire-authority proof literal: $android_wire_authority_literal"
  fi
done

for debug_client_literal in \
  'create/select handlers use explicit account session guard' \
  'missing account session blocks character actions before request' \
  'missing csrf blocks character actions before request' \
  'account character requests include account session cookies' \
  'create path submits typed account character v2 body' \
  'select path submits selected character id' \
  'create/select response validates full play response' \
  'token login is preferred for selected account character' \
  'work start remains token-scoped intent only' \
  'work tick remains token-scoped intent only' \
  'house buy remains token-scoped intent only' \
  'house list remains token-scoped intent only' \
  'house unlist remains token-scoped intent only'; do
  if ! grep -Fq "$debug_client_literal" "$ROOT_DIR/apps/debug-client/scripts/verify-account-character-guard.mjs"; then
    die "Missing debug-client account-character verifier proof: $debug_client_literal"
  fi
done

for client_contract_literal in \
  '### Character Catalogs' \
  'GET /v1/worlds` is public' \
  'GET /v1/outfits?sex=male' \
  '### Character List' \
  'GET /v1/characters` requires an account session cookie' \
  '### Character Select' \
  'POST /v1/characters/select` requires an account session cookie and matching CSRF header/cookie' \
  'Email verification is not required for selecting an existing account-owned character' \
  '### Web Gameplay HTTP' \
  'GET /v1/shop/catalog` is public' \
  'GET /v1/wallet?character_id=<character_id>` requires an account session cookie' \
  'POST /v1/shop/purchase`, `POST /v1/work/start`, `POST /v1/work/tick`, `POST /v1/property/buy`, `POST /v1/property/list`, and `POST /v1/property/unlist` require an account session cookie' \
  'Gameplay mutations are receipt-backed' \
  'Web gameplay receipts must not carry account ids, session cookie values, or CSRF token values'; do
  if ! grep -Fq "$client_contract_literal" "$ROOT_DIR/docs/CLIENT_CONTRACT_V0_1.md"; then
    die "Missing account-character client contract section: $client_contract_literal"
  fi
done

for shared_web_gameplay_literal in \
  'export interface WebShopCatalogResponse' \
  'export interface WebWalletResponse' \
  'export interface WebShopPurchaseRequest' \
  'export interface WebShopPurchaseResponse' \
  'export interface WebWorkStartRequest' \
  'export interface WebWorkStartResponse' \
  'export interface WebWorkTickRequest' \
  'export interface WebWorkTickResponse' \
  'export interface WebPropertyBuyRequest' \
  'export interface WebPropertyBuyResponse' \
  'export interface WebPropertyListRequest' \
  'export interface WebPropertyListResponse' \
  'export interface WebPropertyUnlistRequest' \
  'export type WebPropertyUnlistResponse = WebPropertyListResponse'; do
  if ! grep -Fq "$shared_web_gameplay_literal" "$ROOT_DIR/packages/shared/http.ts"; then
    die "Missing shared web gameplay HTTP type: $shared_web_gameplay_literal"
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

if ! grep -Fq 'npm run verify:account-character' "$ROOT_DIR/.github/workflows/verify.yml"; then
  die "GitHub verification workflow must run npm run verify:account-character."
fi

if ! grep -Fq "run('npm', ['run', 'test:web-economy']);" "$ROOT_DIR/apps/server/tools/verify-server.mjs"; then
  die "Server verify:quick must include test:web-economy gameplay route proof."
fi

for server_literal in \
  "HTTP GET /v1/worlds is public" \
  "HTTP GET /v1/outfits is public" \
  "HTTP GET /v1/outfits filters by sex" \
  "HTTP POST /v1/characters returns client character + play token"; do
  if ! grep -Fq "$server_literal" "$ROOT_DIR/apps/server/tools/verify-character-v2.test.ts"; then
    die "Missing server account-character catalog route proof: $server_literal"
  fi
done

for web_economy_literal in \
  "shop catalog is public" \
  "wallet read requires account session" \
  "wallet read requires account-owned character" \
  "wallet rejects character owned by another account" \
  "cross-account wallet read emits no receipts" \
  "shop purchase requires account session" \
  "shop purchase rejects character owned by another account" \
  "cross-account shop purchase emits no receipts" \
  "shop purchase requires shop key" \
  "missing-key shop purchase emits no debit/mint receipts" \
  "shop purchase requires character id" \
  "missing-character shop purchase emits no debit/mint receipts" \
  "shop purchase rejects unknown shop item" \
  "unknown-item shop purchase emits no debit/mint receipts" \
  "rejected shop purchase emitted no inventory receipt" \
  "shop purchase requires matching csrf" \
  "auth/csrf rejected shop requests emit no receipts" \
  "shop purchase succeeds" \
  "shop purchase emits debit -> mint -> inventory receipts" \
  "shop item id is derived from mint receipt hash" \
  "shop inventory mirror updated" \
  "shop receipts do not carry account/session/csrf tokens" \
  "work start requires account session" \
  "work start rejects character owned by another account" \
  "cross-account work start emits no receipts" \
  "work start requires matching csrf" \
  "auth/csrf rejected work start emits no receipts" \
  "work start requires character id" \
  "missing-character work start emits no receipts" \
  "work start succeeds" \
  "work start emits work_contract_started receipt" \
  "work start rejects already active contract" \
  "already-active work start emits no second start receipt" \
  "work tick requires account session" \
  "no-session work tick emits no receipts" \
  "work tick requires matching csrf" \
  "work tick rejects character owned by another account" \
  "cross-account work tick emits no receipts" \
  "auth/csrf rejected work tick emits no receipts" \
  "missing contract work tick emits no receipts" \
  "work tick requires character id" \
  "missing-character work tick emits no receipts" \
  "work tick rejects unknown contract" \
  "unknown-contract work tick emits no receipts" \
  "work tick rejects insufficient presence" \
  "insufficient-presence work tick emits no receipts" \
  "work tick completes after presence gates" \
  "work completion updates wallet balance" \
  "work receipts include ticks, completion, and wallet credit" \
  "work tick rejects completed contract" \
  "completed-contract work tick emits no receipts" \
  "property buy requires account session" \
  "no-session property buy emits no purchase receipt" \
  "property buy rejects character owned by another account" \
  "cross-account property buy emits no receipts" \
  "property buy requires character id" \
  "missing-character property buy emits no debit/purchase receipt" \
  "property buy requires property id" \
  "missing-property property buy emits no debit/purchase receipt" \
  "property buy rejects unknown plot" \
  "unknown-plot property buy emits no debit/purchase receipt" \
  "property buy requires matching csrf" \
  "auth/csrf rejected property buy emits no purchase receipt" \
  "property buy without gold is rejected" \
  "rejected property buy emitted no purchase receipt" \
  "primary property buy succeeds" \
  "primary property buy owns plot" \
  "primary buy emitted wallet debit + property purchase" \
  "property buy rejects own plot" \
  "own-plot property buy emits no debit/purchase receipt" \
  "property list requires account session" \
  "no-session property list emits no listing receipt" \
  "property list requires matching csrf" \
  "auth/csrf rejected property list emits no listing receipt" \
  "property list rejects non-owner" \
  "non-owner property list emits no listing receipt" \
  "property list requires character id" \
  "missing-character property list emits no listing receipt" \
  "property list requires property id" \
  "missing-property property list emits no listing receipt" \
  "property list rejects invalid price" \
  "invalid-price property list emits no listing receipt" \
  "property list rejects unknown plot" \
  "unknown-plot property list emits no listing receipt" \
  "property list succeeds for owner" \
  "property list emitted property_listed receipt" \
  "property list rejects already-listed property" \
  "already-listed property list emits no second listing receipt" \
  "property buy rejects owned unlisted plot" \
  "owned-unlisted property buy emits no debit/purchase receipt" \
  "resale property buy without gold is rejected" \
  "rejected resale emitted no debit/credit/transfer receipt" \
  "resale property buy succeeds" \
  "resale debits buyer wallet" \
  "resale credits seller wallet" \
  "resale emits buyer debit + seller credit + transfer" \
  "property unlist requires account session" \
  "property unlist emitted property_unlisted receipt" \
  "property unlist rejects not-listed property" \
  "not-listed property unlist emits no second unlist receipt" \
  "no-session property unlist emits no second unlist receipt" \
  "property unlist requires matching csrf" \
  "auth/csrf rejected property unlist emits no unlist receipt" \
  "property unlist requires character id" \
  "missing-character property unlist emits no second unlist receipt" \
  "property unlist requires property id" \
  "missing-property property unlist emits no second unlist receipt" \
  "property unlist rejects unknown plot" \
  "unknown-plot property unlist emits no second unlist receipt" \
  "property unlist rejects non-owner" \
  "non-owner property unlist emits no second unlist receipt" \
  "property unlist succeeds for owner" \
  "web economy receipts do not carry account/session/csrf tokens"; do
  if ! grep -Fq "$web_economy_literal" "$ROOT_DIR/apps/server/tools/verify-web-economy.test.ts"; then
    die "Missing web economy gameplay proof: $web_economy_literal"
  fi
done

for gameplay_doc in "$ROOT_DIR/README.md" "$ROOT_DIR/docs/CURRENT_STAGE.md" "$ROOT_DIR/docs/V1_SCOPE.md" "$ROOT_DIR/scripts/README.md"; do
  if ! grep -Fq 'wallet/shop/work/property gameplay route proof' "$gameplay_doc"; then
    die "Missing account-character wallet/gameplay route proof wording in ${gameplay_doc#$ROOT_DIR/}"
  fi
done

for site_doc in "$ROOT_DIR/README.md" "$ROOT_DIR/docs/CURRENT_STAGE.md" "$ROOT_DIR/docs/V1_SCOPE.md" "$ROOT_DIR/docs/README.md"; do
  if ! grep -Fq 'verify-account-character-site.sh' "$site_doc"; then
    die "Missing akalynth-site account/four-surface verifier reference in ${site_doc#$ROOT_DIR/}"
  fi
  if ! grep -Fq 'executable site E2D gameplay action proof' "$site_doc"; then
    die "Missing akalynth-site E2D gameplay proof wording in ${site_doc#$ROOT_DIR/}"
  fi
  if ! grep -Fq 'Public, Builder, Operator, Agent' "$site_doc"; then
    die "Missing explicit Public/Builder/Operator/Agent surface taxonomy in ${site_doc#$ROOT_DIR/}"
  fi
done

if ! grep -Fq 'executable site E2D gameplay action proof' "$ROOT_DIR/scripts/README.md"; then
  die "Missing akalynth-site E2D gameplay proof wording in scripts/README.md"
fi

for android_ui_doc in "$ROOT_DIR/README.md" "$ROOT_DIR/scripts/README.md"; do
  if ! grep -Fq 'Android character UI compile' "$android_ui_doc"; then
    die "Missing Android character UI compile wording in ${android_ui_doc#$ROOT_DIR/}"
  fi
done

echo "✅ No legacy create_character protocol path found"
