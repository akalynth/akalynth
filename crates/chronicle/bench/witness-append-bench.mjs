#!/usr/bin/env node
/**
 * Step 0 evidence gate for the witness-kernel-rust migration.
 *
 * Proves the structural claim in references/OPTIMIZATION_PROPOSAL.md:
 * the retired spawn-per-event bridge was O(N²) (a fresh process + a full-log
 * read_tail scan per event), and the persistent in-process handle is O(N)
 * (last_hash kept in memory, one append per event).
 *
 * It does this by benchmarking three modes that all produce the SAME chronicle
 * line format (`prev_hash|event_hash|sig|canonical_json`, raw blake3 hex,
 * Ed25519 over `prev|event`, fsync per append) — see crates/chronicle/src/lib.rs:144:
 *
 *   1. spawn          — the retired baseline: spawnSync the built chronicle_append
 *                       binary once per event (process spawn + Rust read_tail rescan).
 *                       Auto-skips with build instructions if the binary is absent.
 *   2. inproc-rescan  — in-process, but re-reads the whole log each append to recover
 *                       last_hash (mimics read_tail). Isolates the O(N²) scan term with
 *                       NO process cost — so the quadratic is attributable to the rescan.
 *   3. inproc-handle  — the target model: last_hash + sequence in memory, O_APPEND only.
 *                       Should scale ~O(N).
 *
 * Comparing (2) vs (3) shows the rescan IS the quadratic term.
 * Comparing (1) vs (3) shows the full real-world win.
 *
 * SCOPE / HONESTY: this measures structural latency SCALING, which is transport-
 * and language-independent. The in-process modes use JS crypto (@noble/hashes blake3 +
 * node:crypto Ed25519), NOT the final Rust napi-rs addon. Byte-for-byte TS↔Rust
 * determinism parity is Step 1's job (a separate gate), not this benchmark's.
 *
 * Run where Node + (for mode 1) the built binary exist — e.g. ops-dev-01:
 *   cd crates/chronicle && cargo build --release # builds target/release/chronicle_append
 *   node crates/chronicle/bench/witness-append-bench.mjs
 *
 * Flags:
 *   --n 256,512,1024,2048   N sweep (default). Use doublings for a clean ratio read.
 *   --quick                 tiny sweep (64,128,256) for a smoke run.
 *   --no-spawn              skip the spawn baseline (e.g. binary not built).
 *   --max-spawn-n 1024      cap N for the spawn mode (process-per-event is slow).
 *   --no-fsync              drop the per-append fsync in the in-process modes.
 *   --bin <path>            override chronicle_append binary path.
 *   --json <path>           also write raw results as JSON for evidence capture.
 */

import { blake3 } from '@noble/hashes/blake3';
import stableStringify from 'fast-json-stable-stringify';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..'); // crates/chronicle/bench -> repo root

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = {
    n: [256, 512, 1024, 2048],
    spawn: true,
    maxSpawnN: 1024,
    fsync: true,
    bin: null,
    json: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--quick') a.n = [64, 128, 256];
    else if (k === '--no-spawn') a.spawn = false;
    else if (k === '--no-fsync') a.fsync = false;
    else if (k === '--n') a.n = argv[++i].split(',').map((x) => parseInt(x, 10));
    else if (k === '--max-spawn-n') a.maxSpawnN = parseInt(argv[++i], 10);
    else if (k === '--bin') a.bin = argv[++i];
    else if (k === '--json') a.json = argv[++i];
    else if (k === '--help' || k === '-h') { printHelp(); process.exit(0); }
    else { console.error(`unknown arg: ${k}`); process.exit(2); }
  }
  return a;
}

function printHelp() {
  console.log('witness-append-bench — Step 0 evidence gate (see header comment)');
  console.log('  --n A,B,C  --quick  --no-spawn  --max-spawn-n N  --no-fsync  --bin PATH  --json PATH');
}

// ---------------------------------------------------------------------------
// Chronicle line helpers (match crates/chronicle/src/lib.rs append())
// ---------------------------------------------------------------------------
const GENESIS = 'genesis';
const toHex = (u8) => Buffer.from(u8).toString('hex');
const blake3Hex = (s) => toHex(blake3(new TextEncoder().encode(s)));

function makeEvent(i) {
  // A representative witness event; shape mirrors the index.ts append payload.
  return {
    v: 1,
    world_id: 'akalynth-mainnet',
    tick: i,
    event_type: 'move',
    actor: `player:bench-${i % 32}`,
    payload: { x: i % 100, y: (i * 7) % 100, zone: 'azura' },
  };
}

