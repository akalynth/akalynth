import { verifyReceiptHashes } from '@akalynth/coordination-kernel';
import type { AuditReceipt } from '../../../../packages/shared/types.js';
import {
  hashLogicalContent,
  logicalKeyOf,
  makeReceiptBackedArtifact,
} from './hash.js';
import type {
  ConsequenceArtifact,
  ReceiptBackedArtifact,
} from './types.js';
import { isConsequenceArtifact } from './validate.js';

export const CONSEQUENCE_ARTIFACT_ACTION =
  'consequence_contract_artifact_v1';
export const CONSEQUENCE_ARTIFACT_SCHEMA_VERSION = 1;

export type ConsequenceReceiptWriteInput = Omit<
  AuditReceipt,
  | 'sequence'
  | 'timestamp'
  | 'prev_hash'
  | 'event_hash'
  | 'signature'
  | 'inputs_hash'
  | 'outputs_hash'
>;

/**
 * Build a normal canonical audit-receipt input. The existing receipt logger
 * supplies sequence, timestamp, chain hashes, signature, and fsync.
 *
 * Encoding only: this function does not validate parents or atomically claim a
 * logical key. Production code must not call it until a validated append
 * coordinator and exclusive writer boundary exist.
 */
export function toUncheckedConsequenceReceiptInput(
  actorId: string,
  artifact: ConsequenceArtifact,
): ConsequenceReceiptWriteInput {
  const logicalKey = logicalKeyOf(artifact);
  const logicalContentHash = hashLogicalContent(artifact);
  return {
    actor_id: actorId,
    action: CONSEQUENCE_ARTIFACT_ACTION,
    inputs: {
      schema_version: CONSEQUENCE_ARTIFACT_SCHEMA_VERSION,
      logical_key: logicalKey,
      logical_content_hash: logicalContentHash,
      artifact,
    },
    result: 'ok',
  };
}

/**
 * Parse one canonical audit receipt into the consequence-contract fold shape.
 * Non-consequence receipts return null; malformed consequence receipts fail
 * closed.
 */
export function consequenceArtifactFromReceipt(
  receipt: AuditReceipt,
): ReceiptBackedArtifact | null {
  if (receipt.action !== CONSEQUENCE_ARTIFACT_ACTION) return null;
  if (receipt.result !== 'ok') {
    throw new Error('consequence artifact receipt must have result=ok');
  }
  const hashValidation = verifyReceiptHashes(receipt);
  if (!hashValidation.ok) {
    throw new Error(
      `consequence artifact receipt hash failure: ${hashValidation.reason}`,
    );
  }
  const {
    schema_version: schemaVersion,
    logical_key: logicalKey,
    logical_content_hash: logicalContentHash,
    artifact,
  } = receipt.inputs;
  if (schemaVersion !== CONSEQUENCE_ARTIFACT_SCHEMA_VERSION) {
    throw new Error(
      `unsupported consequence artifact schema: ${String(schemaVersion)}`,
    );
  }
  if (!isConsequenceArtifact(artifact)) {
    throw new Error('consequence artifact receipt has malformed artifact');
  }
  const parsed = makeReceiptBackedArtifact(
    artifact,
    receipt.event_hash as ReceiptBackedArtifact['receipt_hash'],
    receipt.sequence,
  );
  if (logicalKey !== parsed.logical_key) {
    throw new Error('consequence artifact logical key mismatch');
  }
  if (logicalContentHash !== parsed.logical_content_hash) {
    throw new Error('consequence artifact logical content hash mismatch');
  }
  return parsed;
}
