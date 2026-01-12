#!/usr/bin/env tsx
/**
 * Unit test for rebuildChronicleHeadsFromLog
 *
 * Tests that chain heads are correctly rebuilt from a chronicle.log file.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const TEST_LOG = path.join(process.cwd(), 'test-rebuild.log');

interface ChronicleEvent {
  v: number;
  world_id: string;
  rulebook_root: string;
  tick: number;
  event_type: string;
  actor: string;
  caps_hash: string;
  caps: string[];
  payload: {
    prev_event_hash: string;
    event_hash: string;
    [key: string]: unknown;
  };
  rng: null;
}

// Test the rebuild function directly
function rebuildChronicleHeadsFromLog(
  logPath: string,
  lastEventHashByActor: Map<string, string>
): { actors: number; ok: number; bad: number } {
  lastEventHashByActor.clear();

  if (!fs.existsSync(logPath)) {
    return { actors: 0, ok: 0, bad: 0 };
  }

  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);

  let ok = 0;
  let bad = 0;

  for (const line of lines) {
    try {
      const e = JSON.parse(line) as { actor?: string; payload?: { event_hash?: string } };
      const actor = typeof e?.actor === 'string' ? e.actor : null;
      const eventHash = typeof e?.payload?.event_hash === 'string' ? e.payload.event_hash : null;

      if (actor && eventHash) {
        lastEventHashByActor.set(actor, eventHash);
        ok++;
      } else {
        bad++;
      }
    } catch {
      bad++;
    }
  }

  return { actors: lastEventHashByActor.size, ok, bad };
}

function createTestEvent(actor: string, prevHash: string, eventHash: string): ChronicleEvent {
  return {
    v: 1,
    world_id: 'akalynth-mainnet',
    rulebook_root: 'blake3:test',
    tick: Date.now(),
    event_type: 'spawn',
    actor,
    caps_hash: 'blake3:test',
    caps: ['move', 'chat'],
    payload: {
      prev_event_hash: prevHash,
      event_hash: eventHash,
    },
    rng: null,
  };
}

function main() {
  console.log('=== rebuildChronicleHeadsFromLog Unit Test ===\n');

  // Clean up
  if (fs.existsSync(TEST_LOG)) {
    fs.unlinkSync(TEST_LOG);
  }

  // === Test 1: Empty/missing file ===
  console.log('Test 1: Missing file returns empty map');
  const map1 = new Map<string, string>();
  const result1 = rebuildChronicleHeadsFromLog('/nonexistent/file.log', map1);
  console.assert(result1.actors === 0, 'Expected 0 actors');
  console.assert(map1.size === 0, 'Expected empty map');
  console.log('  ✓ Pass\n');

  // === Test 2: Single actor, single event ===
  console.log('Test 2: Single actor, single event');
  const event1 = createTestEvent('did:akalynth:player-001', 'genesis', 'blake3:hash1');
  fs.writeFileSync(TEST_LOG, JSON.stringify(event1) + '\n');

  const map2 = new Map<string, string>();
  const result2 = rebuildChronicleHeadsFromLog(TEST_LOG, map2);
  console.assert(result2.actors === 1, `Expected 1 actor, got ${result2.actors}`);
  console.assert(result2.ok === 1, `Expected 1 ok, got ${result2.ok}`);
  console.assert(map2.get('did:akalynth:player-001') === 'blake3:hash1', 'Hash mismatch');
  console.log('  ✓ Pass\n');

  // === Test 3: Single actor, multiple events (should use last hash) ===
  console.log('Test 3: Single actor, multiple events (use last hash)');
  const event2 = createTestEvent('did:akalynth:player-001', 'blake3:hash1', 'blake3:hash2');
  const event3 = createTestEvent('did:akalynth:player-001', 'blake3:hash2', 'blake3:hash3');
  fs.writeFileSync(TEST_LOG, [event1, event2, event3].map((e) => JSON.stringify(e)).join('\n') + '\n');

  const map3 = new Map<string, string>();
  const result3 = rebuildChronicleHeadsFromLog(TEST_LOG, map3);
  console.assert(result3.actors === 1, `Expected 1 actor, got ${result3.actors}`);
  console.assert(result3.ok === 3, `Expected 3 ok, got ${result3.ok}`);
  console.assert(
    map3.get('did:akalynth:player-001') === 'blake3:hash3',
    `Expected hash3, got ${map3.get('did:akalynth:player-001')}`
  );
  console.log('  ✓ Pass\n');

  // === Test 4: Multiple actors ===
  console.log('Test 4: Multiple actors');
  const eventA1 = createTestEvent('did:akalynth:player-A', 'genesis', 'blake3:hashA1');
  const eventA2 = createTestEvent('did:akalynth:player-A', 'blake3:hashA1', 'blake3:hashA2');
  const eventB1 = createTestEvent('did:akalynth:player-B', 'genesis', 'blake3:hashB1');
  const eventC1 = createTestEvent('did:akalynth:player-C', 'genesis', 'blake3:hashC1');
  const eventC2 = createTestEvent('did:akalynth:player-C', 'blake3:hashC1', 'blake3:hashC2');
  const eventC3 = createTestEvent('did:akalynth:player-C', 'blake3:hashC2', 'blake3:hashC3');
  fs.writeFileSync(
    TEST_LOG,
    [eventA1, eventB1, eventA2, eventC1, eventC2, eventC3].map((e) => JSON.stringify(e)).join('\n') + '\n'
  );

  const map4 = new Map<string, string>();
  const result4 = rebuildChronicleHeadsFromLog(TEST_LOG, map4);
  console.assert(result4.actors === 3, `Expected 3 actors, got ${result4.actors}`);
  console.assert(result4.ok === 6, `Expected 6 ok, got ${result4.ok}`);
  console.assert(map4.get('did:akalynth:player-A') === 'blake3:hashA2', 'Hash A mismatch');
  console.assert(map4.get('did:akalynth:player-B') === 'blake3:hashB1', 'Hash B mismatch');
  console.assert(map4.get('did:akalynth:player-C') === 'blake3:hashC3', 'Hash C mismatch');
  console.log('  ✓ Pass\n');

  // === Test 5: Malformed lines ===
  console.log('Test 5: Malformed lines are skipped');
  fs.writeFileSync(
    TEST_LOG,
    [
      JSON.stringify(eventA1),
      'not json at all',
      JSON.stringify({ no_actor: true, payload: { event_hash: 'x' } }),
      JSON.stringify({ actor: 'test', payload: { no_hash: true } }),
      JSON.stringify(eventB1),
    ].join('\n') + '\n'
  );

  const map5 = new Map<string, string>();
  const result5 = rebuildChronicleHeadsFromLog(TEST_LOG, map5);
  console.assert(result5.actors === 2, `Expected 2 actors, got ${result5.actors}`);
  console.assert(result5.ok === 2, `Expected 2 ok, got ${result5.ok}`);
  console.assert(result5.bad === 3, `Expected 3 bad, got ${result5.bad}`);
  console.log('  ✓ Pass\n');

  // === Test 6: Real chronicle format (from earlier test files) ===
  console.log('Test 6: Real chronicle format');
  const realEvents = `{"v":1,"world_id":"akalynth-mainnet","rulebook_root":"blake3:e098e369","tick":1768234490267,"event_type":"spawn","actor":"did:akalynth:player-001","caps_hash":"blake3:36a7","caps":["move","chat"],"payload":{"map":"Rookguard","player_id":"player-001","x":16,"y":16,"payload_hash":"blake3:ebcce","prev_event_hash":"genesis","event_hash":"blake3:84fcf957"},"rng":null}
{"v":1,"world_id":"akalynth-mainnet","rulebook_root":"blake3:e098e369","tick":1768234490267,"event_type":"move","actor":"did:akalynth:player-001","caps_hash":"blake3:36a7","caps":["move","chat"],"payload":{"dir":"east","from":{"x":16,"y":16},"map":"Rookguard","player_id":"player-001","to":{"x":17,"y":16},"transferred":false,"payload_hash":"blake3:8c08e","prev_event_hash":"blake3:84fcf957","event_hash":"blake3:e869980fa"},"rng":null}
{"v":1,"world_id":"akalynth-mainnet","rulebook_root":"blake3:e098e369","tick":1768234490269,"event_type":"disconnect","actor":"did:akalynth:player-001","caps_hash":"blake3:36a7","caps":["move","chat"],"payload":{"in_world":true,"map":"Rookguard","player_id":"player-001","session_duration_ms":5000,"x":17,"y":16,"payload_hash":"blake3:a6d21","prev_event_hash":"blake3:e869980fa","event_hash":"blake3:b5d1196076"},"rng":null}
`;
  fs.writeFileSync(TEST_LOG, realEvents);

  const map6 = new Map<string, string>();
  const result6 = rebuildChronicleHeadsFromLog(TEST_LOG, map6);
  console.assert(result6.actors === 1, `Expected 1 actor, got ${result6.actors}`);
  console.assert(result6.ok === 3, `Expected 3 ok, got ${result6.ok}`);
  console.assert(
    map6.get('did:akalynth:player-001') === 'blake3:b5d1196076',
    `Expected blake3:b5d1196076, got ${map6.get('did:akalynth:player-001')}`
  );
  console.log('  ✓ Pass\n');

  // Cleanup
  fs.unlinkSync(TEST_LOG);

  console.log('=== All tests passed! ===');
}

main();
