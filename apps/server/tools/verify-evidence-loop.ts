#!/usr/bin/env node
// Verify Evidence Loop v0.
//
// Guards the first full Witness Moth Bloom loop:
// - High City herald starts the Bloom;
// - players recover fixed evidence through use_skill intents;
// - contributions are rejected until evidence is complete;
// - receipts materialize into Chronicle + SQLite projection;
// - resolution unlocks the Ember Road teaser through the existing loop_update payload;
// - no runtime code imports raw drop/ source.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { WebSocket } from 'ws';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import { TEM_CHALLENGE_RESPONSE } from '../../../packages/shared/types.js';
import { computeReceiptHash } from '../src/persist/index.js';
import { initSchema } from '../src/persist/schema.js';
import { materialize } from '../src/persist/materializers.js';
import { RECEIPT_ACTIONS } from '../src/persist/types.js';
import {
  EMBER_ROAD_TEASER_ID,
  WITNESS_MOTH_BLOOM_CONTRIBUTIONS,
  WITNESS_MOTH_BLOOM_EVIDENCE,
  WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX,
  WITNESS_MOTH_BLOOM_EVENT_ID,
  WITNESS_MOTH_BLOOM_SKILL_PREFIX,
  createWitnessMothBloomRuntime,
  handleWitnessMothBloomSkillIntent,
  hydrateWitnessMothBloomRuntime,
  recoverWitnessMothBloomEvidence,
  recordWitnessMothBloomContribution,
  startWitnessMothBloom,
} from '../src/world/world-events.js';

type ReceiptInput = {
  player_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
};

type JsonMessage = Record<string, unknown>;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SERVER_DIR = path.join(REPO_ROOT, 'apps/server');
const PLAYER_ID = 'p_kael';
const EVENT_EVIDENCE_SKILLS = WITNESS_MOTH_BLOOM_EVIDENCE.map(
  (entry) => `${WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX}${entry.evidence_id}`
);
const EVENT_CONTRIBUTION_SKILLS = WITNESS_MOTH_BLOOM_CONTRIBUTIONS.map(
  (entry) => `${WITNESS_MOTH_BLOOM_SKILL_PREFIX}${entry.contribution_id}`
);

