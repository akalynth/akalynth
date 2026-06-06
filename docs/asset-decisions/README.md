# Asset Decision Packets

Status: decision-packet index.

This directory contains receipt-backed design, review, and proof packets for
asset, map, mobile, Android, lore, and runtime-map lanes. Many folders look like
drafts because their artifacts are draft candidates, but their receipts are often
the accepted evidence that later gates validate.

## Cleanup Rule

- Do not delete a folder only because it says `draft`, `candidate`, or
  `non-runtime`.
- Keep accepted receipt chains that validators or later bundles reference.
- Move only superseded or closed-historical lanes to `docs/archive/asset-decisions/`.
- A packet here is not runtime authority unless its own claim boundary says so.

## Protected Current Evidence

| Area | Why it stays |
| --- | --- |
| High City canon and migration | `AKALYNTH_HIGH_CITY_CANONICAL_WORLD_DECISION_V1`, `AKALYNTH_WORLD_CANON_HIERARCHY_CORRECTION_V1`, and `AKALYNTH_AZURA_IDENTIFIER_MIGRATION_PLAN_V1` define the current naming boundary: Akalynth world, High City first city, Azura legacy runtime id. |
| High City source extraction | `AKALYNTH_COSMIC_ROOT_FIRST_CITY_EXTRACTION_V1` is historical provenance for High City extraction. It is not current runtime authority, but it explains source/canon derivation. |
| Runtime-map authority chain | `AKALYNTH_HIGH_CITY_MAP_AUTHORITY_BUNDLE_V1`, `AKALYNTH_RUNTIME_MAP_AUTHORITY_SCHEMA_DESIGN_V1`, `AKALYNTH_RUNTIME_MAP_SCHEMA_VALIDATION_HARNESS_V1`, `AKALYNTH_HIGH_CITY_RUNTIME_MAP_PROJECTION_CANDIDATE_V1`, and `AKALYNTH_RUNTIME_MAP_PROJECTION_CONSUMER_SMOKE_TEST_V1` are the protected non-runtime-to-runtime promotion evidence chain. |
| Collision, door, house, transition authority | `AKALYNTH_COLLISION_WALKABILITY_*`, `AKALYNTH_DOOR_AND_HOUSE_AUTHORITY_DESIGN_V1`, `AKALYNTH_DOOR_HOUSE_AUTHORITY_FIXTURE_CANDIDATE_V1`, `AKALYNTH_TRANSITION_AUTHORITY_DESIGN_V1`, and `AKALYNTH_TRANSITION_AUTHORITY_FIXTURE_CANDIDATE_V1` preserve authority-boundary decisions. |
| Visual and asset reviews | Character, NPC, object-scale, roof/floor overlay, walk-in building, block preview/refinement, and visual fixture export packets prove visual-only acceptance and must remain separate from runtime authority. |
| Android and mobile proof sheets | Android protocol/cleartext/emulator final-closure/mobile-shell and mobile play-surface/backpack/chat proof packets preserve client evidence without changing gameplay authority. |
| Account entry parity | `AKALYNTH_ACCOUNT_CHARACTER_ENTRY_PARITY_V1` is pending-review product/client evidence. It is not accepted account auth/runtime authority. |

## Folder Groups

