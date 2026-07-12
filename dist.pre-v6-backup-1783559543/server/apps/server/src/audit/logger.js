import path from 'node:path';
import { createReceiptLogger } from '@akalynth/coordination-kernel';
import { applyReceiptToIdentity } from '../world/identity.js';
import { applyReceiptToTreasury } from '../world/treasury.js';
import { applyReceiptToWorkContracts } from '../world/work_contracts.js';
import { applyReceiptToPresence } from '../world/presence.js';
import { applyReceiptToProperty } from '../world/property.js';
import { applyReceiptToRookguardQuest } from '../world/rookguardQuest.js';
import { applyReceiptToOnwardRoutes } from '../world/onwardRoutes.js';
// ============================================================================
// Logger Factory
// ============================================================================
export function createAuditLogger(config) {
    // Caller must provide absolute paths (use resolveChainPaths from shared/paths)
    const dir = path.dirname(config.receiptPath);
    const receiptLogger = createReceiptLogger({
        receiptDir: dir,
        keyPath: config.keyPath,
        onWrite: (receipt, offsetAfterLine) => {
            // Update in-memory projections (runs on every receipt)
            applyReceiptToIdentity(receipt);
            applyReceiptToTreasury(receipt);
            applyReceiptToWorkContracts(receipt);
            applyReceiptToPresence(receipt);
            applyReceiptToProperty(receipt);
            applyReceiptToRookguardQuest(receipt);
            applyReceiptToOnwardRoutes(receipt);
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
            return receiptLogger.appendReceiptSync(actorId, receipt.action, receipt.inputs, receipt.result);
        },
        close: () => {
            receiptLogger.close();
        },
    };
}
