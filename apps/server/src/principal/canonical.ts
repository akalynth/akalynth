import { createHash, createPublicKey, createVerify } from 'node:crypto';
import stringify from 'fast-json-stable-stringify';

export const PRINCIPAL_CHALLENGE_TYPE = 'akalynth.challenge.v1';
export const PRINCIPAL_PROTOCOL_VERSION = '1';

export type PrincipalChallengePurpose =
  | 'principal_login'
  | 'principal_retire'
  | 'principal_delete'
  | 'pgp_bind'
  | 'forum_authority_post';

export interface PrincipalChallengePayload {
  type: typeof PRINCIPAL_CHALLENGE_TYPE;
  domain: string;
  purpose: PrincipalChallengePurpose;
  principal_id: string;
  challenge_id: string;
  nonce: string;
  issued_at: string;
  expires_at: string;
  client: 'android' | 'web';
  protocol_version: typeof PRINCIPAL_PROTOCOL_VERSION;
}

export function canonicalJson(value: unknown): string {
  const out = stringify(value);
  if (!out) throw new Error('canonical_json_failed');
  return out;
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function base64urlToBuffer(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid_base64url');
  return Buffer.from(value, 'base64url');
}

export function publicKeyFingerprint(publicKeySpkiPem: string): string {
  const key = createPublicKey(publicKeySpkiPem);
  const der = key.export({ type: 'spki', format: 'der' }) as Buffer;
  return `sha256:${sha256Hex(der)}`;
}

export function verifyDeviceSignature(
  publicKeySpkiPem: string,
  canonicalPayload: string,
  signatureBase64url: string,
): boolean {
  const signature = base64urlToBuffer(signatureBase64url);
  const verifier = createVerify('SHA256');
  verifier.update(canonicalPayload, 'utf8');
  verifier.end();
  return verifier.verify(publicKeySpkiPem, signature);
}

export function isPrincipalChallengePurpose(value: unknown): value is PrincipalChallengePurpose {
  return (
    value === 'principal_login' ||
    value === 'principal_retire' ||
    value === 'principal_delete' ||
    value === 'pgp_bind' ||
    value === 'forum_authority_post'
  );
}
