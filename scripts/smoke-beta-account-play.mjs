#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const IDENTITY_KEY = 'akalynth.identity.v1';
const DEFAULT_PLAY_TOKEN_TTL_MS = 15 * 60 * 1000;

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

const defaults = {
  apiBase: 'https://beta-api.akalynth.com',
  webBase: 'https://beta.akalynth.com',
  wsUrl: 'wss://beta-api.akalynth.com',
  reportPath: path.resolve('.tmp', 'beta-account-play-smoke', stamp(), 'receipt.json'),
  browser: true,
  portalUi: true,
  live: false,
  timeoutMs: 15000,
  realAccount: false,
  emailEnv: 'AKALYNTH_BETA_SMOKE_EMAIL',
  passwordEnv: 'AKALYNTH_BETA_SMOKE_PASSWORD',
  characterName: '',
  accountHtmlFile: '',
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
    else if (arg === '--chrome') args.chrome = readValue();
    else if (arg === '--timeout-ms') args.timeoutMs = Number(readValue());
    else if (arg === '--no-browser') args.browser = false;
    else if (arg === '--no-portal-ui') args.portalUi = false;
    else if (arg === '--real-account') args.realAccount = true;
    else if (arg === '--email-env') args.emailEnv = readValue();
    else if (arg === '--password-env') args.passwordEnv = readValue();
    else if (arg === '--character-name') args.characterName = readValue();
    else if (arg === '--account-html-file') args.accountHtmlFile = path.resolve(readValue());
    else if (arg === '--help') {
      console.log([
        'Usage: node scripts/smoke-beta-account-play.mjs --live [options]',
        '',
        'Creates a disposable beta account + character, selects it, verifies token login,',
        'and by default proves account.html login/select plus /play/ autoconnect with Playwright.',
        '',
        'Options:',
        '  --live              Required acknowledgement: this mutates beta account/character state.',
        '  --api-base <url>    Default: https://beta-api.akalynth.com',
        '  --web-base <url>    Default: https://beta.akalynth.com',
        '  --ws-url <url>      Default: wss://beta-api.akalynth.com',
        '  --report <file>     JSON receipt path. Default: .tmp/beta-account-play-smoke/<stamp>/receipt.json',
        '  --chrome <file>     Chrome/Chromium executable for Playwright.',
        '  --timeout-ms <n>    Browser/WS timeout. Default: 15000',
        '  --no-browser        Skip Playwright browser proofs.',
        '  --no-portal-ui      Skip the Playwright account.html login/select proof.',
        '  --real-account      Use an existing verified account instead of creating a disposable one.',
        '  --email-env <name>  Env var for real-account email. Default: AKALYNTH_BETA_SMOKE_EMAIL',
        '  --password-env <name> Env var for real-account password. Default: AKALYNTH_BETA_SMOKE_PASSWORD',
        '  --character-name <name> Select this real-account character name. Default: first listed character.',
        '  --account-html-file <file> Serve this account.html in the browser proof without publishing beta.',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.live) {
    throw new Error('Refusing to mutate beta without --live. This smoke creates a disposable account and character.');
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) {
    throw new Error('--timeout-ms must be a number >= 1000');
  }
  return args;
}

function redactId(value) {
  return typeof value === 'string' && value ? `${value.slice(0, 10)}...` : null;
}

function hashPrefix(value) {
  return typeof value === 'string' && value
    ? createHash('sha256').update(value).digest('hex').slice(0, 16)
    : null;
}

function bodySummary(body) {
  if (!body || typeof body !== 'object') return { body_type: typeof body };
  const summary = { ok: body.ok ?? null };
  if (typeof body.error === 'string') summary.error = body.error;
  if (typeof body.message === 'string') summary.message = body.message;
  if (typeof body.retry_after_sec === 'number') summary.retry_after_sec = body.retry_after_sec;
  summary.keys = Object.keys(body).filter((key) => !/token|password|secret|cookie/i.test(key)).sort();
  if (Array.isArray(body.characters)) summary.character_count = body.characters.length;
  if (Array.isArray(body.outfits)) summary.outfit_count = body.outfits.length;
  return summary;
}

function randomSuffix() {
  return `${stamp().slice(9, 15)}${randomBytes(3).toString('hex')}`;
}

function createCookieJar() {
  const jar = new Map();
  return {
    has(name) {
      return jar.has(name);
    },
    header() {
      return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
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

async function executableExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function findChrome(explicit) {
  const candidates = [
    explicit,
    process.env.AKALYNTH_CHROME,
    path.join(os.homedir(), '.cache/ms-playwright/chromium-1223/chrome-linux64/chrome'),
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await executableExists(candidate)) return candidate;
  }
  throw new Error('No Chrome/Chromium executable found. Set AKALYNTH_CHROME or pass --chrome.');
}

function waitFor(predicate, timeoutMs, label) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error(`timeout:${label}`));
      setTimeout(tick, 100);
    };
    tick();
  });
}

