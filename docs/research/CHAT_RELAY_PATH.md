# Chat Relay Path

Lane: AKALYNTH_CHAT_ACCOUNTABLE_WORLD_CHAT_BASELINE_V1

Status: baseline only. No encryption and no runtime mutation.

## Source To Server Path

1. Shared protocol exposes `ChatMessage`.
   - `type: 'chat'`
   - `message: string`

2. Debug client sends the shared shape.
   - Empty messages are ignored.
   - Message text is capped at 240 characters before send.

3. Android sends the shared shape.
   - `ChatMessage` is serialized as `chat`.
   - Message text is capped at 240 characters before send.

4. Server receives `case 'chat'`.
   - Requires world entry.
   - Applies per-IP chat rate limit.
   - Uses chat text for Tem responses when active.
   - Applies throttling and anti-spam handling.
   - Marks Rookguard tutorial chat step for non-empty chat.
   - Handles DEBUG-only chat commands before normal broadcast.

## Server To Client Path

1. Accepted normal chat writes an audit receipt:
   - action: `chat`
   - inputs: `{ message: msg.message }`
   - result: `ok`

2. Server broadcasts to the current map:
   - `type: 'chat_broadcast'`
   - `player_id`
   - `name`
   - `message`

3. Debug client receives `chat_broadcast`.
   - Appends `{ from, message, at }` to the rolling local chat list.

4. Android receives `chat_broadcast`.
   - Appends `{ from, message, timestamp }` to the rolling local chat list.

5. Server emits chronicle evidence:
   - `event_type='chat'`
   - `message_len`
   - `message_hash`

## Non-Goals

- No private whisper path.
- No encrypted message path.
- No ciphertext fields.
- No device key exchange.
- No durable user-facing chat history claim.
