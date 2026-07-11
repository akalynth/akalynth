// Controlled beta operations store.
//
// Cohorts and invite credentials are operational configuration. Gameplay and
// player measurement remain receipt-backed; this store exists only to enforce
// invite caps and bind a redeemed invite to an opaque account id.
import type Database from 'better-sqlite3';
import type { BetaCohortRow, BetaInviteRow, BetaCohortStatus } from '../persist/types.js';
import type { BetaPlatform } from '../../../../packages/shared/http.js';

export interface BetaCohortSummary extends BetaCohortRow {
  issued_count: number;
  redeemed_count: number;
}

type ClaimResult =
  | { ok: true; invite: BetaInviteRow; cohort: BetaCohortRow }
  | { ok: false; reason: 'invalid' | 'expired' | 'revoked' | 'already_redeemed' | 'cohort_closed' };

export class BetaStore {
  constructor(private readonly db: Database.Database) {}

  insertCohort(row: {
    cohort_id: string;
    release_commit: string;
    platform: BetaPlatform;
    invite_cap: number;
    rollback_commit: string | null;
    created_at: string;
    opens_at: string | null;
    closes_at: string | null;
    created_by: string | null;
  }): void {
    this.db.prepare(`
      INSERT INTO beta_cohorts
        (cohort_id, release_commit, platform, invite_cap, status, rollback_commit,
         created_at, opens_at, closes_at, created_by)
      VALUES
        (@cohort_id, @release_commit, @platform, @invite_cap, 'open', @rollback_commit,
         @created_at, @opens_at, @closes_at, @created_by)
    `).run(row);
  }

  findCohort(cohortId: string): BetaCohortRow | undefined {
    return this.db.prepare('SELECT * FROM beta_cohorts WHERE cohort_id = ?').get(cohortId) as BetaCohortRow | undefined;
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

  setCohortStatus(cohortId: string, status: BetaCohortStatus): boolean {
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
  }): void {
    const issue = this.db.transaction(() => {
      const cohort = this.db.prepare('SELECT invite_cap, status FROM beta_cohorts WHERE cohort_id = ?').get(row.cohort_id) as { invite_cap: number; status: BetaCohortStatus } | undefined;
      if (!cohort) throw new Error('cohort_not_found');
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
  claimInvite(tokenHash: string, accountId: string, nowIso: string):
    | { ok: true; invite: BetaInviteRow; cohort: BetaCohortRow }
    | { ok: false; reason: 'invalid' | 'expired' | 'revoked' | 'already_redeemed' | 'cohort_closed' } {
    const claim = this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT i.*, c.release_commit, c.platform, c.invite_cap, c.status AS cohort_status,
               c.rollback_commit, c.created_at AS cohort_created_at, c.opens_at, c.closes_at,
               c.created_by
        FROM beta_invites i
        JOIN beta_cohorts c ON c.cohort_id = i.cohort_id
        WHERE i.token_hash = ?
      `).get(tokenHash) as (BetaInviteRow & {
        release_commit: string;
        platform: BetaPlatform;
        invite_cap: number;
        cohort_status: BetaCohortStatus;
        rollback_commit: string | null;
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
        platform: row.platform,
        invite_cap: row.invite_cap,
        status: row.cohort_status,
        rollback_commit: row.rollback_commit,
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
      SELECT i.*, c.release_commit, c.platform, c.invite_cap, c.status AS cohort_status,
             c.rollback_commit, c.created_at AS cohort_created_at, c.opens_at, c.closes_at,
             c.created_by
      FROM beta_invites i
      JOIN beta_cohorts c ON c.cohort_id = i.cohort_id
      WHERE i.account_id = ? AND i.status = 'redeemed'
      ORDER BY i.redeemed_at ASC
      LIMIT 1
    `).get(accountId) as (BetaInviteRow & {
      release_commit: string;
      platform: BetaPlatform;
      invite_cap: number;
      cohort_status: BetaCohortStatus;
      rollback_commit: string | null;
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
        platform: row.platform,
        invite_cap: row.invite_cap,
        status: row.cohort_status,
        rollback_commit: row.rollback_commit,
        created_at: row.cohort_created_at,
        opens_at: row.opens_at,
        closes_at: row.closes_at,
        created_by: row.created_by,
      },
    };
  }
}
