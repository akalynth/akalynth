#!/usr/bin/env tsx
/**
 * Focused migration matrix for the historical schema-v25 collision.
 *
 * Canonical v25 added account-character outfit colors. A divergent beta
 * lineage reused v25 for beta cohorts/invites. Canonical v26 must reconcile
 * either v25 shape, preserve existing rows, and remain idempotent.
 */
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { initSchema, SCHEMA_VERSION } from '../src/persist/schema.js';

const OUTFIT_DEFAULTS = {
  outfit_color_head: 5,
  outfit_color_body: 24,
  outfit_color_legs: 36,
  outfit_color_feet: 38,
} as const;

const CUSTOM_OUTFIT_COLORS = {
  outfit_color_head: 41,
  outfit_color_body: 42,
  outfit_color_legs: 43,
  outfit_color_feet: 44,
} as const;

type OutfitColors = typeof OUTFIT_DEFAULTS;

function withDatabase(run: (db: Database.Database) => void): void {
  const db = new Database(':memory:');
  try {
    run(db);
  } finally {
    db.close();
  }
}

function createMeta(db: Database.Database, version: number): void {
  db.exec(`
    CREATE TABLE _meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  db.prepare(`INSERT INTO _meta (key, value) VALUES ('schema_version', ?)`)
    .run(String(version));
}

function createAccountCharacters(
  db: Database.Database,
  withOutfitColors: boolean,
): void {
  const outfitColumns = withOutfitColors
    ? `,
      outfit_color_head INTEGER NOT NULL DEFAULT 5,
      outfit_color_body INTEGER NOT NULL DEFAULT 24,
      outfit_color_legs INTEGER NOT NULL DEFAULT 36,
      outfit_color_feet INTEGER NOT NULL DEFAULT 38`
    : '';

  db.exec(`
    CREATE TABLE account_characters (
      character_id    TEXT PRIMARY KEY,
      account_id      TEXT NOT NULL,
      name            TEXT NOT NULL,
      world_id        TEXT NOT NULL,
      sex             TEXT NOT NULL,
      outfit_id       TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      created_receipt TEXT DEFAULT NULL
      ${outfitColumns}
    );
    CREATE INDEX idx_account_characters_account
      ON account_characters(account_id);
  `);

  if (withOutfitColors) {
    db.prepare(`
      INSERT INTO account_characters (
        character_id, account_id, name, world_id, sex, outfit_id,
        created_at, created_receipt,
        outfit_color_head, outfit_color_body, outfit_color_legs,
        outfit_color_feet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'char-sentinel',
      'account-sentinel',
      'Sentinel',
      'rookguard',
      'male',
      'male_wanderer',
      '2026-07-09T00:00:00.000Z',
      'receipt-character-sentinel',
      CUSTOM_OUTFIT_COLORS.outfit_color_head,
      CUSTOM_OUTFIT_COLORS.outfit_color_body,
      CUSTOM_OUTFIT_COLORS.outfit_color_legs,
      CUSTOM_OUTFIT_COLORS.outfit_color_feet,
    );
    return;
  }

  db.prepare(`
    INSERT INTO account_characters (
      character_id, account_id, name, world_id, sex, outfit_id,
      created_at, created_receipt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'char-sentinel',
    'account-sentinel',
    'Sentinel',
    'rookguard',
    'male',
    'male_wanderer',
    '2026-07-09T00:00:00.000Z',
    'receipt-character-sentinel',
  );
}

function createBetaTablesWithSentinelRows(db: Database.Database): void {
  db.exec(`
    CREATE TABLE beta_cohorts (
      cohort_id       TEXT PRIMARY KEY,
      release_commit  TEXT NOT NULL,
      platform        TEXT NOT NULL DEFAULT 'web',
      invite_cap      INTEGER NOT NULL CHECK (invite_cap > 0),
      status          TEXT NOT NULL DEFAULT 'open',
      rollback_commit TEXT DEFAULT NULL,
      created_at      TEXT NOT NULL,
      opens_at        TEXT DEFAULT NULL,
      closes_at       TEXT DEFAULT NULL,
      created_by      TEXT DEFAULT NULL
    );
    CREATE INDEX idx_beta_cohorts_status ON beta_cohorts(status);

    CREATE TABLE beta_invites (
      invite_id   TEXT PRIMARY KEY,
      cohort_id   TEXT NOT NULL,
      token_hash  TEXT NOT NULL UNIQUE,
      token_hint  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'issued',
      issued_at   TEXT NOT NULL,
      expires_at  TEXT DEFAULT NULL,
      redeemed_at TEXT DEFAULT NULL,
      account_id  TEXT DEFAULT NULL,
      FOREIGN KEY (cohort_id) REFERENCES beta_cohorts(cohort_id)
    );
    CREATE INDEX idx_beta_invites_cohort_status
      ON beta_invites(cohort_id, status);
    CREATE UNIQUE INDEX idx_beta_invites_account
      ON beta_invites(account_id) WHERE account_id IS NOT NULL;
  `);

  db.prepare(`
    INSERT INTO beta_cohorts (
      cohort_id, release_commit, platform, invite_cap, status,
      rollback_commit, created_at, opens_at, closes_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'cohort-sentinel',
    'release-sentinel',
    'web',
    7,
    'closed',
    'rollback-sentinel',
    '2026-07-11T00:00:00.000Z',
    '2026-07-11T01:00:00.000Z',
    '2026-07-18T01:00:00.000Z',
    'operator-sentinel',
  );

  db.prepare(`
    INSERT INTO beta_invites (
      invite_id, cohort_id, token_hash, token_hint, status, issued_at,
      expires_at, redeemed_at, account_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'invite-sentinel',
    'cohort-sentinel',
    'hashed-token-sentinel',
    'sentinel',
    'redeemed',
    '2026-07-11T02:00:00.000Z',
    '2026-07-18T02:00:00.000Z',
    '2026-07-12T02:00:00.000Z',
    'account-sentinel',
  );
}

function createDdlCompatibleBetaTablesMissingRollbackCommit(
  db: Database.Database,
): void {
  db.exec(`
    CREATE TABLE beta_cohorts (
      cohort_id      TEXT PRIMARY KEY,
      release_commit TEXT NOT NULL,
      platform       TEXT NOT NULL DEFAULT 'web',
      invite_cap     INTEGER NOT NULL CHECK (invite_cap > 0),
      status         TEXT NOT NULL DEFAULT 'open',
      created_at     TEXT NOT NULL,
      opens_at       TEXT DEFAULT NULL,
      closes_at      TEXT DEFAULT NULL,
      created_by     TEXT DEFAULT NULL
    );

    CREATE TABLE beta_invites (
      invite_id   TEXT PRIMARY KEY,
      cohort_id   TEXT NOT NULL,
      token_hash  TEXT NOT NULL UNIQUE,
      token_hint  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'issued',
      issued_at   TEXT NOT NULL,
      expires_at  TEXT DEFAULT NULL,
      redeemed_at TEXT DEFAULT NULL,
      account_id  TEXT DEFAULT NULL,
      FOREIGN KEY (cohort_id) REFERENCES beta_cohorts(cohort_id)
    );
  `);
}

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(
    db.prepare(
      `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`,
    ).get(table),
  );
}

function tableColumns(
  db: Database.Database,
  table: string,
): Array<{ name: string; dflt_value: string | null }> {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
    dflt_value: string | null;
  }>;
}

function assertSchemaV26Contract(db: Database.Database): void {
  assert.equal(SCHEMA_VERSION, 26);
  const version = db.prepare(
    `SELECT value FROM _meta WHERE key = 'schema_version'`,
  ).get() as { value: string };
  assert.equal(version.value, '26');

  const characterColumns = new Map(
    tableColumns(db, 'account_characters')
      .map((column) => [column.name, column.dflt_value]),
  );
  for (const [column, defaultValue] of Object.entries(OUTFIT_DEFAULTS)) {
    assert.ok(characterColumns.has(column), `${column} must exist`);
    assert.equal(characterColumns.get(column), String(defaultValue));
  }

  const expectedBetaColumns = {
    beta_cohorts: [
      'cohort_id',
      'release_commit',
      'platform',
      'invite_cap',
      'status',
      'rollback_commit',
      'created_at',
      'opens_at',
      'closes_at',
      'created_by',
    ],
    beta_invites: [
      'invite_id',
      'cohort_id',
      'token_hash',
      'token_hint',
      'status',
      'issued_at',
      'expires_at',
      'redeemed_at',
      'account_id',
    ],
  } as const;
  for (const [table, expectedColumns] of Object.entries(expectedBetaColumns)) {
    assert.ok(tableExists(db, table), `${table} must exist`);
    const actualColumns = new Set(
      tableColumns(db, table).map((column) => column.name),
    );
    for (const column of expectedColumns) {
      assert.ok(actualColumns.has(column), `${table}.${column} must exist`);
    }
  }

  const cohortIndexes = new Set(
    (db.prepare(`PRAGMA index_list(beta_cohorts)`).all() as Array<{ name: string }>)
      .map((index) => index.name),
  );
  assert.ok(cohortIndexes.has('idx_beta_cohorts_status'));

  const inviteIndexes = db.prepare(
    `PRAGMA index_list(beta_invites)`,
  ).all() as Array<{ name: string; unique: number; partial: number }>;
  assert.ok(
    inviteIndexes.some((index) => index.name === 'idx_beta_invites_cohort_status'),
  );
  const accountIndex = inviteIndexes.find(
    (index) => index.name === 'idx_beta_invites_account',
  );
  assert.ok(accountIndex);
  assert.equal(accountIndex.unique, 1);
  assert.equal(accountIndex.partial, 1);

  const inviteForeignKeys = db.prepare(
    `PRAGMA foreign_key_list(beta_invites)`,
  ).all() as Array<{ table: string; from: string; to: string }>;
  assert.ok(
    inviteForeignKeys.some(
      (foreignKey) =>
        foreignKey.table === 'beta_cohorts'
        && foreignKey.from === 'cohort_id'
        && foreignKey.to === 'cohort_id',
    ),
  );

  assert.deepEqual(db.prepare(`PRAGMA foreign_key_check`).all(), []);
  const integrity = db.prepare(`PRAGMA integrity_check`).get() as {
    integrity_check: string;
  };
  assert.equal(integrity.integrity_check, 'ok');
}

function readOutfitColors(db: Database.Database): OutfitColors {
  return db.prepare(`
    SELECT
      outfit_color_head,
      outfit_color_body,
      outfit_color_legs,
      outfit_color_feet
    FROM account_characters
    WHERE character_id = 'char-sentinel'
  `).get() as OutfitColors;
}

function assertBetaSentinelRowsPreserved(db: Database.Database): void {
  const cohort = db.prepare(`
    SELECT
      cohort_id, release_commit, platform, invite_cap, status,
      rollback_commit, created_at, opens_at, closes_at, created_by
    FROM beta_cohorts
    WHERE cohort_id = 'cohort-sentinel'
  `).get();
  assert.deepEqual(cohort, {
    cohort_id: 'cohort-sentinel',
    release_commit: 'release-sentinel',
    platform: 'web',
    invite_cap: 7,
    status: 'closed',
    rollback_commit: 'rollback-sentinel',
    created_at: '2026-07-11T00:00:00.000Z',
    opens_at: '2026-07-11T01:00:00.000Z',
    closes_at: '2026-07-18T01:00:00.000Z',
    created_by: 'operator-sentinel',
  });

  const invite = db.prepare(`
    SELECT
      invite_id, cohort_id, token_hash, token_hint, status, issued_at,
      expires_at, redeemed_at, account_id
    FROM beta_invites
    WHERE invite_id = 'invite-sentinel'
  `).get();
  assert.deepEqual(invite, {
    invite_id: 'invite-sentinel',
    cohort_id: 'cohort-sentinel',
    token_hash: 'hashed-token-sentinel',
    token_hint: 'sentinel',
    status: 'redeemed',
    issued_at: '2026-07-11T02:00:00.000Z',
    expires_at: '2026-07-18T02:00:00.000Z',
    redeemed_at: '2026-07-12T02:00:00.000Z',
    account_id: 'account-sentinel',
  });
}

function assertEmptyBetaTables(db: Database.Database): void {
  const cohortCount = db.prepare(
    `SELECT COUNT(*) AS count FROM beta_cohorts`,
  ).get() as { count: number };
  const inviteCount = db.prepare(
    `SELECT COUNT(*) AS count FROM beta_invites`,
  ).get() as { count: number };
  assert.equal(cohortCount.count, 0);
  assert.equal(inviteCount.count, 0);
}

function verifyFreshDatabase(): void {
  withDatabase((db) => {
    initSchema(db);
    db.prepare(`
      INSERT INTO account_characters (
        character_id, account_id, name, world_id, sex, outfit_id,
        created_at, created_receipt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'char-sentinel',
      'account-sentinel',
      'Sentinel',
      'rookguard',
      'male',
      'male_wanderer',
      '2026-07-30T00:00:00.000Z',
      'receipt-character-sentinel',
    );
    initSchema(db);

    assertSchemaV26Contract(db);
    assert.deepEqual(readOutfitColors(db), OUTFIT_DEFAULTS);
    assertEmptyBetaTables(db);
  });
  console.log('PASS  fresh database -> schema v26');
}

