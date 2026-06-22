#!/usr/bin/env node
/**
 * SCRATCH fixture generator for F1/#100 receipt-contained RNG proof fixtures.
 *
 * Computes CORRECT values using the SAME shared rng + dropPolicy functions the
 * server uses, then writes the v1 proof fixtures, then derives the tampered
 * variants from the valid one. Run with:
 *   npx tsx tools/verify-outcome/gen-fixtures.ts
 *
 * Re-runnable and deterministic. Not part of the test suite.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rngCommit } from '../../packages/shared/rng.js';
import { computeDeathDrops, type ItemForDrop } from '../../packages/shared/dropPolicy.js';
import { blake3Prefixed, canonicalJson } from '../../packages/shared/hashPrimitive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../packages/shared/test/fixtures');

function computeReceiptHash(receipt: object): string {
  const { event_hash: _e, signature: _s, ...content } = receipt as Record<string, unknown>;
  return blake3Prefixed(canonicalJson(content));
}

// Mirror combat.ts: a Azura kill with a mixed inventory incl. a legendary.
const actorId = 'did:akalynth:attacker-001';
const targetId = 'did:akalynth:victim-001';
const map = 'Azura';
const reputation = -4;
const position = { x: 12, y: 34 };

// Full inventory snapshot computeDeathDrops consumed.
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

// combatResolvedBase — the seed preimage (NEVER includes rng_proof/drop fields).
const combatResolvedBase = {
  actor_id: actorId,
  action: 'combat_resolved',
  inputs: {
    target_player_id: targetId,
    map,
    position,
    outcome: 'kill',
  },
  result: 'ok',
};
const seedHash = computeReceiptHash(combatResolvedBase);

// Heat lookup from each legendary item's meta.heat (as the verifier reconstructs).
const heatLookup = new Map<string, number>();
for (const it of inventory) {
  const h = it.meta?.['heat'];
  if (typeof h === 'number') heatLookup.set(it.item_id, h);
}

const rngOut: number[] = [];
const dropResult = computeDeathDrops(inventory, map, reputation, seedHash, rngOut, heatLookup);
const droppedItemIds = dropResult.droppedItemIds;

// Snapshot items exactly as combat.ts persists them in derivation.inputs.items.
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

function buildReceipt(overrides: {
  droppedOverride?: string[];
  proofOverride?: Record<string, unknown>;
  seq: number;
}): Record<string, unknown> {
  const rngProof = {
    version: 1,
    scheme: 'receipt_hash_seeded_replay',
    outcome_type: 'loot_drop',
    rng_commit_scheme: 'death_drop:v0',
    receipt_body_hash: seedHash,
    rng_commit: rngCommit(seedHash),
    reveal_seed: seedHash,
    rng_out: rngOut,
    derivation: {
      algorithm: 'rngDrawU32Legacy/selectItemsToDrop@v0',
      domain: 'pvp_loot_drop',
      inputs: {
        items: rngProofItems,
        reputation,
        map,
        protected_item_id: null,
      },
    },
    ...(overrides.proofOverride ?? {}),
  };
  return {
    sequence: overrides.seq,
    timestamp: '2026-05-31T12:00:00.000Z',
    actor_id: actorId,
    action: 'combat_resolved',
    inputs: {
      target_player_id: targetId,
      map,
      position,
      outcome: 'kill',
      dropped_item_ids: overrides.droppedOverride ?? droppedItemIds,
      drop_seed_hash: seedHash,
      protected_item_id: null,
      rng_proof: rngProof,
    },
    result: 'ok',
  };
}

function write(name: string, obj: unknown): void {
  fs.writeFileSync(path.join(FIXTURES, name), JSON.stringify(obj, null, 2) + '\n');
  console.log(`wrote ${name}`);
}

// ---- valid ----
const valid = buildReceipt({ seq: 100 });
write('rng-v1-proof-valid-loot-drop.json', valid);

// ---- tampered seed: body hash + reveal_seed mutated (breaks body hash + RNG) ----
const tamperedSeed = buildReceipt({
  seq: 101,
  proofOverride: {
    receipt_body_hash: 'blake3:' + '00'.repeat(32),
    reveal_seed: 'blake3:' + '00'.repeat(32),
  },
});
// Also mutate drop_seed_hash so body hash mismatch is unambiguous.
(tamperedSeed.inputs as Record<string, unknown>).drop_seed_hash = 'blake3:' + '00'.repeat(32);
write('rng-v1-proof-tampered-seed.json', tamperedSeed);

// ---- tampered commit: rng_commit no longer binds reveal_seed -> COMMIT_MISMATCH (failed) ----
const tamperedCommit = buildReceipt({
  seq: 102,
  proofOverride: { rng_commit: 'blake3:' + 'de'.repeat(32) },
});
write('rng-v1-proof-tampered-commit.json', tamperedCommit);

// ---- tampered output: corrupt one rng_out entry ----
const badOut = rngOut.slice();
badOut[0] = (badOut[0] ^ 0x1) >>> 0;
const tamperedOutput = buildReceipt({ seq: 103, proofOverride: { rng_out: badOut } });
write('rng-v1-proof-tampered-output.json', tamperedOutput);

// ---- tampered outcome: claim a different dropped set ----
const wrongDrop = droppedItemIds.length > 0 ? droppedItemIds.slice(0, -1) : ['item-torch-001'];
const tamperedOutcome = buildReceipt({ seq: 104, droppedOverride: wrongDrop });
write('rng-v1-proof-tampered-outcome.json', tamperedOutcome);

// ---- body-hash mismatch: receipt_body_hash diverges from real seed (RNG still self-consistent on the fake seed? no) ----
// Mutate ONLY receipt_body_hash so it no longer equals the real combatResolvedBase hash.
const bodyMismatch = buildReceipt({
  seq: 105,
  proofOverride: { receipt_body_hash: 'blake3:' + 'ab'.repeat(32) },
});
write('rng-v1-proof-body-hash-mismatch.json', bodyMismatch);

// ---- unsupported outcome type ----
const unsupported = buildReceipt({
  seq: 106,
  proofOverride: { outcome_type: 'some_future_outcome' },
});
write('rng-v1-proof-unsupported-outcome.json', unsupported);

// ---- LEGITIMATE v1-commit receipt (NOT tampered) ----
// The server's death_drop:v1 path records a deferred, domain/actor-separated
// precommit that cannot be reproduced offline. Such a receipt is honest: its
// rng_out + dropped_item_ids still verify against reveal_seed, only the commit
// binding is unprovable offline. Expected: rng_commit_reveal=unsupported
// (LEGACY_PRECOMMIT_UNBOUND), outcome_derivation=pass, final_status=replay_consistent
// — NOT failed. Real v1 commit verification is deferred to #101.
const v1Legit = buildReceipt({
  seq: 107,
  proofOverride: {
    rng_commit_scheme: 'death_drop:v1',
    // A v1 precommit value (over a secret reveal, not rngCommit(seedHash)).
    rng_commit: 'blake3:' + 'a1'.repeat(32),
  },
});
write('rng-v1-proof-v1commit-legacy.json', v1Legit);

console.log('\nseedHash =', seedHash);
console.log('droppedItemIds =', JSON.stringify(droppedItemIds));
console.log('rngOut =', JSON.stringify(rngOut));
