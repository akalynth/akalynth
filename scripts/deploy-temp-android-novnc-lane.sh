#!/usr/bin/env bash
set -Eeuo pipefail

LANE_ID="${LANE_ID:-goal0-android-novnc}"
ACTION="${ACTION:-start}"
TARGET_VNC_HOST="${TARGET_VNC_HOST:-10.46.0.20}"
TARGET_VNC_PORT="${TARGET_VNC_PORT:-5900}"
LOCAL_BIND="${LOCAL_BIND:-127.0.0.1}"
LOCAL_PORT="${LOCAL_PORT:-6081}"
DURATION="${DURATION:-4h}"
BASIC_AUTH_USER="${BASIC_AUTH_USER:-goal0}"
MANAGE_UFW="${MANAGE_UFW:-0}"
SKIP_TARGET_CHECK="${SKIP_TARGET_CHECK:-0}"

STATE_DIR="/etc/goal0"
RUN_DIR="/run/goal0"
CADDY_CONF_DIR="/etc/caddy/Caddyfile.d"
CADDY_SITE_CONF="$CADDY_CONF_DIR/$LANE_ID.caddy"
WEBSOCKIFY_SERVICE="/etc/systemd/system/$LANE_ID.service"
STOP_SERVICE="/etc/systemd/system/$LANE_ID-stop.service"
STOP_TIMER="/etc/systemd/system/$LANE_ID-stop.timer"
STOP_SCRIPT="/usr/local/sbin/$LANE_ID-stop"
ENV_FILE="$STATE_DIR/$LANE_ID.env"
UFW_MARKER="$STATE_DIR/$LANE_ID.ufw"
RECEIPT_DIR="/var/lib/goal0/receipts/temp-lane"

usage() {
  cat <<EOF
Usage:
  PUBLIC_HOSTNAME='<dns-name-pointing-at-edge02>' \\
    SSH_TARGET=edge02 \\
    $0

Actions:
  ACTION=start   Create HTTPS noVNC lane and 4-hour cleanup timer.
  ACTION=status  Show current lane URL/timer state on target.
  ACTION=stop    Tear down the lane immediately.

Key env:
  SSH_TARGET           Optional SSH target. If set, this script runs remotely with sudo.
  PUBLIC_HOSTNAME      Required for ACTION=start. Dedicated DNS name for Caddy HTTPS.
  TARGET_VNC_HOST      Default: 10.46.0.20
  TARGET_VNC_PORT      Default: 5900
  DURATION             Default: 4h
  BASIC_AUTH_USER      Default: goal0
  MANAGE_UFW           Set to 1 to add/remove a temporary UFW 443/tcp rule.
  SKIP_TARGET_CHECK    Set to 1 to skip checking TARGET_VNC_HOST:TARGET_VNC_PORT.

This exposes only HTTPS/noVNC. It never opens raw public VNC/5900.
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
  [[ "$LANE_ID" =~ ^[A-Za-z0-9_.-]+$ ]] || die "LANE_ID must contain only letters, numbers, dot, underscore, or dash"
  [[ "$TARGET_VNC_HOST" =~ ^[A-Za-z0-9_.-]+$ ]] || die "TARGET_VNC_HOST must be a DNS name or IPv4 address"
  valid_port "$TARGET_VNC_PORT" || die "TARGET_VNC_PORT must be 1-65535"
  [[ "$LOCAL_BIND" =~ ^[0-9.]+$ ]] || die "LOCAL_BIND must be an IPv4 bind address"
  valid_port "$LOCAL_PORT" || die "LOCAL_PORT must be 1-65535"
  [[ "$DURATION" =~ ^[0-9]+[smhdw]?$ ]] || die "DURATION must be a simple systemd duration like 30m, 4h, or 1d"
  [[ "$BASIC_AUTH_USER" =~ ^[A-Za-z0-9_.@-]+$ ]] || die "BASIC_AUTH_USER contains unsupported characters"
  [[ "$MANAGE_UFW" == "0" || "$MANAGE_UFW" == "1" ]] || die "MANAGE_UFW must be 0 or 1"
  [[ "$SKIP_TARGET_CHECK" == "0" || "$SKIP_TARGET_CHECK" == "1" ]] || die "SKIP_TARGET_CHECK must be 0 or 1"
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
  for name in ACTION PUBLIC_HOSTNAME TARGET_VNC_HOST TARGET_VNC_PORT LOCAL_BIND LOCAL_PORT DURATION BASIC_AUTH_USER MANAGE_UFW SKIP_TARGET_CHECK LANE_ID ACME_EMAIL; do
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
  need_cmd caddy || missing=1
  need_cmd openssl || missing=1
  need_cmd websockify || missing=1
  [[ -d /usr/share/novnc ]] || missing=1

  if [[ "$missing" == "0" ]]; then
    return 0
  fi

  need_cmd apt-get || die "missing caddy/websockify/noVNC and apt-get is unavailable"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y caddy novnc openssl websockify
}

