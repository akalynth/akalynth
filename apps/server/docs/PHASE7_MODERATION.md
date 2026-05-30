# Phase 7 — Civil Moderation System

> The Ledger remembers. The Ledger enforces. The Ledger does not forgive.

**Status (v1):** Deferred. This document describes a future system and is not implemented or enforced in v1.

> **Verification notes (2026-05-30):**
> - None of the modules referenced below exist yet: `world/moderation.ts`,
>   `world/violation_detector.ts`, `world/auto_moderation.ts`, the
>   `MODERATION_ACTIONS` constant, or the `player_bans` / `violations` tables.
>   They remain proposed.
> - A `moderation_reports` table *does* already exist in `persist/schema.ts`
>   (with `status` and `target_id` indexes). It is not the same as the
>   `player_bans` / `violations` schema proposed here; reconcile the two before
>   implementation.
> - The proposed `WARNING_ISSUED: 'warning_issued'` action overlaps with the
>   anti-cheat receipt action that already ships as `warn_issued`
>   (`persist/types.ts` `RECEIPT_ACTIONS.WARN_ISSUED`). Decide whether to reuse
>   the existing name or intentionally introduce a separate one. **FLAG.**

---

## Critical Design Decisions (G1–G15 Preservation)

**This spec has been hardened to preserve all Civil Guarantees:**

1. **Evidence Receipt Hashes**: Must reference canonical `receipt_hash` values from materialized receipts (SQLite), never recomputed from in-memory objects. See "Violation Detection" section.

2. **Materializer Idempotence**: All materializers use `INSERT OR IGNORE` (or `ON CONFLICT DO NOTHING`) to ensure G4 (Idempotent Replay) is preserved.

3. **Ban Correction Structure**: `ban_corrected` uses typed field `correction_kind: 'data_correction'` (not string matching) to prevent accidental lifts. Corrections are ledger fixes, not appeals.

4. **Receipt Taxonomy**: Clear separation between:
   - **Gameplay receipts** (`login_attempt`, `chat`, etc.) — audit trail
   - **Moderation receipts** (`player_banned`, `violation_detected`) — enforcement
   - **System receipts** (`player_created`, `death`) — state changes

5. **SQLite NULL Handling**: Uses partial unique indexes (like chronicle v7) for nullable UNIQUE columns (`correction_receipt`).

---

## Charter

Phase 7 establishes a receipt-driven moderation system that preserves Civil Guarantees G1–G15 while protecting the world from hostile actors.

**Core principle**: Every moderation action is a receipt. Every receipt is auditable. Every ban is permanent.

---

## Philosophy

| Term | Meaning |
|------|---------|
| **Civil Moderation** | Server-enforced restrictions based on receipt history |
| **Receipt-Driven** | All moderation actions emit receipts; bans are receipt-derived |
| **Ledger Authority** | The Ledger remembers violations; the Ledger enforces consequences |
| **Permanent Record** | Bans, warnings, and violations are immutable once recorded |

---

## Scope

### Included

| Component | Description |
|-----------|-------------|
| Ban System | Permanent bans stored in SQLite, derived from receipts |
| Violation Tracking | Receipt-based violation history per player |
| Spawn Protection | Server-enforced spawn safety zones |
| Chat Filtering | Content filtering with receipt logging |
| Admin Commands | Capability-gated moderation actions |
| Auto-Moderation | Receipt pattern analysis for automatic enforcement |

### Excluded

| Explicitly NOT in Phase 7 |
|---------------------------|
| Real-time chat moderation (human moderators) |
| Appeal system (receipts are canonical) |
| Temporary mutes (bans are permanent) |
| Player reporting UI (receipts are the report) |

**Phase 7 does not add forgiveness. It adds enforcement.**

---

## Receipt Actions

### New Receipt Actions

