// Sovereign Echo v1 - Static visual presence on disconnect
// In-memory only. Despawns on new sovereign session or restart.

import type { PlayerPublic } from '../../../../packages/shared/types.js';
import { SOVEREIGN_ECHO_SPAWNED_ACTION, SOVEREIGN_ECHO_DESPAWNED_ACTION } from '../../../../packages/shared/types.js';
import type { MapName } from '../../../../packages/shared/http.js';

type AuditWriter = {
  write: (r: { player_id: string; action: string; inputs: Record<string, unknown>; result: string }) => void;
};

export type EchoCause = 'disconnect' | 'replaced' | 'restart';

export interface SovereignEcho {
  echo_id: string;         // Synthetic: "echo:" + owner_player_id
  owner_player_id: string; // Original sovereign player_id (for receipts)
  name: string;
  x: number;
  y: number;
  map: MapName;
}

let activeEcho: SovereignEcho | null = null;

/**
 * Spawn an Echo at the given position.
 * If an echo already exists, despawn it first with cause='replaced'.
 */
export function spawnEcho(
  ownerPlayerId: string,
  name: string,
  map: MapName,
  x: number,
  y: number,
  audit: AuditWriter
): { echo_id: string } {
  // Despawn any existing echo first
  if (activeEcho) {
    despawnEcho(audit, 'replaced');
  }

  const echo_id = `echo:${ownerPlayerId}`;

  activeEcho = {
    echo_id,
    owner_player_id: ownerPlayerId,
    name,
    x,
    y,
    map,
  };

  audit.write({
    player_id: ownerPlayerId,
    action: SOVEREIGN_ECHO_SPAWNED_ACTION,
    inputs: { echo_id, map, x, y, cause: 'disconnect' },
    result: 'ok',
  });

  return { echo_id };
}

/**
 * Despawn the active Echo if it exists.
 * Returns echo info for broadcast, or null if no echo.
 */
export function despawnEcho(
  audit: AuditWriter,
  cause: EchoCause
): { map: MapName; echo_id: string } | null {
  if (!activeEcho) return null;

  const result = { map: activeEcho.map, echo_id: activeEcho.echo_id };

  audit.write({
    player_id: activeEcho.owner_player_id,
    action: SOVEREIGN_ECHO_DESPAWNED_ACTION,
    inputs: { echo_id: activeEcho.echo_id, map: activeEcho.map, x: activeEcho.x, y: activeEcho.y, cause },
    result: 'ok',
  });

  activeEcho = null;
  return result;
}

/**
 * Get the active Echo if it exists and matches the given map.
 */
export function getEchoForMap(map: MapName): SovereignEcho | null {
  if (!activeEcho || activeEcho.map !== map) return null;
  return activeEcho;
}

/**
 * Check if an Echo exists (for despawn on sovereign login).
 */
export function hasActiveEcho(): boolean {
  return activeEcho !== null;
}

/**
 * Convert Echo to PlayerPublic for inclusion in nearby_players.
 */
export function echoToPublicPlayer(echo: SovereignEcho): PlayerPublic {
  return {
    id: echo.echo_id,    // Synthetic ID
    name: echo.name,
    x: echo.x,
    y: echo.y,
    status: 'alive',
    title: 'Echo of Sovereign',
    badges: ['echo'],
    mark: 'sovereign_echo',
  };
}