| Group | Folders |
| --- | --- |
| Canon and naming | `AKALYNTH_HIGH_CITY_CANONICAL_WORLD_DECISION_V1`, `AKALYNTH_WORLD_CANON_HIERARCHY_CORRECTION_V1`, `AKALYNTH_AZURA_IDENTIFIER_MIGRATION_PLAN_V1`, `AKALYNTH_COSMIC_ROOT_FIRST_CITY_EXTRACTION_V1` |
| Drop source intake | `AKALYNTH_ASSET_LIBRARY_SOURCE_INTAKE_V1`, `AKALYNTH_GAMEPLAY_LANE_SOURCE_INTAKE_V1`, `AKALYNTH_GAME_LOOP_SOURCE_INTAKE_V1`, `AKALYNTH_SYSTEMS_BIBLE_SOURCE_INTAKE_V1`, `AKALYNTH_FIRST_PLAYABLE_SOURCE_INTAKE_V1`, `AKALYNTH_WORLD_EVENTS_ENGINE_SOURCE_INTAKE_V1`, `AKALYNTH_FORGEHOLD_ROUTE_SOURCE_INTAKE_V1`, `AKALYNTH_MOONSPIRE_DREAM_GATE_SOURCE_INTAKE_V1`, `AKALYNTH_CINDERWATCH_FRONTIER_SOURCE_INTAKE_V1` |
| Runtime-map promotion | `AKALYNTH_HIGH_CITY_MAP_AUTHORITY_BUNDLE_V1`, `AKALYNTH_RUNTIME_MAP_AUTHORITY_SCHEMA_DESIGN_V1`, `AKALYNTH_RUNTIME_MAP_SCHEMA_VALIDATION_HARNESS_V1`, `AKALYNTH_HIGH_CITY_RUNTIME_MAP_PROJECTION_CANDIDATE_V1`, `AKALYNTH_RUNTIME_MAP_PROJECTION_CONSUMER_SMOKE_TEST_V1` |
| Authority candidate planes | `AKALYNTH_MAP_OBJECT_METADATA_DESIGN_V1`, `AKALYNTH_VISUAL_MAP_OBJECT_FIXTURE_EXPORT_V1`, `AKALYNTH_COLLISION_WALKABILITY_METADATA_DESIGN_V1`, `AKALYNTH_COLLISION_WALKABILITY_FIXTURE_CANDIDATE_V1`, `AKALYNTH_DOOR_AND_HOUSE_AUTHORITY_DESIGN_V1`, `AKALYNTH_DOOR_HOUSE_AUTHORITY_FIXTURE_CANDIDATE_V1`, `AKALYNTH_TRANSITION_AUTHORITY_DESIGN_V1`, `AKALYNTH_TRANSITION_AUTHORITY_FIXTURE_CANDIDATE_V1` |
| Visual acceptance and layout | `AKALYNTH_CHARACTER_VISUAL_PLACEMENT_REVIEW_V1`, `AKALYNTH_NPC_VISUAL_PRESET_IMPORT_V1`, `AKALYNTH_ENGINE_IMPORT_SMOKE_TEST_V1`, `AKALYNTH_WORLD_OBJECT_VISUAL_SCALE_AUDIT_V1`, `AKALYNTH_DEBUG_CLIENT_VISUAL_SCALE_TUNING_V1`, `AKALYNTH_WALK_IN_BUILDING_VISUAL_ASSEMBLY_V1`, `AKALYNTH_ROOF_OVERLAY_VISUAL_HIDE_REVIEW_V1`, `AKALYNTH_FLOOR_OVERLAY_VISIBILITY_REVIEW_V1`, `AKALYNTH_EXPERIMENTAL_HIGH_CITY_BLOCK_PREVIEW_V1`, `AKALYNTH_HIGH_CITY_BLOCK_LAYOUT_REFINEMENT_V1` |
| Android/mobile client evidence | `AKALYNTH_ANDROID_DEBUG_LOCAL_CLEARTEXT_POLICY_V1`, `AKALYNTH_ANDROID_EMULATOR_DEV_BENCH_FINAL_CLOSURE_V1`, `AKALYNTH_ANDROID_MOBILE_CLASSIC_SHELL_PARITY_V1`, `AKALYNTH_ANDROID_PROTOCOL_VERSION_ALIGNMENT_V1`, `AKALYNTH_MOBILE_CORE_PLAY_SURFACE_V1`, `AKALYNTH_MOBILE_CLASSIC_UI_POLISH_V1`, `AKALYNTH_MOBILE_INVENTORY_BACKPACK_SHEET_V1`, `AKALYNTH_MOBILE_CHAT_LOG_PROOF_SHEETS_V1`, `AKALYNTH_MOBILE_PLAYABLE_SMOKE_SCRIPT_V1` |
| Account/client entry | `AKALYNTH_ACCOUNT_CHARACTER_ENTRY_PARITY_V1` |

## Archived Decision Packets

| Folder | Why archived |
| --- | --- |
| `docs/archive/asset-decisions/AKALYNTH_ANDROID_EMULATOR_DEV_BENCH_V1` | Superseded by `AKALYNTH_ANDROID_DEBUG_LOCAL_CLEARTEXT_POLICY_V1` and `AKALYNTH_ANDROID_EMULATOR_DEV_BENCH_FINAL_CLOSURE_V1`; its cleartext blocker is historical only. |
| `docs/archive/asset-decisions/AKALYNTH_ANDROID_WRITE_CAPABILITY_PROBE_V1` | Closed write-capability probe with no source changes; useful as history, not current implementation guidance. |
| `docs/archive/asset-decisions/AKALYNTH_LORE_BIBLE_CANONIZATION_V1` | Superseded by the world-canon hierarchy correction and Azura identifier migration plan. Its old VaultCore Prime migration target is historical only. |
| `docs/archive/asset-decisions/AKALYNTH_MOBILE_PLAYABILITY_AUDIT_V1` | Superseded by `AKALYNTH_MOBILE_CORE_PLAY_SURFACE_V1`; it captured the pre-fix mobile playability gap rather than current mobile state. |
