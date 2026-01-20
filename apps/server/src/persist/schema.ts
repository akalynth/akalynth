// Akalynth Persistence Schema
// Phase 2: Identity, Death, Reputation, World Objects, Items, Inventory

import type Database from 'better-sqlite3';

// ============================================================================
// Schema Version
// ============================================================================

export const SCHEMA_VERSION = 8;

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

// Phase 2: Items (immutable metadata)
const DDL_ITEMS = `
CREATE TABLE IF NOT EXISTS items (
  item_id           TEXT PRIMARY KEY,
  item_type         TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  genesis_receipt   TEXT NOT NULL UNIQUE,
  meta_json         TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(item_type);
`;

// Phase 2: Inventory projection (current inventory state)
const DDL_INVENTORY_ITEMS = `
CREATE TABLE IF NOT EXISTS inventory_items (
  item_id           TEXT PRIMARY KEY,
  owner_player_id   TEXT NOT NULL,
  slot              TEXT DEFAULT NULL,
  updated_at        TEXT NOT NULL,
  last_receipt      TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(item_id),
  FOREIGN KEY(owner_player_id) REFERENCES players(player_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_owner ON inventory_items(owner_player_id);
`;

// Phase 3: Legendary heat projection (current heat per item)
const DDL_LEGENDARY_HEAT = `
CREATE TABLE IF NOT EXISTS legendary_heat (
  item_id      TEXT PRIMARY KEY,
  heat         INTEGER NOT NULL,
  updated_at   TEXT NOT NULL,
  last_receipt TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES items(item_id)
);
CREATE INDEX IF NOT EXISTS idx_legendary_heat_heat ON legendary_heat(heat);
`;

// Phase 4: Chronicle events projection (civil records)
// Phase 4.4 E2: evidence_ref for death/item_lost/legendary_lost linkage
const DDL_CHRONICLE = `
CREATE TABLE IF NOT EXISTS chronicle_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id     TEXT NOT NULL,
  kind          TEXT NOT NULL,
  timestamp     TEXT NOT NULL,
  zone          TEXT DEFAULT NULL,
  x             INTEGER DEFAULT NULL,
  y             INTEGER DEFAULT NULL,
  entity_id     TEXT DEFAULT NULL,
  details_json  TEXT NOT NULL DEFAULT '{}',
  source_action TEXT NOT NULL,
  receipt_hash  TEXT NOT NULL,
  evidence_ref  TEXT DEFAULT NULL,
  FOREIGN KEY(player_id) REFERENCES players(player_id)
);
CREATE INDEX IF NOT EXISTS idx_chronicle_player_ts ON chronicle_events(player_id, timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_chronicle_kind ON chronicle_events(kind);
CREATE INDEX IF NOT EXISTS idx_chronicle_player_kind_ts ON chronicle_events(player_id, kind, timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_chronicle_receipt ON chronicle_events(receipt_hash);
-- Partial unique indexes for dedup (NULL-safe): one for entity_id present, one for absent
CREATE UNIQUE INDEX IF NOT EXISTS idx_chronicle_dedup_entity ON chronicle_events(player_id, receipt_hash, kind, entity_id) WHERE entity_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chronicle_dedup_no_entity ON chronicle_events(player_id, receipt_hash, kind) WHERE entity_id IS NULL;
`;

// Moderation v1: Report queue table
const DDL_MODERATION_REPORTS = `
CREATE TABLE IF NOT EXISTS moderation_reports (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id                 TEXT NOT NULL UNIQUE,
  reporter_id             TEXT NOT NULL,
  target_id               TEXT NOT NULL,
  reported_at             TEXT NOT NULL,
  receipt_hash            TEXT NOT NULL UNIQUE,

  -- Resolution fields
  status                  TEXT NOT NULL DEFAULT 'open',
  resolved_by             TEXT DEFAULT NULL,
  resolved_at             TEXT DEFAULT NULL,
  resolution              TEXT DEFAULT NULL,
  reason                  TEXT DEFAULT NULL,
  resolution_receipt_hash TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_mod_reports_status ON moderation_reports(status);
CREATE INDEX IF NOT EXISTS idx_mod_reports_target ON moderation_reports(target_id);
`;