function fail(msg: string): never {
  console.error(`\n[verify-evidence-loop] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string): void {
  console.log(`[verify-evidence-loop] OK: ${msg}`);
}

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) fail(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeChainWriter(seedMs = 1_750_100_000_000) {
  let sequence = 0;
  let prevHash = 'genesis';
  const receipts: AuditReceipt[] = [];

  const write = (input: ReceiptInput): AuditReceipt => {
    sequence += 1;
    const receipt: AuditReceipt = {
      sequence,
      timestamp: new Date(seedMs + sequence * 1000).toISOString(),
      prev_hash: prevHash,
      event_hash: '',
      signature: '',
      actor_id: input.player_id,
      action: input.action,
      inputs: input.inputs,
      result: input.result,
      inputs_hash: 'test-inputs-hash',
      outputs_hash: 'test-outputs-hash',
    };
    receipt.event_hash = computeReceiptHash(receipt);
    prevHash = receipt.event_hash;
    receipts.push(receipt);
    return receipt;
  };

  return { write, receipts };
}

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  initSchema(db);
  db.prepare(`
    INSERT INTO players (player_id, name, created_at, created_receipt, auth_method, name_lower)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(PLAYER_ID, 'Kael', new Date(1_750_100_000_000).toISOString(), `blake3:${'b'.repeat(64)}`, 'guest', 'kael');
  return db;
}

function verifyReducerReceipts(): AuditReceipt[] {
  const runtime = createWitnessMothBloomRuntime();
  const writer = makeChainWriter();

  const inactiveEvidence = recoverWitnessMothBloomEvidence(
    runtime,
    { player_id: PLAYER_ID, map: 'Azura', evidence_id: 'testimony_shard', now_ms: 1 },
    writer.write
  );
  assert(!inactiveEvidence.ok && inactiveEvidence.payload.error === 'event_inactive', 'evidence before start should be rejected');
  assert(writer.receipts.length === 0, 'evidence before start must emit no receipt');

  const wrongMapEvidence = recoverWitnessMothBloomEvidence(
    runtime,
    { player_id: PLAYER_ID, map: 'Rookguard', evidence_id: 'testimony_shard', now_ms: 2 },
    writer.write
  );
  assert(!wrongMapEvidence.ok && wrongMapEvidence.payload.error === 'wrong_map', 'wrong-map evidence should be rejected');
  assert(writer.receipts.length === 0, 'wrong-map evidence must emit no receipt');

  const start = startWitnessMothBloom(runtime, { player_id: PLAYER_ID, map: 'Azura', now_ms: 3 }, writer.write);
  assert(start.ok && start.started, 'High City herald should start Witness Moth Bloom');
  assert(writer.receipts.length === 1 && writer.receipts[0].action === RECEIPT_ACTIONS.WORLD_EVENT_STARTED, 'start should emit one start receipt');

  const firstEvidence = recoverWitnessMothBloomEvidence(
    runtime,
    { player_id: PLAYER_ID, map: 'Azura', evidence_id: 'testimony_shard', now_ms: 4 },
    writer.write
  );
  assert(firstEvidence.ok && firstEvidence.recovered, 'first evidence should be recovered');
  assert(writer.receipts.length === 2 && writer.receipts[1].action === RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED, 'first evidence should emit one evidence receipt');

  const gatedContribution = recordWitnessMothBloomContribution(
    runtime,
    { player_id: PLAYER_ID, map: 'Azura', contribution_id: 'verify_testimony', now_ms: 5 },
    writer.write
  );
  assert(!gatedContribution.ok && gatedContribution.payload.error === 'evidence_required', 'contribution before all evidence should be rejected');
  assert(writer.receipts.length === 2, 'evidence-gated contribution must emit no receipt');

  for (const evidenceId of ['damaged_ledger', 'moth_residue'] as const) {
    const recovered = recoverWitnessMothBloomEvidence(
      runtime,
      { player_id: PLAYER_ID, map: 'Azura', evidence_id: evidenceId, now_ms: 6 },
      writer.write
    );
    assert(recovered.ok && recovered.recovered, `evidence ${evidenceId} should be recovered`);
  }
  assert(writer.receipts.filter((receipt) => receipt.action === RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED).length === 3, 'each evidence item should emit one receipt');

  const duplicateEvidence = recoverWitnessMothBloomEvidence(
    runtime,
    { player_id: PLAYER_ID, map: 'Azura', evidence_id: 'testimony_shard', now_ms: 7 },
    writer.write
  );
  assert(duplicateEvidence.ok && !duplicateEvidence.recovered, 'duplicate evidence should not be recovered twice');
  assert(writer.receipts.filter((receipt) => receipt.action === RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED).length === 3, 'duplicate evidence must emit no duplicate receipt');

  for (const contributionId of ['verify_testimony', 'craft_lantern_frame', 'defend_scribes'] as const) {
    const result = recordWitnessMothBloomContribution(
      runtime,
      { player_id: PLAYER_ID, map: 'Azura', contribution_id: contributionId, now_ms: 8 },
      writer.write
    );
    assert(result.ok && result.recorded, `contribution ${contributionId} should be recorded`);
  }

  assert(runtime.phase === 'resolved', 'three valid contributions should resolve Bloom');
  assert(runtime.teaser?.id === EMBER_ROAD_TEASER_ID, 'resolved Bloom should unlock Ember Road teaser');

  const actions = writer.receipts.map((receipt) => receipt.action);
  assert(actions.join(',') === [
    RECEIPT_ACTIONS.WORLD_EVENT_STARTED,
    RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED,
    RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED,
    RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED,
    RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION,
    RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION,
    RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION,
    RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED,
    RECEIPT_ACTIONS.WORLD_EVENT_TEASER_UNLOCKED,
  ].join(','), 'receipt order should be start, evidence, contributions, resolution, teaser');

  ok('reducer rejects invalid evidence/contribution attempts and emits ordered receipts');
  return writer.receipts;
}

function verifyMaterialization(receipts: AuditReceipt[]): void {
  const db = freshDb();
  for (const receipt of receipts) materialize(db, receipt);
  for (const receipt of receipts) materialize(db, receipt);

  const chronicleRows = db.prepare(`
    SELECT source_action, details_json
    FROM chronicle_events
    WHERE kind = 'world_event'
    ORDER BY id ASC
  `).all() as Array<{ source_action: string; details_json: string }>;

  assert(chronicleRows.length === receipts.length, 'Chronicle materialization should be idempotent');
  assert(chronicleRows.slice(1, 4).every((row) => row.source_action === RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED), 'Chronicle rows should include evidence recovery');
  assert(chronicleRows.slice(4, 7).every((row) => row.source_action === RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION), 'Chronicle rows should include contributions');
  assert(chronicleRows[7].source_action === RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED, 'Chronicle rows should include resolution');
  assert(chronicleRows[8].source_action === RECEIPT_ACTIONS.WORLD_EVENT_TEASER_UNLOCKED, 'Chronicle rows should include teaser unlock');

  const firstEvidenceDetails = JSON.parse(chronicleRows[1].details_json) as Record<string, unknown>;
  const teaserDetails = JSON.parse(chronicleRows[8].details_json) as Record<string, unknown>;
  assert(firstEvidenceDetails.evidence_id === 'testimony_shard', 'Chronicle evidence row should carry evidence_id');
  assert(teaserDetails.teaser_id === EMBER_ROAD_TEASER_ID, 'Chronicle teaser row should carry teaser_id');

  const row = db.prepare(`
    SELECT event_id, map, phase, started_by, started_at, resolved_by, resolved_at,
           outcome, contributions_json, evidence_json, teaser_json, last_receipt
    FROM world_events
    WHERE event_id = ?
  `).get(WITNESS_MOTH_BLOOM_EVENT_ID) as
    | {
        event_id: string;
        map: string;
        phase: string;
        started_by: string | null;
        started_at: string | null;
        resolved_by: string | null;
        resolved_at: string | null;
        outcome: string | null;
        contributions_json: string;
        evidence_json: string;
        teaser_json: string;
        last_receipt: string;
      }
    | undefined;

  assert(row, 'world_events row should exist');
  assert(row.phase === 'resolved', 'world_events row should be resolved');
  assert(row.outcome === 'controlled_release', 'world_events row should preserve outcome');
  assert(Object.keys(JSON.parse(row.contributions_json) as Record<string, unknown>).length === 3, 'world_events should preserve contributions');
  assert(Object.keys(JSON.parse(row.evidence_json) as Record<string, unknown>).length === 3, 'world_events should preserve evidence');
  const teaser = JSON.parse(row.teaser_json) as Record<string, unknown>;
  assert(teaser.id === EMBER_ROAD_TEASER_ID && teaser.unlocked === true, 'world_events should preserve teaser unlock');

  const hydrated = createWitnessMothBloomRuntime();
  assert(hydrateWitnessMothBloomRuntime(hydrated, row), 'world_events row should hydrate runtime');
  assert(hydrated.phase === 'resolved', 'hydrated runtime should be resolved');
  assert(Object.keys(hydrated.evidence).length === 3, 'hydrated runtime should preserve evidence');
  assert(Object.keys(hydrated.contributions).length === 3, 'hydrated runtime should preserve contributions');
  assert(hydrated.teaser?.id === EMBER_ROAD_TEASER_ID, 'hydrated runtime should preserve teaser');

  db.close();
  ok('Chronicle and SQLite projection are idempotent and hydrate resolved teaser state');
}

function verifyNoRawDropRuntimeImports(): void {
  const offenders: string[] = [];
  const roots = [path.join(REPO_ROOT, 'apps'), path.join(REPO_ROOT, 'packages')];
  const ignored = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);
  const runtimeExts = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
  const importPattern = /(?:from\s+|import\s*\()\s*['"][^'"]*drop\//;

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile() || !runtimeExts.has(path.extname(entry.name))) continue;
      const source = fs.readFileSync(full, 'utf8');
      if (importPattern.test(source)) offenders.push(path.relative(REPO_ROOT, full));
    }
  };

  for (const root of roots) walk(root);
  assert(offenders.length === 0, `runtime code must not import raw drop/ source: ${offenders.join(', ')}`);
  ok('runtime code has no raw drop/ imports under apps/ or packages/');
}

