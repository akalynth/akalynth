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
import { rngCommit, rngDrawU32Legacy, rngCommitV1 } from '../src/world/rng.js';

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

function getEmbeddedNumber(payload: Record<string, unknown>, key: string): number | null {
  const v = payload[key];
  return typeof v === 'number' ? v : null;
}

function getEmbeddedNumberArray(payload: Record<string, unknown>, key: string): number[] | null {
  const v = payload[key];
  if (!Array.isArray(v)) return null;
  const out: number[] = [];
  for (const item of v) {
    if (typeof item !== 'number') return null;
    out.push(item);
  }
  return out;
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
  // Find file path argument (skip flags starting with --)
  const argPath = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
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

  // Seal 3.1: RNG commit→reveal state (triple-keyed by actor::domain::commit)
  const strictRng = process.argv.includes('--strict-rng');

  function rngKey(actor: string, domain: string, commit: string): string {
    return `${actor}::${domain}::${commit}`;
  }

  const commitSeen = new Map<string, true>(); // key: actor::domain::commit (existence only)
  const revealByKey = new Map<string, string>(); // key: actor::domain::commit -> reveal

  type PendingOut = { lineNo: number; out: number[]; domain: string; commit: string };
  const pendingOutByKey = new Map<string, PendingOut[]>(); // key: actor::domain::commit -> pending

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
    // Seal 3 (v0): RNG proof verification when present
    // =========================================================================
    const rngCommitEmbedded = getEmbeddedString(entry.payload, 'rng_commit');
    const rngReveal = getEmbeddedString(entry.payload, 'rng_reveal');
    const rngDomain = getEmbeddedString(entry.payload, 'rng_domain');
    const rngDraws = getEmbeddedNumber(entry.payload, 'rng_draws');
    const rngOut = getEmbeddedNumberArray(entry.payload, 'rng_out');

    if (rngCommitEmbedded && rngReveal) {
      const expectedCommit = rngCommit(rngReveal);
      if (expectedCommit !== rngCommitEmbedded) {
        console.error(`[FATAL] rng_commit mismatch at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  event_type: ${entry.event_type}`);
        console.error(`  expected: ${expectedCommit}`);
        console.error(`  got:      ${rngCommitEmbedded}`);
        process.exit(1);
      }
    }

    if (rngOut) {
      if (!rngDomain) {
        console.error(`[FATAL] rng_domain missing at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  event_type: ${entry.event_type}`);
        process.exit(1);
      }
      if (rngDomain !== 'death_drop:v0') {
        console.error(`[FATAL] rng_domain unsupported at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  event_type: ${entry.event_type}`);
        console.error(`  expected: death_drop:v0`);
        console.error(`  got:      ${rngDomain}`);
        process.exit(1);
      }

      if (rngDraws !== null && rngDraws !== rngOut.length) {
        console.error(`[FATAL] rng_draws mismatch at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  event_type: ${entry.event_type}`);
        console.error(`  expected: ${rngOut.length}`);
        console.error(`  got:      ${rngDraws}`);
        process.exit(1);
      }

      if (!rngReveal) {
        console.error(`[FATAL] rng_reveal missing at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  event_type: ${entry.event_type}`);
        process.exit(1);
      }
      for (let i = 0; i < rngOut.length; i++) {
        const expected = rngDrawU32Legacy(rngReveal, i);
        if (rngOut[i] !== expected) {
          console.error(`[FATAL] rng_out mismatch at line ${lineNo}`);
          console.error(`  actor: ${entry.actor}`);
          console.error(`  event_type: ${entry.event_type}`);
          console.error(`  index: ${i}`);
          console.error(`  expected: ${expected}`);
          console.error(`  got:      ${rngOut[i]}`);
          process.exit(1);
        }
      }
    }

    // =========================================================================
    // Seal 3.1: RNG commit→reveal verification (v1)
    // =========================================================================
    if (entry.event_type === 'rng_commit') {
      const domain = getEmbeddedString(entry.payload, 'rng_domain');
      const commit = getEmbeddedString(entry.payload, 'rng_commit');
      if (!domain) {
        console.error(`[FATAL] rng_domain missing in rng_commit at line ${lineNo}`);
        process.exit(1);
      }
      if (!commit) {
        console.error(`[FATAL] rng_commit missing in rng_commit event at line ${lineNo}`);
        process.exit(1);
      }
      const key = rngKey(entry.actor, domain, commit);
      commitSeen.set(key, true);
    }

    if (entry.event_type === 'rng_reveal') {
      const domain = getEmbeddedString(entry.payload, 'rng_domain');
      const commit = getEmbeddedString(entry.payload, 'rng_commit');
      const reveal = getEmbeddedString(entry.payload, 'rng_reveal');
      if (!domain || !commit || !reveal) {
        console.error(`[FATAL] Missing field in rng_reveal at line ${lineNo}`);
        console.error(`  domain: ${domain}, commit: ${commit}, reveal: ${reveal}`);
        process.exit(1);
      }

      const key = rngKey(entry.actor, domain, commit);

      if (!commitSeen.get(key)) {
        console.error(`[FATAL] rng_reveal references unknown commit at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  domain: ${domain}`);
        console.error(`  commit: ${commit}`);
        process.exit(1);
      }

      // Recompute commitment and verify binding
      const expectedCommit = rngCommitV1(domain, entry.actor, reveal);
      if (expectedCommit !== commit) {
        console.error(`[FATAL] rng_commit verification failed at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  domain: ${domain}`);
        console.error(`  expected: ${expectedCommit}`);
        console.error(`  got:      ${commit}`);
        process.exit(1);
      }

      revealByKey.set(key, reveal);

      // Resolve pending outputs for this exact (actor, domain, commit)
      const pending = pendingOutByKey.get(key) || [];
      for (const p of pending) {
        for (let i = 0; i < p.out.length; i++) {
          const expected = rngDrawU32Legacy(reveal, i);
          if (p.out[i] !== expected) {
            console.error(`[FATAL] Deferred rng_out verification failed at original line ${p.lineNo}`);
            console.error(`  actor: ${entry.actor}`);
            console.error(`  domain: ${domain}`);
            console.error(`  commit: ${commit}`);
            console.error(`  index: ${i}`);
            console.error(`  expected: ${expected}`);
            console.error(`  got:      ${p.out[i]}`);
            process.exit(1);
          }
        }
      }
      pendingOutByKey.delete(key);
    }

    // Handle death_drop:v1 (commit without reveal - deferred verification)
    if (rngOut && rngDomain === 'death_drop:v1') {
      if (!rngCommitEmbedded) {
        console.error(`[FATAL] death_drop:v1 missing rng_commit at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  event_type: ${entry.event_type}`);
        process.exit(1);
      }

      const key = rngKey(entry.actor, rngDomain, rngCommitEmbedded);

      if (!commitSeen.get(key)) {
        console.error(`[FATAL] death_drop:v1 references unknown commit at line ${lineNo}`);
        console.error(`  actor: ${entry.actor}`);
        console.error(`  domain: ${rngDomain}`);
        console.error(`  commit: ${rngCommitEmbedded}`);
        process.exit(1);
      }

      const reveal = revealByKey.get(key);
      if (reveal) {
        // Reveal already available, verify immediately
        for (let i = 0; i < rngOut.length; i++) {
          const expected = rngDrawU32Legacy(reveal, i);
          if (rngOut[i] !== expected) {
            console.error(`[FATAL] rng_out mismatch (v1) at line ${lineNo}`);
            console.error(`  actor: ${entry.actor}`);
            console.error(`  domain: ${rngDomain}`);
            console.error(`  commit: ${rngCommitEmbedded}`);
            console.error(`  index: ${i}`);
            console.error(`  expected: ${expected}`);
            console.error(`  got:      ${rngOut[i]}`);
            process.exit(1);
          }
        }
      } else {
        // Defer verification until reveal
        const arr = pendingOutByKey.get(key) ?? [];
        arr.push({ lineNo, out: rngOut, domain: rngDomain, commit: rngCommitEmbedded });
        pendingOutByKey.set(key, arr);
      }
    }

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

  // Seal 3.1: Report any unresolved pending verifications
  const pendingCount = Array.from(pendingOutByKey.values()).reduce((sum, arr) => sum + arr.length, 0);
  if (pendingCount > 0) {
    const msg = `${pendingCount} pending RNG verifications remain unresolved`;
    if (strictRng) {
      console.error(`[FATAL] ${msg}`);
    } else {
      console.warn(`[WARN] ${msg} (run with --strict-rng to fail)`);
    }

    // Print up to 10 pending keys for debugging
    let shown = 0;
    for (const [k, arr] of pendingOutByKey.entries()) {
      for (const p of arr) {
        console.warn(`  pending: ${k} (line ${p.lineNo})`);
        if (++shown >= 10) break;
      }
      if (shown >= 10) break;
    }

    if (strictRng) process.exit(1);
  }
  if (commitSeen.size > 0) {
    console.log(`[ok] Seal 3.1: ${revealByKey.size}/${commitSeen.size} RNG commits resolved`);
  }
}

main();
