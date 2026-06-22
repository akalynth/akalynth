# Play, Build, Govern Surface — Runbook (v1)

Authority: `AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1`

Proof target: `play_build_govern_surface_v1`

## Scope

Codex-side builder workflow for Akalynth's Play → Modify → Build → Script → Operate → Govern
ladder. This runbook covers contract verification and the rookguard sample chain only.

It does **not** claim shipped creator tools, lane publish, or public site exposure of
builder/operator internals.

## Surfaces

| Surface | Object | Public |
|---|---|---|
| Codex design | `play-build-govern-surface` | No |
| Builder draft manifest | `codex/samples/rookguard-builder-draft-manifest.sample.json` | No |
| Local preview session | `codex/samples/rookguard-local-preview-session.sample.json` | No |
| Operator review packet | `codex/samples/rookguard-promotion-review-packet.sample.json` | No |
| Promotion gate | `akalynth-ops/bin/builder-promotion-gate.sh` | No |

## Rookguard Sample Chain

```text
Draft manifest (rookguard kit)
  → local preview session (preview_only receipts)
  → operator review packet (abuse_review=pass, decision=accept)
  → builder promotion permit (publish_skipped)
```

Gate invocation (ops host):

```bash
bin/builder-promotion-gate.sh \
  --manifest codex/samples/rookguard-builder-draft-manifest.sample.json \
  --preview codex/samples/rookguard-local-preview-session.sample.json \
  --review codex/samples/rookguard-promotion-review-packet.sample.json \
  --emit-permit builder/permits/rookguard-kit-v1.json \
  --skip-publish
```

## Validation Commands

From `repos/akalynth`:

```bash
npm -w apps/server run verify:play-build-govern-surface-v1
./scripts/verify-play-build-govern-surface-v1.sh
```

From `akalynth-ops`:

```bash
scripts/verify-play-build-govern-surface-v1.sh
bin/akalynth-codex-grok.sh check
```

## Codex Custody

- Entry: `repos/akalynth-codex/entries/play-build-govern-surface.json`
- Design: `repos/akalynth-codex/design/play-build-govern-surface.md`
- Closure: `akalynth-ops/evidence/play-build-govern-surface-v1/closure.json`
- Engineering loop: `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_PLAY_BUILD_GOVERN_SURFACE_V1/receipt.json`

## Non-Mutation Boundary

- Permit emission does not publish to beta/staging
- No deploy, restart, or `/opt` sync
- Preview fixtures live under `akalynth-ops/builder/previews/` only