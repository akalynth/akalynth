#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const laneRoot = path.join(repoRoot, 'docs/asset-decisions/AKALYNTH_MOBILE_PLAYABLE_SMOKE_SCRIPT_V1');

const defaults = {
  baseUrl: 'http://127.0.0.1:5174/play/',
  outDir: path.join(laneRoot, 'screenshots'),
  reportPath: path.join(laneRoot, 'validation/mobile_playable_smoke_report.json'),
};

function parseArgs(argv) {
  const args = { ...defaults, expectPlayable: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };
    if (arg === '--base-url') args.baseUrl = readValue();
    else if (arg === '--out') args.outDir = path.resolve(readValue());
    else if (arg === '--report') args.reportPath = path.resolve(readValue());
    else if (arg === '--chrome') args.chrome = path.resolve(readValue());
    else if (arg === '--expect-playable') args.expectPlayable = true;
    else if (arg === '--help') {
      console.log([
        'Usage: node apps/debug-client/scripts/mobile-playable-smoke.mjs [options]',
        '',
        'Options:',
        '  --base-url <url>   Debug client /play/ URL. Default: http://127.0.0.1:5174/play/',
        '  --out <dir>        Screenshot output directory.',
        '  --report <file>    JSON validation report path.',
        '  --chrome <path>    Chrome/Chromium executable path.',
        '  --expect-playable  Fail if the landscape entry remains account/world gated.',
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

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function probeUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
    });
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function executableExists(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findChrome(explicit) {
  if (explicit && executableExists(explicit)) return explicit;
  const candidates = [
    process.env.AKALYNTH_CHROME,
    path.join(os.homedir(), '.cache/ms-playwright/chromium-1223/chrome-linux64/chrome'),
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (executableExists(candidate)) return candidate;
  }
  throw new Error('No Chrome/Chromium executable found. Set AKALYNTH_CHROME or pass --chrome.');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
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

async function pageWebSocketUrl(port) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await getJson(`http://127.0.0.1:${port}/json/list`);
      const page = list.find((item) => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await sleep(100);
  }
  throw new Error('Chrome DevTools page did not become ready');
}

async function openCdp(wsUrl) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('Node WebSocket global is unavailable. Use Node 20+.');
  }
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = ++id;
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    },
    close() {
      ws.close();
    },
  };
}

function nowIso() {
  return new Date().toISOString();
}

