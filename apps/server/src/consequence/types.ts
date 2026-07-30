// Risk & Consequence commitment contract primitives.
//
// This module is deliberately server-private. It defines immutable logical
// artifacts only; it does not bind gameplay, mutate projections, or add a wire
// protocol. Canonical receipts remain the authority.

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[];

export type ContentHash = `blake3:${string}`;

export type EnvelopeKind = 'ece' | 'rce' | 'mce';

export type TerminalOutcome =
  | 'resolved'
  | 'no_consequence'
  | 'aborted'
  | 'authorized_neutralized'
  | 'resolution_invalid';

export type ConsequenceClass =
  | 'body'
  | 'item'
  | 'reputation'
  | 'place'
  | 'faction'
  | 'world';

export type EffectPolarity = 'adverse' | 'compensating' | 'neutral';

/**
 * Data-carried accounting dimensions. The kernel implements only the algebra;
 * gameplay values and balance policy remain outside this module.
 */
export type BudgetVector = Readonly<Record<string, number>>;

export interface ArtifactRef {
  readonly id: string;
  readonly content_hash: ContentHash;
}

export interface ReceiptRef {
  readonly receipt_hash: ContentHash;
}

export interface TypedInitiatorRef {
  readonly kind: 'player' | 'organization' | 'world' | 'system';
  readonly id: string;
}

export interface ProtectionCommitmentRef {
  readonly item_id: string;
  readonly commitment_receipt_hash: ContentHash;
}

export interface CompensationRef {
  readonly root_id: string;
  readonly logical_effect_id: string;
}

export interface ReadClaim {
  readonly entity_ref: string;
  readonly expected_revision: string | null;
}

export interface WriteClaim {
  readonly entity_ref: string;
  readonly operation: string;
  readonly resulting_revision: string;
}

export interface CommitmentEnvelopeBase {
  readonly envelope_kind: EnvelopeKind;
  readonly envelope_id: string;
  readonly subject_id: string;
  readonly server_acceptance_key: string;
  readonly policy: ArtifactRef;
  readonly client_correlation_key?: string | null;
}

export interface ExposureCommitmentEnvelope extends CommitmentEnvelopeBase {
  readonly envelope_kind: 'ece';
  readonly initiator_ref?: TypedInitiatorRef | null;
  readonly standing_context_revision_refs: readonly ArtifactRef[];
  readonly interaction_id?: string | null;
  readonly acceptance_source:
    | 'zone_entry'
    | 'carried_power'
    | 'war_join'
    | 'action_init'
    | 'explicit_declaration'
    | 'typed_resolver';
  readonly risk_declaration: ArtifactRef;
  readonly protection_commitment: ProtectionCommitmentRef | null;
  readonly aggregate_ceiling: BudgetVector;
  readonly material_context_fingerprint: ContentHash;
}

export type RecoveryReservation =
  | {
      readonly kind: 'scalar';
      readonly logical_effect_id: string;
      readonly reserved: BudgetVector;
    }
  | {
      readonly kind: 'identity';
      readonly logical_effect_id: string;
      readonly item_id: string;
    };

export type RecoveryReservationAuthority =
  | {
      readonly kind: 'subject';
    }
  | {
      readonly kind: 'mutual_contract';
      readonly contract_receipt_hash: ContentHash;
    };

export interface RecoveryCommitmentEnvelope extends CommitmentEnvelopeBase {
  readonly envelope_kind: 'rce';
  readonly original_root_id: string;
  readonly original_effect_ids: readonly string[];
  readonly route: string;
  readonly compensation_of: readonly CompensationRef[];
  readonly reservation: RecoveryReservation;
  readonly reservation_authority: RecoveryReservationAuthority;
  readonly terminal_boundary: ArtifactRef;
}

export type RemediationAuthority =
  | {
      readonly kind: 'decision_receipt';
      readonly decision_receipt_hash: ContentHash;
    }
  | {
      readonly kind: 'remediation_policy';
      readonly policy: ArtifactRef;
    };

export interface RemediationCommitmentEnvelope
  extends CommitmentEnvelopeBase {
  readonly envelope_kind: 'mce';
  readonly target_root_id: string;
  readonly target_effect_ids: readonly string[];
  readonly authority: RemediationAuthority;
  readonly trigger_evidence: ArtifactRef;
  readonly reason: string;
  readonly scope: string;
  readonly compensable_delta: BudgetVector;
}

export type AcceptedEnvelope =
  | ExposureCommitmentEnvelope
  | RecoveryCommitmentEnvelope
  | RemediationCommitmentEnvelope;

export interface ResolutionTrigger {
  readonly kind: string;
  readonly evidence_ref?: ArtifactRef | null;
}

export interface RngResolutionBasis {
  readonly commitment_ref: ArtifactRef;
  readonly seed_ref: ArtifactRef;
  readonly opening_ref: ArtifactRef;
}

export interface ResolutionBasis {
  readonly envelope_id: string;
  readonly canonical_pre_state: ArtifactRef;
  readonly standing_context_revision_refs: readonly ArtifactRef[];
  readonly trigger: ResolutionTrigger;
  readonly server_time_boundary?: ArtifactRef | null;
  readonly policy: ArtifactRef;
  readonly disclosure_refs: readonly ArtifactRef[];
  readonly rng?: RngResolutionBasis | null;
  readonly read_set: readonly ReadClaim[];
  readonly proposed_write_set: readonly WriteClaim[];
}