check_inputs() {
  validate_inputs
  [[ "$ACTION" == "start" || "$ACTION" == "stop" || "$ACTION" == "status" ]] || die "unknown ACTION: $ACTION"
  if [[ "$ACTION" == "start" ]]; then
    [[ -n "${PUBLIC_HOSTNAME:-}" ]] || die "PUBLIC_HOSTNAME is required for HTTPS"
    [[ "$PUBLIC_HOSTNAME" =~ ^([A-Za-z0-9-]+\.)*[A-Za-z0-9-]+$ ]] || die "PUBLIC_HOSTNAME must be a dedicated DNS hostname, not a URL"
  fi
}

check_target_vnc() {
  if [[ "$SKIP_TARGET_CHECK" == "1" ]]; then
    return 0
  fi

  timeout 4 bash -c "</dev/tcp/$TARGET_VNC_HOST/$TARGET_VNC_PORT" \
    || die "cannot reach VNC target $TARGET_VNC_HOST:$TARGET_VNC_PORT from this host. Start droidVNC-NG and keep Plane C active first."
}

ensure_caddy_import() {
  mkdir -p "$CADDY_CONF_DIR"
  touch /etc/caddy/Caddyfile
  if ! grep -Fqx "import $CADDY_CONF_DIR/*.caddy" /etc/caddy/Caddyfile; then
    cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.goal0-backup-$(date -u +%Y%m%dT%H%M%SZ)"
    {
      echo
      echo "import $CADDY_CONF_DIR/*.caddy"
    } >>/etc/caddy/Caddyfile
  fi
}

write_websockify_service() {
  local websockify_bin
  websockify_bin="$(command -v websockify)"
  cat >"$WEBSOCKIFY_SERVICE" <<EOF
[Unit]
Description=Goal0 temporary Android noVNC lane
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$websockify_bin --web=/usr/share/novnc --heartbeat=30 $LOCAL_BIND:$LOCAL_PORT $TARGET_VNC_HOST:$TARGET_VNC_PORT
Restart=on-failure
RestartSec=2
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict

[Install]
WantedBy=multi-user.target
EOF
}

