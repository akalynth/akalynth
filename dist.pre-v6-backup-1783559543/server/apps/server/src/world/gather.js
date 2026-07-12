/**
 * Chill-Zone Gather — server-authoritative no-combat micro-loop (Step 1 core).
 *
 * Loop: move → gather(node) → deliver(station). The server owns the gather clock, the
 * node lifecycle, and an ephemeral single held-item slot; the client only ever sends
 * intents (validated here). A lying client gains nothing — every outcome is computed
 * server-side.
 *
 * Scope (Step 1):
 *  - All state is in-memory and EPHEMERAL by design (nodes + held slot reset on restart).
 *  - The ONLY durable artifact is the `delivery_recorded` receipt, emitted by the caller
 *    (index.ts) from {@link DeliverResult.record}. No reward is credited here (step 4).
 *  - This module is pure/standalone and is INERT until index.ts wires it behind the
 *    CHILL_ZONE_GATHER_ENABLED flag (default off).
 *
 * World model: tile grid (integer x/y), Manhattan interaction range; wall-clock ms timing
 * (Date.now()). Mirrors the receipt/anti-cheat conventions used by work_contracts.ts and
 * heat.ts. See codex/design/chill-zone-gather-step1-server-spec.md.
 */
/** Receipt action emitted on a successful delivery (snake_case per server convention). */
export const DELIVERY_RECORDED_ACTION = 'delivery_recorded';
/**
 * Delivery reward acknowledgments. Non-tradeable, recorded-only — NO gold, no balance write.
 * Raw motes pay the tending token (shipped); refined motes pay the keystone token.
 */
export const TENDING_TOKEN_ID = 'tending_token';
export const KEYSTONE_TOKEN_ID = 'keystone_token';
/**
 * Raw gather item types → the refined type each becomes at a refinery station. Refining is an
 * in-place upgrade of the single held slot (capacity stays 1; no second item, no dupe surface).
 * Final lore naming owned by map-and-lore-builder.
 */
export const REFINABLE = { ley_mote: 'refined_ley_mote' };
/** The refined type for a raw item type, or null if it is not a refinable raw type (or already refined). */
export function refinedTypeOf(itemType) {
    return REFINABLE[itemType] ?? null;
}
/** Whether an item type is a refined output (a value in {@link REFINABLE}). */
export function isRefinedType(itemType) {
    return Object.values(REFINABLE).includes(itemType);
}
/** Delivery reward as a pure function of the delivered item type (invariant I10). */
export function rewardForItemType(itemType) {
    return isRefinedType(itemType) ? KEYSTONE_TOKEN_ID : TENDING_TOKEN_ID;
}
export const DEFAULT_GATHER_CONFIG = {
    gatherDurationMs: 3_000,
    refineDurationMs: 5_000,
    respawnCooldownMs: 30_000,
    interactRadius: 1,
};
const IDLE = { state: 'idle' };
function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
}
export function createGatherSystem(config, nodeDefs, stationDefs) {
    const zones = new Map();
    const zoneOf = (z) => {
        let gz = zones.get(z);
        if (!gz) {
            gz = { zone: z, nodes: new Map(), stations: new Map() };
            zones.set(z, gz);
        }
        return gz;
    };
    for (const d of nodeDefs) {
        zoneOf(d.zone).nodes.set(d.node_id, {
            ...d,
            state: 'available',
            claimant_id: null,
            complete_at_ms: null,
            respawn_at_ms: null,
        });
    }
    for (const s of stationDefs) {
        zoneOf(s.zone).stations.set(s.station_id, { ...s });
    }
    return { config, zones, gatherByPlayer: new Map(), heldByPlayer: new Map() };
}
export function getPlayerGather(sys, playerId) {
    return sys.gatherByPlayer.get(playerId) ?? IDLE;
}
export function getHeld(sys, playerId) {
    return sys.heldByPlayer.get(playerId) ?? null;
}
/**
 * Start a gather. Server-authoritative: every guard uses server-side position/state.
 * On success the node is CLAIMED (DEPLETING) and the player is GATHERING; the actual
 * yield happens later in {@link tickGather} when the server clock reaches completion.
 */
