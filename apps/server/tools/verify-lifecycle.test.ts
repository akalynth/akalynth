#!/usr/bin/env tsx
/**
 * Regression test for the lifecycle verifier (issue #144).
 *
 * Proves the boot/shutdown ordering invariant that the 2026-06-05 audit found
 * violated on the beta chain ("double server_boot without intervening
 * server_shutdown"). Drives the real `tools/verify-lifecycle.ts` against
 * synthetic chains via AKALYNTH_RECEIPT_CHAIN_PATH and asserts exit codes:
 *   0 = PASS (ordering valid)   1 = FAIL (violation)   2 = error (bad input)
 *
 * The verifier checks action/sequence ordering only (no signatures), so the
 * fixtures need just `sequence` + `action`. Run: `npm run test:lifecycle`.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(toolsDir, '..');

/** Minimal receipt: the verifier only reads `sequence` and `action`. */
function receipt(sequence: number, action: string): Record<string, unknown> {
  return {
    sequence,
    timestamp: new Date(sequence * 1000).toISOString(),
    prev_hash: 'blake3:test',
    event_hash: 'blake3:test',
    signature: 'test',
    actor_id: 'server',
    action,
    inputs: {},
    result: 'ok',
    inputs_hash: 'blake3:test',
    outputs_hash: 'blake3:test',
  };
}

interface Case {
  name: string;
  expectExit: number;
  lines: Array<Record<string, unknown>>;
}

const cases: Case[] = [
  {
    name: 'clean boot -> shutdown',
    expectExit: 0,
    lines: [receipt(1, 'server_boot'), receipt(2, 'server_heartbeat'), receipt(3, 'server_shutdown')],
  },
  {
    name: 'clean restart (boot, shutdown, boot, shutdown)',
    expectExit: 0,
    lines: [
      receipt(1, 'server_boot'),
      receipt(2, 'server_shutdown'),
      receipt(3, 'server_boot'),
      receipt(4, 'server_shutdown'),
    ],
  },
  {
    name: 'missing shutdown is not a violation (boot only)',
    expectExit: 0,
    lines: [receipt(1, 'server_boot'), receipt(2, 'server_heartbeat')],
  },
  {
    name: 'double server_boot without intervening shutdown',
    expectExit: 1,
    lines: [receipt(1, 'server_boot'), receipt(2, 'server_boot')],
  },
  {
    name: 'server_shutdown before server_boot',
    expectExit: 1,
    lines: [receipt(1, 'server_shutdown')],
  },
  {
    name: 'server receipt before server_boot',
    expectExit: 1,
    lines: [receipt(1, 'server_heartbeat'), receipt(2, 'server_boot')],
  },
];

function runVerifier(chainFile: string): number {
  const res = spawnSync('npx', ['--no-install', 'tsx', 'tools/verify-lifecycle.ts'], {
    cwd: serverDir,
    env: { ...process.env, AKALYNTH_RECEIPT_CHAIN_PATH: chainFile, NODE_ENV: 'test' },
    encoding: 'utf8',
  });
  if (res.error) {
    console.error(`  spawn error: ${String(res.error)}`);
    return -1;
  }
  return res.status ?? -1;
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akalynth-lifecycle-'));
let failed = 0;
try {
  for (const c of cases) {
    const file = path.join(tmpDir, `${c.name.replace(/\W+/g, '_')}.jsonl`);
    fs.writeFileSync(file, c.lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    const code = runVerifier(file);
    const passed = code === c.expectExit;
    console.log(`${passed ? 'PASS' : 'FAIL'}  [exit ${code}, want ${c.expectExit}]  ${c.name}`);
    if (!passed) failed++;
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`\n[verify-lifecycle.test] ${failed}/${cases.length} case(s) FAILED`);
  process.exit(1);
}
console.log(`\n[verify-lifecycle.test] all ${cases.length} cases passed`);
