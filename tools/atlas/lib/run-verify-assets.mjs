#!/usr/bin/env node
/**
 * Spawn npm run verify:assets (tsx tools/asset-gen/verify-assets.ts).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from './paths.mjs';

function resolveVerifyCommand() {
  let dir = REPO_ROOT;
  for (let depth = 0; depth < 6; depth += 1) {
    const tsx = join(dir, 'node_modules/.bin/tsx');
    if (existsSync(tsx)) {
      return { cmd: tsx, args: ['tools/asset-gen/verify-assets.ts'] };
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { cmd: 'npx', args: ['tsx', 'tools/asset-gen/verify-assets.ts'] };
}

export function runVerifyAssets() {
  const { cmd, args } = resolveVerifyCommand();
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}