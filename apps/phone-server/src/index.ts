import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

import { DIRECTION_OFFSETS, WALKABLE_TILES, type Direction, type MapData, type PlayerPublic } from '../../../packages/shared/types.js';
import type { MapName } from '../../../packages/shared/http.js';
import { validateDraftId, validateMapData } from '../../../packages/shared/map-validation.js';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const VERSION = 'phone-dev-0.1.0';
const TICK_MS = 250;
const GUEST_TTL_MS = 24 * 60 * 60 * 1000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DRAFT_MAP_DIR = path.join(ROOT, 'data', 'phone-studio', 'maps');
const CANONICAL_MAP_IDS: MapName[] = ['Rookguard', 'Azura'];
const STUDIO_SMOKE_ID = 'studio-smoke-test';
const STUDIO_SMOKE_SPAWN = { x: 3, y: 2 };

function loadMap(name: Lowercase<MapName>): MapData {
  const file = path.join(ROOT, 'packages', 'shared', 'maps', `${name}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as MapData;
}

const maps: Record<MapName, MapData> = {
  Rookguard: loadMap('rookguard'),
  Azura: loadMap('azura'),
};

let activePlaytest: {
  id: string;
  readOnly: boolean;
  map: MapData;
  activatedAt: string;
} | null = null;

let lastStudioSmoke: {
  ok: boolean;
  ranAt: string;
  draftId: string;
  worldSpawn?: { x: number; y: number };
  canonicalUnchanged: boolean;
  details: string[];
  error?: string;
} | null = null;

interface Session {
  playerId: string;
  token: string;
  name: string;
  mintedAt: number;
  expiresAt: number;
}

interface PhonePlayer extends PlayerPublic {
  token: string;
  map: MapName;
  socket?: WebSocket;
}

const sessions = new Map<string, Session>();
const players = new Map<string, PhonePlayer>();
const chronicle = new Map<string, Array<Record<string, unknown>>>();

function ensureDraftDir() {
  fs.mkdirSync(DRAFT_MAP_DIR, { recursive: true });
}

function isCanonicalMapId(id: string): id is MapName {
  return CANONICAL_MAP_IDS.includes(id as MapName);
}

function draftPath(id: string) {
  return path.join(DRAFT_MAP_DIR, `${id}.json`);
}

function canonicalPath(name: Lowercase<MapName>) {
  return path.join(ROOT, 'packages', 'shared', 'maps', `${name}.json`);
}

function hashFile(file: string) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readRequestJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('request_body_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function loadDraftMap(id: string): MapData | null {
  const idResult = validateDraftId(id);
  if (!idResult.ok) return null;
  const file = draftPath(id);
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
  const mapResult = validateMapData(data);
  if (!mapResult.ok) {
    throw new Error(`draft map ${id} invalid: ${mapResult.errors.join('; ')}`);
  }
  return data as MapData;
}

function listDraftIds(): string[] {
  ensureDraftDir();
  return fs.readdirSync(DRAFT_MAP_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .filter((id) => validateDraftId(id).ok)
    .sort();
}

function mapSummary(id: string, map: MapData, readOnly: boolean) {
  return {
    id,
    name: map.name,
    readOnly,
    width: map.width,
    height: map.height,
    spawn: map.spawn,
    active: activePlaytest?.id === id,
  };
}

function resolveStudioMap(id: string): { id: string; map: MapData; readOnly: boolean } | null {
  if (validateDraftId(id).ok) {
    const draft = loadDraftMap(id);
    if (draft) return { id, map: draft, readOnly: false };
  }
  if (isCanonicalMapId(id)) return { id, map: maps[id], readOnly: true };
  return null;
}

function resolveRuntimeMap(name: MapName): MapData {
  if (activePlaytest?.map.name === name) return activePlaytest.map;
  return maps[name];
}

function resetRuntimeState() {
  sessions.clear();
  players.clear();
  chronicle.clear();
}

function runStudioSmoke() {
  const ranAt = new Date().toISOString();
  const details: string[] = [];
  const canonicalFiles = {
    rookguard: canonicalPath('rookguard'),
    azura: canonicalPath('azura'),
  };
  const before = {
    rookguard: hashFile(canonicalFiles.rookguard),
    azura: hashFile(canonicalFiles.azura),
  };

  try {
    const source = maps.Rookguard;
    const draft: MapData = {
      ...source,
      tiles: [...source.tiles],
      spawn: { ...STUDIO_SMOKE_SPAWN },
      name: 'Rookguard',
    };
    const replacementIndex = draft.tiles.findIndex((tile, index) => index !== 0 && tile !== draft.tiles[0]);
    if (replacementIndex < 0) throw new Error('no_mutable_tile');
    draft.tiles[0] = draft.tiles[replacementIndex];

    const mapResult = validateMapData(draft);
    if (!mapResult.ok) throw new Error(mapResult.errors.join('; '));
    ensureDraftDir();
    fs.writeFileSync(draftPath(STUDIO_SMOKE_ID), JSON.stringify(draft, null, 2) + '\n', 'utf-8');
    details.push('draft_saved');

    resetRuntimeState();
    activePlaytest = {
      id: STUDIO_SMOKE_ID,
      readOnly: false,
      map: draft,
      activatedAt: ranAt,
    };
    const worldMap = resolveRuntimeMap('Rookguard');
    if (worldMap.spawn.x !== STUDIO_SMOKE_SPAWN.x || worldMap.spawn.y !== STUDIO_SMOKE_SPAWN.y) {
      throw new Error('world_spawn_mismatch');
    }
    details.push(`world_spawn=${worldMap.spawn.x},${worldMap.spawn.y}`);

    const after = {
      rookguard: hashFile(canonicalFiles.rookguard),
      azura: hashFile(canonicalFiles.azura),
    };
    const canonicalUnchanged = before.rookguard === after.rookguard && before.azura === after.azura;
    if (!canonicalUnchanged) throw new Error('canonical_mutated');
    details.push('canonical_unchanged');
    fs.rmSync(draftPath(STUDIO_SMOKE_ID), { force: true });
    details.push('temporary_draft_removed');

    lastStudioSmoke = {
      ok: true,
      ranAt,
      draftId: STUDIO_SMOKE_ID,
      worldSpawn: { ...worldMap.spawn },
      canonicalUnchanged,
      details,
    };
  } catch (error) {
    lastStudioSmoke = {
      ok: false,
      ranAt,
      draftId: STUDIO_SMOKE_ID,
      canonicalUnchanged: false,
      details,
      error: (error as Error).message,
    };
  }

  return lastStudioSmoke;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  });
  res.end(data);
}

function notFound(res: http.ServerResponse) {
  sendJson(res, 404, { error: 'not_found' });
}

function parseBearer(req: http.IncomingMessage): string | null {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(Array.isArray(header) ? header[0] : header);
  return match?.[1] ?? null;
}

function getSession(token: string | null): Session | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function createGuest(): Session {
  const now = Date.now();
  const index = sessions.size + 1;
  const session: Session = {
    playerId: `phone-player-${randomUUID()}`,
    token: `phone-token-${randomUUID()}`,
    name: `PhoneGuest${index}`,
    mintedAt: now,
    expiresAt: now + GUEST_TTL_MS,
  };
  sessions.set(session.token, session);
  return session;
}

function publicSession(session: Session) {
  return {
    player_id: session.playerId,
    guest_token: session.token,
    name: session.name,
    minted_at_ms: session.mintedAt,
    expires_at_ms: session.expiresAt,
    ttl_ms_remaining: Math.max(0, session.expiresAt - Date.now()),
  };
}

function isWalkable(map: MapData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const code = map.tiles[y * map.width + x];
  return WALKABLE_TILES.has(code);
}

function ensurePlayer(session: Session, mapName: MapName = 'Rookguard'): PhonePlayer {
  const existing = players.get(session.playerId);
  if (existing) return existing;
  const spawn = resolveRuntimeMap(mapName).spawn;
  const player: PhonePlayer = {
    id: session.playerId,
    token: session.token,
    name: session.name,
    x: spawn.x,
    y: spawn.y,
    map: mapName,
    status: 'alive',
    reputation: 0,
  };
  players.set(player.id, player);
  chronicle.set(player.id, [{
    kind: 'phone_session_started',
    timestamp: new Date().toISOString(),
    zone: mapName,
    x: player.x,
    y: player.y,
    details: { boundary: 'phone_server_in_memory' },
  }]);
  return player;
}

function nearbyPlayers(player: PhonePlayer): PlayerPublic[] {
  return Array.from(players.values())
    .filter((other) => other.id !== player.id && other.map === player.map)
    .map(toPublicPlayer);
}

function toPublicPlayer(player: PhonePlayer): PlayerPublic {
  return {
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    status: player.status,
    reputation: player.reputation,
  };
}

function broadcast(mapName: MapName, payload: unknown, except?: WebSocket) {
  const data = JSON.stringify(payload);
  for (const player of players.values()) {
    if (player.map !== mapName) continue;
    const socket = player.socket;
    if (!socket || socket === except || socket.readyState !== WebSocket.OPEN) continue;
    socket.send(data);
  }
}

async function handleHttp(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  if (req.method === 'GET' && url.pathname === '/v1/health') {
    sendJson(res, 200, { ok: true, version: VERSION, tick_ms: TICK_MS, now_iso: new Date().toISOString() });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/v1/maps') {
    sendJson(res, 200, { maps: CANONICAL_MAP_IDS.map((name) => mapSummary(name, resolveRuntimeMap(name), true)) });
    return;
  }

  const mapDetail = /^\/v1\/maps\/([^/]+)$/.exec(url.pathname);
  if (req.method === 'GET' && mapDetail) {
    const mapName = mapDetail[1] as MapName;
    const map = isCanonicalMapId(mapName) ? resolveRuntimeMap(mapName) : null;
    if (!map) return notFound(res);
    sendJson(res, 200, map);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/v1/studio/maps') {
    const canonical = CANONICAL_MAP_IDS.map((id) => mapSummary(id, maps[id], true));
    const drafts = listDraftIds().map((id) => {
      const draft = loadDraftMap(id);
      if (!draft) return null;
      return mapSummary(id, draft, false);
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    sendJson(res, 200, {
      maps: [...canonical, ...drafts],
      activePlaytest: activePlaytest
        ? {
            id: activePlaytest.id,
            name: activePlaytest.map.name,
            readOnly: activePlaytest.readOnly,
            activatedAt: activePlaytest.activatedAt,
          }
        : null,
      lastStudioSmoke,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/studio/smoke') {
    const result = runStudioSmoke();
    sendJson(res, result.ok ? 200 : 500, result);
    return;
  }

  const studioMap = /^\/v1\/studio\/maps\/([^/]+)$/.exec(url.pathname);
  if (req.method === 'GET' && studioMap) {
    const id = decodeURIComponent(studioMap[1]);
    const resolved = resolveStudioMap(id);
    if (!resolved) {
      const idResult = validateDraftId(id);
      if (!isCanonicalMapId(id) && !idResult.ok) return sendJson(res, 400, { error: 'invalid_map_id', details: idResult.errors });
      return notFound(res);
    }
    sendJson(res, 200, resolved);
    return;
  }

  if (req.method === 'PUT' && studioMap) {
    const id = decodeURIComponent(studioMap[1]);
    const idResult = validateDraftId(id);
    if (!idResult.ok) return sendJson(res, 400, { error: 'invalid_draft_id', details: idResult.errors });
    let body: unknown;
    try {
      body = await readRequestJson(req);
    } catch (error) {
      return sendJson(res, 400, { error: (error as Error).message });
    }
    const mapResult = validateMapData(body);
    if (!mapResult.ok) return sendJson(res, 400, { error: 'invalid_map', details: mapResult.errors });
    ensureDraftDir();
    const file = draftPath(id);
    fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n', 'utf-8');
    sendJson(res, 200, { ok: true, id, path: path.relative(ROOT, file), readOnly: false });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/studio/playtest') {
    let body: unknown;
    try {
      body = await readRequestJson(req);
    } catch (error) {
      return sendJson(res, 400, { error: (error as Error).message });
    }
    const id = typeof body === 'object' && body !== null && 'id' in body ? String((body as { id: unknown }).id) : '';
    const resolved = resolveStudioMap(id);
    if (!resolved) {
      const idResult = validateDraftId(id);
      if (!isCanonicalMapId(id) && !idResult.ok) return sendJson(res, 400, { error: 'invalid_map_id', details: idResult.errors });
      return notFound(res);
    }
    const mapResult = validateMapData(resolved.map);
    if (!mapResult.ok) return sendJson(res, 400, { error: 'invalid_map', details: mapResult.errors });
    resetRuntimeState();
    activePlaytest = {
      id: resolved.id,
      readOnly: resolved.readOnly,
      map: resolved.map,
      activatedAt: new Date().toISOString(),
    };
    sendJson(res, 200, {
      ok: true,
      activePlaytest: {
        id: activePlaytest.id,
        name: activePlaytest.map.name,
        readOnly: activePlaytest.readOnly,
        activatedAt: activePlaytest.activatedAt,
        width: activePlaytest.map.width,
        height: activePlaytest.map.height,
        spawn: activePlaytest.map.spawn,
      },
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/session/guest') {
    const session = createGuest();
    sendJson(res, 200, publicSession(session));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/v1/session/me') {
    const session = getSession(parseBearer(req));
    if (!session) return sendJson(res, 401, { error: 'not_authenticated' });
    sendJson(res, 200, { ok: true, ...publicSession(session) });
    return;
  }

  const worldState = /^\/v1\/world\/([^/]+)\/state$/.exec(url.pathname);
  if (req.method === 'GET' && worldState) {
    const mapName = worldState[1] as MapName;
    const map = isCanonicalMapId(mapName) ? resolveRuntimeMap(mapName) : null;
    if (!map) return notFound(res);
    const session = getSession(parseBearer(req));
    const player = session ? ensurePlayer(session, mapName) : null;
    sendJson(res, 200, {
      ok: true,
      version: VERSION,
      tick_ms: TICK_MS,
      updated_at_ms: Date.now(),
      map: {
        name: mapName,
        width: map.width,
        height: map.height,
        spawn: map.spawn,
      },
      player_count: Array.from(players.values()).filter((p) => p.map === mapName).length,
      ...(session && player ? { me: { ...publicSession(session), status: player.status } } : {}),
    });
    return;
  }

  notFound(res);
}

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function handleMessage(socket: WebSocket, raw: Buffer | ArrayBuffer | Buffer[]) {
  let msg: any;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    send(socket, { type: 'error', code: 'invalid_message', message: 'invalid JSON' });
    return;
  }

  const state = socketState.get(socket) || {};
  switch (msg.type) {
    case 'connect':
      send(socket, { type: 'welcome', version: VERSION });
      return;
    case 'login': {
      const token = msg.guest_token || msg.token;
      const session = getSession(typeof token === 'string' ? token : null);
      if (!session) {
        send(socket, { type: 'login_ack', ok: false, player_id: '', name: '', reason: 'token_invalid' });
        return;
      }
      const player = ensurePlayer(session);
      player.socket = socket;
      socketState.set(socket, { ...state, session, player });
      send(socket, {
        type: 'login_ack',
        ok: true,
        player_id: session.playerId,
        guest_token: session.token,
        expires_at: session.expiresAt,
        name: session.name,
      });
      return;
    }
    case 'enter_world': {
      const player = socketState.get(socket)?.player;
      if (!player) return send(socket, { type: 'error', code: 'not_authenticated', message: 'login first' });
      send(socket, {
        type: 'world_state',
        map: player.map,
        player: toPublicPlayer(player),
        nearby_players: nearbyPlayers(player),
      });
      broadcast(player.map, { type: 'player_joined', player: toPublicPlayer(player) }, socket);
      return;
    }
    case 'move_intent': {
      const player = socketState.get(socket)?.player;
      if (!player) return send(socket, { type: 'error', code: 'not_authenticated', message: 'login first' });
      const direction = msg.direction as Direction;
      const delta = DIRECTION_OFFSETS[direction];
      if (!delta) return send(socket, { type: 'move_result', ok: false, x: player.x, y: player.y, reason: 'bad_direction' });
      const map = resolveRuntimeMap(player.map);
      const nx = player.x + delta.x;
      const ny = player.y + delta.y;
      if (!isWalkable(map, nx, ny)) {
        send(socket, { type: 'move_result', ok: false, x: player.x, y: player.y, reason: 'blocked', map: player.map });
        return;
      }
      player.x = nx;
      player.y = ny;
      chronicle.get(player.id)?.push({
        kind: 'move',
        timestamp: new Date().toISOString(),
        zone: player.map,
        x: player.x,
        y: player.y,
        details: { direction },
      });
      send(socket, { type: 'move_result', ok: true, x: player.x, y: player.y, reason: null, map: player.map });
      broadcast(player.map, { type: 'player_moved', player_id: player.id, x: player.x, y: player.y }, socket);
      return;
    }
    case 'chat': {
      const player = socketState.get(socket)?.player;
      if (!player) return send(socket, { type: 'error', code: 'not_authenticated', message: 'login first' });
      const message = String(msg.message || '').slice(0, 240);
      if (!message.trim()) return;
      const payload = { type: 'chat_broadcast', player_id: player.id, name: player.name, message };
      send(socket, payload);
      broadcast(player.map, payload, socket);
      chronicle.get(player.id)?.push({
        kind: 'chat',
        timestamp: new Date().toISOString(),
        zone: player.map,
        x: player.x,
        y: player.y,
        details: { message },
      });
      return;
    }
    case 'get_chronicle': {
      const player = socketState.get(socket)?.player;
      if (!player) return send(socket, { type: 'error', code: 'not_authenticated', message: 'login first' });
      const limit = Math.max(1, Math.min(Number(msg.limit || 50), 200));
      const events = (chronicle.get(player.id) || []).slice(-limit).reverse();
      send(socket, { type: 'chronicle_snapshot', player_id: player.id, events, has_more: false });
      return;
    }
    case 'attack_intent':
      send(socket, { type: 'combat_rejected', reason: 'pvp_disabled' });
      return;
    default:
      send(socket, { type: 'error', code: 'invalid_message', message: `phone server does not handle ${msg.type}` });
  }
}

const socketState = new WeakMap<WebSocket, { session?: Session; player?: PhonePlayer }>();
const server = http.createServer((req, res) => {
  void handleHttp(req, res).catch((error) => {
    sendJson(res, 500, { error: 'internal_error', message: (error as Error).message });
  });
});
const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
  socket.on('message', (raw) => handleMessage(socket, raw));
  socket.on('close', () => {
    const player = socketState.get(socket)?.player;
    if (!player) return;
    player.socket = undefined;
    broadcast(player.map, { type: 'player_left', player_id: player.id }, socket);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`akalynth phone server listening on http://127.0.0.1:${PORT}`);
});
