#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

failures=0

require_grep() {
  local pattern="$1"
  local file="$2"
  local label="$3"

  if grep -qE "$pattern" "$file"; then
    printf '[PASS] %s\n' "$label"
  else
    printf '[FAIL] %s\n' "$label"
    printf '       missing pattern: %s in %s\n' "$pattern" "$file"
    failures=$((failures + 1))
  fi
}

require_absent() {
  local pattern="$1"
  local file="$2"
  local label="$3"

  if grep -qE "$pattern" "$file"; then
    printf '[FAIL] %s\n' "$label"
    printf '       unexpected pattern: %s in %s\n' "$pattern" "$file"
    failures=$((failures + 1))
  else
    printf '[PASS] %s\n' "$label"
  fi
}

echo '== Accountable world chat static baseline =='

require_grep "export interface ChatMessage" packages/shared/protocol.ts "shared protocol defines ChatMessage"
require_grep "type: 'chat'" packages/shared/protocol.ts "shared protocol uses chat message type"
require_grep "message: string" packages/shared/protocol.ts "shared protocol keeps chat body as message string"
require_grep "export interface ChatBroadcastMessage" packages/shared/protocol.ts "shared protocol defines ChatBroadcastMessage"
require_grep "type: 'chat_broadcast'" packages/shared/protocol.ts "shared protocol uses chat_broadcast"
require_grep "chatBroadcast: \\(player_id: string, name: string, message: string\\)" packages/shared/protocol.ts "shared ServerMessages helper preserves broadcast body"

require_grep '\| `chat` \| Submits a chat message' docs/PROTOCOL.md "protocol docs describe chat"
require_grep '#### `chat_broadcast`' docs/PROTOCOL.md "protocol docs describe chat_broadcast"

require_grep "case 'chat'" apps/server/src/index.ts "server handles chat message"
require_grep "requireWorld\\(s\\)" apps/server/src/index.ts "server requires world entry for chat"
require_grep "checkIpActionLimit\\(s\\.clientIp, 'chat'" apps/server/src/index.ts "server applies chat IP rate limit"
require_grep "handleTemResponse\\(s\\.anti\\.state, msg\\.message\\)" apps/server/src/index.ts "server uses chat body for Tem response path"
require_grep "action: 'chat'" apps/server/src/index.ts "server writes chat audit receipt action"
require_grep "inputs: \\{ message: msg\\.message \\}" apps/server/src/index.ts "server receipt includes plaintext message input"
require_grep "broadcastToMap\\(s\\.currentMap, ServerMessages\\.chatBroadcast\\(s\\.player!\\.id, s\\.player!\\.name, msg\\.message\\)\\)" apps/server/src/index.ts "server broadcasts accepted chat to map"
require_grep "chronicleEvent\\('chat'" apps/server/src/index.ts "server emits chronicle chat event"
require_grep "message_len: msg\\.message\\.length" apps/server/src/index.ts "server chronicle event records message length"
require_grep 'message_hash: `sha256:' apps/server/src/index.ts "server chronicle event records message hash"

require_grep "const payload: ChatMessage = \\{ type: 'chat', message: message\\.slice\\(0, 240\\) \\}" apps/debug-client/src/hooks/useGameClient.ts "debug client sends chat payload"
require_grep "case 'chat_broadcast'" apps/debug-client/src/hooks/useGameClient.ts "debug client handles chat_broadcast"
require_grep "message: data\\.message" apps/debug-client/src/hooks/useGameClient.ts "debug client stores broadcast message body"
require_grep "maxLength=\\{240\\}" apps/debug-client/src/components/ChatSheet.tsx "debug client chat input caps message length"

require_grep '@SerialName\("chat"\)' apps/android/app/src/main/java/com/akalynth/client/protocol/ClientMessage.kt "Android protocol defines chat serial name"
require_grep "val message: String" apps/android/app/src/main/java/com/akalynth/client/protocol/ClientMessage.kt "Android chat message carries string body"
require_grep 'is ChatMessage -> obj\("chat"\) \{ put\("message", msg\.message\) \}' apps/android/app/src/main/java/com/akalynth/client/protocol/MessageSerializer.kt "Android serializer emits chat body"
require_grep '@SerialName\("chat_broadcast"\)' apps/android/app/src/main/java/com/akalynth/client/protocol/ServerMessage.kt "Android protocol defines chat_broadcast"
require_grep "wsClient\\.send\\(ChatMessage\\(message\\.take\\(240\\)\\)\\)" apps/android/app/src/main/java/com/akalynth/client/game/GameStore.kt "Android sends capped chat message"
require_grep "message = msg\\.message" apps/android/app/src/main/java/com/akalynth/client/game/GameStore.kt "Android stores broadcast message body"

require_absent "ciphertext|encrypted_chat|encrypted_whisper|key_exchange" packages/shared/protocol.ts "shared protocol has no encrypted chat fields"

if grep -RInE 'CREATE TABLE IF NOT EXISTS .*chat|chat_history' apps/server/src/persist >/tmp/akalynth-chat-baseline-persist-grep.txt 2>/dev/null; then
  printf '[FAIL] no dedicated durable chat-history table found\n'
  cat /tmp/akalynth-chat-baseline-persist-grep.txt
  failures=$((failures + 1))
else
  printf '[PASS] no dedicated durable chat-history table found\n'
fi
rm -f /tmp/akalynth-chat-baseline-persist-grep.txt

if [[ "$failures" -ne 0 ]]; then
  printf '\nFAIL: %d accountable chat baseline check(s) failed\n' "$failures"
  exit 1
fi

printf '\nPASS: accountable world chat baseline is present and plaintext/server-readable\n'
