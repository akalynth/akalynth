#!/usr/bin/env bash
set -euo pipefail

SSH_TARGET="${SSH_TARGET:-${TARGET:-edge02}}"
WG_IF="${WG_IF:-wg-edge-03}"
PEER_NAME="${PEER_NAME:-operator-graphene-01}"
PEER_PUBLIC_KEY="${PEER_PUBLIC_KEY:-}"
PEER_ALLOWED_IPS="${PEER_ALLOWED_IPS:-10.46.0.20/32}"
APPLY="${APPLY:-0}"

SSH_OPTS=(
  -o BatchMode=yes
  -o ConnectTimeout=8
  -o ConnectionAttempts=1
)

usage() {
  cat <<EOF
Usage:
  PEER_PUBLIC_KEY=<android-wireguard-public-key> $0
  APPLY=1 PEER_PUBLIC_KEY=<android-wireguard-public-key> $0
  SSH_TARGET='<user>@89.213.118.222' PEER_PUBLIC_KEY=<android-wireguard-public-key> $0

Defaults:
  SSH_TARGET=${SSH_TARGET}
  WG_IF=${WG_IF}
  PEER_NAME=${PEER_NAME}
  PEER_ALLOWED_IPS=${PEER_ALLOWED_IPS}

Default mode is dry-run. APPLY=1 updates edge02 runtime and appends the peer to
/etc/wireguard/${WG_IF}.conf if it is not already present.

Only paste the Android WireGuard public key. Do not paste the Android private
key into terminal history, chat, docs, or repo files.
EOF
}

require_env() {
  if [[ -z "$PEER_PUBLIC_KEY" ]]; then
    usage >&2
    exit 2
  fi
  if [[ ! "$PEER_NAME" =~ ^[A-Za-z0-9_.-]+$ ]]; then
    echo "bad PEER_NAME" >&2
    exit 2
  fi
  if [[ ! "$WG_IF" =~ ^[A-Za-z0-9_.-]+$ ]]; then
    echo "bad WG_IF" >&2
    exit 2
  fi
  if [[ ! "$PEER_PUBLIC_KEY" =~ ^[A-Za-z0-9+/=]{40,60}$ ]]; then
    echo "bad PEER_PUBLIC_KEY shape" >&2
    exit 2
  fi
  if [[ ! "$PEER_ALLOWED_IPS" =~ ^10\.46\.0\.[0-9]+/32$ ]]; then
    echo "bad PEER_ALLOWED_IPS for Plane C Android peer" >&2
    exit 2
  fi
}

remote_quote() {
  printf '%q' "$1"
}

remote() {
  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$@"
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi
  require_env

  local command
  command="set -e
sudo test -f /etc/wireguard/${WG_IF}.conf
sudo wg show ${WG_IF} >/dev/null
if sudo wg show ${WG_IF} allowed-ips | awk '{print \$2}' | grep -qx '${PEER_ALLOWED_IPS}'; then
  echo 'allowed-ip-already-present: ${PEER_ALLOWED_IPS}' >&2
  exit 3
fi
sudo wg set ${WG_IF} peer '${PEER_PUBLIC_KEY}' allowed-ips '${PEER_ALLOWED_IPS}'
if ! sudo grep -Fq '${PEER_PUBLIC_KEY}' /etc/wireguard/${WG_IF}.conf; then
  sudo sh -c 'cat >> /etc/wireguard/${WG_IF}.conf' <<'EOF'

# ${PEER_NAME}
[Peer]
PublicKey = ${PEER_PUBLIC_KEY}
AllowedIPs = ${PEER_ALLOWED_IPS}
EOF
fi
sudo wg show ${WG_IF}
"

  printf '# add Plane C Android peer\n\n'
  printf 'ssh_target=%s\ninterface=%s\npeer_name=%s\nallowed_ips=%s\napply=%s\n' \
    "$SSH_TARGET" "$WG_IF" "$PEER_NAME" "$PEER_ALLOWED_IPS" "$APPLY"

  printf '\n== remote preflight ==\n'
  remote "set +e; hostname; ip -brief addr show ${WG_IF}; sudo wg show ${WG_IF}; sudo grep -F '${PEER_PUBLIC_KEY}' /etc/wireguard/${WG_IF}.conf >/dev/null && echo peer-config-present || echo peer-config-missing"

  if [[ "$APPLY" == "1" ]]; then
    printf '\n== apply ==\n'
    remote "$command"
  else
    printf '\nDry-run command:\n'
    printf 'ssh %s %s\n' "$SSH_TARGET" "$(remote_quote "$command")"
  fi
}

main "$@"
