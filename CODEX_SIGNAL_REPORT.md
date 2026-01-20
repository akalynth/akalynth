# CODEX SIGNAL REPORT — "Where Are We?"

> **Status:** Historical diagnostic snapshot (non-authoritative for v1).

**Date**: 2026-01-12T20:06:00Z  
**Repo**: VaultSovereign/akalynth  
**Branch**: copilot/comfortable-partridge  

---

## 1) CURRENT SIGNAL (3 lines)

- **Playable**: 🟡 YELLOW — Core loop is functional (login, move, chat, combat, death, pickup) but lacks polish; item drops work but inventory UI is stub-only; map transitions exist but no gating enforced.
- **Anti-bot**: 🟡 YELLOW — Strong server authority + heat + Tem challenges + action throttles exist; missing per-IP rate limits and automated pattern detection hooks are incomplete.
- **Economy**: 🟢 GREEN — Treasury system operational with Gold credit/debit receipts, action costs enforced, drop policy weighted by reputation/heat, audit trail complete; needs balancing but infrastructure is solid.

---

## 2) VERIFIED FACTS (bullets with file refs)

### Chronicle & Seals (Implemented)

✅ **Seal 1 (Law Before Life)** — `apps/server/src/index.ts:512`  
   - `verifyRulebookOrExit()` called before any stateful init
   - Server exits if rulebook Merkle root doesn't match `rulebook/compiled/RULEBOOK_ROOT.txt`

✅ **Seal 2.1–2.2 (Per-Actor Chain)** — `apps/server/src/index.ts:519-523`  
   - `lastEventHashByActor` map tracks per-actor chain heads
   - Each receipt includes `prev_event_hash`, `event_hash`, `payload_hash`
   - Chain rebuilt from `chronicle.log` on boot via `rebuildChronicleHeadsFromLog()` (line 528)

✅ **Seal 2.3 (Global Chain)** — `apps/server/src/index.ts:685-703`  
   - `prev_global_hash` and `global_event_hash` fields added to every receipt
   - Global chain commits to per-actor `event_hash`, linking both chains
   - Domain-separated hash: `akalynth:chronicle:global:v1\0`
   - Verified in `apps/server/tools/verify-chronicle-chain.ts:100-119`

✅ **Seal 2.4 (Strict Boot)** — `apps/server/src/index.ts:612-614,618`  
   - `CHRONICLE_STRICT=1` env flag makes server exit on chain corruption
   - Comment at line 618: "If chronicle integrity fails and CHRONICLE_STRICT=1, the server MUST NOT start"
   - Detects corruption: bad per-actor hashes or global chain breaks

✅ **Seal 3.1 (RNG Commit→Reveal)** — `apps/server/src/world/rng.ts:29-33`  
   - `rngCommitV1(domain, actor, revealHex)` binds domain+actor+reveal in commitment
   - Death drops use `death_drop:v1` domain (line 2110 in index.ts)
   - Commit event emitted on death: `apps/server/src/index.ts:2116-2118`
   - Reveal event emitted on disconnect: `apps/server/src/index.ts:1806-1809`
   - Domain-bound preimage prevents replay across actors/domains

✅ **Verifier --strict-rng flag** — `apps/server/tools/verify-chronicle-chain.ts:206`  
   - Triple-key tracking: `actor::domain::commit` (line 209)
   - Validates commit→reveal pairing with domain separation
   - Tracks pending draws and verifies output counts match

### Playable Baseline (Functional)

✅ **Login/Connect** — `apps/server/src/index.ts:1876-2010`  
   - WebSocket `connect` → `login` → `login_ack` flow works
   - Guest token generation and session management functional
   - Sovereign identity support (cosmetic-only)

✅ **World Entry** — `apps/server/src/index.ts:2014-2086`  
   - `enter_world` message handler spawns player at map start
   - Returns `world_state` with player position and nearby players
   - Persistence layer loads player data from SQLite