function visibleExpression(selector) {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { visible: false, reason: 'missing' };
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right },
      display: style.display,
      visibility: style.visibility,
    };
  })()`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = {
    id: 'AKALYNTH_MOBILE_PLAYABLE_SMOKE_SCRIPT_V1',
    status: 'running',
    started_at: nowIso(),
    base_url: args.baseUrl,
    screenshots: [],
    checks: [],
    notes: [
      'Debug-client presentation smoke only.',
      'Does not change gameplay authority, protocol, server, shared types, Android/native, runtime, or deploy state.',
    ],
  };

  const addCheck = (id, pass, details = {}) => {
    const check = { id, status: pass ? 'pass' : 'fail', details };
    report.checks.push(check);
    return pass;
  };

  const writeReport = () => {
    fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
    fs.writeFileSync(args.reportPath, JSON.stringify(report, null, 2) + '\n');
  };

  let chromeProc = null;
  let cdp = null;
  try {
    addCheck('debug_client_url_available', await probeUrl(args.baseUrl), { url: args.baseUrl });
    if (report.checks.at(-1).status !== 'pass') {
      throw new Error(`Debug client is not reachable at ${args.baseUrl}`);
    }

    const chrome = findChrome(args.chrome);
    const port = await freePort();
    const userData = path.join(os.tmpdir(), `akalynth-mobile-smoke-${Date.now()}`);
    chromeProc = spawn(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userData}`,
      '--window-size=932,430',
      'about:blank',
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
    report.chrome = chrome;
    report.devtools_port = port;

    cdp = await openCdp(await pageWebSocketUrl(port));
    const send = cdp.send;
    await send('Page.enable');
    await send('Runtime.enable');

    const evalJson = async (expression) => {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return result.result?.value;
    };

    const setViewport = async (width, height, mobile = false) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
        screenWidth: width,
        screenHeight: height,
      });
    };

    const navigate = async (waitMs = 3200, extraParams = {}) => {
      const url = new URL(args.baseUrl);
      url.searchParams.set('mobile-smoke', String(Date.now()));
      for (const [key, value] of Object.entries(extraParams)) {
        url.searchParams.set(key, String(value));
      }
      await send('Page.navigate', { url: url.href });
      await sleep(waitMs);
    };

    const waitVisible = async (selector, label, timeoutMs = 9000) => {
      const start = Date.now();
      let last = null;
      while (Date.now() - start < timeoutMs) {
        last = await evalJson(visibleExpression(selector));
        if (last?.visible) {
          addCheck(label, true, { selector, rect: last.rect });
          return last;
        }
        await sleep(160);
      }
      addCheck(label, false, { selector, last });
      throw new Error(`Timed out waiting for ${selector}`);
    };

    const screenshot = async (name, label) => {
      const shot = await send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      fs.mkdirSync(args.outDir, { recursive: true });
      const file = path.join(args.outDir, name);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      report.screenshots.push({ file: path.relative(laneRoot, file), label });
      return file;
    };

    const click = async (selector, label) => {
      const clicked = await evalJson(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.click();
        return true;
      })()`);
      addCheck(label, Boolean(clicked), { selector });
      if (!clicked) throw new Error(`Could not click ${selector}`);
      await sleep(450);
    };

    const closeBy = async (selector, label) => {
      await click(selector, label);
      await sleep(300);
    };

    const countVisibleSheets = async () => evalJson(`(() => {
      const selectors = ['.chat-sheet', '.backpack-sheet', '.chronicle-sheet', '.proof-sheet'];
      const visible = [];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') visible.push(selector);
      }
      return visible;
    })()`);

    const expectOnlySheet = async (selector, label) => {
      const visible = await countVisibleSheets();
      addCheck(label, visible.length === 1 && visible[0] === selector, { visible });
    };

    const expectNoSheets = async (label) => {
      const visible = await countVisibleSheets();
      addCheck(label, visible.length === 0, { visible });
    };

    const checkNoWindowScrollbars = async (label) => {
      const result = await evalJson(`(() => ({
        innerWidth,
        innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        bodyScrollWidth: document.body.scrollWidth,
        bodyScrollHeight: document.body.scrollHeight,
      }))()`);
      const pass =
        result.scrollWidth <= result.innerWidth + 1 &&
        result.bodyScrollWidth <= result.innerWidth + 1 &&
        result.scrollHeight <= result.innerHeight + 1 &&
        result.bodyScrollHeight <= result.innerHeight + 1;
      addCheck(label, pass, result);
    };

    const mobileEntryState = async () => evalJson(`(() => {
      const box = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right },
          text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
        };
      };
      const button = document.querySelector('.mobile-enter-play-btn');
      const map = document.querySelector('.map-canvas');
      const entry = document.querySelector('.mobile-play-entry');
      const connectionLabel = (document.querySelector('.mobile-play-entry__header i')?.textContent || '').trim();
      const bodyText = document.body.innerText || '';
      const textFits = (selector) => Array.from(document.querySelectorAll(selector)).map((el) => ({
        selector,
        text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        rect: (() => {
          const rect = el.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right };
        })(),
      })).map((check) => {
        const entryRect = entry?.getBoundingClientRect();
        const withinEntry = !entryRect ||
          (
            check.rect.x >= entryRect.x - 1 &&
            check.rect.y >= entryRect.y - 1 &&
            check.rect.right <= entryRect.right + 1 &&
            check.rect.bottom <= entryRect.bottom + 1
          );
        return {
          ...check,
          withinEntry,
          fits:
            check.scrollWidth <= check.clientWidth + 1 &&
            check.scrollHeight <= check.clientHeight + 1 &&
            withinEntry,
        };
      });
      const textFitChecks = [
        ...textFits('.mobile-play-entry__header span'),
        ...textFits('.mobile-play-entry__header strong'),
        ...textFits('.mobile-play-entry__header i'),
        ...textFits('.mobile-play-entry .character-bar-helper'),
        ...textFits('.mobile-play-entry .character-bar-session-guard'),
        ...textFits('.mobile-play-entry .character-bar-error'),
      ];
      return {
        entry: box(entry),
        map: box(map),
        button: {
          ...box(button),
          disabled: button instanceof HTMLButtonElement ? button.disabled : null,
        },
        dpadPresent: Boolean(document.querySelector('.dpad')),
        dockPresent: Boolean(document.querySelector('.command-dock')),
        accountGateText: bodyText.includes('ACCOUNT SESSION REQUIRED'),
        rawFetchErrorVisible: /failed to fetch/i.test(bodyText),
        connectionLabel,
        playerReadableServiceStatus:
          bodyText.includes('Account service unavailable') ||
          bodyText.includes('Character setup offline') ||
          bodyText.includes('Sign in to an account'),
        gateTextFits: textFitChecks.every((check) => check.fits),
        textFitChecks,
      };
    })()`);

    const desktopLayoutState = async () => evalJson(`(() => {
      const box = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return { selector, visible: false, rect: null, withinViewport: true };
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        const rounded = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right };
        return {
          selector,
          visible,
          rect: rounded,
          withinViewport:
            !visible ||
            (rect.x >= -1 && rect.y >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1),
        };
      };
      const overlaps = (a, b) => {
        if (!a?.visible || !b?.visible || !a.rect || !b.rect) return false;
        return a.rect.x < b.rect.right && a.rect.right > b.rect.x && a.rect.y < b.rect.bottom && a.rect.bottom > b.rect.y;
      };
      const identity = box('.hud-card--identity');
      const stats = box('.hud-card--stats');
      const dock = box('.command-dock');
      const controls = box('.stage-controls');
      const topConnLabel = (document.querySelector('.top-bar .conn-pill')?.textContent || '').trim();
      const topConnClass = document.querySelector('.top-bar .conn-pill')?.className ?? '';
      return {
        shellClass: document.querySelector('.app-shell')?.className ?? '',
        topConnLabel,
        topConnClass,
        identity,
        stats,
        dock,
        controls,
        identityOverlapsDock: overlaps(identity, dock),
        identityOverlapsControls: overlaps(identity, controls),
        statsOverlapsDock: overlaps(stats, dock),
        statsOverlapsControls: overlaps(stats, controls),
      };
    })()`);

    const presentationChromeState = async () => evalJson(`(() => {
      const box = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return { selector, visible: false, text: '', rect: null };
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          selector,
          visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
          text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right },
        };
      };
      const withinViewport = (item) =>
        !item?.visible ||
        !item.rect ||
        (
          item.rect.x >= -1 &&
          item.rect.y >= -1 &&
          item.rect.right <= innerWidth + 1 &&
          item.rect.bottom <= innerHeight + 1
        );
      const overlaps = (a, b) => {
        if (!a?.visible || !b?.visible || !a.rect || !b.rect) return false;
        return a.rect.x < b.rect.right && a.rect.right > b.rect.x && a.rect.y < b.rect.bottom && a.rect.bottom > b.rect.y;
      };
      const textFits = (entryEl, selector) => Array.from(document.querySelectorAll(selector)).map((el) => {
        const rect = el.getBoundingClientRect();
        const entryRect = entryEl?.getBoundingClientRect();
        const withinEntry = !entryRect ||
          (
            rect.x >= entryRect.x - 1 &&
            rect.y >= entryRect.y - 1 &&
            rect.right <= entryRect.right + 1 &&
            rect.bottom <= entryRect.bottom + 1
          );
        return {
          selector,
          text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right },
          withinEntry,
          fits:
            el.scrollWidth <= el.clientWidth + 1 &&
            el.scrollHeight <= el.clientHeight + 1 &&
            withinEntry,
        };
      });
      const bodyText = document.body.innerText || '';
      const topBar = box('.top-bar');
      const entry = box('.mobile-play-entry');
      const entryEl = document.querySelector('.mobile-play-entry');
      const entryTextFitChecks = [
        ...textFits(entryEl, '.mobile-play-entry__header span'),
        ...textFits(entryEl, '.mobile-play-entry__header strong'),
        ...textFits(entryEl, '.mobile-play-entry__header i'),
        ...textFits(entryEl, '.mobile-play-entry .character-bar-helper'),
        ...textFits(entryEl, '.mobile-play-entry .character-bar-session-guard'),
        ...textFits(entryEl, '.mobile-play-entry .character-bar-error'),
        ...textFits(entryEl, '.mobile-enter-play-btn'),
      ];
      return {
        shellClass: document.querySelector('.app-shell')?.className ?? '',
        brandText: (document.querySelector('.brand')?.textContent || '').trim(),
        topBar,
        stageGates: box('.stage-gates'),
        mapSwitcher: box('.map-switcher'),
        proofHud: box('.hud-proof'),
        proofButton: box('.proof-toggle'),
        sealButton: box('.seal-toggle'),
        entry,
        entryWithinViewport: withinViewport(entry),
        entryOverlapsTopBar: overlaps(entry, topBar),
        entryTextFits: entryTextFitChecks.every((check) => check.fits),
        entryTextFitChecks,
        entryButton: {
          ...box('.mobile-enter-play-btn'),
          disabled: document.querySelector('.mobile-enter-play-btn') instanceof HTMLButtonElement
            ? document.querySelector('.mobile-enter-play-btn').disabled
            : null,
        },
        dpad: box('.dpad'),
        dock: box('.command-dock'),
        chat: box('.chat-toggle'),
        log: box('.chronicle-toggle'),
        pack: box('.inventory-toggle'),
        rawFetchErrorVisible: /failed to fetch/i.test(bodyText),
        playerReadableServiceStatus:
          bodyText.includes('Account service unavailable') ||
          bodyText.includes('Character setup offline') ||
          bodyText.includes('Sign in to an account'),
        hasDebugCopy:
          bodyText.includes('Akalynth v0') ||
          /\\bStage\\s+[0-3]\\b/.test(bodyText) ||
          bodyText.includes('Playtest') ||
          bodyText.includes('Smoke') ||
          bodyText.includes('Proof'),
      };
    })()`);

    await setViewport(390, 844, true);
    await navigate(2600);
    await waitVisible('.mobile-rotate-gate', 'portrait_rotate_gate_visible');
    await screenshot('01_portrait_rotate_gate_390x844.png', 'Portrait rotate gate');

    await setViewport(932, 430, false);
    await navigate(4300);
    await waitVisible('.mobile-enter-play-btn', 'mobile_landscape_cold_start_entry_visible');
    const entryState = await mobileEntryState();
    const accountOrWorldGate =
      entryState?.button?.disabled === true ||
      entryState?.accountGateText === true ||
      /waiting/i.test(entryState?.button?.text ?? '');
    addCheck('mobile_entry_state_detected', Boolean(entryState?.entry?.visible && entryState?.button?.visible), entryState ?? {});

    if (accountOrWorldGate) {
      if (args.expectPlayable) {
        addCheck('playable_world_expected_but_entry_was_gated', false, entryState ?? {});
        throw new Error('Expected a playable world entry, but the account/world gate stayed active');
      }
      await waitVisible('.map-canvas', 'account_gate_map_canvas_visible');
      const gatedState = await mobileEntryState();
      addCheck(
        'account_gate_hides_play_controls_until_world_player_exists',
        gatedState?.dpadPresent === false && gatedState?.dockPresent === false && gatedState?.button?.disabled === true,
        gatedState ?? {}
      );
      addCheck(
        'account_gate_uses_player_readable_service_status',
        gatedState?.rawFetchErrorVisible === false &&
          gatedState?.playerReadableServiceStatus === true &&
          gatedState?.connectionLabel !== 'error' &&
          gatedState?.gateTextFits === true,
        gatedState ?? {}
      );
      await checkNoWindowScrollbars('landscape_account_gate_has_no_main_scrollbars');
      await screenshot('02_landscape_account_gate_932x430.png', 'Landscape account/world gate');
    } else {
      await click('.mobile-enter-play-btn', 'mobile_enter_play_clicked');
      await waitVisible('.map-canvas', 'map_canvas_visible_after_entry');
      await waitVisible('.dpad', 'dpad_visible_after_entry');
      await waitVisible('.command-dock', 'mobile_dock_visible_after_entry');
      const playableState = await mobileEntryState();
      addCheck(
        'playable_world_entry_controls_visible_after_server_world_state',
        playableState?.dpadPresent === true &&
          playableState?.dockPresent === true &&
          playableState?.map?.visible === true &&
          playableState?.rawFetchErrorVisible === false,
        playableState ?? {}
      );
      await checkNoWindowScrollbars('landscape_play_surface_has_no_main_scrollbars');
      await screenshot('02_landscape_entry_play_surface_932x430.png', 'Landscape play surface after entry');

      const dpadTargets = await evalJson(`(() => {
        const east = document.querySelector('.dpad-btn__hit[aria-label="Move east"]');
        const stop = document.querySelector('.dpad-btn__hit[aria-label="Stop movement"]');
        const center = (el) => {
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right },
          };
        };
        return {
          east: center(east),
          stop: center(stop),
        };
      })()`);
      addCheck('dpad_real_pointer_targets_found', Boolean(dpadTargets?.east && dpadTargets?.stop), dpadTargets ?? {});
      if (!dpadTargets?.east || !dpadTargets?.stop) throw new Error('DPad real pointer targets were not available');
      const pointerTap = async (target) => {
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: target.x,
          y: target.y,
          button: 'left',
          buttons: 1,
          clickCount: 1,
        });
        await sleep(120);
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: target.x,
          y: target.y,
          button: 'left',
          buttons: 0,
          clickCount: 1,
        });
        await sleep(180);
      };
      await pointerTap(dpadTargets.east);
      await pointerTap(dpadTargets.stop);
      addCheck('dpad_real_pointer_tap_and_stop_exercised', true, dpadTargets);
      await sleep(600);
      await screenshot('03_dpad_press_release_cancel_932x430.png', 'DPad press/release/cancel smoke');

      await click('.inventory-toggle .dock-chip__hit', 'pack_dock_clicked');
      await waitVisible('.backpack-sheet', 'pack_sheet_visible');
      await expectOnlySheet('.backpack-sheet', 'only_pack_sheet_visible');
      await screenshot('04_pack_sheet_932x430.png', 'Pack sheet');
      await closeBy('.backpack-sheet__header button', 'pack_sheet_closed');
      await expectNoSheets('no_sheets_after_pack_close');

      await click('.chat-toggle .dock-chip__hit', 'chat_dock_clicked');
      await waitVisible('.chat-sheet', 'chat_sheet_visible');
      await expectOnlySheet('.chat-sheet', 'only_chat_sheet_visible');
      await screenshot('05_chat_sheet_932x430.png', 'Chat sheet');
      await closeBy('.chat-sheet__header button', 'chat_sheet_closed');
      await expectNoSheets('no_sheets_after_chat_close');

      await click('.chronicle-toggle .dock-chip__hit', 'log_dock_clicked');
      await waitVisible('.chronicle-sheet', 'log_sheet_visible');
      await expectOnlySheet('.chronicle-sheet', 'only_log_sheet_visible');
      await screenshot('06_log_sheet_932x430.png', 'Log sheet');
      await closeBy('.chronicle-close', 'log_sheet_closed');
      await expectNoSheets('no_sheets_after_log_close');

      await click('.proof-toggle .dock-chip__hit', 'proof_dock_clicked');
      await waitVisible('.proof-sheet', 'proof_sheet_visible');
      await expectOnlySheet('.proof-sheet', 'only_proof_sheet_visible');
      await screenshot('07_proof_sheet_932x430.png', 'Proof sheet');
      await closeBy('.proof-sheet__header button', 'proof_sheet_closed');
      await expectNoSheets('no_sheets_after_proof_close');
      await checkNoWindowScrollbars('clean_play_surface_has_no_main_scrollbars_after_sheet_flow');
      await screenshot('08_clean_play_surface_restored_932x430.png', 'Clean play surface restored');
    }

    await setViewport(1440, 900, false);
    await navigate(3600);
    await waitVisible('.map-canvas', 'desktop_debug_map_canvas_visible');
    const desktopRotateGate = await evalJson(visibleExpression('.mobile-rotate-gate'));
    addCheck('desktop_debug_does_not_show_rotate_gate', !desktopRotateGate?.visible, desktopRotateGate ?? {});
    const desktopLayout = await desktopLayoutState();
    addCheck(
      'desktop_connection_label_is_player_readable',
      desktopLayout?.topConnLabel !== 'error' && /offline|syncing|connected|disconnected|connecting/i.test(desktopLayout?.topConnLabel ?? ''),
      desktopLayout ?? {}
    );
    addCheck(
      'desktop_account_panel_and_stats_fit_viewport',
      desktopLayout?.identity?.withinViewport === true &&
        desktopLayout?.stats?.withinViewport === true &&
        desktopLayout?.dock?.withinViewport === true &&
        desktopLayout?.controls?.withinViewport === true &&
        desktopLayout?.identityOverlapsDock === false &&
        desktopLayout?.identityOverlapsControls === false &&
        desktopLayout?.statsOverlapsDock === false &&
        desktopLayout?.statsOverlapsControls === false,
      desktopLayout ?? {}
    );
    await screenshot('09_desktop_debug_mode_1440x900.png', 'Desktop debug mode');

    await navigate(3600, { presentation: '1' });
    await waitVisible('.map-canvas', 'desktop_presentation_map_canvas_visible');
    const presentationChrome = await presentationChromeState();
    addCheck(
      'desktop_presentation_hides_debug_chrome',
      presentationChrome?.shellClass?.includes('app-shell--presentation') === true &&
        presentationChrome?.brandText === 'Akalynth' &&
        presentationChrome?.stageGates?.visible === false &&
        presentationChrome?.mapSwitcher?.visible === false &&
        presentationChrome?.proofHud?.visible === false &&
        presentationChrome?.proofButton?.visible === false &&
        presentationChrome?.sealButton?.visible === false &&
        presentationChrome?.hasDebugCopy === false,
      presentationChrome ?? {}
    );
    if (args.expectPlayable) {
      addCheck(
        'desktop_presentation_world_player_shows_play_controls',
        presentationChrome?.topBar?.visible === true &&
          presentationChrome?.entry?.visible === false &&
          presentationChrome?.dpad?.visible === true &&
          presentationChrome?.dock?.visible === true &&
          presentationChrome?.chat?.visible === true &&
          presentationChrome?.log?.visible === true &&
          presentationChrome?.pack?.visible === true &&
          presentationChrome?.rawFetchErrorVisible === false,
        presentationChrome ?? {}
      );
    } else {
      addCheck(
        'desktop_presentation_signed_out_hides_play_controls_until_world_player_exists',
        presentationChrome?.topBar?.visible === true &&
          presentationChrome?.entry?.visible === true &&
          presentationChrome?.entryWithinViewport === true &&
          presentationChrome?.entryOverlapsTopBar === false &&
          presentationChrome?.entryTextFits === true &&
          presentationChrome?.entryButton?.disabled === true &&
          presentationChrome?.dpad?.visible === false &&
          presentationChrome?.dock?.visible === false &&
          presentationChrome?.chat?.visible === false &&
          presentationChrome?.log?.visible === false &&
          presentationChrome?.pack?.visible === false &&
          presentationChrome?.rawFetchErrorVisible === false &&
          presentationChrome?.playerReadableServiceStatus === true,
        presentationChrome ?? {}
      );
    }
    await screenshot('10_desktop_presentation_mode_1440x900.png', 'Desktop presentation mode');

    report.status = report.checks.every((check) => check.status === 'pass') ? 'pass' : 'fail';
  } catch (error) {
    report.status = 'fail';
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    report.finished_at = nowIso();
    if (cdp) cdp.close();
    if (chromeProc) chromeProc.kill('SIGTERM');
    writeReport();
  }

  const failed = report.checks.filter((check) => check.status !== 'pass');
  console.log(`AKALYNTH_MOBILE_PLAYABLE_SMOKE_SCRIPT_V1 ${report.status}`);
  console.log(`Report: ${args.reportPath}`);
  console.log(`Screenshots: ${args.outDir}`);
  if (failed.length > 0) {
    for (const check of failed) console.log(`FAIL ${check.id}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
