#!/usr/bin/env tsx
/**
 * test-receipts-chain.ts — Test harness for verify-receipts-chain.ts
 *
 * Runs the verifier against each committed fixture and asserts:
 * - exit code (0 pass / 1 fail)
 * - the expected failure reason substring is printed (for tamper cases)
 * - the valid chain passes WITH signature verification (test.key present)
 *
 * Usage: tsx tools/test-receipts-chain.ts
 * Exit 0 if all cases pass, 1 otherwise.
 */
/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(SERVER_ROOT, 'fixtures', 'receipts-chain');
const VERIFIER = path.join(SERVER_ROOT, 'tools', 'verify-receipts-chain.ts');

// The fixtures are signed with a deterministic test seed (32 × 0x42).
// We never commit the raw key seed (repo policy: no tracked *.key); instead we
// materialize it to a temp file at test time so the signature path runs.
const TEST_SEED = Buffer.alloc(32, 0x42);
const TEST_KEY = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'receipts-chain-')), 'test.key');
fs.writeFileSync(TEST_KEY, TEST_SEED, { mode: 0o600 });

interface Case {
  name: string;
  fixture: string;
  withKey: boolean;
  expectExit: number;
  expectStdout?: string; // substring on success path
  expectReason?: string; // substring on failure path
}

const CASES: Case[] = [
  {
    name: 'valid-chain passes with signatures verified',
    fixture: 'valid-chain.jsonl',
    withKey: true,
    expectExit: 0,
    expectStdout: 'signatures verified: 3/3',
  },
  {
    name: 'valid-chain passes keyless (signatures skipped)',
    fixture: 'valid-chain.jsonl',
    withKey: false,
    expectExit: 0,
    expectStdout: 'signatures NOT checked (no key)',
  },
  {
    name: 'tampered-prev-hash fails on chain linkage',
    fixture: 'tampered-prev-hash.jsonl',
    withKey: true,
    expectExit: 1,
    expectReason: 'chain link broken between sequence 1 and 2',
  },
  {
    name: 'tampered-event-hash fails on event_hash',
    fixture: 'tampered-event-hash.jsonl',
    withKey: true,
    expectExit: 1,
    expectReason: 'event_hash_mismatch',
  },
  {
    name: 'tampered-inputs fails on inputs_hash',
    fixture: 'tampered-inputs.jsonl',
    withKey: true,
    expectExit: 1,
    expectReason: 'inputs_hash_mismatch',
  },
  {
    name: 'non-genesis-first fails on genesis check',
    fixture: 'non-genesis-first.jsonl',
    withKey: true,
    expectExit: 1,
    expectReason: 'is not genesis',
  },
];

function run(c: Case): { ok: boolean; detail: string } {
  const env = { ...process.env };
  if (c.withKey) {
    env.CHRONICLE_KEY_PATH = TEST_KEY;
  } else {
    delete env.CHRONICLE_KEY_PATH;
    delete env.AKALYNTH_RECEIPT_CHAIN_PATH;
  }

  const fixturePath = path.join(FIXTURE_DIR, c.fixture);
  const res = spawnSync('npx', ['tsx', VERIFIER, fixturePath], {
    cwd: SERVER_ROOT,
    encoding: 'utf-8',
    env,
  });

  const out = (res.stdout || '') + (res.stderr || '');

  if (res.status !== c.expectExit) {
    return { ok: false, detail: `expected exit ${c.expectExit}, got ${res.status}\n${out}` };
  }
  if (c.expectStdout && !out.includes(c.expectStdout)) {
    return { ok: false, detail: `expected stdout to contain "${c.expectStdout}"\n${out}` };
  }
  if (c.expectReason && !out.includes(c.expectReason)) {
    return { ok: false, detail: `expected failure reason "${c.expectReason}"\n${out}` };
  }
  return { ok: true, detail: '' };
}

function main(): void {
  let failed = 0;
  for (const c of CASES) {
    const { ok, detail } = run(c);
    if (ok) {
      console.log(`  PASS  ${c.name}`);
    } else {
      failed++;
      console.error(`  FAIL  ${c.name}`);
      console.error(`        ${detail.replace(/\n/g, '\n        ')}`);
    }
  }
  console.log('');
  if (failed > 0) {
    console.error(`[test:receipts-chain] ${failed}/${CASES.length} cases FAILED`);
    process.exit(1);
  }
  console.log(`[test:receipts-chain] all ${CASES.length} cases passed`);
  process.exit(0);
}

main();
