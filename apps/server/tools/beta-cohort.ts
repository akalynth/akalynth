#!/usr/bin/env tsx
// Operator CLI for controlled Beta Player Readiness v1 cohorts.
//
// Cohort/invite rows are an operational admission ledger. Readiness,
// feedback, and gameplay measurements remain canonical receipt evidence.
// Raw invite codes are printed once for private delivery and are never logged
// to receipts or persisted.
import Database from 'better-sqlite3';
import path from 'node:path';
import { createAuditLogger } from '../src/audit/logger.js';
import { initSchema } from '../src/persist/schema.js';
import { RECEIPT_ACTIONS } from '../src/persist/types.js';
import { resolveChainPaths } from '../../../packages/shared/paths.js';
import { newId, newToken, hashToken } from '../src/account/tokens.js';
import { BetaStore } from '../src/beta/store.js';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const paths = resolveChainPaths(repoRoot);
const db = new Database(paths.dbPath);
initSchema(db);
const store = new BetaStore(db);

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function required(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function numberArg(name: string, fallback: number): number {
  const value = arg(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function isoAfterDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function audit() {
  return createAuditLogger({
    receiptPath: paths.receiptsPath,
    keyPath: paths.keyPath ?? undefined,
  });
}

try {
  const command = process.argv[2] ?? 'list';
  if (command === 'create') {
    const cohortId = required('cohort');
    const release = required('release');
    const rollback = arg('rollback');
    const platform = arg('platform') ?? 'web';
    if (platform !== 'web' && platform !== 'android' && platform !== 'mixed') {
      throw new Error('--platform must be web, android, or mixed');
    }
    const cap = numberArg('cap', 20);
    store.insertCohort({
      cohort_id: cohortId,
      release_commit: release,
      platform,
      invite_cap: cap,
      rollback_commit: rollback,
      created_at: new Date().toISOString(),
      opens_at: new Date().toISOString(),
      closes_at: null,
      created_by: process.env.USER ?? null,
    });
    console.log(JSON.stringify({
      ok: true,
      cohort_id: cohortId,
      release_commit: release,
      invite_cap: cap,
      rollback_commit: rollback,
    }, null, 2));
  } else if (command === 'issue') {
    const cohortId = required('cohort');
    const count = numberArg('count', 1);
    const expiresDays = numberArg('expires-days', 14);
    const logger = audit();
    try {
      const cohort = store.findCohort(cohortId);
      if (!cohort) throw new Error('cohort_not_found');
      const issued: Array<{
        invite_id: string;
        invite_code: string;
        invite_hint: string;
        cohort_id: string;
      }> = [];
      for (let index = 0; index < count; index += 1) {
        const code = newToken(24);
        const inviteId = newId('invite');
        const hint = code.slice(-8);
        store.issueInvite({
          invite_id: inviteId,
          cohort_id: cohortId,
          token_hash: hashToken(code),
          token_hint: hint,
          issued_at: new Date().toISOString(),
          expires_at: isoAfterDays(expiresDays),
        });
        logger.write({
          actor_id: 'beta_operator',
          action: RECEIPT_ACTIONS.BETA_INVITE_ISSUED,
          inputs: {
            invite_id: inviteId,
            cohort_id: cohortId,
            token_hint: hint,
            release_commit: cohort.release_commit,
          },
          result: 'issued',
        });
        issued.push({
          invite_id: inviteId,
          invite_code: code,
          invite_hint: hint,
          cohort_id: cohortId,
        });
      }
      console.log(JSON.stringify({
        ok: true,
        cohort_id: cohortId,
        expires_at: isoAfterDays(expiresDays),
        invites: issued,
      }, null, 2));
    } finally {
      logger.close();
    }
  } else if (command === 'revoke') {
    const inviteId = required('invite');
    const ok = store.revokeInvite(inviteId);
    console.log(JSON.stringify({ ok, invite_id: inviteId }));
  } else if (command === 'pause' || command === 'close' || command === 'open') {
    const cohortId = required('cohort');
    const status = command === 'pause'
      ? 'paused'
      : command === 'close'
        ? 'closed'
        : 'open';
    const ok = store.setCohortStatus(cohortId, status);
    console.log(JSON.stringify({ ok, cohort_id: cohortId, status }));
  } else if (command === 'triage') {
    const feedbackId = required('feedback');
    const status = required('status');
    const owner = required('owner');
    if (!['open', 'triaged', 'in_progress', 'fixed', 'closed'].includes(status)) {
      throw new Error('invalid feedback status');
    }
    if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(owner)) {
      throw new Error('invalid owner');
    }
    const logger = audit();
    try {
      logger.write({
        actor_id: 'beta_operator',
        action: RECEIPT_ACTIONS.BETA_FEEDBACK_TRIAGED,
        inputs: { feedback_id: feedbackId, status, owner },
        result: status,
      });
    } finally {
      logger.close();
    }
    console.log(JSON.stringify({
      ok: true,
      feedback_id: feedbackId,
      status,
      owner,
    }));
  } else if (command === 'list') {
    console.log(JSON.stringify(store.listCohorts(), null, 2));
  } else {
    throw new Error(`unknown command: ${command}`);
  }
} finally {
  db.close();
}
