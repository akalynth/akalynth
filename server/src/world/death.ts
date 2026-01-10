import { DEATH_REPUTATION_PENALTY, DEATH_RESPAWN_DELAY_MS } from '../../../shared/constants.js';
import type { MapName } from '../../../shared/http.js';
import type { DeathCause } from '../../../shared/types.js';
import type { AuditLogger } from '../audit/logger.js';

export interface HandleDeathOptions {
  now: number;
  player_id: string;
  map: MapName;
  x: number;
  y: number;
  cause: DeathCause;
  killer_id?: string | null;
  spawn: { x: number; y: number };
  audit: AuditLogger;
  applyRespawn: (spawn: { x: number; y: number }) => void;
  setDeadUntil: (ms: number) => void;
  adjustReputation: (delta: number) => void;
}

export interface DeathHandlingResult {
  respawn_in_ms: number;
  dead_until_ms: number;
  timer: NodeJS.Timeout;
}

function deathAliasForMap(map: MapName): string {
  const lower = map.toLowerCase();
  return `death_in_${lower}`;
}

export function handleDeath(opts: HandleDeathOptions): DeathHandlingResult {
  const respawn_in_ms = DEATH_RESPAWN_DELAY_MS;
  const dead_until_ms = opts.now + respawn_in_ms;
  const alias = deathAliasForMap(opts.map);
  const reputation_delta = -DEATH_REPUTATION_PENALTY;

  opts.audit.write({
    player_id: opts.player_id,
    action: 'death',
    inputs: {
      map: opts.map,
      position: { x: opts.x, y: opts.y },
      cause: opts.cause,
      killer_id: opts.killer_id ?? null,
    },
    result: 'dead',
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

  opts.setDeadUntil(dead_until_ms);

  if (reputation_delta !== 0) {
    opts.adjustReputation(reputation_delta);
  }

  opts.audit.write({
    player_id: opts.player_id,
    action: 'death_penalty_applied',
    inputs: {
      map: opts.map,
      dead_until_ms,
      respawn_in_ms,
      reputation_delta,
      cause: opts.cause,
      killer_id: opts.killer_id ?? null,
    },
    result: 'applied',
  });

  opts.audit.write({
    player_id: opts.player_id,
    action: 'respawn_started',
    inputs: {
      map: opts.map,
      respawn_at_ms: dead_until_ms,
      respawn_in_ms,
    },
    result: 'scheduled',
  });

  const timer = setTimeout(() => {
    opts.applyRespawn(opts.spawn);

    opts.audit.write({
      player_id: opts.player_id,
      action: 'respawn_completed',
      inputs: {
        map: opts.map,
        spawn: opts.spawn,
        cause: opts.cause,
      },
      result: 'ok',
    });
  }, respawn_in_ms);

  return { respawn_in_ms, dead_until_ms, timer };
}
