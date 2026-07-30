#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);
const { WebSocketServer } = require('ws');

function timestampForPath() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
}

function parseArgs(argv) {
  const args = {
    outDir: path.join(repoRoot, 'evidence', `${timestampForPath()}-web-play-shell-smoke`),
    host: '127.0.0.1',
    fakePlayable: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };
    if (arg === '--out') args.outDir = path.resolve(readValue());
    else if (arg === '--port') args.port = Number(readValue());
    else if (arg === '--host') args.host = readValue();
    else if (arg === '--chrome') args.chrome = path.resolve(readValue());
    else if (arg === '--fake-playable') args.fakePlayable = true;
    else if (arg === '--help') {
      console.log([
        'Usage: node scripts/smoke-web-play-shell.mjs [options]',
        '',
        'Starts a local debug-client Vite server, runs the real-browser /play/ smoke,',
        'writes screenshots/report evidence, then stops the server.',
        '',
        'Options:',
        '  --out <dir>      Evidence output directory.',
        '  --port <port>    Vite port. Defaults to a free local port.',
        '  --host <host>    Vite host. Default: 127.0.0.1.',
        '  --chrome <path>  Chrome/Chromium executable path forwarded to the smoke script.',
        '  --fake-playable  Start a local fake HTTP/WS peer and require playable controls.',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function freePort(host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error('Could not allocate a free port'));
      });
    });
    server.on('error', reject);
  });
}

function urlAvailable(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 500));
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitForUrl(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await urlAvailable(url)) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function spawnLogged(command, args, options, logFile) {
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => fs.appendFileSync(logFile, chunk));
  child.stderr.on('data', (chunk) => fs.appendFileSync(logFile, chunk));
  return child;
}

