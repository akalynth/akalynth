// Akalynth Combat v0.3 — Weighted Death Generator with Legendary Fuse
// Phase 3: Server-authoritative combat with weighted drop policy
import { computeDeathDrops, getDeathDropDecayMs, getLegendaryHeat, setLegendaryHeat, } from './drop-policy.js';
import { rngCommit, rngDeriveSeedV2, computeInventoryCommit, rngRevealHex32 } from './rng.js';
// ============================================================================
// Constants
// ============================================================================
export const COMBAT_COOLDOWN_MS = 2000;
export const ZONE_PVP_ENABLED = {
    Rookguard: false, // Training zone, always safe
    Azura: true, // PvP enabled (v0: entire map)
};
export const DEATH_DROP_DECAY_MINUTES = {
    Rookguard: 60, // Irrelevant (no PvP)
    Azura: 20, // 20 minutes for all death drops
};
// ============================================================================
// Helpers
// ============================================================================
/**
 * Check if two positions are adjacent (Manhattan distance = 1)
 */
export function isAdjacent(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return dx + dy === 1;
}
/**
 * Check if a player is alive
 */
export function isAlive(player, now) {
    if (player.status === 'dead')
        return false;
    if (player.dead_until_ms && player.dead_until_ms > now)
        return false;
    return true;
}
// ============================================================================
// Validation
// ============================================================================
/**
 * Check if an attack is valid
 */
