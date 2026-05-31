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

import { blake3 } from '@noble/hashes/blake3';
import stringify from 'fast-json-stable-stringify';

export const DOMAIN_EVENT = 'akalynth:chronicle:event:v1\0';
export const DOMAIN_GLOBAL = 'akalynth:chronicle:global:v1\0';

export type ChronicleEntry = {
  v: number;
  world_id: string;
  rulebook_root: string;
  tick: number;
  event_type: string;
  actor: string;
  caps_hash: string;
  caps?: string[];
  payload: Record<string, unknown>;
  rng?: unknown;
};

function blake3HexBytes(bytes: Uint8Array): string {
  return Buffer.from(blake3(bytes)).toString('hex');
}

function blake3HexUtf8(s: string): string {
  return blake3HexBytes(Buffer.from(s, 'utf8'));
}

function stableJson(value: unknown): string {
  return stringify(value);
}

export function stripPayloadHashFields(
  payload: Record<string, unknown>
): Record<string, unknown> {
  // Payload hash was computed BEFORE embedding these.
  const copy: Record<string, unknown> = { ...payload };
  // Per-actor chain fields
  delete copy.payload_hash;
  delete copy.prev_event_hash;
  delete copy.event_hash;
  // Global chain fields (Seal 2.3)
  delete copy.prev_global_hash;
  delete copy.global_event_hash;
  return copy;
}

export function computePayloadHash(payload: Record<string, unknown>): string {
  const stripped = stripPayloadHashFields(payload);
  return `blake3:${blake3HexUtf8(stableJson(stripped))}`;
}

export function computeEventHash(
  entry: ChronicleEntry,
  prevEventHash: string,
  payloadHash: string
): string {
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
  return `blake3:${blake3HexUtf8(DOMAIN_EVENT + stableJson(preimage))}`;
}

/**
 * Compute global_event_hash (Seal 2.3: whole-file tamper evidence).
 * The global chain commits to the per-actor event_hash, linking both chains.
 */
export function computeGlobalEventHash(
  entry: ChronicleEntry,
  payloadHash: string,
  eventHash: string,
  prevGlobalHash: string
): string {
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
  return `blake3:${blake3HexUtf8(DOMAIN_GLOBAL + stableJson(preimage))}`;
}

function getEmbeddedString(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === 'string' ? v : null;
}

export type GlobalChainOk = {
  ok: true;
  /** Number of entries whose global chain links + hashes verified. */
  verified: number;
  /** Global chain head after the slice. */
  head: string;
};

export type GlobalChainBroken = {
  ok: false;
  /** 0-based index of the failing entry within the supplied slice. */
  index: number;
  reason:
    | 'NOT_OBJECT'
    | 'PAYLOAD_HASH_MISMATCH'
    | 'EVENT_HASH_MISMATCH'
    | 'GLOBAL_FIELDS_MISSING'
    | 'GLOBAL_CHAIN_BROKEN'
    | 'GLOBAL_EVENT_HASH_MISMATCH';
};

export type GlobalChainResult = GlobalChainOk | GlobalChainBroken;

function isChronicleEntry(obj: unknown): obj is ChronicleEntry {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof (obj as ChronicleEntry).v === 'number' &&
    typeof (obj as ChronicleEntry).world_id === 'string' &&
    typeof (obj as ChronicleEntry).rulebook_root === 'string' &&
    typeof (obj as ChronicleEntry).tick === 'number' &&
    typeof (obj as ChronicleEntry).event_type === 'string' &&
    typeof (obj as ChronicleEntry).actor === 'string' &&
    typeof (obj as ChronicleEntry).caps_hash === 'string' &&
    (obj as ChronicleEntry).payload !== null &&
    typeof (obj as ChronicleEntry).payload === 'object'
  );
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
export function verifyGlobalChainSlice(
  slice: unknown[],
  startGlobalHash?: string
): GlobalChainResult {
  let lastGlobalHash: string | null = startGlobalHash ?? null;
  let verified = 0;

  for (let i = 0; i < slice.length; i++) {
    const obj = slice[i];
    if (!isChronicleEntry(obj)) {
      return { ok: false, index: i, reason: 'NOT_OBJECT' };
    }
    const entry: ChronicleEntry = obj;

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
    if (lastGlobalHash === null) lastGlobalHash = embeddedPrevGlobal;
    if (embeddedPrevGlobal !== lastGlobalHash) {
      return { ok: false, index: i, reason: 'GLOBAL_CHAIN_BROKEN' };
    }

    const computedGlobalHash = computeGlobalEventHash(
      entry,
      computedPayloadHash,
      computedEventHash,
      embeddedPrevGlobal
    );
    if (computedGlobalHash !== embeddedGlobalHash) {
      return { ok: false, index: i, reason: 'GLOBAL_EVENT_HASH_MISMATCH' };
    }

    lastGlobalHash = embeddedGlobalHash;
    verified++;
  }

  return { ok: true, verified, head: lastGlobalHash ?? (startGlobalHash ?? 'genesis') };
}
