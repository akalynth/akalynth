import {
  computeEffectDescriptorHash,
  hashLogicalContent,
} from './hash.js';
import type {
  AcceptedEnvelope,
  ArtifactRef,
  BudgetVector,
  BundleSeal,
  ChildEffectArtifact,
  ChildEffectEvidence,
  ConsequenceArtifact,
  ContentHash,
  EffectManifestEntry,
  JsonValue,
  ReadClaim,
  ReceiptBackedArtifact,
  RecoveryReservationDisposition,
  ResolutionBasis,
  ResolutionRoot,
  ValidationCode,
  ValidationIssue,
  ValidationResult,
  WriteClaim,
} from './types.js';

export type EvidenceResolver = (ref: ArtifactRef) => boolean;

const HASH_PATTERN = /^blake3:[0-9a-f]{64}$/;
const EMPTY_MANIFEST_OUTCOMES = new Set([
  'no_consequence',
  'aborted',
  'authorized_neutralized',
  'resolution_invalid',
]);
const TERMINAL_OUTCOMES = new Set([
  'resolved',
  ...EMPTY_MANIFEST_OUTCOMES,
]);
const CONSEQUENCE_CLASSES = new Set([
  'body',
  'item',
  'reputation',
  'place',
  'faction',
  'world',
]);
const EFFECT_POLARITIES = new Set(['adverse', 'compensating', 'neutral']);
const ACCEPTANCE_SOURCES = new Set([
  'zone_entry',
  'carried_power',
  'war_join',
  'action_init',
  'explicit_declaration',
  'typed_resolver',
]);
const INITIATOR_KINDS = new Set([
  'player',
  'organization',
  'world',
  'system',
]);

function addIssue(
  issues: ValidationIssue[],
  code: ValidationCode,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function result(issues: ValidationIssue[]): ValidationResult {
  return { ok: issues.length === 0, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    addIssue(issues, 'MALFORMED', path, 'must be a non-empty string');
    return false;
  }
  return true;
}

function validateContentHash(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is ContentHash {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    addIssue(
      issues,
      'MALFORMED',
      path,
      'must be a lowercase blake3:<64 hex> content hash',
    );
    return false;
  }
  return true;
}

function validateArtifactRef(
  ref: unknown,
  path: string,
  issues: ValidationIssue[],
  evidenceResolver?: EvidenceResolver,
): ref is ArtifactRef {
  if (!isRecord(ref)) {
    addIssue(issues, 'MALFORMED', path, 'must be an artifact reference');
    return false;
  }
  const idOk = requireString(ref.id, `${path}.id`, issues);
  const hashOk = validateContentHash(
    ref.content_hash,
    `${path}.content_hash`,
    issues,
  );
  if (
    idOk
    && hashOk
    && evidenceResolver
    && !evidenceResolver(ref as unknown as ArtifactRef)
  ) {
    addIssue(
      issues,
      'MISSING_PARENT',
      path,
      'referenced evidence is not durably retrievable',
    );
  }
  return idOk && hashOk;
}

function validateReceiptEvidence(
  receiptHash: unknown,
  path: string,
  issues: ValidationIssue[],
  evidenceResolver?: EvidenceResolver,
): receiptHash is ContentHash {
  const hashOk = validateContentHash(receiptHash, path, issues);
  if (
    hashOk
    && evidenceResolver
    && !evidenceResolver({
      id: `receipt:${receiptHash}`,
      content_hash: receiptHash,
    })
  ) {
    addIssue(
      issues,
      'MISSING_PARENT',
      path,
      'referenced receipt evidence is not durably retrievable',
    );
  }
  return hashOk;
}

function validateJsonValue(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is JsonValue {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return true;
    addIssue(issues, 'MALFORMED', path, 'number must be finite');
    return false;
  }
  if (Array.isArray(value)) {
    let ok = true;
    value.forEach((entry, index) => {
      ok = validateJsonValue(entry, `${path}[${index}]`, issues) && ok;
    });
    return ok;
  }
  if (isRecord(value)) {
    let ok = true;
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) {
        addIssue(
          issues,
          'MALFORMED',
          `${path}.${key}`,
          'undefined is not canonical JSON',
        );
        ok = false;
      } else {
        ok = validateJsonValue(entry, `${path}.${key}`, issues) && ok;
      }
    }
    return ok;
  }
  addIssue(issues, 'MALFORMED', path, 'must be canonical JSON data');
  return false;
}