function verifyV24Upgrade(): void {
  withDatabase((db) => {
    createMeta(db, 24);
    createAccountCharacters(db, false);

    initSchema(db);
    initSchema(db);

    assertSchemaV26Contract(db);
    assert.deepEqual(readOutfitColors(db), OUTFIT_DEFAULTS);
    assertEmptyBetaTables(db);
  });
  console.log('PASS  v24 -> outfit v25 -> beta v26');
}

function verifyOutfitOnlyV25Upgrade(): void {
  withDatabase((db) => {
    createMeta(db, 25);
    createAccountCharacters(db, true);

    initSchema(db);
    initSchema(db);

    assertSchemaV26Contract(db);
    assert.deepEqual(readOutfitColors(db), CUSTOM_OUTFIT_COLORS);
    assertEmptyBetaTables(db);
  });
  console.log('PASS  outfit-only v25 -> beta v26, custom colors preserved');
}

function verifyBetaOnlyV25Upgrade(): void {
  withDatabase((db) => {
    createMeta(db, 25);
    createAccountCharacters(db, false);
    createBetaTablesWithSentinelRows(db);

    initSchema(db);
    initSchema(db);

    assertSchemaV26Contract(db);
    assert.deepEqual(readOutfitColors(db), OUTFIT_DEFAULTS);
    assertBetaSentinelRowsPreserved(db);
  });
  console.log('PASS  beta-only v25 -> reconciled v26, beta rows preserved');
}

