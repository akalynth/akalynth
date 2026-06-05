#!/usr/bin/env tsx
/**
 * Lifecycle verifier regression against committed fixtures (issue #146).
 *
 * Runs `verify-lifecycle.ts --receipts <fixture>` and asserts the verifier
 * PASSES on a clean boot/shutdown chain and FAILS on a double-boot chain —
 * proving the double-boot detection the 2026-06-05 audit flagged actually
 * works (CI previously only ran the verifier on *good* generated fixtures).
 *
 * No server, signing key, DB, or chronicle required. Run in CI on every push.
 *   npm run test:lifecycle-fixtures
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(toolsDir, '..');
const fixture = (name: string): string => path.join('tools', 'fixtures', 'lifecycle', name);

function runVerifier(fixturePath: string): number {
  const res = spawnSync('npx', ['--no-install', 'tsx', 'tools/verify-lifecycle.ts', '--receipts', fixturePath], {
    cwd: serverDir,
    encoding: 'utf8',
  });
  if (res.error) {
    console.error(`  spawn error: ${String(res.error)}`);
    return -1;
  }
  return res.status ?? -1;
}

interface Case {
  name: string;
  fixture: string;
  expectExit: number;
}

const cases: Case[] = [
  { name: 'good fixture (clean boot/shutdown) PASSES', fixture: fixture('good.jsonl'), expectExit: 0 },
  { name: 'double-boot fixture FAILS', fixture: fixture('double-boot.jsonl'), expectExit: 1 },
];

let failed = 0;
for (const c of cases) {
  const code = runVerifier(c.fixture);
  const passed = code === c.expectExit;
  console.log(`${passed ? 'PASS' : 'FAIL'}  [exit ${code}, want ${c.expectExit}]  ${c.name}`);
  if (!passed) failed++;
}

if (failed > 0) {
  console.error(`\n[verify-lifecycle-fixtures.test] ${failed}/${cases.length} case(s) FAILED`);
  process.exit(1);
}
console.log(`\n[verify-lifecycle-fixtures.test] all ${cases.length} cases passed`);
