# Beta Player Readiness Runbook v1

Scope: invited, controlled, playable Akalynth pre-alpha cohorts. This runbook
does not authorize a public launch or a content-alpha claim.

## Open a cohort

Use the exact release commit that will be served and preserve the last known
good commit as rollback point:

```bash
npm run build:server
npm -w apps/server run beta:cohort -- create \
  --cohort beta-YYYY-MM-DD-a \
  --release <release-sha> \
  --rollback <last-known-good-sha> \
  --cap 20 \
  --platform web
npm -w apps/server run beta:cohort -- issue --cohort beta-YYYY-MM-DD-a --count 5
```

The issue command prints raw invite codes once. Deliver them privately. Only
the token hash and a short hint are persisted.

Set the server environment for a controlled private beta:

```text
AKALYNTH_BETA_ENABLED=1
AKALYNTH_BETA_REQUIRE_INVITE=1
```

Do not open a cohort until the release commit, static web commit, health commit,
and rollback backup are recorded in the release evidence packet.

## Player funnel

Track one cohort at a time:

```bash
npm -w apps/server run report:beta-player-readiness -- \
  --cohort beta-YYYY-MM-DD-a \
  --health-url https://beta-api.akalynth.com/v1/health \
  --out docs/evidence/beta-player-readiness/beta-YYYY-MM-DD-a.json
```

Interpret the report from the player perspective:

| Area | Primary evidence | Stop signal |
| --- | --- | --- |
| Invitations | issued → redeemed → first account session | redemption or first-login failures require cohort pause |
| Playability | browser mount → world state → first meaningful action → tutorial complete | blank/error proxy or no world state for any invited player |
| Stability | browser errors, WS disconnects/errors, receipt chain health, API health | any reproducible P0; pause on repeated P1 |
| Engagement | first session duration, play sessions, D1/D7 when eligible | investigate early exits before expanding cohort |
| Gameplay | movement, combat, chat, inventory, quest progression | a core action is blocked for a cohort member |
| Feedback | P0–P3, reproduction, owner, status | no owner or no reproduction attempt on P0/P1 |
| Operations | cohort id, release commit, invite cap, rollback commit | any mismatch between report and deployed release |

`first_meaningful_action` is server-accepted movement or the server's move
tutorial completion. It is not a client claim. D1/D7 are only meaningful after
the eligibility window matures.

## Daily review and triage

```bash
npm -w apps/server run beta:cohort -- list
npm -w apps/server run report:beta-player-readiness -- --cohort beta-YYYY-MM-DD-a
npm -w apps/server run beta:cohort -- triage --feedback bf_<id> --status in_progress --owner <owner>
```

Feedback body and reproduction text remain in the private receipt chain; the
readiness report emits only triage metadata and reproducibility presence.

## Pause and rollback

```bash
npm -w apps/server run beta:cohort -- pause --cohort beta-YYYY-MM-DD-a
npm -w apps/server run beta:cohort -- close --cohort beta-YYYY-MM-DD-a
```

Use `docs/runbooks/beta-refresh-runbook-v1.md` for the actual static/runtime
rollback, backup custody, Caddy validation, and public health checks. Preserve
the receipt chain and report output before repair.

## Verification

```bash
npm -w apps/server run build
npm -w apps/server run verify:beta-player-readiness
npm run verify:beta-player-readiness
bash scripts/verify_protocol_sync.sh
npm run verify:receipts-chain
```

If a command is not available in the current checkout, record that as an
environment gap; do not convert an unavailable check into a pass.
