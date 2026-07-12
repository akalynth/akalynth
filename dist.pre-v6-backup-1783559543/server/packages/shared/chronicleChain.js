// Shared chronicle global-/per-actor-chain verification (single source of truth).
//
// These functions are the byte-identical canonicalization + hashing used by the
// chronicle writer (apps/server/src/index.ts chronicleEvent, Seal 2.3) and by the
// offline chain verifier (apps/server/tools/verify-chronicle-chain.ts). They are
// extracted here so the RNG outcome verifier (packages/shared/verifyOutcome.ts)
// can VERIFY chronicle ordering against the SAME global hash chain rather than
// reimplementing the computation differently.
//
// Outputs MUST remain byte-identical to the server's chronicle writer. Do NOT
// change the canonicalization, domain separators, or preimage field order.
import * as nodeCrypto from 'node:crypto';
import { blake3HexUtf8, blake3Prefixed, canonicalJson } from './hashPrimitive.js';
export const DOMAIN_EVENT = 'akalynth:chronicle:event:v1\0';
export const DOMAIN_GLOBAL = 'akalynth:chronicle:global:v1\0';
export function stripPayloadHashFields(payload) {
    // Payload hash was computed BEFORE embedding these.
    const copy = { ...payload };
    // Per-actor chain fields
    delete copy.payload_hash;
    delete copy.prev_event_hash;
    delete copy.event_hash;
    // Global chain fields (Seal 2.3)
    delete copy.prev_global_hash;
    delete copy.global_event_hash;
    return copy;
}
export function computePayloadHash(payload) {
    const stripped = stripPayloadHashFields(payload);
    return blake3Prefixed(canonicalJson(stripped));
}
export function computeCapsHash(caps) {
    return blake3Prefixed(canonicalJson(caps ?? []));
}
export function computeEventHash(entry, prevEventHash, payloadHash) {
    const preimage = {
        v: entry.v,
        world_id: entry.world_id,
        rulebook_root: entry.rulebook_root,
        event_type: entry.event_type,
        actor: entry.actor,
        tick: entry.tick,
        caps_hash: entry.caps_hash,
        payload_hash: payloadHash,
        prev_event_hash: prevEventHash,
    };
    return blake3Prefixed(DOMAIN_EVENT + canonicalJson(preimage));
}
/**
 * Compute global_event_hash (Seal 2.3: whole-file tamper evidence).
 * The global chain commits to the per-actor event_hash, linking both chains.
 */
export function computeGlobalEventHash(entry, payloadHash, eventHash, prevGlobalHash) {
    const preimage = {
        v: entry.v,
        world_id: entry.world_id,
        rulebook_root: entry.rulebook_root,
        event_type: entry.event_type,
        actor: entry.actor,
        tick: entry.tick,
        caps_hash: entry.caps_hash,
        payload_hash: payloadHash,
        event_hash: eventHash, // Commits global chain to per-actor chain
        prev_global_hash: prevGlobalHash,
    };
    return blake3Prefixed(DOMAIN_GLOBAL + canonicalJson(preimage));
}
function getEmbeddedString(payload, key) {
    const v = payload[key];
    return typeof v === 'string' ? v : null;
}
function isChronicleEntry(obj) {
    return (obj !== null &&
        typeof obj === 'object' &&
        typeof obj.v === 'number' &&
        typeof obj.world_id === 'string' &&
        typeof obj.rulebook_root === 'string' &&
        typeof obj.tick === 'number' &&
        typeof obj.event_type === 'string' &&
        typeof obj.actor === 'string' &&
        typeof obj.caps_hash === 'string' &&
        obj.payload !== null &&
        typeof obj.payload === 'object');
}
/**
 * Verify the global hash chain (Seal 2.3) over an ORDERED slice of chronicle
 * entries, using the SAME computation as verify-chronicle-chain.ts.
 *
 * For each entry the function recomputes payload_hash, event_hash, and
 * global_event_hash from its embedded preimage, and checks that prev_global_hash
 * links to the prior entry's global_event_hash. EVERY entry in the slice must
 * carry the Seal 2.3 global fields (a slice mixing pre-2.3 entries is rejected as
 * GLOBAL_FIELDS_MISSING — ordering proof requires the global chain).
 *
 * The slice does NOT have to start at the chronicle genesis; `startGlobalHash`
 * defaults to the first entry's embedded prev_global_hash, so a contiguous
 * sub-slice of the chronicle is accepted as long as it is internally linked.
 *
 * Returns ok:true with the verified count + head, or ok:false with the failing
 * index + reason. This performs ordering-relevant verification only (global
 * chain); the RNG/Seal-3 reveal-binding semantics live in verify-chronicle-chain.
 */