function validateBudget(
  budget: unknown,
  path: string,
  issues: ValidationIssue[],
): budget is BudgetVector {
  if (!isRecord(budget)) {
    addIssue(issues, 'MALFORMED', path, 'must be a budget vector');
    return false;
  }
  let ok = true;
  for (const [dimension, amount] of Object.entries(budget)) {
    if (dimension.length === 0) {
      addIssue(issues, 'MALFORMED', path, 'budget dimension cannot be empty');
      ok = false;
    }
    if (
      typeof amount !== 'number'
      || !Number.isSafeInteger(amount)
      || amount < 0
    ) {
      addIssue(
        issues,
        'MALFORMED',
        `${path}.${dimension}`,
        'budget amount must be a non-negative safe integer',
      );
      ok = false;
    }
  }
  return ok;
}

function validateUniqueStrings(
  values: readonly string[],
  path: string,
  issues: ValidationIssue[],
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (!requireString(value, `${path}[${index}]`, issues)) return;
    if (seen.has(value)) {
      addIssue(
        issues,
        'MALFORMED',
        `${path}[${index}]`,
        'duplicate identifier',
      );
    }
    seen.add(value);
  });
}

function validateReadSet(
  claims: readonly ReadClaim[],
  path: string,
  issues: ValidationIssue[],
): void {
  const entities = new Set<string>();
  claims.forEach((claim, index) => {
    requireString(claim.entity_ref, `${path}[${index}].entity_ref`, issues);
    if (
      claim.expected_revision !== null
      && typeof claim.expected_revision !== 'string'
    ) {
      addIssue(
        issues,
        'MALFORMED',
        `${path}[${index}].expected_revision`,
        'must be a string or null',
      );
    }
    if (entities.has(claim.entity_ref)) {
      addIssue(
        issues,
        'MALFORMED',
        `${path}[${index}].entity_ref`,
        'read set contains the entity more than once',
      );
    }
    entities.add(claim.entity_ref);
  });
}

function validateWriteSet(
  claims: readonly WriteClaim[],
  path: string,
  issues: ValidationIssue[],
): void {
  const entities = new Set<string>();
  claims.forEach((claim, index) => {
    requireString(claim.entity_ref, `${path}[${index}].entity_ref`, issues);
    requireString(claim.operation, `${path}[${index}].operation`, issues);
    requireString(
      claim.resulting_revision,
      `${path}[${index}].resulting_revision`,
      issues,
    );
    if (entities.has(claim.entity_ref)) {
      addIssue(
        issues,
        'MALFORMED',
        `${path}[${index}].entity_ref`,
        'write set contains the entity more than once',
      );
    }
    entities.add(claim.entity_ref);
  });
}

function addBudgets(budgets: readonly BudgetVector[]): BudgetVector {
  const total: Record<string, number> = {};
  for (const budget of budgets) {
    for (const [dimension, amount] of Object.entries(budget)) {
      total[dimension] = (total[dimension] ?? 0) + amount;
    }
  }
  return total;
}

function budgetWithin(actual: BudgetVector, limit: BudgetVector): boolean {
  return Object.entries(actual).every(
    ([dimension, amount]) => amount <= (limit[dimension] ?? 0),
  );
}

function budgetsEqual(left: BudgetVector, right: BudgetVector): boolean {
  const dimensions = new Set([
    ...Object.keys(left),
    ...Object.keys(right),
  ]);
  for (const dimension of dimensions) {
    if ((left[dimension] ?? 0) !== (right[dimension] ?? 0)) return false;
  }
  return true;
}

function refsEqual(left: ArtifactRef, right: ArtifactRef): boolean {
  return left.id === right.id && left.content_hash === right.content_hash;
}

