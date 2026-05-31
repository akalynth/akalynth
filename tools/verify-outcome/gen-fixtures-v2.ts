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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../packages/shared/test/fixtures');

// ---- canonical hashing (byte-identical to apps/server/src/persist/hash.ts) ----
function blake3Hex(data: string): string {
  return `blake3:${Buffer.from(blake3(new TextEncoder().encode(data))).toString('hex')}`;
}
function computeReceiptHash(receipt: object): string {
  const { event_hash: _e, signature: _s, ...content } = receipt as Record<string, unknown>;
  return blake3Hex(stableStringify(content));
}

// ---- Ed25519 keypair (raw 32-byte seed/pub, like coordination-kernel) ----
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const seed = crypto.randomBytes(32);
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

// Sidecar chronicle/pubkey context for the verified + no-pubkey cases.
const contextWithReveal = {
  commitEvent: { seq: COMMIT_SEQ, rng_commit: commit, actor: targetId },
  revealEvent: { seq: REVEAL_SEQ, rng_reveal: reveal, actor: targetId },
  outcomeSeq: OUTCOME_SEQ,
};
write('rng-v2-anchored-verified.context.json', { ...contextWithReveal, authPublicKeyHex });
write('rng-v2-anchored-no-pubkey.context.json', { ...contextWithReveal });

// reveal-pending: commit present, NO reveal event yet.
write('rng-v2-reveal-pending.context.json', {
  commitEvent: { seq: COMMIT_SEQ, rng_commit: commit, actor: targetId },
  outcomeSeq: OUTCOME_SEQ,
});

// commit-out-of-order: commit seq > outcome seq.
write('rng-v2-commit-out-of-order.context.json', {
  commitEvent: { seq: OUTCOME_SEQ + 5, rng_commit: commit, actor: targetId },
  revealEvent: { seq: REVEAL_SEQ, rng_reveal: reveal, actor: targetId },
  outcomeSeq: OUTCOME_SEQ,
});

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
