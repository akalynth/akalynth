#!/usr/bin/env bash
set -Eeuo pipefail

LANE_ID="${LANE_ID:-goal0-rustdesk-temp}"
ACTION="${ACTION:-start}"
DURATION="${DURATION:-4h}"
PUBLIC_ADDR="${PUBLIC_ADDR:-89.213.118.222}"
RELAY_HOST="${RELAY_HOST:-$PUBLIC_ADDR}"
MANAGE_UFW="${MANAGE_UFW:-0}"
ENABLE_PRO_API_PORT="${ENABLE_PRO_API_PORT:-0}"
RUSTDESK_SERVER_VERSION="${RUSTDESK_SERVER_VERSION:-1.1.15}"
RUSTDESK_USER="${RUSTDESK_USER:-goal0-rustdesk}"

HBBS_PORT="${HBBS_PORT:-21116}"
HBBR_PORT="${HBBR_PORT:-21117}"
TCP_PORT_RANGE="${TCP_PORT_RANGE:-21115:21119}"
UDP_PORT="${UDP_PORT:-21116}"
PRO_API_PORT="${PRO_API_PORT:-21114}"

INSTALL_ROOT="${INSTALL_ROOT:-/opt/goal0/runtime/$LANE_ID}"
BIN_DIR="$INSTALL_ROOT/bin"
DATA_DIR="$INSTALL_ROOT/data"
STATE_DIR="/etc/goal0"
ENV_FILE="$STATE_DIR/$LANE_ID.env"
USER_MARKER="$STATE_DIR/$LANE_ID.user-created"
UFW_MARKER="$STATE_DIR/$LANE_ID.ufw"
CACHE_DIR="/var/cache/goal0/$LANE_ID"
RECEIPT_DIR="/var/lib/goal0/receipts/temp-lane"

HBBS_SERVICE="/etc/systemd/system/$LANE_ID-hbbs.service"
HBBR_SERVICE="/etc/systemd/system/$LANE_ID-hbbr.service"
STOP_SERVICE="/etc/systemd/system/$LANE_ID-stop.service"
STOP_TIMER="/etc/systemd/system/$LANE_ID-stop.timer"
STOP_SCRIPT="/usr/local/sbin/$LANE_ID-stop"

