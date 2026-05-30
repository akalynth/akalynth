#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-${AKALYNTH_RENDER_DIR:-$ROOT/.tmp/akalynth-docker-runtime}}"
OVERWRITE="${AKALYNTH_RENDER_OVERWRITE:-0}"

COMPOSE_SRC="$ROOT/infra/docker/compose.host.example.yml"
ENV_SRC="$ROOT/infra/docker/server.env.example"
UNIT_SRC="$ROOT/infra/systemd/akalynth-docker.service"

mkdir -p "$OUT_DIR"

for file in compose.yml server.env docker.env akalynth-docker.service; do
  if [[ -e "$OUT_DIR/$file" && "$OVERWRITE" != "1" ]]; then
    printf 'refusing to overwrite existing file: %s\n' "$OUT_DIR/$file" >&2
    printf 'set AKALYNTH_RENDER_OVERWRITE=1 to replace rendered files\n' >&2
    exit 1
  fi
done

install -m 0644 "$COMPOSE_SRC" "$OUT_DIR/compose.yml"
install -m 0644 "$ENV_SRC" "$OUT_DIR/server.env"
install -m 0644 "$UNIT_SRC" "$OUT_DIR/akalynth-docker.service"

cat >"$OUT_DIR/docker.env" <<'EOF'
# Host-local systemd overrides for akalynth-docker.service.
# Keep real secret values out of this file.
AKALYNTH_COMPOSE_FILE=/etc/akalynth/compose.yml
AKALYNTH_ENV_FILE=/etc/akalynth/server.env
AKALYNTH_CHRONICLE_KEY_FILE=/etc/akalynth/chronicle.key
EOF

docker compose --env-file "$OUT_DIR/server.env" -f "$OUT_DIR/compose.yml" config --quiet

printf 'Rendered Docker runtime files to %s\n' "$OUT_DIR"
printf 'Review before installing on a host:\n'
printf '  %s/compose.yml\n' "$OUT_DIR"
printf '  %s/server.env\n' "$OUT_DIR"
printf '  %s/docker.env\n' "$OUT_DIR"
printf '  %s/akalynth-docker.service\n' "$OUT_DIR"
