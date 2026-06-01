#!/usr/bin/env tsx
/**
 * verify-rate-limits.ts — Rate Limit Verification Tool (Plan B)
 *
 * Tests all anti-bot rate limiting mechanisms:
 * 1. Per-IP connection limiting (5 connections / 10min)
 * 2. Per-IP action buckets (5 moves/sec, 1 chat/sec)
 * 3. Attack spam detection (5 failed attacks / 30s)
 *
 * Usage:
 *   npm run verify:rate-limits
 *   npx tsx tools/verify-rate-limits.ts
 *   npx tsx tools/verify-rate-limits.ts --scenario ip_flood
 *   npx tsx tools/verify-rate-limits.ts --scenario move_spam
 *   npx tsx tools/verify-rate-limits.ts --scenario chat_spam
 *   npx tsx tools/verify-rate-limits.ts --scenario attack_spam
 *
 * CI: all four scenarios are gated in .github/workflows/ci.yml → loadtest-smoke
 * job, each against its OWN fresh server on a separate port (the per-IP
 * connection budget can't bleed between scenarios that way). chat_spam and
 * attack_spam were previously broken on the verifier side and are now fixed:
 *   - chat_spam: one persistent collector over a fixed window (was a one-shot
 *     handler attached after each send, which missed the rate_limited error).
 *   - attack_spam: sends enough failed attacks to push heat past
 *     HEAT_TEM_THRESHOLD (was a single +15 burst that never crossed 30).
 */
/* eslint-disable no-console */

import { WebSocket } from 'ws';
import { HEAT_TEM_THRESHOLD } from '../../../packages/shared/constants.js';

const WS_URL = process.env.WS_URL || 'ws://localhost:3000';
const TIMEOUT_MS = 10_000;

// Server model (src/index.ts attack_intent handler + world/heat.ts): every
// FAILURES_PER_BURST failed attacks within 30s adds ATTACK_SPAM_HEAT_PER_BURST
// heat, and a Tem challenge fires once cumulative heat reaches
// HEAT_TEM_THRESHOLD. Kept in sync with applyHeatChange(..., 15, 'attack_spam').
const ATTACK_SPAM_HEAT_PER_BURST = 15;
const FAILURES_PER_BURST = 5;

type TestResult = {
  scenario: string;
  passed: boolean;
  message: string;
  details?: unknown;
};

// Utility: Wait for ms
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Utility: Connect and wait for welcome
async function connectWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, TIMEOUT_MS);

    ws.on('open', () => {
      clearTimeout(timeout);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'welcome') {
        resolve(ws);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// Utility: Send message and wait for response
async function sendAndWait(ws: WebSocket, message: unknown, expectedType?: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Response timeout'));
    }, TIMEOUT_MS);

    const handler = (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (!expectedType || msg.type === expectedType) {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve(msg);
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify(message));
  });
}

// Test 1: IP Connection Flood (should reject 6th+ connection)
async function testIpFlood(): Promise<TestResult> {
  const connections: WebSocket[] = [];
  let rejectedCount = 0;
  const TOTAL_ATTEMPTS = 8;
  const EXPECTED_LIMIT = 5;

  console.log(`[ip_flood] Attempting ${TOTAL_ATTEMPTS} connections...`);

  for (let i = 0; i < TOTAL_ATTEMPTS; i++) {
    try {
      const ws = await connectWs();
      connections.push(ws);
      console.log(`[ip_flood] Connection ${i + 1}: accepted`);
    } catch (err) {
      rejectedCount++;
      console.log(`[ip_flood] Connection ${i + 1}: rejected (${(err as Error).message})`);
    }
  }

  // Close all connections
  for (const ws of connections) {
    ws.close();
  }

  const passed = connections.length <= EXPECTED_LIMIT && rejectedCount >= (TOTAL_ATTEMPTS - EXPECTED_LIMIT);
  return {
    scenario: 'ip_flood',
    passed,
    message: passed
      ? `✅ IP flood protection working: ${connections.length} accepted, ${rejectedCount} rejected`
      : `❌ IP flood protection failed: expected max ${EXPECTED_LIMIT} accepted, got ${connections.length}`,
    details: { accepted: connections.length, rejected: rejectedCount, limit: EXPECTED_LIMIT },
  };
}

// Test 2: Move Spam (5 moves/sec per IP)
async function testMoveSpam(): Promise<TestResult> {
  console.log('[move_spam] Testing per-IP move rate limiting...');

  const ws = await connectWs();
  await sendAndWait(ws, { type: 'login', guest_token: null }, 'login_ack');
  await sendAndWait(ws, { type: 'enter_world' }, 'world_state');

  // Send 7 moves rapidly (limit is 5/sec)
  const responses: unknown[] = [];
  for (let i = 0; i < 7; i++) {
    const response = await sendAndWait(ws, { type: 'move_intent', direction: 'north' }, 'move_result');
    responses.push(response);
  }

  ws.close();

  // Count rate_limited rejections
  const rateLimited = responses.filter((r: any) => r.reason === 'rate_limited').length;
  const passed = rateLimited >= 2; // At least 2 out of 7 should be rejected

  return {
    scenario: 'move_spam',
    passed,
    message: passed
      ? `✅ Move spam protection working: ${rateLimited} moves rate-limited`
      : `❌ Move spam protection failed: expected at least 2 rate-limited, got ${rateLimited}`,
    details: { total_moves: 7, rate_limited: rateLimited },
  };
}

