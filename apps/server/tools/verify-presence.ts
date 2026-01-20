// Verify World Presence v0
// Tests place detection, linger threshold, co-presence, replay equivalence

import {
  clearPresenceProjection,
  registerMapPlaces,
  getPlaceAt,
  getCurrentPlace,
  hasLingered,
  getPlayersInPlace,
  onPlayerMoved,
  onPresenceTick,
  onPlayerDisconnect,
  resetSessionState,
  applyReceiptToPresence,
} from '../src/world/presence.js';
import type { AuditReceipt, MapData } from '../../../packages/shared/types.js';
import {
  PRESENCE_ENTERED_ACTION,
  PRESENCE_LINGERED_ACTION,
  PRESENCE_OBSERVED_ACTION,
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

function assertIncludes<T>(arr: T[], item: T, msg?: string) {
  if (!arr.includes(item)) {
    throw new Error(`${msg || 'Assertion failed'}: ${JSON.stringify(arr)} does not include ${JSON.stringify(item)}`);
  }
}

// Collect receipts for verification
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

// Mock map data
const mockMap: MapData = {
  name: 'TestMap',
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
  registerMapPlaces(mockMap, 'TestMap');
}

// ============================================================================
// Tests
// ============================================================================

test('registerMapPlaces registers map and landmarks', () => {
  resetState();

  // Whole map should be a place
  const mapPlace = getPlaceAt('TestMap', 32, 32);
  assertEquals(mapPlace, 'testmap', 'should be on testmap');

  // Guild hall should be a more specific place
  const guildPlace = getPlaceAt('TestMap', 15, 15);
  assertEquals(guildPlace, 'testmap:guild_hall', 'should be in guild_hall');

  // Plaza should be a more specific place
  const plazaPlace = getPlaceAt('TestMap', 44, 44);
  assertEquals(plazaPlace, 'testmap:plaza', 'should be in plaza');
});

test('onPlayerMoved emits presence_entered when place changes', () => {
  resetState();
  const now = Date.now();

  // Move player to the map
  onPlayerMoved('player-1', 'TestMap', 32, 32, now, mockWriteReceipt);

  // Should have emitted presence_entered
  const entered = receipts.filter(r => r.action === PRESENCE_ENTERED_ACTION);
  assertEquals(entered.length, 1, 'should have one presence_entered');
  assertEquals(entered[0].inputs.place_id, 'testmap', 'place_id should be testmap');
});

test('onPlayerMoved emits presence_entered when moving to landmark', () => {
  resetState();
  const now = Date.now();

  // Start on main map
  onPlayerMoved('player-2', 'TestMap', 32, 32, now, mockWriteReceipt);

  // Move to guild hall
  onPlayerMoved('player-2', 'TestMap', 15, 15, now + 1000, mockWriteReceipt);

  // Should have two presence_entered
  const entered = receipts.filter(r => r.action === PRESENCE_ENTERED_ACTION);
  assertEquals(entered.length, 2, 'should have two presence_entered');
  assertEquals(entered[1].inputs.place_id, 'testmap:guild_hall', 'second should be guild_hall');
});

test('onPlayerMoved does not emit when staying in same place', () => {
  resetState();
  const now = Date.now();

  // Move to map
  onPlayerMoved('player-3', 'TestMap', 32, 32, now, mockWriteReceipt);

  // Move within same map area
  onPlayerMoved('player-3', 'TestMap', 33, 33, now + 1000, mockWriteReceipt);

  // Should only have one presence_entered
  const entered = receipts.filter(r => r.action === PRESENCE_ENTERED_ACTION);
  assertEquals(entered.length, 1, 'should have only one presence_entered');
});

test('onPresenceTick emits presence_lingered after threshold', () => {
  resetState();
  const now = Date.now();

  // Enter a place
  onPlayerMoved('player-4', 'TestMap', 32, 32, now, mockWriteReceipt);

  // Tick before threshold (should not emit)
  onPresenceTick('player-4', now + PRESENCE_LINGER_THRESHOLD_MS - 1000, mockWriteReceipt);
  let lingered = receipts.filter(r => r.action === PRESENCE_LINGERED_ACTION);
  assertEquals(lingered.length, 0, 'should not have lingered yet');

  // Tick after threshold
  onPresenceTick('player-4', now + PRESENCE_LINGER_THRESHOLD_MS + 1000, mockWriteReceipt);
  lingered = receipts.filter(r => r.action === PRESENCE_LINGERED_ACTION);
  assertEquals(lingered.length, 1, 'should have one lingered');
  assertEquals(lingered[0].inputs.place_id, 'testmap', 'place_id should be testmap');
});

test('presence_lingered only emits once per place per session', () => {
  resetState();
  const now = Date.now();

  // Enter, wait, linger
  onPlayerMoved('player-5', 'TestMap', 32, 32, now, mockWriteReceipt);
  onPresenceTick('player-5', now + PRESENCE_LINGER_THRESHOLD_MS + 1000, mockWriteReceipt);

  // More ticks should not emit more lingered
  onPresenceTick('player-5', now + PRESENCE_LINGER_THRESHOLD_MS + 5000, mockWriteReceipt);
  onPresenceTick('player-5', now + PRESENCE_LINGER_THRESHOLD_MS + 10000, mockWriteReceipt);

  const lingered = receipts.filter(r => r.action === PRESENCE_LINGERED_ACTION);
  assertEquals(lingered.length, 1, 'should only have one lingered');
});

test('co-presence emits presence_observed after threshold', () => {
  resetState();
  const now = Date.now();

  // Two players enter same place
  onPlayerMoved('player-6', 'TestMap', 32, 32, now, mockWriteReceipt);
  onPlayerMoved('player-7', 'TestMap', 33, 33, now + 100, mockWriteReceipt);

  // First tick starts co-presence tracking (should not emit)
  onPresenceTick('player-6', now + 1000, mockWriteReceipt);
  let observed = receipts.filter(r => r.action === PRESENCE_OBSERVED_ACTION);
  assertEquals(observed.length, 0, 'should not have observed yet (tracking just started)');

  // Second tick before threshold (should not emit)
  onPresenceTick('player-6', now + PRESENCE_OBSERVE_THRESHOLD_MS - 1000, mockWriteReceipt);
  observed = receipts.filter(r => r.action === PRESENCE_OBSERVED_ACTION);
  assertEquals(observed.length, 0, 'should not have observed yet (under threshold)');

  // Third tick after threshold (from first tick)
  onPresenceTick('player-6', now + 1000 + PRESENCE_OBSERVE_THRESHOLD_MS + 1000, mockWriteReceipt);
  observed = receipts.filter(r => r.action === PRESENCE_OBSERVED_ACTION);
  assertEquals(observed.length, 2, 'should have two observed (one per player)');

  // Check both players received an observed receipt
  const player6Observed = observed.find(r => r.actor_id === 'player-6');
  const player7Observed = observed.find(r => r.actor_id === 'player-7');
  assertEquals(player6Observed?.inputs.other_player_id, 'player-7', 'player-6 observed player-7');
  assertEquals(player7Observed?.inputs.other_player_id, 'player-6', 'player-7 observed player-6');
});

test('co-presence only emits once per pair per place per session', () => {
  resetState();
  const now = Date.now();

  // Two players enter same place
  onPlayerMoved('player-8', 'TestMap', 32, 32, now, mockWriteReceipt);
  onPlayerMoved('player-9', 'TestMap', 33, 33, now + 100, mockWriteReceipt);

  // First tick starts tracking
  onPresenceTick('player-8', now + 1000, mockWriteReceipt);

  // Second tick passes threshold
  onPresenceTick('player-8', now + 1000 + PRESENCE_OBSERVE_THRESHOLD_MS + 1000, mockWriteReceipt);

  // More ticks should not emit more observed
  onPresenceTick('player-8', now + 1000 + PRESENCE_OBSERVE_THRESHOLD_MS + 5000, mockWriteReceipt);
  onPresenceTick('player-9', now + 1000 + PRESENCE_OBSERVE_THRESHOLD_MS + 10000, mockWriteReceipt);

  const observed = receipts.filter(r => r.action === PRESENCE_OBSERVED_ACTION);
  assertEquals(observed.length, 2, 'should only have two observed');
});

test('getPlayersInPlace returns players currently in place', () => {
  resetState();
  const now = Date.now();

  // Add some players
  onPlayerMoved('player-10', 'TestMap', 32, 32, now, mockWriteReceipt);
  onPlayerMoved('player-11', 'TestMap', 33, 33, now, mockWriteReceipt);
  onPlayerMoved('player-12', 'TestMap', 15, 15, now, mockWriteReceipt); // guild_hall

  const mapPlayers = getPlayersInPlace('testmap');
  assertEquals(mapPlayers.length, 2, 'should have 2 players in testmap');
  assertIncludes(mapPlayers, 'player-10', 'should include player-10');
  assertIncludes(mapPlayers, 'player-11', 'should include player-11');

  const guildPlayers = getPlayersInPlace('testmap:guild_hall');
  assertEquals(guildPlayers.length, 1, 'should have 1 player in guild_hall');
  assertEquals(guildPlayers[0], 'player-12', 'should be player-12');
});

test('onPlayerDisconnect clears player presence', () => {
  resetState();
  const now = Date.now();

  onPlayerMoved('player-13', 'TestMap', 32, 32, now, mockWriteReceipt);
  assertEquals(getPlayersInPlace('testmap').includes('player-13'), true, 'should be in place');

  onPlayerDisconnect('player-13');
  assertEquals(getPlayersInPlace('testmap').includes('player-13'), false, 'should not be in place after disconnect');
});

test('resetSessionState clears session-scoped tracking', () => {
  resetState();
  const now = Date.now();

  // Enter, linger
  onPlayerMoved('player-14', 'TestMap', 32, 32, now, mockWriteReceipt);
  onPresenceTick('player-14', now + PRESENCE_LINGER_THRESHOLD_MS + 1000, mockWriteReceipt);
  assertEquals(hasLingered('player-14', 'testmap'), true, 'should have lingered');

  // Reset session
  resetSessionState('player-14');
  assertEquals(hasLingered('player-14', 'testmap'), false, 'should not have lingered after reset');
  assertEquals(getCurrentPlace('player-14'), null, 'current place should be null');
});

test('replay equivalence - receipts reconstruct presence state', () => {
  resetState();
  const now = Date.now();

  // Build up some state
  onPlayerMoved('player-15', 'TestMap', 32, 32, now, mockWriteReceipt);
  onPresenceTick('player-15', now + PRESENCE_LINGER_THRESHOLD_MS + 1000, mockWriteReceipt);

  onPlayerMoved('player-16', 'TestMap', 33, 33, now + 100, mockWriteReceipt);
  onPresenceTick('player-15', now + PRESENCE_LINGER_THRESHOLD_MS + PRESENCE_OBSERVE_THRESHOLD_MS + 2000, mockWriteReceipt);

  const lingeredBefore = hasLingered('player-15', 'testmap');
  const currentPlaceBefore = getCurrentPlace('player-15');

  assertEquals(lingeredBefore, true, 'should have lingered before replay');
  assertEquals(currentPlaceBefore, 'testmap', 'should be in testmap before replay');

  // Clear and replay
  clearPresenceProjection();
  registerMapPlaces(mockMap, 'TestMap');

  for (const r of receipts) {
    applyReceiptToPresence(r);
  }

  const lingeredAfter = hasLingered('player-15', 'testmap');
  const currentPlaceAfter = getCurrentPlace('player-15');

  assertEquals(lingeredAfter, true, 'should have lingered after replay');
  assertEquals(currentPlaceAfter, 'testmap', 'should be in testmap after replay');
});

test('no presence receipts for unknown positions', () => {
  resetState();
  const now = Date.now();
  receipts.length = 0;

  // Move to position outside any registered map
  onPlayerMoved('player-17', 'UnknownMap', 0, 0, now, mockWriteReceipt);

  // Should not emit any receipts
  assertEquals(receipts.length, 0, 'should have no receipts for unknown map');
});

console.log('\n✓ All presence tests passed');
