# Rookguard Map Asset Training Build Claim Boundary

Lane: `AKALYNTH_ROOKGUARD_MAP_ASSET_TRAINING_BUILD_V1`

Closure status target:
`rookguard_training_asset_bundle_created_preview_verified_no_gameplay_mutation`

## Claim

This bundle is a controlled visual/training-data object for future Rookguard
map generation and review.

It contains an original Akalynth asset register, map-generation examples, one
32x32 seed-map candidate, deterministic placement rules, a standalone preview,
and an offline verifier.

## Boundary

- Training-only data.
- Not canonical gameplay state.
- Not a promoted Rookguard map.
- No server world-state mutation.
- No production route change.
- No NPC behavior change.
- No monster behavior change.
- No collision or walkability protocol change.
- No deploy, restart, or runtime sync.

## IP Boundary

The close-name external starter-zone association is treated only as broad genre
context: compact onboarding space, basic movement, first signs, safe practice,
and a clear exit threshold.

This bundle does not copy outside map geometry, art, NPC names, quest
structures, tile recipes, or layout composition. All asset identifiers and map
rows are original Akalynth training data.

## Receipt Scope

`MANIFEST.sha256` covers the core bundle files listed by
`rookguard.asset-placement-rules.json`.

`receipt.json` records the closure claim and binds to that manifest hash.

`verification.log` records the local verifier run. It is evidence output, not
canonical source authority.
