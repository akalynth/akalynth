#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKERFILE="$ROOT/infra/docker/server.Dockerfile"
COMPOSE_FILE="$ROOT/infra/docker/compose.server.example.yml"
HOST_COMPOSE_FILE="$ROOT/infra/docker/compose.host.example.yml"
ENV_EXAMPLE="$ROOT/infra/docker/server.env.example"
ENTRYPOINT="$ROOT/infra/docker/akalynth-container-entrypoint"
DOCKERIGNORE="$ROOT/.dockerignore"
CI_WORKFLOW="$ROOT/.github/workflows/ci.yml"
SMOKE_SCRIPT="$ROOT/scripts/smoke-docker-runtime.sh"
RENDER_SCRIPT="$ROOT/scripts/render-docker-runtime.sh"
SYSTEMD_UNIT="$ROOT/infra/systemd/akalynth-docker.service"

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    printf 'missing required file: %s\n' "$path" >&2
    exit 1
  fi
}

require_contains() {
  local path="$1"
  local needle="$2"
  local label="$3"
  if ! grep -Fq "$needle" "$path"; then
    printf '%s missing expected content: %s\n' "$label" "$needle" >&2
    exit 1
  fi
}

require_file "$DOCKERFILE"
require_file "$COMPOSE_FILE"
require_file "$HOST_COMPOSE_FILE"
require_file "$ENV_EXAMPLE"
require_file "$ENTRYPOINT"
require_file "$DOCKERIGNORE"
require_file "$CI_WORKFLOW"
require_file "$SMOKE_SCRIPT"
require_file "$RENDER_SCRIPT"
require_file "$SYSTEMD_UNIT"

require_contains "$DOCKERFILE" "FROM node:20-bookworm-slim AS build" "server Dockerfile"
require_contains "$DOCKERFILE" "npm run build:packages" "server Dockerfile"
require_contains "$DOCKERFILE" "npm -w apps/server run build" "server Dockerfile"
require_contains "$DOCKERFILE" "cp apps/server/package.json dist/server/package.json" "server Dockerfile"
require_contains "$DOCKERFILE" "cp apps/server/package.json dist/server/apps/server/package.json" "server Dockerfile"
require_contains "$DOCKERFILE" 'ENTRYPOINT ["/usr/local/bin/akalynth-container-entrypoint"]' "server Dockerfile"
require_contains "$DOCKERFILE" "HEALTHCHECK" "server Dockerfile"
require_contains "$DOCKERFILE" 'CMD ["node", "../../dist/server/apps/server/src/index.js"]' "server Dockerfile"

require_contains "$ENTRYPOINT" "setpriv" "server entrypoint"
require_contains "$ENTRYPOINT" "CHRONICLE_KEY_PATH=/tmp/akalynth-secrets/chronicle.key" "server entrypoint"

require_contains "$COMPOSE_FILE" "127.0.0.1:3000:3000" "server compose example"
require_contains "$COMPOSE_FILE" "cap_add:" "server compose example"
require_contains "$COMPOSE_FILE" "CHOWN" "server compose example"
require_contains "$COMPOSE_FILE" "SETUID" "server compose example"
require_contains "$COMPOSE_FILE" "SETGID" "server compose example"
require_contains "$COMPOSE_FILE" "DAC_OVERRIDE" "server compose example"
require_contains "$COMPOSE_FILE" "AKALYNTH_RECEIPT_CHAIN_PATH=/var/lib/akalynth/audit/receipts.jsonl" "server compose example"
require_contains "$COMPOSE_FILE" "CHRONICLE_KEY_PATH=/run/secrets/chronicle.key" "server compose example"
require_contains "$COMPOSE_FILE" "x-forwarded-proto" "server compose example"

require_contains "$HOST_COMPOSE_FILE" "image: \${AKALYNTH_IMAGE" "host compose example"
require_contains "$HOST_COMPOSE_FILE" "127.0.0.1:3000:3000" "host compose example"
require_contains "$HOST_COMPOSE_FILE" "CHRONICLE_KEY_PATH=/run/secrets/chronicle.key" "host compose example"
if grep -Fq "build:" "$HOST_COMPOSE_FILE"; then
  printf 'host compose example must not contain build instructions\n' >&2
  exit 1
fi

require_contains "$ENV_EXAMPLE" "AKALYNTH_CHRONICLE_KEY_FILE=/etc/akalynth/chronicle.key" "server env example"
require_contains "$DOCKERIGNORE" "node_modules" ".dockerignore"
require_contains "$DOCKERIGNORE" "dist" ".dockerignore"
require_contains "$DOCKERIGNORE" ".git" ".dockerignore"
require_contains "$CI_WORKFLOW" "npm run verify:docker-runtime" "CI workflow"
require_contains "$SMOKE_SCRIPT" "docker build -f infra/docker/server.Dockerfile" "Docker smoke script"
require_contains "$SMOKE_SCRIPT" "AKALYNTH_BOOTSTRAP=1" "Docker smoke script"
require_contains "$SMOKE_SCRIPT" "/tmp/akalynth-secrets/chronicle.key" "Docker smoke script"
require_contains "$RENDER_SCRIPT" "compose.host.example.yml" "Docker render script"
require_contains "$RENDER_SCRIPT" "docker compose --env-file" "Docker render script"
require_contains "$RENDER_SCRIPT" "AKALYNTH_RENDER_OVERWRITE=1" "Docker render script"
require_contains "$SYSTEMD_UNIT" "AKALYNTH_COMPOSE_FILE=/etc/akalynth/compose.yml" "Docker systemd unit"
require_contains "$SYSTEMD_UNIT" "docker compose --env-file \${AKALYNTH_ENV_FILE}" "Docker systemd unit"
require_contains "$SYSTEMD_UNIT" "ExecStartPre=/usr/bin/test -f \${AKALYNTH_COMPOSE_FILE}" "Docker systemd unit"

printf 'Docker runtime artifact checks passed\n'
