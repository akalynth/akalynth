import type Database from 'better-sqlite3';

export type PrincipalStatus = 'active' | 'seal_retired' | 'principal_deleted' | 'disabled';
export type PrincipalKeyType = 'device_spki_p256' | 'pgp_public_key';
export type PrincipalKeyStatus = 'active' | 'retired' | 'pending_verification';
export type PrincipalReportStatus = 'open' | 'resolved';
export type PrincipalModerationResolution = 'no_action' | 'warning' | 'temp_mute' | 'ban';

export interface PrincipalRow {
  principal_id: string;
  handle: string;
  handle_lower: string;
  display_name: string;
  status: PrincipalStatus;
  roles_json: string;
  recovery_mode: 'none';
  created_at: string;
  updated_at: string;
  seal_retired_at: string | null;
  principal_deleted_at: string | null;
  deletion_requested_at: string | null;
}

export interface PrincipalKeyRow {
  key_id: string;
  principal_id: string;
  key_type: PrincipalKeyType;
  public_key: string;
  key_fingerprint: string;
  status: PrincipalKeyStatus;
  created_at: string;
  retired_at: string | null;
}

export interface PrincipalChallengeRow {
  challenge_id: string;
  principal_id: string;
  nonce_hash: string;
  purpose: string;
  domain: string;
  payload_json: string;
  client: string;
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface PrincipalSessionRow {
  session_id: string;
  principal_id: string;
  token_hash: string;
  identity_level: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
}

export interface PrincipalReportRow {
  report_id: string;
  reporter_principal_id: string;
  target_principal_id: string;
  content_ref: string | null;
  reason: string;
  detail: string | null;
  status: PrincipalReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by_principal_id: string | null;
  resolution: PrincipalModerationResolution | null;
  resolution_reason: string | null;
}

export class PrincipalStore {
  constructor(private readonly db: Database.Database) {}

  insertPrincipal(row: {
    principal_id: string;
    handle: string;
    handle_lower: string;
    display_name: string;
    roles_json: string;
    created_at: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO principals (
           principal_id, handle, handle_lower, display_name, status, roles_json,
           recovery_mode, created_at, updated_at, seal_retired_at,
           principal_deleted_at, deletion_requested_at
         )
         VALUES (
           @principal_id, @handle, @handle_lower, @display_name, 'active',
           @roles_json, 'none', @created_at, @created_at, NULL, NULL, NULL
         )`,
      )
      .run(row);
  }

  findPrincipalByHandleLower(handleLower: string): PrincipalRow | undefined {
    return this.db
      .prepare(`SELECT * FROM principals WHERE handle_lower = ? AND status != 'principal_deleted'`)
      .get(handleLower) as PrincipalRow | undefined;
  }

  findPrincipalById(principalId: string): PrincipalRow | undefined {
    return this.db.prepare(`SELECT * FROM principals WHERE principal_id = ?`).get(principalId) as PrincipalRow | undefined;
  }

  updatePrincipalStatus(principalId: string, status: PrincipalStatus, whenIso: string): void {
    const retired = status === 'seal_retired' ? whenIso : null;
    const deleted = status === 'principal_deleted' ? whenIso : null;
    this.db
      .prepare(
        `UPDATE principals
         SET status = ?,
             updated_at = ?,
             seal_retired_at = COALESCE(seal_retired_at, ?),
             principal_deleted_at = COALESCE(principal_deleted_at, ?),
             deletion_requested_at = CASE WHEN ? = 'principal_deleted' THEN COALESCE(deletion_requested_at, ?) ELSE deletion_requested_at END
         WHERE principal_id = ?`,
      )
      .run(status, whenIso, retired, deleted, status, whenIso, principalId);
  }

  anonymizePrincipal(principalId: string, whenIso: string): void {
    const suffix = principalId.slice(-8);
    this.db
      .prepare(
        `UPDATE principals
         SET handle = ?, handle_lower = ?, display_name = ?, updated_at = ?,
             status = 'principal_deleted',
             principal_deleted_at = COALESCE(principal_deleted_at, ?),
             deletion_requested_at = COALESCE(deletion_requested_at, ?)
         WHERE principal_id = ?`,
      )
      .run(`deleted_${suffix}`, `deleted_${suffix}`, 'Deleted Adventurer', whenIso, whenIso, whenIso, principalId);
  }

  insertKey(row: {
    key_id: string;
    principal_id: string;
    key_type: PrincipalKeyType;
    public_key: string;
    key_fingerprint: string;
    status: PrincipalKeyStatus;
    created_at: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO principal_keys (
           key_id, principal_id, key_type, public_key, key_fingerprint,
           status, created_at, retired_at
         )
         VALUES (
           @key_id, @principal_id, @key_type, @public_key, @key_fingerprint,
           @status, @created_at, NULL
         )`,
      )
      .run(row);
  }

