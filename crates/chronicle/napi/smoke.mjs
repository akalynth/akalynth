/**
 * Step 2 smoke test for the napi addon loader: load the built `.node` through loader.cjs, append
 * two events + verify the chain in a temp dir. Exits non-zero on any failure. Invoked by
 * run-step2.sh after the build.
 *
 *   node crates/chronicle/napi/smoke.mjs <path-to-chronicle-native.node>
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const nodePath = process.argv[2];
if (!nodePath) {
  console.error('usage: node smoke.mjs <path-to-chronicle-native.node>');
  process.exit(2);
}

process.env.CHRONICLE_NATIVE_PATH = path.resolve(nodePath);
const { openChronicle, openHashPrimitive } = require(path.join(path.dirname(new URL(import.meta.url).pathname), 'loader.cjs'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chronicle-napi-smoke-'));
try {
  const log = path.join(tmp, 'chronicle.log');
  const key = path.join(tmp, 'chronicle.key');

  const h = openChronicle({ logPath: log, keyPath: key });
  if (h.mode !== 'native') throw new Error(`expected native mode, got ${h.mode}`);

  const hash = openHashPrimitive();
  if (!hash) throw new Error('expected native hash primitive');
  if (hash.blake3HexUtf8('abc') !== hash.blake3HexBytes(Buffer.from('abc'))) {
    throw new Error('UTF-8 and byte BLAKE3 exports disagree for abc');
  }

  const r1 = h.append({ tick: 1, event_type: 'spawn', actor: 'player:smoke' });
  const r2 = h.append({ tick: 2, event_type: 'move', actor: 'player:smoke' });

  if (r1.prev_hash !== 'genesis') throw new Error(`first prev_hash should be genesis, got ${r1.prev_hash}`);
  if (r2.prev_hash !== r1.event_hash) throw new Error('chain link broken: r2.prev_hash != r1.event_hash');

  const v = h.verify();
  if (!v.valid || Number(v.entries) !== 2) throw new Error(`verify failed: ${JSON.stringify(v)}`);
  if (Number(h.sequence) !== 2) throw new Error(`sequence should be 2, got ${h.sequence}`);

  console.log(`napi loader smoke OK — 2 entries, seq=${h.sequence}, valid=${v.valid}, pubkey=${String(v.pubkey).slice(0, 16)}…`);
} catch (e) {
  console.error(`napi smoke FAILED: ${e.message}`);
  process.exit(1);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
