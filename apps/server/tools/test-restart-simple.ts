#!/usr/bin/env tsx
/**
 * Simple test for Seal 2.2: Restart Continuity
 *
 * Tests that chain heads are rebuilt from chronicle.log on server restart.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { WebSocket } from 'ws';

const CHRONICLE_LOG = path.join(process.cwd(), 'chronicle.log');
const PLAYER_ID = 'restart-test-player';

interface ChronicleEvent {
  actor: string;
  event_type: string;
  payload: {
    prev_event_hash: string;
    event_hash: string;
    [key: string]: unknown;
  };
}

function readChronicle(): ChronicleEvent[] {
  if (!fs.existsSync(CHRONICLE_LOG)) return [];
  const content = fs.readFileSync(CHRONICLE_LOG, 'utf8');
  return content
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as ChronicleEvent);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let serverOutput = '';

async function startServer(): Promise<ChildProcess> {
  serverOutput = '';
  const server = spawn('npx', ['tsx', 'src/index.ts'], {
    env: {
      ...process.env,
      ENABLE_CHRONICLE: '1',
      ALLOW_INSECURE_LOCAL: '1',
      REQUIRE_TLS: '0',
      PERSIST_REPLAY_MODE: 'lenient',  // Skip bad receipts
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd(),
    detached: true,
  });

  // Wait for server to be ready
  let output = '';
  let serverReady = false;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Server start timeout. Output:\n${output}`));
    }, 15000);

    server.on('exit', (code, signal) => {
      if (!serverReady) {
        clearTimeout(timeout);
        reject(new Error(`Server exited early (code=${code}, signal=${signal}). Output:\n${output}`));
      }
    });

    server.stdout?.on('data', (data) => {
      output += data.toString();
      serverOutput += data.toString();
      if (output.includes('WS: ws://localhost:3000') && !serverReady) {
        serverReady = true;
        clearTimeout(timeout);
        resolve(server);
      }
    });

    server.stderr?.on('data', (data) => {
      output += data.toString();
      serverOutput += data.toString();
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function stopServer(server: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    server.on('exit', finish);

    try {
      process.kill(-server.pid!, 'SIGTERM');
    } catch (e) {
      // Process group already dead
      finish();
      return;
    }

    setTimeout(() => {
      try {
        process.kill(-server.pid!, 'SIGKILL');
      } catch (e) {
        // Already dead
      }
      finish();
    }, 3000);
  });
}

async function doPlayerSession(playerId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3000');
    let done = false;

    const finish = () => {
      if (!done) {
        done = true;
        try { ws.close(); } catch (e) { /* ignore */ }
        setTimeout(resolve, 300);
      }
    };

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'login', username: playerId, password: 'test' }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const preview = JSON.stringify(msg).slice(0, 150);
        console.log(`  [${playerId}] <- ${msg.type}: ${preview}`);

        if (msg.type === 'login_ack' && msg.ok) {
          console.log(`  [${playerId}] -> enter_world`);
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'enter_world', map: 'Rookguard' }));
          }, 50);
        } else if (msg.type === 'spawn') {
          console.log(`  [${playerId}] -> move_intent east`);
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'move_intent', direction: 'east' }));
          }, 50);
        } else if (msg.type === 'move_result') {
          console.log(`  [${playerId}] move ok=${msg.ok}`);
          setTimeout(finish, 100);
        } else if (msg.type === 'error') {
          console.log(`  [${playerId}] error:`, msg.message);
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    });

    ws.on('error', (err) => {
      if (!done) {
        done = true;
        reject(err);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`  [${playerId}] ws closed: code=${code}`);
      if (!done) {
        done = true;
        setTimeout(resolve, 300);
      }
    });

    // Timeout
    setTimeout(() => {
      if (!done) {
        console.log(`  [${playerId}] timeout - closing`);
        finish();
      }
    }, 8000);
  });
}

