# Infra

Infrastructure config and runbooks for CI, Docker, deploy, and observability.
Used by automation and operations only.

## Files

- `infra/docker/server.Dockerfile` — server runtime image.
- `infra/docker/server.env.example` — example non-secret server environment.
- `infra/docker/compose.server.example.yml` — Compose template (loopback bind).
- `infra/docker/compose.host.example.yml` — host-side Compose example.
- `infra/docker/akalynth-container-entrypoint` — container entrypoint script.
- `infra/systemd/akalynth.service` — systemd unit for the direct Node runtime
  (sandbox hardened, issue #147; `systemd-analyze security` ~1.4 "OK").
- `infra/systemd/akalynth-beta.service.d/20-hardening.conf` — drop-in that applies
  the same sandbox to the hand-managed beta unit (audit #147). `MemoryDenyWriteExecute`
  stays false (Node's V8 JIT needs W^X memory).
- `infra/systemd/akalynth-docker.service` — systemd unit for the Docker Compose runtime.
- `infra/deploy_beta.sh` — beta deploy helper.
- `infra/caddy/Caddyfile.example` — reverse-proxy template for the prod box.
- `infra/PROVISIONING.md` — runbook for provisioning the prod and dev/Android boxes.

## Docker Server Runtime

The server runtime image is defined in `infra/docker/server.Dockerfile`.
It builds the workspace packages, builds `apps/server`, keeps the runtime
paths under `/var/lib/akalynth`, and runs as the non-root `akalynth` user.
The container entrypoint starts as root only long enough to normalize mounted
runtime paths and copy the mounted chronicle key into tmpfs with `0400`
permissions before dropping to UID/GID `10001`. The Compose template drops all
capabilities and adds back only `CHOWN`, `DAC_OVERRIDE`, `SETGID`, and `SETUID`
for that entrypoint handoff.

The Compose example in `infra/docker/compose.server.example.yml` keeps the
container port bound to `127.0.0.1:3000` for a host-local reverse proxy. It
does not publish the game server directly to the public network.

The example sets `HOST=127.0.0.1` so the in-container bind matches the loopback
port map. Note that the `127.0.0.1:3000:3000` port mapping is what actually
keeps the server host-local: even with `HOST=0.0.0.0` (bind all container
interfaces), the loopback port map negates the wider bind and the server stays
reachable only from the host's loopback. `HOST=127.0.0.1` is the explicit,
defense-in-depth choice and does not change the exposed surface.

Useful checks:

```bash
npm run verify:docker-runtime
docker compose -f infra/docker/compose.server.example.yml config
docker build -f infra/docker/server.Dockerfile -t akalynth/server:local .
npm run render:docker-runtime
npm run smoke:docker-runtime
```

Host-managed Docker runtime:

- Render host files with `npm run render:docker-runtime`. By default this writes
  to `.tmp/akalynth-docker-runtime` for review.
- Existing rendered files are not overwritten unless
  `AKALYNTH_RENDER_OVERWRITE=1` is set.
- Install the rendered `compose.yml` to `/etc/akalynth/compose.yml` for the live
  host after setting an immutable image tag or digest.
- Keep live non-secret environment values in `/etc/akalynth/server.env`.
- Keep operator overrides such as `AKALYNTH_COMPOSE_FILE`,
  `AKALYNTH_ENV_FILE`, and `AKALYNTH_CHRONICLE_KEY_FILE` in
  `/etc/akalynth/docker.env` if the defaults need to change.
- Use `infra/systemd/akalynth-docker.service` as the systemd template for a
  host-local Docker Compose runtime.
- Disable the direct Node `akalynth.service` before enabling the Docker unit
  in a live migration window, so only one process owns `127.0.0.1:3000`.

Production notes:

- Keep the chronicle key file host-local or under approved encrypted custody.
- Keep `/var/lib/akalynth` backed by the owning host's runtime backup process.
- Use `AKALYNTH_BOOTSTRAP=1` only for an explicitly approved fresh genesis.
- Keep Caddy or another approved reverse proxy in front of the loopback bind.
