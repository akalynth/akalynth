// Akalynth Persistence Schema
// Phase 2: Identity, Death, Reputation, World Objects, Items, Inventory

import type Database from 'better-sqlite3';

// ============================================================================
// Schema Version
// ============================================================================

export const SCHEMA_VERSION = 16;

// ============================================================================
// DDL Statements
// ============================================================================

const DDL_PLAYERS = `
CREATE TABLE IF NOT EXISTS players (
  player_id       TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  created_receipt TEXT NOT NULL UNIQUE,
  deleted_at      TEXT DEFAULT NULL,
  auth_method     TEXT NOT NULL DEFAULT 'guest',
  name_lower      TEXT
);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name_lower ON players(name_lower) WHERE deleted_at IS NULL;
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

// Phase 3.6: Durable anti-cheat enforcement memory
const DDL_PLAYER_ANTICHEAT_ENFORCEMENT = `
CREATE TABLE IF NOT EXISTS player_anticheat_enforcement (
  player_id          TEXT PRIMARY KEY,
  warn_count         INTEGER NOT NULL DEFAULT 0,
  tem_failed_count   INTEGER NOT NULL DEFAULT 0,
  throttle_count     INTEGER NOT NULL DEFAULT 0,
  kick_count         INTEGER NOT NULL DEFAULT 0,
  throttle_until_ms  INTEGER,
  updated_at         TEXT NOT NULL,
  last_receipt       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_player_anticheat_throttle ON player_anticheat_enforcement(throttle_until_ms);
CREATE INDEX IF NOT EXISTS idx_player_anticheat_kicks ON player_anticheat_enforcement(kick_count DESC);
`;

// Dialogue Contract v1: durable, replay-sourced NPC talk counter.
// Append-only event log; the nonce is COUNT(*) per (player, npc, tier).
// UNIQUE(receipt_hash) makes re-materialization idempotent (replay-safe).
// NO FK to players — avoids replay ordering issues if a talk receipt is
// materialized before player_created (mirrors player_heat).
const DDL_NPC_TALK_EVENTS = `
CREATE TABLE IF NOT EXISTS npc_talk_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id     TEXT NOT NULL,
  npc_id        TEXT NOT NULL,
  tier          TEXT NOT NULL,
  timestamp     TEXT NOT NULL,
  receipt_hash  TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_npc_talk_player_npc_tier ON npc_talk_events(player_id, npc_id, tier);
`;

// Property Registry v0: durable house ownership projection.
// owner_player_id NULL = treasury/unowned. Ownership, sale_count, and
// owner_history are receipt-derived (property_* actions). genesis_receipt
// UNIQUE makes property_created re-materialization idempotent.
// NO FK to players — a property receipt may materialize before player_created
// (mirrors player_heat rationale).
const DDL_PROPERTIES = `
CREATE TABLE IF NOT EXISTS properties (
  property_id        TEXT PRIMARY KEY,
  zone               TEXT NOT NULL,
  plot_id            TEXT NOT NULL,
  x                  INTEGER NOT NULL,
  y                  INTEGER NOT NULL,
  width              INTEGER NOT NULL,
  height             INTEGER NOT NULL,
  district           TEXT DEFAULT NULL,
  owner_player_id    TEXT DEFAULT NULL,
  status             TEXT NOT NULL DEFAULT 'unowned',
  listed_price_gold  INTEGER DEFAULT NULL,
  primary_price_gold INTEGER NOT NULL DEFAULT 0,
  purchased_at       TEXT DEFAULT NULL,
  sale_count         INTEGER NOT NULL DEFAULT 0,
  owner_history      TEXT NOT NULL DEFAULT '[]',
  genesis_receipt    TEXT NOT NULL UNIQUE,
  last_receipt       TEXT NOT NULL,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_properties_zone_status ON properties(zone, status);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_player_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_plot ON properties(zone, plot_id);
`;

// Property Auction Lane: durable mirror of the in-memory auction projection.
// One row per property (the current/latest auction), keyed like the projection's
// auctionByPropertyId map. Settled/cancelled rows are KEPT (status reflects it)
// and only overwritten when a NEW auction opens on the same plot. Receipts remain
// the source of truth; this table is a materialized mirror.
const DDL_PROPERTY_AUCTIONS = `
CREATE TABLE IF NOT EXISTS property_auctions (
  property_id        TEXT PRIMARY KEY,
  kind               TEXT NOT NULL,
  seller_id          TEXT DEFAULT NULL,
  min_bid            INTEGER NOT NULL,
  min_increment_gold INTEGER NOT NULL,
  current_high       INTEGER DEFAULT NULL,
  high_bidder_id     TEXT DEFAULT NULL,
  status             TEXT NOT NULL DEFAULT 'open',
  scheduled_close_ms INTEGER DEFAULT NULL,
  opened_receipt     TEXT NOT NULL,
  last_receipt       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_property_auctions_status ON property_auctions(status);
`;

// ============================================================================
// Account Platform v1 (E1): email-verified accounts.
//
// PII (email) and security material (Argon2id password hash, hashed tokens) live
// ONLY in these tables — NEVER in chronicle receipts. These tables are written
// directly by the account API (E2), not materialized from receipts. Every token
// column stores a HASH at rest; plaintext tokens exist only in transit/email.
// See docs/account-portal/AKALYNTH_ACCOUNT_PORTAL_PRODUCT_DECISION_V1/.
// ============================================================================
const DDL_ACCOUNTS = `
CREATE TABLE IF NOT EXISTS accounts (
  account_id      TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  email_lower     TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'registered_unverified',
  created_at      TEXT NOT NULL,
  created_receipt TEXT DEFAULT NULL,
  updated_at      TEXT DEFAULT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email_lower ON accounts(email_lower);
`;

const DDL_ACCOUNT_EMAIL_VERIFICATIONS = `
CREATE TABLE IF NOT EXISTS account_email_verifications (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_acct_email_verif_account ON account_email_verifications(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acct_email_verif_token ON account_email_verifications(token_hash);
`;

const DDL_ACCOUNT_SESSIONS = `
CREATE TABLE IF NOT EXISTS account_sessions (
  session_id   TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL,
  token_hash   TEXT NOT NULL,
  client       TEXT DEFAULT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT DEFAULT NULL,
  revoked_at   TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_acct_sessions_account ON account_sessions(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acct_sessions_token ON account_sessions(token_hash);
`;

const DDL_ACCOUNT_PASSWORD_RESETS = `
CREATE TABLE IF NOT EXISTS account_password_resets (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_acct_pw_resets_account ON account_password_resets(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acct_pw_resets_token ON account_password_resets(token_hash);
`;

// Account Platform v1 (E4): characters bound to an account. character_id is the
// player_id (the play entity); this table records the account linkage + the
// chosen world / sex / outfit. Additive — it does not modify the players table.
const DDL_ACCOUNT_CHARACTERS = `
CREATE TABLE IF NOT EXISTS account_characters (
  character_id    TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL,
  name            TEXT NOT NULL,
  world_id        TEXT NOT NULL,
  sex             TEXT NOT NULL,
  outfit_id       TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  created_receipt TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_characters_account ON account_characters(account_id);
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
    case 9:
      migrateToV9(db);
      break;
    case 10:
      migrateToV10(db);
      break;
    case 11:
      migrateToV11(db);
      break;
    case 12:
      migrateToV12(db);
      break;
    case 13:
      migrateToV13(db);
      break;
    case 14:
      migrateToV14(db);
      break;
    case 15:
      migrateToV15(db);
      break;
    case 16:
      migrateToV16(db);
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

function migrateToV9(db: Database.Database): void {
  // Phase 4.5: Add player_heat table
  db.exec(DDL_PLAYER_HEAT);

  // Update schema version
  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '9');
}

function migrateToV10(db: Database.Database): void {
  // Identity v0.1: Add auth_method and name_lower columns to players table
  // Enables named character creation with case-insensitive uniqueness

  // Check if auth_method column already exists (idempotent)
  const columns = db.prepare(`PRAGMA table_info(players)`).all() as Array<{ name: string }>;
  const hasAuthMethod = columns.some((c) => c.name === 'auth_method');
  const hasNameLower = columns.some((c) => c.name === 'name_lower');

  if (!hasAuthMethod) {
    db.exec(`ALTER TABLE players ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'guest';`);
  }

  if (!hasNameLower) {
    db.exec(`ALTER TABLE players ADD COLUMN name_lower TEXT;`);
    // Backfill existing rows
    db.exec(`UPDATE players SET name_lower = LOWER(name) WHERE name_lower IS NULL;`);
  }

  // Create unique index for case-insensitive name lookup (only for non-deleted players)
  // Idempotent: IF NOT EXISTS
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name_lower ON players(name_lower) WHERE deleted_at IS NULL;`);

  // Update schema version
  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '10');
}

function migrateToV11(db: Database.Database): void {
  // Phase 3.6: add durable anti-cheat enforcement state
  db.exec(DDL_PLAYER_ANTICHEAT_ENFORCEMENT);

  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '11');
}

function migrateToV12(db: Database.Database): void {
  // Dialogue Contract v1: durable NPC talk counter (seeds dialogue variation)
  db.exec(DDL_NPC_TALK_EVENTS);

  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '12');
}

function migrateToV13(db: Database.Database): void {
  // Property Ownership v0: durable house registry
  db.exec(DDL_PROPERTIES);

  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '13');
}

function migrateToV14(db: Database.Database): void {
  // Property Auction Lane: durable auction projection (additive — does not touch
  // the properties table or any existing rows).
  db.exec(DDL_PROPERTY_AUCTIONS);

  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '14');
}

function migrateToV15(db: Database.Database): void {
  // Account Platform v1 (E1): email-verified accounts + sessions +
  // verification/reset tokens (hashed at rest). Additive — does not touch any
  // existing table or row. No PII/secrets ever leave these tables for receipts.
  db.exec(DDL_ACCOUNTS);
  db.exec(DDL_ACCOUNT_EMAIL_VERIFICATIONS);
  db.exec(DDL_ACCOUNT_SESSIONS);
  db.exec(DDL_ACCOUNT_PASSWORD_RESETS);

  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '15');
}

function migrateToV16(db: Database.Database): void {
  // Account Platform v1 (E4): account_characters linkage. Additive — does not
  // touch players or any existing table.
  db.exec(DDL_ACCOUNT_CHARACTERS);

  const insertMeta = db.prepare(
    'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)'
  );
  insertMeta.run('schema_version', '16');
}

// ============================================================================
// Schema Utilities
// ============================================================================

export function resetSchema(db: Database.Database): void {
  // Drop all tables and recreate (for testing/recovery)
  db.exec('DROP TABLE IF EXISTS account_characters');
  db.exec('DROP TABLE IF EXISTS account_password_resets');
  db.exec('DROP TABLE IF EXISTS account_sessions');
  db.exec('DROP TABLE IF EXISTS account_email_verifications');
  db.exec('DROP TABLE IF EXISTS accounts');
  db.exec('DROP TABLE IF EXISTS properties');
  db.exec('DROP TABLE IF EXISTS npc_talk_events');
  db.exec('DROP TABLE IF EXISTS player_anticheat_enforcement');
  db.exec('DROP TABLE IF EXISTS player_heat');
  db.exec('DROP TABLE IF EXISTS chronicle_events');
  db.exec('DROP TABLE IF EXISTS legendary_heat');
  db.exec('DROP TABLE IF EXISTS inventory_items');
  db.exec('DROP TABLE IF EXISTS items');
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
  const tables = ['players', 'reputation_events', 'deaths', 'world_objects', 'items', 'inventory_items', 'legendary_heat', 'player_heat', 'player_anticheat_enforcement', 'chronicle_events', 'moderation_reports', 'npc_talk_events', 'properties'];
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