✅ **Movement** — `apps/server/src/index.ts:2421-2557`  
   - 8-direction movement with server validation
   - `tryMove()` checks walkable tiles, direction validity
   - Anti-cheat detector hooks: `onMoveIntent()` and `onMoveApplied()`
   - Heat-based throttling when penalty active (line 2480-2489)

✅ **Chat** — `apps/server/src/index.ts:2181-2234`  
   - `chat_message` handler broadcasts to map
   - Anti-spam: detects chat_spam signal, applies heat+throttle
   - Tem challenge response checking via `handleTemResponse()`

✅ **Combat** — `apps/server/src/index.ts:3089-3189`  
   - `attack_intent` handler calls `handleAttackIntent()`
   - Cooldown tracking (2000ms default)
   - Death handling with reputation adjustment
   - Combat receipts: `combat_resolved`, `death` actions

✅ **Death & Respawn** — `apps/server/src/world/death.ts` + `apps/server/src/index.ts:2108-2148`  
   - `applyDeath()` handles death state, drops items to world
   - Drop policy: weighted by reputation, item count, heat
   - RNG commit→reveal for drops (Seal 3.1)
   - Respawn after `DEATH_RESPAWN_DELAY_MS` (10s default)

✅ **Item Drops & Pickup** — `apps/server/src/index.ts:3052-3088`  
   - Death drops appear in `worldItems` map
   - `pickup_item` handler moves items from world to inventory
   - Decay timestamps enforced (20min for Azura drops)
   - Starter kit mint on first spawn (line 1091-1148)

✅ **Persistence Layer** — `apps/server/src/persist/index.ts:40-78`  
   - `createPersistenceLayer()` initializes SQLite + JSONL receipts
   - `startup()` replays receipts to rebuild state (line 59)
   - Schema includes: players, deaths, reputation, world_objects, inventory
   - Receipt-driven materialization (line 68)

❌ **Map Transitions** — `apps/server/src/index.ts:2672`  
   - Tutorial gating exists (`s.tutorial.gate = true`) but NOT enforced
   - No actual portal/transition handler found
   - Azura entry blocked by tutorial incomplete (not verified in code)

### Anti-Bot Measures (Partial)

✅ **Server Authority** — `apps/server/src/world/movement.ts` + combat.ts  
   - All actions validated server-side
   - Movement legality: walkable tiles, speed, direction
   - Combat cooldown: 2000ms enforced (line 506 in index.ts)
   - No client coordinates trusted

✅ **Action Throttles** — `apps/server/src/anticheat/tem.ts:57-63`  
   - Heat-based throttle: blocks actions when `throttleUntil > now`
   - Applied on Tem challenge failure or high heat
   - Duration: `THROTTLE_DURATION_MS` (5000ms default)

✅ **Anti-Cheat Detector** — `apps/server/src/anticheat/detector.ts`  
   - Pattern detection: perfect cadence, chat spam, runestone spam
   - Signals tracked: move_pattern, chat_spam, runestone_cooldown_spam
   - Heat escalation on suspicious behavior

✅ **Tem Challenges** — `apps/server/src/anticheat/tem.ts:18-34`  
   - Issued when heat exceeds `HEAT_TEM_THRESHOLD` (30 default)
   - Player must type "AZURA" in chat within timeout
   - Failure triggers throttle + heat penalty

✅ **Witness System** — `apps/server/src/world/witness.ts` + index.ts:100-104  
   - Social witness requests when heat penalty applies
   - Quorum resolution: confirmed/denied/contested/insufficient
   - Privacy: redacted actor IDs, no raw player_id exposed
   - Cooldowns prevent spam (60s default)

❌ **Per-IP Rate Limiting** — NOT FOUND  
   - No IP-based connection limits or rate buckets
   - No per-IP action counters
   - Client IP resolved but not used for throttling (line 298-309 in index.ts)

❌ **Replay Detection** — NOT FOUND  
   - No message signature validation
   - No nonce/timestamp replay checks
   - No challenge-response authentication

❌ **Proof-of-Work / Captcha** — NOT FOUND  
   - No initial PoW gate
   - Tem challenges are simple text responses (not computational)

### Economy Infrastructure (Solid)

