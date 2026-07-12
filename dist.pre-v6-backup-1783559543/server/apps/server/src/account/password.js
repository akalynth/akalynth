// Argon2id password hashing (E2 / AKALYNTH_ACCOUNT_AUTH_API_V1).
//
// OWASP recommends a slow, memory-hard KDF for password storage; Argon2id is the
// preferred modern option. Parameters follow OWASP minimum work factors and are
// embedded in the returned PHC string so they can be re-tuned without a schema
// change (verify-on-login can transparently re-hash when params change).
import { hash, verify } from '@node-rs/argon2';
// m=19456 KiB (19 MiB), t=2, p=1 — OWASP Argon2id minimum.
const HASH_OPTIONS = {
    algorithm: 2 /* Algorithm.Argon2id */,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
};
/** Hash a plaintext password into an Argon2id PHC string (salt + params embedded). */
export function hashPassword(plain) {
    return hash(plain, HASH_OPTIONS);
}
/** Verify a plaintext password against a stored Argon2id PHC string. Never throws. */
export async function verifyPassword(encoded, plain) {
    try {
        return await verify(encoded, plain);
    }
    catch {
        return false;
    }
}