write_caddy_site() {
  local token="$1"
  local pass="$2"
  local hash
  hash="$(caddy hash-password --plaintext "$pass")"

  if grep -R "^[[:space:]]*$PUBLIC_HOSTNAME[[:space:]]*{" /etc/caddy /usr/local/etc/caddy 2>/dev/null | grep -v "$CADDY_SITE_CONF" >/dev/null; then
    die "Caddy already has a site block for $PUBLIC_HOSTNAME; use a dedicated temporary hostname"
  fi

  cat >"$CADDY_SITE_CONF" <<EOF
$PUBLIC_HOSTNAME {
$(if [[ -n "${ACME_EMAIL:-}" ]]; then printf '    tls %s\n' "$ACME_EMAIL"; fi)
    encode zstd gzip

    log {
        output file /var/log/caddy/$LANE_ID-access.log
        format json
    }

    handle /health-goal0-temp-lane {
        respond "ok\n" 200
    }

    basicauth /$token/* {
        $BASIC_AUTH_USER $hash
    }

    handle_path /$token/* {
        reverse_proxy $LOCAL_BIND:$LOCAL_PORT
    }

    handle {
        respond "not found\n" 404
    }
}
EOF
}

write_stop_script() {
  cat >"$STOP_SCRIPT" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail

LANE_ID="$LANE_ID"
CADDY_SITE_CONF="$CADDY_SITE_CONF"
WEBSOCKIFY_SERVICE="$WEBSOCKIFY_SERVICE"
STOP_SERVICE="$STOP_SERVICE"
STOP_TIMER="$STOP_TIMER"
STOP_SCRIPT="$STOP_SCRIPT"
ENV_FILE="$ENV_FILE"
UFW_MARKER="$UFW_MARKER"
RECEIPT_DIR="$RECEIPT_DIR"

ts="\$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "\$RECEIPT_DIR"

systemctl stop "\$LANE_ID.service" 2>/dev/null || true
systemctl disable "\$LANE_ID.service" 2>/dev/null || true
systemctl stop "\$LANE_ID-stop.timer" 2>/dev/null || true
systemctl disable "\$LANE_ID-stop.timer" 2>/dev/null || true

rm -f "\$CADDY_SITE_CONF" "\$WEBSOCKIFY_SERVICE" "\$STOP_SERVICE" "\$STOP_TIMER" "\$ENV_FILE"

if [[ -f "\$UFW_MARKER" ]] && command -v ufw >/dev/null 2>&1; then
  ufw --force delete allow 443/tcp 2>/dev/null || true
  rm -f "\$UFW_MARKER"
fi

systemctl daemon-reload
systemctl reload caddy 2>/dev/null || systemctl restart caddy 2>/dev/null || true

cat >"\$RECEIPT_DIR/\$LANE_ID-stop-\$ts.json" <<JSON
{
  "schema": "goal0.temp_public_lane.stop.v1",
  "timestamp_utc": "\$ts",
  "lane_id": "\$LANE_ID",
  "action": "stop",
  "status": "stopped",
  "removed_public_proxy": true,
  "removed_credentials_file": true
}
JSON

rm -f "\$STOP_SCRIPT"
EOF
  chmod 0755 "$STOP_SCRIPT"
}

write_timer() {
  cat >"$STOP_SERVICE" <<EOF
[Unit]
Description=Goal0 temporary Android noVNC lane self-destruct

[Service]
Type=oneshot
ExecStart=$STOP_SCRIPT
EOF

  cat >"$STOP_TIMER" <<EOF
[Unit]
Description=Stop Goal0 temporary Android noVNC lane after $DURATION

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
    ufw allow 443/tcp comment "$LANE_ID"
    touch "$UFW_MARKER"
  else
    echo "ufw is installed but inactive; no local firewall rule added" >&2
  fi
}

start_lane() {
  need_root
  check_target_vnc
  install_deps

  mkdir -p "$STATE_DIR" "$RUN_DIR" "$RECEIPT_DIR"
  chmod 0700 "$STATE_DIR"

  local token pass start_ts expires_at url
  token="$(openssl rand -hex 24)"
  pass="$(openssl rand -base64 36 | tr -d '\n' | cut -c1-32)"
  start_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  expires_at="$(date -u -d "+$DURATION" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "after $DURATION")"
  url="https://$PUBLIC_HOSTNAME/$token/vnc.html?autoconnect=true&resize=scale"

  ensure_caddy_import
  write_websockify_service
  write_caddy_site "$token" "$pass"
  write_stop_script
  write_timer
  maybe_manage_ufw

  systemctl daemon-reload
  systemctl enable --now "$LANE_ID.service"
  caddy validate --config /etc/caddy/Caddyfile
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
  systemctl enable --now "$LANE_ID-stop.timer"

  cat >"$ENV_FILE" <<EOF
LANE_ID=$LANE_ID
LANE_URL=$url
BASIC_AUTH_USER=$BASIC_AUTH_USER
BASIC_AUTH_PASSWORD=$pass
TARGET_VNC=$TARGET_VNC_HOST:$TARGET_VNC_PORT
STARTED_AT_UTC=$start_ts
EXPIRES_AT_UTC=$expires_at
STOP_COMMAND=sudo ACTION=stop $0
EOF
  chmod 0600 "$ENV_FILE"

  cat >"$RECEIPT_DIR/$LANE_ID-start-$(date -u +%Y%m%dT%H%M%SZ).json" <<EOF
{
  "schema": "goal0.temp_public_lane.start.v1",
  "timestamp_utc": "$start_ts",
  "lane_id": "$LANE_ID",
  "public_hostname": "$PUBLIC_HOSTNAME",
  "public_url_path": "/$token/",
  "target_vnc": "$TARGET_VNC_HOST:$TARGET_VNC_PORT",
  "duration": "$DURATION",
  "expires_at_utc": "$expires_at",
  "raw_vnc_public": false,
  "auth_layers": ["https", "caddy_basic_auth", "droidvnc_password_expected"],
  "status": "started"
}
EOF

  echo
  echo "Temporary public Android browser lane is live:"
  echo "  URL:      $url"
  echo "  Username: $BASIC_AUTH_USER"
  echo "  Password: $pass"
  echo "  Expires:  $expires_at"
  echo
  echo "Raw VNC/5900 was not exposed. To stop early:"
  echo "  sudo ACTION=stop $0"
}

stop_lane() {
  need_root
  if [[ -x "$STOP_SCRIPT" ]]; then
    "$STOP_SCRIPT"
  else
    systemctl stop "$LANE_ID.service" 2>/dev/null || true
    systemctl disable "$LANE_ID.service" 2>/dev/null || true
    systemctl stop "$LANE_ID-stop.timer" 2>/dev/null || true
    systemctl disable "$LANE_ID-stop.timer" 2>/dev/null || true
    rm -f "$CADDY_SITE_CONF" "$WEBSOCKIFY_SERVICE" "$STOP_SERVICE" "$STOP_TIMER" "$ENV_FILE"
    systemctl daemon-reload
    systemctl reload caddy 2>/dev/null || true
  fi
  echo "stopped $LANE_ID"
}

status_lane() {
  need_root
  if [[ -f "$ENV_FILE" ]]; then
    sed -n '1,20p' "$ENV_FILE"
  else
    echo "no $ENV_FILE"
  fi
  systemctl --no-pager --full status "$LANE_ID.service" 2>/dev/null | sed -n '1,18p' || true
  systemctl list-timers --all "$LANE_ID-stop.timer" 2>/dev/null || true
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi
  remote_dispatch
  check_inputs

  case "$ACTION" in
    start) start_lane ;;
    stop) stop_lane ;;
    status) status_lane ;;
  esac
}

main "$@"
