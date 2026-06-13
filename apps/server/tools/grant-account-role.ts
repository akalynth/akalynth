#!/usr/bin/env tsx
/**
 * Grant (replace) the roles on a web account — operator-run CLI for the operator
 * Codex gate (AKALYNTH_OPERATOR_CODEX_GATE_V1). No web UI by design.
 *
 * Roles drive forward_auth access to /operator|/builder|/agent (see
 * SURFACE_ROLE_MAP in src/account/service.ts). This REPLACES the account's roles.
 *
 * Usage:
 *   AKALYNTH_DB_PATH=/path/to/akalynth.db \
 *     tsx tools/grant-account-role.ts <email> <role> [<role> ...]
 *
 * Roles: admin | operator | builder | agent | player
 * Safe to run while the server is up (SQLite WAL allows a concurrent writer).
 */
import path from 'node:path';
import Database from 'better-sqlite3';
import { initSchema } from '../src/persist/schema.js';
import { AccountStore } from '../src/account/store.js';

const KNOWN_ROLES = new Set(['admin', 'operator', 'builder', 'agent', 'player']);

function fail(msg: string): never {
  console.error(`grant-account-role: ${msg}`);
  process.exit(1);
}

function main(): void {
  const [emailArg, ...roleArgs] = process.argv.slice(2);
  if (!emailArg || roleArgs.length === 0) {
    fail('usage: AKALYNTH_DB_PATH=... tsx tools/grant-account-role.ts <email> <role> [<role> ...]');
  }
  const roles = [...new Set(roleArgs.map((r) => r.trim().toLowerCase()))];
  const unknown = roles.filter((r) => !KNOWN_ROLES.has(r));
  if (unknown.length) fail(`unknown role(s): ${unknown.join(', ')} (known: ${[...KNOWN_ROLES].join(', ')})`);

  const dbEnv = process.env.AKALYNTH_DB_PATH;
  if (!dbEnv) fail('set AKALYNTH_DB_PATH to the live SQLite DB path before running');
  const dbPath = path.resolve(dbEnv);

  const db = new Database(dbPath);
  initSchema(db); // idempotent: ensures the roles column (schema v20) exists
  const store = new AccountStore(db);

  const acct = store.findByEmailLower(emailArg.trim().toLowerCase());
  if (!acct) fail(`no account for email: ${emailArg}`);

  store.setRoles(acct!.account_id, JSON.stringify(roles), new Date().toISOString());
  db.close();

  console.log(`[grant-account-role] db=${dbPath}`);
  console.log(`[grant-account-role] account_id=${acct!.account_id} roles=${JSON.stringify(roles)}`);
  console.log('[grant-account-role] ok');
}

main();
