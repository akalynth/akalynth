---
name: android-client
description: Use when developing, auditing, or debugging the Akalynth Android client (apps/android/) — Kotlin app covering WebSocket connection, identity/token login, receipt ingestion, action intent dispatch, snapshot diffs, and UI components.
---

# Android Client

The Android client (`apps/android/`) is a Kotlin/Compose app. It is the canonical mobile player surface and an explicit audit target for identity and protocol correctness.

## Key files and packages

**Network / protocol**
- `network/AkalynthClient.kt` — WS lifecycle orchestrator
- `network/WebSocketConnection.kt` — raw WS connection + reconnect
- `network/ReconnectPolicy.kt` — reconnect backoff
- `network/WsEvent.kt` — WS event types
- `network/ConnectionState.kt` — connection state machine
- `network/IdentityApi.kt` — REST identity calls (token issue, rotation)
- `network/ReceiptIngestionService.kt` — receives and stores receipts
- `network/ReceiptStream.kt` + `WebSocketReceiptStream.kt` — receipt streaming

**Identity / auth**
- `CharacterCreateActivity.kt` — character creation + token bootstrap
- `IdentityStore` (referenced in audit) — persists token and identity across sessions
- Token login must be preferred over guest when a stored token exists.
- Token rotation persistence must survive process restart.

**Actions**
- `actions/ActionBus.kt` — internal action dispatch
- `actions/ActionTransport.kt` + `ActionIntent.kt` — intent-only protocol: client sends what the player intends, never coordinates or truth claims
- `actions/PendingEventMapper.kt` — maps pending intents to outgoing messages

**Snapshot / state**
- `snapshot/diff/SnapshotDiff.kt` — computes diff between server snapshots
- `snapshot/diff/SnapshotState.kt` — local state built from diffs

**UI components**
- `ui/components/GameCanvas` — tile map render
- `ui/components/DPad` / `movement/DPad.kt` — directional input
- `ui/components/hud/GameHUD.kt` — heads-up display
- `ui/components/hotbar/` — item hotbar
- `ui/components/chronicle/ChronicleSheet.kt` — receipt/chronicle viewer
- `ui/components/death/DeathRecapSheet.kt` — death event viewer
- `ui/components/why/WhyExplanationSheet.kt` — anti-cheat explanation UI
- `ui/components/confirmation/Tier2HoldButton.kt` + `Tier3SlideConfirm.kt` — destructive action confirmation

## Rules

- Never derive position, health, or game state from client-side calculation and send it as truth.
- Token login must be attempted before falling back to guest login when a stored token exists.
- Token rotation must persist in `IdentityStore` across cold starts.
- Anti-cheat explanation UI (`WhyExplanationSheet`) must explain the event without exposing detection logic.
- Confirmation tiers (Tier2/Tier3) must be preserved for all destructive actions — do not shortcut them.
- Receipt ingestion is server-authoritative; do not filter or mutate receipts before storage.

## Build

- Android build: `./gradlew assembleDebug` from `apps/android/`
- Verify token login path manually via WireTracerActivity or integration test against a local server.

## Audit exit criteria (from akalynth-system-audit)

- Token login preferred over guest when stored token present.
- Token rotation persisted in IdentityStore across restart.
- Canonical WS path sends intent-only actions.
- Receipt stream stores receipts without modification.

## Output should include

- Files changed.
- Identity or protocol impact.
- Confirmation tier or anti-cheat UI changes flagged explicitly.
- Verification path.
