// Runestone ritual system
// Server-authoritative casting with Tem-gated access

import { randomInt } from 'node:crypto';
import type { Element } from '../../../../packages/shared/types.js';
import { ELEMENTS } from '../../../../packages/shared/types.js';

const DEBUG_MODE = process.env.DEBUG === '1';
const RUNESTONE_TEST_FORCE_FACE = process.env.RUNESTONE_TEST_FORCE_FACE as Element | undefined;

export interface RunestoneTable {
  id: string;
  map: 'Rookguard' | 'Azura';
  x: number;
  y: number;
}

// Rookguard runestone table - near spawn, accessible during tutorial
export const ROOKGUARD_RUNESTONE_TABLE: RunestoneTable = {
  id: 'rookguard_runestone_table_01',
  map: 'Rookguard',
  x: 4,
  y: 4,
};

export const RUNESTONE_TABLES: RunestoneTable[] = [ROOKGUARD_RUNESTONE_TABLE];

export const RUNESTONE_COOLDOWN_MS = 2000;
export const RUNESTONE_BROADCAST_RADIUS = 8;

/**
 * Check if player is near (within radius tiles) of a runestone table.
 * Uses Manhattan distance for simplicity.
 */
export function isNearRunestoneTable(
  playerPos: { x: number; y: number },
  tablePos: { x: number; y: number },
  radius: number = 1
): boolean {
  const dx = Math.abs(playerPos.x - tablePos.x);
  const dy = Math.abs(playerPos.y - tablePos.y);
  return dx <= radius && dy <= radius;
}

/**
 * Roll a runestone face. Server-authoritative RNG.
 * In DEBUG mode with RUNESTONE_TEST_FORCE_FACE, returns forced face for testing.
 */
export function rollRunestoneFace(): Element {
  if (DEBUG_MODE && RUNESTONE_TEST_FORCE_FACE && ELEMENTS.includes(RUNESTONE_TEST_FORCE_FACE)) {
    return RUNESTONE_TEST_FORCE_FACE;
  }
  const index = randomInt(0, ELEMENTS.length);
  return ELEMENTS[index];
}

/**
 * Generate whisper text for a runestone result.
 */
export function runestoneWhisper(face: Element): string {
  const titleCase = face.charAt(0).toUpperCase() + face.slice(1);
  return `The stone exhales: ${titleCase}.`;
}

/**
 * Check if player has achieved Trinity of Shadow (3 consecutive shadow casts).
 * Returns true if trinity just achieved (first time only for this player).
 */
export function checkTrinityOfShadow(
  lastFaces: Element[],
  newFace: Element,
  trinityEmitted: Set<string>,
  playerId: string
): { isTrinity: boolean; updatedFaces: Element[] } {
  // Keep rolling window of last 3 faces
  const updated = [...lastFaces, newFace].slice(-3);

  // Check if we have 3 shadows and haven't emitted yet for this player
  const isTrinity =
    updated.length === 3 &&
    updated.every((f) => f === 'shadow') &&
    !trinityEmitted.has(playerId);

  if (isTrinity) {
    trinityEmitted.add(playerId);
  }

  return { isTrinity, updatedFaces: updated };
}

/**
 * Find runestone table by ID.
 */
export function findRunestoneTable(tableId: string): RunestoneTable | null {
  return RUNESTONE_TABLES.find((t) => t.id === tableId) ?? null;
}
