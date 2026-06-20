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

export type NodeState = 'available' | 'depleting' | 'depleted';

export interface GatherConfig {
  /** Server-owned gather duration. */
  gatherDurationMs: number;
  /** Delay from depletion to becoming AVAILABLE again. */
  respawnCooldownMs: number;
  /** Max Manhattan tile distance to interact with a node/station. */
  interactRadius: number;
}

export const DEFAULT_GATHER_CONFIG: GatherConfig = {
  gatherDurationMs: 3_000,
  respawnCooldownMs: 30_000,
  interactRadius: 1,
};

export interface GatherNodeDef {
  node_id: string;
  zone: string;
  x: number;
  y: number;
  item_type: string;
}

export interface GatherNode extends GatherNodeDef {
  state: NodeState;
  claimant_id: string | null;
  complete_at_ms: number | null;
  respawn_at_ms: number | null;
}

export interface StationDef {
  station_id: string;
  zone: string;
  x: number;
  y: number;
}

export type PlayerGather =
  | { state: 'idle' }
  | {
      state: 'gathering';
      node_id: string;
      zone: string;
      started_at_ms: number;
      complete_at_ms: number;
    };

export type HeldItem = null | { item_type: string; source_node_id: string; zone: string };

export type RejectCode =
  | 'UNKNOWN_ZONE'
  | 'NODE_NOT_FOUND'
  | 'NODE_NOT_AVAILABLE'
  | 'OUT_OF_RANGE'
  | 'ALREADY_GATHERING'
  | 'HELD_SLOT_FULL'
  | 'HELD_SLOT_EMPTY'
  | 'STATION_NOT_FOUND';

export interface GatherZone {
  zone: string;
  nodes: Map<string, GatherNode>;
  stations: Map<string, StationDef>;
}

export interface GatherSystem {
  config: GatherConfig;
  zones: Map<string, GatherZone>;
  /** Active gathers, keyed by player id. Absent ⇒ idle. */
  gatherByPlayer: Map<string, PlayerGather>;
  /** Single held-item slot per player. Absent or null ⇒ empty. */
  heldByPlayer: Map<string, HeldItem>;
}

