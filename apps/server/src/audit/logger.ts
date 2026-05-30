import path from 'node:path';
import { createReceiptLogger } from '@akalynth/coordination-kernel';
import type { AuditReceipt } from '../../../../packages/shared/types.js';
import { applyReceiptToIdentity } from '../world/identity.js';
import { applyReceiptToTreasury } from '../world/treasury.js';
import { applyReceiptToWorkContracts } from '../world/work_contracts.js';
import { applyReceiptToPresence } from '../world/presence.js';
import { applyReceiptToProperty } from '../world/property.js';

// ============================================================================
// Types
// ============================================================================

export interface AuditLoggerConfig {
  /**
   * Callback invoked AFTER receipt is durably written (fsynced) to JSONL.
   * offsetAfterLine is the byte position after the written line.
   */
  onWrite?: (receipt: AuditReceipt, offsetAfterLine: number) => void;
  /**
   * Absolute path to receipts.jsonl.
   * Use resolveChainPaths() from @akalynth/shared/paths for canonical resolution.
   */
  receiptPath: string;
  /**
   * Absolute path to Ed25519 signing key (optional in dev mode).
   * Use resolveChainPaths() from @akalynth/shared/paths for canonical resolution.
   */
  keyPath?: string;
}

type AuditWriteInput = Omit<
  AuditReceipt,
  'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash' | 'actor_id'
> & {
  actor_id?: string;
  player_id?: string;
};

export interface AuditLogger {
  write(receipt: AuditWriteInput): AuditReceipt;
  close(): void;
}

// ============================================================================
// Logger Factory
// ============================================================================

export function createAuditLogger(config: AuditLoggerConfig): AuditLogger {
  // Caller must provide absolute paths (use resolveChainPaths from shared/paths)
  const dir = path.dirname(config.receiptPath);
  const receiptLogger = createReceiptLogger({
    receiptDir: dir,
    keyPath: config.keyPath,
    onWrite: (receipt: AuditReceipt, offsetAfterLine: number) => {
      // Update in-memory projections (runs on every receipt)
      applyReceiptToIdentity(receipt);
      applyReceiptToTreasury(receipt);
      applyReceiptToWorkContracts(receipt);
      applyReceiptToPresence(receipt);
      applyReceiptToProperty(receipt);

      // Forward to external callback if provided
      config.onWrite?.(receipt, offsetAfterLine);
    }
  });

  return {
    write: (receipt) => {
      const actorId = receipt.actor_id ?? receipt.player_id;
      if (!actorId) {
        throw new Error('Audit receipt missing actor_id');
      }
      return receiptLogger.appendReceiptSync(
        actorId,
        receipt.action,
        receipt.inputs,
        receipt.result
      ) as AuditReceipt;
    },

    close: () => {
      receiptLogger.close();
    },
  };
}
