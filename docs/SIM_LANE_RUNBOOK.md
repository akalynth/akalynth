# Akalynth Simulation Lane Runbook

## Purpose

The simulation lane is a separate host-local Akalynth runtime for proof runs,
agent economy simulation, and operational dashboard inspection.

It is intentionally separate from beta and staging:

- API host: `sim-api.akalynth.com`
- Static dashboard: `sim.akalynth.com`
- Loopback port: `3002`
- Service: `akalynth-sim.service`
- Runtime artifact tree: `/opt/akalynth-sim`
- Runtime state: `/var/lib/akalynth-sim`
- Key/config custody: `/etc/akalynth-sim`

This lane is not a production launch, Android release, public player lane, or
replacement for beta/staging.

## Current Host State

As of the source lane that introduced this runbook, ops-dev-01 had beta and
staging listeners on `127.0.0.1:3000` and `127.0.0.1:3001`. No sim listener or
sim custody paths were present yet. Installing the sim lane is therefore a new
runtime action, not a cleanup of an existing lane.

## State And Receipt Boundary

The sim service must use its own chain and projection paths:

```ini
AKALYNTH_RECEIPT_CHAIN_PATH=/var/lib/akalynth-sim/audit/receipts.jsonl
AKALYNTH_DB_PATH=/var/lib/akalynth-sim/data/akalynth.db
AKALYNTH_REPLAY_MARKER_PATH=/var/lib/akalynth-sim/data/replay_marker.json
CHRONICLE_KEY_PATH=/etc/akalynth-sim/chronicle.key
```

Do not point the sim lane at beta, staging, or prod receipt/data/key paths.

## Source Files

- `infra/systemd/akalynth-sim.service`
- `infra/caddy/Caddyfile.ops-dev-01`
- `infra/web/sim/index.html`

## DNS Prerequisites

Before Caddy can obtain certificates, both names must resolve to ops-dev-01:

```text
sim.akalynth.com      -> 194.147.221.89
sim-api.akalynth.com  -> 194.147.221.89
```

Keep DNS mode aligned with beta/staging lane policy for ops-dev-01.

## Host Preparation

These are operator steps for ops-dev-01 and require explicit deployment
authorization:

```bash
sudo useradd --system --home /var/lib/akalynth-sim --shell /usr/sbin/nologin akalynth-sim
sudo install -d -o akalynth-sim -g akalynth-sim -m 0750 /var/lib/akalynth-sim/audit /var/lib/akalynth-sim/data
sudo install -d -o akalynth-sim -g akalynth-sim -m 0750 /etc/akalynth-sim
sudo install -d -o root -g root -m 0755 /opt/akalynth-sim
sudo install -d -o root -g root -m 0755 /var/www/akalynth-sim
```

Create `/etc/akalynth-sim/chronicle.key` out of band. Do not reuse beta,
staging, or production keys.

Populate `/opt/akalynth-sim` from an approved release artifact or source-sync
lane before starting the service. Do not point the service at `/opt/akalynth-beta`
or `/opt/akalynth-staging`.

## Install Static Dashboard

```bash
sudo rsync -a --delete infra/web/sim/ /var/www/akalynth-sim/
```

## Install Service And Caddy Config

```bash
sudo install -m 0644 infra/systemd/akalynth-sim.service /etc/systemd/system/akalynth-sim.service
sudo install -m 0644 infra/caddy/Caddyfile.ops-dev-01 /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Starting or restarting `akalynth-sim.service` is a runtime mutation and should
only happen in an approved deploy window.

## Verification

After an approved install/start:

```bash
systemctl is-enabled akalynth-sim
systemctl is-active akalynth-sim
curl -sS -i http://127.0.0.1:3002/v1/health
curl -k -sS --resolve sim-api.akalynth.com:443:127.0.0.1 https://sim-api.akalynth.com/v1/health
curl -4 -sS -i https://sim-api.akalynth.com/v1/health
curl -4 -sS -i https://sim.akalynth.com/
```

Direct loopback health may return `403 {"error":"tls_required"}` if TLS
enforcement is active. Treat that as acceptable only when Caddy/TLS health is
green.

## Rollback

```bash
sudo systemctl stop akalynth-sim
sudo systemctl disable akalynth-sim
sudo rm -f /etc/systemd/system/akalynth-sim.service
sudo systemctl daemon-reload
```

Do not delete `/var/lib/akalynth-sim` or `/etc/akalynth-sim` during rollback
unless a separate data-retention decision explicitly approves it.