export function startGather(sys, playerId, zone, nodeId, px, py, nowMs) {
    const gz = sys.zones.get(zone);
    if (!gz)
        return { ok: false, reason: 'UNKNOWN_ZONE' };
    const node = gz.nodes.get(nodeId);
    if (!node)
        return { ok: false, reason: 'NODE_NOT_FOUND' };
    if (node.state !== 'available')
        return { ok: false, reason: 'NODE_NOT_AVAILABLE' };
    if (manhattan(px, py, node.x, node.y) > sys.config.interactRadius) {
        return { ok: false, reason: 'OUT_OF_RANGE' };
    }
    const activity = getPlayerGather(sys, playerId);
    if (activity.state === 'gathering')
        return { ok: false, reason: 'ALREADY_GATHERING' };
    if (activity.state === 'refining')
        return { ok: false, reason: 'ALREADY_REFINING' };
    if (getHeld(sys, playerId) !== null)
        return { ok: false, reason: 'HELD_SLOT_FULL' };
    const completeAt = nowMs + sys.config.gatherDurationMs;
    node.state = 'depleting';
    node.claimant_id = playerId;
    node.complete_at_ms = completeAt;
    sys.gatherByPlayer.set(playerId, {
        state: 'gathering',
        node_id: nodeId,
        zone,
        started_at_ms: nowMs,
        complete_at_ms: completeAt,
    });
    return { ok: true, node_id: nodeId, complete_at_ms: completeAt };
}
/**
 * Start refining the held item at a refinery station. Server-authoritative: every guard uses
 * server-side position/state. On success the player is REFINING; the in-place item upgrade
 * (ley_mote → refined_ley_mote) happens later in {@link tickGather} at the server-owned clock.
 * Held-slot capacity is unchanged (no second item — invariant I9).
 */
export function startRefine(sys, playerId, zone, stationId, px, py, nowMs) {
    const gz = sys.zones.get(zone);
    if (!gz)
        return { ok: false, reason: 'UNKNOWN_ZONE' };
    const station = gz.stations.get(stationId);
    if (!station || station.kind !== 'refinery')
        return { ok: false, reason: 'STATION_NOT_FOUND' };
    if (manhattan(px, py, station.x, station.y) > sys.config.interactRadius) {
        return { ok: false, reason: 'OUT_OF_RANGE' };
    }
    // Busy-before-slot precedence (mirrors startGather): a player mid-activity gets ALREADY_*,
    // not a slot complaint. (A gathering player holds nothing, so this must precede the held check.)
    const activity = getPlayerGather(sys, playerId);
    if (activity.state === 'gathering')
        return { ok: false, reason: 'ALREADY_GATHERING' };
    if (activity.state === 'refining')
        return { ok: false, reason: 'ALREADY_REFINING' };
    const held = getHeld(sys, playerId);
    if (held === null)
        return { ok: false, reason: 'HELD_SLOT_EMPTY' };
    if (refinedTypeOf(held.item_type) === null)
        return { ok: false, reason: 'NOT_REFINABLE' };
    const completeAt = nowMs + sys.config.refineDurationMs;
    sys.gatherByPlayer.set(playerId, {
        state: 'refining',
        station_id: stationId,
        zone,
        started_at_ms: nowMs,
        complete_at_ms: completeAt,
    });
    return { ok: true, station_id: stationId, complete_at_ms: completeAt };
}
function releaseClaim(sys, playerId, g) {
    const node = sys.zones.get(g.zone)?.nodes.get(g.node_id);
    if (node && node.state === 'depleting' && node.claimant_id === playerId) {
        node.state = 'available';
        node.claimant_id = null;
        node.complete_at_ms = null;
    }
}
/** Abort an in-progress gather (cancel / out-of-range / disconnect). Releases the node, no yield. */
export function cancelGather(sys, playerId) {
    const g = getPlayerGather(sys, playerId);
    if (g.state !== 'gathering')
        return;
    releaseClaim(sys, playerId, g);
    sys.gatherByPlayer.set(playerId, IDLE);
}
/**
 * Abort an in-progress refine (cancel / out-of-range / disconnect). Player → IDLE; the held item
 * stays exactly as it was (still raw — no upgrade). Nothing to release: a refinery is not claimed.
 */
