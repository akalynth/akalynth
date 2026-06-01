#!/usr/bin/env node
/**
 * SCRATCH fixture generator for #101 v2 precommit-anchored RNG proof fixtures.
 *
 * Computes CORRECT values using the SAME shared rng + dropPolicy the server uses,
 * generates a real Ed25519 keypair (matching the coordination-kernel receipt
 * signature scheme: Ed25519 over `prev_hash|event_hash`, raw 32-byte key), signs
 * the verified-case receipt, then derives the tampered/ordering variants.
 *
 *   npx tsx tools/verify-outcome/gen-fixtures-v2.ts
 *
 * Re-runnable and deterministic EXCEPT the keypair (random). The keypair +
 * signature + pubkey are written into a sidecar context file so the test is
 * reproducible. Not part of the test suite.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { blake3 } from '@noble/hashes/blake3';
import stableStringify from 'fast-json-stable-stringify';
import { rngCommitV1, rngDeriveSeedV2 } from '../../packages/shared/rng.js';
import { computeDeathDrops, type ItemForDrop } from '../../packages/shared/dropPolicy.js';
import {
  type ChronicleEntry,
  computePayloadHash,
  computeEventHash,
  computeGlobalEventHash,
} from '../../packages/shared/chronicleChain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Output dir is overridable (GEN_FIXTURES_OUT) so the deterministic slice/context
// files can be regenerated + diffed without clobbering the committed, signed
// receipts (whose Ed25519 keypair is random per run).
const FIXTURES =
  process.env.GEN_FIXTURES_OUT ?? path.resolve(__dirname, '../../packages/shared/test/fixtures');

// ---- canonical hashing (byte-identical to apps/server/src/persist/hash.ts) ----
function blake3Hex(data: string): string {
  return `blake3:${Buffer.from(blake3(new TextEncoder().encode(data))).toString('hex')}`;
}
function computeReceiptHash(receipt: object): string {
  const { event_hash: _e, signature: _s, ...content } = receipt as Record<string, unknown>;
  return blake3Hex(stableStringify(content));
}

// ---- Ed25519 keypair (raw 32-byte seed/pub, like coordination-kernel) ----
// DETERMINISTIC seed so the signed receipts + their pubkey context regenerate
// byte-identically (the test asserts the committed signature against the
// committed pubkey). Do NOT switch back to crypto.randomBytes.
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const seed = blake3(new TextEncoder().encode('akalynth:fixture:rng-v2:ed25519-seed:v1')).slice(0, 32);
const privateKey = crypto.createPrivateKey({
  key: Buffer.concat([PKCS8_PREFIX, seed]),
  format: 'der',
  type: 'pkcs8',
});
const publicKey = crypto.createPublicKey(privateKey);
// Raw 32-byte public key hex (strip SPKI DER header).
const spki = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
const authPublicKeyHex = spki.subarray(spki.length - 32).toString('hex');

function signEvent(prevHash: string, eventHash: string): string {
  const msg = Buffer.from(`${prevHash}|${eventHash}`);
  return crypto.sign(null, msg, privateKey).toString('hex');
}

// ---- scenario (mirrors combat.ts v2 path) ----
const actorId = 'did:akalynth:attacker-001';
const targetId = 'did:akalynth:victim-001'; // the SESSION actor that spawned the commit
const map = 'Azura';
const reputation = -4;
const position = { x: 12, y: 34 };
const eventDomain = 'death_drop:v1';

const inventory: ItemForDrop[] = [
  { item_id: 'item-torch-001', item_type: 'torch' },
  { item_id: 'item-ration-001', item_type: 'ration' },
  { item_id: 'item-mark-001', item_type: 'mark_token' },
  {
    item_id: 'item-legendary-001',
    item_type: 'unknown',
    meta: { legendary: true, legendary_tier: 2, heat: 7.5 },
  },
  { item_id: 'item-torch-002', item_type: 'torch' },
];

const combatResolvedBase = {
  actor_id: actorId,
  action: 'combat_resolved',
  inputs: { target_player_id: targetId, map, position, outcome: 'kill' },
  result: 'ok',
};
const seedHash = computeReceiptHash(combatResolvedBase); // === event_preimage_hash

// The reveal the server committed to on spawn, and the chronicle commit value.
const reveal = 'a'.repeat(64); // 32-byte hex (matches rngRevealHex32 shape)
const commit = rngCommitV1(eventDomain, targetId, reveal);

// v2 derived seed + drops via the SAME shared functions the server uses.
const derivedSeed = rngDeriveSeedV2(reveal, map, eventDomain, seedHash);
const heatLookup = new Map<string, number>();
for (const it of inventory) {
  const h = it.meta?.['heat'];
  if (typeof h === 'number') heatLookup.set(it.item_id, h);
}
const rngOut: number[] = [];
const droppedItemIds = computeDeathDrops(
  inventory,
  map,
  reputation,
  derivedSeed,
  rngOut,
  heatLookup
).droppedItemIds;

const rngProofItems = inventory.map((item) => {
  const isLegendary = !!item.meta?.legendary;
  return {
    item_id: item.item_id,
    item_type: item.item_type,
    ...(isLegendary
      ? {
          meta: {
            legendary: true,
            legendary_tier:
              typeof item.meta?.legendary_tier === 'number' ? item.meta.legendary_tier : 1,
            heat: typeof item.meta?.['heat'] === 'number' ? item.meta['heat'] : 0,
          },
        }
      : {}),
  };
});

// Chronicle ordering: commit(seq=10) < outcome(seq=20) < reveal(seq=30).
const COMMIT_SEQ = 10;
const OUTCOME_SEQ = 20;
const REVEAL_SEQ = 30;

function buildProof(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    version: 2,
    scheme: 'precommit_reveal_v2',
    outcome_type: 'loot_drop',
    precommit_ref: { chronicle_seq: COMMIT_SEQ, chronicle_hash: 'blake3:' + 'cc'.repeat(32), commit },
    event_preimage_hash: seedHash,
    event_domain: eventDomain,
    world_id: map,
    rng_out: rngOut,
    derivation: {
      algorithm: 'rngDeriveSeedV2->rngDrawU32Legacy/selectItemsToDrop@v2',
      inputs: { items: rngProofItems, reputation, map, protected_item_id: null },
    },
    ...(overrides ?? {}),
  };
}

// Build the receipt body, compute the kernel event_hash + signature.
function buildReceipt(opts: {
  seq: number;
  proof: Record<string, unknown>;
  droppedOverride?: string[];
  sign: boolean;
}): Record<string, unknown> {
  const timestamp = '2026-05-31T12:00:00.000Z';
  const prev_hash = 'blake3:' + 'ab'.repeat(32);
  const inputs = {
    target_player_id: targetId,
    map,
    position,
    outcome: 'kill',
    dropped_item_ids: opts.droppedOverride ?? droppedItemIds,
    drop_seed_hash: seedHash,
    protected_item_id: null,
    rng_proof: opts.proof,
  };
  const result = 'ok';
  const inputs_hash = blake3Hex(stableStringify(inputs));
  const outputs_hash = blake3Hex(stableStringify(result));
  const body = {
    sequence: opts.seq,
    timestamp,
    prev_hash,
    actor_id: actorId,
    action: 'combat_resolved',
    inputs,
    result,
    inputs_hash,
    outputs_hash,
  };
  const event_hash = blake3Hex(stableStringify(body));
  const receipt: Record<string, unknown> = { ...body, event_hash };
  if (opts.sign) {
    receipt.signature = signEvent(prev_hash, event_hash);
  } else {
    receipt.signature = 'de'.repeat(64); // placeholder (not a valid signature)
  }
  return receipt;
}

function write(name: string, obj: unknown): void {
  fs.writeFileSync(path.join(FIXTURES, name), JSON.stringify(obj, null, 2) + '\n');
  console.log(`wrote ${name}`);
}

// ---- verified case: real signature, used WITH pubkey + chronicle context ----
const verified = buildReceipt({ seq: OUTCOME_SEQ, proof: buildProof(), sign: true });
write('rng-v2-anchored-verified.json', verified);

// ===========================================================================
// #104: chronicle-GLOBAL-CHAIN slice contexts (ordering proof).
// ===========================================================================
// Build ORDERED chronicle slices with a correct Seal 2.3 global hash chain,
// using the SHARED chain computation (computePayloadHash/computeEventHash/
// computeGlobalEventHash) — the SAME functions verify-chronicle-chain.ts uses,
// so the fixtures cannot diverge from the verifier's recomputation.
const WORLD_ID = map;
const RULEBOOK_ROOT = 'blake3:rulebook-root-fixture';

function computeCapsHash(caps: string[]): string {
  return blake3Hex(stableStringify(caps ?? []));
}

type ChainState = {
  lastByActor: Map<string, string>;
  lastGlobal: string;
  // #107: line-level chain state — the whole previous log line.
  prevLine: string | null;
};

// Raw blake3 hex (no `blake3:` prefix) — matches the Rust chronicle writer's
// blake3_hex used for line_event_hash / line_prev_hash.
function lineBlake3Hex(s: string): string {
  return Buffer.from(blake3(Buffer.from(s, 'utf8'))).toString('hex');
}

function makeEntry(
  spec: { event_type: string; actor: string; tick: number; payload: Record<string, unknown> },
  state: ChainState
): ChronicleEntry {
  const caps: string[] = [];
  const entry: ChronicleEntry = {
    v: 1,
    world_id: WORLD_ID,
    rulebook_root: RULEBOOK_ROOT,
    tick: spec.tick,
    event_type: spec.event_type,
    actor: spec.actor,
    caps_hash: computeCapsHash(caps),
    caps,
    payload: { ...spec.payload },
  };
  const payload_hash = computePayloadHash(entry.payload);
  const prev_event_hash = state.lastByActor.get(entry.actor) ?? 'genesis';
  const event_hash = computeEventHash(entry, prev_event_hash, payload_hash);
  const prev_global_hash = state.lastGlobal;
  const global_event_hash = computeGlobalEventHash(
    entry,
    payload_hash,
    event_hash,
    prev_global_hash
  );
  entry.payload.payload_hash = payload_hash;
  entry.payload.prev_event_hash = prev_event_hash;
  entry.payload.event_hash = event_hash;
  entry.payload.prev_global_hash = prev_global_hash;
  entry.payload.global_event_hash = global_event_hash;
  state.lastByActor.set(entry.actor, event_hash);
  state.lastGlobal = global_event_hash;

  // #107: line-level signed fields. The chronicle log line is
  //   <line_prev_hash>|<line_event_hash>|<signature>|<canonical_json>
  // line_event_hash = blake3_hex(canonical_json) (RAW hex), line_prev_hash =
  // blake3_hex(previous whole line) or "genesis", signature = Ed25519 over
  // `${line_prev_hash}|${line_event_hash}` with the SAME raw-seed key that signs
  // receipts. We use the FULL entry (with embedded chain fields) as the canonical
  // JSON payload — what the writer serializes per line.
  const canonical_json = stableStringify(entry);
  const line_event_hash = lineBlake3Hex(canonical_json);
  const line_prev_hash =
    state.prevLine === null ? 'genesis' : lineBlake3Hex(state.prevLine);
  const signature = signEvent(line_prev_hash, line_event_hash);
  entry.line_prev_hash = line_prev_hash;
  entry.line_event_hash = line_event_hash;
  entry.signature = signature;
  entry.canonical_json = canonical_json;
  state.prevLine = `${line_prev_hash}|${line_event_hash}|${signature}|${canonical_json}`;
  return entry;
}

const commitPayload = () => ({ rng_domain: eventDomain, rng_commit: commit });
const revealPayload = () => ({ rng_domain: eventDomain, rng_commit: commit, rng_reveal: reveal });
// The death event carries the linkage the verifier matches on (drop_seed_hash =
// the combat seed = proof.event_preimage_hash). We deliberately do NOT embed the
// raw rng_out / commit here: the v2 outcome proof lives in the receipt, and the
// session's commit/reveal binding is verified from the rng_commit / rng_reveal
// events. (This also keeps the slice consistent with verify-chronicle-chain's
// generic rng_out path, which is v0-only.)
const deathPayload = () => ({
  player_id: targetId,
  map: WORLD_ID,
  x: position.x,
  y: position.y,
  cause: 'killed_by_player',
  killer_id: actorId,
  drop_seed_hash: seedHash,
  dropped_item_ids: droppedItemIds,
});

function buildSlice(order: Array<'commit' | 'death' | 'reveal' | 'noise'>): ChronicleEntry[] {
  const state: ChainState = { lastByActor: new Map(), lastGlobal: 'genesis', prevLine: null };
  const out: ChronicleEntry[] = [];
  let tick = 100;
  for (const ev of order) {
    tick += 1;
    if (ev === 'noise') {
      out.push(
        makeEntry(
          { event_type: 'move', actor: 'did:akalynth:bystander-001', tick, payload: { to: { x: 1, y: 2 } } },
          state
        )
      );
      continue;
    }
    const event_type = ev === 'commit' ? 'rng_commit' : ev === 'reveal' ? 'rng_reveal' : 'death';
    const payload = ev === 'commit' ? commitPayload() : ev === 'reveal' ? revealPayload() : deathPayload();
    out.push(makeEntry({ event_type, actor: targetId, tick, payload }, state));
  }
  return out;
}

// Valid ordered slice (commit < death < reveal), with unrelated noise.
const validSlice = buildSlice(['commit', 'noise', 'death', 'noise', 'reveal']);
// #107: the AUTHENTICATED case — signing pubkey present, so the slice's line
// signatures verify → ordering trusted → "verified" (receipt is signed by the
// SAME key). signingPublicKeyHex IS the raw-seed signing key (= authPublicKeyHex
// here, since the fixture key signs both receipts AND chronicle events).
write('rng-v2-slice-valid-pubkey.context.json', {
  chronicle: validSlice,
  signingPublicKeyHex: authPublicKeyHex,
});
// No signing pubkey → slice cannot be authenticated → rng_consistent.
write('rng-v2-slice-valid-no-pubkey.context.json', { chronicle: validSlice });

// #107: authentic ordering but one line signature is corrupted (PRESENT but
// INVALID) → SLICE_SIGNATURE_INVALID → failed. Flip a byte of the death event's
// signature; the global chain + ordering are untouched, isolating the line-auth
// failure.
const tamperedSigSlice = buildSlice(['commit', 'noise', 'death', 'noise', 'reveal']);
const deathIdx = tamperedSigSlice.findIndex((e) => e.event_type === 'death');
const origSig = tamperedSigSlice[deathIdx].signature as string;
// Flip the first hex nibble so it stays valid hex but is the wrong signature.
const flipped = (origSig[0] === '0' ? '1' : '0') + origSig.slice(1);
tamperedSigSlice[deathIdx].signature = flipped;
write('rng-v2-slice-invalid-signature.context.json', {
  chronicle: tamperedSigSlice,
  signingPublicKeyHex: authPublicKeyHex,
});

// Commit recorded AFTER the death (mis-order #101 could not catch).
write('rng-v2-slice-commit-out-of-order.context.json', {
  chronicle: buildSlice(['death', 'commit', 'reveal']),
});

// Reveal not yet published (commit < death, no reveal).
write('rng-v2-slice-reveal-pending.context.json', { chronicle: buildSlice(['commit', 'death']) });

// Death event missing / no matching drop_seed_hash.
write('rng-v2-slice-no-death.context.json', { chronicle: buildSlice(['commit', 'reveal']) });

// Broken global-chain link: corrupt the death event's global_event_hash.
const brokenSlice = buildSlice(['commit', 'death', 'reveal']);
brokenSlice[1].payload.global_event_hash = 'blake3:' + 'de'.repeat(32);
write('rng-v2-slice-broken-link.context.json', { chronicle: brokenSlice });

// No-slice deprecated reveal-only binding path (no ordering proof).
write('rng-v2-no-slice-reveal.context.json', { revealSeed: reveal });

// ---- tampered rng_out ----
const badOut = rngOut.slice();
badOut[0] = (badOut[0] ^ 0x1) >>> 0;
write(
  'rng-v2-tampered-rng-out.json',
  buildReceipt({ seq: OUTCOME_SEQ, proof: buildProof({ rng_out: badOut }), sign: false })
);

// ---- tampered outcome ----
const wrongDrop = droppedItemIds.length > 0 ? droppedItemIds.slice(0, -1) : ['item-torch-001'];
write(
  'rng-v2-tampered-outcome.json',
  buildReceipt({ seq: OUTCOME_SEQ, proof: buildProof(), droppedOverride: wrongDrop, sign: false })
);

// ---- precommit mismatch: precommit_ref.commit no longer binds the reveal ----
write(
  'rng-v2-precommit-mismatch.json',
  buildReceipt({
    seq: OUTCOME_SEQ,
    proof: buildProof({
      precommit_ref: {
        chronicle_seq: COMMIT_SEQ,
        chronicle_hash: 'blake3:' + 'cc'.repeat(32),
        commit: 'blake3:' + 'de'.repeat(32),
      },
    }),
    sign: false,
  })
);

console.log('\nauthPublicKeyHex =', authPublicKeyHex);
console.log('seedHash =', seedHash);
console.log('derivedSeed =', derivedSeed);
console.log('droppedItemIds =', JSON.stringify(droppedItemIds));
console.log('rngOut =', JSON.stringify(rngOut));