```typescript
// Moderation actions (all emit receipts)
export const MODERATION_ACTIONS = {
  // Violations (detected by system)
  VIOLATION_DETECTED: 'violation_detected',
  VIOLATION_ESCALATED: 'violation_escalated',
  
  // Bans (permanent, receipt-driven)
  PLAYER_BANNED: 'player_banned',
  BAN_CORRECTED: 'ban_corrected', // Only for data correction, not appeals
  
  // Warnings (informational, still permanent)
  WARNING_ISSUED: 'warning_issued',
  
  // Admin actions (capability-gated)
  ADMIN_BAN: 'admin_ban',
  ADMIN_WARNING: 'admin_warning',
  ADMIN_KICK: 'admin_kick',
  
  // Spawn protection (automatic)
  SPAWN_PROTECTION_ACTIVATED: 'spawn_protection_activated',
  SPAWN_PROTECTION_VIOLATION: 'spawn_protection_violation',
  
  // Chat filtering (automatic)
  CHAT_FILTERED: 'chat_filtered',
  CHAT_BLOCKED: 'chat_blocked',
} as const;
```

### Receipt Schema

```typescript
// violation_detected
{
  sequence: number;
  timestamp: string;
  prev_hash: string;
  event_hash: string;
  signature: string;
  actor_id: string;
  action: 'violation_detected';
  inputs: {
    violation_type: 'chat_spam' | 'griefing' | 'exploit' | 'toxic_language';
    severity: number; // 1-10
    evidence_receipt_hashes: string[]; // Receipts that prove violation
    context: Record<string, unknown>;
  };
  result: 'detected';
  inputs_hash: string;
  outputs_hash: string;
}

// player_banned
{
  sequence: number;
  timestamp: string;
  prev_hash: string;
  event_hash: string;
  signature: string;
  actor_id: string;
  action: 'player_banned';
  inputs: {
    ban_reason: string;
    violation_receipt_hashes: string[]; // Receipts that caused ban
    banned_by: string; // 'system' | player_id (for admin bans)
    permanent: boolean; // Always true in Phase 7
  };
  result: 'banned';
  inputs_hash: string;
  outputs_hash: string;
}

// ban_corrected (data correction only, not appeals)
{
  sequence: number;
  timestamp: string;
  prev_hash: string;
  event_hash: string;
  signature: string;
  actor_id: string;
  action: 'ban_corrected';
  inputs: {
    correction_kind: 'data_correction'; // Typed field, not string matching
    correction_reason: string; // Human-readable explanation
    original_ban_receipt: string; // Receipt hash of the ban being corrected
  };
  result: 'corrected';
  inputs_hash: string;
  outputs_hash: string;
}

// admin_ban
{
  sequence: number;
  timestamp: string;
  prev_hash: string;
  event_hash: string;
  signature: string;
  actor_id: string; // Admin actor_id
  action: 'admin_ban';
  inputs: {
    target_player_id: string;
    reason: string;
    capability_used: 'admin:ban';
  };
  result: 'ok';
  inputs_hash: string;
  outputs_hash: string;
}
```

---

## SQLite Schema

### New Tables

```sql
-- Player bans (projection from receipts)
CREATE TABLE IF NOT EXISTS player_bans (
  player_id       TEXT PRIMARY KEY,
  banned_at       TEXT NOT NULL,
  ban_receipt     TEXT NOT NULL UNIQUE,
  reason          TEXT NOT NULL,
  banned_by       TEXT NOT NULL, -- 'system' | player_id
  violation_hashes TEXT NOT NULL, -- JSON array of receipt hashes
  corrected_at    TEXT DEFAULT NULL,
  correction_receipt TEXT DEFAULT NULL,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

-- Partial unique index for correction_receipt (NULL-safe, like chronicle)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bans_correction_receipt 
  ON player_bans(correction_receipt) 
  WHERE correction_receipt IS NOT NULL;

-- Violation history (projection from receipts)
CREATE TABLE IF NOT EXISTS violations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id       TEXT NOT NULL,
  violation_type  TEXT NOT NULL,
  severity        INTEGER NOT NULL,
  timestamp       TEXT NOT NULL,
  receipt_hash    TEXT NOT NULL UNIQUE,
  evidence_hashes TEXT NOT NULL, -- JSON array
  context_json    TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);
CREATE INDEX IF NOT EXISTS idx_violations_player_ts ON violations(player_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_violations_type ON violations(violation_type);

-- Spawn protection state (in-memory only, no SQLite)
-- Tracked per-player: { protected_until_ms: number, spawn_map: MapName, spawn_pos: Position }
```

