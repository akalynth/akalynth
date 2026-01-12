#!/usr/bin/env tsx
/**
 * verify-chronicle-chain.ts — Offline chronicle chain verifier
 *
 * Validates:
 * - caps_hash matches caps array
 * - payload_hash matches payload (after stripping hash fields)
 * - event_hash matches domain-separated preimage
 * - prev_event_hash chain integrity per actor
 * - prev_global_hash chain integrity (Seal 2.3: whole-file tamper evidence)
 * - global_event_hash matches domain-separated preimage (Seal 2.3)
 *
 * Usage:
 *   npm run chronicle:verify-chain
 *   npx tsx tools/verify-chronicle-chain.ts chronicle.log
 */
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import stringify from 'fast-json-stable-stringify';
import { blake3 } from '@noble/hashes/blake3';

type ChronicleEntry = {
  v: number;
  world_id: string;
  rulebook_root: string;
  tick: number;
  event_type: string;
  actor: string;
  caps_hash: string;
  caps?: string[];
  payload: Record<string, unknown>;
  rng: unknown | null;
};

const DOMAIN_EVENT = 'akalynth:chronicle:event:v1\0';
const DOMAIN_GLOBAL = 'akalynth:chronicle:global:v1\0';

function blake3HexBytes(bytes: Uint8Array): string {
  return Buffer.from(blake3(bytes)).toString('hex');
}

function blake3HexUtf8(s: string): string {
  return blake3HexBytes(Buffer.from(s, 'utf8'));
}

function stableJson(value: unknown): string {
  return stringify(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) if (typeof v === 'string') out.push(v);
  return out;
}