  getActiveDeviceKey(principalId: string): PrincipalKeyRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM principal_keys
         WHERE principal_id = ? AND key_type = 'device_spki_p256' AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(principalId) as PrincipalKeyRow | undefined;
  }

  insertChallenge(row: PrincipalChallengeRow): void {
    this.db
      .prepare(
        `INSERT INTO principal_challenges (
           challenge_id, principal_id, nonce_hash, purpose, domain, payload_json,
           client, issued_at, expires_at, consumed_at
         )
         VALUES (
           @challenge_id, @principal_id, @nonce_hash, @purpose, @domain,
           @payload_json, @client, @issued_at, @expires_at, NULL
         )`,
      )
      .run(row);
  }

  getChallenge(challengeId: string): PrincipalChallengeRow | undefined {
    return this.db.prepare(`SELECT * FROM principal_challenges WHERE challenge_id = ?`).get(challengeId) as
      | PrincipalChallengeRow
      | undefined;
  }

  consumeChallenge(challengeId: string, whenIso: string): void {
    this.db
      .prepare(`UPDATE principal_challenges SET consumed_at = ? WHERE challenge_id = ? AND consumed_at IS NULL`)
      .run(whenIso, challengeId);
  }

  insertSession(row: {
    session_id: string;
    principal_id: string;
    token_hash: string;
    identity_level: string;
    created_at: string;
    expires_at: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO principal_sessions (
           session_id, principal_id, token_hash, identity_level, created_at,
           expires_at, last_seen_at, revoked_at
         )
         VALUES (
           @session_id, @principal_id, @token_hash, @identity_level,
           @created_at, @expires_at, @created_at, NULL
         )`,
      )
      .run(row);
  }

  findSessionByTokenHash(tokenHash: string): PrincipalSessionRow | undefined {
    return this.db.prepare(`SELECT * FROM principal_sessions WHERE token_hash = ?`).get(tokenHash) as
      | PrincipalSessionRow
      | undefined;
  }

  touchSession(sessionId: string, whenIso: string): void {
    this.db.prepare(`UPDATE principal_sessions SET last_seen_at = ? WHERE session_id = ?`).run(whenIso, sessionId);
  }

  revokeSession(sessionId: string, whenIso: string): void {
    this.db.prepare(`UPDATE principal_sessions SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL`).run(whenIso, sessionId);
  }

  revokeAllSessions(principalId: string, whenIso: string): void {
    this.db
      .prepare(`UPDATE principal_sessions SET revoked_at = ? WHERE principal_id = ? AND revoked_at IS NULL`)
      .run(whenIso, principalId);
  }

  acceptTerms(row: { principal_id: string; terms_version: string; accepted_at: string; client: string }): void {
    this.db
      .prepare(
        `INSERT INTO principal_terms_acceptances (principal_id, terms_version, accepted_at, client)
         VALUES (@principal_id, @terms_version, @accepted_at, @client)`,
      )
      .run(row);
  }

  insertBlock(row: { blocker_principal_id: string; blocked_principal_id: string; reason: string | null; created_at: string }): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO principal_blocks (blocker_principal_id, blocked_principal_id, reason, created_at)
         VALUES (@blocker_principal_id, @blocked_principal_id, @reason, @created_at)`,
      )
      .run(row);
  }

  insertReport(row: PrincipalReportRow): void {
    this.db
      .prepare(
        `INSERT INTO principal_reports (
           report_id, reporter_principal_id, target_principal_id, content_ref,
           reason, detail, status, created_at, resolved_at, resolved_by_principal_id,
           resolution, resolution_reason
         )
         VALUES (
           @report_id, @reporter_principal_id, @target_principal_id, @content_ref,
           @reason, @detail, @status, @created_at, NULL, NULL, NULL, NULL
         )`,
      )
      .run(row);
  }

  listReports(status: 'open' | 'resolved' | 'all', limit: number): PrincipalReportRow[] {
    const capped = Math.max(1, Math.min(limit, 200));
    const where = status === 'all' ? '' : 'WHERE status = @status';
    return this.db
      .prepare(`SELECT * FROM principal_reports ${where} ORDER BY created_at DESC LIMIT @limit`)
      .all({ status, limit: capped }) as PrincipalReportRow[];
  }

  findReport(reportId: string): PrincipalReportRow | undefined {
    return this.db.prepare(`SELECT * FROM principal_reports WHERE report_id = ?`).get(reportId) as PrincipalReportRow | undefined;
  }

  resolveReport(row: {
    report_id: string;
    resolved_at: string;
    resolved_by_principal_id: string;
    resolution: PrincipalModerationResolution;
    resolution_reason: string | null;
  }): void {
    this.db
      .prepare(
        `UPDATE principal_reports
         SET status = 'resolved',
             resolved_at = @resolved_at,
             resolved_by_principal_id = @resolved_by_principal_id,
             resolution = @resolution,
             resolution_reason = @resolution_reason
         WHERE report_id = @report_id AND status = 'open'`,
      )
      .run(row);
  }
}
