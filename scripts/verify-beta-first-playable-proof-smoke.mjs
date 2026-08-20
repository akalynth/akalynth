#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertCredentialedLoginAck,
  assertReportHasNoSecrets,
  sanitizeReportValue,
} from './smoke-beta-first-playable-proof.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = path.join(repoRoot, 'apps/server');
const tsx = path.join(repoRoot, 'node_modules/.bin/tsx');
const smoke = path.join(repoRoot, 'scripts/smoke-beta-first-playable-proof.mjs');
const receiptVerifier = path.join(serverRoot, 'tools/verify-receipts-chain.ts');
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'akalynth-first-playable-proof-'),
);

async function openPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('local server exited before health');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('timeout waiting for local server health');
}

async function runProcess(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`process timeout: ${path.basename(command)}`));
    }, options.timeoutMs ?? 240_000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

let server = null;
try {
  assert.ok(fs.existsSync(tsx), `tsx executable missing: ${tsx}`);

  const refusedReport = path.join(temporaryRoot, 'refused.json');
  const refused = spawnSync(process.execPath, [smoke, '--report', refusedReport], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /Refusing remote first-playable writes without --live/);
  assert.equal(fs.existsSync(refusedReport), false, 'safety refusal must happen before writes');

  const email = 'secret-person@example.invalid';
  const token = 'super-secret-play-token';
  const sanitized = sanitizeReportValue({
    email_address: email,
    play_token: token,
    nested: `prefix:${token}:suffix`,
    safe: true,
  }, [email, token]);
  assertReportHasNoSecrets(sanitized, [email, token]);
  assert.equal(sanitized.email_address, '[redacted]');
  assert.equal(sanitized.play_token, '[redacted]');
  assert.match(sanitized.nested, /\[redacted\]/);

  assert.doesNotThrow(() => assertCredentialedLoginAck({
    type: 'login_ack',
    ok: true,
    player_id: 'p_expected',
    guest_token: '',
    token: 'signed-token',
  }, 'p_expected'));
  assert.throws(() => assertCredentialedLoginAck({
    type: 'login_ack',
    ok: true,
    player_id: 'p_expected',
    guest_token: 'gt_fallback',
    token: 'signed-token',
  }, 'p_expected'), /credentialed_login_fell_back_to_guest/);

  const port = await openPort();
  const receiptsPath = path.join(temporaryRoot, 'receipts.jsonl');
  const dbPath = path.join(temporaryRoot, 'akalynth.db');
  const markerPath = path.join(temporaryRoot, 'replay-marker.json');
  const keyPath = path.join(temporaryRoot, 'chronicle.key');
  const chroniclePath = path.join(temporaryRoot, 'chronicle.log');
  const reportPath = path.join(temporaryRoot, 'local-proof.json');
  fs.writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });
  const serverEnv = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    DEBUG: '1',
    REQUIRE_TLS: '0',
    ALLOW_INSECURE_LOCAL: '1',
    AKALYNTH_BOOTSTRAP: '1',
    AKALYNTH_LIFECYCLE_VERIFY: '0',
    AKALYNTH_RECEIPT_CHAIN_PATH: receiptsPath,
    AKALYNTH_DB_PATH: dbPath,
    AKALYNTH_REPLAY_MARKER_PATH: markerPath,
    CHRONICLE_KEY_PATH: keyPath,
    CHRONICLE_LOG_PATH: chroniclePath,
    ENABLE_CHRONICLE: '0',
    CHILL_ZONE_GATHER_ENABLED: '1',
    CHILL_ZONE_REFINE_ENABLED: '1',
    AKALYNTH_BETA_ENABLED: '1',
    AKALYNTH_BETA_REQUIRE_INVITE: '0',
    EMAIL_TRANSPORT: 'console',
    IP_RATE_LIMIT_ENABLED: '0',
    CADENCE_MIN_SAMPLES: '999',
    HEAT_TEM_THRESHOLD: '9999',
  };
  delete serverEnv.AKALYNTH_BETA_ACTIVE_RELEASE_MANIFEST;
  server = spawn(tsx, ['src/index.ts'], {
    cwd: serverRoot,
    env: serverEnv,
    stdio: 'ignore',
  });
  await waitForHealth(`http://127.0.0.1:${port}/v1/health`, server);

  const local = await runProcess(process.execPath, [
    smoke,
    '--api-base', `http://127.0.0.1:${port}`,
    '--web-base', `http://127.0.0.1:${port}`,
    '--ws-url', `ws://127.0.0.1:${port}`,
    '--no-browser',
    '--timeout-ms', '180000',
    '--report', reportPath,
  ], { timeoutMs: 240_000 });
  assert.equal(local.signal, null);
  assert.equal(local.code, 0, `local proof failed; inspect ${reportPath}`);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.status, 'pass', report.error ?? 'unknown report failure');
  assert.equal(report.target.mode, 'loopback-verification');
  assert.equal(report.journey.runtime_map, 'Azura');
  assert.equal(report.journey.delivery.refined, true);
  assert.equal(report.reconnect.runtime_map, 'Azura');
  assert.equal(report.reconnect.vocation_badge, 'vocation_hexer');
  assert.ok(report.receipt_evidence.account.action_counts.account_created >= 1);
  assert.ok(report.receipt_evidence.account.action_counts.character_selected >= 2);
  assert.ok(report.receipt_evidence.gameplay.action_counts.enter_world >= 2);
  assert.ok(report.receipt_evidence.gameplay.action_counts.delivery_recorded >= 1);
  assert.equal(fs.statSync(reportPath).mode & 0o777, 0o600);
  assert.doesNotMatch(fs.readFileSync(reportPath, 'utf8'), /@example\.invalid/);

  await stopServer(server);
  server = null;
  const chain = await runProcess(tsx, [receiptVerifier, receiptsPath], {
    cwd: repoRoot,
    env: { ...process.env, CHRONICLE_KEY_PATH: keyPath },
    timeoutMs: 60_000,
  });
  assert.equal(chain.code, 0, chain.stderr || chain.stdout);
  assert.match(chain.stdout, /receipts, linkage OK, signatures CHECKED/);

  console.log(
    '[verify-beta-first-playable-proof-smoke] PASS: remote refusal, redaction, guest rejection, full local account/Rookguard/gather/reconnect journey, receipt evidence, and signed chain verified',
  );
} finally {
  if (server) await stopServer(server);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
