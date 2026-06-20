#!/usr/bin/env node
/**
 * Tier-1 unit tests for the chill-zone gather state machine (Step 1, server-only).
 *
 * Pure-function tests over src/world/gather.ts — no DB, no WebSocket, no client.
 * Run: cd apps/server && npx tsx tools/verify-gather.test.ts   (or: npm run test:gather)
 * Mirrors the verify-*.ts convention: exit 1 on any failure, print PASS otherwise.
 */
import {
  createGatherSystem,
  startGather,
  deliver,
  tickGather,
  cancelGather,
  onPlayerLeave,
  getPlayerGather,
  getHeld,
  gatherProgressPct,
  isGatherEnabled,
  type GatherConfig,
  type GatherSystem,
} from '../src/world/gather.js';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    console.log(`  OK   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
  }
}

const CFG: GatherConfig = { gatherDurationMs: 1000, respawnCooldownMs: 5000, interactRadius: 1 };

function fresh(): GatherSystem {
  return createGatherSystem(
    CFG,
    [
      { node_id: 'n1', zone: 'Z', x: 5, y: 5, item_type: 'ley_mote' },
      { node_id: 'n2', zone: 'Z', x: 20, y: 20, item_type: 'ley_mote' },
    ],
    [{ station_id: 's1', zone: 'Z', x: 7, y: 7 }],
  );
}

function nodeOf(sys: GatherSystem, id: string) {
  return sys.zones.get('Z')!.nodes.get(id)!;
}

/** Honest way to obtain a held item: start a gather in range and let the server complete it. */
function giveHeld(sys: GatherSystem, playerId: string): void {
  startGather(sys, playerId, 'Z', 'n1', 5, 5, 0);
  tickGather(sys, CFG.gatherDurationMs);
}

// U1 — gather start
{
  const sys = fresh();
  const r = startGather(sys, 'p1', 'Z', 'n1', 5, 5, 0);
  check('U1 start ok', r.ok === true);
  check('U1 node DEPLETING', nodeOf(sys, 'n1').state === 'depleting');
  check('U1 completeAt = now + T', r.ok === true && r.complete_at_ms === 1000);
  check('U1 player GATHERING', getPlayerGather(sys, 'p1').state === 'gathering');
}

// U2 — gather completes at completeAt (and NOT before)
{
  const sys = fresh();
  startGather(sys, 'p1', 'Z', 'n1', 5, 5, 0);
  const early = tickGather(sys, 999);
  check('U2 no completion before T', early.completed.length === 0 && nodeOf(sys, 'n1').state === 'depleting');
  const eff = tickGather(sys, 1000);
  check('U2 one completion at T', eff.completed.length === 1 && eff.completed[0].item_type === 'ley_mote');
  check('U2 node DEPLETED', nodeOf(sys, 'n1').state === 'depleted');
  check('U2 respawn_at set', nodeOf(sys, 'n1').respawn_at_ms === 6000);
  check('U2 player back to IDLE', getPlayerGather(sys, 'p1').state === 'idle');
  const held = getHeld(sys, 'p1');
  check('U2 held slot filled from node', held?.item_type === 'ley_mote' && held?.source_node_id === 'n1');
}

// U3 — gather out of range rejected, no state change
{
  const sys = fresh();
  const r = startGather(sys, 'p1', 'Z', 'n1', 5, 7, 0); // manhattan = 2 > 1
  check('U3 OUT_OF_RANGE', r.ok === false && r.reason === 'OUT_OF_RANGE');
  check('U3 node untouched', nodeOf(sys, 'n1').state === 'available');
}

// U4 — gather on a non-available node rejected (DEPLETING and DEPLETED)
{
  const sys = fresh();
  startGather(sys, 'p1', 'Z', 'n1', 5, 5, 0); // n1 now DEPLETING
  const rDepleting = startGather(sys, 'p2', 'Z', 'n1', 5, 5, 0);
  check('U4 DEPLETING -> NODE_NOT_AVAILABLE', rDepleting.ok === false && rDepleting.reason === 'NODE_NOT_AVAILABLE');
  tickGather(sys, 1000); // n1 now DEPLETED
  const rDepleted = startGather(sys, 'p2', 'Z', 'n1', 5, 5, 1000);
  check('U4 DEPLETED -> NODE_NOT_AVAILABLE', rDepleted.ok === false && rDepleted.reason === 'NODE_NOT_AVAILABLE');
}

// U5 — second concurrent gather rejected (different available node)
{
  const sys = fresh();
  startGather(sys, 'p1', 'Z', 'n1', 5, 5, 0);
  const r = startGather(sys, 'p1', 'Z', 'n2', 20, 20, 10); // n2 available + in range, but p1 is busy
  check('U5 ALREADY_GATHERING', r.ok === false && r.reason === 'ALREADY_GATHERING');
}

// U6 — gather while held slot is full rejected
{
  const sys = fresh();
  giveHeld(sys, 'p1'); // p1 now holds; n1 depleted
  const r = startGather(sys, 'p1', 'Z', 'n2', 20, 20, 2000); // n2 available + in range
  check('U6 HELD_SLOT_FULL', r.ok === false && r.reason === 'HELD_SLOT_FULL');
}

// U7 — node respawns after cooldown (and NOT before)
{
  const sys = fresh();
  startGather(sys, 'p1', 'Z', 'n1', 5, 5, 0);
  tickGather(sys, 1000); // depleted, respawn_at = 6000
  const early = tickGather(sys, 5999);
  check('U7 no respawn before cooldown', early.respawned.length === 0 && nodeOf(sys, 'n1').state === 'depleted');
  const eff = tickGather(sys, 6000);
  check('U7 respawn at cooldown', eff.respawned.some((r) => r.node_id === 'n1') && nodeOf(sys, 'n1').state === 'available');
}

// U8 — cancel / disconnect mid-gather releases node, no yield
{
  const sys = fresh();
  startGather(sys, 'p1', 'Z', 'n1', 5, 5, 0);
  cancelGather(sys, 'p1');
  check('U8 cancel releases node', nodeOf(sys, 'n1').state === 'available');
  check('U8 cancel -> IDLE, no held', getPlayerGather(sys, 'p1').state === 'idle' && getHeld(sys, 'p1') === null);

  const sys2 = fresh();
  startGather(sys2, 'p1', 'Z', 'n1', 5, 5, 0);
  onPlayerLeave(sys2, 'p1');
  check('U8 leave releases node + clears state', nodeOf(sys2, 'n1').state === 'available' && !sys2.gatherByPlayer.has('p1'));
}

// U9 — deliver with held item in station range
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  const r = deliver(sys, 'p1', 'Z', 's1', 7, 7);
  check('U9 deliver ok', r.ok === true);
  check(
    'U9 record fields (U13)',
    r.ok === true &&
      r.record.player_id === 'p1' &&
      r.record.item_type === 'ley_mote' &&
      r.record.station_id === 's1' &&
      r.record.source_node_id === 'n1' &&
      r.record.zone === 'Z',
  );
  check('U9 held slot emptied', getHeld(sys, 'p1') === null);
}

// U10 — deliver with empty slot rejected, no record
{
  const sys = fresh();
  const r = deliver(sys, 'p1', 'Z', 's1', 7, 7);
  check('U10 HELD_SLOT_EMPTY', r.ok === false && r.reason === 'HELD_SLOT_EMPTY');
}

// U11 — deliver out of station range rejected, item retained
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  const r = deliver(sys, 'p1', 'Z', 's1', 7, 9); // manhattan = 2 > 1
  check('U11 OUT_OF_RANGE', r.ok === false && r.reason === 'OUT_OF_RANGE');
  check('U11 item retained', getHeld(sys, 'p1') !== null);
}

// U12 — double-deliver yields exactly one record
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  const first = deliver(sys, 'p1', 'Z', 's1', 7, 7);
  const second = deliver(sys, 'p1', 'Z', 's1', 7, 7);
  check('U12 first deliver ok', first.ok === true);
  check('U12 second deliver HELD_SLOT_EMPTY', second.ok === false && second.reason === 'HELD_SLOT_EMPTY');
}

// U14 — unknown station / unknown zone guards
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  const r = deliver(sys, 'p1', 'Z', 'nope', 7, 7);
  check('U14 STATION_NOT_FOUND', r.ok === false && r.reason === 'STATION_NOT_FOUND');
  const z1 = startGather(sys, 'p2', 'ZZ', 'n1', 5, 5, 0);
  check('U14 UNKNOWN_ZONE (gather)', z1.ok === false && z1.reason === 'UNKNOWN_ZONE');
  const z2 = deliver(sys, 'p1', 'ZZ', 's1', 7, 7);
  check('U14 UNKNOWN_ZONE (deliver)', z2.ok === false && z2.reason === 'UNKNOWN_ZONE');
}

// U15 — gatherProgressPct is server-computed and monotonic
{
  const sys = fresh();
  startGather(sys, 'p1', 'Z', 'n1', 5, 5, 0); // complete at 1000
  check('U15 progress 0 at start', gatherProgressPct(sys, 'p1', 0) === 0);
  check('U15 progress 50 at mid', gatherProgressPct(sys, 'p1', 500) === 50);
  check('U15 progress clamped 100', gatherProgressPct(sys, 'p1', 5000) === 100);
  check('U15 idle player -> null', gatherProgressPct(sys, 'pX', 0) === null);
}

// U16 — feature flag defaults OFF
{
  check('U16 flag default off', isGatherEnabled({}) === false);
  check('U16 flag "1" on', isGatherEnabled({ CHILL_ZONE_GATHER_ENABLED: '1' }) === true);
  check('U16 flag "true" on', isGatherEnabled({ CHILL_ZONE_GATHER_ENABLED: 'true' }) === true);
  check('U16 flag "0" off', isGatherEnabled({ CHILL_ZONE_GATHER_ENABLED: '0' }) === false);
  check('U16 flag "no" off', isGatherEnabled({ CHILL_ZONE_GATHER_ENABLED: 'no' }) === false);
}

if (failures > 0) {
  console.error(`\n[verify-gather] FAIL (${failures} failed)`);
  process.exit(1);
}
console.log('\n[verify-gather] PASS');
