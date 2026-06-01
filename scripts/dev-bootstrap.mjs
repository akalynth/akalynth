#!/usr/bin/env node
// Local dev bootstrap: ensure a chronicle signing key exists so the server can
// boot on a fresh clone.
//
// The receipt logger requires a 32-byte Ed25519 seed at the chronicle key path
// (CHRONICLE_KEY_PATH, or apps/server/chronicle.key by default). Without it the
// server exits with "Signing key not found". This mirrors the canonical
// production method documented in docs/NEW_BOX_PROVISIONING.md
// (`head -c 32 /dev/urandom > chronicle.key`), pointed at the dev location.
//
// This key is LOCAL-DEV ONLY: it is gitignored and must never be reused for a
// real deployment. Production keys are minted out-of-band per NEW_BOX_PROVISIONING.
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, chmodSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Match the server's resolution: CHRONICLE_KEY_PATH wins, else the cwd-default
// when dev runs from apps/server (apps/server/chronicle.key).
const keyPath = process.env.CHRONICLE_KEY_PATH
  ? resolve(repoRoot, process.env.CHRONICLE_KEY_PATH)
  : resolve(repoRoot, 'apps/server/chronicle.key');

if (existsSync(keyPath)) {
  const bytes = statSync(keyPath).size;
  if (bytes !== 32) {
    console.error(`[dev-bootstrap] Existing key at ${keyPath} is ${bytes} bytes, expected 32. Remove it and re-run.`);
    process.exit(1);
  }
  console.log(`[dev-bootstrap] Chronicle key already present: ${keyPath}`);
} else {
  writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });
  chmodSync(keyPath, 0o600);
  console.log(`[dev-bootstrap] Generated local dev chronicle key (32-byte seed, mode 0600): ${keyPath}`);
  console.log('[dev-bootstrap] This key is local-only and gitignored. Do NOT use it for a real deployment.');
}

console.log('');
console.log('[dev-bootstrap] Ready. First boot creates the genesis receipt chain:');
console.log('    npm run dev:server:fresh      # bootstrap + start server (first run)');
console.log('    npm run dev:server            # subsequent runs');
