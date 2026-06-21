# Live Lane Presentation Screenshot Proof — Runbook (v1)

Authority: `AKALYNTH_LIVE_BETA_STAGING_SCREENSHOT_PROOF_V1`

Proof target: `live_lane_presentation_screenshot_v1`

Parent proof: `rookguard_first30_presentation_v1`

## Scope

Visual release-lane proof that beta and staging `/play/` clients connect to Rookguard
with presentation UI visible. Complements the First30 presentation transcript and live
WebSocket Codex Path verifier without claiming production launch.

## Capture Surfaces

| Lane | Web | API | Viewports |
|------|-----|-----|-----------|
| beta | `https://beta.akalynth.com` | `https://beta-api.akalynth.com` | desktop 1440×900, mobile landscape 932×430 |
| staging | `https://staging.akalynth.com` | `https://staging-api.akalynth.com` | desktop 1440×900, mobile landscape 932×430 |

## Ops Capture (akalynth-ops)

From `akalynth-ops` with operator `--live-ack` (creates disposable lane accounts):

```bash
bash scripts/capture-live-lane-presentation-screenshots.sh
LANE=staging bash scripts/capture-live-lane-presentation-screenshots.sh
```

Artifacts:

| Path | Purpose |
|------|---------|
| `tools/screenshots/live-lane-presentation-screenshots.mjs` | Lane probes + Playwright capture |
| `scripts/capture-live-lane-presentation-screenshots.sh` | Wrapper (Playwright install) |
| `evidence/<stamp>-live-lane-presentation-screenshots/` | Register + PNGs |
| `evidence/live-lane-presentation-screenshot-proof/closure.json` | Packet closure |

## Staging Publish

Operator action from `akalynth-ops`:

```bash
# plan only
./bin/akalynth-lane-deploy.sh staging publish-account-play --dry-run

# live publish (build + restart staging, publish /play/, sync Caddy)
./bin/akalynth-lane-deploy.sh staging publish-account-play

# publish + disposable-account screenshot smoke
AKALYNTH_LIVE_ACK=1 ./bin/akalynth-lane-deploy.sh staging publish-account-play
```

Staging publishes `/play/` only (no lane-local `account.html` yet). If disposable-account
screenshot smoke fails on email verify, apply a temporary `ALLOW_INSECURE_LOCAL=1`
systemd drop-in on `akalynth-staging` during capture, then revert.

Evidence: `evidence/<stamp>-staging-publish-account-play-remote/`

## Validation Commands

From `repos/akalynth`:

```bash
npm -w apps/server run verify:quick
npm -w apps/server run verify:live-lane-presentation-screenshot
npm -w apps/server run verify:rookguard-first30-presentation
bash scripts/verify-live-lane-presentation-screenshot.sh
```

## Codex Custody

| Path | Purpose |
|------|---------|
| `repos/akalynth-codex/design/live-lane-presentation-screenshot-proof-v1.md` | Packet authority |
| `repos/akalynth-codex/schema/live-lane-screenshot-register.schema.json` | Register schema |
| `repos/akalynth-codex/samples/live-lane-presentation-screenshot-register.sample.json` | Canonical sample |
| `repos/akalynth-codex/entries/live-lane-presentation-screenshot-proof.json` | Live codex entry |

## Non-Mutation Boundary

- No automatic CI deploy to `/opt/akalynth-*`
- Capture mutates lane account/character state only via disposable smoke
- Caddy/runtime changes require explicit operator authorization per lane