export function validateEnvelope(
  envelope: AcceptedEnvelope,
  evidenceResolver?: EvidenceResolver,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  requireString(envelope.envelope_id, 'envelope.envelope_id', issues);
  requireString(envelope.subject_id, 'envelope.subject_id', issues);
  requireString(
    envelope.server_acceptance_key,
    'envelope.server_acceptance_key',
    issues,
  );
  validateArtifactRef(
    envelope.policy,
    'envelope.policy',
    issues,
    evidenceResolver,
  );

  if (envelope.envelope_kind === 'ece') {
    if (!ACCEPTANCE_SOURCES.has(envelope.acceptance_source)) {
      addIssue(
        issues,
        'MALFORMED',
        'envelope.acceptance_source',
        'unsupported exposure acceptance source',
      );
    }
    if (envelope.initiator_ref !== null && envelope.initiator_ref !== undefined) {
      if (!isRecord(envelope.initiator_ref)) {
        addIssue(
          issues,
          'MALFORMED',
          'envelope.initiator_ref',
          'must be a typed initiator reference',
        );
      } else {
        if (!INITIATOR_KINDS.has(String(envelope.initiator_ref.kind))) {
          addIssue(
            issues,
            'MALFORMED',
            'envelope.initiator_ref.kind',
            'unsupported initiator kind',
          );
        }
        requireString(
          envelope.initiator_ref.id,
          'envelope.initiator_ref.id',
          issues,
        );
      }
    }
    validateArtifactRef(
      envelope.risk_declaration,
      'envelope.risk_declaration',
      issues,
      evidenceResolver,
    );
    envelope.standing_context_revision_refs.forEach((ref, index) => {
      validateArtifactRef(
        ref,
        `envelope.standing_context_revision_refs[${index}]`,
        issues,
        evidenceResolver,
      );
    });
    validateBudget(
      envelope.aggregate_ceiling,
      'envelope.aggregate_ceiling',
      issues,
    );
    validateContentHash(
      envelope.material_context_fingerprint,
      'envelope.material_context_fingerprint',
      issues,
    );
    if (envelope.protection_commitment) {
      requireString(
        envelope.protection_commitment.item_id,
        'envelope.protection_commitment.item_id',
        issues,
      );
      validateReceiptEvidence(
        envelope.protection_commitment.commitment_receipt_hash,
        'envelope.protection_commitment.commitment_receipt_hash',
        issues,
        evidenceResolver,
      );
    }
  } else if (envelope.envelope_kind === 'rce') {
    requireString(
      envelope.original_root_id,
      'envelope.original_root_id',
      issues,
    );
    validateUniqueStrings(
      envelope.original_effect_ids,
      'envelope.original_effect_ids',
      issues,
    );
    if (envelope.original_effect_ids.length !== 1) {
      addIssue(
        issues,
        'MALFORMED',
        'envelope.original_effect_ids',
        'foundation RCE supports exactly one reserved consequence line',
      );
    }
    requireString(envelope.route, 'envelope.route', issues);
    if (envelope.compensation_of.length === 0) {
      addIssue(
        issues,
        'COMPENSATION_REQUIRED',
        'envelope.compensation_of',
        'recovery must reference the original consequence',
      );
    }
    envelope.compensation_of.forEach((compensation, index) => {
      requireString(
        compensation.root_id,
        `envelope.compensation_of[${index}].root_id`,
        issues,
      );
      requireString(
        compensation.logical_effect_id,
        `envelope.compensation_of[${index}].logical_effect_id`,
        issues,
      );
      if (
        compensation.root_id !== envelope.original_root_id
        || !envelope.original_effect_ids.includes(
          compensation.logical_effect_id,
        )
      ) {
        addIssue(
          issues,
          'COMPENSATION_REQUIRED',
          `envelope.compensation_of[${index}]`,
          'recovery compensation must target a declared original effect',
        );
      }
    });
    const compensationIds = new Set(
      envelope.compensation_of.map(
        (compensation) => compensation.logical_effect_id,
      ),
    );
    if (
      envelope.original_effect_ids.some(
        (logicalEffectId) => !compensationIds.has(logicalEffectId),
      )
    ) {
      addIssue(
        issues,
        'COMPENSATION_REQUIRED',
        'envelope.compensation_of',
        'every declared original effect requires a compensation reference',
      );
    }
    const reservation = envelope.reservation as unknown;
    if (!isRecord(reservation)) {
      addIssue(
        issues,
        'MALFORMED',
        'envelope.reservation',
        'must be a typed recovery reservation',
      );
    } else {
      const logicalEffectIdOk = requireString(
        reservation.logical_effect_id,
        'envelope.reservation.logical_effect_id',
        issues,
      );
      if (
        logicalEffectIdOk
        && !envelope.original_effect_ids.includes(
          reservation.logical_effect_id as string,
        )
      ) {
        addIssue(
          issues,
          'MISSING_PARENT',
          'envelope.reservation.logical_effect_id',
          'reservation must name one declared original effect',
        );
      }
      if (reservation.kind === 'scalar') {
        validateBudget(
          reservation.reserved,
          'envelope.reservation.reserved',
          issues,
        );
      } else if (reservation.kind === 'identity') {
        requireString(
          reservation.item_id,
          'envelope.reservation.item_id',
          issues,
        );
      } else {
        addIssue(
          issues,
          'MALFORMED',
          'envelope.reservation.kind',
          'unsupported recovery reservation kind',
        );
      }
    }
    const reservationAuthority = envelope.reservation_authority as unknown;
    if (!isRecord(reservationAuthority)) {
      addIssue(
        issues,
        'MALFORMED',
        'envelope.reservation_authority',
        'must be a typed reservation authority',
      );
    } else if (reservationAuthority.kind === 'mutual_contract') {
      validateReceiptEvidence(
        reservationAuthority.contract_receipt_hash,
        'envelope.reservation_authority.contract_receipt_hash',
        issues,
        evidenceResolver,
      );
    } else if (reservationAuthority.kind !== 'subject') {
      addIssue(
        issues,
        'MALFORMED',
        'envelope.reservation_authority.kind',
        'unsupported recovery reservation authority',
      );
    }
    validateArtifactRef(
      envelope.terminal_boundary,
      'envelope.terminal_boundary',
      issues,
      evidenceResolver,
    );
  } else if (envelope.envelope_kind === 'mce') {
    requireString(envelope.target_root_id, 'envelope.target_root_id', issues);
    validateUniqueStrings(
      envelope.target_effect_ids,
      'envelope.target_effect_ids',
      issues,
    );
    if (!isRecord(envelope.authority)) {
      addIssue(
        issues,
        'MCE_AUTHORITY_MISSING',
        'envelope.authority',
        'integrity evidence alone cannot authorize remediation',
      );
    } else if (envelope.authority.kind === 'decision_receipt') {
      validateReceiptEvidence(
        envelope.authority.decision_receipt_hash,
        'envelope.authority.decision_receipt_hash',
        issues,
        evidenceResolver,
      );
    } else if (envelope.authority.kind === 'remediation_policy') {
      validateArtifactRef(
        envelope.authority.policy,
        'envelope.authority.policy',
        issues,
        evidenceResolver,
      );
    } else {
      addIssue(
        issues,
        'MALFORMED',
        'envelope.authority.kind',
        'unsupported remediation authority',
      );
    }
    validateArtifactRef(
      envelope.trigger_evidence,
      'envelope.trigger_evidence',
      issues,
      evidenceResolver,
    );
    requireString(envelope.reason, 'envelope.reason', issues);
    requireString(envelope.scope, 'envelope.scope', issues);
    validateBudget(
      envelope.compensable_delta,
      'envelope.compensable_delta',
      issues,
    );
  } else {
    addIssue(
      issues,
      'MALFORMED',
      'envelope.envelope_kind',
      'unsupported envelope kind',
    );
  }

  return result(issues);
}

