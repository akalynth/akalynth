// Controlled beta operations store.
//
// Cohorts and invite credentials are operational configuration. Gameplay and
// player measurement remain receipt-backed; this store exists only to enforce
// invite caps and bind a redeemed invite to an opaque account id.
import type Database from 'better-sqlite3';
import type { BetaCohortRow, BetaInviteRow, BetaCohortStatus } from '../persist/types.js';
import type { BetaPlatform } from '../../../../packages/shared/http.js';
import { isSha256Hex } from './releaseManifest.js';

export interface BetaCohortSummary extends BetaCohortRow {
  issued_count: number;
  redeemed_count: number;
}

type ClaimResult =
  | { ok: true; invite: BetaInviteRow; cohort: BetaCohortRow }
  | { ok: false; reason: 'invalid' | 'expired' | 'revoked' | 'already_redeemed' | 'cohort_closed' | 'cohort_unbound' };

function manifestsBound(row: {
  release_manifest_sha256: string | null;
  rollback_manifest_sha256: string | null;
}): boolean {
  return isSha256Hex(row.release_manifest_sha256)
    && isSha256Hex(row.rollback_manifest_sha256);
}

export class BetaStore {
  constructor(private readonly db: Database.Database) {}

  insertCohort(row: {
    cohort_id: string;
    release_commit: string;
    release_manifest_sha256: string;
    platform: BetaPlatform;
    invite_cap: number;
    rollback_commit: string;
    rollback_manifest_sha256: string;
    created_at: string;
    opens_at: string | null;
    closes_at: string | null;
    created_by: string | null;
  }): void {
    if (!manifestsBound(row)) throw new Error('cohort_manifest_unbound');
    this.db.prepare(`
      INSERT INTO beta_cohorts
        (cohort_id, release_commit, release_manifest_sha256, platform, invite_cap,
         status, rollback_commit, rollback_manifest_sha256, created_at, opens_at,
         closes_at, created_by)
      VALUES
        (@cohort_id, @release_commit, @release_manifest_sha256, @platform,
         @invite_cap, 'open', @rollback_commit, @rollback_manifest_sha256,
         @created_at, @opens_at, @closes_at, @created_by)
    `).run(row);
  }

  findCohort(cohortId: string): BetaCohortRow | undefined {
    return this.db.prepare('SELECT * FROM beta_cohorts WHERE cohort_id = ?').get(cohortId) as BetaCohortRow | undefined;
  }

  assertCohortBoundToActiveRelease(
    cohortId: string,
    activeReleaseManifestSha256: string,
  ): BetaCohortRow {
    const cohort = this.findCohort(cohortId);
    if (!cohort) throw new Error('cohort_not_found');
    if (!manifestsBound(cohort)) throw new Error('cohort_manifest_unbound');
    if (cohort.release_manifest_sha256 !== activeReleaseManifestSha256) {
      throw new Error('active_release_manifest_mismatch');
    }
    return cohort;
  }

  listCohorts(): BetaCohortSummary[] {
    return this.db.prepare(`
      SELECT c.*,
             COUNT(i.invite_id) AS issued_count,
             COALESCE(SUM(CASE WHEN i.status = 'redeemed' THEN 1 ELSE 0 END), 0) AS redeemed_count
      FROM beta_cohorts c
      LEFT JOIN beta_invites i ON i.cohort_id = c.cohort_id
      GROUP BY c.cohort_id
      ORDER BY c.created_at DESC
    `).all() as BetaCohortSummary[];
  }

  setCohortStatus(
    cohortId: string,
    status: BetaCohortStatus,
    activeReleaseManifestSha256?: string,
  ): boolean {
    if (status === 'open') {
      if (!activeReleaseManifestSha256) {
        throw new Error('active_release_manifest_required');
      }
      this.assertCohortBoundToActiveRelease(
        cohortId,
        activeReleaseManifestSha256,
      );
    }
    const result = this.db.prepare('UPDATE beta_cohorts SET status = ? WHERE cohort_id = ?').run(status, cohortId);
    return result.changes === 1;
  }

  revokeInvite(inviteId: string): boolean {
    const result = this.db.prepare(`
      UPDATE beta_invites
      SET status = 'revoked'
      WHERE invite_id = ? AND status = 'issued'
    `).run(inviteId);
    return result.changes === 1;
  }

  issueInvite(row: {
    invite_id: string;
    cohort_id: string;
    token_hash: string;
    token_hint: string;
    issued_at: string;
    expires_at: string | null;
  }, activeReleaseManifestSha256: string): void {
    const issue = this.db.transaction(() => {
      const cohort = this.db.prepare(`
        SELECT invite_cap, status, release_manifest_sha256, rollback_manifest_sha256
        FROM beta_cohorts
        WHERE cohort_id = ?
      `).get(row.cohort_id) as {
        invite_cap: number;
        status: BetaCohortStatus;
        release_manifest_sha256: string | null;
        rollback_manifest_sha256: string | null;
      } | undefined;
      if (!cohort) throw new Error('cohort_not_found');
      if (!manifestsBound(cohort)) throw new Error('cohort_manifest_unbound');
      if (cohort.release_manifest_sha256 !== activeReleaseManifestSha256) {
        throw new Error('active_release_manifest_mismatch');
      }
      if (cohort.status !== 'open') throw new Error('cohort_not_open');
      const count = this.db.prepare(`SELECT COUNT(*) AS count FROM beta_invites WHERE cohort_id = ?`).get(row.cohort_id) as { count: number };
      if (count.count >= cohort.invite_cap) throw new Error('invite_cap_reached');
      this.db.prepare(`
        INSERT INTO beta_invites
          (invite_id, cohort_id, token_hash, token_hint, status, issued_at, expires_at)
        VALUES (@invite_id, @cohort_id, @token_hash, @token_hint, 'issued', @issued_at, @expires_at)
      `).run(row);
    });
    issue();
  }

