// Akalynth Combat v0.3 — Weighted Death Generator with Legendary Fuse
// Phase 3: Server-authoritative combat with weighted drop policy

import type { MapName } from '../../../../packages/shared/http.js';
import type { Player, Position } from '../../../../packages/shared/types.js';
import type { AuditLogger } from '../audit/logger.js';
import type { PersistenceLayer } from '../persist/index.js';
import { applyDeath, type ApplyDeathOptions } from './death.js';
import {
  computeDeathDrops,
  getDeathDropDecayMs,
  getLegendaryHeat,
  setLegendaryHeat,
  type ItemForDrop,
} from './drop-policy.js';

// ============================================================================
// Constants
// ============================================================================

export const COMBAT_COOLDOWN_MS = 2000;

export const ZONE_PVP_ENABLED: Record<MapName, boolean> = {
  Rookguard: false, // Training zone, always safe
  Azura: true, // PvP enabled (v0: entire map)
};

export const DEATH_DROP_DECAY_MINUTES: Record<MapName, number> = {
  Rookguard: 60, // Irrelevant (no PvP)
  Azura: 20, // 20 minutes for all death drops
};

// ============================================================================
// Types
// ============================================================================

export interface CanAttackResult {
  ok: boolean;
  reason?: string;
}

export interface AttackResult {
  success: boolean;
  reason?: string;
  droppedItemIds?: string[];
  defenderPos?: Position;
  map?: MapName;
}

export interface WorldItem {
  x: number;
  y: number;
  decayAt: string | null;
  itemType: string;
}

export interface CombatContext {
  attackerId: string;
  targetId: string;
  now: number;
  audit: AuditLogger;
  persist: PersistenceLayer;
  inventory: Map<string, Set<string>>;
  worldItems: Map<string, Map<string, WorldItem>>;
  lastAttackAt: Map<string, number>;
  sessions: Map<string, { player?: Player | null; currentMap: MapName; inWorld: boolean }>;
  applyDeathFn: (opts: ApplyDeathOptions) => { changed: boolean; dead_until_ms: number; respawn_in_ms: number };
  respawnDelayMs: number;
  adjustReputation: (playerId: string, delta: number) => void;
  setDead: (playerId: string, deadUntilMs: number) => void;
  getReputation: (playerId: string) => number;
  computeReceiptHash: (receipt: object) => string;
  emitFirstOf?: (playerId: string, info: unknown) => void;
  getProtectedItemId: (playerId: string) => string | undefined; // Phase 3.2
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if two positions are adjacent (Manhattan distance = 1)
 */
export function isAdjacent(a: Position, b: Position): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy === 1;
}

/**
 * Check if a player is alive
 */
