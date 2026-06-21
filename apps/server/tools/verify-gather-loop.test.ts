#!/usr/bin/env node
// Tier-2 end-to-end proof for the Chill-Zone Gather + Refine loop over a fresh local WebSocket server.
//
// Reuses the Rookguard onboarding path to reach Azura (the chill zone), then drives:
//   S1 node+station registry on arrival (incl. the refinery station)
//   S2 gather a node (server-owned timer: progress advances, then completes)
//   S3 out-of-range gather is rejected
//   S4 deliver at the curation stand -> delivery_recorded receipt in the chain
//   S5 second cycle feeds Tem heat (gather_cadence x2)
//   S6 gather -> refine at the refinery (server-owned timer) -> deliver refined -> keystone receipt
//
// Boots the server with CHILL_ZONE_GATHER_ENABLED=1 and CHILL_ZONE_REFINE_ENABLED=1.
// Mirrors verify-rookguard-codex-path.ts.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import {
  DB_PATH_ENV,
  REPLAY_MARKER_PATH_ENV,
  RECEIPT_CHAIN_PATH_ENV,
  resolveChainPaths,
} from '../../../packages/shared/paths.js';
import type { MapData, PlayerPublic } from '../../../packages/shared/types.js';
import { TEM_CHALLENGE_RESPONSE, TileCode, WALKABLE_TILES } from '../../../packages/shared/types.js';

type JsonMessage = Record<string, unknown>;
type Direction = 'north' | 'south' | 'east' | 'west';
type Point = { x: number; y: number };

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SERVER_DIR = path.join(REPO_ROOT, 'apps/server');
const SERVER_START_TIMEOUT_MS = 20_000;
const MESSAGE_TIMEOUT_MS = 10_000;
const COMBAT_WAIT_MS = 2100;
const LANE = 'AKALYNTH_CHILL_ZONE_GATHER_WS_E2E_V1';

