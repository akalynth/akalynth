# Chat Accountable World Chat Baseline

Lane: AKALYNTH_CHAT_ACCOUNTABLE_WORLD_CHAT_BASELINE_V1

Status: baseline only. No encryption and no runtime mutation.

## Baseline Decision

Current world/local chat is an accountable plaintext relay:

1. Client sends `chat` with a plaintext `message`.
2. Server accepts it only after world entry.
3. Server applies rate, anti-abuse, Tem, tutorial, and debug-command handling.
4. Accepted normal chat writes a plaintext `chat` audit receipt.
5. Server broadcasts `chat_broadcast` with the same plaintext message to the current map.
6. Server writes a chronicle chat event containing `message_len` and `message_hash`.

This is not encrypted chat. TLS/WSS may protect transport, but TLS is not application-level chat encryption and is not chat E2EE.

## Authority Boundary

World chat remains server-readable, moderated, receipt-compatible, and replay-compatible. Private encrypted whispers are not implemented in this lane and remain a future candidate only after key, report, metadata, replay, and Android parity preconditions are designed.

## Observed Source Evidence

| Surface | Evidence | Baseline classification |
|---|---|---|
| Shared client message | `packages/shared/protocol.ts` defines `ChatMessage` as `type: 'chat'` with `message: string` | implemented |
| Shared server broadcast | `packages/shared/protocol.ts` defines `ChatBroadcastMessage` and `ServerMessages.chatBroadcast` | implemented |
| Protocol docs | `docs/PROTOCOL.md` documents `chat` and `chat_broadcast` | implemented |
| Server handler | `apps/server/src/index.ts` handles `case 'chat'` after `requireWorld(s)` | implemented |
| Rate/abuse boundary | server handler checks `checkIpActionLimit(..., 'chat', ...)` and `onChat(...)` | implemented |
| Tem boundary | server handler passes `msg.message` to `handleTemResponse` when a Tem challenge is active | implemented |
| Tutorial boundary | non-empty Rookguard chat completes the tutorial chat step | implemented |
| Audit receipt | accepted normal chat writes `action: 'chat'` with `inputs: { message: msg.message }` | implemented |
| Map broadcast | accepted normal chat calls `broadcastToMap(... ServerMessages.chatBroadcast(... msg.message))` | implemented |
| Chronicle side effect | accepted normal chat emits `chronicleEvent('chat', ...)` with length and hash | implemented |
| Debug client send | `apps/debug-client/src/hooks/useGameClient.ts` sends `{ type: 'chat', message: message.slice(0, 240) }` | implemented |
| Debug client receive | debug client handles `chat_broadcast` and appends to local rolling chat state | implemented |
| Android send | Android `ChatMessage` serializes `type=chat` and `message`; `GameStore` sends `message.take(240)` | implemented |
| Android receive | Android `ChatBroadcastMessage` maps `player_id`, `name`, and `message`; `GameStore` appends to local rolling chat state | implemented |
| Dedicated durable chat history | no dedicated chat table found in the inspected persistence schema | not found |
| App-level encryption | no ciphertext/chat-key fields in the current shared chat protocol | not found |

## Compatibility

Contract touched: documentation and static verifier only.

Compatibility impact: none. No protocol, schema, server handler, Android, or debug-client behavior changed.

Client action required: none.

Verification command:

```bash
bash scripts/verify-chat-accountable-world-chat-baseline.sh
```
