# Rookguard First30 Presentation — Runbook (v1)

Authority: `AKALYNTH_ROOKGUARD_FIRST30_PRESENTATION_V1`

Proof target: `rookguard_first30_presentation_v1`

## Scope

Reproducible presentation proof for the Rookguard 0–30 minute onboarding path.
Links three surfaces:

1. **Source contract** — `docs/ROOKGUARD_FIRST_30_MINUTES_V1.md`
2. **Sim dashboard** — `GET /v1/sim/snapshot` → `rookguard_0_30_gameplan` + newcomer timeline
3. **Live WebSocket proof** — `verify-rookguard-codex-path` (movement → gate handoff)

This runbook does not claim beta/staging polish, production launch, or content-alpha.

## Lane Split

| Window | Lane | Live WS proof |
|--------|------|---------------|
| 0–5 | Live | movement rune |
| 5–10 | Live | chat signal |
| 10–15 | Live | Tem challenge |
| 15–20 | Sim / debug | runestone (`DEBUG_MODE` only in production) |
| 20–25 | Sim / optional | legend stone refusal |
| 25–30 | Live | training slime → vocation → gate |

## Sim Dashboard Playtest

1. Open `https://sim.akalynth.com/` or debug-client Sim Life panel.
2. Confirm plan header: **Rookguard 0-30min Gameplan**.
3. Scrub `00:00` → `30:00` and confirm six five-minute windows.
4. Confirm newcomer frames name movement, chat, Tem, runestone, legend, training, vocation, gate receipts.
5. Confirm `authority.receipt_boundary === simulated_receipts_only`.

## Validation Commands

From `repos/akalynth`:

```bash
npm -w apps/server run verify:quick
npm -w apps/server run verify:rookguard-first30-presentation
npm -w apps/server run verify:rookguard-quest
npm -w apps/server run verify:rookguard-codex-path
bash scripts/verify-rookguard-first30-presentation.sh
```

## Codex Custody

| Path | Purpose |
|------|---------|
| `repos/akalynth-codex/design/rookguard-first30-presentation-v1.md` | Packet authority |
| `repos/akalynth-codex/schema/rookguard-presentation-transcript.schema.json` | Transcript schema |
| `repos/akalynth-codex/samples/rookguard-first30-presentation-transcript.sample.json` | Canonical sample |
| `repos/akalynth-codex/entries/rookguard-first30-presentation.json` | Live codex entry |

## Non-Mutation Boundary

- No `/opt/akalynth-*` deploy
- No `/var/lib/akalynth-*` or `/etc/akalynth-*` changes
- Sim receipts remain simulated only; live proof uses isolated local WS harness