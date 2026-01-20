// Akalynth World Presence v0
// In-memory projection — source of truth is receipts
// The world witnesses. No rewards. No costs. No gameplay effects.

import type { AuditReceipt, PlaceId, MapData } from '../../../../packages/shared/types.js';
import {
  PRESENCE_ENTERED_ACTION,
  PRESENCE_LINGERED_ACTION,
  PRESENCE_OBSERVED_ACTION,
  PRESENCE_LINGER_THRESHOLD_MS,
  PRESENCE_OBSERVE_THRESHOLD_MS,
} from '../../../../packages/shared/types.js';
import type { MapName } from '../../../../packages/shared/http.js';

// ============================================================================
// Types
// ============================================================================

interface PlayerPresenceState {
  current_place: PlaceId | null;
  entered_at_ms: number | null;
  lingered_this_session: Set<PlaceId>;  // Places already lingered in this session
}

interface CoPresenceKey {
  place_id: PlaceId;
  player_a: string;
  player_b: string;
}

type WriteReceiptFn = (
  receipt: Omit<AuditReceipt, 'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'>
) => void;

// ============================================================================
// Place Definitions
// ============================================================================

// Place boundaries: map_name or map_name:landmark_name
// Boundaries are rectangular regions within maps

export interface PlaceBoundary {
  place_id: PlaceId;
  map: MapName;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Static place definitions (server config, not player-defined)
// For v0: whole maps are places, plus specific landmarks
const PLACE_BOUNDARIES: PlaceBoundary[] = [];

/**
 * Register place boundaries from map data.
 * Called once per map during server startup.
 */
export function registerMapPlaces(map: MapData, mapName: MapName): void {
  // The whole map is a place
  PLACE_BOUNDARIES.push({
    place_id: mapName.toLowerCase(),
    map: mapName,
    x: 0,
    y: 0,
    width: map.width,
    height: map.height,
  });

  // Guild hall is a place
  if (map.landmarks.guild_hall) {
    PLACE_BOUNDARIES.push({
      place_id: `${mapName.toLowerCase()}:guild_hall`,
      map: mapName,
      x: map.landmarks.guild_hall.x,
      y: map.landmarks.guild_hall.y,
      width: map.landmarks.guild_hall.width,
      height: map.landmarks.guild_hall.height,
    });
  }

  // Plaza is a place
  if (map.landmarks.plaza) {
    PLACE_BOUNDARIES.push({
      place_id: `${mapName.toLowerCase()}:plaza`,
      map: mapName,
      x: map.landmarks.plaza.x,
      y: map.landmarks.plaza.y,
      width: map.landmarks.plaza.width,
      height: map.landmarks.plaza.height,
    });
  }
}

/**
 * Determine which place a player is in (most specific first).
 * Returns null if not in any defined place.
 */
export function getPlaceAt(map: MapName, x: number, y: number): PlaceId | null {
  // Check specific landmarks first (more specific), then whole map (less specific)
  const specificPlaces = PLACE_BOUNDARIES.filter(
    (p) =>
      p.map === map &&
      p.place_id.includes(':') &&
      x >= p.x &&
      x < p.x + p.width &&
      y >= p.y &&
      y < p.y + p.height
  );

  if (specificPlaces.length > 0) {
    return specificPlaces[0].place_id;
  }

  // Fall back to whole map
  const mapPlace = PLACE_BOUNDARIES.find(
    (p) => p.map === map && !p.place_id.includes(':')
  );

  return mapPlace?.place_id ?? null;
}

// ============================================================================
// In-Memory Projection (receipt-derived)
// ============================================================================

// Player presence state
const presenceByPlayer = new Map<string, PlayerPresenceState>();

// Co-presence tracking: when players started sharing a place
// Key: "place_id|player_a|player_b" (sorted alphabetically)
const coPresenceStart = new Map<string, number>();

// Already observed pairs this session (to avoid spam)
const observedPairs = new Set<string>();

function makeCoPresenceKey(placeId: PlaceId, playerA: string, playerB: string): string {
  const sorted = [playerA, playerB].sort();
  return `${placeId}|${sorted[0]}|${sorted[1]}`;
}

function getPresence(playerId: string): PlayerPresenceState {
  let state = presenceByPlayer.get(playerId);
  if (!state) {
    state = {
      current_place: null,
      entered_at_ms: null,
      lingered_this_session: new Set(),
    };
    presenceByPlayer.set(playerId, state);
  }
  return state;
}

/**
 * Get current place for a player.
 */
export function getCurrentPlace(playerId: string): PlaceId | null {
  return getPresence(playerId).current_place;
}

/**
 * Check if player has lingered at a place this session.
 */
export function hasLingered(playerId: string, placeId: PlaceId): boolean {
  return getPresence(playerId).lingered_this_session.has(placeId);
}

/**
 * Check if player has been observed by anyone at this place.
 */
export function hasBeenObserved(playerId: string, placeId: PlaceId): boolean {
  const prefix = `${placeId}|`;
  for (const key of observedPairs) {
    if (key.startsWith(prefix) && key.includes(playerId)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all players currently in a place.
 */
export function getPlayersInPlace(placeId: PlaceId): string[] {
  const players: string[] = [];
  for (const [playerId, state] of presenceByPlayer) {
    if (state.current_place === placeId) {
      players.push(playerId);
    }
  }
  return players;
}

/**
 * Clear all presence state (for testing / fresh replay).
 */
export function clearPresenceProjection(): void {
  presenceByPlayer.clear();
  coPresenceStart.clear();
  observedPairs.clear();
  PLACE_BOUNDARIES.length = 0;
}

// ============================================================================
// Presence Lifecycle (Server-Only Triggers)
// ============================================================================

/**
 * Called when a player moves to a new position.
 * Emits presence_entered if place changed.
 */
export function onPlayerMoved(
  playerId: string,
  map: MapName,
  x: number,
  y: number,
  nowMs: number,
  writeReceipt: WriteReceiptFn
): void {
  const state = getPresence(playerId);
  const newPlace = getPlaceAt(map, x, y);

  // If place changed, emit presence_entered
  if (newPlace !== state.current_place) {
    // Leave old place (clear co-presence tracking)
    if (state.current_place) {
      clearCoPresenceForPlayer(playerId, state.current_place);
    }

    // Enter new place
    if (newPlace) {
      writeReceipt({
        actor_id: playerId,
        action: PRESENCE_ENTERED_ACTION,
        inputs: { place_id: newPlace },
        result: 'ok',
      });
    }

    state.current_place = newPlace;
    state.entered_at_ms = newPlace ? nowMs : null;
  }
}

/**
 * Called on server tick to check linger and observe thresholds.
 */
export function onPresenceTick(
  playerId: string,
  nowMs: number,
  writeReceipt: WriteReceiptFn
): void {
  const state = getPresence(playerId);
  if (!state.current_place || !state.entered_at_ms) return;

  const elapsed = nowMs - state.entered_at_ms;

  // Check linger threshold (once per place per session)
  if (elapsed >= PRESENCE_LINGER_THRESHOLD_MS && !state.lingered_this_session.has(state.current_place)) {
    writeReceipt({
      actor_id: playerId,
      action: PRESENCE_LINGERED_ACTION,
      inputs: {
        place_id: state.current_place,
        seconds: Math.floor(elapsed / 1000),
      },
      result: 'ok',
    });
    state.lingered_this_session.add(state.current_place);
  }

  // Check co-presence with other players
  const othersInPlace = getPlayersInPlace(state.current_place).filter((id) => id !== playerId);
  for (const otherId of othersInPlace) {
    checkCoPresence(playerId, otherId, state.current_place, nowMs, writeReceipt);
  }
}

/**
 * Check if two players have been in the same place long enough to observe each other.
 */
function checkCoPresence(
  playerA: string,
  playerB: string,
  placeId: PlaceId,
  nowMs: number,
  writeReceipt: WriteReceiptFn
): void {
  const key = makeCoPresenceKey(placeId, playerA, playerB);

  // Already observed this pair in this place this session
  if (observedPairs.has(key)) return;

  // Start tracking if not already
  if (!coPresenceStart.has(key)) {
    coPresenceStart.set(key, nowMs);
    return;
  }

  const startMs = coPresenceStart.get(key)!;
  const elapsed = nowMs - startMs;

  if (elapsed >= PRESENCE_OBSERVE_THRESHOLD_MS) {
    // Emit presence_observed for both players
    writeReceipt({
      actor_id: playerA,
      action: PRESENCE_OBSERVED_ACTION,
      inputs: { place_id: placeId, other_player_id: playerB },
      result: 'ok',
    });
    writeReceipt({
      actor_id: playerB,
      action: PRESENCE_OBSERVED_ACTION,
      inputs: { place_id: placeId, other_player_id: playerA },
      result: 'ok',
    });

    observedPairs.add(key);
  }
}

/**
 * Clear co-presence tracking when a player leaves a place.
 */
function clearCoPresenceForPlayer(playerId: string, placeId: PlaceId): void {
  const keysToRemove: string[] = [];
  for (const key of coPresenceStart.keys()) {
    if (key.startsWith(`${placeId}|`) && key.includes(playerId)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    coPresenceStart.delete(key);
  }
}

/**
 * Called when a player disconnects. Clears their presence state.
 */
export function onPlayerDisconnect(playerId: string): void {
  const state = presenceByPlayer.get(playerId);
  if (state?.current_place) {
    clearCoPresenceForPlayer(playerId, state.current_place);
  }
  presenceByPlayer.delete(playerId);
}

/**
 * Reset session-specific state (linger tracking, observed pairs).
 * Called when player re-enters world.
 */
export function resetSessionState(playerId: string): void {
  const state = getPresence(playerId);
  state.lingered_this_session.clear();
  state.current_place = null;
  state.entered_at_ms = null;

  // Clear observed pairs for this player
  const keysToRemove = Array.from(observedPairs).filter((key) => key.includes(playerId));
  for (const key of keysToRemove) {
    observedPairs.delete(key);
  }
}

// ============================================================================
// Receipt Reducer (Deterministic)
// ============================================================================

/**
 * Receipt reducer — call during replay loop and on new receipt write.
 * Idempotent: replay order determines truth.
 */
export function applyReceiptToPresence(receipt: AuditReceipt): void {
  const playerId = receipt.actor_id;
  if (!playerId) return;

  const state = getPresence(playerId);

  switch (receipt.action) {
    case PRESENCE_ENTERED_ACTION: {
      const placeId = receipt.inputs?.place_id as PlaceId | undefined;
      if (placeId) {
        state.current_place = placeId;
        const enteredAtMs = Date.parse(receipt.timestamp);
        state.entered_at_ms = Number.isNaN(enteredAtMs) ? null : enteredAtMs;
      }
      break;
    }

    case PRESENCE_LINGERED_ACTION: {
      const placeId = receipt.inputs?.place_id as PlaceId | undefined;
      if (placeId) {
        state.lingered_this_session.add(placeId);
      }
      break;
    }

    case PRESENCE_OBSERVED_ACTION: {
      const placeId = receipt.inputs?.place_id as PlaceId | undefined;
      const otherId = receipt.inputs?.other_player_id as string | undefined;
      if (placeId && otherId) {
        const key = makeCoPresenceKey(placeId, playerId, otherId);
        observedPairs.add(key);
      }
      break;
    }

    default:
      break;
  }
}
