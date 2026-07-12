// Sovereign Echo v1 - Static visual presence on disconnect
// In-memory only. Despawns on new sovereign session or restart.
import { SOVEREIGN_ECHO_SPAWNED_ACTION, SOVEREIGN_ECHO_DESPAWNED_ACTION } from '../../../../packages/shared/types.js';
let activeEcho = null;
/**
 * Spawn an Echo at the given position.
 * If an echo already exists, despawn it first with cause='replaced'.
 */
export function spawnEcho(ownerPlayerId, name, map, x, y, audit) {
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
        actor_id: ownerPlayerId,
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
export function despawnEcho(audit, cause) {
    if (!activeEcho)
        return null;
    const result = { map: activeEcho.map, echo_id: activeEcho.echo_id };
    audit.write({
        actor_id: activeEcho.owner_player_id,
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
export function getEchoForMap(map) {
    if (!activeEcho || activeEcho.map !== map)
        return null;
    return activeEcho;
}
/**
 * Check if an Echo exists (for despawn on sovereign login).
 */
export function hasActiveEcho() {
    return activeEcho !== null;
}
/**
 * Convert Echo to PlayerPublic for inclusion in nearby_players.
 */
export function echoToPublicPlayer(echo) {
    return {
        id: echo.echo_id, // Synthetic ID
        name: echo.name,
        x: echo.x,
        y: echo.y,
        status: 'alive',
        title: 'Echo of Sovereign',
        badges: ['echo'],
        mark: 'sovereign_echo',
    };
}
