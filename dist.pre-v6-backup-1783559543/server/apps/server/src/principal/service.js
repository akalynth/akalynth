import { randomBytes } from 'node:crypto';
import { PRINCIPAL_CHALLENGE_TYPE, PRINCIPAL_PROTOCOL_VERSION, canonicalJson, isPrincipalChallengePurpose, publicKeyFingerprint, sha256Hex, verifyDeviceSignature, } from './canonical.js';
import { hashToken, newId, newToken } from '../account/tokens.js';
import { RECEIPT_ACTIONS } from '../persist/types.js';
export const PRINCIPAL_SESSION_BEARER = 'Bearer';
const HANDLE_RE = /^[A-Za-z][A-Za-z0-9_-]{2,31}$/;
const MAX_DETAIL_LEN = 2000;
const MAX_REASON_LEN = 80;
function iso(ms) {
    return new Date(ms).toISOString();
}
function normalizeHandle(handle) {
    const trimmed = handle.trim();
    if (!HANDLE_RE.test(trimmed))
        return null;
    const lower = trimmed.toLowerCase();
    const reserved = new Set(['admin', 'moderator', 'project', 'system', 'support', 'official', 'akalynth']);
    if (reserved.has(lower) || lower.startsWith('guest_') || lower.startsWith('deleted_'))
        return null;
    return { handle: trimmed, lower };
}
function parseRoles(row) {
    try {
        const roles = JSON.parse(row.roles_json);
        if (Array.isArray(roles))
            return roles.filter((r) => typeof r === 'string');
    }
    catch {
        // fall through
    }
    return ['player'];
}
export function deriveCapabilities(roles, identityLevel) {
    const caps = new Set();
    caps.add('forum:post_basic');
    caps.add('forum:report');
    caps.add('forum:block');
    if (identityLevel === 'pgp_bound')
        caps.add('forum:post_authority');
    if (roles.includes('moderator') || roles.includes('admin') || roles.includes('project')) {
        caps.add('moderation:read');
        caps.add('moderation:resolve');
    }
    if (roles.includes('project')) {
        caps.add('project:announce');
        caps.add('forum:post_authority');
    }
    return [...caps].sort();
}
function publicPrincipal(row, identityLevel = 'key_bound') {
    const roles = parseRoles(row);
    return {
        principal_id: row.principal_id,
        handle: row.handle,
        display_name: row.display_name,
        status: row.status,
        identity_level: identityLevel,
        roles,
        capabilities: deriveCapabilities(roles, identityLevel),
        recovery_mode: row.recovery_mode,
        created_at: row.created_at,
        seal_retired_at: row.seal_retired_at,
        principal_deleted_at: row.principal_deleted_at,
    };
}
function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function cleanReason(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_REASON_LEN)
        return null;
    return trimmed;
}
function cleanDetail(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    return trimmed.slice(0, MAX_DETAIL_LEN);
}
export class PrincipalService {
    d;
    constructor(d) {
        this.d = d;
    }
    register(input) {
        const handleInput = typeof input.handle === 'string' ? normalizeHandle(input.handle) : null;
        if (!handleInput) {
            return { status: 400, body: { ok: false, error: 'invalid_handle' } };
        }
        if (input.accepted_terms !== true) {
            return { status: 400, body: { ok: false, error: 'terms_required' } };
        }
        if (this.d.store.findPrincipalByHandleLower(handleInput.lower)) {
            return { status: 409, body: { ok: false, error: 'handle_taken' } };
        }
        if (typeof input.public_key_spki_pem !== 'string' || !input.public_key_spki_pem.includes('BEGIN PUBLIC KEY')) {
            return { status: 400, body: { ok: false, error: 'invalid_public_key' } };
        }
        let keyFingerprint;
        try {
            keyFingerprint = publicKeyFingerprint(input.public_key_spki_pem);
        }
        catch {
            return { status: 400, body: { ok: false, error: 'invalid_public_key' } };
        }
        const nowIso = iso(this.d.now());
        const principalId = newId('principal');
        const displayName = typeof input.display_name === 'string' && input.display_name.trim()
            ? input.display_name.trim().slice(0, 64)
            : handleInput.handle;
        const client = input.client === 'web' ? 'web' : 'android';
        this.d.store.insertPrincipal({
            principal_id: principalId,
            handle: handleInput.handle,
            handle_lower: handleInput.lower,
            display_name: displayName,
            roles_json: JSON.stringify(['player']),
            created_at: nowIso,
        });
        this.d.store.insertKey({
            key_id: newId('pkey'),
            principal_id: principalId,
            key_type: 'device_spki_p256',
            public_key: input.public_key_spki_pem,
            key_fingerprint: keyFingerprint,
            status: 'active',
            created_at: nowIso,
        });
        this.d.store.acceptTerms({
            principal_id: principalId,
            terms_version: this.d.config.termsVersion,
            accepted_at: nowIso,
            client,
        });
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.PRINCIPAL_CREATED,
            principalId,
            inputs: { key_fingerprint: keyFingerprint, proof_mechanism: 'device_spki_p256' },
            result: 'ok',
        });
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.PRINCIPAL_TERMS_ACCEPTED,
            principalId,
            inputs: { terms_version: this.d.config.termsVersion, client },
            result: 'ok',
        });
        const principal = this.d.store.findPrincipalById(principalId);
        return {
            status: 201,
            body: {
                ok: true,
                principal: publicPrincipal(principal),
                key_fingerprint: keyFingerprint,
                loss_warning: 'V1 has no recovery. Losing this device or app data may lose this Adventurer Seal.',
            },
        };
    }
    challenge(input) {
        const principalId = typeof input.principal_id === 'string' ? input.principal_id : '';
        const principal = this.d.store.findPrincipalById(principalId);
        if (!principal || principal.status !== 'active') {
            return { status: 404, body: { ok: false, error: 'principal_unavailable' } };
        }
        if (!isPrincipalChallengePurpose(input.purpose)) {
            return { status: 400, body: { ok: false, error: 'invalid_purpose' } };
        }
        const domain = typeof input.domain === 'string' ? input.domain : this.d.config.domain;
        if (domain !== this.d.config.domain) {
            return { status: 400, body: { ok: false, error: 'domain_mismatch' } };
        }
        const client = input.client === 'web' ? 'web' : 'android';
        const now = this.d.now();
        const expires = now + this.d.config.challengeTtlMs;
        const challengeId = newId('challenge');
        const nonce = randomBytes(24).toString('base64url');
        const payload = {
            type: PRINCIPAL_CHALLENGE_TYPE,
            domain,
            purpose: input.purpose,
            principal_id: principalId,
            challenge_id: challengeId,
            nonce,
            issued_at: iso(now),
            expires_at: iso(expires),
            client,
            protocol_version: PRINCIPAL_PROTOCOL_VERSION,
        };
        const canonicalPayload = canonicalJson(payload);
        this.d.store.insertChallenge({
            challenge_id: challengeId,
            principal_id: principalId,
            nonce_hash: `sha256:${sha256Hex(nonce)}`,
            purpose: input.purpose,
            domain,
            payload_json: canonicalPayload,
            client,
            issued_at: payload.issued_at,
            expires_at: payload.expires_at,
            consumed_at: null,
        });
        return {
            status: 200,
            body: {
                ok: true,
                challenge_id: challengeId,
                payload,
                canonical_payload: canonicalPayload,
                expires_at: payload.expires_at,
            },
        };
    }
    verify(input) {
        const checked = this.verifyChallenge(input, 'principal_login');
        if (!checked.ok)
            return checked.response;
        const now = this.d.now();
        const createdAt = iso(now);
        const expiresAt = iso(now + this.d.config.sessionTtlMs);
        const sessionToken = `ps_${newToken()}`;
        const sessionId = newId('psess');
        const identityLevel = 'key_bound';
        this.d.store.insertSession({
            session_id: sessionId,
            principal_id: checked.principal.principal_id,
            token_hash: hashToken(sessionToken),
            identity_level: identityLevel,
            created_at: createdAt,
            expires_at: expiresAt,
        });
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.PRINCIPAL_SESSION_ISSUED,
            principalId: checked.principal.principal_id,
            inputs: {
                session_id: sessionId,
                proof_mechanism: 'device_spki_p256',
                key_fingerprint: checked.keyFingerprint,
                derived_capabilities: deriveCapabilities(parseRoles(checked.principal), identityLevel),
            },
            result: 'ok',
        });
        return {
            status: 200,
            body: {
                ok: true,
                principal: publicPrincipal(checked.principal, identityLevel),
                session_token: sessionToken,
                expires_at: expiresAt,
            },
        };
    }
    me(authHeader) {
        const ctx = this.resolveAuth(authHeader);
        if (!ctx)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        return { status: 200, body: { ok: true, principal: publicPrincipal(ctx.principal, ctx.session.identity_level) } };
    }
    acceptTerms(authHeader, input) {
        const ctx = this.resolveAuth(authHeader);
        if (!ctx)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        const termsVersion = typeof input.terms_version === 'string' && input.terms_version.trim()
            ? input.terms_version.trim()
            : this.d.config.termsVersion;
        const client = input.client === 'web' ? 'web' : 'android';
        const acceptedAt = iso(this.d.now());
        this.d.store.acceptTerms({ principal_id: ctx.principal.principal_id, terms_version: termsVersion, accepted_at: acceptedAt, client });
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.PRINCIPAL_TERMS_ACCEPTED,
            principalId: ctx.principal.principal_id,
            inputs: { terms_version: termsVersion, client },
            result: 'ok',
        });
        return { status: 200, body: { ok: true, terms_version: termsVersion, accepted_at: acceptedAt } };
    }
    block(authHeader, input) {
        const ctx = this.resolveAuth(authHeader);
        if (!ctx)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        if (!ctx.capabilities.includes('forum:block'))
            return { status: 403, body: { ok: false, error: 'capability_required' } };
        const target = typeof input.target_principal_id === 'string' ? input.target_principal_id : '';
        if (!target || target === ctx.principal.principal_id || !this.d.store.findPrincipalById(target)) {
            return { status: 400, body: { ok: false, error: 'invalid_target' } };
        }
        const reason = cleanReason(input.reason);
        const nowIso = iso(this.d.now());
        this.d.store.insertBlock({
            blocker_principal_id: ctx.principal.principal_id,
            blocked_principal_id: target,
            reason,
            created_at: nowIso,
        });
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.PRINCIPAL_BLOCKED,
            principalId: ctx.principal.principal_id,
            inputs: { target_principal_id: target, reason: reason ?? null, derived_capability: 'forum:block' },
            result: 'ok',
        });
        return { status: 200, body: { ok: true } };
    }
    report(authHeader, input) {
        const ctx = this.resolveAuth(authHeader);
        if (!ctx)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        if (!ctx.capabilities.includes('forum:report'))
            return { status: 403, body: { ok: false, error: 'capability_required' } };
        const target = typeof input.target_principal_id === 'string' ? input.target_principal_id : '';
        const reason = cleanReason(input.reason);
        if (!target || !reason || !this.d.store.findPrincipalById(target)) {
            return { status: 400, body: { ok: false, error: 'invalid_report' } };
        }
        const reportId = newId('preport');
        const contentRef = typeof input.content_ref === 'string' && input.content_ref.trim() ? input.content_ref.trim().slice(0, 200) : null;
        const detail = cleanDetail(input.detail);
        const nowIso = iso(this.d.now());
        this.d.store.insertReport({
            report_id: reportId,
            reporter_principal_id: ctx.principal.principal_id,
            target_principal_id: target,
            content_ref: contentRef,
            reason,
            detail,
            status: 'open',
            created_at: nowIso,
            resolved_at: null,
            resolved_by_principal_id: null,
            resolution: null,
            resolution_reason: null,
        });
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.PRINCIPAL_REPORTED,
            principalId: ctx.principal.principal_id,
            inputs: {
                report_id: reportId,
                target_principal_id: target,
                content_ref: contentRef,
                reason,
                derived_capability: 'forum:report',
            },
            result: 'ok',
        });
        return { status: 201, body: { ok: true, report_id: reportId, status: 'open' } };
    }
    listReports(authHeader, input) {
        const ctx = this.resolveAuth(authHeader);
        if (!ctx)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        if (!ctx.capabilities.includes('moderation:read'))
            return { status: 403, body: { ok: false, error: 'capability_required' } };
        const status = input.status === 'resolved' || input.status === 'all' ? input.status : 'open';
        const limit = typeof input.limit === 'number' ? input.limit : 50;
        return { status: 200, body: { ok: true, reports: this.d.store.listReports(status, limit) } };
    }
    resolveReport(authHeader, input) {
        const ctx = this.resolveAuth(authHeader);
        if (!ctx)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        if (!ctx.capabilities.includes('moderation:resolve'))
            return { status: 403, body: { ok: false, error: 'capability_required' } };
        const reportId = typeof input.report_id === 'string' ? input.report_id : '';
        const resolution = input.resolution;
        if (!isResolution(resolution)) {
            return { status: 400, body: { ok: false, error: 'invalid_resolution' } };
        }
        const report = this.d.store.findReport(reportId);
        if (!report)
            return { status: 404, body: { ok: false, error: 'not_found' } };
        if (report.status === 'resolved')
            return { status: 409, body: { ok: false, error: 'already_resolved' } };
        const reason = cleanDetail(input.reason);
        const resolvedAt = iso(this.d.now());
        this.d.store.resolveReport({
            report_id: reportId,
            resolved_at: resolvedAt,
            resolved_by_principal_id: ctx.principal.principal_id,
            resolution,
            resolution_reason: reason,
        });
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.PRINCIPAL_MODERATION_ACTION,
            principalId: ctx.principal.principal_id,
            inputs: {
                report_id: reportId,
                target_principal_id: report.target_principal_id,
                resolution,
                derived_capability: 'moderation:resolve',
            },
            result: 'ok',
        });
        return { status: 200, body: { ok: true } };
    }
    retire(authHeader, input) {
        const ctx = this.resolveAuth(authHeader);
        if (!ctx)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        const checked = this.verifyChallenge({ ...input, principal_id: ctx.principal.principal_id }, 'principal_retire');
        if (!checked.ok)
            return checked.response;
        const nowIso = iso(this.d.now());
        this.d.store.updatePrincipalStatus(ctx.principal.principal_id, 'seal_retired', nowIso);
        this.d.store.revokeAllSessions(ctx.principal.principal_id, nowIso);
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.PRINCIPAL_SEAL_RETIRED,
            principalId: ctx.principal.principal_id,
            inputs: {
                proof_mechanism: 'device_spki_p256',
                key_fingerprint: checked.keyFingerprint,
                derived_capability: 'self:retire',
            },
            result: 'ok',
        });
        return { status: 200, body: { ok: true, status: 'seal_retired' } };
    }
    deletePrincipal(authHeader, input) {
        const ctx = this.resolveAuth(authHeader);
        if (!ctx)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        const checked = this.verifyChallenge({ ...input, principal_id: ctx.principal.principal_id }, 'principal_delete');
        if (!checked.ok)
            return checked.response;
        const nowIso = iso(this.d.now());
        this.d.store.anonymizePrincipal(ctx.principal.principal_id, nowIso);
        this.d.store.revokeAllSessions(ctx.principal.principal_id, nowIso);
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.PRINCIPAL_DELETION_REQUESTED,
            principalId: ctx.principal.principal_id,
            inputs: {
                proof_mechanism: 'device_spki_p256',
                key_fingerprint: checked.keyFingerprint,
                retained_evidence_policy: 'public_posts_reports_moderation_may_be_retained_if_disclosed',
            },
            result: 'ok',
        });
        return { status: 200, body: { ok: true, status: 'principal_deleted' } };
    }
    pgpBind(authHeader, input) {
        const ctx = this.resolveAuth(authHeader);
        if (!ctx)
            return { status: 401, body: { ok: false, error: 'not_authenticated' } };
        if (typeof input.armored_public_key !== 'string' || !input.armored_public_key.includes('BEGIN PGP PUBLIC KEY BLOCK')) {
            return { status: 400, body: { ok: false, error: 'invalid_pgp_public_key' } };
        }
        const fingerprint = `sha256:${sha256Hex(input.armored_public_key)}`;
        const nowIso = iso(this.d.now());
        this.d.store.insertKey({
            key_id: newId('pkey'),
            principal_id: ctx.principal.principal_id,
            key_type: 'pgp_public_key',
            public_key: input.armored_public_key,
            key_fingerprint: fingerprint,
            status: 'pending_verification',
            created_at: nowIso,
        });
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.PRINCIPAL_PGP_BINDING_PENDING,
            principalId: ctx.principal.principal_id,
            inputs: {
                pgp_fingerprint: fingerprint,
                status: 'pending_verification',
                authority_claim_enabled: false,
            },
            result: 'pending',
        });
        return {
            status: 202,
            body: {
                ok: true,
                status: 'pending_verification',
                pgp_fingerprint: fingerprint,
                authority_claim_enabled: false,
            },
        };
    }
    policy() {
        return {
            status: 200,
            body: {
                ok: true,
                terms_version: this.d.config.termsVersion,
                account_policy: 'Adventurer Seal is treated as persistent app-account identity for deletion/privacy purposes.',
                recovery_mode: 'none',
                local_storage: ['device-bound private signing key in Android Keystore where available', 'principal/session metadata in app storage'],
                server_storage: ['handle', 'display_name', 'public key fingerprint', 'public key', 'roles', 'capabilities derived server-side', 'reports', 'blocks', 'sessions', 'deletion state'],
                public_storage: ['handle and signed-post status may be public on forum surfaces'],
                loss_warning: 'V1 has no recovery. Losing this device or app data may lose this Adventurer Seal.',
                no_wallet_token_nft_claim: true,
            },
        };
    }
    resolveAuth(authHeader) {
        const token = parseBearer(authHeader);
        if (!token)
            return null;
        const session = this.d.store.findSessionByTokenHash(hashToken(token));
        if (!session || session.revoked_at || Date.parse(session.expires_at) <= this.d.now())
            return null;
        const principal = this.d.store.findPrincipalById(session.principal_id);
        if (!principal || principal.status !== 'active')
            return null;
        this.d.store.touchSession(session.session_id, iso(this.d.now()));
        const identityLevel = session.identity_level;
        const roles = parseRoles(principal);
        return { principal, session, roles, capabilities: deriveCapabilities(roles, identityLevel) };
    }
    verifyChallenge(input, expectedPurpose) {
        const principalId = typeof input.principal_id === 'string' ? input.principal_id : '';
        const challengeId = typeof input.challenge_id === 'string' ? input.challenge_id : '';
        const signature = typeof input.signature_base64url === 'string' ? input.signature_base64url : '';
        if (!principalId || !challengeId || !signature) {
            return { ok: false, response: { status: 400, body: { ok: false, error: 'invalid_challenge_input' } } };
        }
        const principal = this.d.store.findPrincipalById(principalId);
        const challenge = this.d.store.getChallenge(challengeId);
        const key = this.d.store.getActiveDeviceKey(principalId);
        if (!principal || principal.status !== 'active' || !challenge || !key) {
            return { ok: false, response: { status: 404, body: { ok: false, error: 'challenge_unavailable' } } };
        }
        if (challenge.consumed_at) {
            return { ok: false, response: { status: 409, body: { ok: false, error: 'challenge_consumed' } } };
        }
        if (challenge.principal_id !== principalId || challenge.purpose !== expectedPurpose || challenge.domain !== this.d.config.domain) {
            return { ok: false, response: { status: 400, body: { ok: false, error: 'challenge_mismatch' } } };
        }
        if (Date.parse(challenge.expires_at) <= this.d.now()) {
            return { ok: false, response: { status: 400, body: { ok: false, error: 'challenge_expired' } } };
        }
        let payload;
        try {
            payload = JSON.parse(challenge.payload_json);
        }
        catch {
            return { ok: false, response: { status: 500, body: { ok: false, error: 'stored_challenge_invalid' } } };
        }
        if (!isStoredPayload(payload, principalId, challengeId, expectedPurpose, this.d.config.domain)) {
            return { ok: false, response: { status: 400, body: { ok: false, error: 'challenge_payload_invalid' } } };
        }
        let valid = false;
        try {
            valid = verifyDeviceSignature(key.public_key, canonicalJson(payload), signature);
        }
        catch {
            valid = false;
        }
        if (!valid) {
            this.d.emitReceipt({
                action: RECEIPT_ACTIONS.PRINCIPAL_CHALLENGE_REJECTED,
                principalId,
                inputs: {
                    challenge_id: challengeId,
                    purpose: expectedPurpose,
                    proof_mechanism: 'device_spki_p256',
                    key_fingerprint: key.key_fingerprint,
                },
                result: 'invalid_signature',
            });
            return { ok: false, response: { status: 401, body: { ok: false, error: 'invalid_signature' } } };
        }
        this.d.store.consumeChallenge(challengeId, iso(this.d.now()));
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.PRINCIPAL_CHALLENGE_VERIFIED,
            principalId,
            inputs: {
                challenge_id: challengeId,
                purpose: expectedPurpose,
                proof_mechanism: 'device_spki_p256',
                key_fingerprint: key.key_fingerprint,
            },
            result: 'ok',
        });
        return { ok: true, principal, keyFingerprint: key.key_fingerprint };
    }
}
function parseBearer(authHeader) {
    if (!authHeader)
        return null;
    const m = new RegExp(`^${PRINCIPAL_SESSION_BEARER}\\s+(.+)$`, 'i').exec(authHeader);
    const token = m?.[1]?.trim();
    return token || null;
}
function isResolution(value) {
    return value === 'no_action' || value === 'warning' || value === 'temp_mute' || value === 'ban';
}
function isStoredPayload(payload, principalId, challengeId, expectedPurpose, domain) {
    if (!isRecord(payload))
        return false;
    return (payload.type === PRINCIPAL_CHALLENGE_TYPE &&
        payload.protocol_version === PRINCIPAL_PROTOCOL_VERSION &&
        payload.principal_id === principalId &&
        payload.challenge_id === challengeId &&
        payload.purpose === expectedPurpose &&
        payload.domain === domain &&
        typeof payload.nonce === 'string' &&
        typeof payload.issued_at === 'string' &&
        typeof payload.expires_at === 'string' &&
        (payload.client === 'android' || payload.client === 'web'));
}