---

## Materializers

### Handler Functions

```typescript
// apps/server/src/persist/materializers.ts

function handleViolationDetected(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const playerId = receipt.player_id;
  const violationType = inputs.violation_type as string;
  const severity = inputs.severity as number;
  const evidenceHashes = inputs.evidence_receipt_hashes as string[] ?? [];
  const context = inputs.context ?? {};

  if (!violationType || !severity) return;

  // INSERT OR IGNORE (idempotent via UNIQUE receipt_hash)
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO violations (
      player_id, violation_type, severity, timestamp,
      receipt_hash, evidence_hashes, context_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    playerId,
    violationType,
    severity,
    receipt.timestamp,
    receiptHash,
    JSON.stringify(evidenceHashes),
    JSON.stringify(context)
  );
}

function handlePlayerBanned(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const playerId = receipt.player_id;
  const reason = inputs.ban_reason as string;
  const violationHashes = inputs.violation_receipt_hashes as string[] ?? [];
  const bannedBy = inputs.banned_by as string ?? 'system';

  if (!reason) return;

  // INSERT OR IGNORE (idempotent via UNIQUE ban_receipt)
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO player_bans (
      player_id, banned_at, ban_receipt, reason,
      banned_by, violation_hashes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    playerId,
    receipt.timestamp,
    receiptHash,
    reason,
    bannedBy,
    JSON.stringify(violationHashes)
  );
}

function handleBanCorrected(
  db: Database.Database,
  receipt: AuditReceipt,
  receiptHash: string
): void {
  const inputs = receipt.inputs ?? {};
  const playerId = receipt.player_id;
  const correctionKind = inputs.correction_kind as string;

  // Only allow corrections for data errors, not appeals
  // correction_kind must be exactly 'data_correction'
  if (correctionKind !== 'data_correction') return;

  // INSERT OR IGNORE (idempotent via UNIQUE lift_receipt)
  // Use INSERT OR IGNORE + UPDATE pattern to handle concurrent corrections
  const updateStmt = db.prepare(`
    UPDATE player_bans
    SET corrected_at = ?, correction_receipt = ?
    WHERE player_id = ? AND corrected_at IS NULL
  `);
  const result = updateStmt.run(receipt.timestamp, receiptHash, playerId);
  
  // If no row updated, the ban was already corrected or doesn't exist
  // This is idempotent: replaying the same correction receipt does nothing
  if (result.changes === 0) {
    // Log but don't fail (idempotent replay)
    console.warn(`[moderation] Ban correction receipt ${receiptHash} had no effect (already corrected or ban missing)`);
  }
}
```

---

## In-Memory Projections

### Ban Check (Fast Path)

```typescript
// apps/server/src/world/moderation.ts

const bannedPlayers = new Map<string, { banned_at: string; reason: string }>();

export function isPlayerBanned(playerId: string): boolean {
  return bannedPlayers.has(playerId);
}

export function getBanInfo(playerId: string): { banned_at: string; reason: string } | null {
  return bannedPlayers.get(playerId) ?? null;
}

// Reducer: rebuild from receipts on startup
export function applyReceiptToModeration(receipt: AuditReceipt): void {
  const playerId = receipt.player_id;
  
  switch (receipt.action) {
    case 'player_banned': {
      const inputs = receipt.inputs ?? {};
      bannedPlayers.set(playerId, {
        banned_at: receipt.timestamp,
        reason: inputs.ban_reason as string ?? 'Banned',
      });
      break;
    }
    
    case 'ban_corrected': {
      // Only delete if correction_kind is data_correction
      const inputs = receipt.inputs ?? {};
      if (inputs.correction_kind === 'data_correction') {
        bannedPlayers.delete(playerId);
      }
      break;
    }
    
    default:
      break;
  }
}
```

