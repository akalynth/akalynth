#!/usr/bin/env node
/**
 * Credentialed first-playable proof:
 * account -> Rookguard six marks -> High City gather/refine/deliver -> reconnect.
 *
 * The client sends existing intents only. Durable truth is checked through the
 * existing receipt and Chronicle projections; this script defines no protocol.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  bodySummary,
  findChrome,
  sanitizeFrame,
  waitFor,
} from './smoke-beta-account-play.mjs';
import {
  WsHarness,
  onboardToAzura,
  runAzuraLoop,
} from './smoke-beta-azura-loop.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOKGUARD_MAP_PATH = path.join(REPO_ROOT, 'packages/shared/maps/rookguard.json');
const IDENTITY_KEY = 'akalynth.identity.v1';
const RECEIPT = 'AKALYNTH_FROZEN_FIRST_PLAYABLE_PROOF_SMOKE_V1';

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

const defaults = {
  apiBase: 'https://beta-api.akalynth.com',
  webBase: 'https://beta.akalynth.com',
  wsUrl: 'wss://beta-api.akalynth.com',
  reportPath: path.resolve('.tmp', 'beta-first-playable-proof', stamp(), 'receipt.json'),
  browser: true,
  live: false,
  timeoutMs: 180_000,
  chrome: '',
};

function usage() {
  return [
    'Usage: node scripts/smoke-beta-first-playable-proof.mjs --live [options]',
    '',
    'Proves account -> Rookguard -> High City -> Gather/Attune/Deliver -> reconnect.',
    'Remote targets require --live and browser evidence. Loopback verification may use --no-browser.',
    '',
    'Options:',
    '  --live              Required acknowledgement for any non-loopback target.',
    '  --api-base <url>    Default: https://beta-api.akalynth.com',
    '  --web-base <url>    Default: https://beta.akalynth.com',
    '  --ws-url <url>      Default: wss://beta-api.akalynth.com',
    '  --report <file>     New mode-0600 JSON report; existing files are never overwritten.',
    '  --chrome <file>     Chrome/Chromium executable for Playwright.',
    '  --timeout-ms <n>    Default: 180000.',
    '  --no-browser        Loopback verification only; forbidden for remote proof.',
  ].join('\n');
}

function isLoopbackUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  const hostname = parsed.hostname.toLowerCase();
  return hostname === 'localhost'
    || hostname === '::1'
    || hostname === '[::1]'
    || hostname === '0.0.0.0'
    || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

export function parseFirstPlayableArgs(argv) {
  const args = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return next;
    };
    if (arg === '--live') args.live = true;
    else if (arg === '--api-base') args.apiBase = value().replace(/\/$/, '');
    else if (arg === '--web-base') args.webBase = value().replace(/\/$/, '');
    else if (arg === '--ws-url') args.wsUrl = value();
    else if (arg === '--report') args.reportPath = path.resolve(value());
    else if (arg === '--chrome') args.chrome = path.resolve(value());
    else if (arg === '--timeout-ms') args.timeoutMs = Number(value());
    else if (arg === '--no-browser') args.browser = false;
    else if (arg === '--help') return { ...args, help: true };
    else throw new Error(`Unknown argument: ${arg}`);
  }

  for (const [label, candidate, protocols] of [
    ['--api-base', args.apiBase, new Set(['http:', 'https:'])],
    ['--web-base', args.webBase, new Set(['http:', 'https:'])],
    ['--ws-url', args.wsUrl, new Set(['ws:', 'wss:'])],
  ]) {
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new Error(`${label} must be an absolute URL`);
    }
    if (!protocols.has(parsed.protocol)) throw new Error(`${label} has an invalid protocol`);
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 30_000) {
    throw new Error('--timeout-ms must be a number >= 30000');
  }

  const remote = [args.apiBase, args.webBase, args.wsUrl].some((url) => !isLoopbackUrl(url));
  if (remote && !args.live) {
    throw new Error('Refusing remote first-playable writes without --live');
  }
  if (remote && !args.browser) {
    throw new Error('Remote first-playable proof requires browser account and /play evidence');
  }
  return args;
}

function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function randomSuffix() {
  return `${stamp().slice(9, 15)}${randomBytes(3).toString('hex')}`;
}

function safeFrames(frames) {
  return frames.map(({ player_id_prefix: _playerId, name: _name, ...frame }) => frame);
}

function sensitiveKey(key) {
  return /(?:password|token|cookie|csrf|email_address|invite|secret|private_key)/i.test(key);
}

export function sanitizeReportValue(value, secrets = []) {
  const secretValues = [...secrets]
    .filter((entry) => typeof entry === 'string' && entry.length >= 4)
    .sort((a, b) => b.length - a.length);

  const visit = (entry, key = '') => {
    if (entry === null || entry === undefined) return entry;
    if (sensitiveKey(key) && typeof entry !== 'boolean' && typeof entry !== 'number') {
      return '[redacted]';
    }
    if (typeof entry === 'string') {
      let result = entry;
      for (const secret of secretValues) result = result.split(secret).join('[redacted]');
      return result.slice(0, 1000);
    }
    if (Array.isArray(entry)) return entry.map((item) => visit(item));
    if (typeof entry === 'object') {
      return Object.fromEntries(
        Object.entries(entry).map(([childKey, child]) => [childKey, visit(child, childKey)]),
      );
    }
    return entry;
  };
  return visit(value);
}

export function assertReportHasNoSecrets(report, secrets) {
  const serialized = JSON.stringify(report);
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= 4 && serialized.includes(secret)) {
      throw new Error('report_contains_sensitive_value');
    }
  }
}

function createCookieJar() {
  const jar = new Map();
  return {
    header() {
      return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
    },
    values() {
      return [...jar.values()];
    },
    absorb(headers) {
      const setCookies = typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : (headers.get('set-cookie')
          ? headers.get('set-cookie').split(/,(?=\s*[^;,]+=)/g)
          : []);
      for (const setCookie of setCookies) {
        const first = setCookie.split(';', 1)[0];
        const separator = first.indexOf('=');
        if (separator > 0) jar.set(first.slice(0, separator), first.slice(separator + 1));
      }
    },
  };
}

function createApiClient(apiBase) {
  const jar = createCookieJar();
  const endpoints = [];
  return {
    jar,
    endpoints,
    async request(method, endpoint, body, options = {}) {
      const headers = { accept: 'application/json', ...(options.headers ?? {}) };
      if (body !== undefined) headers['content-type'] = 'application/json';
      const cookies = jar.header();
      if (cookies) headers.cookie = cookies;
      const response = await fetch(new URL(endpoint, apiBase), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
      });
      jar.absorb(response.headers);
      const text = await response.text();
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = { parse_error: true };
      }
      endpoints.push({
        method,
        path: new URL(response.url).pathname,
        status: response.status,
        ok: response.ok,
        body: bodySummary(parsed),
      });
      return { response, body: parsed };
    },
  };
}

function requireCheck(addCheck, name, condition, details = {}) {
  addCheck(name, Boolean(condition), details);
  return condition;
}

async function createDisposableAccount(api, addCheck, secrets) {
  const suffix = randomSuffix();
  const credentials = {
    handle: `Proof${suffix}`.slice(0, 24),
    email: `akalynth-first-playable-${suffix}@example.invalid`,
    password: randomBytes(24).toString('base64url'),
  };
  secrets.add(credentials.email);
  secrets.add(credentials.password);

  const registration = await api.request('POST', '/v1/accounts/register', credentials);
  requireCheck(addCheck, 'account_register_201', registration.response.status === 201, {
    status: registration.response.status,
  });
  const verificationToken = registration.body?.dev_verification_token;
  requireCheck(
    addCheck,
    'disposable_verification_token_available',
    typeof verificationToken === 'string' && verificationToken.length > 20,
  );
  secrets.add(verificationToken);
  const verification = await api.request(
    'POST',
    '/v1/accounts/verify-email',
    { token: verificationToken },
  );
  requireCheck(
    addCheck,
    'account_email_verified',
    verification.response.status === 200 && verification.body?.ok === true,
    { status: verification.response.status },
  );

  const login = await api.request('POST', '/v1/accounts/login', {
    email: credentials.email,
    password: credentials.password,
  });
  requireCheck(
    addCheck,
    'account_login_200',
    login.response.status === 200 && login.body?.ok === true,
    { status: login.response.status },
  );
  const csrf = login.body?.csrf_token;
  const accountId = login.body?.account?.account_id;
  requireCheck(addCheck, 'account_csrf_present', typeof csrf === 'string' && csrf.length > 20);
  requireCheck(addCheck, 'account_id_present', typeof accountId === 'string' && accountId.length > 8);
  secrets.add(csrf);
  secrets.add(accountId);
  for (const value of api.jar.values()) secrets.add(value);

  const me = await api.request('GET', '/v1/accounts/me');
  requireCheck(
    addCheck,
    'account_me_verified',
    me.response.status === 200 && me.body?.account?.email_verified === true,
    { status: me.response.status },
  );
  const outfits = await api.request('GET', '/v1/outfits?sex=male');
  const outfit = outfits.body?.outfits?.[0];
  requireCheck(
    addCheck,
    'character_outfit_available',
    outfits.response.status === 200 && typeof outfit?.outfit_id === 'string',
  );
  const characterName = `Fpp${suffix}`.slice(0, 18);
  const created = await api.request(
    'POST',
    '/v1/characters',
    {
      name: characterName,
      sex: 'male',
      outfit_id: outfit.outfit_id,
      world_id: 'rookguard',
    },
    { headers: { 'x-csrf-token': csrf } },
  );
  const character = created.body?.character;
  requireCheck(
    addCheck,
    'character_created',
    created.response.status === 201 && created.body?.ok === true && character?.character_id,
    { status: created.response.status },
  );
  secrets.add(character.character_id);
  if (typeof created.body?.token === 'string') secrets.add(created.body.token);

  return { credentials, csrf, accountId, character };
}

async function selectCharacterWithApi(api, csrf, characterId, addCheck, label) {
  const selected = await api.request(
    'POST',
    '/v1/characters/select',
    { character_id: characterId },
    { headers: { 'x-csrf-token': csrf } },
  );
  const token = selected.body?.token;
  requireCheck(
    addCheck,
    `${label}_character_select`,
    selected.response.status === 200 && selected.body?.ok === true,
    { status: selected.response.status },
  );
  requireCheck(addCheck, `${label}_play_token_present`, typeof token === 'string' && token.length > 20);
  return { token, expiresAt: selected.body?.expires_at ?? null };
}

async function acquireTokenThroughPortal(args, credentials, character, addCheck, label) {
  const { chromium } = await import('playwright-core');
  const chrome = await findChrome(args.chrome || undefined);
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox'],
  });
  const frames = [];
  const apiResponses = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: false,
    });
    const page = await context.newPage();
    page.on('response', async (response) => {
      if (!response.url().includes('/v1/')) return;
      let parsed = null;
      try {
        const text = await response.text();
        parsed = text ? JSON.parse(text) : null;
      } catch {}
      apiResponses.push({
        method: response.request().method(),
        path: new URL(response.url()).pathname,
        status: response.status(),
        ok: response.ok(),
        body: bodySummary(parsed),
      });
    });
    page.on('websocket', (socket) => {
      socket.on('framesent', (event) => {
        const frame = sanitizeFrame(event.payload, 'sent');
        if (frame) frames.push(frame);
      });
      socket.on('framereceived', (event) => {
        const frame = sanitizeFrame(event.payload, 'received');
        if (frame) frames.push(frame);
      });
    });

    await page.goto(new URL('/account.html', args.webBase).href, {
      waitUntil: 'domcontentloaded',
      timeout: args.timeoutMs,
    });
    await page.waitForSelector('#view-login.active', { timeout: args.timeoutMs });
    await page.fill('#email', credentials.email);
    await page.fill('#password', credentials.password);
    await page.click('#login-btn');
    await page.waitForSelector('#view-characters.active', { timeout: args.timeoutMs });
    const row = page.locator('.char-row').filter({ hasText: character.name }).first();
    await row.waitFor({ state: 'visible', timeout: args.timeoutMs });
    await row.locator('.play-btn').click();
    await page.waitForURL('**/play/', {
      waitUntil: 'domcontentloaded',
      timeout: args.timeoutMs,
    });
    await page.waitForSelector('.conn-pill.connected', { timeout: args.timeoutMs });
    await page.waitForSelector('.map-canvas', { timeout: args.timeoutMs });
    await waitFor(
      () => frames.some((frame) => frame.direction === 'sent'
        && frame.type === 'login'
        && frame.token_present
        && !frame.guest_token_present),
      args.timeoutMs,
      `${label}_portal_token_login`,
    );
    await waitFor(
      () => frames.some((frame) => frame.direction === 'received' && frame.type === 'world_state'),
      args.timeoutMs,
      `${label}_portal_world_state`,
    );
    requireCheck(
      addCheck,
      `${label}_portal_never_sent_guest_login`,
      !frames.some((frame) => frame.direction === 'sent'
        && frame.type === 'login'
        && frame.guest_token_present),
    );
    const identity = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, IDENTITY_KEY);
    requireCheck(
      addCheck,
      `${label}_portal_identity_bound_to_character`,
      identity?.playerId === character.character_id && identity?.name === character.name,
    );
    requireCheck(
      addCheck,
      `${label}_portal_play_token_present`,
      typeof identity?.token === 'string' && identity.token.length > 20,
    );
    return {
      token: identity.token,
      expiresAt: identity.expiresAt ?? null,
      proof: {
        status: 'pass',
        account_path: '/account.html',
        final_path: new URL(page.url()).pathname,
        api_responses: apiResponses,
        frame_summary: safeFrames(frames),
      },
    };
  } finally {
    await browser.close();
  }
}

