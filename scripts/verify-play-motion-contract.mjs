#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const browserCandidates = [
  '/home/sovereign/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
  '/snap/chromium/current/usr/lib/chromium-browser/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
];

const defaults = {
  url: process.env.AKALYNTH_PLAY_URL || 'https://beta.akalynth.com/play/',
  reportPath: resolve(root, 'evidence/play-motion-contract-report.json'),
  screenshotDir: resolve(root, 'evidence/play-motion-contract-screenshots'),
  browser: process.env.AKALYNTH_CHROME_PATH || browserCandidates.find((candidate) => existsSync(candidate)) || browserCandidates[0],
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
    if (arg === '--url') args.url = readValue();
    else if (arg === '--report') args.reportPath = resolve(readValue());
    else if (arg === '--screenshot-dir') args.screenshotDir = resolve(readValue());
    else if (arg === '--browser') args.browser = readValue();
    else if (arg === '--help') {
      console.log([
        'Usage: node scripts/verify-play-motion-contract.mjs [options]',
        '',
        'Verifies /play/ motion invariants in a real browser.',
        '',
        'Options:',
        '  --url <url>              /play/ URL to inspect.',
        '  --report <file>         JSON report path.',
        '  --screenshot-dir <dir>  Screenshot output directory.',
        '  --browser <path>        Chromium/Chrome executable path.',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function nowIso() {
  return new Date().toISOString();
}

function pixelsDiff(a, b) {
  const len = Math.min(a.length, b.length);
  let changedPixels = 0;
  let totalDelta = 0;
  for (let i = 0; i < len; i += 4) {
    const delta =
      Math.abs(a[i] - b[i]) +
      Math.abs(a[i + 1] - b[i + 1]) +
      Math.abs(a[i + 2] - b[i + 2]) +
      Math.abs(a[i + 3] - b[i + 3]);
    if (delta > 0) {
      changedPixels += 1;
      totalDelta += delta;
    }
  }
  const totalPixels = len / 4;
  return {
    changedPixels,
    changedPct: Number(((changedPixels / totalPixels) * 100).toFixed(4)),
    totalDelta,
  };
}

function sameBox(a, b) {
  return a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function visibleBox(box, viewport) {
  if (!box || box.w <= 0 || box.h <= 0) return false;
  return box.x < viewport.width && box.y < viewport.height && box.x + box.w > 0 && box.y + box.h > 0;
}

async function waitForReady(page) {
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => {
    const text = document.body.innerText || '';
    const canvas = document.querySelector('.map-canvas');
    return Boolean(canvas) && /connected/i.test(text);
  }, null, { timeout: 30000 });
  await page.waitForTimeout(1800);
}

async function enterPlayIfNeeded(page) {
  const button = page.locator('.mobile-enter-play-btn');
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await page.waitForTimeout(500);
  }
}

async function snapshot(page, label) {
  return page.evaluate((label) => {
    const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const canvas = document.querySelector('.map-canvas');
    if (!canvas) throw new Error('missing canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('missing canvas context');
    const readBox = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        display: style.display,
        visibility: style.visibility,
        text: clean(el.textContent),
      };
    };
    const buttonBoxes = [...document.querySelectorAll('button')]
      .map((button) => {
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return {
          text: clean(button.innerText || button.getAttribute('aria-label') || ''),
          disabled: button.disabled,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          display: style.display,
          visibility: style.visibility,
        };
      })
      .filter((box) => box.w > 0 && box.h > 0 && box.display !== 'none' && box.visibility !== 'hidden');
    return {
      label,
      bodyText: clean(document.body.innerText),
      canvas: {
        width: canvas.width,
        height: canvas.height,
        box: readBox('canvas'),
        pixels: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
      },
      boxes: {
        topBar: readBox('.top-bar'),
        hudPrimary: readBox('.hud-primary'),
        stageControls: readBox('.stage-controls'),
        stageBottom: readBox('.stage-bottom'),
        mobileStatusRail: readBox('.mobile-status-rail'),
        motionObjectiveRail: readBox('.motion-objective-rail'),
        compactObjectiveCard: readBox('.compact-objective-card'),
        compactActionCard: readBox('.compact-action-card'),
        rightThumbZone: readBox('.thumb-zone.right'),
      },
      buttonBoxes,
    };
  }, label);
}

function boxEvidence(snapshot, keys) {
  const out = {};
  for (const key of keys) out[key] = snapshot.boxes[key];
  return out;
}

function stableBoxes(before, after, keys) {
  const unstable = [];
  for (const key of keys) {
    const a = before.boxes[key];
    const b = after.boxes[key];
    if (!a && !b) continue;
    if (!sameBox(a, b)) unstable.push({ key, before: a, after: b });
  }
  return unstable;
}

function findVisibleButton(snapshot, text, viewport) {
  return snapshot.buttonBoxes.find((button) =>
    button.text === text &&
    visibleBox(button, viewport)
  ) ?? null;
}

function addCheck(report, id, pass, evidence) {
  report.checks.push({ id, status: pass ? 'pass' : 'fail', evidence });
}

function positionFromText(text) {
  return text.match(/(\d+,\d+)/)?.[1] ?? null;
}

async function inspectViewport(browser, args, mode) {
  const viewport = mode === 'desktop'
    ? { width: 1440, height: 1000 }
    : { width: 844, height: 390 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const websocketEvents = [];
  const consoleMessages = [];
  const pageErrors = [];
  const badResponses = [];

  page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text().slice(0, 500) }));
  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 1000)));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      badResponses.push({ status: response.status(), url: response.url(), type: response.request().resourceType() });
    }
  });
  page.on('websocket', (ws) => {
    ws.on('framesent', (frame) => websocketEvents.push({ direction: 'sent', payload: String(frame.payload).slice(0, 300) }));
    ws.on('framereceived', (frame) => websocketEvents.push({ direction: 'received', payload: String(frame.payload).slice(0, 300) }));
  });

  await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForReady(page);
  await enterPlayIfNeeded(page);
  const idle0 = await snapshot(page, `${mode}:idle0`);
  await page.waitForTimeout(1000);
  const idle1 = await snapshot(page, `${mode}:idle1`);
  const beforeMoveScreenshot = resolve(args.screenshotDir, `${mode}-before-move.png`);
  await page.screenshot({ path: beforeMoveScreenshot, fullPage: true });
  const east = page.locator('[aria-label="Move east"]').first();
  const eastBox = await east.boundingBox();
  if (!eastBox) throw new Error(`missing visible east movement control for ${mode}`);
  await page.mouse.move(eastBox.x + eastBox.width / 2, eastBox.y + eastBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(260);
  await page.mouse.up();
  await page.waitForTimeout(900);
  const moved = await snapshot(page, `${mode}:after-east`);
  const afterMoveScreenshot = resolve(args.screenshotDir, `${mode}-after-east.png`);
  await page.screenshot({ path: afterMoveScreenshot, fullPage: true });
  await context.close();

  return {
    mode,
    viewport,
    screenshots: { beforeMove: beforeMoveScreenshot, afterMove: afterMoveScreenshot },
    idle0,
    idle1,
    moved,
    idleDiff: pixelsDiff(idle0.canvas.pixels, idle1.canvas.pixels),
    moveDiff: pixelsDiff(idle1.canvas.pixels, moved.canvas.pixels),
    consoleMessages,
    pageErrors,
    badResponses,
    websocketEvents,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(dirname(args.reportPath), { recursive: true });
  mkdirSync(args.screenshotDir, { recursive: true });

  const report = {
    id: 'AKALYNTH_PLAY_MOTION_CONTRACT_V1',
    status: 'running',
    generated_at: nowIso(),
    url: args.url,
    checks: [],
    notes: [
      'Browser-only verification; does not build, deploy, restart services, sync /opt, or mutate runtime custody.',
      'Canvas idle must remain stable. Expected movement is proven by an east input and resulting position text.',
      'HUD/control boxes must not move across idle refreshes or the east movement update.',
    ],
  };

  const browser = await chromium.launch({ executablePath: args.browser, headless: true });
  const desktop = await inspectViewport(browser, args, 'desktop');
  const mobile = await inspectViewport(browser, args, 'mobile-landscape');
  await browser.close();

  for (const result of [desktop, mobile]) {
    const hudKeys = result.mode === 'desktop'
      ? ['topBar', 'hudPrimary', 'stageControls', 'stageBottom']
      : ['topBar', 'stageControls', 'stageBottom', 'mobileStatusRail', 'motionObjectiveRail', 'rightThumbZone'];
    const idleUnstable = stableBoxes(result.idle0, result.idle1, hudKeys);
    const moveUnstable = stableBoxes(result.idle1, result.moved, hudKeys);
    const beforePosition = positionFromText(result.idle1.bodyText);
    const afterPosition = positionFromText(result.moved.bodyText);
    const positionAdvanced = Boolean(beforePosition && afterPosition && beforePosition !== afterPosition);
    const connected = /connected/i.test(result.moved.bodyText);

    addCheck(report, `${result.mode}_loads_connected`, connected, {
      text: result.moved.bodyText.slice(0, 500),
      screenshots: result.screenshots,
    });
    addCheck(report, `${result.mode}_idle_canvas_has_no_drift`, result.idleDiff.changedPixels === 0, {
      idleDiff: result.idleDiff,
    });
    addCheck(report, `${result.mode}_east_input_moves_canvas`, result.moveDiff.changedPixels > 0 && positionAdvanced, {
      moveDiff: result.moveDiff,
      beforePosition,
      afterPosition,
      positionAdvanced,
      text: result.moved.bodyText.slice(0, 500),
    });
    addCheck(report, `${result.mode}_hud_boxes_stable_on_idle_refresh`, idleUnstable.length === 0, {
      keys: hudKeys,
      unstable: idleUnstable,
      before: boxEvidence(result.idle0, hudKeys),
      after: boxEvidence(result.idle1, hudKeys),
    });
    addCheck(report, `${result.mode}_hud_boxes_stable_during_movement`, moveUnstable.length === 0, {
      keys: hudKeys,
      unstable: moveUnstable,
      before: boxEvidence(result.idle1, hudKeys),
      after: boxEvidence(result.moved, hudKeys),
    });
    addCheck(report, `${result.mode}_no_console_or_resource_errors`, (
      result.pageErrors.length === 0 &&
      result.badResponses.length === 0 &&
      result.consoleMessages.every((message) => message.type !== 'error')
    ), {
      pageErrors: result.pageErrors,
      badResponses: result.badResponses,
      consoleMessages: result.consoleMessages,
    });
  }

  const desktopHasObjective = /Walk onto the glowing rune to begin|Open Chat/.test(desktop.idle1.bodyText);
  const desktopFish = findVisibleButton(desktop.idle1, 'Fish Rookguard canal', desktop.viewport);
  const desktopAccountPanelHidden = !/ACCOUNT SESSION REQUIRED/i.test(desktop.idle1.bodyText);
  addCheck(report, 'desktop_presentation_objective_and_action_readable', Boolean(desktopHasObjective && desktopFish), {
    hasObjective: desktopHasObjective,
    fishButton: desktopFish,
    text: desktop.idle1.bodyText.slice(0, 700),
  });
  addCheck(report, 'desktop_presentation_hides_guest_account_blocker', desktopAccountPanelHidden, {
    accountBlockerPresent: !desktopAccountPanelHidden,
    text: desktop.idle1.bodyText.slice(0, 700),
  });

  const mobileMotionRail = mobile.moved.boxes.motionObjectiveRail;
  const mobileCompactCard = mobile.moved.boxes.compactObjectiveCard;
  const mobileActionCard = mobile.moved.boxes.compactActionCard;
  const mobileFish = findVisibleButton(mobile.moved, 'Fish', mobile.viewport);
  addCheck(report, 'mobile_landscape_objective_and_action_readable_while_moving', (
    visibleBox(mobileMotionRail, mobile.viewport) &&
    !visibleBox(mobileCompactCard, mobile.viewport) &&
    visibleBox(mobileActionCard, mobile.viewport) &&
    Boolean(mobileActionCard?.text) &&
    Boolean(mobileFish)
  ), {
    motionObjectiveRail: mobileMotionRail,
    compactObjectiveCard: mobileCompactCard,
    compactActionCard: mobileActionCard,
    fishButton: mobileFish,
    text: mobile.moved.bodyText.slice(0, 700),
  });

  report.summary = {
    desktop: {
      idleDiff: desktop.idleDiff,
      moveDiff: desktop.moveDiff,
      screenshots: desktop.screenshots,
    },
    mobileLandscape: {
      idleDiff: mobile.idleDiff,
      moveDiff: mobile.moveDiff,
      screenshots: mobile.screenshots,
    },
  };
  report.completed_at = nowIso();
  report.status = report.checks.every((check) => check.status === 'pass') ? 'pass' : 'fail';
  writeFileSync(args.reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const failed = report.checks.filter((check) => check.status !== 'pass');
  if (failed.length > 0) {
    for (const check of failed) console.error(`play motion contract failed: ${check.id}`);
    console.error(`report: ${args.reportPath}`);
    process.exit(1);
  }

  console.log(`play motion contract passed: ${args.reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