### Spawn Protection State

```typescript
interface SpawnProtectionState {
  protected_until_ms: number;
  spawn_map: MapName;
  spawn_pos: Position;
}

const spawnProtectionByPlayer = new Map<string, SpawnProtectionState>();

export function isSpawnProtected(
  playerId: string,
  map: MapName,
  pos: Position,
  now: number
): boolean {
  const state = spawnProtectionByPlayer.get(playerId);
  if (!state) return false;
  
  if (now >= state.protected_until_ms) {
    spawnProtectionByPlayer.delete(playerId);
    return false;
  }
  
  // Check if still at spawn
  const dist = Math.abs(pos.x - state.spawn_pos.x) + Math.abs(pos.y - state.spawn_pos.y);
  return dist <= SPAWN_PROTECTION_RADIUS;
}

export function activateSpawnProtection(
  playerId: string,
  map: MapName,
  spawn: Position,
  durationMs: number
): void {
  spawnProtectionByPlayer.set(playerId, {
    protected_until_ms: Date.now() + durationMs,
    spawn_map: map,
    spawn_pos: spawn,
  });
}
```

---

## Violation Detection

### Pattern Analysis

**CRITICAL**: Evidence receipt hashes must reference canonical receipt hashes that already exist in the receipts.jsonl file and SQLite projection. Never recompute hashes from in-memory receipt objects, as field ordering or omissions could cause drift.

```typescript
// apps/server/src/world/violation_detector.ts

export interface ViolationPattern {
  type: 'chat_spam' | 'griefing' | 'exploit' | 'toxic_language';
  severity: number;
  evidence_receipt_hashes: string[]; // Canonical hashes from materialized receipts
  context: Record<string, unknown>;
}

/**
 * Analyze receipt patterns for violations.
 * 
 * @param playerId - Player to analyze
 * @param persist - Persistence layer (for querying receipt hashes)
 * @param now - Current timestamp
 * @param windowMs - Analysis window (default 60 seconds)
 * 
 * CRITICAL: evidence_receipt_hashes must reference canonical receipt_hash values
 * from SQLite (materialized receipts), not recomputed from in-memory objects.
 */
export function analyzeReceiptPattern(
  playerId: string,
  persist: PersistenceLayer,
  now: number,
  windowMs: number = 60_000
): ViolationPattern | null {
  // Query recent chronicle events (which have receipt_hash)
  const recentEvents = persist.getChronicleForPlayer(playerId, 100);
  const windowStart = new Date(now - windowMs).toISOString();
  const recent = recentEvents.filter(e => e.timestamp >= windowStart);

  // Chat spam detection: count chat receipts
  const chatEvents = recent.filter(e => e.source_action === 'chat');
  if (chatEvents.length >= 10) {
    // Use canonical receipt_hash from materialized chronicle events
    return {
      type: 'chat_spam',
      severity: Math.min(10, chatEvents.length / 2),
      evidence_receipt_hashes: chatEvents.map(e => e.receipt_hash),
      context: { message_count: chatEvents.length },
    };
  }

  // Griefing detection: repeated kills of same player
  const killEvents = recent.filter(e => 
    e.kind === 'kill' && 
    e.details_json && 
    JSON.parse(e.details_json).outcome === 'kill'
  );
  
  const victimCounts = new Map<string, Array<{ receipt_hash: string }>>();
  for (const e of killEvents) {
    const details = JSON.parse(e.details_json);
    const victim = details.target_player_id as string;
    if (victim) {
      const existing = victimCounts.get(victim) ?? [];
      existing.push({ receipt_hash: e.receipt_hash });
      victimCounts.set(victim, existing);
    }
  }
  
  for (const [victim, receipts] of victimCounts) {
    if (receipts.length >= 3) {
      return {
        type: 'griefing',
        severity: Math.min(10, receipts.length * 2),
        evidence_receipt_hashes: receipts.map(r => r.receipt_hash),
        context: { victim_id: victim, kill_count: receipts.length },
      };
    }
  }

  return null;
}
```

