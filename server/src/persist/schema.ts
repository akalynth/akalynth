// Akalynth Persistence Schema
// Phase 1: Identity, Death, Reputation, World Objects

import type Database from 'better-sqlite3';

// ============================================================================
// Schema Version
// ============================================================================

export const SCHEMA_VERSION = 1;

// ============================================================================
// DDL Statements
// ============================================================================

const DDL_PLAYERS = `
CREATE TABLE IF NOT EXISTS players (
  player_id       TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  created_receipt TEXT NOT NULL UNIQUE,
  deleted_at      TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
`;

const DDL_REPUTATION_EVENTS = `
CREATE TABLE IF NOT EXISTS reputation_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id       TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  delta           INTEGER NOT NULL,
  timestamp       TEXT NOT NULL,
  receipt_hash    TEXT NOT NULL UNIQUE,
  witnesses       TEXT DEFAULT NULL,
  context         TEXT DEFAULT NULL,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);
CREATE INDEX IF NOT EXISTS idx_rep_player_ts ON reputation_events(player_id, timestamp);
`;

const DDL_DEATHS = `
CREATE TABLE IF NOT EXISTS deaths (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id       TEXT NOT NULL,
  zone            TEXT NOT NULL,
  x               INTEGER NOT NULL,
  y               INTEGER NOT NULL,
  timestamp       TEXT NOT NULL,
  cause           TEXT NOT NULL,
  receipt_hash    TEXT NOT NULL UNIQUE,
  witnesses       TEXT DEFAULT NULL,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);
CREATE INDEX IF NOT EXISTS idx_deaths_player_ts ON deaths(player_id, timestamp);
`;

const DDL_WORLD_OBJECTS = `
CREATE TABLE IF NOT EXISTS world_objects (
  object_id       TEXT PRIMARY KEY,
  object_type     TEXT NOT NULL,
  zone            TEXT NOT NULL,
  x               INTEGER NOT NULL,
  y               INTEGER NOT NULL,
  created_at      TEXT NOT NULL,
  decay_at        TEXT DEFAULT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  owner_history   TEXT NOT NULL,
  last_receipt    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_objects_zone_status ON world_objects(zone, status);
CREATE INDEX IF NOT EXISTS idx_objects_zone_pos ON world_objects(zone, x, y);
`;

const DDL_META = `
CREATE TABLE IF NOT EXISTS _meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ============================================================================
// Schema Initialization
// ============================================================================

export function initSchema(db: Database.Database): void {
  // Set required pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Check current schema version
  const currentVersion = getSchemaVersion(db);

  if (currentVersion < SCHEMA_VERSION) {
    // Run migrations
    migrateSchema(db, currentVersion, SCHEMA_VERSION);
  }
}

function getSchemaVersion(db: Database.Database): number {
  try {
    // Check if _meta table exists
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='_meta'"
      )
      .get();

    if (!tableExists) {
      return 0;
    }

    const row = db
      .prepare('SELECT value FROM _meta WHERE key = ?')
      .get('schema_version') as { value: string } | undefined;

    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

function migrateSchema(
  db: Database.Database,
  fromVersion: number,
  toVersion: number
): void {
  // Run migrations in a transaction
  db.transaction(() => {
    for (let v = fromVersion + 1; v <= toVersion; v++) {
      runMigration(db, v);
    }
  })();
}

function runMigration(db: Database.Database, version: number): void {
  switch (version) {
    case 1:
      migrateToV1(db);
      break;
    default:
      throw new Error(`Unknown schema version: ${version}`);
  }
}

function migrateToV1(db: Database.Database): void {
  // Create all tables
  db.exec(DDL_PLAYERS);
  db.exec(DDL_REPUTATION_EVENTS);
  db.exec(DDL_DEATHS);
  db.exec(DDL_WORLD_OBJECTS);
  db.exec(DDL_META);

  // Initialize _meta keys
  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', String(SCHEMA_VERSION));
  insertMeta.run('last_materialized_hash', '');
  insertMeta.run('last_materialized_offset', '0');
}

// ============================================================================
// Schema Utilities
// ============================================================================

export function resetSchema(db: Database.Database): void {
  // Drop all tables and recreate (for testing/recovery)
  db.exec('DROP TABLE IF EXISTS world_objects');
  db.exec('DROP TABLE IF EXISTS deaths');
  db.exec('DROP TABLE IF EXISTS reputation_events');
  db.exec('DROP TABLE IF EXISTS players');
  db.exec('DROP TABLE IF EXISTS _meta');

  // Reinitialize
  migrateToV1(db);
}

export function getTableCounts(
  db: Database.Database
): Record<string, number> {
  const tables = ['players', 'reputation_events', 'deaths', 'world_objects'];
  const counts: Record<string, number> = {};

  for (const table of tables) {
    const row = db
      .prepare(`SELECT COUNT(*) as count FROM ${table}`)
      .get() as { count: number };
    counts[table] = row.count;
  }

  return counts;
}