✅ **Treasury System** — `apps/server/src/world/treasury.ts:1-91`  
   - In-memory Gold balances (receipt-derived projection)
   - Wallet credit/debit receipts: `WALLET_CREDIT_ACTION`, `WALLET_DEBIT_ACTION`
   - Validation: positive integer amounts, max 1B gold
   - Double-spend guard: `withTreasuryLock()` mutex per player (line 75)

✅ **Action Costs** — `apps/server/src/world/treasury.ts:94-144`  
   - `debitForAction()` charges Gold for costed actions
   - Cost table: `ACTION_GOLD_COST` in `packages/shared/types.ts`
   - Actions: runestone_cast, witness_response, sovereign_declare
   - Insufficient gold rejection before action execution

✅ **Drop Policy** — `apps/server/src/world/drop-policy.ts:35-54`  
   - Zone-specific policies (Rookguard: no drops, Azura: 60% base)
   - Reputation bias: bad rep increases drop probability
   - Stack bias: carrying more items increases drops
   - Protected slots: first N items kept (0 for Azura)
   - Decay: 20min for Azura drops, 60min Rookguard

✅ **Legendary Heat** — `apps/server/src/world/drop-policy.ts:77-100`  
   - Per-item heat tracking for drop-weight escalation
   - "Lit fuse" mechanic: heat increases drop probability
   - Multiplier formula: `alpha * (1 + (heat / kappa) * beta)`
   - Heat decays in safe zones, increases in combat

✅ **Audit Trail** — `apps/server/src/audit/logger.ts` + index.ts  
   - Every economic event writes receipt: mint, credit, debit, drop
   - JSONL format with hash-chaining (Seal 2)
   - Public receipts delayed 15min (configurable)
   - Treasury projection rebuilt from receipts on boot

❌ **Inflation Controls** — NOT FOUND  
   - No explicit mint/burn policy beyond starter kits
   - No max supply cap or decay sink
   - Dev mint enabled via `AKALYNTH_DEV_MINT=1` (line 161 in index.ts)

❌ **Trade System** — NOT FOUND  
   - No player-to-player trading
   - No market or exchange receipts

---

## 3) GAPS THAT BLOCK "SHIP"

### 1. Per-IP Rate Limiting
**Blocker**: No IP-based connection or action limits; single IP can spawn unlimited sessions.  
**Why it matters**: Allows trivial DDoS via guest session flood; no cost to automate mass account creation.  
**Fix**: Add IP-keyed rate limiter in `apps/server/src/index.ts` upgrade handler (line ~1650):
   - Track connections per IP in `Map<string, { count: number; firstSeen: number }>`
   - Reject new connections if IP exceeds threshold (e.g., 5 sessions per 10min)
   - Add action rate buckets: moves/sec, chat/sec per IP  
**Effort**: S (2-4 hours)

### 2. Map Transition Enforcement
**Blocker**: Tutorial gate flag exists but no portal handler; players can't actually leave Rookguard to enter Azura.  
**Why it matters**: Game loop is stuck in one zone; can't test PvP or economy in Azura.  
**Fix**: Add `portal_intent` handler in `apps/server/src/index.ts`:
   - Check portal tile code at player position
   - Validate tutorial completion before Azura entry
   - Transfer player map, broadcast state change
   - Add portal tiles to `packages/shared/types.ts` TileCode enum  
**Effort**: M (1 day)

### 3. Inventory UI (Client)
**Blocker**: Pickup works server-side but client has no inventory display; players can't see what they carry.  
**Why it matters**: Blind gameplay; can't verify drops, can't manage items, can't demo loot.  
**Fix**: Add inventory panel to `apps/debug-client/src/components/`:
   - Fetch inventory from `/v1/session/me` (already returns items)
   - Render item list with type + metadata
   - Add equip/drop buttons (future)  
**Effort**: M (1 day)

### 4. Item Decay Tick Loop
**Blocker**: Item decay timestamps written but no tick loop removes expired items from world.  
**Why it matters**: World items accumulate forever; map clutter, memory leak.  
**Fix**: Add decay sweep in `apps/server/src/index.ts` tick loop (line ~3766):
   - Iterate `worldItems` per map
   - Remove items where `decayAt < now`
   - Emit `world_object_removed` receipt  
