#!/usr/bin/env bash
set -euo pipefail

# Exit codes:
#   0 = allow operation
#   1 = policy refusal (deliberate block)
#   2 = error (malformed input, script failure)

# Read JSON from stdin
INPUT=$(cat) || true

# Empty stdin - allow (no-op)
if [[ -z "$INPUT" ]]; then
  exit 0
fi

# Validate JSON structure: must contain "tool_input" object
if ! echo "$INPUT" | grep -q '"tool_input"'; then
  echo "[warn_protocol_change] ERROR: Malformed hook input (missing tool_input)" >&2
  exit 2
fi

# Extract file_path from JSON (using simple grep/sed since jq may not be available)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/' | head -1) || true

# No file_path field - allow (Edit tool without file_path is unusual but not our concern)
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Only trigger for protocol surface
case "$FILE_PATH" in
  *protocol.ts)
    echo "" >&2
    echo "PROTOCOL CHANGE WARNING" >&2
    echo "You are editing protocol.ts (breaking-change surface)." >&2
    echo "" >&2
    echo "If this is intentional, re-run with acknowledgement:" >&2
    echo "  AKALYNTH_PROTOCOL_ACK=YES" >&2
    echo "" >&2
    if [[ "${AKALYNTH_PROTOCOL_ACK:-}" != "YES" ]]; then
      echo "Refusing edit until acknowledged." >&2
      exit 1  # Policy refusal
    fi
    ;;
esac

exit 0