function stripPayloadHashFields(payload: Record<string, unknown>): Record<string, unknown> {
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

function computePayloadHash(payload: Record<string, unknown>): string {
  const stripped = stripPayloadHashFields(payload);
  return `blake3:${blake3HexUtf8(stableJson(stripped))}`;
}

function computeCapsHash(caps: string[]): string {
  return `blake3:${blake3HexUtf8(stableJson(caps ?? []))}`;
}

function computeEventHash(entry: ChronicleEntry, prevEventHash: string, payloadHash: string): string {
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
 * Compute global_event_hash (Seal 2.3: whole-file tamper evidence)
 * The global chain commits to the per-actor event_hash, linking both chains.
 */
function computeGlobalEventHash(
  entry: ChronicleEntry,
  payloadHash: string,
  eventHash: string,
  prevGlobalHash: string,
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

function readJsonlLines(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  // tolerate trailing newline
  return raw.split('\n').filter((l) => l.trim().length > 0);
}

/**
 * Extract caps array from chronicle entry.
 * Checks top-level caps first, then payload.caps as fallback.
 */
function extractCaps(obj: ChronicleEntry): string[] | null {
  // Top-level caps (preferred)
  if (Array.isArray(obj.caps)) return asStringArray(obj.caps);
  // Fallback: payload.caps
  if (obj.payload && Array.isArray((obj.payload as Record<string, unknown>).caps)) {
    return asStringArray((obj.payload as Record<string, unknown>).caps);
  }
  // caps not available in entry
  return null;
}

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

function main() {
  const argPath = process.argv[2];
  const filePath = argPath
    ? path.resolve(process.cwd(), argPath)
    : path.resolve(process.cwd(), 'chronicle.log');

  if (!fs.existsSync(filePath)) {
    console.error(`[FATAL] File not found: ${filePath}`);
    process.exit(1);
  }

  const lines = readJsonlLines(filePath);

  if (lines.length === 0) {
    console.log('[ok] Chronicle log is empty.');
    process.exit(0);
  }

  // Per-actor last hash map reconstructed while reading file in order
  const lastByActor = new Map<string, string>();

  // Global chain state (Seal 2.3)
  let lastGlobalHash = 'genesis';
  let globalChainVerified = 0;

  let okCount = 0;
  let capsSkipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let obj: unknown;

    try {
      // Chronicle format: <prev_hash>|<event_hash>|<signature>|<json_payload>
      const line = lines[i];
      const parts = line.split('|');
      if (parts.length >= 4) {
        // Pipe-delimited format - JSON is the 4th+ field
        const jsonPart = parts.slice(3).join('|');
        obj = JSON.parse(jsonPart);
      } else {
        // Try plain JSONL format
        obj = JSON.parse(line);
      }
    } catch {
      console.error(`[FATAL] Bad JSON at line ${lineNo}`);
      process.exit(1);
    }

    if (!isChronicleEntry(obj)) {
      console.error(`[FATAL] Not a chronicle entry shape at line ${lineNo}`);
      console.error(obj);
      process.exit(1);
    }

    const entry: ChronicleEntry = obj;

    // Verify caps_hash (if caps array is available)
    const caps = extractCaps(entry);
    if (caps !== null) {
      const computedCapsHash = computeCapsHash(caps);
      if (computedCapsHash !== entry.caps_hash) {
        console.error(`[FATAL] caps_hash mismatch at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  event_type: ${entry.event_type}`);
        console.error(`  expected: ${computedCapsHash}`);
        console.error(`  got:      ${entry.caps_hash}`);
        process.exit(1);
      }
    } else {
      capsSkipped++;
    }

    const embeddedPrev = getEmbeddedString(entry.payload, 'prev_event_hash') ?? 'genesis';
    const embeddedEvent = getEmbeddedString(entry.payload, 'event_hash');
    const embeddedPayloadHash = getEmbeddedString(entry.payload, 'payload_hash');

    // Verify payload_hash
    const computedPayloadHash = computePayloadHash(entry.payload);
    if (embeddedPayloadHash !== computedPayloadHash) {
      console.error(`[FATAL] payload_hash mismatch at line ${lineNo}`);
      console.error(`  actor: ${entry.actor}`);
      console.error(`  event_type: ${entry.event_type}`);
      console.error(`  expected: ${computedPayloadHash}`);
      console.error(`  got:      ${embeddedPayloadHash ?? '(missing)'}`);
      process.exit(1);
    }

    // Verify prev_event_hash chain
    const expectedPrev = lastByActor.get(entry.actor) ?? 'genesis';
    if (embeddedPrev !== expectedPrev) {
      console.error(`[FATAL] prev_event_hash chain break at line ${lineNo}`);
      console.error(`  actor: ${entry.actor}`);
      console.error(`  event_type: ${entry.event_type}`);
      console.error(`  expected prev: ${expectedPrev}`);
      console.error(`  got prev:      ${embeddedPrev}`);
      process.exit(1);
    }

    // Verify event_hash
    if (!embeddedEvent) {
      console.error(`[FATAL] event_hash missing at line ${lineNo}`);
      console.error(`  actor: ${entry.actor}`);
      console.error(`  event_type: ${entry.event_type}`);
      process.exit(1);
    }
    const computedEventHash = computeEventHash(entry, embeddedPrev, computedPayloadHash);
    if (embeddedEvent !== computedEventHash) {
      console.error(`[FATAL] event_hash mismatch at line ${lineNo}`);
      console.error(`  actor: ${entry.actor}`);
      console.error(`  event_type: ${entry.event_type}`);
      console.error(`  expected: ${computedEventHash}`);
      console.error(`  got:      ${embeddedEvent}`);
      process.exit(1);
    }

    // Update per-actor chain state
    lastByActor.set(entry.actor, computedEventHash);
    okCount++;

    // =========================================================================
    // Seal 2.3: Global chain verification (whole-file tamper evidence)
    // =========================================================================
    const embeddedPrevGlobal = getEmbeddedString(entry.payload, 'prev_global_hash');
    const embeddedGlobalHash = getEmbeddedString(entry.payload, 'global_event_hash');

    // Global chain fields present - verify them
    if (embeddedPrevGlobal !== null && embeddedGlobalHash !== null) {
      // Verify prev_global_hash links to previous event
      if (embeddedPrevGlobal !== lastGlobalHash) {
        console.error(`[FATAL] Global chain broken at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  event_type: ${entry.event_type}`);
        console.error(`  expected prev_global_hash: ${lastGlobalHash}`);
        console.error(`  got prev_global_hash:      ${embeddedPrevGlobal}`);
        process.exit(1);
      }

      // Recompute and verify global_event_hash
      const computedGlobalHash = computeGlobalEventHash(
        entry,
        computedPayloadHash,
        computedEventHash,
        embeddedPrevGlobal,
      );
      if (computedGlobalHash !== embeddedGlobalHash) {
        console.error(`[FATAL] global_event_hash mismatch at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  event_type: ${entry.event_type}`);
        console.error(`  expected: ${computedGlobalHash}`);
        console.error(`  got:      ${embeddedGlobalHash}`);
        process.exit(1);
      }

      // Advance global chain head
      lastGlobalHash = embeddedGlobalHash;
      globalChainVerified++;
    }
  }

  console.log(`[ok] Verified ${okCount}/${lines.length} chronicle events (per-actor chain).`);
  console.log(`[ok] Actors seen: ${lastByActor.size}`);
  if (globalChainVerified > 0) {
    console.log(`[ok] Global chain verified: ${globalChainVerified} events, head=${lastGlobalHash.slice(0, 20)}...`);
  } else {
    console.log(`[info] Global chain: no Seal 2.3 fields found (pre-2.3 log)`);
  }
  if (capsSkipped > 0) {
    console.log(`[info] caps_hash verification skipped for ${capsSkipped} entries (caps array not in entry)`);
  }
}

main();