**Effort**: S (2 hours)

### 5. Inflation Sink (Economy)
**Blocker**: Gold enters via dev mint + future sources; no persistent sink beyond action costs.  
**Why it matters**: Unchecked inflation degrades economy; action costs become trivial.  
**Fix**: Add time-based Gold decay or mandatory upkeep:
   - Option A: Daily upkeep cost (e.g., 100 gold/day for presence)
   - Option B: Death penalty (lose % of Gold on death)
   - Add `wallet_decay` receipt type
   - Implement in tick loop or death handler  
**Effort**: M (1 day)

### 6. Attack Spam Detection
**Blocker**: Combat cooldown enforced but no heat escalation on repeated attack failures.  
**Why it matters**: Bots can spam attack_intent with no penalty beyond cooldown.  
**Fix**: Add attack_spam signal to `apps/server/src/anticheat/detector.ts`:
   - Track failed attacks per session (cooldown, target dead, range)
   - Escalate heat on threshold (e.g., 5 failures in 30s)
   - Existing Tem+throttle flow handles enforcement  
**Effort**: S (3 hours)

### 7. Receipt Replay Prevention
**Blocker**: WebSocket messages not signed; server accepts any valid-shaped message from authenticated session.  
**Why it matters**: Automation tools can replay captured messages; no proof-of-live-user.  
**Fix**: Add challenge-response or message signing:
   - Server sends ephemeral challenge on `enter_world`
   - Client signs each message with session key + challenge
   - Server validates signature before processing
   - Requires client SDK update  
**Effort**: L (2-3 days, breaks protocol)

### 8. Public Receipts Delay Config Validation
**Blocker**: `PUBLIC_RECEIPTS_DELAY_MS=0` bypasses delay but no warning in production mode.  
**Why it matters**: Accidental config leak exposes real-time actions to public feed.  
**Fix**: Add validation in `apps/server/src/index.ts` startup:
   - Warn if `PUBLIC_RECEIPTS_DELAY_MS < 300000` (5min) and `DEBUG=0`
   - Refuse to start if delay=0 in production  
**Effort**: S (1 hour)

---

## 4) NEXT FORGE (choose 1 plan)

### Plan A: "Ship Alpha" — Playability First

**Goal**: Make the game loop demonstrably playable end-to-end (Rookguard → Azura → Combat → Loot → Inventory).

**Checklist**:
1. Add `TileCode.PORTAL_AZURA` to `packages/shared/types.ts` (line ~120)
2. Add portal tile to Rookguard map at exit coordinates (e.g., x=15, y=31)
3. Implement `portal_intent` handler in `apps/server/src/index.ts`:
   - Validate player at portal tile
   - Check `s.tutorial.complete === true`
   - Transfer map to Azura, reset position to spawn
   - Emit `map_transfer` receipt
4. Add inventory panel to `apps/debug-client/src/components/InventoryPanel.tsx`
5. Wire inventory to GameView overlay
6. Add item decay tick loop in server tick (remove expired items)
7. Update `/v1/session/me` to return `current_map` field
8. Add visual feedback for portal tiles (glow effect)
9. Write verification scenario: `scripts/verify/scenarios/map_transfer.json`
10. Run end-to-end test: spawn Rookguard → complete tutorial → portal to Azura → attack → pickup drop → see inventory

**Success condition**:
```bash
cd apps/server && ALLOW_INSECURE_LOCAL=1 npm run dev &
cd apps/debug-client && npm run dev &
# Manual test: login → move to portal → transfer to Azura → kill player → pickup item → inventory shows item
# OR: npm run verify (if harness supports map_transfer scenario)
```

---

### Plan B: "Harden Anti-Bot" — Security First

**Goal**: Close trivial automation vectors before public alpha.

**Checklist**:
1. Add IP rate limiter to WebSocket upgrade handler (`apps/server/src/index.ts:1650`):
   - Track `Map<string, { count: number; windowStart: number }>`
   - Reject if IP exceeds 5 connections per 10min
