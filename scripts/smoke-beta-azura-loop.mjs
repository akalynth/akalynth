#!/usr/bin/env node
/**
 * Live beta smoke: Rookguard onboarding → Azura gather → refine → deliver (keystone).
 * Ticket: AZURA_LOOP_ALIVE_V1 · Lane: AKALYNTH_BETA_AZURA_LOOP_ALIVE_V1
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOKGUARD_MAP_PATH = path.join(REPO_ROOT, 'packages/shared/maps/rookguard.json');
const LANE = 'AKALYNTH_BETA_AZURA_LOOP_ALIVE_V1';
const TEM_CHALLENGE_RESPONSE = 'AKALYNTH';
const WALKABLE = new Set([0, 3, 4, 5, 6, 7, 8]);
const TILE = { Wall: 1, TutorialMove: 4, TutorialChat: 5, TutorialTem: 6, GateToAzura: 8 };

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

const defaults = {
  apiBase: 'https://beta-api.akalynth.com',
  webBase: 'https://beta.akalynth.com',
  wsUrl: 'wss://beta-api.akalynth.com',
  reportPath: path.resolve('.tmp', 'beta-azura-loop-smoke', stamp(), 'receipt.json'),
  browser: false,
  live: false,
  timeoutMs: 180_000,
  realAccount: false,
  emailEnv: 'AKALYNTH_BETA_SMOKE_EMAIL',
  passwordEnv: 'AKALYNTH_BETA_SMOKE_PASSWORD',
  characterName: '',
};

function parseArgs(argv) {
  const args = { ...defaults };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };
    if (arg === '--live') args.live = true;
    else if (arg === '--api-base') args.apiBase = readValue().replace(/\/$/, '');
    else if (arg === '--web-base') args.webBase = readValue().replace(/\/$/, '');
    else if (arg === '--ws-url') args.wsUrl = readValue();
    else if (arg === '--report') args.reportPath = path.resolve(readValue());
    else if (arg === '--timeout-ms') args.timeoutMs = Number(readValue());
    else if (arg === '--browser') args.browser = true;
    else if (arg === '--real-account') args.realAccount = true;
    else if (arg === '--email-env') args.emailEnv = readValue();
    else if (arg === '--password-env') args.passwordEnv = readValue();
    else if (arg === '--character-name') args.characterName = readValue();
    else if (arg === '--help') {
      console.log([
        'Usage: node scripts/smoke-beta-azura-loop.mjs --live [options]',
        '',
        'Proves beta gather → refine → deliver on Azura after Rookguard onboarding.',
        'Writes JSON receipt with deliver_result keystone_token proof.',
        '',
        'Options:',
        '  --live              Required: mutates beta account/character state.',
        '  --browser           Screenshot /play/ gather panel after loop (tutorial-complete re-login).',
        '  --real-account      Use AKALYNTH_BETA_SMOKE_EMAIL/PASSWORD (skips RG if already complete).',
        '  --character-name    Select named character for --real-account.',
        '  --timeout-ms        Default 180000 (rookguard path needs headroom).',
      ].join('\n'));
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.live) throw new Error('Refusing to mutate beta without --live');
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 30_000) {
    throw new Error('--timeout-ms must be >= 30000');
  }
  return args;
}

function redactId(value) {
  return typeof value === 'string' && value ? `${value.slice(0, 10)}...` : null;
}

function randomSuffix() {
  return `${stamp().slice(9, 15)}${randomBytes(3).toString('hex')}`;
}

function createCookieJar() {
  const jar = new Map();
  return {
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    absorb(headers) {
      const setCookies = typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : (headers.get('set-cookie') ? headers.get('set-cookie').split(/,(?=\s*[^;,]+=)/g) : []);
      for (const setCookie of setCookies) {
        const first = setCookie.split(';', 1)[0];
        const idx = first.indexOf('=');
        if (idx > 0) jar.set(first.slice(0, idx), first.slice(idx + 1));
      }
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function tileAt(map, point) {
  return map.tiles[point.y * map.width + point.x] ?? TILE.Wall;
}

function findTile(map, tile) {
  const index = map.tiles.indexOf(tile);
  if (index < 0) throw new Error(`tile missing: ${tile}`);
  return { x: index % map.width, y: Math.floor(index / map.width) };
}

function neighbors(point) {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ];
}

function directionBetween(a, b) {
  if (b.x === a.x + 1 && b.y === a.y) return 'east';
  if (b.x === a.x - 1 && b.y === a.y) return 'west';
  if (b.x === a.x && b.y === a.y + 1) return 'south';
  if (b.x === a.x && b.y === a.y - 1) return 'north';
  throw new Error(`not adjacent: ${a.x},${a.y} -> ${b.x},${b.y}`);
}

function pathTo(map, from, to) {
  const start = `${from.x},${from.y}`;
  const goal = `${to.x},${to.y}`;
  const prev = new Map();
  const points = new Map([[start, from]]);
  const queue = [from];
  prev.set(start, null);
  while (queue.length) {
    const current = queue.shift();
    const key = `${current.x},${current.y}`;
    if (key === goal) break;
    for (const next of neighbors(current)) {
      const nextKey = `${next.x},${next.y}`;
      if (prev.has(nextKey) || next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height) continue;
      if (!WALKABLE.has(tileAt(map, next))) continue;
      prev.set(nextKey, key);
      points.set(nextKey, next);
      queue.push(next);
    }
  }
  if (!prev.has(goal)) throw new Error(`no path ${start} -> ${goal}`);
  const reversed = [];
  for (let at = goal; at; at = prev.get(at) ?? null) {
    reversed.push(points.get(at));
  }
  reversed.reverse();
  const dirs = [];
  for (let i = 1; i < reversed.length; i += 1) dirs.push(directionBetween(reversed[i - 1], reversed[i]));
  return dirs;
}

function adjacentWalkableTo(map, target) {
  for (const next of neighbors(target)) {
    if (next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height) continue;
    if (WALKABLE.has(tileAt(map, next))) return next;
  }
  throw new Error(`no adjacent walkable near ${target.x},${target.y}`);
}

class WsHarness {
  constructor(ws) {
    this.ws = ws;
    this.queue = [];
    this.waiters = [];
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      const idx = this.waiters.findIndex((w) => w.predicate(msg));
      if (idx >= 0) {
        const [w] = this.waiters.splice(idx, 1);
        clearTimeout(w.timeout);
        w.resolve(msg);
        return;
      }
      this.queue.push(msg);
    });
  }

  static async connect(url, timeoutMs) {
    const ws = new WebSocket(url);
    const harness = new WsHarness(ws);
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('ws open timeout')), 10_000);
      ws.once('open', () => { clearTimeout(t); resolve(); });
      ws.once('error', (err) => { clearTimeout(t); reject(err); });
    });
    await harness.waitFor((m) => m.type === 'welcome', 'welcome', timeoutMs);
    return harness;
  }

  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  waitFor(predicate, label, timeoutMs = 15_000) {
    const queued = this.queue.findIndex(predicate);
    if (queued >= 0) {
      const [msg] = this.queue.splice(queued, 1);
      return Promise.resolve(msg);
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timeout: setTimeout(() => {
          const i = this.waiters.indexOf(waiter);
          if (i >= 0) this.waiters.splice(i, 1);
          reject(new Error(`timeout:${label}`));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  close() {
    this.ws.close();
  }
}

async function sendMove(client, direction, timeoutMs) {
  client.send({ type: 'move_intent', direction });
  const result = await client.waitFor((m) => m.type === 'move_result', `move:${direction}`, timeoutMs);
  if (result.ok !== true) throw new Error(`move ${direction} failed: ${JSON.stringify(result)}`);
  await sleep(140);
  return result;
}

async function walkPath(client, dirs, timeoutMs) {
  let last = null;
  for (const dir of dirs) last = await sendMove(client, dir, timeoutMs);
  return last;
}

async function moveToward(client, from, target, stopManhattan, timeoutMs) {
  let cur = { ...from };
  let guard = 0;
  while (manhattan(cur, target) > stopManhattan && guard++ < 50) {
    let dir;
    if (cur.x < target.x) dir = 'east';
    else if (cur.x > target.x) dir = 'west';
    else if (cur.y < target.y) dir = 'south';
    else dir = 'north';
    const r = await sendMove(client, dir, timeoutMs);
    cur = { x: r.x, y: r.y };
  }
  return cur;
}

async function onboardToAzura(client, map, startWorld, timeoutMs) {
  if (startWorld.map !== 'Rookguard') throw new Error(`onboard expects Rookguard, got ${startWorld.map}`);
  let current = { x: startWorld.player.x, y: startWorld.player.y };

  const moveRune = findTile(map, TILE.TutorialMove);
  await walkPath(client, pathTo(map, current, moveRune), timeoutMs);
  current = moveRune;
  await client.waitFor((m) => m.type === 'loop_update' && m.event === 'rookguard_move_complete', 'loop:move', timeoutMs);

  client.send({ type: 'chat', message: 'azura loop smoke' });
  await client.waitFor((m) => m.type === 'chat_broadcast' && m.message === 'azura loop smoke', 'chat', timeoutMs);
  await client.waitFor((m) => m.type === 'loop_update' && m.event === 'rookguard_chat_complete', 'loop:chat', timeoutMs);

  const temRune = findTile(map, TILE.TutorialTem);
  await walkPath(client, pathTo(map, current, temRune), timeoutMs);
  current = temRune;
  await client.waitFor((m) => m.type === 'tem_challenge', 'tem', timeoutMs);
  client.send({ type: 'tem_response', response: TEM_CHALLENGE_RESPONSE });
  await client.waitFor((m) => m.type === 'loop_update' && m.event === 'rookguard_tem_complete', 'loop:tem', timeoutMs);

  const trainingSlime = { x: 14, y: 14 };
  const combatTile = adjacentWalkableTo(map, trainingSlime);
  await walkPath(client, pathTo(map, current, combatTile), timeoutMs);
  current = combatTile;
  for (let i = 0; i < 3; i += 1) {
    client.send({ type: 'attack_intent', target_id: 'mob:training_slime' });
    if (i < 2) await sleep(2100);
  }
  await client.waitFor((m) => m.type === 'combat_resolved' && m.defender_id === 'mob:training_slime', 'combat', timeoutMs);
  await client.waitFor((m) => m.type === 'loop_update' && m.event === 'rookguard_training_complete', 'loop:training', timeoutMs);

  const guildHall = map.landmarks.guild_hall;
  const guildCenter = {
    x: guildHall.x + Math.floor(guildHall.width / 2),
    y: guildHall.y + Math.floor(guildHall.height / 2),
  };
  let guildTile = guildCenter;
  if (!WALKABLE.has(tileAt(map, guildTile))) {
    for (const next of neighbors(guildTile)) {
      if (WALKABLE.has(tileAt(map, next))) { guildTile = next; break; }
    }
  }
  await walkPath(client, pathTo(map, current, guildTile), timeoutMs);
  client.send({ type: 'declare_vocation', vocation: 'hexer' });
  await client.waitFor((m) => m.type === 'loop_update' && m.event === 'rookguard_profession_declared', 'loop:profession', timeoutMs);

  const gate = findTile(map, TILE.GateToAzura);
  const gateMove = await walkPath(client, pathTo(map, current, gate), timeoutMs);
  if (gateMove?.map !== 'Azura') throw new Error(`gate did not transfer to Azura: ${JSON.stringify(gateMove)}`);
}

async function runAzuraLoop(client, timeoutMs) {
  const azura = await client.waitFor((m) => m.type === 'world_state' && m.map === 'Azura', 'world:Azura', timeoutMs);
  let cur = { x: azura.player.x, y: azura.player.y };

  const snapshot = await client.waitFor((m) => m.type === 'gather_snapshot', 'gather_snapshot', timeoutMs);
  const nodes = snapshot.nodes ?? [];
  const stations = snapshot.stations ?? [];
  const node = nodes.find((n) => n.node_id === 'azura_ley_mote_e');
  const refinery = stations.find((s) => s.station_id === 'azura_refinery_stand');
  const curation = stations.find((s) => s.station_id === 'azura_curation_stand');
  if (!node || !refinery || !curation) {
    throw new Error(`missing gather registry: ${JSON.stringify({ nodes, stations })}`);
  }

  cur = await moveToward(client, cur, node, 1, timeoutMs);
  client.send({ type: 'gather_intent', node_id: node.node_id });
  const gatherAccept = await client.waitFor((m) => m.type === 'gather_result', 'gather_result', timeoutMs);
  if (!gatherAccept.ok) throw new Error(`gather rejected: ${JSON.stringify(gatherAccept)}`);
  await client.waitFor((m) => m.type === 'gather_completed' && m.node_id === node.node_id, 'gather_completed', timeoutMs);

  cur = await moveToward(client, cur, refinery, 1, timeoutMs);
  client.send({ type: 'refine_intent', station_id: refinery.station_id });
  const refineAccept = await client.waitFor((m) => m.type === 'refine_result', 'refine_result', timeoutMs);
  if (!refineAccept.ok) throw new Error(`refine rejected: ${JSON.stringify(refineAccept)}`);
  await client.waitFor((m) => m.type === 'refine_completed' && m.station_id === refinery.station_id, 'refine_completed', timeoutMs);

  cur = await moveToward(client, cur, curation, 1, timeoutMs);
  client.send({ type: 'deliver_intent', station_id: curation.station_id });
  const delivered = await client.waitFor((m) => m.type === 'deliver_result', 'deliver_result', timeoutMs);
  if (!delivered.ok) throw new Error(`deliver failed: ${JSON.stringify(delivered)}`);
  if (delivered.reward !== 'keystone_token' || delivered.refined !== true) {
    throw new Error(`expected keystone refined deliver: ${JSON.stringify(delivered)}`);
  }

  return {
    node_id: node.node_id,
    refinery_id: refinery.station_id,
    curation_id: curation.station_id,
    deliver_result: {
      ok: delivered.ok,
      reward: delivered.reward,
      refined: delivered.refined,
      item_type: delivered.item_type,
    },
  };
}

async function playwrightAzuraPanel(args, identity, screenshotPath, timeoutMs) {
  const { chromium } = await import('playwright-core');
  const candidates = [
    process.env.AKALYNTH_CHROME,
    path.join(os.homedir(), '.cache/ms-playwright/chromium-1223/chrome-linux64/chrome'),
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
  ].filter(Boolean);
  let chrome = null;
  for (const c of candidates) {
    try {
      await import('node:fs/promises').then((fs) => fs.access(c));
      chrome = c;
      break;
    } catch {}
  }
  if (!chrome) return { ok: false, error: 'no_chrome', screenshot: null };

  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(({ key, value }) => {
      window.localStorage.setItem(key, value);
    }, { key: 'akalynth.identity.v1', value: JSON.stringify(identity) });
    const page = await context.newPage();
    await page.goto(new URL('/play/', args.webBase).href, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForSelector('.conn-pill.connected', { timeout: timeoutMs });
    await page.waitForSelector('.gather-card', { timeout: timeoutMs });
    await page.waitForSelector('.gather-title', { timeout: timeoutMs });
    const title = (await page.locator('.gather-title').textContent())?.trim() ?? '';
    const hasNodes = (await page.locator('.gather-row[aria-label^="node-"]').count()) > 0;
    mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: false });
    return { ok: title.length > 0 && hasNodes, title, has_nodes: hasNodes, screenshot: screenshotPath, url: page.url() };
  } finally {
    await browser.close();
  }
}

async function createPlaySession(args, jar, checks, addCheck) {
  const request = async (method, url, body, opts = {}) => {
    const headers = { accept: 'application/json', ...(opts.headers ?? {}) };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const cookies = jar.header();
    if (cookies) headers.cookie = cookies;
    const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    jar.absorb(res.headers);
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    return { res, body: parsed };
  };

  let character;
  let csrfToken = '';

  if (args.realAccount) {
    const email = process.env[args.emailEnv] ?? '';
    const password = process.env[args.passwordEnv] ?? '';
    addCheck('real_account_email_env', email.length > 0);
    addCheck('real_account_password_env', password.length > 0);
    const login = await request('POST', `${args.apiBase}/v1/accounts/login`, { email, password });
    addCheck('login_200', login.res.status === 200 && login.body?.ok === true);
    csrfToken = login.body?.csrf_token ?? '';
    const list = await request('GET', `${args.apiBase}/v1/characters`);
    const characters = Array.isArray(list.body?.characters) ? list.body.characters : [];
    addCheck('characters_list', characters.length > 0);
    character = args.characterName ? characters.find((c) => c.name === args.characterName) : characters[0];
    addCheck('character_selected', Boolean(character?.character_id));
  } else {
    const suffix = randomSuffix();
    const email = `akalynth-azura-${suffix}@example.invalid`;
    const password = randomBytes(24).toString('base64url');
    const charName = `Az${suffix}`.slice(0, 18);
    const reg = await request('POST', `${args.apiBase}/v1/accounts/register`, {
      handle: `Azura${suffix}`.slice(0, 24),
      email,
      password,
    });
    addCheck('register_201', reg.res.status === 201);
    if (reg.body?.dev_verification_token) {
      await request('POST', `${args.apiBase}/v1/accounts/verify-email`, { token: reg.body.dev_verification_token });
    }
    const login = await request('POST', `${args.apiBase}/v1/accounts/login`, { email, password });
    addCheck('login_200', login.res.status === 200 && login.body?.ok === true);
    csrfToken = login.body?.csrf_token ?? '';
    const outfits = await request('GET', `${args.apiBase}/v1/outfits?sex=male`);
    const outfit = outfits.body?.outfits?.[0];
    addCheck('outfits_200', outfits.res.status === 200 && outfit?.outfit_id);
    const create = await request('POST', `${args.apiBase}/v1/characters`, {
      name: charName,
      sex: 'male',
      outfit_id: outfit.outfit_id,
      world_id: 'rookguard',
    }, { headers: { 'x-csrf-token': csrfToken } });
    addCheck('character_create_201', create.res.status === 201 && create.body?.ok === true);
    character = create.body.character;
  }

  const select = await request('POST', `${args.apiBase}/v1/characters/select`, {
    character_id: character.character_id,
  }, { headers: { 'x-csrf-token': csrfToken } });
  addCheck('character_select_200', select.res.status === 200 && select.body?.ok === true);
  const playToken = select.body?.token ?? '';
  addCheck('play_token_issued', playToken.length > 20);

  return {
    character,
    playToken,
    expiresAt: select.body?.expires_at ?? Date.now() + 15 * 60 * 1000,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const checks = [];
  const jar = createCookieJar();
  const rookguardMap = JSON.parse(readFileSync(ROOKGUARD_MAP_PATH, 'utf8'));
  let report;
  let loopProof = null;

  const addCheck = (name, ok, details = {}) => {
    checks.push({ name, ok: Boolean(ok), ...details });
    if (!ok) throw new Error(`check_failed:${name}`);
  };

  try {
    const health = await fetch(`${args.apiBase}/v1/health`);
    addCheck('beta_health_200', health.ok, { status: health.status });

    const { character, playToken, expiresAt } = await createPlaySession(args, jar, checks, addCheck);

    const client = await WsHarness.connect(args.wsUrl, args.timeoutMs);
    try {
      client.send({ type: 'connect' });
      client.send({ type: 'login', token: playToken });
      const loginAck = await client.waitFor((m) => m.type === 'login_ack', 'login_ack', args.timeoutMs);
      addCheck('ws_login_ack', loginAck.ok !== false);

      client.send({ type: 'enter_world' });
      const entered = await client.waitFor((m) => m.type === 'world_state', 'world_state:enter', args.timeoutMs);
      if (entered.map === 'Azura') {
        addCheck('rookguard_skipped_tutorial_complete', true, { map: entered.map });
      } else {
        addCheck('rookguard_onboarding_start', entered.map === 'Rookguard', { map: entered.map });
        await onboardToAzura(client, rookguardMap, entered, args.timeoutMs);
        addCheck('rookguard_onboarding_complete', true);
      }

      loopProof = await runAzuraLoop(client, args.timeoutMs);
      addCheck('gather_refine_deliver_keystone', loopProof.deliver_result.reward === 'keystone_token', loopProof);
    } finally {
      client.close();
    }

    let browser = { status: 'skipped' };
    if (args.browser) {
      const screenshotPath = path.join(path.dirname(args.reportPath), 'azura-gather-panel.png');
      const identity = {
        playerId: character.character_id,
        name: character.name,
        token: playToken,
        expiresAt,
      };
      browser = await playwrightAzuraPanel(args, identity, screenshotPath, args.timeoutMs);
      addCheck('browser_gather_panel', browser.ok, browser);
      addCheck('browser_screenshot_written', Boolean(browser.screenshot), { path: browser.screenshot });
    }

    report = {
      receipt: LANE,
      ticket: 'AZURA_LOOP_ALIVE_V1',
      status: 'pass',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      live_targets: { api_base: args.apiBase, web_base: args.webBase, ws_url: args.wsUrl },
      character: {
        name: character.name,
        character_id_prefix: redactId(character.character_id),
      },
      loop_proof: loopProof,
      browser,
      checks,
    };
  } catch (error) {
    report = {
      receipt: LANE,
      ticket: 'AZURA_LOOP_ALIVE_V1',
      status: 'fail',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      checks,
    };
    process.exitCode = 1;
  } finally {
    mkdirSync(path.dirname(args.reportPath), { recursive: true });
    writeFileSync(args.reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({
      status: report.status,
      report: args.reportPath,
      failed_check: report.checks?.find((c) => !c.ok)?.name ?? null,
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});