#!/usr/bin/env tsx
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const tsx = path.join(repoRoot, 'node_modules/.bin/tsx');
const server = path.join(repoRoot, 'apps/server/src/index.ts');
const env = {
  ...process.env,
  NODE_ENV: 'test',
  AKALYNTH_BETA_REQUIRE_INVITE: '1',
};
delete env.AKALYNTH_BETA_ACTIVE_RELEASE_MANIFEST;

const result = spawnSync(tsx, [server], {
  cwd: repoRoot,
  env,
  encoding: 'utf8',
  timeout: 5_000,
});

assert.equal(result.signal, null, result.error?.message);
assert.notEqual(result.status, 0);
assert.match(
  result.stderr,
  /AKALYNTH_BETA_ACTIVE_RELEASE_MANIFEST is required when invite enforcement is enabled/,
);

console.log(
  '[verify-beta-active-release] PASS: invite-enforced startup fails before runtime initialization without an active manifest',
);
