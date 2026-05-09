import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';
import WebSocket from 'ws';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PORT = Number.parseInt(process.env.STUDIO_SMOKE_PORT || '3199', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CANONICAL_PATHS = [
  'packages/shared/maps/rookguard.json',
  'packages/shared/maps/azura.json',
];
const MAP_ID = 'studio-smoke-test';
const SPAWN = { x: 2, y: 2 };
const TILE = {
  Grass: 0,
  Stone: 1,
  TutorialMove: 5,
  TutorialChat: 6,
  TutorialTem: 7,
  GateToAzura: 8,
};
const MUTATION = { x: 4, y: 3, tile: TILE.Stone };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(path, init) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  let json = {};
  try {
    json = await res.json();
  } catch {
    // keep json empty for easier failure messaging
  }
  if (!res.ok) {
    throw new Error(`http_${path}_failed_${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function shaFor(path) {
  const file = new URL(path, `file://${ROOT}/`);
  const raw = await fs.readFile(file, 'utf-8');
  return createHash('sha256').update(raw).digest('hex');
}

function waitForHealthSignal(server) {
  const deadline = Date.now() + 12_000;
  const poll = async () => {
    try {
      const res = await fetch(`${BASE_URL}/v1/health`);
      if (res.ok) return;
    } catch {}
    if (Date.now() > deadline) throw new Error('server_health_timeout');
    await sleep(250);
    return poll();
  };
  return poll();
}

function startServer() {
  const proc = spawn('npm', ['run', 'dev'], {
    cwd: `${ROOT}/apps/phone-server`,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });
  return proc;
}

async function stopServer(server) {
  if (!server.pid || server.exitCode !== null || server.signalCode !== null) return;

  const exited = new Promise((resolve) => {
    server.once('exit', resolve);
  });

  const target = process.platform === 'win32' ? server.pid : -server.pid;
  try {
    process.kill(target, 'SIGTERM');
  } catch (error) {
    if (error?.code === 'ESRCH') return;
    throw error;
  }

  const graceful = await Promise.race([
    exited.then(() => true),
    sleep(2500).then(() => false),
  ]);
  if (graceful) return;

  try {
    process.kill(target, 'SIGKILL');
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
  await Promise.race([
    exited,
    sleep(1000),
  ]);
}

async function closeWebSocket(ws) {
  if (ws.readyState === WebSocket.CLOSED) return;
  if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        ws.terminate();
        resolve();
      }, 1000);
      ws.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.close();
    });
    return;
  }
  ws.terminate();
}

function setTile(map, x, y, code) {
  map.tiles[y * map.width + x] = code;
}

function createWsHarness() {
  const ws = new WebSocket(BASE_URL.replace(/^http/, 'ws'));
  const messages = [];
  let wake = null;

  ws.on('message', (raw) => {
    messages.push(JSON.parse(raw.toString()));
    if (wake) {
      wake();
      wake = null;
    }
  });

  const opened = new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  async function waitFor(predicate, label, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const index = messages.findIndex(predicate);
      if (index >= 0) {
        const [message] = messages.splice(index, 1);
        return message;
      }
      await new Promise((resolve) => {
        wake = resolve;
        setTimeout(resolve, 50);
      });
    }
    throw new Error(`ws_timeout:${label}`);
  }

  function send(payload) {
    ws.send(JSON.stringify(payload));
  }

  return { ws, opened, waitFor, send };
}