export function validateBasis(
  envelope: AcceptedEnvelope,
  basis: ResolutionBasis,
  evidenceResolver?: EvidenceResolver,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (basis.envelope_id !== envelope.envelope_id) {
    addIssue(
      issues,
      'MISSING_PARENT',
      'basis.envelope_id',
      'basis must reference its accepted envelope',
    );
  }
  validateArtifactRef(
    basis.canonical_pre_state,
    'basis.canonical_pre_state',
    issues,
    evidenceResolver,
  );
  basis.standing_context_revision_refs.forEach((ref, index) => {
    validateArtifactRef(
      ref,
      `basis.standing_context_revision_refs[${index}]`,
      issues,
      evidenceResolver,
    );
  });
  requireString(basis.trigger.kind, 'basis.trigger.kind', issues);
  if (basis.trigger.evidence_ref) {
    validateArtifactRef(
      basis.trigger.evidence_ref,
      'basis.trigger.evidence_ref',
      issues,
      evidenceResolver,
    );
  }
  if (basis.server_time_boundary) {
    validateArtifactRef(
      basis.server_time_boundary,
      'basis.server_time_boundary',
      issues,
      evidenceResolver,
    );
  }
  validateArtifactRef(basis.policy, 'basis.policy', issues, evidenceResolver);
  if (!refsEqual(envelope.policy, basis.policy)) {
    addIssue(
      issues,
      'HASH_MISMATCH',
      'basis.policy',
      'basis policy must equal the immutable envelope policy pin',
    );
  }
  if (envelope.envelope_kind === 'ece') {
    if (
      hashLogicalContent(basis.standing_context_revision_refs)
      !== hashLogicalContent(envelope.standing_context_revision_refs)
    ) {
      addIssue(
        issues,
        'HASH_MISMATCH',
        'basis.standing_context_revision_refs',
        'basis must preserve the ECE standing-context revision bindings',
      );
    }
    if (
      hashLogicalContent(basis.disclosure_refs)
      !== hashLogicalContent([envelope.risk_declaration])
    ) {
      addIssue(
        issues,
        'HASH_MISMATCH',
        'basis.disclosure_refs',
        'basis must preserve the ECE risk disclosure binding',
      );
    }
  }
  basis.disclosure_refs.forEach((ref, index) => {
    validateArtifactRef(
      ref,
      `basis.disclosure_refs[${index}]`,
      issues,
      evidenceResolver,
    );
  });
  if (basis.rng) {
    validateArtifactRef(
      basis.rng.commitment_ref,
      'basis.rng.commitment_ref',
      issues,
      evidenceResolver,
    );
    validateArtifactRef(
      basis.rng.seed_ref,
      'basis.rng.seed_ref',
      issues,
      evidenceResolver,
    );
    validateArtifactRef(
      basis.rng.opening_ref,
      'basis.rng.opening_ref',
      issues,
      evidenceResolver,
    );
  }
  validateReadSet(basis.read_set, 'basis.read_set', issues);
  validateWriteSet(
    basis.proposed_write_set,
    'basis.proposed_write_set',
    issues,
  );
  return result(issues);
}