function verifyCombinedLiveV25Upgrade(): void {
  withDatabase((db) => {
    createMeta(db, 25);
    createAccountCharacters(db, true);
    createBetaTablesWithSentinelRows(db);

    initSchema(db);
    initSchema(db);

    assertSchemaV26Contract(db);
    assert.deepEqual(readOutfitColors(db), CUSTOM_OUTFIT_COLORS);
    assertBetaSentinelRowsPreserved(db);
  });
  console.log('PASS  combined live-style v25 -> v26 without row mutation');
}

function verifyFailedUpgradeRollsBack(): void {
  withDatabase((db) => {
    createMeta(db, 24);
    createAccountCharacters(db, false);
    db.exec(`
      CREATE TABLE beta_cohorts (
        cohort_id TEXT PRIMARY KEY
      );
    `);

    assert.throws(() => initSchema(db), /no such column: status/);

    const version = db.prepare(
      `SELECT value FROM _meta WHERE key = 'schema_version'`,
    ).get() as { value: string };
    assert.equal(version.value, '24');
    const columns = new Set(
      tableColumns(db, 'account_characters').map((column) => column.name),
    );
    for (const column of Object.keys(OUTFIT_DEFAULTS)) {
      assert.equal(columns.has(column), false);
    }
    assert.equal(tableExists(db, 'beta_invites'), false);
  });
  console.log('PASS  failed v24 -> v26 upgrade rolls back atomically');
}