function runLogged(command, args, options, logFile) {
  return new Promise((resolve) => {
    const child = spawnLogged(command, args, options, logFile);
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
}

function processExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

async function waitForProcessExit(child, timeoutMs) {
  if (processExited(child)) return true;
  return Promise.race([
    new Promise((resolve) => child.once('close', () => resolve(true))),
    sleep(timeoutMs).then(() => false),
  ]);
}

async function stopProcess(child) {
  if (!child || processExited(child)) return;
  child.kill('SIGTERM');
  if (await waitForProcessExit(child, 3500)) return;
  child.kill('SIGKILL');
  await waitForProcessExit(child, 3500);
}

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loopProgress(objective) {
  return {
    move: true,
    chat: true,
    tem: false,
    gate: false,
    gateOpen: false,
    objective,
    rookguardQuest: {
      started: true,
      fishDelivered: false,
      branch: null,
      completed: false,
    },
  };
}

function directionDelta(direction) {
  switch (direction) {
    case 'north':
      return { x: 0, y: -1 };
    case 'south':
      return { x: 0, y: 1 };
    case 'east':
      return { x: 1, y: 0 };
    case 'west':
      return { x: -1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseMessage(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return { type: 'invalid_json' };
  }
}

async function startFakePlayableServer(host) {
  const mapData = readJsonFile(path.join(repoRoot, 'packages/shared/maps/rookguard.json'));
  const state = {
    received: [],
    player: {
      id: 'smoke-player',
      name: 'Smoke Runner',
      x: mapData.spawn?.x ?? 2,
      y: mapData.spawn?.y ?? 2,
      status: 'alive',
      hp: 10,
      max_hp: 10,
      reputation: 0,
      sprite_id: 'base_human_male_01',
      title: null,
      badges: [],
      mark: null,
      loop: loopProgress('Step onto the glowing move rune (east plaza, tile 3,2)'),
    },
  };
  const nearby = [
    {
      id: 'training-slime-01',
      name: 'Training Slime',
      x: 4,
      y: 2,
      status: 'alive',
      hp: 4,
      max_hp: 4,
      reputation: 0,
      sprite_id: 'creature__rookguard_training_slime',
      title: null,
      badges: [],
      mark: null,
    },
  ];

  const setCors = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, x-csrf-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  };
  const sendJson = (req, res, status, body) => {
    setCors(req, res);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer((req, res) => {
    if (!req.url) {
      sendJson(req, res, 404, { ok: false, error: 'missing_url' });
      return;
    }
    if (req.method === 'OPTIONS') {
      setCors(req, res);
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || host}`);
    if (req.method === 'POST' && url.pathname === '/v1/session/guest') {
      sendJson(req, res, 200, {
        ok: true,
        player_id: state.player.id,
        guest_token: 'smoke-guest-token',
        name: state.player.name,
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/v1/world/Rookguard/state') {
      sendJson(req, res, 200, {
        ok: true,
        me: { status: state.player.status, loop: state.player.loop },
        map_data: mapData,
        loop: state.player.loop,
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/v1/worlds') {
      sendJson(req, res, 200, {
        ok: true,
        worlds: [
          { world_id: 'rookguard', name: 'Rookguard - Threshold keep' },
          { world_id: 'high_city', name: 'High City - Lantern ward' },
        ],
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/v1/outfits') {
      sendJson(req, res, 200, {
        ok: true,
        outfits: [
          { outfit_id: 'male_wanderer', name: 'Wanderer', sex: 'male' },
          { outfit_id: 'female_wanderer', name: 'Wanderer', sex: 'female' },
        ],
      });
      return;
    }
    if (req.method === 'GET' && (url.pathname === '/v1/accounts/me' || url.pathname === '/v1/characters')) {
      sendJson(req, res, 401, { ok: false, error: 'account_required' });
      return;
    }
    sendJson(req, res, 404, { ok: false, error: 'not_found', path: url.pathname });
  });

  const wss = new WebSocketServer({ server });
  const send = (ws, message) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(message));
  };
  const sendWorldState = (ws) => {
    send(ws, {
      type: 'world_state',
      map: 'Rookguard',
      map_data: mapData,
      player: state.player,
      nearby_players: nearby,
      loop: state.player.loop,
    });
  };

  wss.on('connection', (ws) => {
    send(ws, { type: 'welcome', version: 'smoke-fake-playable-v1' });
    ws.on('message', (raw) => {
      const message = parseMessage(raw);
      const type = typeof message.type === 'string' ? message.type : 'unknown';
      state.received.push({
        type,
        message,
        at: new Date().toISOString(),
      });
      if (type === 'login') {
        send(ws, {
          type: 'login_ack',
          ok: true,
          player_id: state.player.id,
          guest_token: 'smoke-guest-token',
          name: state.player.name,
        });
        return;
      }
      if (type === 'enter_world') {
        sendWorldState(ws);
        return;
      }
      if (type === 'inspect_wallet') {
        send(ws, { type: 'wallet_snapshot', gold: 12 });
        return;
      }
      if (type === 'get_chronicle') {
        send(ws, {
          type: 'chronicle_snapshot',
          player_id: state.player.id,
          events: [],
          has_more: false,
        });
        return;
      }
      if (type === 'move_intent') {
        const delta = directionDelta(message.direction);
        state.player = {
          ...state.player,
          x: clamp(state.player.x + delta.x, 0, mapData.width - 1),
          y: clamp(state.player.y + delta.y, 0, mapData.height - 1),
        };
        send(ws, {
          type: 'move_result',
          ok: true,
          x: state.player.x,
          y: state.player.y,
          reason: null,
          map: 'Rookguard',
          loop: state.player.loop,
        });
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  if (!port) throw new Error('Could not start fake playable server');

  return {
    httpBase: `http://${host}:${port}`,
    wsBase: `ws://${host}:${port}`,
    state,
    async close() {
      for (const client of wss.clients) client.terminate();
      await new Promise((resolve) => wss.close(() => resolve()));
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = args.port || await freePort(args.host);
  const baseUrl = `http://${args.host}:${port}/play/`;
  const outDir = args.outDir;
  const screenshotsDir = path.join(outDir, 'screenshots');
  const reportPath = path.join(outDir, 'mobile_playable_smoke_report.json');
  const viteLog = path.join(outDir, 'vite.log');
  const smokeLog = path.join(outDir, 'mobile-smoke.log');
  const wrapperReport = path.join(outDir, 'web_play_shell_smoke.json');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(viteLog, '');
  fs.writeFileSync(smokeLog, '');

  const startedAt = new Date().toISOString();
  let vite = null;
  let status = 'fail';
  let error = null;
  let smokeExit = null;
  let fakeServer = null;

  try {
    fakeServer = args.fakePlayable ? await startFakePlayableServer(args.host) : null;
    const childEnv = {
      ...process.env,
      NODE_ENV: 'development',
      ...(fakeServer
        ? {
            VITE_HTTP_BASE: fakeServer.httpBase,
            VITE_WS_BASE: fakeServer.wsBase,
          }
        : {}),
    };
    const debugClientRoot = path.join(repoRoot, 'apps/debug-client');
    const viteCli = path.join(debugClientRoot, 'node_modules/vite/bin/vite.js');
    vite = spawnLogged(
      process.execPath,
      [viteCli, '--host', args.host, '--port', String(port), '--strictPort'],
      { cwd: debugClientRoot, env: childEnv },
      viteLog
    );
    await waitForUrl(baseUrl);

    const smokeArgs = [
      'apps/debug-client/scripts/mobile-playable-smoke.mjs',
      '--base-url',
      baseUrl,
      '--out',
      screenshotsDir,
      '--report',
      reportPath,
    ];
    if (args.chrome) smokeArgs.push('--chrome', args.chrome);
    if (args.fakePlayable) smokeArgs.push('--expect-playable');

    smokeExit = await runLogged('node', smokeArgs, { cwd: repoRoot, env: childEnv }, smokeLog);
    if (smokeExit.code !== 0) {
      throw new Error(`mobile-playable-smoke exited with ${smokeExit.code ?? smokeExit.signal}`);
    }
    const receivedTypes = fakeServer ? fakeServer.state.received.map((entry) => entry.type) : [];
    if (fakeServer && !receivedTypes.includes('move_intent')) {
      throw new Error('fake playable smoke did not receive a move_intent from the client');
    }
    status = 'pass';
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    await stopProcess(vite);
    if (fakeServer) await fakeServer.close();
  }

  const smokeReport = fs.existsSync(reportPath)
    ? JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    : null;
  const finishedAt = new Date().toISOString();
  const summary = {
    id: 'AKALYNTH_WEB_PLAY_SHELL_SMOKE_V1',
    status,
    started_at: startedAt,
    finished_at: finishedAt,
    base_url: baseUrl,
    report: path.relative(repoRoot, reportPath),
    screenshots: path.relative(repoRoot, screenshotsDir),
    fake_playable: args.fakePlayable,
    fake_server: fakeServer ? {
      http_base: fakeServer.httpBase,
      ws_base: fakeServer.wsBase,
      received_count: fakeServer.state.received.length,
      received_types: fakeServer.state.received.map((entry) => entry.type),
      received_move_intent: fakeServer.state.received.some((entry) => entry.type === 'move_intent'),
      received_enter_world: fakeServer.state.received.some((entry) => entry.type === 'enter_world'),
      received_login: fakeServer.state.received.some((entry) => entry.type === 'login'),
      latest_player: fakeServer.state.player,
    } : null,
    logs: {
      vite: path.relative(repoRoot, viteLog),
      smoke: path.relative(repoRoot, smokeLog),
    },
    smoke_exit: smokeExit,
    smoke_status: smokeReport?.status ?? null,
    checks_total: Array.isArray(smokeReport?.checks) ? smokeReport.checks.length : 0,
    checks_failed: Array.isArray(smokeReport?.checks)
      ? smokeReport.checks.filter((check) => check.status !== 'pass').map((check) => check.id)
      : [],
    boundary: 'Local source preview only; no API/server runtime, /opt sync, deploy, restart, Caddy, or key/config mutation.',
    error,
  };
  fs.writeFileSync(wrapperReport, JSON.stringify(summary, null, 2) + '\n');

  console.log(`${summary.id} ${summary.status}`);
  console.log(`Report: ${wrapperReport}`);
  console.log(`Smoke report: ${reportPath}`);
  console.log(`Screenshots: ${screenshotsDir}`);

  if (status !== 'pass') process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