function validateEffect(
  envelope: AcceptedEnvelope,
  effect: EffectManifestEntry,
  expectedOrdinal: number,
  issues: ValidationIssue[],
  evidenceResolver?: EvidenceResolver,
): void {
  const path = `root.effect_manifest[${expectedOrdinal}]`;
  if (effect.ordinal !== expectedOrdinal) {
    addIssue(
      issues,
      'MANIFEST_ORDINAL_INVALID',
      `${path}.ordinal`,
      `expected dense ordinal ${expectedOrdinal}`,
    );
  }
  requireString(effect.logical_effect_id, `${path}.logical_effect_id`, issues);
  if (!CONSEQUENCE_CLASSES.has(effect.consequence_class)) {
    addIssue(
      issues,
      'MALFORMED',
      `${path}.consequence_class`,
      'unsupported consequence class',
    );
  }
  if (!EFFECT_POLARITIES.has(effect.polarity)) {
    addIssue(
      issues,
      'MALFORMED',
      `${path}.polarity`,
      'unsupported effect polarity',
    );
  }
  if (effect.payload.kind === 'inline') {
    validateJsonValue(effect.payload.value, `${path}.payload.value`, issues);
  } else if (effect.payload.kind === 'content_ref') {
    validateArtifactRef(
      effect.payload.ref,
      `${path}.payload.ref`,
      issues,
      evidenceResolver,
    );
  } else {
    addIssue(
      issues,
      'MALFORMED',
      `${path}.payload.kind`,
      'unsupported payload kind',
    );
  }
  validateBudget(effect.accounting, `${path}.accounting`, issues);
  const expectedDescriptorHash = computeEffectDescriptorHash(effect);
  if (effect.descriptor_hash !== expectedDescriptorHash) {
    addIssue(
      issues,
      'DESCRIPTOR_MISMATCH',
      `${path}.descriptor_hash`,
      'descriptor hash does not match immutable effect content',
    );
  }
  if (effect.recoverable !== null && effect.recoverable !== undefined) {
    if (!isRecord(effect.recoverable)) {
      addIssue(
        issues,
        'MALFORMED',
        `${path}.recoverable`,
        'must be a typed recoverable line',
      );
    } else if (effect.recoverable.kind === 'scalar') {
      validateBudget(
        effect.recoverable.recoverable_total,
        `${path}.recoverable.recoverable_total`,
        issues,
      );
    } else if (effect.recoverable.kind === 'identity') {
      requireString(
        effect.recoverable.item_id,
        `${path}.recoverable.item_id`,
        issues,
      );
    } else {
      addIssue(
        issues,
        'MALFORMED',
        `${path}.recoverable.kind`,
        'unsupported recoverable-line kind',
      );
    }
  }
  if (
    effect.recoverable
    && (
      envelope.envelope_kind !== 'ece'
      || effect.polarity !== 'adverse'
    )
  ) {
    addIssue(
      issues,
      'MALFORMED',
      `${path}.recoverable`,
      'only adverse ECE consequence effects may establish recoverable lines',
    );
  }
  if (envelope.envelope_kind === 'rce' || envelope.envelope_kind === 'mce') {
    if (!effect.compensation_of) {
      addIssue(
        issues,
        'COMPENSATION_REQUIRED',
        `${path}.compensation_of`,
        `${envelope.envelope_kind.toUpperCase()} effects must reference the effect they compensate`,
      );
    }
    if (effect.polarity !== 'compensating') {
      addIssue(
        issues,
        'MALFORMED',
        `${path}.polarity`,
        'recovery and remediation effects must be compensating',
      );
    }
    if (effect.compensation_of) {
      const expectedRootId =
        envelope.envelope_kind === 'rce'
          ? envelope.original_root_id
          : envelope.target_root_id;
      const allowedEffectIds =
        envelope.envelope_kind === 'rce'
          ? [envelope.reservation.logical_effect_id]
          : envelope.target_effect_ids;
      if (
        effect.compensation_of.root_id !== expectedRootId
        || !allowedEffectIds.includes(
          effect.compensation_of.logical_effect_id,
        )
      ) {
        addIssue(
          issues,
          'COMPENSATION_REQUIRED',
          `${path}.compensation_of`,
          'effect compensation reference is outside the envelope target',
        );
      }
    }
  }
}