async function getOpenPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('failed to allocate TCP port')));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

function waitForServerListen(child: ChildProcessWithoutNullStreams, output: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`server did not start\n${output.join('')}`));
    }, 15_000);

    const onStdout = (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes('HTTP+WS listening')) {
        cleanup();
        resolve();
      }
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      reject(new Error(`server exited before listen: code=${code} signal=${signal}\n${output.join('')}`));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off('data', onStdout);
      child.off('exit', onExit);
    };

    child.stdout.on('data', onStdout);
    child.once('exit', onExit);
  });
}

async function stopServer(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    sleep(3000).then(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }),
  ]);
}

class WsHarness {
  private readonly queue: JsonMessage[] = [];
  private readonly waiters: Array<{
    predicate: (msg: JsonMessage) => boolean;
    resolve: (msg: JsonMessage) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
    label: string;
  }> = [];

  private constructor(private readonly ws: WebSocket) {
    ws.on('message', (data) => {
      let msg: JsonMessage;
      try {
        msg = JSON.parse(data.toString()) as JsonMessage;
      } catch {
        return;
      }

      const index = this.waiters.findIndex((waiter) => waiter.predicate(msg));
      if (index >= 0) {
        const [waiter] = this.waiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(msg);
        return;
      }

      this.queue.push(msg);
    });
  }

