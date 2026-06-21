#!/usr/bin/env node
/**
 * Tier-1 unit tests for the chill-zone gather + refine state machine (server-only).
 *
 * Pure-function tests over src/world/gather.ts — no DB, no WebSocket, no client.
 * U-series: gather → deliver (shipped). R-series: gather → refine → deliver (this slice).
 * Run: cd apps/server && npx tsx tools/verify-gather.test.ts   (or: npm run test:gather)
 * Mirrors the verify-*.ts convention: exit 1 on any failure, print PASS otherwise.
 */
import {
  createGatherSystem,
  startGather,
  startRefine,
  deliver,
  tickGather,
  cancelGather,
  cancelRefine,
  onPlayerLeave,
  getPlayerGather,
  getHeld,
  gatherProgressPct,
  refineProgressPct,
  isGatherEnabled,
  isRefineEnabled,
  refinedTypeOf,
  isRefinedType,
  rewardForItemType,
  TENDING_TOKEN_ID,
  KEYSTONE_TOKEN_ID,
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

const CFG: GatherConfig = { gatherDurationMs: 1000, refineDurationMs: 2000, respawnCooldownMs: 5000, interactRadius: 1 };

function fresh(): GatherSystem {
  return createGatherSystem(
    CFG,
    [
      { node_id: 'n1', zone: 'Z', x: 5, y: 5, item_type: 'ley_mote' },
      { node_id: 'n2', zone: 'Z', x: 20, y: 20, item_type: 'ley_mote' },
    ],
    [
      { station_id: 's1', zone: 'Z', x: 7, y: 7, kind: 'curation' },
      { station_id: 'r1', zone: 'Z', x: 9, y: 9, kind: 'refinery' },
    ],
  );
}

function nodeOf(sys: GatherSystem, id: string) {
  return sys.zones.get('Z')!.nodes.get(id)!;
}

/** Honest way to obtain a held item: start a gather in range and let the server complete it. */
function giveHeld(sys: GatherSystem, playerId: string): void {
  startGather(sys, playerId, 'Z', 'n1', 5, 5, 0);
  tickGather(sys, CFG.gatherDurationMs); // held raw at t = gatherDurationMs (1000)
}

/** Honest way to obtain a REFINED held item: gather, then refine at r1 and let the server complete it. */
function giveRefined(sys: GatherSystem, playerId: string): void {
  giveHeld(sys, playerId); // held raw at t=1000
  startRefine(sys, playerId, 'Z', 'r1', 9, 9, CFG.gatherDurationMs);
  tickGather(sys, CFG.gatherDurationMs + CFG.refineDurationMs); // refine completes at t=3000
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

// ============================================================================
// R-series — refine: gather → refine(refinery) → deliver (this slice)
// ============================================================================

// R1 — refine start: held raw, in range of refinery, idle
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  const r = startRefine(sys, 'p1', 'Z', 'r1', 9, 9, 1000);
  check('R1 start ok', r.ok === true);
  check('R1 completeAt = now + refineT', r.ok === true && r.complete_at_ms === 3000);
  check('R1 player REFINING', getPlayerGather(sys, 'p1').state === 'refining');
  check('R1 held still raw until complete', getHeld(sys, 'p1')?.item_type === 'ley_mote');
}

// R2 — refine completes at completeAt (and NOT before); upgrades held in place
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  startRefine(sys, 'p1', 'Z', 'r1', 9, 9, 1000);
  const early = tickGather(sys, 2999);
  check('R2 no refine before T', early.refined.length === 0 && getHeld(sys, 'p1')?.item_type === 'ley_mote');
  const eff = tickGather(sys, 3000);
  check('R2 one refine at T', eff.refined.length === 1 && eff.refined[0].item_type === 'refined_ley_mote');
  const held = getHeld(sys, 'p1');
  check('R2 held upgraded in place', held?.item_type === 'refined_ley_mote' && held?.refined_at_station_id === 'r1');
  check('R2 source provenance kept', held?.source_node_id === 'n1');
  check('R2 player back to IDLE', getPlayerGather(sys, 'p1').state === 'idle');
}

// R3 — refine out of range rejected; held unchanged, no activity
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  const r = startRefine(sys, 'p1', 'Z', 'r1', 9, 11, 1000); // manhattan = 2 > 1
  check('R3 OUT_OF_RANGE', r.ok === false && r.reason === 'OUT_OF_RANGE');
  check(
    'R3 held retained raw, idle',
    getHeld(sys, 'p1')?.item_type === 'ley_mote' && getPlayerGather(sys, 'p1').state === 'idle',
  );
}

// R4 — refine with empty slot rejected
{
  const sys = fresh();
  const r = startRefine(sys, 'p1', 'Z', 'r1', 9, 9, 0);
  check('R4 HELD_SLOT_EMPTY', r.ok === false && r.reason === 'HELD_SLOT_EMPTY');
}

// R5 — refine an already-refined item rejected
{
  const sys = fresh();
  giveRefined(sys, 'p1'); // now holds refined_ley_mote
  const r = startRefine(sys, 'p1', 'Z', 'r1', 9, 9, 3000);
  check('R5 NOT_REFINABLE', r.ok === false && r.reason === 'NOT_REFINABLE');
}