  /**
   * Atomically consumes an issued invite. The returned cohort is the server's
   * cohort authority; the caller never trusts cohort data supplied by a client.
   */
  claimInvite(
    tokenHash: string,
    accountId: string,
    nowIso: string,
    activeReleaseManifestSha256: string,
    commitAccount?: () => void,
  ): ClaimResult {
    const claim = this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT i.*, c.release_commit, c.release_manifest_sha256, c.platform,
               c.invite_cap, c.status AS cohort_status, c.rollback_commit,
               c.rollback_manifest_sha256, c.created_at AS cohort_created_at,
               c.opens_at, c.closes_at, c.created_by
        FROM beta_invites i
        JOIN beta_cohorts c ON c.cohort_id = i.cohort_id
        WHERE i.token_hash = ?
      `).get(tokenHash) as (BetaInviteRow & {
        release_commit: string;
        release_manifest_sha256: string | null;
        platform: BetaPlatform;
        invite_cap: number;
        cohort_status: BetaCohortStatus;
        rollback_commit: string | null;
        rollback_manifest_sha256: string | null;
        cohort_created_at: string;
        opens_at: string | null;
        closes_at: string | null;
        created_by: string | null;
      }) | undefined;
      if (!row) return { ok: false, reason: 'invalid' as const };
      if (row.status === 'revoked') return { ok: false, reason: 'revoked' as const };
      if (row.status === 'redeemed' || row.account_id) return { ok: false, reason: 'already_redeemed' as const };
      if (row.expires_at && Date.parse(row.expires_at) <= Date.parse(nowIso)) return { ok: false, reason: 'expired' as const };
      if (row.cohort_status !== 'open') return { ok: false, reason: 'cohort_closed' as const };
      if (!manifestsBound(row)) return { ok: false, reason: 'cohort_unbound' as const };
      if (row.release_manifest_sha256 !== activeReleaseManifestSha256) {
        return { ok: false, reason: 'cohort_unbound' as const };
      }

      // Registration supplies its account insert here so account creation and
      // invite consumption share one SQLite commit. If either side throws or
      // loses its claim, neither side survives the transaction.
      commitAccount?.();
      const updated = this.db.prepare(`
        UPDATE beta_invites
        SET status = 'redeemed', redeemed_at = ?, account_id = ?
        WHERE token_hash = ? AND status = 'issued' AND account_id IS NULL
      `).run(nowIso, accountId, tokenHash);
      if (updated.changes !== 1) return { ok: false, reason: 'already_redeemed' as const };

      const invite: BetaInviteRow = {
        invite_id: row.invite_id,
        cohort_id: row.cohort_id,
        token_hash: row.token_hash,
        token_hint: row.token_hint,
        status: 'redeemed',
        issued_at: row.issued_at,
        expires_at: row.expires_at,
        redeemed_at: nowIso,
        account_id: accountId,
      };
      const cohort: BetaCohortRow = {
        cohort_id: row.cohort_id,
        release_commit: row.release_commit,
        release_manifest_sha256: row.release_manifest_sha256,
        platform: row.platform,
        invite_cap: row.invite_cap,
        status: row.cohort_status,
        rollback_commit: row.rollback_commit,
        rollback_manifest_sha256: row.rollback_manifest_sha256,
        created_at: row.cohort_created_at,
        opens_at: row.opens_at,
        closes_at: row.closes_at,
        created_by: row.created_by,
      };
      return { ok: true, invite, cohort } as const;
    });
    return claim() as ClaimResult;
  }

  cohortForAccount(accountId: string): (BetaInviteRow & { cohort: BetaCohortRow }) | undefined {
    const row = this.db.prepare(`
      SELECT i.*, c.release_commit, c.release_manifest_sha256, c.platform,
             c.invite_cap, c.status AS cohort_status, c.rollback_commit,
             c.rollback_manifest_sha256, c.created_at AS cohort_created_at,
             c.opens_at, c.closes_at, c.created_by
      FROM beta_invites i
      JOIN beta_cohorts c ON c.cohort_id = i.cohort_id
      WHERE i.account_id = ? AND i.status = 'redeemed'
      ORDER BY i.redeemed_at ASC
      LIMIT 1
    `).get(accountId) as (BetaInviteRow & {
      release_commit: string;
      release_manifest_sha256: string | null;
      platform: BetaPlatform;
      invite_cap: number;
      cohort_status: BetaCohortStatus;
      rollback_commit: string | null;
      rollback_manifest_sha256: string | null;
      cohort_created_at: string;
      opens_at: string | null;
      closes_at: string | null;
      created_by: string | null;
    }) | undefined;
    if (!row) return undefined;
    return {
      invite_id: row.invite_id,
      cohort_id: row.cohort_id,
      token_hash: row.token_hash,
      token_hint: row.token_hint,
      status: row.status,
      issued_at: row.issued_at,
      expires_at: row.expires_at,
      redeemed_at: row.redeemed_at,
      account_id: row.account_id,
      cohort: {
        cohort_id: row.cohort_id,
        release_commit: row.release_commit,
        release_manifest_sha256: row.release_manifest_sha256,
        platform: row.platform,
        invite_cap: row.invite_cap,
        status: row.cohort_status,
        rollback_commit: row.rollback_commit,
        rollback_manifest_sha256: row.rollback_manifest_sha256,
        created_at: row.cohort_created_at,
        opens_at: row.opens_at,
        closes_at: row.closes_at,
        created_by: row.created_by,
      },
    };
  }
}
