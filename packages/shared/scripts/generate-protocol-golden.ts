#!/usr/bin/env npx tsx
/**
 * Generate Protocol Golden Snapshot
 *
 * Extracts the current protocol surface and writes to protocol.golden.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateGoldenSnapshot } from '../../verification-spine/src/protocol/extractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

const PROTOCOL_PATH = path.join(REPO_ROOT, 'packages/shared/protocol.ts');
const TSCONFIG_PATH = path.join(REPO_ROOT, 'packages/shared/tsconfig.json');
const GOLDEN_PATH = path.join(REPO_ROOT, 'packages/shared/protocol.golden.json');

function main(): void {
  console.log('[protocol:golden] Generating golden snapshot...');
  console.log(`[protocol:golden] Protocol: ${PROTOCOL_PATH}`);
  console.log(`[protocol:golden] TSConfig: ${TSCONFIG_PATH}`);

  let golden;
  try {
    golden = generateGoldenSnapshot(PROTOCOL_PATH, TSCONFIG_PATH);
  } catch (err: any) {
    console.error('[protocol:golden] ERROR: Failed to extract protocol surface');
    console.error(err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }

  // Golden metadata must be stable across worktrees and machines.
  golden.source.path = path.relative(REPO_ROOT, PROTOCOL_PATH).split(path.sep).join('/');

  // Write golden snapshot
  fs.writeFileSync(GOLDEN_PATH, JSON.stringify(golden, null, 2) + '\n', 'utf-8');

  console.log(`[protocol:golden] ✅ Golden snapshot written to ${GOLDEN_PATH}`);
  console.log(`[protocol:golden] Version: ${golden.version}`);
  console.log(`[protocol:golden] Client messages: ${Object.keys(golden.surface.messages.client).length}`);
  console.log(`[protocol:golden] Server messages: ${Object.keys(golden.surface.messages.server).length}`);
  console.log(`[protocol:golden] Type aliases: ${Object.keys(golden.surface.typeAliases).length}`);
  console.log(`[protocol:golden] Shared types: ${Object.keys(golden.surface.sharedTypes).length}`);
  console.log(`[protocol:golden] Guards: ${golden.surface.guards.length}`);
}

main();
