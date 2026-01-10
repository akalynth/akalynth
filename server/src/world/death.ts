import { DEATH_REPUTATION_PENALTY, LAST_DAMAGE_WINDOW_MS } from '../../../shared/constants.js';
import type { MapName } from '../../../shared/http.js';
import type { DeathCause, PlayerStatus, Position } from '../../../shared/types.js';
import type { AuditLogger } from '../audit/logger.js';

export interface ApplyDeathOptions {
  now: number;
  player_id: string;
  map: MapName;
  position: Position;
  cause: DeathCause;
  killer_id?: string | null;
  respawn_delay_ms: number;
  current_status: PlayerStatus;
  current_dead_until_ms: number | null | undefined;
  lastDamage?: {
    at_ms: number;
    source_type: 'player' | 'tile' | 'status' | 'unknown';
    source_id: string | null;
  };
  lastDamageWindowMs?: number;
  gateUnlocked?: boolean;
  emitFirstOf?: (info: {
    map: MapName;
    position: Position;
    cause: DeathCause;
    source_type: 'player' | 'tile' | 'status' | 'unknown';
    alias: string;
    gateUnlocked: boolean;
  }) => void;
  audit: AuditLogger;
  setDead: (dead_until_ms: number) => void;
  adjustReputation: (delta: number) => void;
}

export interface ApplyDeathResult {
  changed: boolean;
  dead_until_ms: number;
  respawn_in_ms: number;
}

export interface ApplyRespawnOptions {
  now: number;
  player_id: string;
  map: MapName;
  spawn: Position;
  current_status: PlayerStatus;
  current_dead_until_ms: number | null | undefined;
  audit: AuditLogger;
  setAlive: (spawn: Position) => void;
}

export interface ApplyRespawnResult {
  changed: boolean;
}

function deathAliasForMap(map: MapName): string {
  const lower = map.toLowerCase();
  return `death_in_${lower}`;
}

export function applyDeath(opts: ApplyDeathOptions): ApplyDeathResult {
  const alreadyDead =
    opts.current_status === 'dead' && opts.current_dead_until_ms !== null && opts.current_dead_until_ms !== undefined;

  if (alreadyDead && opts.current_dead_until_ms! > opts.now) {
    return {
      changed: false,
      dead_until_ms: opts.current_dead_until_ms!,
      respawn_in_ms: opts.current_dead_until_ms! - opts.now,
    };
  }

  const dead_until_ms = opts.now + opts.respawn_delay_ms;
  const reputation_delta = -DEATH_REPUTATION_PENALTY;
  const alias = deathAliasForMap(opts.map);
  const windowMs = opts.lastDamageWindowMs ?? LAST_DAMAGE_WINDOW_MS;
  let source_type: 'player' | 'tile' | 'status' | 'unknown' = 'unknown';
  let source_id: string | null = null;
  let source_age_ms: number | null = null;

  if (opts.lastDamage && windowMs > 0) {
    const age = opts.now - opts.lastDamage.at_ms;
    if (age >= 0 && age <= windowMs) {
      source_type = opts.lastDamage.source_type;
      source_id = opts.lastDamage.source_id;
      source_age_ms = age;
    }
  }

  opts.setDead(dead_until_ms);

  opts.audit.write({
    player_id: opts.player_id,
    action: 'death',
    inputs: {
      map: opts.map,
      position: opts.position,
      cause: opts.cause,
      killer_id: opts.killer_id ?? null,
      respawn_delay_ms: opts.respawn_delay_ms,
      dead_until_ms,
    },
    result: 'ok',
  });

  opts.audit.write({
    player_id: opts.player_id,
    action: 'death_context',
    inputs: {
      map: opts.map,
      alias,
      cause: opts.cause,
    },
    result: 'ok',
  });

  opts.audit.write({
    player_id: opts.player_id,
    action: 'last_damage_attribution',
    inputs: {
      source_type,
      source_id,
      source_age_ms,
      window_ms: windowMs,
    },
    result: 'ok',
  });

  const contextAction = opts.map === 'Azura' ? 'death_in_azura' : 'death_in_rookguard';
  opts.audit.write({
    player_id: opts.player_id,
    action: contextAction,
    inputs: {
      map: opts.map,
      position: opts.position,
      flags: [],
    },
    result: 'ok',
  });

  if (opts.emitFirstOf) {
    opts.emitFirstOf({
      map: opts.map,
      position: opts.position,
      cause: opts.cause,
      source_type,
      alias: contextAction,
      gateUnlocked: opts.gateUnlocked ?? false,
    });
  }

  if (reputation_delta !== 0) {
    opts.adjustReputation(reputation_delta);
    opts.audit.write({
      player_id: opts.player_id,
      action: 'death_penalty_applied',
      inputs: {
        map: opts.map,
        dead_until_ms,
        respawn_delay_ms: opts.respawn_delay_ms,
        reputation_delta,
        cause: opts.cause,
        killer_id: opts.killer_id ?? null,
      },
      result: 'applied',
    });
  }

  return { changed: true, dead_until_ms, respawn_in_ms: opts.respawn_delay_ms };
}

export function applyRespawn(opts: ApplyRespawnOptions): ApplyRespawnResult {
  if (opts.current_status !== 'dead') return { changed: false };
  if (opts.current_dead_until_ms === null || opts.current_dead_until_ms === undefined) return { changed: false };
  if (opts.now < opts.current_dead_until_ms) return { changed: false };

  opts.setAlive(opts.spawn);

  opts.audit.write({
    player_id: opts.player_id,
    action: 'respawn',
    inputs: {
      map: opts.map,
      spawn: opts.spawn,
      dead_until_ms: opts.current_dead_until_ms,
    },
    result: 'ok',
  });

  return { changed: true };
}
