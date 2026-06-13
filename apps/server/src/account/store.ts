// Account data access (E2) over the E1 schema. Thin, typed wrapper around the
// better-sqlite3 handle. PII (email) and security material (password_hash, token
// hashes) live only here. Callers pass already-hashed token values.
import type Database from 'better-sqlite3';
import type {
  AccountRow,
  AccountEmailVerificationRow,
  AccountSessionRow,
  AccountPasswordResetRow,
  AccountStatus,
} from '../persist/types.js';

export class AccountStore {
  constructor(private readonly db: Database.Database) {}

  // ---- accounts ----

  insertAccount(row: {
    account_id: string;
    email: string;
    email_lower: string;
    password_hash: string;
    status: AccountStatus;
    created_at: string;
    created_receipt: string | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO accounts (account_id, email, email_lower, password_hash, email_verified, status, created_at, created_receipt, updated_at)
         VALUES (@account_id, @email, @email_lower, @password_hash, 0, @status, @created_at, @created_receipt, @created_at)`,
      )
      .run(row);
  }

  findByEmailLower(emailLower: string): AccountRow | undefined {
    return this.db.prepare(`SELECT * FROM accounts WHERE email_lower = ?`).get(emailLower) as AccountRow | undefined;
  }

  findById(accountId: string): AccountRow | undefined {
    return this.db.prepare(`SELECT * FROM accounts WHERE account_id = ?`).get(accountId) as AccountRow | undefined;
  }

  setEmailVerified(accountId: string, whenIso: string): void {
    this.db
      .prepare(`UPDATE accounts SET email_verified = 1, status = 'email_verified', updated_at = ? WHERE account_id = ?`)
      .run(whenIso, accountId);
  }

  updatePasswordHash(accountId: string, passwordHash: string, whenIso: string): void {
    this.db
      .prepare(`UPDATE accounts SET password_hash = ?, updated_at = ? WHERE account_id = ?`)
      .run(passwordHash, whenIso, accountId);
  }

  /** Replace an account's roles (rolesJson = JSON array of role strings). */
  setRoles(accountId: string, rolesJson: string, whenIso: string): void {
    this.db
      .prepare(`UPDATE accounts SET roles = ?, updated_at = ? WHERE account_id = ?`)
      .run(rolesJson, whenIso, accountId);
  }

  // ---- email verifications ----

  insertVerification(row: {
    id: string;
    account_id: string;
    token_hash: string;
    created_at: string;
    expires_at: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO account_email_verifications (id, account_id, token_hash, created_at, expires_at, consumed_at)
         VALUES (@id, @account_id, @token_hash, @created_at, @expires_at, NULL)`,
      )
      .run(row);
  }

  findVerificationByTokenHash(tokenHash: string): AccountEmailVerificationRow | undefined {
    return this.db
      .prepare(`SELECT * FROM account_email_verifications WHERE token_hash = ?`)
      .get(tokenHash) as AccountEmailVerificationRow | undefined;
  }

  consumeVerification(id: string, whenIso: string): void {
    this.db.prepare(`UPDATE account_email_verifications SET consumed_at = ? WHERE id = ?`).run(whenIso, id);
  }

  // ---- sessions ----

  insertSession(row: {
    session_id: string;
    account_id: string;
    token_hash: string;
    client: string | null;
    created_at: string;
    expires_at: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO account_sessions (session_id, account_id, token_hash, client, created_at, expires_at, last_seen_at, revoked_at)
         VALUES (@session_id, @account_id, @token_hash, @client, @created_at, @expires_at, @created_at, NULL)`,
      )
      .run(row);
  }

  findSessionByTokenHash(tokenHash: string): AccountSessionRow | undefined {
    return this.db
      .prepare(`SELECT * FROM account_sessions WHERE token_hash = ?`)
      .get(tokenHash) as AccountSessionRow | undefined;
  }

  touchSession(sessionId: string, whenIso: string): void {
    this.db.prepare(`UPDATE account_sessions SET last_seen_at = ? WHERE session_id = ?`).run(whenIso, sessionId);
  }

  revokeSession(sessionId: string, whenIso: string): void {
    this.db.prepare(`UPDATE account_sessions SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL`).run(whenIso, sessionId);
  }

  revokeAllSessions(accountId: string, whenIso: string): void {
    this.db.prepare(`UPDATE account_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL`).run(whenIso, accountId);
  }

  // ---- password resets ----

  insertReset(row: {
    id: string;
    account_id: string;
    token_hash: string;
    created_at: string;
    expires_at: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO account_password_resets (id, account_id, token_hash, created_at, expires_at, consumed_at)
         VALUES (@id, @account_id, @token_hash, @created_at, @expires_at, NULL)`,
      )
      .run(row);
  }

  findResetByTokenHash(tokenHash: string): AccountPasswordResetRow | undefined {
    return this.db
      .prepare(`SELECT * FROM account_password_resets WHERE token_hash = ?`)
      .get(tokenHash) as AccountPasswordResetRow | undefined;
  }

  consumeReset(id: string, whenIso: string): void {
    this.db.prepare(`UPDATE account_password_resets SET consumed_at = ? WHERE id = ?`).run(whenIso, id);
  }
}