**Alternative approach (if analyzing receipts directly from JSONL):**

If analyzing receipts from JSONL file directly, use the receipt_hash that was computed during materialization:

```typescript
// When reading receipts from JSONL for analysis:
// 1. Parse receipt from JSONL line
// 2. Compute receipt_hash using computeReceiptHash() (same function as materializer)
// 3. Store receipt_hash with receipt object
// 4. Use stored receipt_hash in evidence_receipt_hashes

interface ReceiptWithHash extends AuditReceipt {
  _canonical_hash?: string; // Set during analysis, not stored in JSONL
}

function analyzeReceiptsWithHashes(
  receipts: ReceiptWithHash[],
  now: number
): ViolationPattern | null {
  // Compute hashes using canonical function (same as materializer)
  for (const r of receipts) {
    if (!r._canonical_hash) {
      r._canonical_hash = computeReceiptHash(r);
    }
  }
  
  // Now use _canonical_hash in evidence_receipt_hashes
  // ...
}
```

---

## Auto-Moderation

### Ban Thresholds

```typescript
// apps/server/src/world/auto_moderation.ts

const BAN_THRESHOLDS = {
  chat_spam: { violations: 5, severity_sum: 30 },
  griefing: { violations: 3, severity_sum: 20 },
  exploit: { violations: 1, severity_sum: 10 },
  toxic_language: { violations: 3, severity_sum: 15 },
} as const;

export function shouldAutoBan(
  playerId: string,
  violationHistory: Array<{ type: string; severity: number }>
): { should_ban: boolean; reason: string } {
  const byType = new Map<string, number[]>();
  
  for (const v of violationHistory) {
    const existing = byType.get(v.type) ?? [];
    existing.push(v.severity);
    byType.set(v.type, existing);
  }

  for (const [type, severities] of byType) {
    const threshold = BAN_THRESHOLDS[type as keyof typeof BAN_THRESHOLDS];
    if (!threshold) continue;

    if (severities.length >= threshold.violations) {
      const sum = severities.reduce((a, b) => a + b, 0);
      if (sum >= threshold.severity_sum) {
        return {
          should_ban: true,
          reason: `Auto-banned: ${type} (${severities.length} violations, severity ${sum})`,
        };
      }
    }
  }

  return { should_ban: false, reason: '' };
}
```

---

## Integration Points

### Login Check

**Note**: `login_attempt` is an **audit receipt** (gameplay/audit action), not a **moderation receipt**. It records the attempt but does not perform moderation. The ban check happens before the receipt is written.

```typescript
// apps/server/src/index.ts - login handler

case 'login': {
  // ... existing login code ...
  
  // Check ban status (before creating player or writing receipts)
  if (isPlayerBanned(s.player.id)) {
    const banInfo = getBanInfo(s.player.id);
    send(s.ws, ServerMessages.error('banned', `Banned: ${banInfo.reason}`));
    
    // Audit receipt (gameplay action, not moderation action)
    audit.write({
      player_id: s.player.id,
      action: 'login_attempt',
      inputs: {},
      result: 'rejected_banned',
    });
    break;
  }
  
  // ... continue login ...
}
```

**Receipt Taxonomy Clarification:**

