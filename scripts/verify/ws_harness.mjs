import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const harnessDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(harnessDir, '..', '..');
const serverPackage = path.join(repoRoot, 'server', 'package.json');
const require = createRequire(serverPackage);
const WebSocket = require('ws');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--ws-url') out.wsUrl = argv[++i];
    else if (arg === '--guest-token') out.guestToken = argv[++i];
    else if (arg === '--scenario') out.scenarioPath = argv[++i];
    else if (arg === '--timeout-ms') out.timeoutMs = Number(argv[++i]);
  }
  return out;
}

function usage() {
  return 'Usage: node ws_harness.mjs --ws-url <ws> --guest-token <token> --scenario <file> [--timeout-ms <ms>]';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deepMatch(target, pattern) {
  if (pattern === null || pattern === undefined) return true;
  if (typeof pattern !== 'object') return target === pattern;
  if (target === null || target === undefined) return false;
  if (Array.isArray(pattern)) {
    if (!Array.isArray(target)) return false;
    return pattern.every((value, index) => deepMatch(target[index], value));
  }
  for (const [key, value] of Object.entries(pattern)) {
    if (!deepMatch(target[key], value)) return false;
  }
  return true;
}

function replacePlaceholders(value, replacements) {
  if (typeof value === 'string') {
    if (value === '$GUEST_TOKEN') return replacements.guestToken;
    if (value === '$REQUEST_ID' && replacements.requestId) return replacements.requestId;
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => replacePlaceholders(entry, replacements));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = replacePlaceholders(entry, replacements);
    }
    return out;
  }
  return value;
}

function estimateDuration(events, hooks, bootstrapDelayMs) {
  let total = bootstrapDelayMs * 3;
  for (const event of events) {
    if (event.send) total += event.delay_ms ?? 0;
    if (event.repeat) total += (event.delay_ms ?? 0) * (event.repeat ?? 0);
  }
  for (const hook of hooks) {
    if (hook.delay_ms) total = Math.max(total, hook.delay_ms + 500);
  }
  return total + 500;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.wsUrl || !args.guestToken || !args.scenarioPath) {
    throw new Error(usage());
  }

  const scenarioRaw = fs.readFileSync(path.resolve(args.scenarioPath), 'utf-8');
  const scenario = JSON.parse(scenarioRaw);
  const replacements = { guestToken: args.guestToken };

  const bootstrapEnabled = scenario.bootstrap !== false;
  const bootstrapDelayMs = Number.isFinite(scenario.bootstrap_delay_ms) ? scenario.bootstrap_delay_ms : 150;
  const autoTem = Boolean(scenario.auto_tem);
  const events = Array.isArray(scenario.events) ? scenario.events : [];
  const hooks = Array.isArray(scenario.hooks) ? scenario.hooks : [];
  const expect = Array.isArray(scenario.expect) ? scenario.expect : [];

  const messages = [];
  const sentEvents = [];
  const failures = [];
  const firedHooks = new Array(hooks.length).fill(false);
  let temAnswered = false;
  let lastWitnessRequestId = null;

  const ws = new WebSocket(args.wsUrl);

  const sendMessage = (msg) => {
    const payload = replacePlaceholders(msg, replacements);
    const at = Date.now();
    ws.send(JSON.stringify(payload));
    sentEvents.push({ at_ms: at, message: payload });
  };

  const scheduleSend = (msg, delayMs) => {
    setTimeout(() => sendMessage(msg), Math.max(0, delayMs));
  };

  ws.on('message', (data) => {
    let parsed = null;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return;
    }
    messages.push(parsed);

    if (autoTem && parsed.type === 'tem_challenge' && !temAnswered) {
      temAnswered = true;
      scheduleSend({ type: 'chat', message: 'AZURA' }, 100);
    }

    if (parsed.type === 'tem_witness_request' && parsed.request_id) {
      lastWitnessRequestId = parsed.request_id;
    }

    hooks.forEach((hook, index) => {
      if (firedHooks[index]) return;
      if (!deepMatch(parsed, hook.when)) return;
      firedHooks[index] = true;
      let delayMs = hook.delay_ms ?? 0;
      if (hook.after_ms) {
        if (typeof hook.after_ms === 'number') {
          delayMs = hook.after_ms;
        } else if (typeof hook.after_ms === 'object') {
          const field = hook.after_ms.field;
          const add = hook.after_ms.add ?? 0;
          const base = typeof parsed[field] === 'number' ? parsed[field] : 0;
          delayMs = base + add;
        }
      }
      const hookReplacements = { ...replacements, requestId: lastWitnessRequestId };
      const hookMsg = replacePlaceholders(hook.send, hookReplacements);
      scheduleSend(hookMsg, delayMs);
    });
  });

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  if (bootstrapEnabled) {
    sendMessage({ type: 'connect' });
    await sleep(bootstrapDelayMs);
    sendMessage({ type: 'login', guest_token: replacements.guestToken });
    await sleep(bootstrapDelayMs);
    sendMessage({ type: 'enter_world' });
    await sleep(bootstrapDelayMs);
  }

  (async () => {
    for (const event of events) {
      if (event.send) {
        sendMessage(event.send);
        await sleep(event.delay_ms ?? 0);
        continue;
      }
      if (event.repeat) {
        const count = event.repeat ?? 0;
        const pattern = Array.isArray(event.pattern) ? event.pattern : [];
        const delay = event.delay_ms ?? 0;
        for (let i = 0; i < count; i++) {
          const msg = pattern[i % pattern.length];
          if (msg) {
            sendMessage(msg);
            await sleep(delay);
          }
        }
      }
    }
  })().catch((err) => {
    failures.push(`event_send_failed:${err?.message ?? err}`);
  });

  const durationMs = Number.isFinite(args.timeoutMs)
    ? args.timeoutMs
    : Number.isFinite(scenario.duration_ms)
      ? scenario.duration_ms
      : estimateDuration(events, hooks, bootstrapDelayMs);

  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  }, durationMs);

  await new Promise((resolve) => ws.on('close', resolve));

  for (const requirement of expect) {
    const requiredType = requirement.type;
    const fields = requirement.fields ?? null;
    const found = messages.some((msg) => msg.type === requiredType && deepMatch(msg, fields));
    if (!found) {
      failures.push(`missing:${requiredType}`);
    }
  }

  return {
    ok: failures.length === 0,
    scenario: scenario.name ?? path.basename(args.scenarioPath),
    messages,
    events: sentEvents,
    failures,
  };
}

run()
  .then((report) => {
    process.stdout.write(JSON.stringify(report));
    process.exit(report.ok ? 0 : 2);
  })
  .catch((err) => {
    const failure = err?.message ?? String(err);
    const report = { ok: false, messages: [], events: [], failures: [failure] };
    process.stdout.write(JSON.stringify(report));
    process.exit(2);
  });