export type EffectPayload =
  | {
      readonly kind: 'inline';
      readonly value: JsonValue;
    }
  | {
      readonly kind: 'content_ref';
      readonly ref: ArtifactRef;
    };

export type RecoverableLine =
  | {
      readonly kind: 'scalar';
      readonly recoverable_total: BudgetVector;
    }
  | {
      readonly kind: 'identity';
      readonly item_id: string;
    };

export interface EffectManifestEntry {
  readonly logical_effect_id: string;
  readonly ordinal: number;
  readonly consequence_class: ConsequenceClass;
  readonly payload: EffectPayload;
  readonly descriptor_hash: ContentHash;
  readonly accounting: BudgetVector;
  readonly polarity: EffectPolarity;
  readonly compensation_of?: CompensationRef | null;
  readonly recoverable?: RecoverableLine | null;
}

export type RecoveryReservationDisposition =
  | {
      readonly kind: 'scalar';
      readonly consumed: BudgetVector;
      readonly released: BudgetVector;
    }
  | {
      readonly kind: 'identity';
      readonly consumed: boolean;
      readonly released: boolean;
    };

export interface ResolutionRoot {
  readonly root_id: string;
  readonly envelope_id: string;
  readonly policy: ArtifactRef;
  readonly outcome: TerminalOutcome;
  readonly effect_manifest: readonly EffectManifestEntry[];
  readonly causal_input_refs: readonly ArtifactRef[];
  readonly read_set: readonly ReadClaim[];
  readonly write_set: readonly WriteClaim[];
  readonly reservation_disposition?: RecoveryReservationDisposition | null;
}

export interface ChildEffectEvidence {
  readonly root_id: string;
  readonly ordinal: number;
  readonly logical_effect_id: string;
  readonly descriptor_hash: ContentHash;
  readonly evidence: JsonValue;
}

export interface BundleSeal {
  readonly root_id: string;
  readonly child_receipt_hashes: readonly ContentHash[];
}

export interface EnvelopeArtifact {
  readonly artifact_kind: 'envelope';
  readonly envelope: AcceptedEnvelope;
}

export interface ResolutionBasisArtifact {
  readonly artifact_kind: 'resolution_basis';
  readonly basis: ResolutionBasis;
}

export interface ResolutionRootArtifact {
  readonly artifact_kind: 'resolution_root';
  readonly root: ResolutionRoot;
}

export interface ChildEffectArtifact {
  readonly artifact_kind: 'child_effect';
  readonly child: ChildEffectEvidence;
}

export interface BundleSealArtifact {
  readonly artifact_kind: 'bundle_seal';
  readonly seal: BundleSeal;
}

export type ConsequenceArtifact =
  | EnvelopeArtifact
  | ResolutionBasisArtifact
  | ResolutionRootArtifact
  | ChildEffectArtifact
  | BundleSealArtifact;

/**
 * Receipt identity stays outside the logical body. Embedding event_hash in its
 * own preimage would create a hash cycle.
 */
export interface ReceiptBackedArtifact<
  TArtifact extends ConsequenceArtifact = ConsequenceArtifact,
> {
  readonly receipt_hash: ContentHash;
  readonly sequence: number;
  readonly logical_key: string;
  readonly logical_content_hash: ContentHash;
  readonly artifact: TArtifact;
}

export type ValidationCode =
  | 'MALFORMED'
  | 'MISSING_PARENT'
  | 'HASH_MISMATCH'
  | 'LOGICAL_KEY_CONFLICT'
  | 'MANIFEST_ORDINAL_INVALID'
  | 'DESCRIPTOR_MISMATCH'
  | 'SEAL_INCOMPLETE'
  | 'RCE_RESERVATION_RESIDUAL'
  | 'MCE_AUTHORITY_MISSING'
  | 'ACCOUNTING_EXCEEDED'
  | 'COMPENSATION_REQUIRED'
  | 'OUTCOME_REQUIRES_EMPTY_MANIFEST';

export interface ValidationIssue {
  readonly code: ValidationCode;
  readonly path: string;
  readonly message: string;
  readonly episode_id?: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface ConsequenceEpisodeProjection {
  readonly envelope_id: string;
  envelope: ReceiptBackedArtifact<EnvelopeArtifact> | null;
  basis: ReceiptBackedArtifact<ResolutionBasisArtifact> | null;
  root: ReceiptBackedArtifact<ResolutionRootArtifact> | null;
  readonly children_by_ordinal: Map<
    number,
    ReceiptBackedArtifact<ChildEffectArtifact>
  >;
  seal: ReceiptBackedArtifact<BundleSealArtifact> | null;
  authoritative: boolean;
  projection_ready: boolean;
  terminal_outcome: TerminalOutcome | null;
  integrity_quarantined: boolean;
}

export interface ConsequenceLedgerProjection {
  readonly episodes: Map<string, ConsequenceEpisodeProjection>;
  readonly integrity_faults: ValidationIssue[];
  readonly integrity_quarantined_episode_ids: ReadonlySet<string>;
}
