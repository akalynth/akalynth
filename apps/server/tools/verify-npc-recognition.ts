// Verify NPC Recognition v0
// Tests tier resolution, place gating, and read-only behavior

import {
  clearPresenceProjection,
  registerMapPlaces,
  onPlayerMoved,
  onPresenceTick,
  hasLingered,
  hasBeenObserved,
  getCurrentPlace,
  applyReceiptToPresence,
} from '../src/world/presence.js';
import {
  getNpcDef,
  resolveDialogueTier,
  buildNpcDialogue,
  getNpcIntent,
  getAllNpcIds,
} from '../src/world/npcs.js';
import type { NpcDef } from '../src/world/npcs.js';
import type { NpcRecognitionTier } from '../../../packages/shared/protocol.js';
import type { AuditReceipt, MapData } from '../../../packages/shared/types.js';
import {
  PRESENCE_LINGER_THRESHOLD_MS,
  PRESENCE_OBSERVE_THRESHOLD_MS,
} from '../../../packages/shared/types.js';
import {
  computeEventHash,
  computeInputsHash,
  computeOutputsHash,
  GENESIS_MARKER,
} from '@akalynth/coordination-kernel';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err}`);
    process.exit(1);
  }
}

function assertEquals<T>(actual: T, expected: T, msg?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Collect receipts to verify no emissions from NPC dialogue
const receipts: AuditReceipt[] = [];
let lastEventHash: string | null = null;
let lastSequence = 0;

function buildReceipt(
  receipt: Omit<AuditReceipt, 'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'>,
  useChain: boolean
): AuditReceipt {
  const timestamp = new Date().toISOString();
  const prev_hash = useChain ? (lastEventHash ?? GENESIS_MARKER) : GENESIS_MARKER;
  const sequence = useChain ? lastSequence + 1 : 0;
  const inputs_hash = computeInputsHash(receipt.inputs);
  const outputs_hash = computeOutputsHash(receipt.result);
  const body = {
    ...receipt,
    sequence,
    timestamp,
    prev_hash,
    inputs_hash,
    outputs_hash,
  };
  const event_hash = computeEventHash(body);
  const fullReceipt: AuditReceipt = {
    ...body,
    event_hash,
    signature: 'test-signature',
  };

  if (useChain) {
    lastEventHash = event_hash;
    lastSequence = sequence;
  }

  return fullReceipt;
}

function mockWriteReceipt(
  receipt: Omit<AuditReceipt, 'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'>
) {
  const fullReceipt = buildReceipt(receipt, true);
  receipts.push(fullReceipt);
  applyReceiptToPresence(fullReceipt);
}

// Mock map data matching NPC registry places
const rookguardMap: MapData = {
  name: 'Rookguard',
  width: 64,
  height: 64,
  spawn: { x: 32, y: 32 },
  tiles: new Array(64 * 64).fill(0),
  landmarks: {
    guild_hall: { x: 10, y: 10, width: 10, height: 10 },
    house_plots: [],
    plaza: { x: 40, y: 40, width: 8, height: 8 },
  },
};

const azuraMap: MapData = {
  name: 'Azura',
  width: 64,
  height: 64,
  spawn: { x: 32, y: 32 },
  tiles: new Array(64 * 64).fill(0),
  landmarks: {
    guild_hall: { x: 10, y: 10, width: 10, height: 10 },
    house_plots: [],
    plaza: { x: 40, y: 40, width: 8, height: 8 },
  },
};

// Reset state before tests
function resetState() {
  clearPresenceProjection();
  receipts.length = 0;
  lastEventHash = null;
  lastSequence = 0;
  registerMapPlaces(rookguardMap, 'Rookguard');
  registerMapPlaces(azuraMap, 'Azura');
}

// ============================================================================
// Tests
// ============================================================================

test('getNpcDef returns null for unknown NPC', () => {
  const npc = getNpcDef('unknown_npc');
  assertEquals(npc, null, 'unknown NPC should return null');
});

const ALL_TIERS: NpcRecognitionTier[] = ['stranger', 'seen', 'recognized'];

test('getNpcDef returns valid NPC definitions', () => {
  const herald = getNpcDef('rookguard_herald');
  assertEquals(herald !== null, true, 'rookguard_herald should exist');
  assertEquals(herald?.place_id, 'rookguard:plaza', 'herald should be in plaza');
  for (const tier of ALL_TIERS) {
    const contract = herald?.tiers[tier];
    assertEquals(typeof contract?.intent_id, 'string', `${tier} should have intent_id`);
    assertEquals((contract?.openers.length ?? 0) > 0, true, `${tier} should have >=1 opener`);
  }
});

test('all registered NPCs have valid contracts (intent + opener per tier)', () => {
  const npcIds = getAllNpcIds();
  assertEquals(npcIds.length >= 4, true, 'should have at least 4 NPCs');

  for (const npcId of npcIds) {
    const npc = getNpcDef(npcId);
    assertEquals(npc !== null, true, `${npcId} should exist`);
    for (const tier of ALL_TIERS) {
      const contract = npc?.tiers[tier];
      assertEquals(typeof contract?.intent_id, 'string', `${npcId}.${tier} needs intent_id`);
      assertEquals((contract?.openers.length ?? 0) > 0, true, `${npcId}.${tier} needs an opener`);
    }
  }
});

test('default tier is stranger', () => {
  resetState();
  const now = Date.now();

  // Player enters plaza but has no presence history
  onPlayerMoved('player-1', 'Rookguard', 44, 44, now, mockWriteReceipt);
  assertEquals(getCurrentPlace('player-1'), 'rookguard:plaza', 'should be in plaza');

  const tier = resolveDialogueTier('player-1', 'rookguard:plaza');
  assertEquals(tier, 'stranger', 'default tier should be stranger');
});

test('presence_observed triggers seen tier', () => {
  resetState();
  const now = Date.now();

  // Two players enter same place
  onPlayerMoved('player-2', 'Rookguard', 44, 44, now, mockWriteReceipt);
  onPlayerMoved('player-3', 'Rookguard', 45, 45, now + 100, mockWriteReceipt);

  // First tick starts tracking
  onPresenceTick('player-2', now + 1000, mockWriteReceipt);

  // Should still be stranger (tracking just started)
  assertEquals(resolveDialogueTier('player-2', 'rookguard:plaza'), 'stranger', 'before threshold: stranger');

  // Second tick passes threshold
  onPresenceTick('player-2', now + 1000 + PRESENCE_OBSERVE_THRESHOLD_MS + 1000, mockWriteReceipt);

  // Now should be seen
  assertEquals(hasBeenObserved('player-2', 'rookguard:plaza'), true, 'should be observed');
  assertEquals(resolveDialogueTier('player-2', 'rookguard:plaza'), 'seen', 'after observe: seen');
});

test('presence_lingered triggers recognized tier', () => {
  resetState();
  const now = Date.now();

  // Player enters plaza
  onPlayerMoved('player-4', 'Rookguard', 44, 44, now, mockWriteReceipt);

  // Should be stranger before linger
  assertEquals(resolveDialogueTier('player-4', 'rookguard:plaza'), 'stranger', 'before linger: stranger');

  // Tick past linger threshold
  onPresenceTick('player-4', now + PRESENCE_LINGER_THRESHOLD_MS + 1000, mockWriteReceipt);

  // Now should be recognized
  assertEquals(hasLingered('player-4', 'rookguard:plaza'), true, 'should have lingered');
  assertEquals(resolveDialogueTier('player-4', 'rookguard:plaza'), 'recognized', 'after linger: recognized');
});

test('recognized overrides seen', () => {
  resetState();
  const now = Date.now();

  // Two players enter same place
  onPlayerMoved('player-5', 'Rookguard', 44, 44, now, mockWriteReceipt);
  onPlayerMoved('player-6', 'Rookguard', 45, 45, now + 100, mockWriteReceipt);

  // First tick starts co-presence tracking
  onPresenceTick('player-5', now + 1000, mockWriteReceipt);

  // Tick past both observe AND linger thresholds
  onPresenceTick('player-5', now + PRESENCE_LINGER_THRESHOLD_MS + 1000, mockWriteReceipt);

  // Should have both signals
  assertEquals(hasBeenObserved('player-5', 'rookguard:plaza'), true, 'should be observed');
  assertEquals(hasLingered('player-5', 'rookguard:plaza'), true, 'should have lingered');

  // recognized should win
  assertEquals(resolveDialogueTier('player-5', 'rookguard:plaza'), 'recognized', 'recognized overrides seen');
});

test('buildNpcDialogue: must_convey facts always surface regardless of variation', () => {
  for (const npcId of getAllNpcIds()) {
    const npc = getNpcDef(npcId)!;
    for (const tier of ALL_TIERS) {
      const mustFacts = npc.tiers[tier].must_convey;
      if (mustFacts.length === 0) continue;
      // Sweep many nonces; every must_convey text must appear in every line.
      for (let nonce = 0; nonce < 24; nonce++) {
        const line = buildNpcDialogue(npc, tier, { playerId: 'player-X', nonce });
        for (const fact of mustFacts) {
          assertEquals(
            line.includes(fact.text),
            true,
            `${npcId}.${tier} nonce=${nonce} must convey "${fact.fact_id}"`,
          );
        }
      }
    }
  }
});

test('buildNpcDialogue: intent is invariant across variation', () => {
  // The "same thing" — intent_id — never depends on the seed.
  const npc = getNpcDef('azura_steward')!;
  assertEquals(getNpcIntent(npc, 'stranger'), 'azura_steward_intro', 'intent stable');
  assertEquals(getNpcIntent(npc, 'recognized'), 'azura_steward_ledger', 'intent stable');
});

test('buildNpcDialogue: deterministic for identical seed', () => {
  const npc = getNpcDef('azura_herald')!;
  const a = buildNpcDialogue(npc, 'stranger', { playerId: 'player-D', nonce: 7 });
  const b = buildNpcDialogue(npc, 'stranger', { playerId: 'player-D', nonce: 7 });
  assertEquals(a, b, 'same seed must produce identical line (replayable)');
});

test('buildNpcDialogue: varies the surface across nonces (same thing, said different)', () => {
  const npc = getNpcDef('azura_herald')!;
  const variants = new Set<string>();
  for (let nonce = 0; nonce < 16; nonce++) {
    variants.add(buildNpcDialogue(npc, 'stranger', { playerId: 'player-V', nonce }));
  }
  // With 3 openers and 2 optional facts there must be real surface variety.
  assertEquals(variants.size >= 3, true, `expected varied lines, got ${variants.size}`);
});

test('buildNpcDialogue: tiers express distinct intents', () => {
  const npc = getNpcDef('rookguard_herald')!;
  const intents = new Set(ALL_TIERS.map(t => getNpcIntent(npc, t)));
  assertEquals(intents.size, 3, 'each tier should have a distinct intent');
});

test('NPC place gating - different place returns different tier', () => {
  resetState();
  const now = Date.now();

  // Player lingers in plaza
  onPlayerMoved('player-7', 'Rookguard', 44, 44, now, mockWriteReceipt);
  onPresenceTick('player-7', now + PRESENCE_LINGER_THRESHOLD_MS + 1000, mockWriteReceipt);

  // Recognized in plaza
  assertEquals(resolveDialogueTier('player-7', 'rookguard:plaza'), 'recognized', 'recognized in plaza');

  // But stranger in guild_hall (never visited)
  assertEquals(resolveDialogueTier('player-7', 'rookguard:guild_hall'), 'stranger', 'stranger in guild_hall');
});

test('dialogue tier is deterministic', () => {
  resetState();
  const now = Date.now();

  // Build up presence state
  onPlayerMoved('player-8', 'Rookguard', 44, 44, now, mockWriteReceipt);
  onPresenceTick('player-8', now + PRESENCE_LINGER_THRESHOLD_MS + 1000, mockWriteReceipt);

  // Query multiple times - should always return same tier
  const tier1 = resolveDialogueTier('player-8', 'rookguard:plaza');
  const tier2 = resolveDialogueTier('player-8', 'rookguard:plaza');
  const tier3 = resolveDialogueTier('player-8', 'rookguard:plaza');

  assertEquals(tier1, 'recognized', 'first query');
  assertEquals(tier2, 'recognized', 'second query');
  assertEquals(tier3, 'recognized', 'third query');
});

test('no receipts emitted from tier resolution', () => {
  resetState();
  const now = Date.now();

  // Move player and let them linger
  onPlayerMoved('player-9', 'Rookguard', 44, 44, now, mockWriteReceipt);
  onPresenceTick('player-9', now + PRESENCE_LINGER_THRESHOLD_MS + 1000, mockWriteReceipt);

  const receiptCountBefore = receipts.length;

  // Resolve tier multiple times
  resolveDialogueTier('player-9', 'rookguard:plaza');
  resolveDialogueTier('player-9', 'rookguard:plaza');
  resolveDialogueTier('player-9', 'rookguard:plaza');

  // Build dialogue
  const npc = getNpcDef('rookguard_herald')!;
  buildNpcDialogue(npc, 'recognized');
  buildNpcDialogue(npc, 'seen');
  buildNpcDialogue(npc, 'stranger');

  const receiptCountAfter = receipts.length;

  assertEquals(receiptCountAfter, receiptCountBefore, 'no receipts should be emitted from NPC logic');
});

test('Azura NPCs work correctly', () => {
  resetState();
  const now = Date.now();

  // Player enters Azura plaza
  onPlayerMoved('player-10', 'Azura', 44, 44, now, mockWriteReceipt);
  assertEquals(getCurrentPlace('player-10'), 'azura:plaza', 'should be in azura plaza');

  // Default is stranger
  assertEquals(resolveDialogueTier('player-10', 'azura:plaza'), 'stranger', 'default stranger in azura');

  // Linger
  onPresenceTick('player-10', now + PRESENCE_LINGER_THRESHOLD_MS + 1000, mockWriteReceipt);
  assertEquals(resolveDialogueTier('player-10', 'azura:plaza'), 'recognized', 'recognized in azura');

  // Get dialogue from azura herald
  const herald = getNpcDef('azura_herald');
  assertEquals(herald !== null, true, 'azura herald should exist');
  assertEquals(herald?.place_id, 'azura:plaza', 'azura herald in azura plaza');
});

console.log('\n✓ All NPC recognition tests passed');
