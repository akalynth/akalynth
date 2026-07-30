import { hashCanonicalJson } from '@akalynth/coordination-kernel';
import type {
  ConsequenceArtifact,
  ContentHash,
  EffectManifestEntry,
  ReceiptBackedArtifact,
} from './types.js';

export function hashLogicalContent(value: unknown): ContentHash {
  return hashCanonicalJson(value) as ContentHash;
}

export function effectDescriptorBody(
  effect: EffectManifestEntry,
): Omit<EffectManifestEntry, 'descriptor_hash'> {
  const { descriptor_hash: _descriptorHash, ...body } = effect;
  return body;
}

export function computeEffectDescriptorHash(
  effect: EffectManifestEntry,
): ContentHash {
  return hashLogicalContent(effectDescriptorBody(effect));
}

export function logicalKeyOf(artifact: ConsequenceArtifact): string {
  switch (artifact.artifact_kind) {
    case 'envelope':
      return `envelope:${artifact.envelope.server_acceptance_key}`;
    case 'resolution_basis':
      return `basis:${artifact.basis.envelope_id}`;
    case 'resolution_root':
      return `root:${artifact.root.envelope_id}`;
    case 'child_effect':
      return `child:${artifact.child.root_id}:${artifact.child.ordinal}`;
    case 'bundle_seal':
      return `seal:${artifact.seal.root_id}`;
  }
}

export function makeReceiptBackedArtifact<
  TArtifact extends ConsequenceArtifact,
>(
  artifact: TArtifact,
  receiptHash: ContentHash,
  sequence: number,
): ReceiptBackedArtifact<TArtifact> {
  return {
    receipt_hash: receiptHash,
    sequence,
    logical_key: logicalKeyOf(artifact),
    logical_content_hash: hashLogicalContent(artifact),
    artifact,
  };
}

export type LogicalAppendClassification =
  | 'new'
  | 'duplicate_identical'
  | 'integrity_fault';

export function classifyLogicalAppend(
  existing: ReceiptBackedArtifact | undefined,
  incoming: ReceiptBackedArtifact,
): LogicalAppendClassification {
  if (!existing) return 'new';
  if (
    existing.logical_key === incoming.logical_key
    && existing.logical_content_hash === incoming.logical_content_hash
  ) {
    return 'duplicate_identical';
  }
  return 'integrity_fault';
}
