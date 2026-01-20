#!/usr/bin/env npx tsx
/**
 * generate-ci-fixture.ts
 *
 * Generates a deterministic, signed receipts.jsonl fixture for CI.
 * Uses real audit logger + signer (Ed25519) via createAuditLogger().
 *
 * Env:
 *   - AKALYNTH_RECEIPT_CHAIN_PATH (primary) -> fixtures/ci-chain.jsonl in CI
 *   - CHRONICLE_KEY_PATH (signing key)
 *
 * Exit codes:
 *   0 - success
 *   2 - error
 */

import fs from 'node:fs';
import path from 'node:path';
import { createAuditLogger } from '../src/audit/logger.js';
import { resolveChainPaths, validateKeyFile } from '../../../packages/shared/paths.js';

async function main(): Promise<void> {
  const repoRoot = path.resolve(process.cwd(), '../..');
  const paths = resolveChainPaths(repoRoot);

  const receiptPath = path.resolve(paths.receiptsPath);
  const keyPath = paths.keyPath ? path.resolve(paths.keyPath) : undefined;

  // coordination-kernel always writes to receipts.jsonl in the directory
  const receiptDir = path.dirname(receiptPath);
  const actualReceiptFile = path.join(receiptDir, 'receipts.jsonl');

  console.log(`[fixture] config path -> ${receiptPath}`);
  console.log(`[fixture] actual file -> ${actualReceiptFile}`);
  console.log(`[fixture] key -> ${keyPath ?? '(unset)'}`);

  // Ensure parent directory exists
  fs.mkdirSync(receiptDir, { recursive: true });

  // Delete existing fixture to avoid append drift
  if (fs.existsSync(actualReceiptFile)) {
    fs.unlinkSync(actualReceiptFile);
    console.log('[fixture] removed existing chain');
  }

  // Validate key if provided
  if (keyPath) {
    validateKeyFile(keyPath);
    console.log('[fixture] key validated');
  }

  // Create logger with no materializers (just the receipt writer)
  // Note: createAuditLogger has materializers (identity, treasury, etc.)
  // which is fine - they're no-ops for these synthetic receipts
  const logger = createAuditLogger({ receiptPath, keyPath });

  // Minimal lifecycle sequence
  // Uses correct AuditWriteInput interface: actor_id, action, inputs, result

  // 1. server_boot
  logger.write({
    actor_id: 'system',
    action: 'server_boot',
    inputs: { version: '1.0.0-world-law' },
    result: 'ok',
  });

  // 2. player_created
  logger.write({
    actor_id: 'ci_player_001',
    action: 'player_created',
    inputs: { name: 'CI_Player' },
    result: 'ok',
  });

  // 3. enter_world
  logger.write({
    actor_id: 'ci_player_001',
    action: 'enter_world',
    inputs: { zone: 'rookguard', x: 16, y: 16 },
    result: 'ok',
  });

  // 4. move_result
  logger.write({
    actor_id: 'ci_player_001',
    action: 'move_result',
    inputs: { direction: 'north', from_x: 16, from_y: 16, to_x: 16, to_y: 15 },
    result: 'ok',
  });

  // 5. chat
  logger.write({
    actor_id: 'ci_player_001',
    action: 'chat',
    inputs: { message: 'Hello, constitutional world!' },
    result: 'ok',
  });

  // 6. server_shutdown
  logger.write({
    actor_id: 'system',
    action: 'server_shutdown',
    inputs: { reason: 'ci_fixture_complete' },
    result: 'ok',
  });

  logger.close();

  // Verify output
  const content = fs.readFileSync(actualReceiptFile, 'utf8');
  const lines = content.trim().split('\n').filter(l => l.length > 0);

  console.log(`[fixture] wrote ${lines.length} receipts`);

  // Sanity check: verify chain integrity
  // coordination-kernel uses lowercase 'genesis' as the genesis marker
  let prevHash = 'genesis';
  for (let i = 0; i < lines.length; i++) {
    const receipt = JSON.parse(lines[i]);
    if (receipt.prev_hash !== prevHash) {
      console.error(`[fixture] chain broken at receipt ${i + 1}`);
      process.exit(2);
    }
    if (!receipt.event_hash || !receipt.signature) {
      console.error(`[fixture] missing envelope at receipt ${i + 1}`);
      process.exit(2);
    }
    if (receipt.sequence !== i + 1) {
      console.error(`[fixture] sequence mismatch at receipt ${i + 1}: got ${receipt.sequence}`);
      process.exit(2);
    }
    prevHash = receipt.event_hash;
  }

  console.log('[fixture] chain integrity verified');
  console.log('[fixture] DONE');
}

main().catch((err) => {
  console.error('[fixture] ERROR:', err);
  process.exit(2);
});
