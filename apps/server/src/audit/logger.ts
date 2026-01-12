import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import stableStringify from 'fast-json-stable-stringify';
import type { AuditReceipt } from '../../../../packages/shared/types.js';
import { applyReceiptToIdentity } from '../world/identity.js';
import { applyReceiptToTreasury } from '../world/treasury.js';
import { applyReceiptToWorkContracts } from '../world/work_contracts.js';
import { applyReceiptToPresence } from '../world/presence.js';

// ============================================================================
// Types
// ============================================================================

export interface AuditLoggerConfig {
  /**
   * Callback invoked AFTER receipt is durably written (fsynced) to JSONL.
   * offsetAfterLine is the byte position after the written line.
   */
  onWrite?: (receipt: AuditReceipt, offsetAfterLine: number) => void;
}

export interface AuditLogger {
  write(receipt: Omit<AuditReceipt, 'timestamp' | 'evidence_hash'> & { timestamp?: string }): void;
  close(): void;
}

// ============================================================================
// Hash Utilities
// ============================================================================

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ============================================================================
// Logger Factory
// ============================================================================

export function createAuditLogger(config: AuditLoggerConfig = {}): AuditLogger {
  const dir = path.resolve(process.cwd(), 'audit');
  const file = path.join(dir, 'receipts.jsonl');
  fs.mkdirSync(dir, { recursive: true });

  // Open file descriptor for durable writes
  const fd = fs.openSync(file, 'a');

  // Track offset locally (don't fstat per write - race condition)
  let currentOffset = fs.fstatSync(fd).size;

  return {
    write: (receipt) => {
      // Use provided timestamp or generate new one
      const timestamp = receipt.timestamp ?? new Date().toISOString();

      // Build full receipt with timestamp
      const fullReceipt: AuditReceipt = {
        timestamp,
        player_id: receipt.player_id,
        action: receipt.action,
        inputs: receipt.inputs,
        result: receipt.result,
      };

      // Compute evidence hash (sha256 for backwards compatibility)
      const evidence = stableStringify({
        timestamp,
        player_id: receipt.player_id,
        action: receipt.action,
        inputs: receipt.inputs,
        result: receipt.result,
      });
      const evidence_hash = `sha256:${sha256Hex(evidence)}`;

      // Add evidence_hash to full receipt
      fullReceipt.evidence_hash = evidence_hash;

      // Canonical JSON line (sorted keys for determinism)
      const line = stableStringify(fullReceipt) + '\n';

      // 1. Append to JSONL
      const bytesWritten = fs.writeSync(fd, line);
      currentOffset += bytesWritten;

      // 2. Ensure durable (fsync)
      fs.fsyncSync(fd);

      // 3. Update in-memory projections (runs on every receipt)
      applyReceiptToIdentity(fullReceipt);
      applyReceiptToTreasury(fullReceipt);
      applyReceiptToWorkContracts(fullReceipt);
      applyReceiptToPresence(fullReceipt);

      // 4. ONLY THEN call onWrite with offset AFTER the line
      // This ensures SQLite only sees receipts that are durable in JSONL
      config.onWrite?.(fullReceipt, currentOffset);
    },

    close: () => {
      fs.closeSync(fd);
    },
  };
}