function sanitizeFrame(payload, direction) {
  try {
    const msg = JSON.parse(String(payload));
    if (!msg || typeof msg.type !== 'string') return null;
    const entry = { direction, type: msg.type };
    if (msg.type === 'login') {
      entry.token_present = typeof msg.token === 'string' && msg.token.length > 0;
      entry.guest_token_present = typeof msg.guest_token === 'string' && msg.guest_token.length > 0;
    }
    if (msg.type === 'login_ack') {
      entry.ok = msg.ok !== false;
      entry.token_present = typeof msg.token === 'string' && msg.token.length > 0;
      entry.player_id_prefix = redactId(msg.player_id);
      entry.name = typeof msg.name === 'string' ? msg.name : null;
    }
    if (msg.type === 'world_state') {
      entry.map = msg.map ?? null;
    }
    return entry;
  } catch {
    return null;
  }
}

async function playwrightLocalStorageSmoke(args, identity, expectedName) {
  const { chromium } = await import('playwright-core');
  const chrome = await findChrome(args.chrome);
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox'],
  });
  const frames = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: false,
    });
    await context.addInitScript(({ key, value }) => {
      window.localStorage.setItem(key, value);
    }, { key: IDENTITY_KEY, value: JSON.stringify(identity) });
    const page = await context.newPage();
    page.on('websocket', (ws) => {
      ws.on('framesent', (event) => {
        const frame = sanitizeFrame(event.payload, 'sent');
        if (frame) frames.push(frame);
      });
      ws.on('framereceived', (event) => {
        const frame = sanitizeFrame(event.payload, 'received');
        if (frame) frames.push(frame);
      });
    });

    await page.goto(new URL('/play/', args.webBase).href, { waitUntil: 'domcontentloaded', timeout: args.timeoutMs });
    await page.waitForSelector('.conn-pill.connected', { timeout: args.timeoutMs });
    await page.waitForSelector('.map-canvas', { timeout: args.timeoutMs });
    await waitFor(
      () => frames.some((frame) => frame.direction === 'sent' && frame.type === 'login' && frame.token_present && !frame.guest_token_present),
      args.timeoutMs,
      'playwright_token_login_frame',
    );
    await waitFor(
      () => frames.some((frame) => frame.direction === 'received' && frame.type === 'world_state'),
      args.timeoutMs,
      'playwright_world_state_frame',
    );

    const hudName = (await page.locator('.hud-card--identity strong').first().textContent({ timeout: args.timeoutMs }))?.trim() ?? '';
    const connText = (await page.locator('.conn-pill.connected').first().textContent({ timeout: args.timeoutMs }))?.trim() ?? '';
    const ok = hudName === expectedName;
    return {
      ok,
      chrome,
      url: new URL('/play/', args.webBase).href,
      connection_text: connText,
      hud_name: hudName,
      expected_name: expectedName,
      error: ok ? null : `playwright_expected_character_name:${expectedName}:got:${hudName}`,
      frame_summary: frames,
    };
  } finally {
    await browser.close();
  }
}