function validateScalarDisposition(
  envelope: Extract<AcceptedEnvelope, { envelope_kind: 'rce' }>,
  disposition: RecoveryReservationDisposition | null | undefined,
  outcome: ResolutionRoot['outcome'],
  effectAccounting: BudgetVector,
  issues: ValidationIssue[],
): void {
  if (envelope.reservation.kind !== 'scalar') {
    addIssue(
      issues,
      'MALFORMED',
      'envelope.reservation',
      'scalar disposition validator requires a scalar reservation',
    );
    return;
  }
  const reserved = envelope.reservation.reserved;
  if (!disposition || disposition.kind !== 'scalar') {
    addIssue(
      issues,
      'RCE_RESERVATION_RESIDUAL',
      'root.reservation_disposition',
      'scalar reservation requires scalar terminal disposition',
    );
    return;
  }
  validateBudget(
    disposition.consumed,
    'root.reservation_disposition.consumed',
    issues,
  );
  validateBudget(
    disposition.released,
    'root.reservation_disposition.released',
    issues,
  );
  const disposed = addBudgets([disposition.consumed, disposition.released]);
  if (!budgetsEqual(disposed, reserved)) {
    addIssue(
      issues,
      'RCE_RESERVATION_RESIDUAL',
      'root.reservation_disposition',
      'consumed plus released must equal the full reservation',
    );
  }
  if (outcome === 'resolved' && !budgetsEqual(
    disposition.consumed,
    effectAccounting,
  )) {
    addIssue(
      issues,
      'RCE_RESERVATION_RESIDUAL',
      'root.reservation_disposition.consumed',
      'consumed reservation must equal committed recovery accounting',
    );
  }
  if (
    outcome !== 'resolved'
    && (
      !budgetsEqual(disposition.consumed, {})
      || !budgetsEqual(disposition.released, reserved)
    )
  ) {
    addIssue(
      issues,
      'RCE_RESERVATION_RESIDUAL',
      'root.reservation_disposition',
      'non-resolved recovery must consume nothing and release all',
    );
  }
}

function validateIdentityDisposition(
  disposition: RecoveryReservationDisposition | null | undefined,
  outcome: ResolutionRoot['outcome'],
  hasCommittedRecoveryEffect: boolean,
  issues: ValidationIssue[],
): void {
  if (!disposition || disposition.kind !== 'identity') {
    addIssue(
      issues,
      'RCE_RESERVATION_RESIDUAL',
      'root.reservation_disposition',
      'identity reservation requires identity terminal disposition',
    );
    return;
  }
  if (disposition.consumed === disposition.released) {
    addIssue(
      issues,
      'RCE_RESERVATION_RESIDUAL',
      'root.reservation_disposition',
      'identity reservation must be consumed or released exactly once',
    );
  }
  if (
    outcome !== 'resolved'
    && (disposition.consumed || !disposition.released)
  ) {
    addIssue(
      issues,
      'RCE_RESERVATION_RESIDUAL',
      'root.reservation_disposition',
      'non-resolved identity recovery must release the claim',
    );
  }
  if (
    outcome === 'resolved'
    && (
      (hasCommittedRecoveryEffect && !disposition.consumed)
      || (!hasCommittedRecoveryEffect && !disposition.released)
    )
  ) {
    addIssue(
      issues,
      'RCE_RESERVATION_RESIDUAL',
      'root.reservation_disposition',
      'identity disposition must match whether recovery committed an effect',
    );
  }
}

