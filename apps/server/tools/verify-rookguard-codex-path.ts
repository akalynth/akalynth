#!/usr/bin/env node
// Verify Rookguard Codex Path over a fresh local WebSocket server.
//
// This is an end-to-end proof for the onboarding path:
// movement -> chat -> Tem -> training slime -> Codex vocation -> gate handoff.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
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
const LANE = 'AKALYNTH_ROOKGUARD_CODEX_PATH_WS_E2E_V1';
const TARGET_STATUS = 'rookguard_codex_path_ws_e2e_verified';
const ROOKGUARD_TRAINING_SLIME_SPRITE_ID = 'akalynth_creature_rookguard_training_slime_001';

function fail(msg: string): never {
  console.error(`\n[verify-rookguard-codex-path] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string): void {
  console.log(`[verify-rookguard-codex-path] OK: ${msg}`);
}

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) fail(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return {
    x: landmark.x + Math.floor(landmark.width / 2),
    y: landmark.y + Math.floor(landmark.height / 2),
  };
}

function findTile(map: MapData, tile: TileCode): Point {
  const index = map.tiles.indexOf(tile);
  assert(index >= 0, `Rookguard tile missing: ${TileCode[tile]}`);
  return { x: index % map.width, y: Math.floor(index / map.width) };
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

function neighbors(point: Point): Point[] {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ];
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
  for (let i = 1; i < reversed.length; i += 1) {
    directions.push(directionBetween(reversed[i - 1], reversed[i]));
  }
  return directions;
}

function adjacentWalkableTo(map: MapData, target: Point): Point {
  for (const next of neighbors(target)) {
    if (next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height) continue;
    if (WALKABLE_TILES.has(tileAt(map, next))) return next;
  }
  fail(`no walkable adjacent tile near ${target.x},${target.y}`);
}

function loopQuest(msg: JsonMessage): Record<string, unknown> {
  const loop = msg.loop as { rookguardQuest?: Record<string, unknown> } | undefined;
  assert(loop?.rookguardQuest, `message missing rookguardQuest: ${JSON.stringify(msg)}`);
  return loop.rookguardQuest;
}

function assertQuestPhase(msg: JsonMessage, phase: string): void {
  const quest = loopQuest(msg);
  assert(quest.phase === phase, `expected quest phase ${phase}, got ${String(quest.phase)}`);
}

function assertQuestCompleted(msg: JsonMessage): void {
  const quest = loopQuest(msg);
  assert(quest.completed === true, `expected completed Rookguard quest: ${JSON.stringify(quest)}`);
}

function assertTrainingSlimeVisual(player: PlayerPublic | undefined, label: string): void {
  assert(player?.id === 'mob:training_slime', `${label} should carry training slime player, got ${JSON.stringify(player)}`);
  assert(
    player.sprite_id === ROOKGUARD_TRAINING_SLIME_SPRITE_ID,
    `${label} should carry ${ROOKGUARD_TRAINING_SLIME_SPRITE_ID}, got ${String(player.sprite_id)}`
  );
}

async function sendMove(client: WsHarness, direction: Direction): Promise<JsonMessage> {
  client.send({ type: 'move_intent', direction });
  const result = await client.waitFor((msg) => msg.type === 'move_result', `move_result:${direction}`);
  assert(result.ok === true, `move ${direction} should succeed, got ${JSON.stringify(result)}`);
  await sleep(140);
  return result;
}

async function walkPath(client: WsHarness, path: Direction[]): Promise<JsonMessage | null> {
  let last: JsonMessage | null = null;
  for (const direction of path) {
    last = await sendMove(client, direction);
  }
  return last;
}

async function verifyRookguardCodexPath(): Promise<void> {
  const map = loadRookguardMap();
  const port = await getOpenPort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'akalynth-rookguard-codex-'));
  const receiptsPath = path.join(tmp, 'audit/receipts.jsonl');
  const dbPath = path.join(tmp, 'data/akalynth.db');
  const markerPath = path.join(tmp, 'data/replay-marker.json');
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
      AKALYNTH_RECEIPT_CHAIN_PATH: receiptsPath,
      AKALYNTH_DB_PATH: dbPath,
      AKALYNTH_REPLAY_MARKER_PATH: markerPath,
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

    client.send({ type: 'login', guest_token: null });
    const login = await client.waitFor((msg) => msg.type === 'login_ack', 'login_ack');
    assert(login.ok === true, `login should succeed: ${JSON.stringify(login)}`);

    client.send({ type: 'enter_world' });
    const world = await client.waitFor((msg) => msg.type === 'world_state' && msg.map === 'Rookguard', 'world_state:Rookguard');
    const player = world.player as PlayerPublic;
    assert(player.x === map.spawn.x && player.y === map.spawn.y, `spawn mismatch: ${player.x},${player.y}`);
    const initialQuest = (player.loop as { rookguardQuest?: { phase?: string } } | undefined)?.rookguardQuest;
    assert(initialQuest?.phase === 'tutorial', `initial world_state should include tutorial quest phase, got ${JSON.stringify(initialQuest)}`);

    let current: Point = { x: player.x, y: player.y };
    const moveRune = findTile(map, TileCode.TutorialMove);
    await walkPath(client, pathTo(map, current, moveRune));
    current = moveRune;
    assertQuestPhase(await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'rookguard_move_complete', 'loop_update:move'), 'tutorial');

    client.send({ type: 'chat', message: 'rookguard codex path e2e' });
    await client.waitFor((msg) => msg.type === 'chat_broadcast' && msg.message === 'rookguard codex path e2e', 'chat_broadcast');
    assertQuestPhase(await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'rookguard_chat_complete', 'loop_update:chat'), 'tutorial');

    const temRune = findTile(map, TileCode.TutorialTem);
    await walkPath(client, pathTo(map, current, temRune));
    current = temRune;
    await client.waitFor((msg) => msg.type === 'tem_challenge', 'tem_challenge');
    client.send({ type: 'tem_response', response: TEM_CHALLENGE_RESPONSE });
    assertQuestPhase(await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'rookguard_tem_complete', 'loop_update:tem'), 'training');

    const trainingSlime = { x: 14, y: 14 };
    const combatTile = adjacentWalkableTo(map, trainingSlime);
    await walkPath(client, pathTo(map, current, combatTile));
    current = combatTile;
    for (let i = 0; i < 3; i += 1) {
      client.send({ type: 'attack_intent', target_id: 'mob:training_slime' });
      if (i < 2) {
        const slimeUpdate = await client.waitFor((msg) => msg.type === 'player_joined' && (msg.player as PlayerPublic | undefined)?.id === 'mob:training_slime', `training_slime_hit_${i + 1}`);
        assertTrainingSlimeVisual(slimeUpdate.player as PlayerPublic | undefined, `training_slime_hit_${i + 1}`);
        await sleep(COMBAT_WAIT_MS);
      }
    }
    await client.waitFor((msg) => msg.type === 'combat_resolved' && msg.defender_id === 'mob:training_slime', 'combat_resolved:training_slime');
    assertQuestPhase(await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'rookguard_training_complete', 'loop_update:training'), 'profession');

    const guildHall = nearestWalkableTo(map, centerOfLandmark(map, 'guild_hall'));
    await walkPath(client, pathTo(map, current, guildHall));
    current = guildHall;
    client.send({ type: 'declare_vocation', vocation: 'hexer' });
    const refresh = await client.waitFor((msg) => msg.type === 'world_state' && msg.map === 'Rookguard', 'world_state:post_vocation');
    const refreshedPlayer = refresh.player as PlayerPublic;
    assert(refreshedPlayer.badges?.includes('vocation_hexer'), `world_state should include hexer badge: ${JSON.stringify(refreshedPlayer.badges)}`);
    const professionLoop = await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'rookguard_profession_declared', 'loop_update:profession');
    const professionQuest = loopQuest(professionLoop);
    const codexProfession = professionQuest.codexProfession as { lore_id?: string; codex_anchor?: { object_id?: string } } | undefined;
    assert(professionQuest.phase === 'gate', `expected gate phase after profession, got ${String(professionQuest.phase)}`);
    assert(codexProfession?.lore_id === 'codex_hexer', 'expected selected Codex Hexer profile');
    assert(codexProfession?.codex_anchor?.object_id === 'heroes-codex', 'expected Heroes Codex anchor');

    const gate = findTile(map, TileCode.GateToAzura);
    const gateMove = await walkPath(client, pathTo(map, current, gate));
    assert(gateMove?.map === 'Azura', `gate move should transfer to Azura: ${JSON.stringify(gateMove)}`);
    const completedLoop = await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'rookguard_codex_path_complete', 'loop_update:complete');
    assertQuestCompleted(completedLoop);
    const azura = await client.waitFor((msg) => msg.type === 'world_state' && msg.map === 'Azura', 'world_state:Azura');
    const azuraPlayer = azura.player as PlayerPublic;
    assert(azuraPlayer.loop?.rookguardQuest?.completed === true, 'Azura world_state should retain completed Rookguard quest projection');

    const actions = fs.readFileSync(receiptsPath, 'utf8').trim().split('\n').map((line) => (JSON.parse(line) as { action: string }).action);
    for (const action of ['tutorial_step_complete', 'mob_kill', 'item_minted', 'vocation_declared', 'gate_unlock', 'tutorial_completed']) {
      assert(actions.includes(action), `receipt chain missing ${action}`);
    }
    assert(actions.filter((action) => action === 'item_minted').length >= 2, 'training slime should mint goo and slime receipts');

    ok(`${TARGET_STATUS}: movement/chat/Tem/training/profession/gate verified over WebSocket`);
  } finally {
    client?.close();
    await stopServer(child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

verifyRookguardCodexPath()
  .then(() => {
    console.log(`\n[verify-rookguard-codex-path] ${LANE} passed`);
  })
  .catch((err) => fail(err instanceof Error ? err.message : String(err)));