async function playwrightPortalUiSmoke(args, credentials, expectedName) {
  const { chromium } = await import('playwright-core');
  const chrome = await findChrome(args.chrome);
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox'],
  });
  const frames = [];
  const apiResponses = [];
  const consoleMessages = [];
  const pageErrors = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: false,
    });
    if (args.accountHtmlFile) {
      const accountHtml = readFileSync(args.accountHtmlFile, 'utf8');
      await context.route('**/account.html', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: accountHtml,
        });
      });
    }
    const page = await context.newPage();
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text().slice(0, 240) });
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message.slice(0, 240));
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('/v1/')) return;
      let parsed = null;
      try {
        const text = await response.text();
        parsed = text ? JSON.parse(text) : null;
      } catch {}
      apiResponses.push({
        method: response.request().method(),
        path: new URL(url).pathname,
        status: response.status(),
        ok: response.ok(),
        body: bodySummary(parsed),
      });
    });
    page.on('websocket', (ws) => {
      ws.on('framesent', (event) => {
        const frame = sanitizeFrame(event.payload, 'sent');
        if (frame) frames.push(frame);
      });
      ws.on('framereceived', (event) => {
        const frame = sanitizeFrame(event.payload, 'received');
        if (frame) frames.push(frame);
      });
    });

    await page.goto(new URL('/account.html', args.webBase).href, { waitUntil: 'domcontentloaded', timeout: args.timeoutMs });
    await page.waitForSelector('#view-login.active', { timeout: args.timeoutMs });
    await page.fill('#email', credentials.email);
    await page.fill('#password', credentials.password);
    await page.click('#login-btn');
    await page.waitForSelector('#view-characters.active', { timeout: args.timeoutMs });
    await page.waitForSelector('#char-list .play-btn', { timeout: args.timeoutMs });

    const rows = page.locator('.char-row');
    const characterRows = await rows.count();
    const selectedRow = rows.filter({ hasText: expectedName }).first();
    await selectedRow.waitFor({ state: 'visible', timeout: args.timeoutMs });
    await selectedRow.locator('.play-btn').click();

    let redirectError = null;
    try {
      await page.waitForURL('**/play/', { timeout: args.timeoutMs, waitUntil: 'domcontentloaded' });
    } catch (error) {
      redirectError = error instanceof Error ? error.message : String(error);
    }
    const identityRaw = await page.evaluate((key) => window.localStorage.getItem(key), IDENTITY_KEY);
    let storedIdentity = null;
    try {
      storedIdentity = identityRaw ? JSON.parse(identityRaw) : null;
    } catch {}
    const localStorageIdentity = {
      present: Boolean(storedIdentity),
      name: typeof storedIdentity?.name === 'string' ? storedIdentity.name : null,
      player_id_prefix: redactId(storedIdentity?.playerId),
      token_present: typeof storedIdentity?.token === 'string' && storedIdentity.token.length > 0,
      expires_at_present: typeof storedIdentity?.expiresAt === 'number',
    };

    if (redirectError) {
      const charNotice = await page.locator('#char-notice').textContent({ timeout: 1000 }).catch(() => '');
      const loginError = await page.locator('#login-error').textContent({ timeout: 1000 }).catch(() => '');
      return {
        ok: false,
        chrome,
        phase: 'play_redirect',
        account_url: new URL('/account.html', args.webBase).href,
        account_html_source: args.accountHtmlFile ? 'routed-local-source' : 'live',
        account_html_file: args.accountHtmlFile || null,
        final_url: page.url(),
        character_rows: characterRows,
        selected_character_name: expectedName,
        connection_text: null,
        hud_name: null,
        expected_name: expectedName,
        local_storage_identity: localStorageIdentity,
        char_notice: charNotice?.trim() || null,
        login_error: loginError?.trim() || null,
        api_responses: apiResponses,
        console_messages: consoleMessages,
        page_errors: pageErrors,
        error: redirectError,
        frame_summary: frames,
      };
    }

    await page.waitForSelector('.conn-pill.connected', { timeout: args.timeoutMs });
    await page.waitForSelector('.map-canvas', { timeout: args.timeoutMs });
    await waitFor(
      () => frames.some((frame) => frame.direction === 'sent' && frame.type === 'login' && frame.token_present && !frame.guest_token_present),
      args.timeoutMs,
      'portal_ui_token_login_frame',
    );
    await waitFor(
      () => frames.some((frame) => frame.direction === 'received' && frame.type === 'world_state'),
      args.timeoutMs,
      'portal_ui_world_state_frame',
    );

    const hudName = (await page.locator('.hud-card--identity strong').first().textContent({ timeout: args.timeoutMs }))?.trim() ?? '';
    const connText = (await page.locator('.conn-pill.connected').first().textContent({ timeout: args.timeoutMs }))?.trim() ?? '';
    const ok = hudName === expectedName;
    return {
      ok,
      chrome,
      account_url: new URL('/account.html', args.webBase).href,
      account_html_source: args.accountHtmlFile ? 'routed-local-source' : 'live',
      account_html_file: args.accountHtmlFile || null,
      final_url: page.url(),
      character_rows: characterRows,
      selected_character_name: expectedName,
      connection_text: connText,
      hud_name: hudName,
      expected_name: expectedName,
      local_storage_identity: localStorageIdentity,
      api_responses: apiResponses,
      console_messages: consoleMessages,
      page_errors: pageErrors,
      error: ok ? null : `portal_ui_expected_character_name:${expectedName}:got:${hudName}`,
      frame_summary: frames,
    };
  } finally {
    await browser.close();
  }
}

