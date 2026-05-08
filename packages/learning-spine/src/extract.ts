import type { CoordinationReceipt } from '@akalynth/coordination-kernel';
import { loadAndVerifyChain } from '@akalynth/coordination-kernel';
import type { ExtractedReceipt } from './types.js';

const RELEVANT_ACTIONS = new Set([
  'session_guest_minted',
  'session_guest_expired',
  'move_intent',
  'move_result',
  'chat',
  'cadence_suspected',
  'tem_challenge_issued',
  'tem_challenge_passed',
  'tem_challenge_failed',
  'heat_changed',
  'heat_tem_escalation',
  'heat_penalty_applied',
  'runestone_denied',
  'legend_attempted',
  'throttle',
  'kick',
  'rate_limit_exceeded',
]);

export async function extractAntiCheatEventsFromFile(receiptPath: string): Promise<ExtractedReceipt[]> {
  const chain = await loadAndVerifyChain(receiptPath);
  if (chain.integrity !== 'valid') {
    throw new Error('Receipt chain integrity is broken');
  }

  return chain.receipts
    .filter((receipt) => isRelevantReceipt(receipt))
    .map((receipt) => ({
      sequence: receipt.sequence,
      timestamp: receipt.timestamp,
      timestamp_ms: Date.parse(receipt.timestamp),
      actor_id: receipt.actor_id,
      action: receipt.action,
      inputs: receipt.inputs,
      result: receipt.result,
    }));
}

function isRelevantReceipt(receipt: CoordinationReceipt): boolean {
  if (receipt.actor_id === 'system') return false;
  return RELEVANT_ACTIONS.has(receipt.action);
}
