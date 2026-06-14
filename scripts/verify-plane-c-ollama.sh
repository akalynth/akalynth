#!/usr/bin/env bash
set -euo pipefail

SSH_TARGET="${SSH_TARGET:-${PLANE_C_SSH_TARGET:-edge02}}"
SSH_OPTS=(
  -o BatchMode=yes
  -o ConnectTimeout=8
  -o ConnectionAttempts=1
)
WG_INTERFACE="${WG_INTERFACE:-wg-edge-03}"
OLLAMA_HOST="${OLLAMA_HOST:-10.46.0.1}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
ANDROID_SERIAL="${ANDROID_SERIAL:-}"
PEER_PUBLIC_KEY="${PEER_PUBLIC_KEY:-}"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

shell_quote() {
  printf '%q' "$1"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

require_cmd ssh

[[ "$WG_INTERFACE" =~ ^[A-Za-z0-9_.-]+$ ]] || die "WG_INTERFACE contains unsupported characters"
[[ "$OLLAMA_HOST" =~ ^[A-Za-z0-9_.-]+$ ]] || die "OLLAMA_HOST must be a DNS name or IPv4 address"
[[ "$OLLAMA_PORT" =~ ^[0-9]+$ ]] && ((10#$OLLAMA_PORT >= 1 && 10#$OLLAMA_PORT <= 65535)) \
  || die "OLLAMA_PORT must be 1-65535"
if [[ -n "$PEER_PUBLIC_KEY" && ! "$PEER_PUBLIC_KEY" =~ ^[A-Za-z0-9+/=]{40,60}$ ]]; then
  die "PEER_PUBLIC_KEY shape is invalid"
fi

printf 'Plane C Ollama verification\n'
printf '  ssh target:   %s\n' "$SSH_TARGET"
printf '  interface:    %s\n' "$WG_INTERFACE"
printf '  ollama URL:   http://%s:%s\n' "$OLLAMA_HOST" "$OLLAMA_PORT"
if [[ -n "$ANDROID_SERIAL" ]]; then
  printf '  android adb:  %s\n' "$ANDROID_SERIAL"
else
  printf '  android adb:  not requested\n'
fi
printf '\n'

remote_script="$(cat <<'REMOTE'
set -euo pipefail

command -v wg >/dev/null 2>&1 || {
  printf "remote error: wg is not installed\n" >&2
  exit 10
}
command -v ss >/dev/null 2>&1 || {
  printf "remote error: ss is not installed\n" >&2
  exit 11
}
command -v curl >/dev/null 2>&1 || {
  printf "remote error: curl is not installed\n" >&2
  exit 12
}

sudo -n wg show "$WG_INTERFACE" >/dev/null || {
  printf "remote error: %s is not visible to wg\n" "$WG_INTERFACE" >&2
  exit 13
}

if [[ -n "$PEER_PUBLIC_KEY" ]]; then
  sudo -n wg show "$WG_INTERFACE" allowed-ips \
    | awk -v key="$PEER_PUBLIC_KEY" '$1 == key { found=1 } END { exit found ? 0 : 1 }' || {
      printf "remote error: Android peer public key is not present on %s\n" "$WG_INTERFACE" >&2
      exit 14
    }
fi

if ss -ltn "sport = :$OLLAMA_PORT" | awk 'NR > 1 { found=1 } END { exit found ? 0 : 1 }'; then
  printf "remote listen: pass\n"
else
  printf "remote error: no TCP listener on port %s\n" "$OLLAMA_PORT" >&2
  exit 15
fi

if curl -fsS --max-time 5 "http://$OLLAMA_HOST:$OLLAMA_PORT/api/tags" >/dev/null; then
  printf "remote ollama API: pass\n"
else
  printf "remote error: http://%s:%s/api/tags did not answer\n" "$OLLAMA_HOST" "$OLLAMA_PORT" >&2
  exit 16
fi

printf "remote wg peers:\n"
sudo -n wg show "$WG_INTERFACE" allowed-ips
REMOTE
)"

remote_command="WG_INTERFACE=$(shell_quote "$WG_INTERFACE") OLLAMA_HOST=$(shell_quote "$OLLAMA_HOST") OLLAMA_PORT=$(shell_quote "$OLLAMA_PORT") PEER_PUBLIC_KEY=$(shell_quote "$PEER_PUBLIC_KEY") bash -s"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$remote_command" <<<"$remote_script"

if [[ -n "$ANDROID_SERIAL" ]]; then
  require_cmd adb
  printf '\nAndroid reachability check:\n'
  adb -s "$ANDROID_SERIAL" get-state >/dev/null
  if adb -s "$ANDROID_SERIAL" shell toybox nc -z -w 5 "$OLLAMA_HOST" "$OLLAMA_PORT" >/dev/null 2>&1; then
    printf '  %s -> %s:%s pass\n' "$ANDROID_SERIAL" "$OLLAMA_HOST" "$OLLAMA_PORT"
  else
    die "Android serial $ANDROID_SERIAL cannot reach $OLLAMA_HOST:$OLLAMA_PORT"
  fi
fi