export function cancelRefine(sys, playerId) {
    if (getPlayerGather(sys, playerId).state !== 'refining')
        return;
    sys.gatherByPlayer.set(playerId, IDLE);
}
/** Full cleanup when a player leaves: release any claim and drop their gather + held state. */
export function onPlayerLeave(sys, playerId) {
    cancelGather(sys, playerId);
    cancelRefine(sys, playerId);
    sys.gatherByPlayer.delete(playerId);
    sys.heldByPlayer.delete(playerId);
}
/**
 * Deliver the held item at a curation station. Consumes the slot atomically and returns the
 * provenance + graded reward for a single `delivery_recorded` receipt. Refined items pay the
 * keystone token; raw items pay the tending token (invariant I10/I11). No gold is credited.
 */
export function deliver(sys, playerId, zone, stationId, px, py) {
    const gz = sys.zones.get(zone);
    if (!gz)
        return { ok: false, reason: 'UNKNOWN_ZONE' };
    const station = gz.stations.get(stationId);
    // Delivery happens at curation stands only; a refinery id here is "no curation station by that id".
    if (!station || station.kind !== 'curation')
        return { ok: false, reason: 'STATION_NOT_FOUND' };
    if (manhattan(px, py, station.x, station.y) > sys.config.interactRadius) {
        return { ok: false, reason: 'OUT_OF_RANGE' };
    }
    const held = getHeld(sys, playerId);
    if (held === null)
        return { ok: false, reason: 'HELD_SLOT_EMPTY' };
    sys.heldByPlayer.set(playerId, null);
    return {
        ok: true,
        record: {
            player_id: playerId,
            item_type: held.item_type,
            station_id: stationId,
            source_node_id: held.source_node_id,
            zone,
            refined: held.refined_at_station_id !== null,
            refined_at_station_id: held.refined_at_station_id,
            reward: rewardForItemType(held.item_type),
        },
    };
}
/**
 * Advance the server clock: complete due gathers (yield → held slot, node → DEPLETED), complete
 * due refines (upgrade held slot in place), and respawn nodes whose cooldown elapsed.
 * Deterministic; called once per server tick.
 */