async function wsSmoke(wsUrl, token, timeoutMs) {
  return await new Promise((resolve, reject) => {
    const seen = [];
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error(`ws_timeout:${seen.join(',')}`));
    }, timeoutMs);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'connect' }));
      ws.send(JSON.stringify({ type: 'login', token }));
      ws.send(JSON.stringify({ type: 'enter_world' }));
    });
    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(String(event.data)); } catch { return; }
      if (msg && typeof msg.type === 'string') seen.push(msg.type);
      if (msg?.type === 'world_state') {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        resolve({ ok: true, seen_types: [...new Set(seen)].slice(0, 12), map: msg.map ?? null, player_id_prefix: redactId(msg.you?.id ?? msg.player_id ?? null) });
      }
      if (msg?.type === 'error' && /token|auth|login/i.test(JSON.stringify(msg))) {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        reject(new Error('ws_auth_error'));
      }
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`ws_error:${seen.join(',')}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const checks = [];
  const endpoints = {};
  const jar = createCookieJar();
  let report;

  const addCheck = (name, ok, details = {}) => {
    checks.push({ name, ok: Boolean(ok), ...details });
    if (!ok) throw new Error(`check_failed:${name}`);
  };
  const request = async (method, url, body, opts = {}) => {
    const headers = { accept: 'application/json', ...(opts.headers ?? {}) };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const cookies = jar.header();
    if (cookies) headers.cookie = cookies;
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    jar.absorb(res.headers);
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { parse_error: true }; }
    endpoints[opts.name ?? `${method} ${new URL(url).pathname}`] = {
      status: res.status,
      ok: res.ok,
      body: bodySummary(parsed),
    };
    return { res, body: parsed, text };
  };
  const textRequest = async (name, url) => {
    const res = await fetch(url, { method: 'GET', redirect: 'manual' });
    const text = await res.text();
    endpoints[name] = { status: res.status, ok: res.ok, bytes: text.length };
    return { res, text };
  };

  try {
    const accountHtml = await textRequest('GET account.html', new URL('/account.html', args.webBase).href);
    addCheck('account.html_200', accountHtml.res.status === 200);
    addCheck('account.html_links_support_pages', accountHtml.text.includes('/register.html') && accountHtml.text.includes('/forgot.html'));
    const playHtml = await textRequest('GET play/', new URL('/play/', args.webBase).href);
    addCheck('play_200', playHtml.res.status === 200);

    const mode = args.realAccount ? 'real-account' : 'disposable-account';
    let csrfToken = '';
    let accountReceipt;
    let character;
    let playToken = '';
    let devTokenPresent = false;
    let browserCredentials = null;

    if (args.realAccount) {
      const email = process.env[args.emailEnv] ?? '';
      const password = process.env[args.passwordEnv] ?? '';
      addCheck('real_account_email_env_present', email.length > 0, { env: args.emailEnv });
      addCheck('real_account_password_env_present', password.length > 0, { env: args.passwordEnv });
      browserCredentials = { email, password };

      const login = await request('POST', `${args.apiBase}/v1/accounts/login`, { email, password }, { name: 'POST accounts/login(real)' });
      csrfToken = login.body?.csrf_token || '';
      addCheck('login_200', login.res.status === 200 && login.body?.ok === true, { status: login.res.status });
      addCheck('login_csrf_returned', typeof csrfToken === 'string' && csrfToken.length > 10);
      addCheck('session_cookie_set', jar.has('akalynth_session'));
      addCheck('csrf_cookie_set', jar.has('akalynth_csrf'));

      const me = await request('GET', `${args.apiBase}/v1/accounts/me`, undefined, { name: 'GET accounts/me' });
      addCheck('me_200', me.res.status === 200 && me.body?.ok === true, { status: me.res.status });
      addCheck('real_account_email_verified', me.body?.account?.email_verified === true);

      const list = await request('GET', `${args.apiBase}/v1/characters`, undefined, { name: 'GET characters(real)' });
      const characters = Array.isArray(list.body?.characters) ? list.body.characters : [];
      addCheck('characters_list_200', list.res.status === 200 && Array.isArray(list.body?.characters), { status: list.res.status });
      addCheck('characters_list_non_empty', characters.length > 0, { character_count: characters.length });
      character = args.characterName
        ? characters.find((entry) => entry.name === args.characterName)
        : characters[0];
      addCheck('real_account_character_selected', Boolean(character?.character_id), {
        requested_character_name: args.characterName || null,
        character_count: characters.length,
      });

      accountReceipt = {
        email_domain: email.includes('@') ? email.split('@').pop() : null,
        email_sha256_prefix: hashPrefix(email.trim().toLowerCase()),
        account_id_prefix: redactId(me.body.account?.account_id),
        status: me.body.account?.status ?? null,
        email_verified: Boolean(me.body.account?.email_verified),
      };
    } else {
      const suffix = randomSuffix();
      const handle = `Smoke${suffix}`.slice(0, 24);
      const email = `akalynth-smoke-${suffix}@example.invalid`;
      const password = randomBytes(24).toString('base64url');
      const charName = `Smk${suffix}`.slice(0, 18);
      browserCredentials = { email, password };

      const reg = await request('POST', `${args.apiBase}/v1/accounts/register`, { handle, email, password }, { name: 'POST accounts/register' });
      addCheck('register_201', reg.res.status === 201, { status: reg.res.status });
      devTokenPresent = typeof reg.body?.dev_verification_token === 'string' && reg.body.dev_verification_token.length > 0;
      if (devTokenPresent) {
        const ver = await request('POST', `${args.apiBase}/v1/accounts/verify-email`, { token: reg.body.dev_verification_token }, { name: 'POST accounts/verify-email' });
        addCheck('verify_email_200_when_dev_token_present', ver.res.status === 200 && ver.body?.ok === true, { status: ver.res.status });
      }

      const login = await request('POST', `${args.apiBase}/v1/accounts/login`, { email, password }, { name: 'POST accounts/login' });
      csrfToken = login.body?.csrf_token || '';
      addCheck('login_200', login.res.status === 200 && login.body?.ok === true, { status: login.res.status });
      addCheck('login_csrf_returned', typeof csrfToken === 'string' && csrfToken.length > 10);
      addCheck('session_cookie_set', jar.has('akalynth_session'));
      addCheck('csrf_cookie_set', jar.has('akalynth_csrf'));

      const me = await request('GET', `${args.apiBase}/v1/accounts/me`, undefined, { name: 'GET accounts/me' });
      addCheck('me_200', me.res.status === 200 && me.body?.ok === true, { status: me.res.status });

      const resend = await request('POST', `${args.apiBase}/v1/accounts/verify/resend`, undefined, { name: 'POST accounts/verify/resend', headers: { 'x-csrf-token': csrfToken } });
      addCheck('resend_verification_endpoint_reachable', resend.res.status === 200 && resend.body?.ok === true, { status: resend.res.status });

      const outfits = await request('GET', `${args.apiBase}/v1/outfits?sex=male`, undefined, { name: 'GET outfits?sex=male' });
      const outfit = outfits.body?.outfits?.[0];
      addCheck('outfits_available', outfits.res.status === 200 && typeof outfit?.outfit_id === 'string', { status: outfits.res.status });

      const beforeChars = await request('GET', `${args.apiBase}/v1/characters`, undefined, { name: 'GET characters(before)' });
      addCheck('characters_before_200', beforeChars.res.status === 200 && Array.isArray(beforeChars.body?.characters), { status: beforeChars.res.status });

      const create = await request('POST', `${args.apiBase}/v1/characters`, {
        name: charName,
        sex: 'male',
        outfit_id: outfit.outfit_id,
        world_id: 'rookguard',
      }, { name: 'POST characters', headers: { 'x-csrf-token': csrfToken } });
      addCheck('character_create_201', create.res.status === 201 && create.body?.ok === true, { status: create.res.status });
      character = create.body.character;

      const list = await request('GET', `${args.apiBase}/v1/characters`, undefined, { name: 'GET characters(after)' });
      addCheck('characters_after_contains_created', list.res.status === 200 && Array.isArray(list.body?.characters) && list.body.characters.some((entry) => entry.character_id === character.character_id));

      accountReceipt = {
        handle,
        email_domain: email.split('@')[1],
        account_id_prefix: redactId(me.body.account?.account_id),
        status: me.body.account?.status ?? null,
        email_verified: Boolean(me.body.account?.email_verified),
        dev_verification_token_present: devTokenPresent,
      };
    }

    const select = await request('POST', `${args.apiBase}/v1/characters/select`, { character_id: character.character_id }, { name: 'POST characters/select', headers: { 'x-csrf-token': csrfToken } });
    playToken = select.body?.token || '';
    addCheck('character_select_200', select.res.status === 200 && select.body?.ok === true, { status: select.res.status });
    addCheck('play_token_issued', typeof playToken === 'string' && playToken.length > 20, { expires_at_present: typeof select.body?.expires_at === 'number' });

    const directWs = await wsSmoke(args.wsUrl, playToken, args.timeoutMs);
    endpoints['WS token login'] = directWs;
    addCheck('websocket_play_token_world_state', directWs.seen_types.includes('world_state'), { map: directWs.map });

    const expiresAt = typeof select.body?.expires_at === 'number' ? select.body.expires_at : Date.now() + DEFAULT_PLAY_TOKEN_TTL_MS;
    const identity = { playerId: character.character_id, name: character.name, token: playToken, expiresAt };
    let browser = { status: 'skipped', reason: '--no-browser' };
    let portalUi = { status: 'skipped', reason: args.browser ? '--no-portal-ui' : '--no-browser' };
    if (args.browser) {
      browser = await playwrightLocalStorageSmoke(args, identity, character.name);
      endpoints['Playwright localStorage /play/ autoconnect'] = {
        ok: browser.ok,
        url: browser.url,
        connection_text: browser.connection_text,
        hud_name: browser.hud_name,
        frame_summary: browser.frame_summary,
      };
      addCheck('playwright_localstorage_sent_token_login', browser.frame_summary.some((frame) => frame.direction === 'sent' && frame.type === 'login' && frame.token_present && !frame.guest_token_present));
      addCheck('playwright_localstorage_reached_world_state', browser.frame_summary.some((frame) => frame.direction === 'received' && frame.type === 'world_state'));
      addCheck('playwright_hud_shows_character_name', browser.hud_name === character.name, { hud_name: browser.hud_name });

      if (args.portalUi) {
        portalUi = await playwrightPortalUiSmoke(args, browserCredentials, character.name);
        endpoints['Playwright account.html login/select/play'] = {
          ok: portalUi.ok,
          account_url: portalUi.account_url,
          account_html_source: portalUi.account_html_source,
          account_html_file: portalUi.account_html_file,
          final_url: portalUi.final_url,
          character_rows: portalUi.character_rows,
          selected_character_name: portalUi.selected_character_name,
          connection_text: portalUi.connection_text,
          hud_name: portalUi.hud_name,
          local_storage_identity: portalUi.local_storage_identity,
          api_responses: portalUi.api_responses,
          console_messages: portalUi.console_messages,
          page_errors: portalUi.page_errors,
          phase: portalUi.phase ?? 'play',
          error: portalUi.error,
          frame_summary: portalUi.frame_summary,
        };
        addCheck('playwright_portal_ui_reached_character_list', portalUi.character_rows > 0, { character_rows: portalUi.character_rows });
        addCheck('playwright_portal_ui_saved_localstorage_identity', portalUi.local_storage_identity.present && portalUi.local_storage_identity.token_present);
        addCheck('playwright_portal_ui_redirected_to_play', new URL(portalUi.final_url).pathname === '/play/', { final_url: portalUi.final_url });
        addCheck('playwright_portal_ui_sent_token_login', portalUi.frame_summary.some((frame) => frame.direction === 'sent' && frame.type === 'login' && frame.token_present && !frame.guest_token_present));
        addCheck('playwright_portal_ui_reached_world_state', portalUi.frame_summary.some((frame) => frame.direction === 'received' && frame.type === 'world_state'));
        addCheck('playwright_portal_ui_hud_shows_character_name', portalUi.hud_name === character.name, { hud_name: portalUi.hud_name });
      }
    }

    const logout = await request('POST', `${args.apiBase}/v1/accounts/logout`, undefined, { name: 'POST accounts/logout', headers: { 'x-csrf-token': csrfToken } });
    addCheck('logout_200', logout.res.status === 200 && logout.body?.ok === true, { status: logout.res.status });

    report = {
      receipt: 'AKALYNTH_BETA_ACCOUNT_PLAY_SMOKE_V2',
      mode,
      status: 'pass',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      live_targets: { account_url: new URL('/account.html', args.webBase).href, play_url: new URL('/play/', args.webBase).href, api_base: args.apiBase, websocket: args.wsUrl },
      ...(args.realAccount ? { real_account: accountReceipt } : { disposable_account: accountReceipt }),
      ...(args.realAccount ? { selected_character: {
        character_id_prefix: redactId(character.character_id),
        name: character.name,
        world_id: character.world_id,
        sex: character.sex,
        outfit_id: character.outfit_id,
      } } : { created_character: {
        character_id_prefix: redactId(character.character_id),
        name: character.name,
        world_id: character.world_id,
        sex: character.sex,
        outfit_id: character.outfit_id,
      } }),
      browser,
      portal_ui: portalUi,
      token_custody: {
        password_saved: false,
        session_cookie_saved: false,
        csrf_saved: false,
        email_verification_token_saved: false,
        play_token_saved: false,
        note: 'Secrets were used in process memory only and omitted from this receipt.',
      },
      endpoints,
      checks,
    };
  } catch (error) {
    report = {
      receipt: 'AKALYNTH_BETA_ACCOUNT_PLAY_SMOKE_V2',
      mode: args.realAccount ? 'real-account' : 'disposable-account',
      status: 'fail',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      token_custody: {
        password_saved: false,
        session_cookie_saved: false,
        csrf_saved: false,
        email_verification_token_saved: false,
        play_token_saved: false,
        note: 'Secrets were used in process memory only and omitted from this receipt.',
      },
      endpoints,
      checks,
    };
    process.exitCode = 1;
  } finally {
    mkdirSync(path.dirname(args.reportPath), { recursive: true });
    writeFileSync(args.reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({
      status: report.status,
      report: args.reportPath,
      checks: report.checks?.length ?? 0,
      failed_check: report.checks?.find((check) => !check.ok)?.name ?? null,
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
