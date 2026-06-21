# Rookguard First30 Presentation v1

Status: `codex:ready`

Authority object: `AKALYNTH_ROOKGUARD_FIRST30_PRESENTATION_V1`

Codex authority: `repos/akalynth-codex/design/rookguard-first30-presentation-v1.md`

## Goal

Close the Rookguard **0–30 minute presentation proof gap** on `main`: reproducible
transcript linking sim gameplan, timeline frames, and live Codex Path WebSocket proof.

No beta polish, launch, or content-alpha claim.

## Source Inputs

- `repos/akalynth-codex/design/rookguard-first30-presentation-v1.md`
- `repos/akalynth-codex/schema/rookguard-presentation-transcript.schema.json`
- `repos/akalynth-codex/samples/rookguard-first30-presentation-transcript.sample.json`
- `docs/ROOKGUARD_FIRST_30_MINUTES_V1.md`
- `docs/SIM_LIFE_VIEWER_V1.md`
- `apps/server/src/simulation/simLifeSnapshot.ts`
- `apps/server/tools/verify-rookguard-first30-presentation.ts`
- `apps/server/tools/verify-rookguard-codex-path.ts`

## Packet Work

1. Land presentation transcript schema + focused verifier.
2. Add `scripts/verify-rookguard-first30-presentation.sh` + runbook.
3. Engineering-loop receipt in `repos/akalynth`.

## Recommended Proof Target

**`rookguard_first30_presentation_v1`**

1. Six-window `rookguard_0_30_gameplan` matches source contract receipt actions
2. Newcomer sim timeline covers all window receipt actions
3. Presentation transcript validates lane split (live vs sim/debug vs sim/optional)
4. Live WS verifier proves movement/chat/Tem/training/vocation/gate receipts

## Branch Contract

- Branch prefix: `codex/rookguard-`
- Recommended branch: `codex/rookguard-first30-presentation-v1`
- Label family: `packet:rookguard-first30`

## Validation Gate

```bash
git diff --check
npm -w apps/server run verify:quick
npm -w apps/server run verify:rookguard-first30-presentation
npm -w apps/server run verify:rookguard-quest
npm -w apps/server run verify:rookguard-codex-path
bash scripts/verify-rookguard-first30-presentation.sh
```

## Non-Claims

- No beta/staging presentation polish
- No production launch
- No protocol change
- No runtime deploy

## Follow-On

- Live beta/staging screenshot proof (release lane)
- `AKALYNTH_COUNCIL_DAO_V2`