export function tickGather(sys, nowMs) {
    const effects = { completed: [], refined: [], respawned: [] };
    // 1. Complete due timed activities (gather → yield; refine → in-place upgrade).
    for (const [playerId, g] of sys.gatherByPlayer) {
        if (g.state === 'gathering' && nowMs >= g.complete_at_ms) {
            const node = sys.zones.get(g.zone)?.nodes.get(g.node_id);
            sys.gatherByPlayer.set(playerId, IDLE);
            if (!node)
                continue;
            node.state = 'depleted';
            node.claimant_id = null;
            node.complete_at_ms = null;
            node.respawn_at_ms = nowMs + sys.config.respawnCooldownMs;
            sys.heldByPlayer.set(playerId, {
                item_type: node.item_type,
                source_node_id: node.node_id,
                zone: g.zone,
                refined_at_station_id: null,
            });
            effects.completed.push({ player_id: playerId, node_id: node.node_id, zone: g.zone, item_type: node.item_type });
        }
        else if (g.state === 'refining' && nowMs >= g.complete_at_ms) {
            sys.gatherByPlayer.set(playerId, IDLE);
            const held = getHeld(sys, playerId);
            if (!held)
                continue;
            const refinedType = refinedTypeOf(held.item_type);
            // Guard against a slot that changed since refine started (raced delivery / already refined).
            if (refinedType === null)
                continue;
            sys.heldByPlayer.set(playerId, { ...held, item_type: refinedType, refined_at_station_id: g.station_id });
            effects.refined.push({ player_id: playerId, station_id: g.station_id, zone: g.zone, item_type: refinedType });
        }
    }
    // 2. Respawn due nodes.
    for (const gz of sys.zones.values()) {
        for (const node of gz.nodes.values()) {
            if (node.state === 'depleted' && node.respawn_at_ms !== null && nowMs >= node.respawn_at_ms) {
                node.state = 'available';
                node.respawn_at_ms = null;
                effects.respawned.push({ node_id: node.node_id, zone: gz.zone });
            }
        }
    }
    return effects;
}
/** Server-computed gather progress in [0,100], or null if the player is not gathering. (For step-2 snapshot.) */
export function gatherProgressPct(sys, playerId, nowMs) {
    const g = getPlayerGather(sys, playerId);
    if (g.state !== 'gathering')
        return null;
    const span = g.complete_at_ms - g.started_at_ms;
    if (span <= 0)
        return 100;
    const pct = ((nowMs - g.started_at_ms) / span) * 100;
    return Math.max(0, Math.min(100, pct));
}
/** Server-computed refine progress in [0,100], or null if the player is not refining. (For step-2 snapshot.) */
export function refineProgressPct(sys, playerId, nowMs) {
    const g = getPlayerGather(sys, playerId);
    if (g.state !== 'refining')
        return null;
    const span = g.complete_at_ms - g.started_at_ms;
    if (span <= 0)
        return 100;
    const pct = ((nowMs - g.started_at_ms) / span) * 100;
    return Math.max(0, Math.min(100, pct));
}
/** Feature flag (default OFF), matching the server's parseBoolEnv convention. */
export function isGatherEnabled(env = process.env) {
    const v = (env.CHILL_ZONE_GATHER_ENABLED ?? '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
}
/**
 * Refine sub-feature flag (default OFF), independent of CHILL_ZONE_GATHER_ENABLED so the refine
 * step can roll out / roll back separately. Step 2 gates the live refinery placement + refine_intent
 * wire on this; the gather loop is unaffected when it is off.
 */
export function isRefineEnabled(env = process.env) {
    const v = (env.CHILL_ZONE_REFINE_ENABLED ?? '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
}
/**
 * Static placement for the Azura chill zone, validated against azura.json walkable tiles
 * around the Azura spawn (32,32). Node tiles are interaction targets — the player stands
 * adjacent (Manhattan ≤ interactRadius); the curation stand is the delivery point. Inert
 * while CHILL_ZONE_GATHER_ENABLED is off. Final lore naming owned by map-and-lore-builder.
 */
export const AZURA_GATHER_NODES = [
    { node_id: 'azura_ley_mote_e', zone: 'Azura', x: 34, y: 32, item_type: 'ley_mote' },
    { node_id: 'azura_ley_mote_s', zone: 'Azura', x: 32, y: 34, item_type: 'ley_mote' },
    { node_id: 'azura_ley_mote_se', zone: 'Azura', x: 34, y: 34, item_type: 'ley_mote' },
    { node_id: 'azura_ley_mote_n', zone: 'Azura', x: 32, y: 30, item_type: 'ley_mote' },
];
export const AZURA_STATIONS = [
    { station_id: 'azura_curation_stand', zone: 'Azura', x: 31, y: 32, kind: 'curation' },
];
/**
 * Refinery placement for the Azura chill zone. Tile (33,33) is walkable in azura.json (tile=0),
 * sits Manhattan ≥2 from every gather node (so it never overlaps a node's interaction tile) and
 * 3 tiles from the curation stand (forcing a real delivery step). Kept SEPARATE from
 * {@link AZURA_STATIONS}: index.ts merges it into the live zone only when {@link isRefineEnabled}
 * (step 2 wiring). Final lore naming owned by map-and-lore-builder.
 */
export const AZURA_REFINE_STATIONS = [
    { station_id: 'azura_refinery_stand', zone: 'Azura', x: 33, y: 33, kind: 'refinery' },
];
