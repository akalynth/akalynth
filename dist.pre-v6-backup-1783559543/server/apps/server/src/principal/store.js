export class PrincipalStore {
    db;
    constructor(db) {
        this.db = db;
    }
    insertPrincipal(row) {
        this.db
            .prepare(`INSERT INTO principals (
           principal_id, handle, handle_lower, display_name, status, roles_json,
           recovery_mode, created_at, updated_at, seal_retired_at,
           principal_deleted_at, deletion_requested_at
         )
         VALUES (
           @principal_id, @handle, @handle_lower, @display_name, 'active',
           @roles_json, 'none', @created_at, @created_at, NULL, NULL, NULL
         )`)
            .run(row);
    }
    findPrincipalByHandleLower(handleLower) {
        return this.db
            .prepare(`SELECT * FROM principals WHERE handle_lower = ? AND status != 'principal_deleted'`)
            .get(handleLower);
    }
    findPrincipalById(principalId) {
        return this.db.prepare(`SELECT * FROM principals WHERE principal_id = ?`).get(principalId);
    }
    updatePrincipalStatus(principalId, status, whenIso) {
        const retired = status === 'seal_retired' ? whenIso : null;
        const deleted = status === 'principal_deleted' ? whenIso : null;
        this.db
            .prepare(`UPDATE principals
         SET status = ?,
             updated_at = ?,
             seal_retired_at = COALESCE(seal_retired_at, ?),
             principal_deleted_at = COALESCE(principal_deleted_at, ?),
             deletion_requested_at = CASE WHEN ? = 'principal_deleted' THEN COALESCE(deletion_requested_at, ?) ELSE deletion_requested_at END
         WHERE principal_id = ?`)
            .run(status, whenIso, retired, deleted, status, whenIso, principalId);
    }
    anonymizePrincipal(principalId, whenIso) {
        const suffix = principalId.slice(-8);
        this.db
            .prepare(`UPDATE principals
         SET handle = ?, handle_lower = ?, display_name = ?, updated_at = ?,
             status = 'principal_deleted',
             principal_deleted_at = COALESCE(principal_deleted_at, ?),
             deletion_requested_at = COALESCE(deletion_requested_at, ?)
         WHERE principal_id = ?`)
            .run(`deleted_${suffix}`, `deleted_${suffix}`, 'Deleted Adventurer', whenIso, whenIso, whenIso, principalId);
    }
    insertKey(row) {
        this.db
            .prepare(`INSERT INTO principal_keys (
           key_id, principal_id, key_type, public_key, key_fingerprint,
           status, created_at, retired_at
         )
         VALUES (
           @key_id, @principal_id, @key_type, @public_key, @key_fingerprint,
           @status, @created_at, NULL
         )`)
            .run(row);
    }
    getActiveDeviceKey(principalId) {
        return this.db
            .prepare(`SELECT * FROM principal_keys
         WHERE principal_id = ? AND key_type = 'device_spki_p256' AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`)
            .get(principalId);
    }
    insertChallenge(row) {
        this.db
            .prepare(`INSERT INTO principal_challenges (
           challenge_id, principal_id, nonce_hash, purpose, domain, payload_json,
           client, issued_at, expires_at, consumed_at
         )
         VALUES (
           @challenge_id, @principal_id, @nonce_hash, @purpose, @domain,
           @payload_json, @client, @issued_at, @expires_at, NULL
         )`)
            .run(row);
    }
    getChallenge(challengeId) {
        return this.db.prepare(`SELECT * FROM principal_challenges WHERE challenge_id = ?`).get(challengeId);
    }
    consumeChallenge(challengeId, whenIso) {
        this.db
            .prepare(`UPDATE principal_challenges SET consumed_at = ? WHERE challenge_id = ? AND consumed_at IS NULL`)
            .run(whenIso, challengeId);
    }
    insertSession(row) {
        this.db
            .prepare(`INSERT INTO principal_sessions (
           session_id, principal_id, token_hash, identity_level, created_at,
           expires_at, last_seen_at, revoked_at
         )
         VALUES (
           @session_id, @principal_id, @token_hash, @identity_level,
           @created_at, @expires_at, @created_at, NULL
         )`)
            .run(row);
    }
    findSessionByTokenHash(tokenHash) {
        return this.db.prepare(`SELECT * FROM principal_sessions WHERE token_hash = ?`).get(tokenHash);
    }
    touchSession(sessionId, whenIso) {
        this.db.prepare(`UPDATE principal_sessions SET last_seen_at = ? WHERE session_id = ?`).run(whenIso, sessionId);
    }
    revokeSession(sessionId, whenIso) {
        this.db.prepare(`UPDATE principal_sessions SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL`).run(whenIso, sessionId);
    }
    revokeAllSessions(principalId, whenIso) {
        this.db
            .prepare(`UPDATE principal_sessions SET revoked_at = ? WHERE principal_id = ? AND revoked_at IS NULL`)
            .run(whenIso, principalId);
    }
    acceptTerms(row) {
        this.db
            .prepare(`INSERT INTO principal_terms_acceptances (principal_id, terms_version, accepted_at, client)
         VALUES (@principal_id, @terms_version, @accepted_at, @client)`)
            .run(row);
    }
    insertBlock(row) {
        this.db
            .prepare(`INSERT OR IGNORE INTO principal_blocks (blocker_principal_id, blocked_principal_id, reason, created_at)
         VALUES (@blocker_principal_id, @blocked_principal_id, @reason, @created_at)`)
            .run(row);
    }
    insertReport(row) {
        this.db
            .prepare(`INSERT INTO principal_reports (
           report_id, reporter_principal_id, target_principal_id, content_ref,
           reason, detail, status, created_at, resolved_at, resolved_by_principal_id,
           resolution, resolution_reason
         )
         VALUES (
           @report_id, @reporter_principal_id, @target_principal_id, @content_ref,
           @reason, @detail, @status, @created_at, NULL, NULL, NULL, NULL
         )`)
            .run(row);
    }
    listReports(status, limit) {
        const capped = Math.max(1, Math.min(limit, 200));
        const where = status === 'all' ? '' : 'WHERE status = @status';
        return this.db
            .prepare(`SELECT * FROM principal_reports ${where} ORDER BY created_at DESC LIMIT @limit`)
            .all({ status, limit: capped });
    }
    findReport(reportId) {
        return this.db.prepare(`SELECT * FROM principal_reports WHERE report_id = ?`).get(reportId);
    }
    resolveReport(row) {
        this.db
            .prepare(`UPDATE principal_reports
         SET status = 'resolved',
             resolved_at = @resolved_at,
             resolved_by_principal_id = @resolved_by_principal_id,
             resolution = @resolution,
             resolution_reason = @resolution_reason
         WHERE report_id = @report_id AND status = 'open'`)
            .run(row);
    }
}