export function canAttack(attacker, defender, attackerMap, defenderMap, now, lastAttackAt) {
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
export function handleAttackIntent(ctx) {
    const { attackerId, targetId, now, audit, persist, inventory, worldItems, lastAttackAt, sessions } = ctx;
    // Find attacker and defender sessions
    let attackerSession;
    let defenderSession;
    for (const [, s] of sessions) {
        if (s.player?.id === attackerId)
            attackerSession = s;
        if (s.player?.id === targetId)
            defenderSession = s;
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
    const inventoryItems = inventoryItemIds.map((itemId) => {
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
        actor_id: attackerId,
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
    // 2.1 #101: decide v2 vs v1 derivation. v2 is reachable ONLY when the flag is
    // ON AND the session carries a 'death_drop:v1' reveal+commit+chronicle ref.
    // When ANY of those is absent (flag OFF is the default), we fall back to the
    // EXACT #100 v1 path — same seed (seedHash), same outcome, same proof shape.
    const v2Reveal = ctx.rngV2Enabled ? ctx.getRngRevealV1?.(targetId) : undefined;
    const v2CommitRef = ctx.rngV2Enabled ? ctx.getRngCommitRefV1?.(targetId) : undefined;
    const v2Commit = ctx.rngV2Enabled ? ctx.getRngCommitV1(targetId) : undefined;
    const useV2 = !!(v2Reveal && v2CommitRef && v2Commit);
    // The seed fed to the drop PRF. v1: seedHash (receipt body hash). v2: a seed
    // DERIVED from the pre-committed reveal + this event's preimage hash. This is
    // the intended v2 outcome change — and it ONLY happens behind the flag.
    const dropSeed = useV2
        ? rngDeriveSeedV2(v2Reveal, defenderMap, 'death_drop:v1', seedHash)
        : seedHash;
    // 3. Compute which items to drop using weighted policy
    const reputation = ctx.getReputation(targetId);
    const rngOut = [];
    const dropResult = computeDeathDrops(inventoryItems, defenderMap, reputation, dropSeed, rngOut);
    const droppedItemIds = dropResult.droppedItemIds;
    // 3.1 Snapshot the EXACT inputs computeDeathDrops consumed so an offline
    // verifier can recompute dropped_item_ids from the receipt artifact alone.
    // Legendary weighting depends on per-item heat, which lives in server memory;
    // capture it now (at selection time) into each item's meta so the verifier
    // never needs live server state. This snapshot does NOT feed combatResolvedBase
    // and therefore cannot alter the seed or the loot outcome.
    const rngProofItems = inventoryItems.map((item) => {
        const isLegendary = !!item.meta?.legendary;
        const meta = isLegendary
            ? {
                legendary: true,
                legendary_tier: typeof item.meta?.legendary_tier === 'number' ? item.meta.legendary_tier : 1,
                heat: getLegendaryHeat(item.item_id),
            }
            : undefined;
        return {
            item_id: item.item_id,
            item_type: item.item_type,
            ...(meta ? { meta } : {}),
            ...(item.slot != null ? { slot: item.slot } : {}),
        };
    });
    // #103: Replace plaintext items with a salted commitment so the public receipt
    // no longer reveals the victim's full inventory. The salt is 16 random bytes
    // (32 hex chars), generated here at kill time, used ONCE to compute the
    // commitment, then DISCARDED — it is never logged or written to the receipt.
    // The commitment is: blake3("akalynth:rng:inv:v1" || salt || canonical(items))
    // The opening (salt + items) is held by the player/operator via an out-of-band
    // channel; WITHOUT it the verifier produces outcome_derivation: 'unsupported'.
    // inventory_size stays public because it is needed to compute drop count K.
    const invSalt = (ctx.getInventoryCommitSalt?.(targetId, seedHash) ?? rngRevealHex32()).slice(0, 32); // 16 bytes → 32 hex chars
    const inventoryCommit = computeInventoryCommit(invSalt, rngProofItems);
    const inventorySize = rngProofItems.length;
    // invSalt is intentionally not stored; it goes out of scope here.
    // Seal 3.1: Use session's v1 commit if available, else fallback to v0
    const v1Commit = ctx.getRngCommitV1(targetId);
    const dropRng = v1Commit
        ? {
            rng_commit: v1Commit,
            // rng_reveal omitted for v1 (revealed on disconnect)
            rng_domain: 'death_drop:v1',
            rng_draws: rngOut.length,
            rng_out: rngOut,
        }
        : {
            rng_commit: rngCommit(seedHash),
            rng_reveal: seedHash,
            rng_domain: 'death_drop:v0',
            rng_draws: rngOut.length,
            rng_out: rngOut,
        };
    // 4. Snapshot legendary items for heat accrual (before any state changes)
    // We'll emit heat receipts AFTER item drops per ordering convention B
    const attackerLegendaries = [];
    const defenderLegendaries = [];
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
        actor_id: attackerId,
        action: 'attack_intent',
        inputs: {
            target_player_id: targetId,
            map: attackerMap,
            position: { x: attacker.x, y: attacker.y },
        },
        result: 'ok',
    });
    // 6. Emit combat_resolved receipt (before applyDeath)
    //
    // F1/#100: persist a receipt-contained rng_proof so an OFFLINE verifier can
    // recompute the recorded RNG output AND the final dropped_item_ids from the
    // receipt artifact alone. This block is added to the FINAL receipt only — it is
    // NOT part of combatResolvedBase, so the seed (drop_seed_hash) and the loot
    // selection are provably unchanged. It does NOT prove the server committed to
    // the reveal seed before the outcome; precommit anchoring is future work (#101).
    //
    // #101: when v2 is active, persist the precommit-anchored proof INSTEAD. It
    // carries precommit_ref + rng_out + event_preimage_hash but NEVER the reveal
    // secret (the verifier reads that from the chronicle rng_reveal event). When
    // v2 is inactive (flag OFF), the v1 proof below is byte-identical to #100.
    const rngProof = useV2
        ? {
            version: 2,
            scheme: 'precommit_reveal_v2',
            outcome_type: 'loot_drop',
            precommit_ref: {
                chronicle_seq: v2CommitRef.chronicle_seq,
                chronicle_hash: v2CommitRef.chronicle_hash,
                commit: v2Commit,
            },
            event_preimage_hash: seedHash,
            event_domain: 'death_drop:v1',
            world_id: defenderMap,
            rng_out: rngOut,
            derivation: {
                algorithm: 'rngDeriveSeedV2->rngDrawU32Legacy/selectItemsToDrop@v2',
                inputs: {
                    inventory_commit: inventoryCommit,
                    inventory_size: inventorySize,
                    reputation,
                    map: defenderMap,
                    protected_item_id: defenderProtectedId ?? null,
                },
            },
        }
        : {
            version: 1,
            scheme: 'receipt_hash_seeded_replay',
            outcome_type: 'loot_drop',
            rng_commit_scheme: dropRng.rng_domain === 'death_drop:v1' ? 'death_drop:v1' : 'death_drop:v0',
            receipt_body_hash: seedHash,
            rng_commit: dropRng.rng_commit,
            reveal_seed: seedHash,
            rng_out: rngOut,
            derivation: {
                algorithm: 'rngDrawU32Legacy/selectItemsToDrop@v0',
                domain: 'pvp_loot_drop',
                inputs: {
                    inventory_commit: inventoryCommit,
                    inventory_size: inventorySize,
                    reputation,
                    map: defenderMap,
                    protected_item_id: defenderProtectedId ?? null,
                },
            },
        };
    // NOTE: rng_proof is persisted INSIDE inputs (the only field the audit logger
    // forwards), alongside the existing drop fields. It is NOT part of
    // combatResolvedBase, so the seed/drop_seed_hash and loot outcome are unchanged.
    audit.write({
        actor_id: attackerId,
        action: 'combat_resolved',
        inputs: {
            target_player_id: targetId,
            map: defenderMap,
            position: { x: defender.x, y: defender.y },
            outcome: 'kill',
            dropped_item_ids: droppedItemIds,
            drop_seed_hash: seedHash, // For audit traceability
            protected_item_id: defenderProtectedId ?? null, // Phase 3.3: visible for audit
            rng_proof: rngProof, // F1/#100: receipt-contained RNG proof (offline-verifiable)
        },
        result: 'ok',
    });
    // 7. Call applyDeath for defender
    ctx.applyDeathFn({
        now,
        actor_id: targetId,
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
        setDead: (deadUntilMs) => ctx.setDead(targetId, deadUntilMs),
        adjustReputation: (delta) => ctx.adjustReputation(targetId, delta),
    });
    // 8. Drop selected items (emit receipts and update in-memory)
    const decayAt = new Date(now + getDeathDropDecayMs(defenderMap)).toISOString();
    for (const itemId of droppedItemIds) {
        // Emit item_removed_from_inventory
        audit.write({
            actor_id: targetId,
            action: 'item_removed_from_inventory',
            inputs: { item_id: itemId, reason: 'death' },
            result: 'ok',
        });
        // Emit item_dropped_to_world
        audit.write({
            actor_id: targetId,
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
        worldItems.get(defenderMap).set(itemId, {
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
            actor_id: attackerId,
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
            actor_id: targetId,
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
        dropSeedHash: seedHash,
        dropRng,
        defenderPos: { x: defender.x, y: defender.y },
        map: defenderMap,
    };
}
