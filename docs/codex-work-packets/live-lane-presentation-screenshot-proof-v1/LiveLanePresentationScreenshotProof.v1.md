# Live Lane Presentation Screenshot Proof v1

Status: `codex:accepted`

Authority object: `AKALYNTH_LIVE_BETA_STAGING_SCREENSHOT_PROOF_V1`

Codex authority: `repos/akalynth-codex/design/live-lane-presentation-screenshot-proof-v1.md`

## Goal

Close the **live beta/staging Rookguard presentation screenshot proof gap** after
`AKALYNTH_ROOKGUARD_FIRST30_PRESENTATION_V1`.

No production launch or content-alpha claim.

## Source Inputs

- `repos/akalynth-codex/design/live-lane-presentation-screenshot-proof-v1.md`
- `repos/akalynth-codex/schema/live-lane-screenshot-register.schema.json`
- `repos/akalynth-codex/samples/live-lane-presentation-screenshot-register.sample.json`
- `akalynth-ops/tools/screenshots/live-lane-presentation-screenshots.mjs`
- `akalynth-ops/evidence/live-lane-presentation-screenshot-proof/closure.json`
- `apps/server/tools/verify-live-lane-presentation-screenshot.ts`

## Packet Work

1. Land screenshot register schema + focused verifier.
2. Add `scripts/verify-live-lane-presentation-screenshot.sh` + runbook.
3. Engineering-loop receipt in `repos/akalynth`.

## Recommended Proof Target

**`live_lane_presentation_screenshot_v1`**

1. Beta and staging lanes each capture desktop + mobile landscape Rookguard shots
2. Register records probe statuses, SHA prefixes, and `passed` lane status
3. Parent `rookguard_first30_presentation_v1` verifier remains green

## Branch Contract

- Branch prefix: `codex/live-lane-`
- Recommended branch: `codex/live-lane-presentation-screenshot-proof-v1`
- Label family: `packet:live-lane-screenshot`

## Validation Gate

```bash
git diff --check
npm -w apps/server run verify:quick
npm -w apps/server run verify:live-lane-presentation-screenshot
npm -w apps/server run verify:rookguard-first30-presentation
bash scripts/verify-live-lane-presentation-screenshot.sh
```

## Non-Claims

- No production launch
- No protocol change
- No automatic runtime deploy

## Follow-On

- `AKALYNTH_COUNCIL_DAO_V2`
- Staging `publish-account-play` in `akalynth-lane-deploy.sh`