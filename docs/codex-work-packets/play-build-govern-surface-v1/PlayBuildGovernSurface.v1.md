# Play, Build, Govern Surface v1

Status: `codex:accepted`

Authority object: `AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1`

Codex authority: `repos/akalynth-codex/design/play-build-govern-surface.md`

## Goal

Land the **builder → preview → operator review** codex contract chain for Akalynth's
Play, Build, Govern positioning surface — without claiming runtime creator tools or
lane publish.

## Source Inputs

- `repos/akalynth-codex/design/play-build-govern-surface.md`
- `repos/akalynth-codex/schema/builder-draft-manifest.schema.json`
- `repos/akalynth-codex/schema/local-preview-session.schema.json`
- `repos/akalynth-codex/schema/promotion-review-packet.schema.json`
- `repos/akalynth-codex/schema/builder-promotion-permit.schema.json`
- `repos/akalynth-codex/samples/rookguard-builder-draft-manifest.sample.json`
- `repos/akalynth-codex/samples/rookguard-local-preview-session.sample.json`
- `repos/akalynth-codex/samples/rookguard-promotion-review-packet.sample.json`
- `akalynth-ops/bin/builder-promotion-gate.sh`
- `akalynth-ops/scripts/verify-play-build-govern-surface-v1.sh`

## Packet Work

1. Land TypeScript contract verifier in `apps/server/tools/`.
2. Add repo shell verifier chaining ops gate checks.
3. Engineering-loop receipt + runbook on `main`.

## Proof Target

**`play_build_govern_surface_v1`**

1. Codex entry `play-build-govern-surface` is `accepted` and stays off public surface.
2. Five packet anchors resolve in the design page.
3. Rookguard sample chain validates manifest checksum + preview + review contract.
4. Builder promotion gate emits `publish_skipped` permit without lane mutation.

## Validation Gate

```bash
npm -w apps/server run verify:play-build-govern-surface-v1
./scripts/verify-play-build-govern-surface-v1.sh
akalynth-ops/scripts/verify-play-build-govern-surface-v1.sh
```

## Non-Claims

- No runtime creator UI shipped
- No beta/staging lane publish
- No `/opt` or runtime state mutation
- No public site publish of builder/operator internals

## Follow-On

- Runtime builder draft namespace + preview server (PR-6+)
- Public positioning review when operator approves `public_projection`