// Test 3: Chat Spam (1 chat/sec per IP)
async function testChatSpam(): Promise<TestResult> {
  console.log('[chat_spam] Testing per-IP chat rate limiting...');

  const ws = await connectWs();
  await sendAndWait(ws, { type: 'login', guest_token: null }, 'login_ack');
  await sendAndWait(ws, { type: 'enter_world' }, 'world_state');

  // Attach ONE persistent collector BEFORE sending. The previous version
  // registered a one-shot handler after each send (+100ms sleep), so a
  // rate_limited error that arrived during the sleep — or behind an earlier
  // echo/ack — was missed, yielding a false 0. Collecting every message over a
  // fixed window and filtering is race-free.
  const rateLimited: unknown[] = [];
  const collector = (data: Buffer) => {
    let msg: { type?: string; code?: string };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === 'error' && msg.code === 'rate_limited') {
      rateLimited.push(msg);
    }
  };
  ws.on('message', collector);

  // Send 3 chats rapidly (limit is 1/sec): first accepted, rest rate-limited.
  for (let i = 0; i < 3; i++) {
    ws.send(JSON.stringify({ type: 'chat', message: `test ${i}` }));
  }

  // Wait a fixed window for all responses, then stop collecting.
  await sleep(1000);
  ws.off('message', collector);
  ws.close();

  const passed = rateLimited.length >= 2; // At least 2 out of 3 should be rate-limited

  return {
    scenario: 'chat_spam',
    passed,
    message: passed
      ? `✅ Chat spam protection working: ${rateLimited.length} chats rate-limited`
      : `❌ Chat spam protection failed: expected at least 2 rate-limited, got ${rateLimited.length}`,
    details: { total_chats: 3, rate_limited: rateLimited.length },
  };
}

// Test 4: Attack Spam — repeated failed attacks escalate heat until a Tem
// challenge fires. The old test sent only 6 attacks (one +15 burst) and never
// crossed the 30 threshold, so no challenge could ever arrive.
async function testAttackSpam(): Promise<TestResult> {
  console.log('[attack_spam] Testing attack spam heat escalation...');

  const ws = await connectWs();
  await sendAndWait(ws, { type: 'login', guest_token: null }, 'login_ack');
  await sendAndWait(ws, { type: 'enter_world' }, 'world_state');

  let temChallengeReceived = false;
  const temHandler = (data: Buffer) => {
    let msg: { type?: string };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === 'tem_challenge') {
      temChallengeReceived = true;
      console.log('[attack_spam] Tem challenge received (heat escalated)');
    }
  };
  ws.on('message', temHandler);

  // Send enough failed attacks to push cumulative heat past HEAT_TEM_THRESHOLD,
  // plus one extra burst of margin for heat decay/timing. Derived from the
  // threshold so this stays correct if the balance constant changes.
  const burstsNeeded = Math.ceil(HEAT_TEM_THRESHOLD / ATTACK_SPAM_HEAT_PER_BURST);
  const attacksToSend = (burstsNeeded + 1) * FAILURES_PER_BURST;
  for (let i = 0; i < attacksToSend; i++) {
    ws.send(JSON.stringify({ type: 'attack_intent', target_id: 'invalid_target' }));
    await sleep(100);
  }

  // Wait for Tem challenge
  await sleep(2000);

  ws.off('message', temHandler);
  ws.close();

  const passed = temChallengeReceived;

  return {
    scenario: 'attack_spam',
    passed,
    message: passed
      ? `✅ Attack spam detection working: heat escalated, Tem challenge issued (${attacksToSend} failed attacks)`
      : `❌ Attack spam detection failed: no Tem challenge after ${attacksToSend} failed attacks`,
    details: { failed_attacks: attacksToSend, tem_challenge_received: temChallengeReceived },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const scenarioArg = args.find((a) => a.startsWith('--scenario='))?.split('=')[1];

  const scenarios = {
    ip_flood: testIpFlood,
    move_spam: testMoveSpam,
    chat_spam: testChatSpam,
    attack_spam: testAttackSpam,
  };

  const results: TestResult[] = [];

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Rate Limit Verification Tool (Plan B)                       ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Target: ${WS_URL.padEnd(53)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (scenarioArg && scenarioArg in scenarios) {
    console.log(`Running single scenario: ${scenarioArg}\n`);
    const result = await scenarios[scenarioArg as keyof typeof scenarios]();
    results.push(result);
  } else {
    console.log('Running all scenarios...\n');
    for (const [name, test] of Object.entries(scenarios)) {
      console.log(`\n--- ${name} ---`);
      try {
        const result = await test();
        results.push(result);
      } catch (err) {
        console.error(`[${name}] Error: ${(err as Error).message}`);
        results.push({
          scenario: name,
          passed: false,
          message: `❌ Test crashed: ${(err as Error).message}`,
        });
      }
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Results                                                     ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  for (const result of results) {
    console.log(`║  ${result.message.padEnd(61)}║`);
  }
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const allPassed = results.every((r) => r.passed);
  if (allPassed) {
    console.log('\n✅ All rate limit tests passed\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some rate limit tests failed\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