usage() {
  cat <<EOF
Usage:
  PUBLIC_ADDR='89.213.118.222' SSH_TARGET=edge02 $0

Actions:
  ACTION=start   Start temporary RustDesk hbbs/hbbr server and cleanup timer.
  ACTION=status  Show client settings and timer/service state.
  ACTION=stop    Tear down the server immediately.

Key env:
  SSH_TARGET             Optional SSH target. If set, this script runs remotely with sudo.
  PUBLIC_ADDR            Public IP or DNS name clients will use. Default: 89.213.118.222
  RELAY_HOST             Relay host clients receive from hbbs. Default: PUBLIC_ADDR
  DURATION               Default: 4h
  MANAGE_UFW             Set to 1 to add/remove temporary UFW rules.
  ENABLE_PRO_API_PORT    Set to 1 to open TCP 21114 as well.

Public ports:
  TCP 21115-21119 and UDP 21116. Raw VNC/RDP is not exposed.
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

valid_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && ((10#$1 >= 1 && 10#$1 <= 65535))
}

validate_inputs() {
  [[ "$ACTION" == "start" || "$ACTION" == "stop" || "$ACTION" == "status" ]] || die "unknown ACTION: $ACTION"
  [[ "$LANE_ID" =~ ^[A-Za-z0-9_.-]+$ ]] || die "LANE_ID must contain only letters, numbers, dot, underscore, or dash"
  [[ "$DURATION" =~ ^[0-9]+[smhdw]?$ ]] || die "DURATION must be a simple systemd duration like 30m, 4h, or 1d"
  [[ "$PUBLIC_ADDR" =~ ^[A-Za-z0-9_.-]+$ ]] || die "PUBLIC_ADDR must be a DNS name or IPv4 address"
  [[ "$RELAY_HOST" =~ ^[A-Za-z0-9_.-]+$ ]] || die "RELAY_HOST must be a DNS name or IPv4 address"
  if [[ -z "${RUSTDESK_SERVER_URL:-}" ]]; then
    [[ "$RUSTDESK_SERVER_VERSION" =~ ^[0-9]+(\.[0-9]+){1,3}$ ]] || die "RUSTDESK_SERVER_VERSION has an unsupported shape"
  fi
  [[ "$RUSTDESK_USER" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]] || die "RUSTDESK_USER is not a valid system user name"
  valid_port "$HBBS_PORT" || die "HBBS_PORT must be 1-65535"
  valid_port "$HBBR_PORT" || die "HBBR_PORT must be 1-65535"
  valid_port "$UDP_PORT" || die "UDP_PORT must be 1-65535"
  valid_port "$PRO_API_PORT" || die "PRO_API_PORT must be 1-65535"
  [[ "$TCP_PORT_RANGE" =~ ^([0-9]+):([0-9]+)$ ]] || die "TCP_PORT_RANGE must be start:end"
  valid_port "${BASH_REMATCH[1]}" && valid_port "${BASH_REMATCH[2]}" && ((10#${BASH_REMATCH[1]} <= 10#${BASH_REMATCH[2]})) \
    || die "TCP_PORT_RANGE must be ordered ports in 1-65535"
  [[ "$MANAGE_UFW" == "0" || "$MANAGE_UFW" == "1" ]] || die "MANAGE_UFW must be 0 or 1"
  [[ "$ENABLE_PRO_API_PORT" == "0" || "$ENABLE_PRO_API_PORT" == "1" ]] || die "ENABLE_PRO_API_PORT must be 0 or 1"
  [[ "$INSTALL_ROOT" == /opt/goal0/runtime/* ]] || die "INSTALL_ROOT must stay under /opt/goal0/runtime/"
}

quote_env() {
  local name="$1"
  if [[ -n "${!name+x}" ]]; then
    printf '%s=%q ' "$name" "${!name}"
  fi
}

remote_dispatch() {
  if [[ -z "${SSH_TARGET:-}" || "${GOAL0_REMOTE_DISPATCH:-0}" == "1" ]]; then
    return 0
  fi

  local remote_env
  remote_env="GOAL0_REMOTE_DISPATCH=1 "
  for name in ACTION DURATION PUBLIC_ADDR RELAY_HOST MANAGE_UFW ENABLE_PRO_API_PORT RUSTDESK_SERVER_VERSION RUSTDESK_USER HBBS_PORT HBBR_PORT TCP_PORT_RANGE UDP_PORT PRO_API_PORT INSTALL_ROOT LANE_ID; do
    remote_env+="$(quote_env "$name")"
  done

  exec ssh -o BatchMode=yes "$SSH_TARGET" "sudo env $remote_env bash -s --" <"$0"
}

need_root() {
  if [[ "$(id -u)" != "0" ]]; then
    die "must run as root on edge02, or set SSH_TARGET=edge02 so sudo can run remotely"
  fi
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || return 1
}

install_deps() {
  local missing=0
  for cmd in curl openssl unzip; do
    need_cmd "$cmd" || missing=1
  done
  if [[ "$missing" == "0" ]]; then
    return 0
  fi

  need_cmd apt-get || die "missing curl/openssl/unzip and apt-get is unavailable"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y curl openssl unzip
}

asset_for_host() {
  local arch asset sha
  arch="$(uname -m)"

  if [[ -n "${RUSTDESK_SERVER_URL:-}" ]]; then
    [[ -n "${RUSTDESK_SERVER_SHA256:-}" ]] || die "RUSTDESK_SERVER_SHA256 is required with RUSTDESK_SERVER_URL"
    echo "$RUSTDESK_SERVER_URL|$RUSTDESK_SERVER_SHA256|$(basename "$RUSTDESK_SERVER_URL")"
    return 0
  fi

  [[ "$RUSTDESK_SERVER_VERSION" == "1.1.15" ]] || die "unsupported RUSTDESK_SERVER_VERSION without explicit RUSTDESK_SERVER_URL/SHA256: $RUSTDESK_SERVER_VERSION"

  case "$arch" in
    x86_64|amd64)
      asset="rustdesk-server-linux-amd64.zip"
      sha="c553972fd844c0224bc18eb3776f48ee5e018c6d4748729e1cfb14d32a46b394"
      ;;
    aarch64|arm64)
      asset="rustdesk-server-linux-arm64v8.zip"
      sha="4998dd6d32431f9aaf5841663339793bc154d7152313e128832d6b610580abe4"
      ;;
    armv7l)
      asset="rustdesk-server-linux-armv7.zip"
      sha="a1f977d6eb9691a4bb414e1cefe63239d7ee582367b03dd17c29d298a41e2051"
      ;;
    i386|i686)
      asset="rustdesk-server-linux-i386.zip"
      sha="7f9b377146d0da2039134fa9c2a5f533ab8ceee5a3fc5ef08aac6b154c3218f7"
      ;;
    *)
      die "unsupported architecture: $arch"
      ;;
  esac

  echo "https://github.com/rustdesk/rustdesk-server/releases/download/$RUSTDESK_SERVER_VERSION/$asset|$sha|$asset"
}

download_and_install_server() {
  local spec url sha asset archive tmpdir hbbs_src hbbr_src
  spec="$(asset_for_host)"
  IFS='|' read -r url sha asset <<<"$spec"

  mkdir -p "$CACHE_DIR" "$BIN_DIR" "$DATA_DIR"
  archive="$CACHE_DIR/$asset"
  if [[ ! -s "$archive" ]]; then
    curl -fL -o "$archive" "$url"
  fi
  printf '%s  %s\n' "$sha" "$archive" | sha256sum -c -

  tmpdir="$(mktemp -d)"
  unzip -q "$archive" -d "$tmpdir"
  hbbs_src="$(find "$tmpdir" -type f -name hbbs -perm -111 | head -1)"
  hbbr_src="$(find "$tmpdir" -type f -name hbbr -perm -111 | head -1)"
  [[ -n "$hbbs_src" && -n "$hbbr_src" ]] || die "hbbs/hbbr not found in $archive"
  install -m 0755 "$hbbs_src" "$BIN_DIR/hbbs"
  install -m 0755 "$hbbr_src" "$BIN_DIR/hbbr"
  rm -rf "$tmpdir"
}

ensure_user() {
  if id "$RUSTDESK_USER" >/dev/null 2>&1; then
    return 0
  fi
  useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$RUSTDESK_USER"
  touch "$USER_MARKER"
}

write_services() {
  cat >"$HBBR_SERVICE" <<EOF
[Unit]
Description=Goal0 temporary RustDesk relay server hbbr
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUSTDESK_USER
WorkingDirectory=$DATA_DIR
ExecStart=$BIN_DIR/hbbr -p $HBBR_PORT
Restart=on-failure
RestartSec=2
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

  cat >"$HBBS_SERVICE" <<EOF
[Unit]
Description=Goal0 temporary RustDesk ID server hbbs
After=network-online.target $LANE_ID-hbbr.service
Wants=network-online.target
Requires=$LANE_ID-hbbr.service

[Service]
Type=simple
User=$RUSTDESK_USER
WorkingDirectory=$DATA_DIR
ExecStart=$BIN_DIR/hbbs -p $HBBS_PORT -r $RELAY_HOST:$HBBR_PORT
Restart=on-failure
RestartSec=2
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF
}

write_stop_script() {
  cat >"$STOP_SCRIPT" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail

LANE_ID="$LANE_ID"
INSTALL_ROOT="$INSTALL_ROOT"
RUSTDESK_USER="$RUSTDESK_USER"
USER_MARKER="$USER_MARKER"
UFW_MARKER="$UFW_MARKER"
RECEIPT_DIR="$RECEIPT_DIR"

ts="\$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "\$RECEIPT_DIR"

systemctl stop "\$LANE_ID-hbbs.service" "\$LANE_ID-hbbr.service" 2>/dev/null || true
systemctl disable "\$LANE_ID-hbbs.service" "\$LANE_ID-hbbr.service" 2>/dev/null || true
systemctl stop "\$LANE_ID-stop.timer" 2>/dev/null || true
systemctl disable "\$LANE_ID-stop.timer" 2>/dev/null || true

rm -f "$HBBS_SERVICE" "$HBBR_SERVICE" "$STOP_SERVICE" "$STOP_TIMER" "$ENV_FILE"
rm -rf "\$INSTALL_ROOT"

if [[ -f "\$UFW_MARKER" ]] && command -v ufw >/dev/null 2>&1; then
  ufw --force delete allow $TCP_PORT_RANGE/tcp 2>/dev/null || true
  ufw --force delete allow $UDP_PORT/udp 2>/dev/null || true
  ufw --force delete allow $PRO_API_PORT/tcp 2>/dev/null || true
  rm -f "\$UFW_MARKER"
fi

if [[ -f "\$USER_MARKER" ]]; then
  userdel "\$RUSTDESK_USER" 2>/dev/null || true
  rm -f "\$USER_MARKER"
fi

systemctl daemon-reload

cat >"\$RECEIPT_DIR/\$LANE_ID-rustdesk-stop-\$ts.json" <<JSON
{
  "schema": "goal0.temp_rustdesk_server.stop.v1",
  "timestamp_utc": "\$ts",
  "lane_id": "\$LANE_ID",
  "action": "stop",
  "status": "stopped",
  "removed_services": true,
  "removed_private_key_material": true
}
JSON

rm -f "$STOP_SCRIPT"
EOF
  chmod 0755 "$STOP_SCRIPT"
}

write_timer() {
  cat >"$STOP_SERVICE" <<EOF
[Unit]
Description=Goal0 temporary RustDesk server cleanup

[Service]
Type=oneshot
ExecStart=$STOP_SCRIPT
EOF

  cat >"$STOP_TIMER" <<EOF
[Unit]
Description=Stop Goal0 temporary RustDesk server after $DURATION

[Timer]
OnActiveSec=$DURATION
AccuracySec=30s
Unit=$LANE_ID-stop.service

[Install]
WantedBy=timers.target
EOF
}

maybe_manage_ufw() {
  if [[ "$MANAGE_UFW" != "1" ]]; then
    return 0
  fi
  need_cmd ufw || die "MANAGE_UFW=1 but ufw is not installed"
  if ufw status | grep -q "Status: active"; then
    ufw allow "$TCP_PORT_RANGE/tcp" comment "$LANE_ID"
    ufw allow "$UDP_PORT/udp" comment "$LANE_ID"
    if [[ "$ENABLE_PRO_API_PORT" == "1" ]]; then
      ufw allow "$PRO_API_PORT/tcp" comment "$LANE_ID"
    fi
    touch "$UFW_MARKER"
  else
    echo "ufw is installed but inactive; no local firewall rule added" >&2
  fi
}

wait_for_public_key() {
  local i
  for i in $(seq 1 20); do
    if [[ -s "$DATA_DIR/id_ed25519.pub" ]]; then
      cat "$DATA_DIR/id_ed25519.pub"
      return 0
    fi
    sleep 0.5
  done
  die "RustDesk public key was not generated at $DATA_DIR/id_ed25519.pub"
}

write_start_receipt() {
  local pub_key="$1"
  local start_ts="$2"
  local expires_at="$3"
  local receipt="$RECEIPT_DIR/$LANE_ID-rustdesk-start-$(date -u +%Y%m%dT%H%M%SZ).json"
  cat >"$receipt" <<EOF
{
  "schema": "goal0.temp_rustdesk_server.start.v1",
  "timestamp_utc": "$start_ts",
  "lane_id": "$LANE_ID",
  "public_addr": "$PUBLIC_ADDR",
  "relay_host": "$RELAY_HOST",
  "tcp_ports": "$TCP_PORT_RANGE",
  "udp_port": "$UDP_PORT",
  "duration": "$DURATION",
  "expires_at_utc": "$expires_at",
  "rustdesk_server_version": "$RUSTDESK_SERVER_VERSION",
  "public_key": "$pub_key",
  "raw_vnc_public": false,
  "status": "started"
}
EOF
  echo "$receipt"
}

start_server() {
  need_root
  [[ -n "$PUBLIC_ADDR" ]] || die "PUBLIC_ADDR is required"
  install_deps
  mkdir -p "$STATE_DIR" "$RECEIPT_DIR"
  chmod 0700 "$STATE_DIR"

  systemctl stop "$LANE_ID-hbbs.service" "$LANE_ID-hbbr.service" 2>/dev/null || true
  download_and_install_server
  ensure_user
  chown -R "$RUSTDESK_USER:$RUSTDESK_USER" "$INSTALL_ROOT"
  write_services
  write_stop_script
  write_timer
  maybe_manage_ufw

  systemctl daemon-reload
  systemctl enable --now "$LANE_ID-hbbr.service"
  systemctl enable --now "$LANE_ID-hbbs.service"
  systemctl enable --now "$LANE_ID-stop.timer"
  systemctl is-active --quiet "$LANE_ID-hbbr.service"
  systemctl is-active --quiet "$LANE_ID-hbbs.service"

  local pub_key start_ts expires_at receipt
  pub_key="$(wait_for_public_key)"
  start_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  expires_at="$(date -u -d "+$DURATION" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "after $DURATION")"

  cat >"$ENV_FILE" <<EOF
LANE_ID=$LANE_ID
RUSTDESK_ID_SERVER=$PUBLIC_ADDR
RUSTDESK_RELAY_SERVER=$RELAY_HOST
RUSTDESK_KEY=$pub_key
RUSTDESK_TCP_PORTS=$TCP_PORT_RANGE
RUSTDESK_UDP_PORT=$UDP_PORT
STARTED_AT_UTC=$start_ts
EXPIRES_AT_UTC=$expires_at
STOP_COMMAND=sudo ACTION=stop $0
EOF
  chmod 0600 "$ENV_FILE"
  receipt="$(write_start_receipt "$pub_key" "$start_ts" "$expires_at")"

  echo
  echo "Temporary RustDesk server is live:"
  echo "  ID server:    $PUBLIC_ADDR"
  echo "  Relay server: $RELAY_HOST"
  echo "  Key:          $pub_key"
  echo "  TCP ports:    $TCP_PORT_RANGE"
  echo "  UDP port:     $UDP_PORT"
  echo "  Expires:      $expires_at"
  echo "  Receipt:      $receipt"
  echo
  echo "To stop early:"
  echo "  sudo ACTION=stop $0"
}

stop_server() {
  need_root
  if [[ -x "$STOP_SCRIPT" ]]; then
    "$STOP_SCRIPT"
  else
    systemctl stop "$LANE_ID-hbbs.service" "$LANE_ID-hbbr.service" 2>/dev/null || true
    systemctl disable "$LANE_ID-hbbs.service" "$LANE_ID-hbbr.service" 2>/dev/null || true
    systemctl stop "$LANE_ID-stop.timer" 2>/dev/null || true
    systemctl disable "$LANE_ID-stop.timer" 2>/dev/null || true
    rm -f "$HBBS_SERVICE" "$HBBR_SERVICE" "$STOP_SERVICE" "$STOP_TIMER" "$ENV_FILE"
    rm -rf "$INSTALL_ROOT"
    systemctl daemon-reload
  fi
  echo "stopped $LANE_ID"
}

status_server() {
  need_root
  if [[ -f "$ENV_FILE" ]]; then
    sed -n '1,20p' "$ENV_FILE"
  else
    echo "no $ENV_FILE"
  fi
  systemctl --no-pager --full status "$LANE_ID-hbbs.service" 2>/dev/null | sed -n '1,18p' || true
  systemctl --no-pager --full status "$LANE_ID-hbbr.service" 2>/dev/null | sed -n '1,18p' || true
  systemctl list-timers --all "$LANE_ID-stop.timer" 2>/dev/null || true
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi
  remote_dispatch
  validate_inputs
  case "$ACTION" in
    start) start_server ;;
    stop) stop_server ;;
    status) status_server ;;
    *) die "unknown ACTION: $ACTION" ;;
  esac
}

main "$@"