export function validateRoot(
  envelope: AcceptedEnvelope,
  basis: ResolutionBasis,
  root: ResolutionRoot,
  evidenceResolver?: EvidenceResolver,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireString(root.root_id, 'root.root_id', issues);
  if (!TERMINAL_OUTCOMES.has(root.outcome)) {
    addIssue(
      issues,
      'MALFORMED',
      'root.outcome',
      'unsupported terminal outcome',
    );
  }
  if (root.envelope_id !== envelope.envelope_id) {
    addIssue(
      issues,
      'MISSING_PARENT',
      'root.envelope_id',
      'root must reference its accepted envelope',
    );
  }
  validateArtifactRef(root.policy, 'root.policy', issues, evidenceResolver);
  if (!refsEqual(envelope.policy, root.policy)) {
    addIssue(
      issues,
      'HASH_MISMATCH',
      'root.policy',
      'root policy must equal the immutable envelope policy pin',
    );
  }
  if (EMPTY_MANIFEST_OUTCOMES.has(root.outcome) && root.effect_manifest.length) {
    addIssue(
      issues,
      'OUTCOME_REQUIRES_EMPTY_MANIFEST',
      'root.effect_manifest',
      `${root.outcome} requires an empty manifest`,
    );
  }

  const logicalEffectIds = new Set<string>();
  root.effect_manifest.forEach((effect, index) => {
    validateEffect(envelope, effect, index, issues, evidenceResolver);
    if (logicalEffectIds.has(effect.logical_effect_id)) {
      addIssue(
        issues,
        'MALFORMED',
        `root.effect_manifest[${index}].logical_effect_id`,
        'logical effect IDs must be unique within a root',
      );
    }
    logicalEffectIds.add(effect.logical_effect_id);
  });
  root.causal_input_refs.forEach((ref, index) => {
    validateArtifactRef(
      ref,
      `root.causal_input_refs[${index}]`,
      issues,
      evidenceResolver,
    );
  });
  validateReadSet(root.read_set, 'root.read_set', issues);
  validateWriteSet(root.write_set, 'root.write_set', issues);
  if (
    hashLogicalContent(root.read_set) !== hashLogicalContent(basis.read_set)
  ) {
    addIssue(
      issues,
      'HASH_MISMATCH',
      'root.read_set',
      'root read set must equal the durably bound basis read set',
    );
  }
  if (
    hashLogicalContent(root.write_set)
    !== hashLogicalContent(basis.proposed_write_set)
  ) {
    addIssue(
      issues,
      'HASH_MISMATCH',
      'root.write_set',
      'root write set must equal the durably bound proposed write set',
    );
  }

  const actualAccounting = addBudgets(
    root.effect_manifest.map((effect) => effect.accounting),
  );
  let accountingLimit: BudgetVector;
  if (envelope.envelope_kind === 'ece') {
    accountingLimit = envelope.aggregate_ceiling;
  } else if (envelope.envelope_kind === 'rce') {
    accountingLimit =
      envelope.reservation.kind === 'scalar'
        ? envelope.reservation.reserved
        : {};
  } else {
    accountingLimit = envelope.compensable_delta;
  }
  if (!budgetWithin(actualAccounting, accountingLimit)) {
    addIssue(
      issues,
      'ACCOUNTING_EXCEEDED',
      'root.effect_manifest',
      'effect accounting exceeds the envelope allocation',
    );
  }

  if (envelope.envelope_kind === 'rce') {
    if (envelope.reservation.kind === 'scalar') {
      validateScalarDisposition(
        envelope,
        root.reservation_disposition,
        root.outcome,
        actualAccounting,
        issues,
      );
    } else {
      validateIdentityDisposition(
        root.reservation_disposition,
        root.outcome,
        root.effect_manifest.length > 0,
        issues,
      );
    }
  } else if (root.reservation_disposition) {
    addIssue(
      issues,
      'MALFORMED',
      'root.reservation_disposition',
      'only recovery roots may disposition a recovery reservation',
    );
  }

  return result(issues);
}

export function validateChild(
  root: ResolutionRoot,
  child: ChildEffectEvidence,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (child.root_id !== root.root_id) {
    addIssue(
      issues,
      'MISSING_PARENT',
      'child.root_id',
      'child must reference its root',
    );
  }
  const descriptor = root.effect_manifest[child.ordinal];
  if (!descriptor) {
    addIssue(
      issues,
      'MANIFEST_ORDINAL_INVALID',
      'child.ordinal',
      'child ordinal is not declared by the root manifest',
    );
  } else {
    if (child.logical_effect_id !== descriptor.logical_effect_id) {
      addIssue(
        issues,
        'DESCRIPTOR_MISMATCH',
        'child.logical_effect_id',
        'child logical effect ID differs from the root descriptor',
      );
    }
    if (child.descriptor_hash !== descriptor.descriptor_hash) {
      addIssue(
        issues,
        'DESCRIPTOR_MISMATCH',
        'child.descriptor_hash',
        'child descriptor hash differs from the root descriptor',
      );
    }
  }
  validateJsonValue(child.evidence, 'child.evidence', issues);
  return result(issues);
}

export function firstMissingChildOrdinal(
  root: ResolutionRoot,
  children: readonly ReceiptBackedArtifact<ChildEffectArtifact>[],
): number | null {
  const present = new Set(children.map((record) => record.artifact.child.ordinal));
  for (let ordinal = 0; ordinal < root.effect_manifest.length; ordinal += 1) {
    if (!present.has(ordinal)) return ordinal;
  }
  return null;
}

