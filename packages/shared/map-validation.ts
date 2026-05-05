import { TileCode, WALKABLE_TILES, type MapData } from './types.js';

export const DRAFT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateDraftId(id: string): ValidationResult {
  const errors: string[] = [];
  if (!DRAFT_ID_PATTERN.test(id)) {
    errors.push('draft_id must match /^[a-z0-9][a-z0-9-]{0,63}$/');
  }
  if (id.includes('/') || id.includes('\\') || id.includes('.') || id.includes('..')) {
    errors.push('draft_id must not contain path traversal characters');
  }
  return { ok: errors.length === 0, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value > 0;
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number';
}

const KNOWN_TILE_CODES = new Set<number>(
  Object.values(TileCode).filter((value): value is number => typeof value === 'number')
);

export function validateMapData(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ['map must be an object'] };
  }

  const width = value.width;
  const height = value.height;
  const tiles = value.tiles;
  const spawn = value.spawn;

  if (!isPositiveInteger(width)) errors.push('width must be a positive integer');
  if (!isPositiveInteger(height)) errors.push('height must be a positive integer');
  if (!Array.isArray(tiles)) errors.push('tiles must be an array');

  if (isPositiveInteger(width) && isPositiveInteger(height) && Array.isArray(tiles)) {
    const expected = width * height;
    if (tiles.length !== expected) {
      errors.push(`tiles.length must equal width * height (${expected})`);
    }
    tiles.forEach((tile, index) => {
      if (!isInteger(tile) || !KNOWN_TILE_CODES.has(tile)) {
        errors.push(`tiles[${index}] must be a known TileCode`);
      }
    });
  }

  if (!isRecord(spawn)) {
    errors.push('spawn must be an object');
  } else {
    const x = spawn.x;
    const y = spawn.y;
    if (!isInteger(x)) errors.push('spawn.x must be an integer');
    if (!isInteger(y)) errors.push('spawn.y must be an integer');
    if (isInteger(x) && isInteger(y) && isPositiveInteger(width) && isPositiveInteger(height)) {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        errors.push('spawn must be inside map bounds');
      } else if (Array.isArray(tiles) && tiles.length === width * height) {
        const tile = tiles[y * width + x];
        if (!WALKABLE_TILES.has(tile)) {
          errors.push('spawn tile must be walkable');
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidMapData(value: unknown): asserts value is MapData {
  const result = validateMapData(value);
  if (!result.ok) {
    throw new Error(result.errors.join('; '));
  }
}