function verifyFailedPostconditionRollsBack(): void {
  withDatabase((db) => {
    createMeta(db, 25);
    createAccountCharacters(db, true);
    createDdlCompatibleBetaTablesMissingRollbackCommit(db);

    assert.throws(
      () => initSchema(db),
      /Schema v26 shape invalid: missing=\[beta_cohorts\.rollback_commit\]/,
    );

    const version = db.prepare(
      `SELECT value FROM _meta WHERE key = 'schema_version'`,
    ).get() as { value: string };
    assert.equal(version.value, '25');
    assert.deepEqual(readOutfitColors(db), CUSTOM_OUTFIT_COLORS);

    const createdIndexes = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
        AND name IN (
          'idx_beta_cohorts_status',
          'idx_beta_invites_cohort_status',
          'idx_beta_invites_account'
        )
    `).all();
    assert.deepEqual(createdIndexes, []);
  });
  console.log('PASS  failed v26 postcondition rolls back version and indexes');
}

function verifyMalformedIndexFailsClosed(): void {
  withDatabase((db) => {
    createMeta(db, 25);
    createAccountCharacters(db, true);
    createBetaTablesWithSentinelRows(db);
    db.exec(`
      DROP INDEX idx_beta_invites_account;
      CREATE INDEX idx_beta_invites_account
        ON beta_invites(cohort_id);
    `);

    assert.throws(
      () => initSchema(db),
      /Schema v26 shape invalid: missing=\[index:idx_beta_invites_account,predicate:idx_beta_invites_account\]/,
    );

    const version = db.prepare(
      `SELECT value FROM _meta WHERE key = 'schema_version'`,
    ).get() as { value: string };
    assert.equal(version.value, '25');
    assertBetaSentinelRowsPreserved(db);

    const malformedIndex = (
      db.prepare(`PRAGMA index_list(beta_invites)`).all() as Array<{
        name: string;
        unique: number;
        partial: number;
      }>
    ).find((index) => index.name === 'idx_beta_invites_account');
    assert.ok(malformedIndex);
    assert.equal(malformedIndex.unique, 0);
    assert.equal(malformedIndex.partial, 0);
  });
  console.log('PASS  malformed named index fails closed at schema v25');
}

function verifyWrongAccountIndexPredicateFailsClosed(): void {
  withDatabase((db) => {
    createMeta(db, 25);
    createAccountCharacters(db, true);
    createBetaTablesWithSentinelRows(db);
    db.exec(`
      DROP INDEX idx_beta_invites_account;
      CREATE UNIQUE INDEX idx_beta_invites_account
        ON beta_invites(account_id)
        WHERE account_id IS NOT NULL AND status = 'redeemed';
    `);

    assert.throws(
      () => initSchema(db),
      /Schema v26 shape invalid: missing=\[predicate:idx_beta_invites_account\]/,
    );

    const version = db.prepare(
      `SELECT value FROM _meta WHERE key = 'schema_version'`,
    ).get() as { value: string };
    assert.equal(version.value, '25');
    assertBetaSentinelRowsPreserved(db);
  });
  console.log('PASS  weakened account-index predicate fails closed at schema v25');
}

function verifyOrphanInviteFailsClosed(): void {
  withDatabase((db) => {
    db.pragma('foreign_keys = OFF');
    createMeta(db, 25);
    createAccountCharacters(db, true);
    createBetaTablesWithSentinelRows(db);
    db.prepare(`
      INSERT INTO beta_invites (
        invite_id, cohort_id, token_hash, token_hint, status, issued_at,
        expires_at, redeemed_at, account_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'invite-orphan',
      'cohort-missing',
      'hashed-token-orphan',
      'orphan',
      'issued',
      '2026-07-11T03:00:00.000Z',
      null,
      null,
      null,
    );

    assert.throws(
      () => initSchema(db),
      /Schema v26 shape invalid: missing=\[foreign_key_violation:beta_invites\]/,
    );

    const version = db.prepare(
      `SELECT value FROM _meta WHERE key = 'schema_version'`,
    ).get() as { value: string };
    assert.equal(version.value, '25');
    const orphanCount = db.prepare(`
      SELECT COUNT(*) AS count
      FROM beta_invites
      WHERE invite_id = 'invite-orphan'
    `).get() as { count: number };
    assert.equal(orphanCount.count, 1);
  });
  console.log('PASS  orphan invite fails closed at schema v25');
}

verifyFreshDatabase();
verifyV24Upgrade();
verifyOutfitOnlyV25Upgrade();
verifyBetaOnlyV25Upgrade();
verifyCombinedLiveV25Upgrade();
verifyFailedUpgradeRollsBack();
verifyFailedPostconditionRollsBack();
verifyMalformedIndexFailsClosed();
verifyWrongAccountIndexPredicateFailsClosed();
verifyOrphanInviteFailsClosed();

console.log('[verify-schema-v26-recovery] all migration matrix checks passed');