function fail(msg: string): never {
  console.error(`\n[verify-gather-loop] FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg: string): void {
  console.log(`[verify-gather-loop] OK: ${msg}`);
}
function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) fail(msg);
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

async function getOpenPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('failed to allocate local port'));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitForServerListen(child: ChildProcessWithoutNullStreams, output: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const text = output.join('');
      if (text.includes('HTTP+WS listening')) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (child.exitCode !== null || child.signalCode !== null) {
        clearInterval(timer);
        reject(new Error(`server exited before listen: ${text}`));
        return;
      }
      if (Date.now() - startedAt > SERVER_START_TIMEOUT_MS) {
        clearInterval(timer);
        reject(new Error(`server did not listen within timeout: ${text}`));
      }
    }, 100);
  });
}

async function stopServer(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    sleep(3000).then(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }),
  ]);
}

class WsHarness {
  private readonly queue: JsonMessage[] = [];
  private readonly waiters: Array<{
    predicate: (msg: JsonMessage) => boolean;
    resolve: (msg: JsonMessage) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];

  private constructor(private readonly ws: WebSocket) {
    ws.on('message', (data) => {
      let msg: JsonMessage;
      try {
        msg = JSON.parse(data.toString()) as JsonMessage;
      } catch {
        return;
      }
      const index = this.waiters.findIndex((waiter) => waiter.predicate(msg));
      if (index >= 0) {
        const [waiter] = this.waiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(msg);
        return;
      }
      this.queue.push(msg);
    });
  }

  static async connect(url: string): Promise<WsHarness> {
    const ws = new WebSocket(url);
    const harness = new WsHarness(ws);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket open timeout')), 5000);
      ws.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    await harness.waitFor((msg) => msg.type === 'welcome', 'welcome');
    return harness;
  }

  send(msg: JsonMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  waitFor(predicate: (msg: JsonMessage) => boolean, label: string, timeoutMs = MESSAGE_TIMEOUT_MS): Promise<JsonMessage> {
    const queuedIndex = this.queue.findIndex(predicate);
    if (queuedIndex >= 0) {
      const [msg] = this.queue.splice(queuedIndex, 1);
      return Promise.resolve(msg);
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timeout: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(new Error(`timeout waiting for ${label}; queued=${this.queue.map((msg) => String(msg.type)).join(',')}`));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  close(): void {
    this.ws.close();
  }
}

function loadRookguardMap(): MapData {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages/shared/maps/rookguard.json'), 'utf8')) as MapData;
}
function tileAt(map: MapData, point: Point): number {
  return map.tiles[point.y * map.width + point.x] ?? TileCode.Wall;
}
function centerOfLandmark(map: MapData, name: string): Point {
  const landmark = map.landmarks[name];
  assert(landmark, `Rookguard landmark missing: ${name}`);
  return { x: landmark.x + Math.floor(landmark.width / 2), y: landmark.y + Math.floor(landmark.height / 2) };
}
function findTile(map: MapData, tile: TileCode): Point {
  const index = map.tiles.indexOf(tile);
  assert(index >= 0, `Rookguard tile missing: ${TileCode[tile]}`);
  return { x: index % map.width, y: Math.floor(index / map.width) };
}
function neighbors(point: Point): Point[] {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ];
}
function nearestWalkableTo(map: MapData, target: Point): Point {
  if (WALKABLE_TILES.has(tileAt(map, target))) return target;
  const seen = new Set<string>();
  const queue: Point[] = [target];
  seen.add(`${target.x},${target.y}`);
  while (queue.length) {
    const current = queue.shift() as Point;
    for (const next of neighbors(current)) {
      const key = `${next.x},${next.y}`;
      if (seen.has(key) || next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height) continue;
      if (WALKABLE_TILES.has(tileAt(map, next))) return next;
      seen.add(key);
      queue.push(next);
    }
  }
  fail(`no walkable tile near ${target.x},${target.y}`);
}
function adjacentWalkableTo(map: MapData, target: Point): Point {
  for (const next of neighbors(target)) {
    if (next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height) continue;
    if (WALKABLE_TILES.has(tileAt(map, next))) return next;
  }
  fail(`no walkable adjacent tile near ${target.x},${target.y}`);
}
function directionBetween(a: Point, b: Point): Direction {
  if (b.x === a.x + 1 && b.y === a.y) return 'east';
  if (b.x === a.x - 1 && b.y === a.y) return 'west';
  if (b.x === a.x && b.y === a.y + 1) return 'south';
  if (b.x === a.x && b.y === a.y - 1) return 'north';
  fail(`points are not adjacent: ${a.x},${a.y} -> ${b.x},${b.y}`);
}
function pathTo(map: MapData, from: Point, to: Point): Direction[] {
  const start = `${from.x},${from.y}`;
  const goal = `${to.x},${to.y}`;
  const prev = new Map<string, string | null>();
  const points = new Map<string, Point>([[start, from]]);
  const queue: Point[] = [from];
  prev.set(start, null);
  while (queue.length) {
    const current = queue.shift() as Point;
    const currentKey = `${current.x},${current.y}`;
    if (currentKey === goal) break;
    for (const next of neighbors(current)) {
      const nextKey = `${next.x},${next.y}`;
      if (prev.has(nextKey) || next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height) continue;
      if (!WALKABLE_TILES.has(tileAt(map, next))) continue;
      prev.set(nextKey, currentKey);
      points.set(nextKey, next);
      queue.push(next);
    }
  }
  assert(prev.has(goal), `no walkable path from ${start} to ${goal}`);
  const reversed: Point[] = [];
  for (let at: string | null = goal; at; at = prev.get(at) ?? null) {
    const point = points.get(at);
    assert(point, `missing point in path reconstruction: ${at}`);
    reversed.push(point);
  }
  reversed.reverse();
  const directions: Direction[] = [];
  for (let i = 1; i < reversed.length; i += 1) directions.push(directionBetween(reversed[i - 1], reversed[i]));
  return directions;
}
async function sendMove(client: WsHarness, direction: Direction): Promise<JsonMessage> {
  client.send({ type: 'move_intent', direction });
  const result = await client.waitFor((msg) => msg.type === 'move_result', `move_result:${direction}`);
  assert(result.ok === true, `move ${direction} should succeed, got ${JSON.stringify(result)}`);
  await sleep(140);
  return result;
}
async function walkPath(client: WsHarness, dirs: Direction[]): Promise<JsonMessage | null> {
  let last: JsonMessage | null = null;
  for (const direction of dirs) last = await sendMove(client, direction);
  return last;
}
// Greedy stepping in the open Azura spawn area; uses server-reported position as truth.
async function moveToward(client: WsHarness, from: Point, target: Point, stopManhattan: number): Promise<Point> {
  let cur = { ...from };
  let guard = 0;
  while (manhattan(cur, target) > stopManhattan && guard++ < 50) {
    let dir: Direction;
    if (cur.x < target.x) dir = 'east';
    else if (cur.x > target.x) dir = 'west';
    else if (cur.y < target.y) dir = 'south';
    else dir = 'north';
    const r = await sendMove(client, dir);
    cur = { x: r.x as number, y: r.y as number };
  }
  return cur;
}

async function onboardToAzura(client: WsHarness, map: MapData): Promise<void> {
  client.send({ type: 'login', guest_token: null });
  const login = await client.waitFor((msg) => msg.type === 'login_ack', 'login_ack');
  assert(login.ok === true, `login should succeed: ${JSON.stringify(login)}`);

  client.send({ type: 'enter_world' });
  const world = await client.waitFor((msg) => msg.type === 'world_state' && msg.map === 'Rookguard', 'world_state:Rookguard');
  const player = world.player as PlayerPublic;
  let current: Point = { x: player.x, y: player.y };

  const moveRune = findTile(map, TileCode.TutorialMove);
  await walkPath(client, pathTo(map, current, moveRune));
  current = moveRune;
  await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'rookguard_move_complete', 'loop_update:move');

  client.send({ type: 'chat', message: 'gather loop e2e' });
  await client.waitFor((msg) => msg.type === 'chat_broadcast' && msg.message === 'gather loop e2e', 'chat_broadcast');
  await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'rookguard_chat_complete', 'loop_update:chat');

  const temRune = findTile(map, TileCode.TutorialTem);
  await walkPath(client, pathTo(map, current, temRune));
  current = temRune;
  await client.waitFor((msg) => msg.type === 'tem_challenge', 'tem_challenge');
  client.send({ type: 'tem_response', response: TEM_CHALLENGE_RESPONSE });
  await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'rookguard_tem_complete', 'loop_update:tem');

  const trainingSlime = { x: 14, y: 14 };
  const combatTile = adjacentWalkableTo(map, trainingSlime);
  await walkPath(client, pathTo(map, current, combatTile));
  current = combatTile;
  for (let i = 0; i < 3; i += 1) {
    client.send({ type: 'attack_intent', target_id: 'mob:training_slime' });
    if (i < 2) await sleep(COMBAT_WAIT_MS);
  }
  await client.waitFor((msg) => msg.type === 'combat_resolved' && msg.defender_id === 'mob:training_slime', 'combat_resolved');
  await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'rookguard_training_complete', 'loop_update:training');

  const guildHall = nearestWalkableTo(map, centerOfLandmark(map, 'guild_hall'));
  await walkPath(client, pathTo(map, current, guildHall));
  current = guildHall;
  client.send({ type: 'declare_vocation', vocation: 'hexer' });
  await client.waitFor((msg) => msg.type === 'world_state' && msg.map === 'Rookguard', 'world_state:post_vocation');
  await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'rookguard_profession_declared', 'loop_update:profession');

  const gate = findTile(map, TileCode.GateToAzura);
  const gateMove = await walkPath(client, pathTo(map, current, gate));
  assert(gateMove?.map === 'Azura', `gate move should transfer to Azura: ${JSON.stringify(gateMove)}`);
}

async function verifyGatherLoop(): Promise<void> {
  const map = loadRookguardMap();
  const port = await getOpenPort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'akalynth-gather-loop-'));
  const chainPaths = resolveChainPaths(tmp);
  const keyPath = path.join(tmp, 'chronicle.key');
  const output: string[] = [];
  const tsxBin = path.join(REPO_ROOT, 'node_modules/.bin/tsx');
  fs.writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });

  const child = spawn(tsxBin, ['src/index.ts'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DEBUG: '1',
      REQUIRE_TLS: '0',
      ALLOW_INSECURE_LOCAL: '1',
      AKALYNTH_BOOTSTRAP: '1',
      AKALYNTH_LIFECYCLE_VERIFY: '0',
      CHILL_ZONE_GATHER_ENABLED: '1',
      CHILL_ZONE_REFINE_ENABLED: '1',
      [RECEIPT_CHAIN_PATH_ENV]: chainPaths.receiptsPath,
      [DB_PATH_ENV]: chainPaths.dbPath,
      [REPLAY_MARKER_PATH_ENV]: chainPaths.markerPath,
      CHRONICLE_KEY_PATH: keyPath,
      CHRONICLE_LOG_PATH: path.join(tmp, 'chronicle.log'),
      ENABLE_CHRONICLE: '0',
      IP_RATE_LIMIT_ENABLED: '0',
      CADENCE_MIN_SAMPLES: '999',
      HEAT_TEM_THRESHOLD: '9999',
    },
  });
  child.stdout.on('data', (chunk) => output.push(chunk.toString()));
  child.stderr.on('data', (chunk) => output.push(chunk.toString()));

  let client: WsHarness | null = null;
  try {
    await waitForServerListen(child, output);
    client = await WsHarness.connect(`ws://127.0.0.1:${port}`);

    await onboardToAzura(client, map);
    ok('reached Azura via Rookguard onboarding');

    const azura = await client.waitFor((msg) => msg.type === 'world_state' && msg.map === 'Azura', 'world_state:Azura');
    const azuraPlayer = azura.player as PlayerPublic;
    let cur: Point = { x: azuraPlayer.x, y: azuraPlayer.y };

    // S1 — node + station registry on arrival.
    const snapshot = await client.waitFor((msg) => msg.type === 'gather_snapshot', 'gather_snapshot');
    const nodes = snapshot.nodes as Array<{ node_id: string; x: number; y: number; state: string }>;
    const stations = snapshot.stations as Array<{ station_id: string; x: number; y: number; kind?: string }>;
    assert(Array.isArray(nodes) && nodes.length >= 1, `expected gather nodes, got ${JSON.stringify(nodes)}`);
    assert(Array.isArray(stations) && stations.length >= 1, `expected stations, got ${JSON.stringify(stations)}`);
    const node = nodes.find((n) => n.node_id === 'azura_ley_mote_e');
    const station = stations.find((st) => st.station_id === 'azura_curation_stand');
    assert(node, `expected node azura_ley_mote_e in snapshot: ${JSON.stringify(nodes)}`);
    assert(station, `expected station azura_curation_stand: ${JSON.stringify(stations)}`);
    ok(`S1 registry: ${nodes.length} nodes, ${stations.length} station(s); node_e @ ${node.x},${node.y}`);

    // S3 — out-of-range gather is rejected (player at spawn is Manhattan 2 from node_e).
    assert(manhattan(cur, node) >= 2, `expected out-of-range start distance, got ${manhattan(cur, node)}`);
    client.send({ type: 'gather_intent', node_id: node.node_id });
    const reject = await client.waitFor((msg) => msg.type === 'gather_result', 'gather_result:reject');
    assert(reject.ok === false && reject.reason === 'out_of_range', `expected out_of_range, got ${JSON.stringify(reject)}`);
    ok('S3 out-of-range gather rejected');

    // Move adjacent to the node.
    cur = await moveToward(client, cur, node, 1);
    assert(manhattan(cur, node) === 1, `expected to stand adjacent to node, at ${cur.x},${cur.y}`);

    // S2 — gather (server-owned timer): accept -> progress advances -> completion.
    client.send({ type: 'gather_intent', node_id: node.node_id });
    const accept = await client.waitFor((msg) => msg.type === 'gather_result', 'gather_result:accept');
    assert(accept.ok === true && typeof accept.complete_at_ms === 'number', `expected accept w/ complete_at_ms, got ${JSON.stringify(accept)}`);
    const progress = await client.waitFor(
      (msg) => msg.type === 'gather_progress' && msg.node_id === node.node_id && (msg.progress_pct as number) > 0,
      'gather_progress'
    );
    assert((progress.progress_pct as number) < 100, `progress should be mid-gather, got ${JSON.stringify(progress)}`);
    const completed = await client.waitFor((msg) => msg.type === 'gather_completed' && msg.node_id === node.node_id, 'gather_completed');
    assert(completed.item_type === 'ley_mote', `expected ley_mote, got ${JSON.stringify(completed)}`);
    ok(`S2 gather completed (progress observed @ ${Math.round(progress.progress_pct as number)}%)`);

    // Move adjacent to the curation stand.
    cur = await moveToward(client, cur, station, 1);
    assert(manhattan(cur, station) <= 1, `expected to stand adjacent to station, at ${cur.x},${cur.y}`);

    // S4 — deliver -> deliver_result + delivery_recorded receipt.
    client.send({ type: 'deliver_intent', station_id: station.station_id });
    const delivered = await client.waitFor((msg) => msg.type === 'deliver_result', 'deliver_result');
    assert(delivered.ok === true, `deliver should succeed: ${JSON.stringify(delivered)}`);
    assert(
      delivered.item_type === 'ley_mote' && delivered.source_node_id === 'azura_ley_mote_e',
      `deliver_result provenance mismatch: ${JSON.stringify(delivered)}`
    );
    assert(delivered.reward === 'tending_token', `deliver_result should credit tending_token (step 4): ${JSON.stringify(delivered)}`);
    ok('S4 deliver succeeded (reward: tending_token)');

    // Receipt chain: exactly the delivery_recorded receipt, no reward credited.
    await sleep(150);
    const receipts = fs
      .readFileSync(chainPaths.receiptsPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { action: string; inputs?: Record<string, unknown> });
    const deliveries = receipts.filter((r) => r.action === 'delivery_recorded');
    assert(deliveries.length === 1, `expected exactly one delivery_recorded receipt, got ${deliveries.length}`);
    const d = deliveries[0];
    assert(d.inputs?.source_node_id === 'azura_ley_mote_e', `receipt source_node_id mismatch: ${JSON.stringify(d.inputs)}`);
    assert(d.inputs?.zone === 'Azura', `receipt zone mismatch: ${JSON.stringify(d.inputs)}`);
    assert(d.inputs?.reward === 'tending_token', `receipt should credit tending_token (step 4): ${JSON.stringify(d.inputs)}`);
    ok('receipt: one delivery_recorded with provenance, reward:tending_token');

    // S5 (step 3) — a second gather->deliver cycle feeds Tem heat; verify gather_cadence
    // accumulates (the escalation-to-challenge is the shared applyHeatChange path).
    const nodeS = nodes.find((n) => n.node_id === 'azura_ley_mote_s');
    assert(nodeS, `expected node azura_ley_mote_s in snapshot: ${JSON.stringify(nodes)}`);
    cur = await moveToward(client, cur, nodeS, 1);
    client.send({ type: 'gather_intent', node_id: nodeS.node_id });
    const accept2 = await client.waitFor((msg) => msg.type === 'gather_result', 'gather_result:2');
    assert(accept2.ok === true, `second gather should accept: ${JSON.stringify(accept2)}`);
    await client.waitFor((msg) => msg.type === 'gather_completed' && msg.node_id === nodeS.node_id, 'gather_completed:2');
    cur = await moveToward(client, cur, station, 1);
    client.send({ type: 'deliver_intent', station_id: station.station_id });
    const delivered2 = await client.waitFor((msg) => msg.type === 'deliver_result', 'deliver_result:2');
    assert(delivered2.ok === true, `second deliver should succeed: ${JSON.stringify(delivered2)}`);

    await sleep(150);
    const receipts2 = fs
      .readFileSync(chainPaths.receiptsPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { action: string; inputs?: Record<string, unknown> });
    const heatTicks = receipts2.filter((r) => r.action === 'heat_changed' && r.inputs?.reason === 'gather_cadence');
    assert(heatTicks.length === 2, `expected two gather_cadence heat_changed receipts, got ${heatTicks.length}`);
    assert((heatTicks[0].inputs?.delta as number) === 5, `expected gather heat delta 5, got ${JSON.stringify(heatTicks[0].inputs)}`);
    assert(
      (heatTicks[1].inputs?.new_score as number) > (heatTicks[0].inputs?.new_score as number),
      `expected heat to accumulate across cycles: ${heatTicks.map((h) => h.inputs?.new_score).join(' -> ')}`
    );
    assert(
      receipts2.filter((r) => r.action === 'delivery_recorded').length === 2,
      'expected two delivery_recorded receipts after two cycles'
    );
    ok(`S5 Tem heat: gather_cadence x2, score ${heatTicks[0].inputs?.new_score} -> ${heatTicks[1].inputs?.new_score} (feeds shared escalation)`);

    // S6 (refine) — gather a third node, refine the raw mote at the refinery, deliver refined.
    const refinery = stations.find((st) => st.station_id === 'azura_refinery_stand');
    assert(refinery, `expected refinery station (CHILL_ZONE_REFINE_ENABLED): ${JSON.stringify(stations)}`);
    assert(refinery.kind === 'refinery', `refinery should carry kind=refinery: ${JSON.stringify(refinery)}`);
    const nodeSe = nodes.find((n) => n.node_id === 'azura_ley_mote_se');
    assert(nodeSe, `expected node azura_ley_mote_se in snapshot: ${JSON.stringify(nodes)}`);
    cur = await moveToward(client, cur, nodeSe, 1);
    client.send({ type: 'gather_intent', node_id: nodeSe.node_id });
    const accept3 = await client.waitFor((msg) => msg.type === 'gather_result', 'gather_result:3');
    assert(accept3.ok === true, `third gather should accept: ${JSON.stringify(accept3)}`);
    await client.waitFor((msg) => msg.type === 'gather_completed' && msg.node_id === nodeSe.node_id, 'gather_completed:3');

    // Refine (server-owned timer): accept -> progress advances -> completed (in-place upgrade).
    cur = await moveToward(client, cur, refinery, 1);
    assert(manhattan(cur, refinery) <= 1, `expected to stand adjacent to refinery, at ${cur.x},${cur.y}`);
    client.send({ type: 'refine_intent', station_id: refinery.station_id });
    const refineAccept = await client.waitFor((msg) => msg.type === 'refine_result', 'refine_result:accept');
    assert(
      refineAccept.ok === true && typeof refineAccept.complete_at_ms === 'number',
      `expected refine accept w/ complete_at_ms, got ${JSON.stringify(refineAccept)}`
    );
    const refineProgress = await client.waitFor(
      (msg) => msg.type === 'refine_progress' && msg.station_id === refinery.station_id && (msg.progress_pct as number) > 0,
      'refine_progress'
    );
    assert((refineProgress.progress_pct as number) < 100, `refine progress should be mid, got ${JSON.stringify(refineProgress)}`);
    const refineDone = await client.waitFor(
      (msg) => msg.type === 'refine_completed' && msg.station_id === refinery.station_id,
      'refine_completed'
    );
    assert(refineDone.item_type === 'refined_ley_mote', `expected refined_ley_mote, got ${JSON.stringify(refineDone)}`);
    ok(`S6 refine completed (progress observed @ ${Math.round(refineProgress.progress_pct as number)}%)`);

    // Deliver the refined mote -> keystone reward + refined receipt provenance.
    cur = await moveToward(client, cur, station, 1);
    client.send({ type: 'deliver_intent', station_id: station.station_id });
    const delivered3 = await client.waitFor((msg) => msg.type === 'deliver_result', 'deliver_result:3');
    assert(delivered3.ok === true, `refined deliver should succeed: ${JSON.stringify(delivered3)}`);
    assert(
      delivered3.item_type === 'refined_ley_mote' && delivered3.refined === true && delivered3.reward === 'keystone_token',
      `refined deliver_result mismatch: ${JSON.stringify(delivered3)}`
    );
    ok('S6 refined deliver succeeded (reward: keystone_token)');

    await sleep(150);
    const receipts3 = fs
      .readFileSync(chainPaths.receiptsPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { action: string; inputs?: Record<string, unknown> });
    const refinedDeliveries = receipts3.filter((r) => r.action === 'delivery_recorded' && r.inputs?.refined === true);
    assert(refinedDeliveries.length === 1, `expected one refined delivery_recorded, got ${refinedDeliveries.length}`);
    assert(
      refinedDeliveries[0].inputs?.reward === 'keystone_token' &&
        refinedDeliveries[0].inputs?.refined_at_station === 'azura_refinery_stand',
      `refined receipt mismatch: ${JSON.stringify(refinedDeliveries[0].inputs)}`
    );
    ok('receipt: refined delivery_recorded with keystone_token + refinery provenance');

    ok(`${LANE}: chill-zone gather + refine loop verified over WebSocket`);
  } finally {
    client?.close();
    await stopServer(child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

verifyGatherLoop()
  .then(() => console.log(`\n[verify-gather-loop] ${LANE} passed`))
  .catch((err) => fail(err instanceof Error ? err.message : String(err)));
