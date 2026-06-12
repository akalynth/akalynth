# Rookguard First 30 Minutes V1

Status: source contract and sim-visible game plan.

## Purpose

This is the first 0-30 minute Rookguard world experience. It is deliberately
small: one newcomer, one safe tutorial corridor, one accountable chat signal,
one Tem challenge, one harmless world ritual, one refusal landmark, one
profession choice, and one gate handoff.

The goal is not to turn Rookguard into a grind zone. The goal is to make the
first half hour legible, server-authoritative, and replayable from receipts.

## Player Promise

Within 30 minutes, a new player should understand:

- movement is intent sent to the server, not client-owned position truth;
- chat is an accountable local-world signal and part of tutorial proof;
- Tem exists as a friendly anti-bot challenge, not a punishment-first wall;
- Rookguard has non-power world objects that can be witnessed safely;
- gates open from server tutorial/training/Codex flags, not client UI state;
- vocation/profession identity is receipt-backed and cosmetic in this slice;
- receipts explain what happened when the client view is questioned.

## 0-30 Minute Path

| Window | Player beat | Server state touched | Receipt actions | Lane |
| --- | --- | --- | --- | --- |
| 0-5 | Spawn, orient, and step onto the movement rune. | `session.currentMap`, player position, `tutorial.move` | `presence_entered`, `tutorial_step_complete` | Live |
| 5-10 | Send one local chat signal in Rookguard. | `tutorial.chat`, map broadcast, chronicle chat hash | `chat`, `tutorial_step_complete` | Live |
| 10-15 | Trigger and pass the Tem challenge. | active Tem challenge, `tutorial.tem`, heat state | `tem_challenge_issued`, `tem_challenge_passed`, `tutorial_step_complete` | Live |
| 15-20 | Visit the runestone table for one harmless roll. | runestone cooldown, nearby broadcast, receipt chain | `runestone_cast`, `presence_lingered` | Sim / debug-gated |
| 20-25 | Inspect the legend stone refusal. | legend sighting/refusal state, heat guard | `legend_sighted` | Sim / optional |
| 25-30 | Defeat training slime, choose a Codex vocation, return to the gate, and complete Rookguard. | `rookguardQuest.trainingComplete`, identity vocation, `tutorial.gate`, `tutorial.complete`, transfer intent | `mob_kill`, `item_minted`, `vocation_declared`, `gate_unlock`, `tutorial_completed` | Live |

**Lane** marks where each window is real today. *Live* windows run on the server
tutorial state machine (`s.tutorial.{move,chat,tem,gate,complete}`) and fire in
any session. *Sim / debug-gated*: the runestone action is gated behind
`DEBUG_MODE` (`runestone_cast` is denied `not_authorized` in production), so that
window is exercised in the sim/debug lane, not by a production newcomer. *Sim /
optional*: the legend-stone beat is a non-gating side ritual — it does not block
the Rookguard exit. The live handoff gates on movement, chat, Tem, training
slime completion, and Codex vocation declaration.

## Player Action Loop

1. Read the current objective.
2. Move to the next visible marker.
3. Perform exactly one simple action: move, chat, answer Tem, touch a landmark,
   or use the gate.
4. See the objective update from server state.
5. Inspect the receipt or event log when something changes.

## Server Authority Boundary

- The client may request movement, chat, runestone use, and gate interaction.
- The server owns position, tutorial flags, Tem result, cooldowns, broadcasts,
  receipts, vocation declaration, and transfer readiness.
- The server derives `rookguardQuest` from server tutorial state and
  receipt-backed Rookguard events, then rebuilds that projection from replayed
  receipts on reconnect/startup; clients do not submit quest completion.
- The dashboard may timelapse server-returned frames, but it must not invent
  tutorial completion, rewards, inventory, gold, or transfer state.
- Vocation selection uses the existing `declare_vocation` message and
  `vocation_declared` receipt. It is accepted in the Rookguard guild hall after
  tutorial and training proof, attaches a Heroes Codex profession profile, and
  grants no power by itself.
- No new economy reward is introduced by this plan.

## Anti-Cheat And Abuse Notes

- Movement remains under the existing movement cadence and heat checks.
- Chat remains plaintext, server-readable local/world chat with current rate
  limits and chat-spam detection.
- Tem failures and spam stay in the existing Tem/heat paths.
- Runestone use must remain cooldown-bound and non-rewarding.
- Repeated legend-stone probing is a refusal/heat surface, not a hidden loot
  or progression path.

## Sim Life Viewer Mapping

`GET /v1/sim/snapshot` includes `rookguard_0_30_gameplan` and receipt-linked
timeline frames through minute 30. The existing `first_5min_gameplan` field
remains for compatibility, but the dashboard renders the Rookguard 0-30 minute
plan as the primary plan.

This mapping is simulated proof for the sim lane. It does not claim that the
live beta/staging client has a polished 30-minute onboarding presentation.

## Playtest Path

1. Open the sim dashboard.
2. Confirm the clock reads `00:00 / 30:00`.
3. Confirm the plan header reads `Rookguard 0-30min Gameplan`.
4. Scrub or timelapse through all six five-minute windows.
5. Confirm every window names server state touched and receipt actions in the
   API response.
6. Run `npm -w apps/server run verify:rookguard-codex-path` for a local
   WebSocket proof that movement, chat, Tem, training, vocation, and gate
   behavior emit their expected receipts (`tutorial_step_complete`, `mob_kill`,
   `item_minted`, `vocation_declared`, `gate_unlock`, `tutorial_completed`).
   The runestone beat only fires with `DEBUG_MODE` enabled —
   without it, `runestone_cast` is denied `not_authorized` — so verify runestone
   and the legend-stone side ritual in the sim/debug lane, not against a
   production newcomer.

## Non-Goals

- No content-alpha claim.
- No production launch claim.
- No new drop rate, gold faucet, XP source, or stat progression.
- No protocol command change.
- `loop_update` now documents additive Rookguard quest/Codex fields on the
  existing server-to-client progression projection.
- No release durability claim beyond the receipt/projection boundary and local
  verifier coverage. `verify:rookguard-quest` proves Rookguard tutorial,
  training, vocation, and gate projection replay, but a production restart proof
  bundle is still separate release evidence.
- No live beta/staging presentation claim from the local WebSocket verifier;
  promotion evidence still belongs in the release/deploy lane.
