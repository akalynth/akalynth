export class AccountStore {
    db;
    constructor(db) {
        this.db = db;
    }
    // ---- accounts ----
    insertAccount(row) {
        this.db
            .prepare(`INSERT INTO accounts (account_id, email, email_lower, handle, handle_lower, password_hash, email_verified, status, created_at, created_receipt, updated_at)
         VALUES (@account_id, @email, @email_lower, @handle, @handle_lower, @password_hash, 0, @status, @created_at, @created_receipt, @created_at)`)
            .run(row);
    }
    findByEmailLower(emailLower) {
        return this.db.prepare(`SELECT * FROM accounts WHERE email_lower = ?`).get(emailLower);
    }
    findByHandleLower(handleLower) {
        return this.db.prepare(`SELECT * FROM accounts WHERE handle_lower = ?`).get(handleLower);
    }
    findById(accountId) {
        return this.db.prepare(`SELECT * FROM accounts WHERE account_id = ?`).get(accountId);
    }
    setEmailVerified(accountId, whenIso) {
        this.db
            .prepare(`UPDATE accounts SET email_verified = 1, status = 'email_verified', updated_at = ? WHERE account_id = ?`)
            .run(whenIso, accountId);
    }
    updatePasswordHash(accountId, passwordHash, whenIso) {
        this.db
            .prepare(`UPDATE accounts SET password_hash = ?, updated_at = ? WHERE account_id = ?`)
            .run(passwordHash, whenIso, accountId);
    }
    /** Replace an account's roles (rolesJson = JSON array of role strings). */
    setRoles(accountId, rolesJson, whenIso) {
        this.db
            .prepare(`UPDATE accounts SET roles = ?, updated_at = ? WHERE account_id = ?`)
            .run(rolesJson, whenIso, accountId);
    }
    // ---- email verifications ----
    insertVerification(row) {
        this.db
            .prepare(`INSERT INTO account_email_verifications (id, account_id, token_hash, created_at, expires_at, consumed_at)
         VALUES (@id, @account_id, @token_hash, @created_at, @expires_at, NULL)`)
            .run(row);
    }
    findVerificationByTokenHash(tokenHash) {
        return this.db
            .prepare(`SELECT * FROM account_email_verifications WHERE token_hash = ?`)
            .get(tokenHash);
    }
    consumeVerification(id, whenIso) {
        this.db.prepare(`UPDATE account_email_verifications SET consumed_at = ? WHERE id = ?`).run(whenIso, id);
    }
    // ---- sessions ----
    insertSession(row) {
        this.db
            .prepare(`INSERT INTO account_sessions (session_id, account_id, token_hash, client, created_at, expires_at, last_seen_at, revoked_at)
         VALUES (@session_id, @account_id, @token_hash, @client, @created_at, @expires_at, @created_at, NULL)`)
            .run(row);
    }
    findSessionByTokenHash(tokenHash) {
        return this.db
            .prepare(`SELECT * FROM account_sessions WHERE token_hash = ?`)
            .get(tokenHash);
    }
    touchSession(sessionId, whenIso) {
        this.db.prepare(`UPDATE account_sessions SET last_seen_at = ? WHERE session_id = ?`).run(whenIso, sessionId);
    }
    revokeSession(sessionId, whenIso) {
        this.db.prepare(`UPDATE account_sessions SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL`).run(whenIso, sessionId);
    }
    revokeAllSessions(accountId, whenIso) {
        this.db.prepare(`UPDATE account_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL`).run(whenIso, accountId);
    }
    // ---- password resets ----
    insertReset(row) {
        this.db
            .prepare(`INSERT INTO account_password_resets (id, account_id, token_hash, created_at, expires_at, consumed_at)
         VALUES (@id, @account_id, @token_hash, @created_at, @expires_at, NULL)`)
            .run(row);
    }
    findResetByTokenHash(tokenHash) {
        return this.db
            .prepare(`SELECT * FROM account_password_resets WHERE token_hash = ?`)
            .get(tokenHash);
    }
    consumeReset(id, whenIso) {
        this.db.prepare(`UPDATE account_password_resets SET consumed_at = ? WHERE id = ?`).run(whenIso, id);
    }
}