export function assertCredentialedLoginAck(message, expectedPlayerId) {
  if (message?.type !== 'login_ack' || message.ok === false) {
    throw new Error('credentialed_login_rejected');
  }
  if (message.player_id !== expectedPlayerId) {
    throw new Error('credentialed_login_character_mismatch');
  }
  if (typeof message.guest_token === 'string' && message.guest_token.length > 0) {
    throw new Error('credentialed_login_fell_back_to_guest');
  }
  if (typeof message.token !== 'string' || message.token.length === 0) {
    throw new Error('credentialed_login_token_not_acknowledged');
  }
}

async function connectCredentialed(wsUrl, token, characterId, timeoutMs) {
  const client = await WsHarness.connect(wsUrl, timeoutMs);
  client.send({ type: 'connect' });
  client.send({ type: 'login', token });
  const login = await client.waitFor((message) => message.type === 'login_ack', 'login_ack', timeoutMs);
  assertCredentialedLoginAck(login, characterId);
  client.send({ type: 'enter_world' });
  const world = await client.waitFor((message) => message.type === 'world_state', 'world_state', timeoutMs);
  return { client, world };
}

async function readChronicleCompletion(client, timeoutMs) {
  client.send({ type: 'get_chronicle', limit: 100 });
  const snapshot = await client.waitFor(
    (message) => message.type === 'chronicle_snapshot',
    'chronicle_snapshot',
    timeoutMs,
  );
  const events = Array.isArray(snapshot.events) ? snapshot.events : [];
  const completion = events.find((event) => event?.kind === 'tutorial_complete');
  if (!completion) throw new Error('chronicle_tutorial_completion_missing');
  if (completion.details?.title !== 'The Gate Remembers') {
    throw new Error('chronicle_tutorial_title_mismatch');
  }
  if (completion.details?.vocation !== 'hexer') {
    throw new Error('chronicle_vocation_mismatch');
  }
  return {
    kind: completion.kind,
    title: completion.details.title,
    vocation: completion.details.vocation,
  };
}

