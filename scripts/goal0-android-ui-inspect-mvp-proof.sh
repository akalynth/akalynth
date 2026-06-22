#!/usr/bin/env bash
# PR-023: UI refresh MVP proof — static checklist + asset pipeline verification.
#
# Documents and verifies:
#   - Rookguard placements loaded (162)
#   - 20 item icons in registry (MVP item_type index)
#   - Hotbar ItemIcon resolution path (PR-019/020)
#   - ChronicleGlyphResolver + 9 chronicle_kind glyphs (PR-021/022)
#
# Usage:
#   ./scripts/goal0-android-ui-inspect-mvp-proof.sh
#   AKALYNTH_MVP_PROOF_EVIDENCE=docs/evidence/UI_REFRESH_MVP_PROOF.json ./scripts/goal0-android-ui-inspect-mvp-proof.sh
#
# Invoked automatically by goal0-android-ui-inspect.sh when passed --mvp-proof.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_PATH="${AKALYNTH_MVP_PROOF_EVIDENCE:-${ROOT}/docs/evidence/UI_REFRESH_MVP_PROOF.json}"
RUN_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
GIT_SHA="$(git -C "${ROOT}" rev-parse HEAD 2>/dev/null || echo unknown)"

log() { printf '[mvp-proof] %s\n' "$1"; }
die() { log "FAIL: $1"; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

for cmd in jq git node npm; do need_cmd "$cmd"; done

ROOKGUARD_BUILT="${ROOT}/data/assets-built/placements/rookguard-overlays.json"
ROOKGUARD_ANDROID="${ROOT}/apps/android/app/src/main/assets/placements/rookguard-overlays.json"
REGISTRY_BUILT="${ROOT}/data/assets-built/registry.json"
HOTBAR_KT="${ROOT}/apps/android/app/src/main/java/com/akalynth/client/ui/components/hotbar/Hotbar.kt"
ITEM_ICON_KT="${ROOT}/apps/android/app/src/main/java/com/akalynth/client/ui/components/hotbar/ItemIcon.kt"
CHRONICLE_RESOLVER_KT="${ROOT}/apps/android/app/src/main/java/com/akalynth/client/chronicle/ChronicleGlyphResolver.kt"
CATALOG_KT="${ROOT}/apps/android/app/src/main/java/com/akalynth/client/ui/components/hotbar/ItemPresentationCatalog.kt"

declare -a CHECK_IDS=()
declare -a CHECK_STATUSES=()
declare -a CHECK_DETAILS=()

record_check() {
  local id="$1" status="$2" detail="$3"
  CHECK_IDS+=("${id}")
  CHECK_STATUSES+=("${status}")
  CHECK_DETAILS+=("${detail}")
  if [[ "${status}" == "pass" ]]; then
    log "✓ ${id}: ${detail}"
  else
    log "✗ ${id}: ${detail}"
  fi
}

count_placements() {
  local file="$1"
  jq '.placements | length' "${file}"
}

# --- Static checklist -------------------------------------------------------

[[ -f "${ROOKGUARD_BUILT}" ]] || die "missing ${ROOKGUARD_BUILT}"
[[ -f "${ROOKGUARD_ANDROID}" ]] || die "missing ${ROOKGUARD_ANDROID}"

built_count="$(count_placements "${ROOKGUARD_BUILT}")"
android_count="$(count_placements "${ROOKGUARD_ANDROID}")"
if [[ "${built_count}" -eq 162 && "${android_count}" -eq 162 ]]; then
  record_check "rookguard_placements_162" "pass" "built=${built_count} android_mirror=${android_count}"
else
  record_check "rookguard_placements_162" "fail" "expected 162; built=${built_count} android=${android_count}"
fi

[[ -f "${REGISTRY_BUILT}" ]] || die "missing ${REGISTRY_BUILT}"
item_count="$(jq '[.entries[] | select(.asset_type == "item")] | length' "${REGISTRY_BUILT}")"
registry_item_types="$(jq -r '[.entries[] | select(.asset_type == "item") | .item_type] | sort | join(",")' "${REGISTRY_BUILT}")"

catalog_types="$(grep -A30 'MVP_ITEM_TYPES' "${CATALOG_KT}" | grep -oE '"[a-z0-9_]+"' | tr -d '"' | sort | paste -sd, - || true)"
if [[ "${item_count}" -eq 20 ]]; then
  record_check "registry_item_icons_20" "pass" "registry item entries=${item_count}"
else
  record_check "registry_item_icons_20" "fail" "expected 20 item entries; got ${item_count}"
fi

missing_types=""
while IFS= read -r t; do
  [[ -z "${t}" ]] && continue
  if ! jq -e --arg t "${t}" '[.entries[] | select(.asset_type=="item" and .item_type==$t)] | length > 0' "${REGISTRY_BUILT}" >/dev/null; then
    missing_types="${missing_types}${t},"
  fi
done < <(grep -A30 'MVP_ITEM_TYPES' "${CATALOG_KT}" | grep -oE '"[a-z0-9_]+"' | tr -d '"')

if [[ -z "${missing_types}" ]]; then
  record_check "registry_mvp_item_type_coverage" "pass" "all ItemPresentationCatalog.MVP_ITEM_TYPES indexed"
else
  record_check "registry_mvp_item_type_coverage" "fail" "missing registry item_type(s): ${missing_types}"
fi

if grep -q 'ItemIcon(' "${HOTBAR_KT}" && grep -q 'ItemIconResolver' "${ITEM_ICON_KT}"; then
  record_check "hotbar_item_icon_path" "pass" "Hotbar.kt → ItemIcon → ItemIconResolver (registry item_type index)"
else
  record_check "hotbar_item_icon_path" "fail" "Hotbar.kt must call ItemIcon; ItemIcon.kt must define ItemIconResolver"
fi

glyph_count="$(jq '[.entries[] | select(.chronicle_kind != null)] | length' "${REGISTRY_BUILT}")"
if [[ -f "${CHRONICLE_RESOLVER_KT}" ]] && grep -q 'object ChronicleGlyphResolver' "${CHRONICLE_RESOLVER_KT}" && [[ "${glyph_count}" -eq 9 ]]; then
  record_check "chronicle_glyph_resolver" "pass" "ChronicleGlyphResolver.kt + registry chronicle_kind entries=${glyph_count}"
else
  record_check "chronicle_glyph_resolver" "fail" "resolver missing or chronicle_kind count != 9 (got ${glyph_count})"
fi

# --- Asset pipeline commands ------------------------------------------------

declare -a NPM_IDS=()
declare -a NPM_STATUSES=()
declare -a NPM_DETAILS=()

run_npm_step() {
  local id="$1" cmd="$2"
  log "running: ${cmd}"
  local logfile
  logfile="$(mktemp)"
  if (cd "${ROOT}" && eval "${cmd}") >"${logfile}" 2>&1; then
    NPM_IDS+=("${id}")
    NPM_STATUSES+=("pass")
    NPM_DETAILS+=("$(tail -n 3 "${logfile}" | tr '\n' ' ' | sed 's/  */ /g')")
    log "✓ ${id}"
  else
    NPM_IDS+=("${id}")
    NPM_STATUSES+=("fail")
    NPM_DETAILS+=("$(tail -n 5 "${logfile}" | tr '\n' ' ' | sed 's/  */ /g')")
    log "✗ ${id} (see ${logfile})"
  fi
  rm -f "${logfile}"
}

run_npm_step "verify_assets" "npm run verify:assets"
run_npm_step "verify_asset_sync" "npm run verify:asset-sync"
run_npm_step "build_assets" "npm run build:assets"

# Re-check sync after build
if (cd "${ROOT}" && npm run verify:asset-sync) >/dev/null 2>&1; then
  record_check "asset_sync_post_build" "pass" "verify:asset-sync clean after build:assets"
else
  record_check "asset_sync_post_build" "fail" "verify:asset-sync failed after build:assets"
fi

# --- Evidence JSON ----------------------------------------------------------

mkdir -p "$(dirname "${EVIDENCE_PATH}")"

overall="pass"
for s in "${CHECK_STATUSES[@]}" "${NPM_STATUSES[@]}"; do
  [[ "${s}" == "fail" ]] && overall="fail"
done

{
  printf '{\n'
  printf '  "schema_version": "ui-refresh-mvp-proof/v1",\n'
  printf '  "proof_target": "UI_REFRESH_MVP_PROOF",\n'
  printf '  "pr": "PR-023",\n'
  printf '  "title": "MVP UI refresh proof receipt",\n'
  printf '  "generated_at": "%s",\n' "${RUN_AT}"
  printf '  "git_commit": "%s",\n' "${GIT_SHA}"
  printf '  "overall_status": "%s",\n' "${overall}"
  printf '  "mvp_checklist": [\n'
  for i in "${!CHECK_IDS[@]}"; do
    comma=","
    [[ "${i}" -eq $((${#CHECK_IDS[@]} - 1)) ]] && comma=""
    printf '    {"id": "%s", "status": "%s", "detail": "%s"}%s\n' \
      "${CHECK_IDS[$i]}" "${CHECK_STATUSES[$i]}" "${CHECK_DETAILS[$i]//\"/\\\"}" "${comma}"
  done
  printf '  ],\n'
  printf '  "asset_pipeline": [\n'
  for i in "${!NPM_IDS[@]}"; do
    comma=","
    [[ "${i}" -eq $((${#NPM_IDS[@]} - 1)) ]] && comma=""
    printf '    {"command": "%s", "status": "%s", "detail": "%s"}%s\n' \
      "${NPM_IDS[$i]}" "${NPM_STATUSES[$i]}" "${NPM_DETAILS[$i]//\"/\\\"}" "${comma}"
  done
  printf '  ],\n'
  printf '  "artifacts": {\n'
  printf '    "rookguard_placements_built": "%s",\n' "data/assets-built/placements/rookguard-overlays.json"
  printf '    "rookguard_placements_android": "%s",\n' "apps/android/app/src/main/assets/placements/rookguard-overlays.json"
  printf '    "registry_built": "%s",\n' "data/assets-built/registry.json"
  printf '    "hotbar_item_icon": "%s",\n' "apps/android/app/src/main/java/com/akalynth/client/ui/components/hotbar/ItemIcon.kt"
  printf '    "chronicle_glyph_resolver": "%s"\n' "apps/android/app/src/main/java/com/akalynth/client/chronicle/ChronicleGlyphResolver.kt"
  printf '  },\n'
  printf '  "counts": {\n'
  printf '    "rookguard_placements_built": %s,\n' "${built_count}"
  printf '    "rookguard_placements_android": %s,\n' "${android_count}"
  printf '    "registry_item_icons": %s,\n' "${item_count}"
  printf '    "registry_chronicle_glyphs": %s\n' "${glyph_count}"
  printf '  },\n'
  printf '  "registry_item_types": %s,\n' "$(jq -c '[.entries[] | select(.asset_type=="item") | .item_type] | sort' "${REGISTRY_BUILT}")"
  printf '  "screenshot_inspect": {\n'
  printf '    "script": "scripts/goal0-android-ui-inspect.sh",\n'
  printf '    "note": "Run on goal0-edge-01 for Rookguard world + hotbar + chronicle PNG proof when VM available",\n'
  printf '    "recommended_scenarios": "login,world,world_debug"\n'
  printf '  }\n'
  printf '}\n'
} > "${EVIDENCE_PATH}"

log "evidence written: ${EVIDENCE_PATH}"

if [[ "${overall}" != "pass" ]]; then
  die "one or more MVP proof checks failed"
fi

log "MVP UI refresh proof PASS"