  static async connect(url: string): Promise<WsHarness> {
    const ws = new WebSocket(url);
    const harness = new WsHarness(ws);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket open timeout')), 5000);
      ws.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    await harness.waitFor((msg) => msg.type === 'welcome', 'welcome');
    return harness;
  }

  send(msg: JsonMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  waitFor(predicate: (msg: JsonMessage) => boolean, label: string, timeoutMs = 8000): Promise<JsonMessage> {
    const queuedIndex = this.queue.findIndex(predicate);
    if (queuedIndex >= 0) {
      const [msg] = this.queue.splice(queuedIndex, 1);
      return Promise.resolve(msg);
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        label,
        timeout: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(new Error(`timeout waiting for ${label}; queued=${this.queue.map((msg) => String(msg.type)).join(',')}`));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  close(): void {
    this.ws.close();
  }
}

async function sendMove(client: WsHarness, direction: 'north' | 'south' | 'east' | 'west'): Promise<JsonMessage> {
  client.send({ type: 'move_intent', direction });
  const result = await client.waitFor((msg) => msg.type === 'move_result', `move_result:${direction}`);
  assert(result.ok === true, `move ${direction} should succeed, got ${JSON.stringify(result)}`);
  await sleep(140);
  return result;
}

async function useSkill(client: WsHarness, skillId: string): Promise<{ result: JsonMessage; loop: JsonMessage }> {
  client.send({ type: 'use_skill', skill_id: skillId });
  const result = await client.waitFor(
    (msg) => msg.type === 'skill_result' && msg.skill_id === skillId,
    `skill_result:${skillId}`
  );
  const loop = await client.waitFor((msg) => msg.type === 'loop_update', `loop_update:${skillId}`);
  return { result, loop };
}

function assertSkillSuccess(result: JsonMessage, skillId: string): void {
  assert(result.type === 'skill_result' && result.skill_id === skillId && result.success === true, `skill ${skillId} should succeed`);
}

function readJsonlActions(chainPath: string): string[] {
  const raw = fs.readFileSync(chainPath, 'utf8').trim();
  if (!raw) return [];
  return raw.split('\n').map((line) => (JSON.parse(line) as { action: string }).action);
}

async function verifyWebSocketLoop(): Promise<void> {
  const port = await getOpenPort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'akalynth-evidence-loop-'));
  const receiptsPath = path.join(tmp, 'audit/receipts.jsonl');
  const dbPath = path.join(tmp, 'data/akalynth.db');
  const markerPath = path.join(tmp, 'data/replay-marker.json');
  const keyPath = path.join(tmp, 'chronicle.key');
  const output: string[] = [];
  const tsxBin = path.join(REPO_ROOT, 'node_modules/.bin/tsx');
  fs.writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });

  const child = spawn(tsxBin, ['src/index.ts'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DEBUG: '1',
      REQUIRE_TLS: '0',
      ALLOW_INSECURE_LOCAL: '1',
      AKALYNTH_BOOTSTRAP: '1',
      AKALYNTH_LIFECYCLE_VERIFY: '0',
      AKALYNTH_RECEIPT_CHAIN_PATH: receiptsPath,
      AKALYNTH_DB_PATH: dbPath,
      AKALYNTH_REPLAY_MARKER_PATH: markerPath,
      CHRONICLE_KEY_PATH: keyPath,
      CHRONICLE_LOG_PATH: path.join(tmp, 'chronicle.log'),
      ENABLE_CHRONICLE: '0',
      IP_RATE_LIMIT_ENABLED: '0',
      CADENCE_MIN_SAMPLES: '999',
      HEAT_TEM_THRESHOLD: '9999',
    },
  });

  child.stdout.on('data', (chunk) => output.push(chunk.toString()));
  child.stderr.on('data', (chunk) => output.push(chunk.toString()));

  let client: WsHarness | null = null;
  try {
    await waitForServerListen(child, output);
    client = await WsHarness.connect(`ws://127.0.0.1:${port}`);

    client.send({ type: 'login', guest_token: null });
    const login = await client.waitFor((msg) => msg.type === 'login_ack', 'login_ack');
    assert(login.ok === true, `login should succeed: ${JSON.stringify(login)}`);

    client.send({ type: 'enter_world' });
    const rookguard = await client.waitFor((msg) => msg.type === 'world_state' && msg.map === 'Rookguard', 'world_state:Rookguard');
    assert((rookguard.player as { x?: number; y?: number } | undefined)?.x === 2, 'Rookguard spawn x should be 2');

    await sendMove(client, 'east'); // tutorial move at (3,2)
    client.send({ type: 'chat', message: 'evidence-loop hello' });
    await client.waitFor((msg) => msg.type === 'chat_broadcast' && msg.message === 'evidence-loop hello', 'chat_broadcast');

    await sendMove(client, 'east'); // (4,2)
    await sendMove(client, 'east'); // (5,2)
    await sendMove(client, 'east'); // (6,2)
    await sendMove(client, 'east'); // tutorial Tem at (7,2)
    await client.waitFor((msg) => msg.type === 'tem_challenge', 'tem_challenge');
    client.send({ type: 'tem_response', response: TEM_CHALLENGE_RESPONSE });
    await sleep(120);

    await sendMove(client, 'east'); // (8,2)
    await sendMove(client, 'east'); // (9,2)
    const gateMove = await sendMove(client, 'east'); // gate transfer to Azura
    assert(gateMove.map === 'Azura', 'gate move should transfer to Azura');
    await client.waitFor((msg) => msg.type === 'world_state' && msg.map === 'Azura', 'world_state:Azura');

    for (let i = 0; i < 16; i += 1) {
      await sendMove(client, 'south');
    }

    client.send({ type: 'talk_to_npc', npc_id: 'azura_herald' });
    await client.waitFor((msg) => msg.type === 'npc_dialogue' && msg.npc_id === 'azura_herald', 'npc_dialogue:azura_herald');
    const heraldLoop = await client.waitFor((msg) => msg.type === 'loop_update' && msg.event === 'herald_met', 'loop_update:herald_met');
    assert((heraldLoop.loop as { lastEvent?: string } | undefined)?.lastEvent === 'witness_moth_bloom_signal', 'herald loop_update should expose Bloom signal');

    for (const skillId of EVENT_EVIDENCE_SKILLS) {
      const { result, loop } = await useSkill(client, skillId);
      assertSkillSuccess(result, skillId);
      assert(loop.event === 'witness_moth_bloom_evidence', `evidence ${skillId} should emit evidence loop_update`);
    }

    for (const skillId of EVENT_CONTRIBUTION_SKILLS) {
      const { result, loop } = await useSkill(client, skillId);
      assertSkillSuccess(result, skillId);
      assert(
        loop.event === 'witness_moth_bloom_progress' || loop.event === 'witness_moth_bloom_resolved',
        `contribution ${skillId} should emit progress/resolved loop_update`
      );
      if (loop.event === 'witness_moth_bloom_resolved') {
        const teaser = (loop.loop as { teaser?: { id?: string; unlocked?: boolean } } | undefined)?.teaser;
        assert(teaser?.id === EMBER_ROAD_TEASER_ID && teaser.unlocked === true, 'final loop_update should include ember_road_marker teaser');
      }
    }

    const actions = readJsonlActions(receiptsPath);
    assert(actions.filter((action) => action === RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED).length === 3, 'live server should receipt three evidence recoveries');
    assert(actions.includes(RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED), 'live server should receipt Bloom resolution');
    assert(actions.includes(RECEIPT_ACTIONS.WORLD_EVENT_TEASER_UNLOCKED), 'live server should receipt teaser unlock');

    ok('fresh WebSocket server completes herald -> evidence -> contribution -> teaser loop');
  } finally {
    client?.close();
    await stopServer(child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const receipts = verifyReducerReceipts();
  verifyMaterialization(receipts);
  verifyNoRawDropRuntimeImports();
  await verifyWebSocketLoop();
  console.log('\n[verify-evidence-loop] All checks passed.');
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