async function main() {
  console.log('=== Seal 2.2: Restart Continuity Test ===\n');

  // Clean up
  if (fs.existsSync(CHRONICLE_LOG)) {
    fs.unlinkSync(CHRONICLE_LOG);
    console.log('[setup] Removed existing chronicle.log');
  }

  // Kill any existing server
  try {
    const { execSync } = await import('node:child_process');
    execSync('pkill -9 -f "tsx.*index" 2>/dev/null || true', { stdio: 'ignore' });
    await sleep(1000);
  } catch (e) {
    // Ignore
  }

  // === Phase 1: First server run ===
  console.log('\n[phase 1] Starting server (first run)...');
  let server1: ChildProcess;
  try {
    server1 = await startServer();
  } catch (err) {
    console.error('[FAIL] Server failed to start:', (err as Error).message);
    process.exit(1);
  }
  console.log('[phase 1] Server started');

  // Wait for server to stabilize
  await sleep(500);

  // Connect and do actions
  console.log('[phase 1] Player session...');
  try {
    await doPlayerSession(PLAYER_ID);
  } catch (err) {
    console.error('[phase 1] Session error:', (err as Error).message);
  }

  // Wait for server to write events
  await sleep(1000);

  // Stop server
  console.log('[phase 1] Stopping server...');
  await stopServer(server1);
  await sleep(1000);
  console.log('[phase 1] Server stopped');

  // Check chronicle
  const allEvents = readChronicle();
  console.log(`[phase 1] Total chronicle events: ${allEvents.length}`);

  if (allEvents.length === 0) {
    console.error('[FAIL] No chronicle events found');
    console.error('[server output (last 2000 chars)]:', serverOutput.slice(-2000));
    process.exit(1);
  }

  // Filter for our player (actor includes the username since login uses it to generate DID)
  const events1 = allEvents.filter((e) => e.actor.includes(PLAYER_ID));
  console.log(`[phase 1] Chronicle events for player: ${events1.length}`);

  // For debugging: show what actors exist
  if (events1.length === 0) {
    const actors = [...new Set(allEvents.map(e => e.actor))];
    console.log('[debug] Actors in chronicle:', actors);
  }

  if (events1.length === 0) {
    console.error('[FAIL] No chronicle events for our player');
    process.exit(1);
  }

  // Print events
  for (const e of events1) {
    console.log(`  ${e.event_type}: prev=${e.payload.prev_event_hash.slice(0, 20)}...`);
  }

  // Verify chain starts from genesis
  if (events1[0].payload.prev_event_hash !== 'genesis') {
    console.error('[FAIL] First event should have prev_event_hash=genesis');
    process.exit(1);
  }
  console.log('[phase 1] Chain starts from genesis - OK');

  const lastEventHash1 = events1[events1.length - 1].payload.event_hash;
  console.log(`[phase 1] Last event hash: ${lastEventHash1.slice(0, 30)}...`);

  // === Phase 2: Server restart ===
  console.log('\n[phase 2] Starting server (restart)...');
  let server2: ChildProcess;
  try {
    server2 = await startServer();
  } catch (err) {
    console.error('[FAIL] Server restart failed:', (err as Error).message);
    process.exit(1);
  }
  console.log('[phase 2] Server restarted');

  await sleep(500);

  // Connect same player
  console.log('[phase 2] Player session...');
  try {
    await doPlayerSession(PLAYER_ID);
  } catch (err) {
    console.error('[phase 2] Session error:', (err as Error).message);
  }

  await sleep(1000);

  console.log('[phase 2] Stopping server...');
  await stopServer(server2);
  await sleep(500);
  console.log('[phase 2] Server stopped');

  // Check chronicle continuation
  const events2 = readChronicle().filter((e) => e.actor.includes(PLAYER_ID));
  console.log(`\n[phase 2] Total chronicle events: ${events2.length}`);

  if (events2.length <= events1.length) {
    console.error('[FAIL] No new events after restart');
    process.exit(1);
  }

  // Find first event after restart
  const newEvents = events2.slice(events1.length);
  const firstNewEvent = newEvents[0];

  console.log(`[phase 2] First event after restart: ${firstNewEvent.event_type}`);
  console.log(`[phase 2] prev_event_hash: ${firstNewEvent.payload.prev_event_hash.slice(0, 30)}...`);
  console.log(`[phase 2] Expected (last from phase 1): ${lastEventHash1.slice(0, 30)}...`);

  if (firstNewEvent.payload.prev_event_hash === lastEventHash1) {
    console.log('\n✓ PASS: Chain continued correctly after restart!');
  } else if (firstNewEvent.payload.prev_event_hash === 'genesis') {
    console.error('\n✗ FAIL: Chain forked to genesis (chain heads NOT rebuilt)');
    process.exit(1);
  } else {
    console.error('\n✗ FAIL: Unexpected prev_event_hash');
    process.exit(1);
  }

  // Verify full chain
  console.log('\n[verify] Full chain integrity...');
  let prevHash = 'genesis';
  for (let i = 0; i < events2.length; i++) {
    const e = events2[i];
    if (e.payload.prev_event_hash !== prevHash) {
      console.error(`[FAIL] Chain broken at event ${i}`);
      process.exit(1);
    }
    prevHash = e.payload.event_hash;
  }
  console.log('[verify] Full chain integrity OK');

  console.log('\n=== All tests passed! ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
