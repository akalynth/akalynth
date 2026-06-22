#!/usr/bin/env node
/**
 * TS-side oracle for the Step 1 determinism parity gate (witness-kernel-rust).
 *
 * Reads parity/vectors.json, and for each vector computes:
 *   canonical_json = fast-json-stable-stringify(input)   (recursive key sort, compact)
 *   blake3_hex     = hex(blake3(utf8(canonical_json)))    (raw hex, NO "blake3:" prefix)
 * then writes parity/golden.json keyed by vector name.
 *
 * The Rust test (crates/chronicle/tests/parity.rs) computes the SAME two values via the
 * crate's `canonical_json` + `blake3_hex` and asserts byte-for-byte equality with this golden.
 * Divergence => the chain would fork across languages => the gate fails. That is the point.
 *
 * AUTHORITY NOTE: keep this oracle identical to packages/shared/hashPrimitive.ts:
 * canonical JSON + raw BLAKE3 hex. The "blake3:" prefix, domain prefixes, and
 * field-stripping wrappers live above that shared core.
 *
 * Run:  node crates/chronicle/parity/gen-golden.mjs        (regenerates golden.json)
 *       node crates/chronicle/parity/gen-golden.mjs --check (fails if golden.json is stale)
 */

import { blake3 } from '@noble/hashes/blake3';
import stableStringify from 'fast-json-stable-stringify';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VECTORS = path.join(HERE, 'vectors.json');
const GOLDEN = path.join(HERE, 'golden.json');

// --- shared determinism core (MUST equal persist/hash.ts + index.ts primitives) ---
const canonicalJson = (x) => stableStringify(x);
const blake3HexUtf8 = (s) => Buffer.from(blake3(new TextEncoder().encode(s))).toString('hex');

function build() {
  const { vectors } = JSON.parse(fs.readFileSync(VECTORS, 'utf8'));
  const golden = {};
  for (const v of vectors) {
    const canonical = canonicalJson(v.input);
    golden[v.name] = { canonical_json: canonical, blake3_hex: blake3HexUtf8(canonical) };
  }
  // Stable, sorted, newline-terminated JSON so the file is diff-friendly and itself deterministic.
  // Sort only top-level vector names; a JSON.stringify replacer array would also filter nested
  // `canonical_json` / `blake3_hex` fields out of every golden entry.
  const sorted = Object.fromEntries(Object.entries(golden).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify(sorted, null, 2) + '\n';
}

const check = process.argv.includes('--check');
const next = build();

if (check) {
  const cur = fs.existsSync(GOLDEN) ? fs.readFileSync(GOLDEN, 'utf8') : '';
  if (cur !== next) {
    console.error('PARITY GOLDEN STALE: vectors.json changed but golden.json was not regenerated.');
    console.error('  Run: node crates/chronicle/parity/gen-golden.mjs');
    process.exit(1);
  }
  console.log('golden.json is up to date.');
} else {
  fs.writeFileSync(GOLDEN, next);
  const n = Object.keys(JSON.parse(next)).length;
  console.log(`wrote ${GOLDEN} (${n} vectors). Now run: cd crates/chronicle && cargo test --test parity`);
}