export function verifyGlobalChainSlice(slice, startGlobalHash) {
    let lastGlobalHash = startGlobalHash ?? null;
    let verified = 0;
    for (let i = 0; i < slice.length; i++) {
        const obj = slice[i];
        if (!isChronicleEntry(obj)) {
            return { ok: false, index: i, reason: 'NOT_OBJECT' };
        }
        const entry = obj;
        const computedPayloadHash = computePayloadHash(entry.payload);
        const embeddedPayloadHash = getEmbeddedString(entry.payload, 'payload_hash');
        if (embeddedPayloadHash !== computedPayloadHash) {
            return { ok: false, index: i, reason: 'PAYLOAD_HASH_MISMATCH' };
        }
        const embeddedPrev = getEmbeddedString(entry.payload, 'prev_event_hash') ?? 'genesis';
        const computedEventHash = computeEventHash(entry, embeddedPrev, computedPayloadHash);
        const embeddedEvent = getEmbeddedString(entry.payload, 'event_hash');
        if (embeddedEvent !== computedEventHash) {
            return { ok: false, index: i, reason: 'EVENT_HASH_MISMATCH' };
        }
        const embeddedPrevGlobal = getEmbeddedString(entry.payload, 'prev_global_hash');
        const embeddedGlobalHash = getEmbeddedString(entry.payload, 'global_event_hash');
        if (embeddedPrevGlobal === null || embeddedGlobalHash === null) {
            return { ok: false, index: i, reason: 'GLOBAL_FIELDS_MISSING' };
        }
        // First entry seeds the expected head from its own prev_global_hash unless
        // the caller pinned a start; subsequent entries must chain exactly.
        if (lastGlobalHash === null)
            lastGlobalHash = embeddedPrevGlobal;
        if (embeddedPrevGlobal !== lastGlobalHash) {
            return { ok: false, index: i, reason: 'GLOBAL_CHAIN_BROKEN' };
        }
        const computedGlobalHash = computeGlobalEventHash(entry, computedPayloadHash, computedEventHash, embeddedPrevGlobal);
        if (computedGlobalHash !== embeddedGlobalHash) {
            return { ok: false, index: i, reason: 'GLOBAL_EVENT_HASH_MISMATCH' };
        }
        lastGlobalHash = embeddedGlobalHash;
        verified++;
    }
    return { ok: true, verified, head: lastGlobalHash ?? (startGlobalHash ?? 'genesis') };
}
// ---------------------------------------------------------------------------
// #107: chronicle SLICE AUTHENTICATION via Ed25519 line signatures.
// ---------------------------------------------------------------------------
//
// The global-chain check above proves a slice is internally hash-consistent, but
// a hash chain is forgeable: anyone can build a self-consistent slice. To TRUST
// the slice as the real, server-emitted chronicle we verify each line's Ed25519
// signature against the published signing pubkey (signing_public_key_hex, the
// raw-seed key that signs BOTH receipts and chronicle events).
//
// The chronicle log line is `<prev_hash>|<event_hash>|<signature>|<canonical_json>`
// where (crates/chronicle/src/lib.rs):
//   line_event_hash = blake3_hex(canonical_json)        (RAW hex, no `blake3:` prefix)
//   line_prev_hash  = blake3_hex(previous WHOLE line)    ("genesis" for the first)
//   signature       = Ed25519("{line_prev_hash}|{line_event_hash}") hex
//
// We reuse the SAME Ed25519 verification scheme as receipt_authenticity (raw
// 32-byte pubkey hex → SPKI DER → node:crypto.verify over the UTF-8 message
// `${prev}|${event}`), so chronicle-line auth cannot diverge from receipt auth.
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
/** Raw blake3 hex (no `blake3:` prefix) of a UTF-8 string — matches the Rust
 * chronicle writer's `blake3_hex` (.to_hex()) used for line_event_hash/line_prev_hash. */
