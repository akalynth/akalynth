import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PORT = Number.parseInt(process.env.STUDIO_SMOKE_PORT || '3199', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CANONICAL_PATHS = [
  'packages/shared/maps/rookguard.json',
  'packages/shared/maps/azura.json',
];
const MAP_ID = 'studio-smoke-test';
const SPAWN = { x: 3, y: 2 };

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
  });
  return proc;
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

    const mutateFrom = Math.min(1, map.tiles.length - 1);
    if (map.tiles[mutateFrom] === map.tiles[0]) {
      const replacementIndex = map.tiles.findIndex((tile, index) => index !== 0 && tile !== map.tiles[0]);
      if (replacementIndex === -1) throw new Error('no_mutable_tile');
      map.tiles[0] = map.tiles[replacementIndex];
    } else {
      map.tiles[0] = map.tiles[mutateFrom];
    }
    map.name = 'Rookguard';
    map.spawn = { ...SPAWN };

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
    logs.push(`world_spawn=${world.map.spawn.x},${world.map.spawn.y}`);

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
    if (server.pid) {
      server.kill('SIGINT');
    }
    await fs.rm(new URL(`data/phone-studio/maps/${MAP_ID}.json`, `file://${ROOT}/`), { force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error('studio_smoke_failed', error);
  process.exit(1);
});