async function runPlayableLoop(token, logs) {
  const client = createWsHarness();
  try {
    await client.opened;
    client.send({ type: 'connect' });
    await client.waitFor((msg) => msg.type === 'welcome', 'welcome');

    client.send({ type: 'login', guest_token: token });
    const login = await client.waitFor((msg) => msg.type === 'login_ack', 'login_ack');
    if (!login.ok) throw new Error(`login_failed:${login.reason ?? 'unknown'}`);

    client.send({ type: 'enter_world' });
    const world = await client.waitFor((msg) => msg.type === 'world_state', 'world_state');
    if (world?.map_data?.spawn?.x !== SPAWN.x || world?.map_data?.spawn?.y !== SPAWN.y) {
      throw new Error('ws_world_spawn_mismatch');
    }
    const mutationIndex = MUTATION.y * world.map_data.width + MUTATION.x;
    if (world.map_data.tiles[mutationIndex] !== MUTATION.tile) {
      throw new Error('ws_world_tile_mutation_mismatch');
    }
    logs.push('ws_world_reflects_draft');

    const moves = ['east', 'east', 'east', 'east', 'east', 'east', 'east', 'east'];
    let loop = world.loop ?? null;
    for (const direction of moves) {
      client.send({ type: 'move_intent', direction });
      const result = await client.waitFor((msg) => msg.type === 'move_result', `move_${direction}`);
      if (!result.ok) throw new Error(`move_failed:${direction}:${result.reason}`);
      loop = result.loop ?? loop;
    }
    if (!loop?.complete || !loop?.gateOpen || !loop?.move || !loop?.chat || !loop?.tem || !loop?.gate) {
      throw new Error(`play_loop_incomplete:${JSON.stringify(loop)}`);
    }
    logs.push(`play_loop_complete=${loop.lastEvent}`);
  } finally {
    await closeWebSocket(client.ws);
  }
}

async function main() {
  const canonicalBefore = Object.fromEntries(await Promise.all(CANONICAL_PATHS.map(async (file) => [file, await shaFor(file)])));
  const logs = [];
  const server = startServer();
  logs.push(`server_pid=${server.pid}`);
  try {
    await waitForHealthSignal(server);
    logs.push('server_healthy');

    const source = await fetchJson('/v1/studio/maps/Rookguard');
    if (!source?.map || !source?.map?.tiles?.length) throw new Error('source_map_invalid');
    const map = { ...source.map, tiles: [...source.map.tiles] };
    if (map.tiles.length !== map.width * map.height) throw new Error('source_map_malformed');

    map.name = 'Rookguard';
    map.spawn = { ...SPAWN };
    setTile(map, MUTATION.x, MUTATION.y, MUTATION.tile);
    setTile(map, 3, 2, TILE.TutorialMove);
    setTile(map, 5, 2, TILE.TutorialChat);
    setTile(map, 7, 2, TILE.TutorialTem);
    setTile(map, 10, 2, TILE.GateToAzura);

    await fetchJson(`/v1/studio/maps/${encodeURIComponent(MAP_ID)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(map),
    });
    logs.push('draft_saved');

    await fetchJson('/v1/studio/playtest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: MAP_ID }),
    });
    const world = await fetchJson('/v1/world/Rookguard/state');
    if (world?.map?.spawn?.x !== SPAWN.x || world?.map?.spawn?.y !== SPAWN.y) {
      throw new Error('world_spawn_mismatch');
    }
    const runtimeMap = await fetchJson('/v1/maps/Rookguard');
    if (runtimeMap.tiles[MUTATION.y * runtimeMap.width + MUTATION.x] !== MUTATION.tile) {
      throw new Error('world_tile_mutation_mismatch');
    }
    logs.push(`world_spawn=${world.map.spawn.x},${world.map.spawn.y}`);
    logs.push(`world_tile=${MUTATION.x},${MUTATION.y}:${runtimeMap.tiles[MUTATION.y * runtimeMap.width + MUTATION.x]}`);

    const session = await fetchJson('/v1/session/guest', { method: 'POST' });
    if (!session.guest_token) throw new Error('guest_session_missing_token');
    await runPlayableLoop(session.guest_token, logs);

    const canonicalAfter = Object.fromEntries(await Promise.all(CANONICAL_PATHS.map(async (file) => [file, await shaFor(file)])));
    for (const file of CANONICAL_PATHS) {
      if (canonicalBefore[file] !== canonicalAfter[file]) {
        throw new Error(`canonical_mutated:${file}`);
      }
    }
    logs.push('canonical_unchanged');
    console.log('studio_smoke_passed');
    logs.forEach((line) => console.log(line));
  } finally {
    await stopServer(server);
    await fs.rm(new URL(`data/phone-studio/maps/${MAP_ID}.json`, `file://${ROOT}/`), { force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error('studio_smoke_failed', error);
  process.exit(1);
});