| Category | Examples | Purpose |
|----------|----------|---------|
| **Gameplay Receipts** | `login_attempt`, `move_intent`, `chat`, `attack_intent` | Record player actions |
| **Moderation Receipts** | `violation_detected`, `player_banned`, `ban_corrected` | Enforce civil rules |
| **System Receipts** | `player_created`, `death`, `item_minted` | World state changes |

All receipts are auditable, but moderation receipts have special enforcement semantics.

### Combat Check

```typescript
// apps/server/src/world/combat.ts

export function canAttack(
  attacker: Player,
  defender: Player,
  // ... existing params ...
): CanAttackResult {
  // ... existing checks ...
  
  // Spawn protection
  if (isSpawnProtected(defender.id, defenderMap, { x: defender.x, y: defender.y }, now)) {
    return { ok: false, reason: 'spawn_protected' };
  }
  
  // ... continue ...
}
```

### Chat Filtering

```typescript
// apps/server/src/index.ts - chat handler

case 'chat': {
  // ... existing chat code ...
  
  // Content filter
  const filterResult = filterChatContent(msg.message);
  if (!filterResult.ok) {
    audit.write({
      player_id: s.player.id,
      action: 'chat_filtered',
      inputs: { 
        original_message: msg.message,
        filtered_message: filterResult.filtered,
        filter_reason: filterResult.reason,
      },
      result: 'blocked',
    });
    send(s.ws, ServerMessages.error('chat_blocked', 'Message filtered'));
    break;
  }
  
  // ... continue with filtered message ...
}
```

---

## Guarantees Preserved

Phase 7 preserves all existing guarantees:

- **G1** (Canonical Ledger): All moderation actions emit receipts
- **G2** (Deterministic Hashing): Ban receipts use same hash algorithm
- **G3** (Durable Ordering): Receipts fsynced before materialization
- **G4** (Idempotent Replay): Ban state rebuildable from receipts
- **G5** (Rebuildable State): SQLite projection from receipts only
- **G14** (Auditable Civil Record): Violations appear in chronicle
- **G15** (External Auditability): All bans traceable to receipts

**New guarantee (G16):**

**G16 — Permanent Moderation**
Once a player is banned, the ban is permanent unless corrected via `ban_corrected` receipt with `correction_kind: 'data_correction'`. Bans are receipt-driven, auditable, and idempotently replayable. Correction receipts are ledger corrections (data fixes), not appeals (forgiveness).

---

## Success Condition

> A hostile player joins, violates rules, and is permanently banned. The ban is recorded in receipts, materialized in SQLite, and survives server restart. The player's violation history is auditable via receipts.

When that sentence is true, Phase 7 is complete.

---

## Implementation Checklist

- [ ] Add `MODERATION_ACTIONS` to `packages/shared/types.ts`
- [ ] Add ban/violation tables to `persist/schema.ts` (migration v8)
- [ ] Add materializers for moderation receipts
- [ ] Add in-memory ban projection with reducer
- [ ] Add spawn protection system
- [ ] Add chat content filter
- [ ] Add violation detector
- [ ] Add auto-moderation logic
- [ ] Add admin capability system (`admin:ban`, `admin:kick`)
- [ ] Integrate ban check in login handler
- [ ] Integrate spawn protection in combat handler
- [ ] Integrate chat filter in chat handler
- [ ] Add G16 to `CIVIL_GUARANTEES.md`
- [ ] Add verifier for G16
- [ ] Update `verify-guarantees.ts` to check G16

---

## Timeline

Phase 7 has no timeline. It has milestones:

1. **7.1 Complete:** Ban system materializes from receipts
2. **7.2 Complete:** Spawn protection prevents griefing
3. **7.3 Complete:** Chat filter blocks toxic content
4. **7.4 Complete:** Auto-moderation bans repeat offenders
5. **Phase 7 Complete:** Hostile players are permanently banned and cannot return