export function validateSeal(
  root: ResolutionRoot,
  children: readonly ReceiptBackedArtifact<ChildEffectArtifact>[],
  seal: BundleSeal,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (seal.root_id !== root.root_id) {
    addIssue(
      issues,
      'MISSING_PARENT',
      'seal.root_id',
      'seal must reference its root',
    );
  }
  const byOrdinal = new Map<
    number,
    ReceiptBackedArtifact<ChildEffectArtifact>
  >();
  for (const childRecord of children) {
    const ordinal = childRecord.artifact.child.ordinal;
    if (byOrdinal.has(ordinal)) {
      addIssue(
        issues,
        'LOGICAL_KEY_CONFLICT',
        `children[${ordinal}]`,
        'more than one child occupies the same manifest ordinal',
      );
    }
    byOrdinal.set(ordinal, childRecord);
  }
  const orderedHashes: ContentHash[] = [];
  for (let ordinal = 0; ordinal < root.effect_manifest.length; ordinal += 1) {
    const child = byOrdinal.get(ordinal);
    if (!child) {
      addIssue(
        issues,
        'SEAL_INCOMPLETE',
        `children[${ordinal}]`,
        'seal requires one child for every manifest ordinal',
      );
    } else {
      orderedHashes.push(child.receipt_hash);
    }
  }
  if (
    seal.child_receipt_hashes.length !== orderedHashes.length
    || seal.child_receipt_hashes.some(
      (hash, index) => hash !== orderedHashes[index],
    )
  ) {
    addIssue(
      issues,
      'SEAL_INCOMPLETE',
      'seal.child_receipt_hashes',
      'seal hashes must exactly match child receipts in manifest order',
    );
  }
  return result(issues);
}

export function validateReceiptBackedArtifact(
  record: ReceiptBackedArtifact,
  expectedLogicalKey: string,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (record.logical_key !== expectedLogicalKey) {
    addIssue(
      issues,
      'HASH_MISMATCH',
      'record.logical_key',
      'record logical key does not match the artifact',
    );
  }
  if (record.logical_content_hash !== hashLogicalContent(record.artifact)) {
    addIssue(
      issues,
      'HASH_MISMATCH',
      'record.logical_content_hash',
      'logical content hash does not match the immutable artifact',
    );
  }
  validateContentHash(record.receipt_hash, 'record.receipt_hash', issues);
  if (!Number.isSafeInteger(record.sequence) || record.sequence < 1) {
    addIssue(
      issues,
      'MALFORMED',
      'record.sequence',
      'receipt sequence must be a positive safe integer',
    );
  }
  return result(issues);
}

export function isConsequenceArtifact(
  value: unknown,
): value is ConsequenceArtifact {
  if (!isRecord(value) || typeof value.artifact_kind !== 'string') return false;
  if (value.artifact_kind === 'envelope') {
    if (!isRecord(value.envelope)) return false;
    const envelope = value.envelope;
    if (envelope.envelope_kind === 'ece') {
      return (
        Array.isArray(envelope.standing_context_revision_refs)
        && (
          envelope.initiator_ref === null
          || envelope.initiator_ref === undefined
          || isRecord(envelope.initiator_ref)
        )
        && (
          envelope.protection_commitment === null
          || isRecord(envelope.protection_commitment)
        )
      );
    }
    if (envelope.envelope_kind === 'rce') {
      return (
        Array.isArray(envelope.original_effect_ids)
        && Array.isArray(envelope.compensation_of)
        && envelope.compensation_of.every(isRecord)
        && isRecord(envelope.reservation)
        && isRecord(envelope.reservation_authority)
      );
    }
    if (envelope.envelope_kind === 'mce') {
      return (
        Array.isArray(envelope.target_effect_ids)
        && isRecord(envelope.authority)
      );
    }
    return false;
  }
  if (value.artifact_kind === 'resolution_basis') {
    if (!isRecord(value.basis)) return false;
    const basis = value.basis;
    return (
      isRecord(basis.trigger)
      && Array.isArray(basis.standing_context_revision_refs)
      && Array.isArray(basis.disclosure_refs)
      && Array.isArray(basis.read_set)
      && basis.read_set.every(isRecord)
      && Array.isArray(basis.proposed_write_set)
      && basis.proposed_write_set.every(isRecord)
      && (
        basis.rng === null
        || basis.rng === undefined
        || isRecord(basis.rng)
      )
    );
  }
  if (value.artifact_kind === 'resolution_root') {
    if (!isRecord(value.root)) return false;
    const root = value.root;
    return (
      Array.isArray(root.effect_manifest)
      && root.effect_manifest.every(
        (effect) =>
          isRecord(effect)
          && isRecord(effect.payload)
          && (
            effect.compensation_of === null
            || effect.compensation_of === undefined
            || isRecord(effect.compensation_of)
          )
          && (
            effect.recoverable === null
            || effect.recoverable === undefined
            || isRecord(effect.recoverable)
          ),
      )
      && Array.isArray(root.causal_input_refs)
      && Array.isArray(root.read_set)
      && root.read_set.every(isRecord)
      && Array.isArray(root.write_set)
      && root.write_set.every(isRecord)
      && (
        root.reservation_disposition === null
        || root.reservation_disposition === undefined
        || isRecord(root.reservation_disposition)
      )
    );
  }
  if (value.artifact_kind === 'child_effect') {
    return isRecord(value.child);
  }
  if (value.artifact_kind === 'bundle_seal') {
    return (
      isRecord(value.seal)
      && Array.isArray(value.seal.child_receipt_hashes)
    );
  }
  return false;
}