// Phase 3.5: Player heat projection (current heat per player)
// NO FK constraint - avoids replay ordering issues when heat receipts arrive before player_created
const DDL_PLAYER_HEAT = `
CREATE TABLE IF NOT EXISTS player_heat (
  player_id        TEXT PRIMARY KEY,
  heat             INTEGER NOT NULL DEFAULT 0,
  penalty_until_ms INTEGER,
  last_tem_ms      INTEGER,
  updated_at       TEXT NOT NULL,
  last_receipt     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_player_heat_score ON player_heat(heat DESC);
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

  if (currentVersion > SCHEMA_VERSION) {
    throw new Error(
      `Schema version too new: db=${currentVersion} code=${SCHEMA_VERSION}. ` +
        'Upgrade server or rebuild DB.'
    );
  }

  if (currentVersion < SCHEMA_VERSION) {
    // Run migrations
    migrateSchema(db, currentVersion, SCHEMA_VERSION);
  }

  // Patch A: Force version alignment after all migrations
  // Ensures _meta.schema_version always equals SCHEMA_VERSION, even if
  // structural changes were applied earlier (e.g., indexes created in V5 DDL).
  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', String(SCHEMA_VERSION));
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
    case 2:
      migrateToV2(db);
      break;
    case 3:
      migrateToV3(db);
      break;
    case 4:
      migrateToV4(db);
      break;
    case 5:
      migrateToV5(db);
      break;
    case 6:
      migrateToV6(db);
      break;
    case 7:
      migrateToV7(db);
      break;
    case 8:
      migrateToV8(db);
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
  insertMeta.run('schema_version', '1');
  insertMeta.run('last_materialized_hash', '');
  insertMeta.run('last_materialized_offset', '0');
}

function migrateToV2(db: Database.Database): void {
  // Phase 2: Add items and inventory tables
  db.exec(DDL_ITEMS);
  db.exec(DDL_INVENTORY_ITEMS);

  // Update schema version
  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '2');
}

function migrateToV3(db: Database.Database): void {
  // Phase 3: Add legendary heat table
  db.exec(DDL_LEGENDARY_HEAT);

  // Update schema version
  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '3');
}

function migrateToV4(db: Database.Database): void {
  // Phase 3.2: Add index for protected slot queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inv_owner_slot ON inventory_items(owner_player_id, slot);`);

  // Update schema version
  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '4');
}

function migrateToV5(db: Database.Database): void {
  // Phase 4: Add chronicle_events table
  db.exec(DDL_CHRONICLE);

  // Update schema version
  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '5');
}

function migrateToV6(db: Database.Database): void {
  // Phase 4.4 E2: Add evidence_ref column to chronicle_events
  // For evidence linkage (death, item_lost, legendary_lost)
  // Check if column already exists (DDL may have been updated)
  const columns = db.prepare(`PRAGMA table_info(chronicle_events)`).all() as Array<{ name: string }>;
  const hasEvidenceRef = columns.some((c) => c.name === 'evidence_ref');

  if (!hasEvidenceRef) {
    db.exec(`ALTER TABLE chronicle_events ADD COLUMN evidence_ref TEXT DEFAULT NULL;`);
  }

  // Update schema version
  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '6');
}

function migrateToV7(db: Database.Database): void {
  // Placeholder migration (no schema change)
  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '7');
}

function migrateToV8(db: Database.Database): void {
  // Fix chronicle dedup index: NULL values in entity_id bypass UNIQUE constraint.
  // Replace single index with partial unique indexes for NULL-safe dedup.
  
  // Step 1: Delete duplicate rows (keep lowest id per unique tuple)
  db.exec(`
    DELETE FROM chronicle_events
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM chronicle_events
      GROUP BY player_id, receipt_hash, kind, COALESCE(entity_id, '')
    );
  `);

  // Step 2: Drop old broken index
  db.exec(`DROP INDEX IF EXISTS idx_chronicle_dedup;`);

  // Step 3: Create partial unique indexes
  // When entity_id is present
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chronicle_dedup_entity
    ON chronicle_events(player_id, receipt_hash, kind, entity_id)
    WHERE entity_id IS NOT NULL;
  `);
  // When entity_id is absent
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chronicle_dedup_no_entity
    ON chronicle_events(player_id, receipt_hash, kind)
    WHERE entity_id IS NULL;
  `);

  // Update schema version
  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '8');
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
  const tables = ['players', 'reputation_events', 'deaths', 'world_objects', 'items', 'inventory_items', 'legendary_heat', 'chronicle_events', 'moderation_reports'];
  const counts: Record<string, number> = {};

  for (const table of tables) {
    try {
      const row = db
        .prepare(`SELECT COUNT(*) as count FROM ${table}`)
        .get() as { count: number };
      counts[table] = row.count;
    } catch {
      // Table may not exist in older schema versions
      counts[table] = 0;
    }
  }

  return counts;
}
