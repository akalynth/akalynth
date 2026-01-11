// Akalynth Persistence Queries
// Read operations for Phase 1: Players, Reputation, Deaths, World Objects

import type Database from 'better-sqlite3';
import type {
  PlayerRow,
  ReputationEventRow,
  DeathRow,
  WorldObjectRow,
} from './types.js';

// ============================================================================
// Player Queries
// ============================================================================

export function getPlayer(
  db: Database.Database,
  playerId: string
): PlayerRow | null {
  const stmt = db.prepare(`
    SELECT player_id, name, created_at, created_receipt, deleted_at
    FROM players
    WHERE player_id = ?
  `);
  return (stmt.get(playerId) as PlayerRow) ?? null;
}

export function getPlayerByName(
  db: Database.Database,
  name: string
): PlayerRow | null {
  const stmt = db.prepare(`
    SELECT player_id, name, created_at, created_receipt, deleted_at
    FROM players
    WHERE name = ? AND deleted_at IS NULL
  `);
  return (stmt.get(name) as PlayerRow) ?? null;
}

export function getPlayerCount(db: Database.Database): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM players WHERE deleted_at IS NULL
  `);
  const row = stmt.get() as { count: number };
  return row.count;
}

// ============================================================================
// Reputation Queries
// ============================================================================

export function getReputationScore(
  db: Database.Database,
  playerId: string
): number {
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(delta), 0) as score
    FROM reputation_events
    WHERE player_id = ?
  `);
  const row = stmt.get(playerId) as { score: number };
  return row.score;
}

export function getReputationEvents(
  db: Database.Database,
  playerId: string,
  limit?: number
): ReputationEventRow[] {
  const sql = limit
    ? `SELECT * FROM reputation_events WHERE player_id = ? ORDER BY timestamp DESC LIMIT ?`
    : `SELECT * FROM reputation_events WHERE player_id = ? ORDER BY timestamp DESC`;

  const stmt = db.prepare(sql);
  const rows = limit ? stmt.all(playerId, limit) : stmt.all(playerId);
  return rows as ReputationEventRow[];
}

// ============================================================================
// Death Queries
// ============================================================================

export function getDeathCount(
  db: Database.Database,
  playerId: string
): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM deaths WHERE player_id = ?
  `);
  const row = stmt.get(playerId) as { count: number };
  return row.count;
}

export function getLastDeath(
  db: Database.Database,
  playerId: string
): DeathRow | null {
  const stmt = db.prepare(`
    SELECT * FROM deaths
    WHERE player_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  return (stmt.get(playerId) as DeathRow) ?? null;
}

export function getDeaths(
  db: Database.Database,
  playerId: string,
  limit?: number
): DeathRow[] {
  const sql = limit
    ? `SELECT * FROM deaths WHERE player_id = ? ORDER BY timestamp DESC LIMIT ?`
    : `SELECT * FROM deaths WHERE player_id = ? ORDER BY timestamp DESC`;

  const stmt = db.prepare(sql);
  const rows = limit ? stmt.all(playerId, limit) : stmt.all(playerId);
  return rows as DeathRow[];
}

export function getTotalDeathCount(db: Database.Database): number {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM deaths`);
  const row = stmt.get() as { count: number };
  return row.count;
}

// ============================================================================
// World Object Queries
// ============================================================================

export function getWorldObjects(
  db: Database.Database,
  zone: string
): WorldObjectRow[] {
  const stmt = db.prepare(`
    SELECT * FROM world_objects
    WHERE zone = ? AND status = 'active'
  `);
  return stmt.all(zone) as WorldObjectRow[];
}

export function getWorldObject(
  db: Database.Database,
  objectId: string
): WorldObjectRow | null {
  const stmt = db.prepare(`
    SELECT * FROM world_objects WHERE object_id = ?
  `);
  return (stmt.get(objectId) as WorldObjectRow) ?? null;
}

export function getActiveObjectCount(db: Database.Database): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM world_objects WHERE status = 'active'
  `);
  const row = stmt.get() as { count: number };
  return row.count;
}

// ============================================================================
// Meta Queries
// ============================================================================

export function getMeta(
  db: Database.Database,
  key: string
): string | null {
  const stmt = db.prepare(`SELECT value FROM _meta WHERE key = ?`);
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(
  db: Database.Database,
  key: string,
  value: string
): void {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  stmt.run(key, value);
}

export function getSchemaVersion(db: Database.Database): number {
  const version = getMeta(db, 'schema_version');
  return version ? parseInt(version, 10) : 0;
}