function lineBlake3Hex(s) {
    return blake3HexUtf8(s);
}
/** Ed25519 verify over `${prevHash}|${eventHash}` with a raw 32-byte pubkey hex.
 * Byte-identical to verifyOutcome.ts#verifyReceiptSignature (same scheme). */
export function verifyLineSignature(prevHash, eventHash, signatureHex, publicKeyHex) {
    try {
        const rawPub = Buffer.from(publicKeyHex, 'hex');
        if (rawPub.length !== 32)
            return false;
        const der = Buffer.concat([SPKI_ED25519_PREFIX, rawPub]);
        const publicKey = nodeCrypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
        const message = Buffer.from(`${prevHash}|${eventHash}`);
        const signatureBytes = Buffer.from(signatureHex, 'hex');
        return nodeCrypto.verify(null, message, publicKey, signatureBytes);
    }
    catch {
        return false;
    }
}
/**
 * Authenticate an ORDERED chronicle slice by verifying each line's Ed25519
 * signature against `signingPublicKeyHex` (the published raw-seed signing key).
 *
 * For each entry:
 *   1) line fields present (line_event_hash, line_prev_hash, signature,
 *      canonical_json). If ANY are missing on ANY entry → SLICE_NOT_AUTHENTICATED
 *      (the slice cannot be authenticated; honest floor, NOT a tamper signal).
 *   2) line_event_hash === blake3_hex(canonical_json).
 *   3) line chain link: line_prev_hash === blake3_hex(previous whole line)
 *      (reconstructed as `${prev}|${event}|${signature}|${canonical_json}`), or
 *      "genesis" for the first entry.
 *   4) Ed25519("{line_prev_hash}|{line_event_hash}") verifies against the pubkey.
 * Any of 2–4 failing on a PRESENT signature → SLICE_SIGNATURE_INVALID (tamper).
 */
export function verifySignedChainSlice(entries, signingPublicKeyHex) {
    if (!signingPublicKeyHex || Buffer.from(signingPublicKeyHex, 'hex').length !== 32) {
        return { authenticated: false, reason: 'SLICE_NOT_AUTHENTICATED' };
    }
    let prevLine = null; // the whole previous log line
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const hasFields = typeof e.line_event_hash === 'string' &&
            typeof e.line_prev_hash === 'string' &&
            typeof e.signature === 'string' &&
            typeof e.canonical_json === 'string';
        if (!hasFields) {
            // Missing line material → cannot authenticate. NOT a tamper failure.
            return { authenticated: false, reason: 'SLICE_NOT_AUTHENTICATED', index: i };
        }
        const linePrev = e.line_prev_hash;
        const lineEvent = e.line_event_hash;
        const sig = e.signature;
        const canonical = e.canonical_json;
        // (2) event hash binds the canonical JSON.
        if (lineEvent !== lineBlake3Hex(canonical)) {
            return { authenticated: false, reason: 'SLICE_SIGNATURE_INVALID', index: i };
        }
        // (3) line chain link.
        const expectedPrev = prevLine === null ? 'genesis' : lineBlake3Hex(prevLine);
        if (linePrev !== expectedPrev) {
            return { authenticated: false, reason: 'SLICE_SIGNATURE_INVALID', index: i };
        }
        // (4) signature over `${prev}|${event}`.
        if (!verifyLineSignature(linePrev, lineEvent, sig, signingPublicKeyHex)) {
            return { authenticated: false, reason: 'SLICE_SIGNATURE_INVALID', index: i };
        }
        prevLine = `${linePrev}|${lineEvent}|${sig}|${canonical}`;
    }
    return { authenticated: true };
}
