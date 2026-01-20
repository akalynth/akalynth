// Receipt Logger with Chain Integrity
// Domain-agnostic audit receipt system with prev_hash chaining

import fs from 'node:fs';
import path from 'node:path';
import type { CoordinationReceipt, AuditWriter } from '../types.js';
import {
  computeEventHash,
  computeInputsHash,
  computeOutputsHash,
  serializeReceipt,
  signEvent,
  GENESIS_MARKER
} from './hasher.js';
import { loadKeySeed, resolveKeyPath, isProductionMode } from './key.js';
import { createPrivateKeyFromSeed } from './hasher.js';

// ============================================================================
// Types
// ============================================================================

export interface ReceiptLoggerConfig {
  /**
   * Directory for receipt storage (defaults to './receipts')
   */
  receiptDir?: string;

  /**
   * Path to Ed25519 signing key (defaults to CHRONICLE_KEY_PATH or ./chronicle.key)
   */
  keyPath?: string;

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
   * Synchronous append for environments that require immediate receipts
   */
  appendReceiptSync(
    actor_id: string,
    action: string,
    inputs: Record<string, unknown>,
    result: string
  ): CoordinationReceipt;

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
  const keyPath = resolveKeyPath(config.keyPath);
  fs.mkdirSync(dir, { recursive: true });

  // Production key discipline check
  if (isProductionMode() && !config.keyPath && !process.env.CHRONICLE_KEY_PATH) {
    throw new Error('CHRONICLE_KEY_PATH is required in production');
  }

  // Open file descriptor for durable writes
  const fd = fs.openSync(file, 'a');

  // Load signing key (must exist)
  const signingKey = loadKeySeed(keyPath);
  const signingKeyObject = createPrivateKeyFromSeed(signingKey);

  // Track offset, last hash, and last sequence locally
  let currentOffset = fs.fstatSync(fd).size;
  let lastHash: string | null = null;
  let lastSequence = 0;

  // Initialize last hash from existing file
  if (currentOffset > 0) {
    const state = initializeChainStateFromFile(file);
    lastHash = state.lastHash;
    lastSequence = state.lastSequence;
  }

  const logger: ReceiptLogger = {
    appendReceiptSync: (actor_id, action, inputs, result) => {
      const timestamp = new Date().toISOString();
      const sequence = lastSequence + 1;
      const prev_hash = lastHash ?? GENESIS_MARKER;
      const inputs_hash = computeInputsHash(inputs);
      const outputs_hash = computeOutputsHash(result);

      // Build receipt body (no event_hash/signature yet)
      const receiptBody: Omit<CoordinationReceipt, 'event_hash' | 'signature'> = {
        sequence,
        timestamp,
        prev_hash,
        actor_id,
        action,
        inputs,
        result,
        inputs_hash,
        outputs_hash
      };

      // Compute event hash and signature
      const event_hash = computeEventHash(receiptBody);
      const signature = signEvent(prev_hash, event_hash, signingKeyObject);

      // Complete receipt
      const fullReceipt: CoordinationReceipt = {
        ...receiptBody,
        event_hash,
        signature
      };

      // Serialize to canonical JSONL
      const line = serializeReceipt(fullReceipt);

      // 1. Append to JSONL
      const bytesWritten = fs.writeSync(fd, line);
      currentOffset += bytesWritten;

      // 2. Ensure durable (fsync)
      fs.fsyncSync(fd);

      // 3. Update last hash for next receipt
      lastHash = event_hash;
      lastSequence = sequence;

      // 4. ONLY THEN call onWrite callback
      config.onWrite?.(fullReceipt, currentOffset);

      return fullReceipt;
    },

    appendReceipt: async (actor_id, action, inputs, result) => {
      return logger.appendReceiptSync(actor_id, action, inputs, result);
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

function initializeChainStateFromFile(filePath: string): { lastHash: string | null; lastSequence: number } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.length > 0);

  if (lines.length === 0) {
    return { lastHash: null, lastSequence: 0 };
  }

  const lastLine = lines[lines.length - 1];
  const lastReceipt = JSON.parse(lastLine) as CoordinationReceipt;

  if (!lastReceipt.event_hash || typeof lastReceipt.sequence !== 'number') {
    throw new Error('Receipt chain corrupt: missing event_hash or sequence');
  }

  return { lastHash: lastReceipt.event_hash, lastSequence: lastReceipt.sequence };
}