export function isAlive(player: Player, now: number): boolean {
  if (player.status === 'dead') return false;
  if (player.dead_until_ms && player.dead_until_ms > now) return false;
  return true;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if an attack is valid
 */
export function canAttack(
  attacker: Player,
  defender: Player,
  attackerMap: MapName,
  defenderMap: MapName,
  now: number,
  lastAttackAt: Map<string, number>
): CanAttackResult {
  // 1. Attacker must be alive
  if (!isAlive(attacker, now)) {
    return { ok: false, reason: 'attacker_dead' };
  }

  // 2. Defender must be alive
  if (!isAlive(defender, now)) {
    return { ok: false, reason: 'defender_dead' };
  }

  // 3. Both must be on the same map
  if (attackerMap !== defenderMap) {
    return { ok: false, reason: 'different_maps' };
  }

  // 4. PvP must be enabled for the map
  if (!ZONE_PVP_ENABLED[attackerMap]) {
    return { ok: false, reason: 'pvp_disabled' };
  }

  // 5. Must be adjacent
  if (!isAdjacent({ x: attacker.x, y: attacker.y }, { x: defender.x, y: defender.y })) {
    return { ok: false, reason: 'not_adjacent' };
  }

  // 6. Check cooldown
  const lastAttack = lastAttackAt.get(attacker.id) ?? 0;
  if (now - lastAttack < COMBAT_COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown' };
  }

  return { ok: true };
}

// ============================================================================
// Attack Handler
// ============================================================================

/**
 * Handle an attack intent from a player.
 * This is the main combat entry point.
 */
export function handleAttackIntent(ctx: CombatContext): AttackResult {
  const { attackerId, targetId, now, audit, persist, inventory, worldItems, lastAttackAt, sessions } = ctx;

  // Find attacker and defender sessions
  let attackerSession: { player?: Player | null; currentMap: MapName; inWorld: boolean } | undefined;
  let defenderSession: { player?: Player | null; currentMap: MapName; inWorld: boolean } | undefined;

  for (const [, s] of sessions) {
    if (s.player?.id === attackerId) attackerSession = s;
    if (s.player?.id === targetId) defenderSession = s;
  }

  if (!attackerSession?.player || !attackerSession.inWorld) {
    return { success: false, reason: 'attacker_not_found' };
  }

  if (!defenderSession?.player || !defenderSession.inWorld) {
    return { success: false, reason: 'defender_not_found' };
  }

  const attacker = attackerSession.player;
  const defender = defenderSession.player;
  const attackerMap = attackerSession.currentMap;
  const defenderMap = defenderSession.currentMap;

  // Validate attack
  const validation = canAttack(attacker, defender, attackerMap, defenderMap, now, lastAttackAt);
  if (!validation.ok) {
    return { success: false, reason: validation.reason };
  }

  // 1. Snapshot defender inventory with item types for drop policy
  const inventoryItemIds = Array.from(inventory.get(targetId) ?? []);
  const defenderProtectedId = ctx.getProtectedItemId(targetId);
  const inventoryItems: ItemForDrop[] = inventoryItemIds.map((itemId) => {
    const item = persist.getItem(itemId);
    return {
      item_id: itemId,
      item_type: item?.item_type ?? 'unknown',
      meta: item?.meta_json ? JSON.parse(item.meta_json) : undefined,
      slot: itemId === defenderProtectedId ? 'protected' : null,
    };
  });

  // 2. Build combat_resolved receipt object (for deterministic seed)
  // We need the hash before computing drops, but dropped_item_ids is unknown yet.
  // Solution: compute seed from the receipt WITHOUT dropped_item_ids, then fill it in.
  const combatResolvedBase = {
    player_id: attackerId,
    action: 'combat_resolved',
    inputs: {
      target_player_id: targetId,
      map: defenderMap,
      position: { x: defender.x, y: defender.y },
      outcome: 'kill',
    },
    result: 'ok',
  };
  const seedHash = ctx.computeReceiptHash(combatResolvedBase);

  // 3. Compute which items to drop using weighted policy
  const reputation = ctx.getReputation(targetId);
  const dropResult = computeDeathDrops(inventoryItems, defenderMap, reputation, seedHash);
  const droppedItemIds = dropResult.droppedItemIds;

  // 4. Snapshot legendary items for heat accrual (before any state changes)
  // We'll emit heat receipts AFTER item drops per ordering convention B
  const attackerLegendaries: Array<{ itemId: string; currentHeat: number }> = [];
  const defenderLegendaries: Array<{ itemId: string; currentHeat: number }> = [];

  const attackerItemIds = Array.from(inventory.get(attackerId) ?? []);
  for (const itemId of attackerItemIds) {
    const item = persist.getItem(itemId);
    if (item?.meta_json) {
      const meta = JSON.parse(item.meta_json);
      if (meta.legendary) {
        attackerLegendaries.push({ itemId, currentHeat: getLegendaryHeat(itemId) });
      }
    }
  }
  for (const itemId of inventoryItemIds) {
    const item = persist.getItem(itemId);
    if (item?.meta_json) {
      const meta = JSON.parse(item.meta_json);
      if (meta.legendary) {
        defenderLegendaries.push({ itemId, currentHeat: getLegendaryHeat(itemId) });
      }
    }
  }

  // 5. Emit attack_intent receipt
  audit.write({
    player_id: attackerId,
    action: 'attack_intent',
    inputs: {
      target_player_id: targetId,
      map: attackerMap,
      position: { x: attacker.x, y: attacker.y },
    },
    result: 'ok',
  });

  // 6. Emit combat_resolved receipt (before applyDeath)
  audit.write({
    player_id: attackerId,
    action: 'combat_resolved',
    inputs: {
      target_player_id: targetId,
      map: defenderMap,
      position: { x: defender.x, y: defender.y },
      outcome: 'kill',
      dropped_item_ids: droppedItemIds,
      drop_seed_hash: seedHash, // For audit traceability
      protected_item_id: defenderProtectedId ?? null, // Phase 3.3: visible for audit
    },
    result: 'ok',
  });

  // 7. Call applyDeath for defender
  ctx.applyDeathFn({
    now,
    player_id: targetId,
    map: defenderMap,
    position: { x: defender.x, y: defender.y },
    cause: 'player',
    killer_id: attackerId,
    respawn_delay_ms: ctx.respawnDelayMs,
    current_status: defender.status,
    current_dead_until_ms: defender.dead_until_ms,
    lastDamage: {
      at_ms: now,
      source_type: 'player',
      source_id: attackerId,
    },
    audit,
    setDead: (deadUntilMs: number) => ctx.setDead(targetId, deadUntilMs),
    adjustReputation: (delta: number) => ctx.adjustReputation(targetId, delta),
  });

  // 8. Drop selected items (emit receipts and update in-memory)
  const decayAt = new Date(now + getDeathDropDecayMs(defenderMap)).toISOString();

  for (const itemId of droppedItemIds) {
    // Emit item_removed_from_inventory
    audit.write({
      player_id: targetId,
      action: 'item_removed_from_inventory',
      inputs: { item_id: itemId, reason: 'death' },
      result: 'ok',
    });

    // Emit item_dropped_to_world
    audit.write({
      player_id: targetId,
      action: 'item_dropped_to_world',
      inputs: {
        item_id: itemId,
        zone: defenderMap,
        x: defender.x,
        y: defender.y,
        decay_at: decayAt,
      },
      result: 'ok',
    });

    // Update in-memory inventory
    inventory.get(targetId)?.delete(itemId);

    // Update in-memory worldItems
    const item = persist.getItem(itemId);
    if (!worldItems.has(defenderMap)) {
      worldItems.set(defenderMap, new Map());
    }
    worldItems.get(defenderMap)!.set(itemId, {
      x: defender.x,
      y: defender.y,
      decayAt,
      itemType: item?.item_type ?? 'unknown',
    });
  }

  // 9. Emit legendary_heat_changed receipts (ordering convention B: after item drops)
  // Attacker (survivor): +1 heat on all legendary items they carry
  for (const { itemId, currentHeat } of attackerLegendaries) {
    const newHeat = Math.max(0, currentHeat + 1);
    audit.write({
      player_id: attackerId,
      action: 'legendary_heat_changed',
      inputs: {
        item_id: itemId,
        delta: 1,
        new_heat: newHeat,
        reason: 'combat_kill',
        context: {
          map: defenderMap,
          at_ms: now,
          related_player_id: targetId,
          combat_resolved_hash: seedHash,
        },
      },
      result: 'ok',
    });
    // Update runtime map
    setLegendaryHeat(itemId, newHeat);
  }

  // Defender (dying): +2 heat on all legendary items they carried
  for (const { itemId, currentHeat } of defenderLegendaries) {
    const newHeat = Math.max(0, currentHeat + 2);
    audit.write({
      player_id: targetId,
      action: 'legendary_heat_changed',
      inputs: {
        item_id: itemId,
        delta: 2,
        new_heat: newHeat,
        reason: 'combat_death',
        context: {
          map: defenderMap,
          at_ms: now,
          related_player_id: attackerId,
          combat_resolved_hash: seedHash,
        },
      },
      result: 'ok',
    });
    // Update runtime map
    setLegendaryHeat(itemId, newHeat);
  }

  // 10. Update attacker cooldown
  lastAttackAt.set(attackerId, now);

  return {
    success: true,
    droppedItemIds,
    defenderPos: { x: defender.x, y: defender.y },
    map: defenderMap,
  };
}
