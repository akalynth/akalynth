# Static Site Retired from Monorepo

**Effective:** 2026-06-01
**Lane:** AKALYNTH_MAIN_MMO_SITE_RETIREMENT_V1

## What changed

The `mmo-site/` directory has been removed from this monorepo.

The public static site source now lives in **akalynth-site** (`github.com/akalynth/akalynth-site`).
The monorepo mmo-site copy has been retired and is not the publication authority.
akalynth.com remains served from the prod Caddy webroot `/var/www/akalynth`.

## Why

Two static-site source surfaces existed simultaneously:
- `akalynth-site` repo — current public site authority, source of live deployments
- `akalynth/mmo-site/` — stale monorepo copy, not live, drift and confusion risk

This retirement removes the stale copy so future operators have a single, unambiguous source of truth.

## What is NOT changing

- `/var/www/akalynth` on prod is **not** touched by this change
- Caddy config is **not** changed
- The live site at `akalynth.com` is **not** affected
- DNS is **not** changed
- `akalynth-site` source is **not** modified

## Historical record

The original `mmo-site/` was introduced in PR #75 (`feat(mmo-site): Akalynth marketing site + Coin Exchange shop`).
Its archived operational history is in `docs/archive/MMO_SITE_AND_LOOT_RUNBOOK.md`.

## Deployment going forward

To update the live site, build and deploy from `akalynth-site`.
See akalynth-ops runbooks for the publication procedure.