// R6 — busy precedence: refine while gathering -> ALREADY_GATHERING; while refining -> ALREADY_REFINING
{
  const sys = fresh();
  startGather(sys, 'p1', 'Z', 'n1', 5, 5, 0); // gathering, empty slot
  const rg = startRefine(sys, 'p1', 'Z', 'r1', 9, 9, 10);
  check('R6 refine while gathering -> ALREADY_GATHERING', rg.ok === false && rg.reason === 'ALREADY_GATHERING');

  const sys2 = fresh();
  giveHeld(sys2, 'p1');
  startRefine(sys2, 'p1', 'Z', 'r1', 9, 9, 1000); // refining
  const rr = startRefine(sys2, 'p1', 'Z', 'r1', 9, 9, 1100);
  check('R6 refine while refining -> ALREADY_REFINING', rr.ok === false && rr.reason === 'ALREADY_REFINING');
}

// R7 — cancel / disconnect mid-refine: player IDLE; cancel keeps RAW held (not upgraded, not dropped)
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  startRefine(sys, 'p1', 'Z', 'r1', 9, 9, 1000);
  cancelRefine(sys, 'p1');
  check('R7 cancel -> IDLE', getPlayerGather(sys, 'p1').state === 'idle');
  check(
    'R7 cancel keeps raw held',
    getHeld(sys, 'p1')?.item_type === 'ley_mote' && getHeld(sys, 'p1')?.refined_at_station_id === null,
  );

  const sys2 = fresh();
  giveHeld(sys2, 'p1');
  startRefine(sys2, 'p1', 'Z', 'r1', 9, 9, 1000);
  onPlayerLeave(sys2, 'p1');
  check('R7 leave clears refine + held', !sys2.gatherByPlayer.has('p1') && getHeld(sys2, 'p1') === null);
}

// R8 — deliver a refined item: provenance + keystone reward
{
  const sys = fresh();
  giveRefined(sys, 'p1');
  const r = deliver(sys, 'p1', 'Z', 's1', 7, 7);
  check('R8 deliver ok', r.ok === true);
  check(
    'R8 refined provenance + reward',
    r.ok === true &&
      r.record.item_type === 'refined_ley_mote' &&
      r.record.refined === true &&
      r.record.refined_at_station_id === 'r1' &&
      r.record.reward === 'keystone_token',
  );
  check('R8 held emptied', getHeld(sys, 'p1') === null);
}

// R9 — deliver a RAW item (regression): tending reward, refined=false
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  const r = deliver(sys, 'p1', 'Z', 's1', 7, 7);
  check(
    'R9 raw provenance + reward',
    r.ok === true &&
      r.record.item_type === 'ley_mote' &&
      r.record.refined === false &&
      r.record.refined_at_station_id === null &&
      r.record.reward === 'tending_token',
  );
}

// R10 — deliver at a refinery (wrong kind) rejected; item retained
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  const r = deliver(sys, 'p1', 'Z', 'r1', 9, 9);
  check('R10 deliver at refinery -> STATION_NOT_FOUND', r.ok === false && r.reason === 'STATION_NOT_FOUND');
  check('R10 item retained', getHeld(sys, 'p1') !== null);
}

// R11 — refine at a curation stand (wrong kind) rejected
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  const r = startRefine(sys, 'p1', 'Z', 's1', 7, 7, 1000);
  check('R11 refine at curation -> STATION_NOT_FOUND', r.ok === false && r.reason === 'STATION_NOT_FOUND');
}

// R12 — refineProgressPct server-computed; gatherProgressPct null while refining
{
  const sys = fresh();
  giveHeld(sys, 'p1');
  startRefine(sys, 'p1', 'Z', 'r1', 9, 9, 1000); // complete at 3000
  check('R12 progress 0 at start', refineProgressPct(sys, 'p1', 1000) === 0);
  check('R12 progress 50 at mid', refineProgressPct(sys, 'p1', 2000) === 50);
  check('R12 progress clamped 100', refineProgressPct(sys, 'p1', 9999) === 100);
  check('R12 gatherProgress null while refining', gatherProgressPct(sys, 'p1', 2000) === null);
  check('R12 refineProgress null for idle', refineProgressPct(sys, 'pX', 2000) === null);
}

// R13 — refine feature flag defaults OFF, independent of the gather flag
{
  check('R13 flag default off', isRefineEnabled({}) === false);
  check('R13 flag "1" on', isRefineEnabled({ CHILL_ZONE_REFINE_ENABLED: '1' }) === true);
  check('R13 flag "true" on', isRefineEnabled({ CHILL_ZONE_REFINE_ENABLED: 'true' }) === true);
  check('R13 flag "0" off', isRefineEnabled({ CHILL_ZONE_REFINE_ENABLED: '0' }) === false);
  check('R13 independent of gather flag', isRefineEnabled({ CHILL_ZONE_GATHER_ENABLED: '1' }) === false);
}

// R14 — pure reward / refinable helpers (invariant I10)
{
  check('R14 refinedTypeOf raw', refinedTypeOf('ley_mote') === 'refined_ley_mote');
  check('R14 refinedTypeOf refined -> null', refinedTypeOf('refined_ley_mote') === null);
  check('R14 isRefinedType', isRefinedType('refined_ley_mote') === true && isRefinedType('ley_mote') === false);
  check('R14 reward raw = tending', rewardForItemType('ley_mote') === TENDING_TOKEN_ID);
  check('R14 reward refined = keystone', rewardForItemType('refined_ley_mote') === KEYSTONE_TOKEN_ID);
}

if (failures > 0) {
  console.error(`\n[verify-gather] FAIL (${failures} failed)`);
  process.exit(1);
}
console.log('\n[verify-gather] PASS');