2. Add per-IP action buckets: `Map<string, { moves: number[], chats: number[] }>`
3. Implement sliding window rate checks (5 moves/sec, 1 chat/sec)
4. Add `attack_spam` signal to `apps/server/src/anticheat/detector.ts`
5. Escalate heat on repeated attack failures (5 in 30s)
6. Add `PUBLIC_RECEIPTS_DELAY_MS` validation at startup:
   - Warn if delay < 5min in non-DEBUG mode
   - Refuse to start if delay=0 and DEBUG=0
7. Add `rate_limit_exceeded` receipt type to audit trail
8. Update witness system to nudge heat on quorum=contested
9. Write test: `apps/server/tools/verify-rate-limits.ts`
10. Run verification: spawn 10 sessions from same IP, verify 6th rejected
11. Test attack spam: send 10 attack_intent with same target_id in 5s, verify heat escalation
12. Verify public receipts delay: set delay=1s, check `/v1/receipts/public` lag

**Success condition**:
```bash
# Test rate limiter
for i in {1..10}; do wscat -c ws://localhost:3000 & done
# Expect 5 connections accepted, 5 rejected

# Test attack spam
npx tsx apps/server/tools/verify-rate-limits.ts --scenario attack_spam
# Expect heat escalation receipt

# Test receipts delay
PUBLIC_RECEIPTS_DELAY_MS=1000 npm run dev &
curl http://localhost:3000/v1/receipts/public | jq '.[0].action_at_ms'
# Verify timestamp is ~1s behind server time
```

---

### Plan C: "Stabilize Economy" — Foundation First

**Goal**: Ensure Gold supply/demand balance before launch.

**Checklist**:
1. Audit all Gold sources: starter kit (100g), dev mint, future drops
2. Audit all Gold sinks: action costs (runestone 10g, witness 5g, sovereign 1000g)
3. Implement daily upkeep decay:
   - Add `wallet_decay` receipt type to `packages/shared/types.ts`
   - Add tick handler: charge 10g per player per day (prorated)
   - Emit receipt, update treasury projection
4. Add death penalty: lose 10% of Gold on death (capped at 100g)
5. Add Gold drop on death: 5% of carried Gold drops to world (pickup-able)
6. Update drop policy: include Gold in `computeDeathDrops()`
7. Implement Gold pickup: `world_object` type `gold` with amount metadata
8. Add inflation metrics: total Gold minted, burned, in circulation
9. Write tool: `apps/server/tools/verify-treasury.ts` (checks projection vs receipts)
10. Run replay test: rebuild treasury from `receipts.jsonl`, verify balance integrity
11. Add treasury snapshot to `/v1/metrics` endpoint
12. Document Gold economy in `docs/ECONOMY.md`

**Success condition**:
```bash
# Replay treasury from receipts
npx tsx apps/server/tools/verify-treasury.ts receipts.jsonl
# Expect: all balances match, no negative, no overflow

# Check inflation metrics
curl http://localhost:3000/v1/metrics | jq '.treasury'
# Expect: { minted, burned, circulating, player_count }

# Test decay
# Run server for 24h, verify upkeep deducted
# OR: mock tick forward, verify 10g/day charged
```

---

## RECOMMENDATION

**Choose Plan A ("Ship Alpha")** if:
- You need a demo-able product for investors/users
- Playability feedback is more valuable than security hardening
- You're confident in server authority preventing major exploits

**Choose Plan B ("Harden Anti-Bot")** if:
- You plan to open-source or public alpha soon
- Automation/bot reputation risk is high
- You want to validate anti-cheat before scaling

**Choose Plan C ("Stabilize Economy")** if:
- You have time before launch (2+ weeks)
- Economic balance is critical to game design
- You want to avoid post-launch currency wipes

**My vote**: **Plan B** — Security debt compounds faster than playability debt. IP rate limiting and attack spam detection are low-hanging fruit that prevent trivial abuse. Playability polish can follow in 2-3 days after anti-bot measures are solid.

---

**End of Report**
