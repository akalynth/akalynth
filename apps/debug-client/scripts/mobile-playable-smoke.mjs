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
  const args = { ...defaults };
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
    else if (arg === '--help') {
      console.log([
        'Usage: node apps/debug-client/scripts/mobile-playable-smoke.mjs [options]',
        '',
        'Options:',
        '  --base-url <url>   Debug client /play/ URL. Default: http://127.0.0.1:5174/play/',
        '  --out <dir>        Screenshot output directory.',
        '  --report <file>    JSON validation report path.',
        '  --chrome <path>    Chrome/Chromium executable path.',
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

    const navigate = async (waitMs = 3200) => {
      const url = args.baseUrl.includes('?')
        ? `${args.baseUrl}&mobile-smoke=${Date.now()}`
        : `${args.baseUrl}?mobile-smoke=${Date.now()}`;
      await send('Page.navigate', { url });
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

    await setViewport(390, 844, true);
    await navigate(2600);
    await waitVisible('.mobile-rotate-gate', 'portrait_rotate_gate_visible');
    await screenshot('01_portrait_rotate_gate_390x844.png', 'Portrait rotate gate');

    await setViewport(932, 430, false);
    await navigate(4300);
    await waitVisible('.mobile-enter-play-btn', 'mobile_landscape_cold_start_entry_visible');
    await click('.mobile-enter-play-btn', 'mobile_enter_play_clicked');
    await waitVisible('.map-canvas', 'map_canvas_visible_after_entry');
    await waitVisible('.dpad', 'dpad_visible_after_entry');
    await waitVisible('.command-dock', 'mobile_dock_visible_after_entry');
    await checkNoWindowScrollbars('landscape_play_surface_has_no_main_scrollbars');
    await screenshot('02_landscape_entry_play_surface_932x430.png', 'Landscape play surface after entry');

    const dpadResult = await evalJson(`(() => {
      const east = Array.from(document.querySelectorAll('.dpad-btn')).find((el) => el.getAttribute('aria-label') === 'Move east');
      const stop = document.querySelector('.dpad-stop');
      if (!east || !stop || typeof PointerEvent === 'undefined') return { ok: false, reason: 'missing dpad or PointerEvent' };
      const rect = east.getBoundingClientRect();
      const eventInit = { bubbles: true, cancelable: true, pointerId: 17, pointerType: 'touch', clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 };
      east.dispatchEvent(new PointerEvent('pointerdown', eventInit));
      east.dispatchEvent(new PointerEvent('pointerup', eventInit));
      east.dispatchEvent(new PointerEvent('pointerdown', eventInit));
      east.dispatchEvent(new PointerEvent('pointerleave', eventInit));
      east.dispatchEvent(new PointerEvent('pointerdown', eventInit));
      east.dispatchEvent(new PointerEvent('pointercancel', eventInit));
      stop.dispatchEvent(new PointerEvent('pointerdown', eventInit));
      return { ok: true, activeElement: document.activeElement?.getAttribute('aria-label') ?? null };
    })()`);
    addCheck('dpad_press_release_leave_cancel_and_stop_exercised', Boolean(dpadResult?.ok), dpadResult ?? {});
    await screenshot('03_dpad_press_release_cancel_932x430.png', 'DPad press/release/cancel smoke');

    await click('.inventory-toggle', 'pack_dock_clicked');
    await waitVisible('.backpack-sheet', 'pack_sheet_visible');
    await expectOnlySheet('.backpack-sheet', 'only_pack_sheet_visible');
    await screenshot('04_pack_sheet_932x430.png', 'Pack sheet');
    await closeBy('.backpack-sheet__header button', 'pack_sheet_closed');
    await expectNoSheets('no_sheets_after_pack_close');

    await click('.chat-toggle', 'chat_dock_clicked');
    await waitVisible('.chat-sheet', 'chat_sheet_visible');
    await expectOnlySheet('.chat-sheet', 'only_chat_sheet_visible');
    await screenshot('05_chat_sheet_932x430.png', 'Chat sheet');
    await closeBy('.chat-sheet__header button', 'chat_sheet_closed');
    await expectNoSheets('no_sheets_after_chat_close');

    await click('.chronicle-toggle', 'log_dock_clicked');
    await waitVisible('.chronicle-sheet', 'log_sheet_visible');
    await expectOnlySheet('.chronicle-sheet', 'only_log_sheet_visible');
    await screenshot('06_log_sheet_932x430.png', 'Log sheet');
    await closeBy('.chronicle-close', 'log_sheet_closed');
    await expectNoSheets('no_sheets_after_log_close');

    await click('.proof-toggle', 'proof_dock_clicked');
    await waitVisible('.proof-sheet', 'proof_sheet_visible');
    await expectOnlySheet('.proof-sheet', 'only_proof_sheet_visible');
    await screenshot('07_proof_sheet_932x430.png', 'Proof sheet');
    await closeBy('.proof-sheet__header button', 'proof_sheet_closed');
    await expectNoSheets('no_sheets_after_proof_close');
    await checkNoWindowScrollbars('clean_play_surface_has_no_main_scrollbars_after_sheet_flow');
    await screenshot('08_clean_play_surface_restored_932x430.png', 'Clean play surface restored');

    await setViewport(1440, 900, false);
    await navigate(3600);
    await waitVisible('.map-canvas', 'desktop_debug_map_canvas_visible');
    const desktopRotateGate = await evalJson(visibleExpression('.mobile-rotate-gate'));
    addCheck('desktop_debug_does_not_show_rotate_gate', !desktopRotateGate?.visible, desktopRotateGate ?? {});
    await screenshot('09_desktop_debug_mode_1440x900.png', 'Desktop debug mode');

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
