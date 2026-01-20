// Receipt Logger with Chain Integrity
// Domain-agnostic audit receipt system with prev_hash chaining

import fs from 'node:fs';
import path from 'node:path';
import type { CoordinationReceipt, AuditWriter } from '../types.js';
import { computeEvidenceHash, serializeReceipt } from './hasher.js';

// ============================================================================
// Types
// ============================================================================

export interface ReceiptLoggerConfig {
  /**
   * Directory for receipt storage (defaults to './receipts')
   */
  receiptDir?: string;

  /**
   * Callback invoked AFTER receipt is durably written (fsynced) to JSONL.
   * offsetAfterLine is the byte position after the written line.
   */
  onWrite?: (receipt: CoordinationReceipt, offsetAfterLine: number) => void;
}

export interface ReceiptLogger extends AuditWriter {
  /**
   * Append receipt to chain with automatic prev_hash linking
   */
  appendReceipt(
    actor_id: string,
    action: string,
    inputs: Record<string, unknown>,
    result: string
  ): Promise<CoordinationReceipt>;

  /**
   * Get the last receipt hash for chain linking
   */
  getLastHash(): string | null;

  /**
   * Close the logger and file descriptor
   */
  close(): void;
}

// ============================================================================
// Logger Factory
// ============================================================================

export function createReceiptLogger(config: ReceiptLoggerConfig = {}): ReceiptLogger {
  const dir = path.resolve(config.receiptDir || './receipts');
  const file = path.join(dir, 'receipts.jsonl');
  fs.mkdirSync(dir, { recursive: true });

  // Open file descriptor for durable writes
  const fd = fs.openSync(file, 'a');

  // Track offset and last hash locally
  let currentOffset = fs.fstatSync(fd).size;
  let lastHash: string | null = null;

  // Initialize last hash from existing file
  if (currentOffset > 0) {
    // Read last line to get the last hash
    // For now, we'll compute it lazily when needed
    lastHash = initializeLastHashFromFile(file);
  }

  const logger: ReceiptLogger = {
    appendReceipt: async (actor_id, action, inputs, result) => {
      const timestamp = new Date().toISOString();

      // Build receipt with prev_hash chaining
      const receiptWithoutHash: Omit<CoordinationReceipt, 'evidence_hash'> = {
        timestamp,
        actor_id,
        action,
        inputs,
        result,
        prev_hash: lastHash, // Chain to previous receipt
      };

      // Compute evidence hash
      const evidence_hash = computeEvidenceHash(receiptWithoutHash);

      // Complete receipt
      const fullReceipt: CoordinationReceipt = {
        ...receiptWithoutHash,
        evidence_hash,
      };

      // Serialize to canonical JSONL
      const line = serializeReceipt(fullReceipt);

      // 1. Append to JSONL
      const bytesWritten = fs.writeSync(fd, line);
      currentOffset += bytesWritten;

      // 2. Ensure durable (fsync)
      fs.fsyncSync(fd);

      // 3. Update last hash for next receipt
      lastHash = evidence_hash;

      // 4. ONLY THEN call onWrite callback
      config.onWrite?.(fullReceipt, currentOffset);

      return fullReceipt;
    },

    write: async function(receipt) {
      // Compatibility method for AuditWriter interface
      return await logger.appendReceipt(
        receipt.actor_id,
        receipt.action,
        receipt.inputs,
        receipt.result
      );
    },

    getLastHash: () => lastHash,

    close: () => {
      fs.closeSync(fd);
    },
  };

  return logger;
}

// ============================================================================
// Utilities
// ============================================================================

function initializeLastHashFromFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);

    if (lines.length === 0) {
      return null;
    }

    const lastLine = lines[lines.length - 1];
    const lastReceipt = JSON.parse(lastLine) as CoordinationReceipt;
    return lastReceipt.evidence_hash;
  } catch {
    // If we can't read the file, assume empty chain
    return null;
  }
}