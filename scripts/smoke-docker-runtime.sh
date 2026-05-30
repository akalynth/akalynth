#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${AKALYNTH_DOCKER_IMAGE:-akalynth/server:local}"
CONTAINER="akalynth-server-runtime-smoke-$$"
VOLUME="akalynth_runtime_smoke_$$"
TMPDIR_SMOKE="$(mktemp -d)"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
  rm -rf "$TMPDIR_SMOKE"
}
trap cleanup EXIT

cd "$ROOT"

docker build -f infra/docker/server.Dockerfile -t "$IMAGE" .

dd if=/dev/urandom of="$TMPDIR_SMOKE/chronicle.key" bs=32 count=1 status=none
chmod 600 "$TMPDIR_SMOKE/chronicle.key"

docker run -d \
  --name "$CONTAINER" \
  --read-only \
  --tmpfs /tmp \
  --cap-drop ALL \
  --cap-add CHOWN \
  --cap-add DAC_OVERRIDE \
  --cap-add SETGID \
  --cap-add SETUID \
  --security-opt no-new-privileges \
  --mount "type=volume,src=$VOLUME,dst=/var/lib/akalynth" \
  -v "$TMPDIR_SMOKE/chronicle.key:/run/secrets/chronicle.key:ro" \
  -e AKALYNTH_BOOTSTRAP=1 \
  "$IMAGE" >/dev/null

health_js="const http=require('node:http');const req=http.get({host:'127.0.0.1',port:3000,path:'/v1/health',headers:{'x-forwarded-proto':'https'}},res=>{res.resume();process.exit(res.statusCode===200?0:1);});req.on('error',()=>process.exit(1));req.setTimeout(4000,()=>{req.destroy();process.exit(1);});"

for _ in $(seq 1 40); do
  if docker exec "$CONTAINER" node -e "$health_js" >/dev/null 2>&1; then
    docker exec "$CONTAINER" sh -lc "sed -n '/^Uid:/p;/^Gid:/p' /proc/1/status && stat -c '%a %u:%g %n' /tmp/akalynth-secrets/chronicle.key"
    docker logs --tail 12 "$CONTAINER"
    printf 'Docker runtime smoke passed\n'
    exit 0
  fi

  if ! docker ps --format '{{.Names}}' | grep -Fxq "$CONTAINER"; then
    docker logs "$CONTAINER" >&2 || true
    exit 1
  fi

  sleep 1
done

docker logs "$CONTAINER" >&2 || true
printf 'Docker runtime smoke timed out\n' >&2
exit 1
