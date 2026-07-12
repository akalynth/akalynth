import { createHash, createPublicKey, createVerify } from 'node:crypto';
import { canonicalJson as sharedCanonicalJson } from '../../../../packages/shared/hashPrimitive.js';
export const PRINCIPAL_CHALLENGE_TYPE = 'akalynth.challenge.v1';
export const PRINCIPAL_PROTOCOL_VERSION = '1';
export function canonicalJson(value) {
    const out = sharedCanonicalJson(value);
    if (!out)
        throw new Error('canonical_json_failed');
    return out;
}
export function sha256Hex(value) {
    return createHash('sha256').update(value).digest('hex');
}
export function base64urlToBuffer(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value))
        throw new Error('invalid_base64url');
    return Buffer.from(value, 'base64url');
}
export function publicKeyFingerprint(publicKeySpkiPem) {
    const key = createPublicKey(publicKeySpkiPem);
    const der = key.export({ type: 'spki', format: 'der' });
    return `sha256:${sha256Hex(der)}`;
}
export function verifyDeviceSignature(publicKeySpkiPem, canonicalPayload, signatureBase64url) {
    const signature = base64urlToBuffer(signatureBase64url);
    const verifier = createVerify('SHA256');
    verifier.update(canonicalPayload, 'utf8');
    verifier.end();
    return verifier.verify(publicKeySpkiPem, signature);
}
export function isPrincipalChallengePurpose(value) {
    return (value === 'principal_login' ||
        value === 'principal_retire' ||
        value === 'principal_delete' ||
        value === 'pgp_bind' ||
        value === 'forum_authority_post');
}