function receiptActionCounts(receipts) {
  const counts = {};
  for (const receipt of receipts) counts[receipt.action] = (counts[receipt.action] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function requireReceiptActions(receipts, required, label) {
  const counts = receiptActionCounts(receipts);
  const missing = required.filter((action) => !counts[action]);
  if (missing.length) throw new Error(`${label}_receipt_actions_missing:${missing.join(',')}`);
  return counts;
}

function summarizeReceiptSlice(receipts, required) {
  const sorted = [...receipts].sort((a, b) => a.sequence - b.sequence);
  const first = sorted[0] ?? null;
  const last = sorted.at(-1) ?? null;
  return {
    total: sorted.length,
    first_sequence: first?.sequence ?? null,
    first_event_hash: first?.event_hash ?? null,
    last_sequence: last?.sequence ?? null,
    last_event_hash: last?.event_hash ?? null,
    required_actions: required,
    action_counts: receiptActionCounts(sorted),
  };
}

async function queryActorReceipts(api, actorId, since) {
  const response = await api.request(
    'GET',
    `/v1/receipts?player_id=${encodeURIComponent(actorId)}&since=${encodeURIComponent(since)}&limit=1000`,
  );
  if (response.response.status !== 200 || !Array.isArray(response.body?.receipts)) {
    throw new Error('receipt_query_failed');
  }
  return response.body.receipts;
}

function writeReport(file, report, secrets) {
  const safe = sanitizeReportValue(report, secrets);
  assertReportHasNoSecrets(safe, secrets);
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, `${JSON.stringify(safe, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  return safe;
}

export async function runFirstPlayableProof(args) {
  const startedAt = new Date().toISOString();
  const receiptSince = new Date(Date.parse(startedAt) - 1_000).toISOString();
  const api = createApiClient(args.apiBase);
  const checks = [];
  const secrets = new Set();
  let report;
  const addCheck = (name, ok, details = {}) => {
    checks.push({ name, ok: Boolean(ok), ...details });
    if (!ok) throw new Error(`check_failed:${name}`);
  };

  try {
    const health = await api.request('GET', '/v1/health');
    requireCheck(addCheck, 'api_health_200', health.response.status === 200, {
      status: health.response.status,
    });
    if (args.browser) {
      const accountPage = await fetch(new URL('/account.html', args.webBase));
      requireCheck(addCheck, 'account_surface_200', accountPage.status === 200, {
        status: accountPage.status,
      });
      const playPage = await fetch(new URL('/play/', args.webBase));
      requireCheck(addCheck, 'play_surface_200', playPage.status === 200, {
        status: playPage.status,
      });
    }

    const identity = await createDisposableAccount(api, addCheck, secrets);
    let firstBrowser = { status: 'skipped', reason: 'loopback --no-browser verification' };
    let journeyCredential;
    if (args.browser) {
      const acquired = await acquireTokenThroughPortal(
        args,
        identity.credentials,
        identity.character,
        addCheck,
        'initial',
      );
      journeyCredential = acquired;
      firstBrowser = acquired.proof;
    } else {
      journeyCredential = await selectCharacterWithApi(
        api,
        identity.csrf,
        identity.character.character_id,
        addCheck,
        'initial',
      );
    }
    secrets.add(journeyCredential.token);

    const rookguardMap = JSON.parse(readFileSync(ROOKGUARD_MAP_PATH, 'utf8'));
    const entered = await connectCredentialed(
      args.wsUrl,
      journeyCredential.token,
      identity.character.character_id,
      args.timeoutMs,
    );
    let loopProof;
    let completionMemory;
    try {
      requireCheck(addCheck, 'credentialed_entry_starts_in_rookguard', entered.world.map === 'Rookguard', {
        map: entered.world.map,
      });
      const azuraWorld = await onboardToAzura(
        entered.client,
        rookguardMap,
        entered.world,
        args.timeoutMs,
      );
      requireCheck(addCheck, 'rookguard_six_marks_reach_high_city', azuraWorld.map === 'Azura', {
        runtime_map: azuraWorld.map,
      });
      loopProof = await runAzuraLoop(entered.client, args.timeoutMs, azuraWorld);
      requireCheck(
        addCheck,
        'gather_attune_deliver_refined',
        loopProof.deliver_result.ok === true
          && loopProof.deliver_result.refined === true
          && loopProof.deliver_result.reward === 'keystone_token',
      );
      completionMemory = await readChronicleCompletion(entered.client, args.timeoutMs);
      requireCheck(addCheck, 'chronicle_records_gate_completion', Boolean(completionMemory));
    } finally {
      entered.client.close();
    }

    let reconnectBrowser = { status: 'skipped', reason: 'loopback --no-browser verification' };
    let reconnectCredential;
    if (args.browser) {
      const acquired = await acquireTokenThroughPortal(
        args,
        identity.credentials,
        identity.character,
        addCheck,
        'reconnect',
      );
      reconnectCredential = acquired;
      reconnectBrowser = acquired.proof;
    } else {
      reconnectCredential = await selectCharacterWithApi(
        api,
        identity.csrf,
        identity.character.character_id,
        addCheck,
        'reconnect',
      );
    }
    secrets.add(reconnectCredential.token);
    requireCheck(
      addCheck,
      'reconnect_uses_fresh_play_token',
      reconnectCredential.token !== journeyCredential.token,
    );

    const reconnected = await connectCredentialed(
      args.wsUrl,
      reconnectCredential.token,
      identity.character.character_id,
      args.timeoutMs,
    );
    let reconnectMemory;
    try {
      requireCheck(addCheck, 'reconnect_restores_high_city', reconnected.world.map === 'Azura', {
        runtime_map: reconnected.world.map,
      });
      requireCheck(
        addCheck,
        'reconnect_restores_vocation_identity',
        Array.isArray(reconnected.world.player?.badges)
          && reconnected.world.player.badges.includes('vocation_hexer'),
      );
      reconnectMemory = await readChronicleCompletion(reconnected.client, args.timeoutMs);
      requireCheck(addCheck, 'reconnect_restores_chronicle_completion', Boolean(reconnectMemory));
    } finally {
      reconnected.client.close();
    }

    const accountRequired = [
      'account_created',
      'account_email_verified',
      'account_login_succeeded',
      'character_created',
      'character_selected',
    ];
    const gameplayRequired = [
      'enter_world',
      'move_intent',
      'tutorial_step_complete',
      'chat',
      'tem_challenge_issued',
      'tem_challenge_passed',
      'mob_kill',
      'item_minted',
      'vocation_declared',
      'gate_unlock',
      'tutorial_completed',
      'delivery_recorded',
    ];
    const accountReceipts = await queryActorReceipts(api, identity.accountId, receiptSince);
    const gameplayReceipts = await queryActorReceipts(
      api,
      identity.character.character_id,
      receiptSince,
    );
    const accountCounts = requireReceiptActions(accountReceipts, accountRequired, 'account');
    const gameplayCounts = requireReceiptActions(gameplayReceipts, gameplayRequired, 'gameplay');
    requireCheck(
      addCheck,
      'receipt_evidence_has_two_credentialed_entries',
      (gameplayCounts.enter_world ?? 0) >= 2,
      { count: gameplayCounts.enter_world ?? 0 },
    );
    requireCheck(
      addCheck,
      'receipt_evidence_has_two_character_selections',
      (accountCounts.character_selected ?? 0) >= 2,
      { count: accountCounts.character_selected ?? 0 },
    );
    const delivery = gameplayReceipts.find((entry) => entry.action === 'delivery_recorded');
    requireCheck(
      addCheck,
      'delivery_receipt_has_refinery_provenance',
      delivery?.inputs?.refined === true
        && typeof delivery?.inputs?.refined_at_station === 'string'
        && delivery?.inputs?.reward === 'keystone_token',
    );

    report = {
      receipt: RECEIPT,
      status: 'pass',
      synthetic_player: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      target: {
        api_origin: new URL(args.apiBase).origin,
        web_origin: new URL(args.webBase).origin,
        websocket_origin: new URL(args.wsUrl).origin,
        mode: args.live ? 'acknowledged-remote' : 'loopback-verification',
      },
      synthetic_identity: {
        account_id_sha256: sha256(identity.accountId),
        character_id_sha256: sha256(identity.character.character_id),
        character_name: identity.character.name,
      },
      browser: {
        initial_account_to_play: firstBrowser,
        reconnect_account_to_play: reconnectBrowser,
      },
      journey: {
        rookguard_marks: ['move', 'chat', 'tem', 'training', 'profession', 'gate'],
        destination: 'High City',
        runtime_map: 'Azura',
        delivery: {
          node_id: loopProof.node_id,
          refinery_id: loopProof.refinery_id,
          curation_id: loopProof.curation_id,
          reward: loopProof.deliver_result.reward,
          refined: loopProof.deliver_result.refined,
        },
        chronicle: completionMemory,
      },
      reconnect: {
        fresh_play_token: true,
        runtime_map: 'Azura',
        vocation_badge: 'vocation_hexer',
        chronicle: reconnectMemory,
      },
      receipt_evidence: {
        account: summarizeReceiptSlice(accountReceipts, accountRequired),
        gameplay: summarizeReceiptSlice(gameplayReceipts, gameplayRequired),
        delivery: {
          sequence: delivery.sequence,
          event_hash: delivery.event_hash,
          refined: delivery.inputs.refined,
          refined_at_station: delivery.inputs.refined_at_station,
          reward: delivery.inputs.reward,
        },
        note: 'Only action counts, chain boundaries, and selected non-secret delivery fields are retained; raw receipt bodies are not written.',
      },
      api_summary: api.endpoints,
      custody: {
        credentials_persisted: false,
        raw_identifiers_persisted: false,
        raw_receipts_persisted: false,
        report_mode: '0600',
      },
      checks,
    };
  } catch (error) {
    report = {
      receipt: RECEIPT,
      status: 'fail',
      synthetic_player: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      api_summary: api.endpoints,
      custody: {
        credentials_persisted: false,
        raw_identifiers_persisted: false,
        raw_receipts_persisted: false,
        report_mode: '0600',
      },
      checks,
    };
  } finally {
    for (const value of api.jar.values()) secrets.add(value);
  }

  const written = writeReport(args.reportPath, report, secrets);
  return { report: written, reportPath: args.reportPath };
}

async function main() {
  const args = parseFirstPlayableArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const result = await runFirstPlayableProof(args);
  process.stdout.write(`${JSON.stringify({
    status: result.report.status,
    report: result.reportPath,
    checks: result.report.checks?.length ?? 0,
    failed_check: result.report.checks?.find((check) => !check.ok)?.name ?? null,
  }, null, 2)}\n`);
  if (result.report.status !== 'pass') process.exitCode = 1;
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  main().catch((error) => {
    process.stderr.write(`[first-playable-proof] FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
