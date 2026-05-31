# Akalynth MMO Site & Mob-Loot Fix Runbook

> **ARCHIVED (2026-05-30).** Both deliverables shipped (mmo-site PR #75; mob-loot id fix PR #81, commit `1aff123`). This is a completed-work evidence log, not an active runbook. Kept for history.

> **Purpose:** Reproduce, serve, screenshot, and verify the two deliverables from this work session — the static **Akalynth marketing/shop site** (`mmo-site/`) and the **receipt-derived mob-loot item-id fix** — from a fresh checkout.

## Scope

This runbook covers a static marketing site and an internal server content fix. It does **not** prove production readiness or public launch readiness, and the shop is a **preview storefront only — no real payments are processed** (Akalynth is pre-alpha). The mob-loot change is an id-derivation/receipt-hygiene fix with **zero economy impact** (drop rates, quantities, gold values, and item types are unchanged).

## Required Environment

- Linux
- Node.js 20+
- npm, Git
- Python 3 (only for the local static preview server)

Windows is intentionally unsupported.

---

## Part A — MMO Marketing / Shop Site (`mmo-site/`)

### Layout

```
mmo-site/
├── index.html        # Home / World / Account tabs (hash-routed, no deps)
├── shop.html         # standalone Coin Exchange (coin packs, premium, cosmetics)
├── css/style.css     # classic-MMO theme (original CSS — no third-party assets)
├── js/app.js         # tab nav + localStorage cart (shared across both pages)
└── screenshots/      # committed desktop + mobile previews (01–05)
```

Brand: **Akalynth — The World of Azura**. The classic-MMO aesthetic (stone backdrop, parchment content column, gold-on-brown sidebar) is recreated with original CSS and copy; no third-party logos, art, or text.

### Step A1: Serve locally

```bash
cd mmo-site
python3 -m http.server 8090
```

Open <http://localhost:8090/>. Use **8090** (not 8080) — on the dev box, **8080 is held by a running `node` process**; do not displace it. If remote, forward the port: `ssh -L 8090:localhost:8090 <host>`.

Smoke check while it serves:

```bash
for p in "" shop.html css/style.css js/app.js; do
  curl -s -o /dev/null -w "/$p -> %{http_code}\n" "http://127.0.0.1:8090/$p"
done
# all four should be 200
```

### Step A2: Functional check (cart)

- Open **Shop** from the header → loads `shop.html`.
- Click **Add to cart** on a few items: the cart panel lines, the footer **Total** (coins), and the sidebar **Your Pack** (`item(s) · coins`) all update.
- Refresh — the cart persists (`localStorage` key `akalynth.cart.v1`).
- **Checkout (preview)** pops a confirmation alert and processes **no** payment.
- **← Back to the Realm** returns to `index.html`; the cart count carries over.

### Step A3: Regenerate screenshots (optional)

Screenshots are committed under `mmo-site/screenshots/`. To regenerate (server must be running on 8090):

- **Preferred — Playwright MCP** (registered at local scope, Chromium installed). Loads at a fresh Claude Code session start; then drive `browser_navigate` + `browser_take_screenshot`.
- **Fallback — direct script** using the installed Chromium via `playwright-core`. The session used a small `.tmp/shot.js` driver (not committed) capturing: `01-home`, `02-world`, `03-shop`, `04-shop-cart`, `05-home-mobile`.

> Note: mobile full-page captures show the sticky header *below* the sidebar — a Playwright `fullPage` + `position: sticky` capture artifact, **not** a layout bug.

### Step A4: Deploy (notes)

The site is fully static — host the `mmo-site/` directory behind any static server or the existing Caddy front (see `infra/` and `docs/NEW_BOX_PROVISIONING.md`). No build step, no runtime, no secrets.

### Git state

Committed on branch **`feat/mmo-site-shop`** as `ea8226b` (`feat(mmo-site): Akalynth marketing site + Coin Exchange shop`), 9 files incl. the 5 screenshots. **Not pushed.**

---

## Part B — Mob-Loot Item-ID Fix (receipt-derived)

### What changed and why

Mob loot (the per-kill `<mob>_goo` and the guaranteed `training_slime` `slime` trophy) previously generated item ids from wall-clock time (`loot:<type>:${Date.now()}`) and **stored `item_id` in the `mob_loot_spawned` receipt body** — inconsistent with the receipt-derivation convention used by `item_minted`/shop/legendary mints (`generateItemId(computeReceiptHash(receipt))`, see `apps/server/src/persist/materializers.ts`).

PR #81 fixed the id derivation: ids are now `generateItemId(computeReceiptHash(receipt))` — deterministic, replay-safe, no `item_id` in the receipt body (hash-cycle guard). That PR still used `mob_loot_spawned`, which had **no materializer**, so no `items` DB row was created until pickup.

**PR #82 (this change)** replaces `mob_loot_spawned` with `item_minted` in `spawnMobLoot`. The existing `handleItemMinted` materializer now fires at spawn time, running `INSERT OR IGNORE INTO items (item_id, item_type, created_at, genesis_receipt, meta_json)`. This gives mob-loot items a durable `items` row **before** any pickup — matching how shop and legendary items work.

Files changed in #82:

- `apps/server/src/world/mobs.ts` — `spawnMobLoot` now emits `action: 'item_minted'`; `MobLootWriteInput.action` typed as `'item_minted'`; optional `meta` added to `MobLootDeps` and `MobLootSpawn`.
- `apps/server/src/index.ts` — inline comments updated; pickup-path comment updated for backward-compat note.
- `apps/server/tools/verify-mob-loot.ts` — action assertion updated to `item_minted`; materializer integration test added.
- `apps/server/tools/verify-item-pickup-type.ts` — header comment updated to reflect new design.

**Replay safety:** Old `mob_loot_spawned` receipts on existing chains have **no materializer** (they were always a no-op for DB state). They continue to replay without error; the `items` row for those items is still created at pickup via `item_added_to_inventory` carrying `item_type`. New receipts create the row at spawn. No migration needed.

### Receipt / economy / protocol impact

- **Receipt schema:** `spawnMobLoot` now writes `action: 'item_minted'` instead of `mob_loot_spawned`. The `inputs` carry `item_type`, `meta`, `map`, `x`, `y`. No `item_id` in the body (hash-cycle guard preserved).
- **Economy:** none — drop rates, quantities, gold values, and item types are unchanged.
- **Anti-cheat / protocol:** none — `worldItemAdded` still carries the id as an opaque string.

### Step B1: Verify

```bash
cd apps/server
npx tsc --noEmit -p tsconfig.json       # type-check (expect exit 0)
npm run verify:mob-loot                 # spawn-path + materializer tests (8 checks)
npm run verify:item-pickup-type         # pickup backward-compat tests (3 checks)
npm run verify:quick                    # spine/chain integrity
```

`verify:mob-loot` asserts: receipt body omits `item_id`; action is `item_minted`; `itemId === generateItemId(computeReceiptHash(receipt))` (real functions); 32-char hex format; distinct ids for identical loot at the same tile; deterministic/replay-safe id sequence; returned loot mirrors requested type/position; materializer creates `items` row at spawn with correct `item_type`.

### Git state

Committed on branch `codex/issue-82-mint-mob-loot-via-item-minted`. Not pushed.

---

## Quick Reference

| Action | Command |
| --- | --- |
| Serve site | `cd mmo-site && python3 -m http.server 8090` |
| Site smoke | `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8090/` |
| Loot test | `cd apps/server && npm run verify:mob-loot` |
| Type-check | `cd apps/server && npx tsc --noEmit -p tsconfig.json` |