const IDLE: PlayerGather = { state: 'idle' };

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function createGatherSystem(
  config: GatherConfig,
  nodeDefs: readonly GatherNodeDef[],
  stationDefs: readonly StationDef[],
): GatherSystem {
  const zones = new Map<string, GatherZone>();
  const zoneOf = (z: string): GatherZone => {
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

export function getPlayerGather(sys: GatherSystem, playerId: string): PlayerGather {
  return sys.gatherByPlayer.get(playerId) ?? IDLE;
}

export function getHeld(sys: GatherSystem, playerId: string): HeldItem {
  return sys.heldByPlayer.get(playerId) ?? null;
}

export type GatherStartResult =
  | { ok: true; node_id: string; complete_at_ms: number }
  | { ok: false; reason: RejectCode };

/**
 * Start a gather. Server-authoritative: every guard uses server-side position/state.
 * On success the node is CLAIMED (DEPLETING) and the player is GATHERING; the actual
 * yield happens later in {@link tickGather} when the server clock reaches completion.
 */
export function startGather(
  sys: GatherSystem,
  playerId: string,
  zone: string,
  nodeId: string,
  px: number,
  py: number,
  nowMs: number,
): GatherStartResult {
  const gz = sys.zones.get(zone);
  if (!gz) return { ok: false, reason: 'UNKNOWN_ZONE' };
  const node = gz.nodes.get(nodeId);
  if (!node) return { ok: false, reason: 'NODE_NOT_FOUND' };
  if (node.state !== 'available') return { ok: false, reason: 'NODE_NOT_AVAILABLE' };
  if (manhattan(px, py, node.x, node.y) > sys.config.interactRadius) {
    return { ok: false, reason: 'OUT_OF_RANGE' };
  }
  if (getPlayerGather(sys, playerId).state !== 'idle') {
    return { ok: false, reason: 'ALREADY_GATHERING' };
  }
  if (getHeld(sys, playerId) !== null) return { ok: false, reason: 'HELD_SLOT_FULL' };

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

function releaseClaim(
  sys: GatherSystem,
  playerId: string,
  g: Extract<PlayerGather, { state: 'gathering' }>,
): void {
  const node = sys.zones.get(g.zone)?.nodes.get(g.node_id);
  if (node && node.state === 'depleting' && node.claimant_id === playerId) {
    node.state = 'available';
    node.claimant_id = null;
    node.complete_at_ms = null;
  }
}

/** Abort an in-progress gather (cancel / out-of-range / disconnect). Releases the node, no yield. */
export function cancelGather(sys: GatherSystem, playerId: string): void {
  const g = getPlayerGather(sys, playerId);
  if (g.state !== 'gathering') return;
  releaseClaim(sys, playerId, g);
  sys.gatherByPlayer.set(playerId, IDLE);
}

/** Full cleanup when a player leaves: release any claim and drop their gather + held state. */
export function onPlayerLeave(sys: GatherSystem, playerId: string): void {
  cancelGather(sys, playerId);
  sys.gatherByPlayer.delete(playerId);
  sys.heldByPlayer.delete(playerId);
}

export interface DeliveryRecord {
  player_id: string;
  item_type: string;
  station_id: string;
  source_node_id: string;
  zone: string;
}

export type DeliverResult = { ok: true; record: DeliveryRecord } | { ok: false; reason: RejectCode };

/**
 * Deliver the held item at a station. Consumes the slot atomically and returns the
 * provenance for a single `delivery_recorded` receipt. No reward is credited (step 4).
 */
export function deliver(
  sys: GatherSystem,
  playerId: string,
  zone: string,
  stationId: string,
  px: number,
  py: number,
): DeliverResult {
  const gz = sys.zones.get(zone);
  if (!gz) return { ok: false, reason: 'UNKNOWN_ZONE' };
  const station = gz.stations.get(stationId);
  if (!station) return { ok: false, reason: 'STATION_NOT_FOUND' };
  if (manhattan(px, py, station.x, station.y) > sys.config.interactRadius) {
    return { ok: false, reason: 'OUT_OF_RANGE' };
  }
  const held = getHeld(sys, playerId);
  if (held === null) return { ok: false, reason: 'HELD_SLOT_EMPTY' };

  sys.heldByPlayer.set(playerId, null);
  return {
    ok: true,
    record: {
      player_id: playerId,
      item_type: held.item_type,
      station_id: stationId,
      source_node_id: held.source_node_id,
      zone,
    },
  };
}

export interface GatherTickEffects {
  completed: Array<{ player_id: string; node_id: string; zone: string; item_type: string }>;
  respawned: Array<{ node_id: string; zone: string }>;
}

/**
 * Advance the server clock: complete due gathers (yield → held slot, node → DEPLETED) and
 * respawn nodes whose cooldown elapsed. Deterministic; called once per server tick.
 */
export function tickGather(sys: GatherSystem, nowMs: number): GatherTickEffects {
  const effects: GatherTickEffects = { completed: [], respawned: [] };

  // 1. Complete due gathers.
  for (const [playerId, g] of sys.gatherByPlayer) {
    if (g.state !== 'gathering' || nowMs < g.complete_at_ms) continue;
    const node = sys.zones.get(g.zone)?.nodes.get(g.node_id);
    sys.gatherByPlayer.set(playerId, IDLE);
    if (!node) continue;
    node.state = 'depleted';
    node.claimant_id = null;
    node.complete_at_ms = null;
    node.respawn_at_ms = nowMs + sys.config.respawnCooldownMs;
    sys.heldByPlayer.set(playerId, {
      item_type: node.item_type,
      source_node_id: node.node_id,
      zone: g.zone,
    });
    effects.completed.push({ player_id: playerId, node_id: node.node_id, zone: g.zone, item_type: node.item_type });
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
export function gatherProgressPct(sys: GatherSystem, playerId: string, nowMs: number): number | null {
  const g = getPlayerGather(sys, playerId);
  if (g.state !== 'gathering') return null;
  const span = g.complete_at_ms - g.started_at_ms;
  if (span <= 0) return 100;
  const pct = ((nowMs - g.started_at_ms) / span) * 100;
  return Math.max(0, Math.min(100, pct));
}

/** Feature flag (default OFF), matching the server's parseBoolEnv convention. */
export function isGatherEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.CHILL_ZONE_GATHER_ENABLED ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * PLACEHOLDER static placement for the Azura chill zone. Coordinates MUST be validated
 * against the Azura map's walkable tiles before the flag is enabled (step 2 / content-designer).
 * Inert while CHILL_ZONE_GATHER_ENABLED is off.
 */
export const AZURA_GATHER_NODES: readonly GatherNodeDef[] = [
  { node_id: 'azura_ley_mote_1', zone: 'Azura', x: 8, y: 8, item_type: 'ley_mote' },
  { node_id: 'azura_ley_mote_2', zone: 'Azura', x: 10, y: 8, item_type: 'ley_mote' },
  { node_id: 'azura_ley_mote_3', zone: 'Azura', x: 8, y: 10, item_type: 'ley_mote' },
  { node_id: 'azura_ley_mote_4', zone: 'Azura', x: 10, y: 10, item_type: 'ley_mote' },
];

export const AZURA_STATIONS: readonly StationDef[] = [
  { station_id: 'azura_curation_stand', zone: 'Azura', x: 9, y: 9 },
];
