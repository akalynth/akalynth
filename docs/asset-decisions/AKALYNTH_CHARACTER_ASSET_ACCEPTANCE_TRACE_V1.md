# Akalynth Character Asset Acceptance Trace v1

Repo-side memory for the character (idle + walk) asset acceptance review.
This doc records review/integrity/lineage **without committing opaque binaries**.

- **Decision:** do **not** add the acceptance ZIPs to the repo root as tracked
  binaries. They prove review/integrity/lineage but are **not** the canonical
  usable asset source tree.
- **Authorized next lane:** `AKALYNTH_ENGINE_IMPORT_SMOKE_TEST_V1`
- **Steward:** `classic-32-art-pipeline`
- **Integration target:** `data/assets-src/`
- **Status as of 2026-06-04:** the two canonical **input asset** ZIPs are not yet
  on disk. Nothing has been unpacked. No asset binaries committed.

## Acceptance ZIPs (evidence artifacts — NOT committed)

These are decision/evidence packs (previews, sample spritesheets, GIFs, review
matrices, receipts, sha256 manifests). They are **not** the asset source tree.
Both self-verify standalone via `shasum -a 256 -c MANIFEST.sha256`.

| Pack | sha256 | Manifest check |
|---|---|---|
| `AKALYNTH_CHARACTER_SYSTEM_V3_STATIC_ACCEPTANCE_V1.zip` | `31b6fca9060c46f84e4771439e88f887865df13a3d3cbdba0df24dc5b8c283e0` | 25/25 OK |
| `AKALYNTH_CHARACTER_WALK_ANIMATION_ACCEPTANCE_V1.zip` | `de66eadab739fc98f4ea24aacab539aeef828b4ad4c70b52b93970a0f1f912f4` | 48/48 OK |

## Canonical input asset ZIPs (required for integration — NOT yet provided)

These hold the actual renderable source (native frames, recolor masks, layer
folders, spritesheets). They are referenced by hash in the acceptance receipts
but are **not** present on disk. Lane `b` (unpack into `data/assets-src/`) is
blocked until both are supplied.

| Source ZIP | sha256 | Role |
|---|---|---|
| `akalynth_character_system_v3.zip` | `7e23d2fa308216280c24eda82b239b9f9d29b12892cf3fc390500cfc611b1f24` | Base static character system (idle, 4-dir, recolor channels) |
| `AKALYNTH_CHARACTER_WALK_ANIMATION_V1.zip` | `efea526f04039e516a99f0a7b7d34fcc03e2bb9ee2724e3b10e632b7a05b6214` | Walk animation (4-dir × 4-frame) built on the base |

## Receipt lineage (verified chain)

```
akalynth_character_system_v3.zip                 (7e23d2fa…)  base source
  └─► AKALYNTH_CHARACTER_SYSTEM_V3_STATIC_ACCEPTANCE_V1.zip   (31b6fca9…)
        decision : accepted_static_contract_ready_for_walk_animation_v1
        next     : AKALYNTH_CHARACTER_WALK_ANIMATION_V1
        └─► AKALYNTH_CHARACTER_WALK_ANIMATION_V1.zip          (efea526f…)  walk source
              └─► AKALYNTH_CHARACTER_WALK_ANIMATION_ACCEPTANCE_V1.zip  (de66eada…)
                    decision : accepted_walk_animation_v1_ready_for_engine_import_smoke_test_v1
                    next     : AKALYNTH_ENGINE_IMPORT_SMOKE_TEST_V1
```

Chain integrity confirmed: the static-acceptance ZIP supplied on disk
(`31b6fca9…`) is byte-identical to the `static_acceptance_v1_zip` recorded in the
walk pack's `receipt.json`, and the static pack records the base source
(`7e23d2fa…`) with `expected_sha256_from_prior_build` matching.

### Decision + closure phrases

- **Static acceptance**
  - decision: `accepted_static_contract_ready_for_walk_animation_v1`
  - closure: `closed_static_character_contract_reviewed_acceptance_decision_recorded_no_animation_expansion_no_engine_mutation`
- **Walk acceptance**
  - decision: `accepted_walk_animation_v1_ready_for_engine_import_smoke_test_v1`
  - closure: `closed_walk_animation_v1_acceptance_decision_recorded_ready_for_engine_import_smoke_test_no_combat_no_casting_claim`

## Visual contract references

The character assets are in-contract with the Classic 32 visual direction:

- 64×64 tall sprites are explicitly allowed —
  [CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md:61](../CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md#L61),
  [:275](../CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md#L275)
- 4-frame walk cycles are the contract —
  [CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md:281](../CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md#L281)
- Server-metadata lockstep (art is display-only) —
  [CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md:144](../CLASSIC_32_ART_AND_MOBILE_UI_DIRECTION.md#L144)
- Asset Factory lifecycle + `mechanics: null` rule —
  [FACTORY.md](../../data/assets-src/FACTORY.md)

## Explicit non-claims

Until the factory verifier and the engine-import smoke test run, this repo does
**not** claim the character assets are any of:

- engine-ready
- runtime-integrated
- map-placeable
- combat-ready
- network-safe
- fully verified

## Allowed claim after unpack + checksum pass

The only claim authorized after the input ZIPs are unpacked and checksum-verified:

> Asset source files imported and checksum-verified.
> Mechanics remain null. No runtime behavior granted.

## Integration plan (lane b) — staged

When the two input ZIPs are supplied, unpack into a source-controlled lane:

```
data/assets-src/characters/
  akalynth_character_system_v3/
    bases/ layers/ equipment/ masks/ palettes/ spritesheets/ manifests/
    ASSET_SOURCE.json
    MANIFEST.sha256
  akalynth_character_walk_animation_v1/
    frames/ sheets/ masks/ previews/ manifests/
    ASSET_SOURCE.json
    MANIFEST.sha256
```

Each imported directory carries a sidecar manifest with `mechanics: null`,
`display_only: true`, source ZIP name + sha256, frame size `[64, 64]`, 4 walk
frames, directions `[south, east, north, west]`, and
`integration_status: source_imported_not_engine_bound`.

### Next gate

```bash
shasum -a 256 -c MANIFEST.sha256
npm run verify:assets
```

Only after both pass is the lane considered integrated as **display-only source
assets** — still not engine-bound, still no runtime behavior.