// Append one line; returns the new event_hash. Mirrors lib.rs line format.
function appendLine(logPath, prevHash, event, signKey, doFsync) {
  const canonical = stableStringify(event);
  const eventHash = blake3Hex(canonical);
  const message = `${prevHash}|${eventHash}`;
  const sigHex = toHex(crypto.sign(null, Buffer.from(message), signKey));
  const line = `${prevHash}|${eventHash}|${sigHex}|${canonical}\n`;
  const fd = fs.openSync(logPath, 'a'); // O_APPEND
  try {
    fs.writeSync(fd, line);
    if (doFsync) fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return eventHash;
}

// Recover last_hash by scanning the whole log — mimics Rust read_tail() (lib.rs:269).
function readTail(logPath) {
  if (!fs.existsSync(logPath)) return GENESIS;
  const data = fs.readFileSync(logPath, 'utf8');
  let last = GENESIS;
  for (const raw of data.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split('|');
    if (parts.length >= 2) last = parts[1]; // event_hash column
  }
  return last;
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------
function runInprocHandle(logPath, n, signKey, doFsync) {
  let prev = GENESIS; // last_hash kept in memory — O(1) per event
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) prev = appendLine(logPath, prev, makeEvent(i), signKey, doFsync);
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

function runInprocRescan(logPath, n, signKey, doFsync) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) {
    const prev = readTail(logPath); // O(current length) scan EACH event -> O(N²) total
    appendLine(logPath, prev, makeEvent(i), signKey, doFsync);
  }
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

function runSpawn(logPath, keyPath, n, bin) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) {
    const canonical = stableStringify(makeEvent(i));
    const proc = spawnSync(bin, ['--log', logPath, '--key', keyPath], { input: canonical, encoding: 'utf8' });
    if (proc.status !== 0) throw new Error(`chronicle_append failed: ${proc.stderr?.trim() || '(no stderr)'}`);
  }
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

// ---------------------------------------------------------------------------
// Binary discovery (matches chronicleAdapter.ts defaultBinPath)
// ---------------------------------------------------------------------------
function findBin(override) {
  if (override) return fs.existsSync(override) ? override : null;
  const candidates = [
    path.join(REPO_ROOT, 'target/release/chronicle_append'),
    path.join(REPO_ROOT, 'crates/chronicle/target/release/chronicle_append'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function scalingVerdict(rows) {
  // For each mode, ratio of total time between successive (doubling) N.
  // ~2x => linear (O(N)); ~4x => quadratic (O(N²)).
  const byMode = {};
  for (const r of rows) (byMode[r.mode] ??= []).push(r);
  const out = [];
  for (const [mode, list] of Object.entries(byMode)) {
    list.sort((a, b) => a.n - b.n);
    const ratios = [];
    for (let i = 1; i < list.length; i++) {
      if (list[i - 1].totalMs > 0) ratios.push(list[i].totalMs / list[i - 1].totalMs);
    }
    const avg = ratios.length ? ratios.reduce((s, x) => s + x, 0) / ratios.length : NaN;
    let verdict = 'n/a';
    if (!Number.isNaN(avg)) verdict = avg >= 3.0 ? '~O(N²) quadratic' : avg <= 2.6 ? '~O(N) linear' : 'super-linear';
    out.push({ mode, doublingRatios: ratios.map((x) => x.toFixed(2)), avgRatio: Number.isNaN(avg) ? 'n/a' : avg.toFixed(2), verdict });
  }
  return out;
}

function printTable(rows) {
  const pad = (s, w) => String(s).padEnd(w);
  const padL = (s, w) => String(s).padStart(w);
  console.log('\n  mode            |      N |   total ms | µs/append');
  console.log('  ----------------+--------+------------+----------');
  for (const r of rows) {
    console.log(
      `  ${pad(r.mode, 15)} | ${padL(r.n, 6)} | ${padL(r.totalMs.toFixed(1), 10)} | ${padL(((r.totalMs * 1000) / r.n).toFixed(1), 8)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv);
  const { privateKey: signKey } = crypto.generateKeyPairSync('ed25519');

  const bin = args.spawn ? findBin(args.bin) : null;
  if (args.spawn && !bin) {
    console.log('\n  [spawn baseline SKIPPED] chronicle_append binary not found.');
    console.log('  Build it where cargo is available (e.g. ops-dev-01):');
    console.log('    cd crates/chronicle && cargo build --release');
    console.log('  …then re-run, or pass --bin <path>. Continuing with in-process modes only.\n');
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'witness-bench-'));
  const rows = [];
  try {
    for (const n of args.n) {
      // inproc-handle (proposed O(N))
      {
        const log = path.join(tmp, `handle-${n}.log`);
        rows.push({ mode: 'inproc-handle', n, totalMs: runInprocHandle(log, n, signKey, args.fsync) });
      }
      // inproc-rescan (isolates O(N²) scan)
      {
        const log = path.join(tmp, `rescan-${n}.log`);
        rows.push({ mode: 'inproc-rescan', n, totalMs: runInprocRescan(log, n, signKey, args.fsync) });
      }
      // spawn (real baseline) — capped, can be slow
      if (bin && n <= args.maxSpawnN) {
        const log = path.join(tmp, `spawn-${n}.log`);
        const key = path.join(tmp, `spawn-${n}.key`);
        rows.push({ mode: 'spawn', n, totalMs: runSpawn(log, key, n, bin) });
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  printTable(rows);

  console.log('\n  scaling (total-time ratio per N-doubling; ~2x=linear, ~4x=quadratic):');
  const verdicts = scalingVerdict(rows);
  for (const v of verdicts) {
    console.log(`    ${v.mode.padEnd(15)} ratios=[${v.doublingRatios.join(', ')}] avg=${v.avgRatio}  => ${v.verdict}`);
  }

  console.log('\n  Expectation if the proposal holds:');
  console.log('    inproc-rescan => ~O(N²)   (proves read_tail per event is the quadratic term)');
  console.log('    inproc-handle => ~O(N)    (the proposed persistent-handle model)');
  console.log('    spawn         => ~O(N²) and dominated by process startup (the real baseline)\n');

  if (args.json) {
    const payload = { sweep: args.n, fsync: args.fsync, spawnBin: bin, rows, scaling: verdicts };
    fs.writeFileSync(args.json, JSON.stringify(payload, null, 2));
    console.log(`  raw results written to ${args.json}\n`);
  }
}

main();
