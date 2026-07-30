#!/usr/bin/env tsx

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import { createAuditLogger, type AuditLogger } from '../src/audit/logger.js';
import {
  artifactForEnvelope,
  classifyLogicalAppend,
  computeEffectDescriptorHash,
  consequenceArtifactFromReceipt,
  foldConsequenceArtifacts,
  hashLogicalContent,
  makeReceiptBackedArtifact,
  toUncheckedConsequenceReceiptInput,
  validateBasis,
  validateEnvelope,
  validateRoot,
  type AcceptedEnvelope,
  type ArtifactRef,
  type BundleSealArtifact,
  type ChildEffectArtifact,
  type ConsequenceArtifact,
  type ContentHash,
  type EffectManifestEntry,
  type EnvelopeArtifact,
  type ExposureCommitmentEnvelope,
  type ReceiptBackedArtifact,
  type RecoveryCommitmentEnvelope,
  type RemediationCommitmentEnvelope,
  type ResolutionBasis,
  type ResolutionBasisArtifact,
  type ResolutionRoot,
  type ResolutionRootArtifact,
  type ValidationCode,
  type ValidationResult,
} from '../src/consequence/index.js';

let testsPassed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    testsPassed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    console.error(`  FAIL  ${name}`);
    throw error;
  }
}

function ref(id: string): ArtifactRef {
  return {
    id,
    content_hash: hashLogicalContent({ artifact_id: id }),
  };
}

const POLICY = ref('risk-policy:v0.3.1');
const DISCLOSURE = ref('risk-disclosure:test');
const PRE_STATE = ref('pre-state:test');
const TRIGGER = ref('trigger:test');
const TERMINAL_BOUNDARY = ref('recovery-terminal:test');

function ece(
  envelopeId = 'exposure:test:1',
  acceptanceKey = 'interaction:test:1:subject:test',
): ExposureCommitmentEnvelope {
  return {
    envelope_kind: 'ece',
    envelope_id: envelopeId,
    subject_id: 'subject:test',
    server_acceptance_key: acceptanceKey,
    policy: POLICY,
    client_correlation_key: null,
    initiator_ref: { kind: 'system', id: 'resolver:test' },
    standing_context_revision_refs: [],
    interaction_id: null,
    acceptance_source: 'typed_resolver',
    risk_declaration: DISCLOSURE,
    protection_commitment: null,
    aggregate_ceiling: { item: 10, reputation: 3 },
    material_context_fingerprint: hashLogicalContent({
      zone: 'contested:test',
    }),
  };
}

function basisFor(envelope: AcceptedEnvelope): ResolutionBasis {
  return {
    envelope_id: envelope.envelope_id,
    canonical_pre_state: PRE_STATE,
    standing_context_revision_refs: [],
    trigger: { kind: 'test_resolution', evidence_ref: TRIGGER },
    server_time_boundary: null,
    policy: envelope.policy,
    disclosure_refs:
      envelope.envelope_kind === 'ece'
        ? [envelope.risk_declaration]
        : [],
    rng: null,
    read_set: [],
    proposed_write_set: [],
  };
}

function effect(
  logicalEffectId: string,
  ordinal: number,
  accounting: Readonly<Record<string, number>>,
  options: {
    polarity?: EffectManifestEntry['polarity'];
    compensationOf?: EffectManifestEntry['compensation_of'];
    recoverable?: EffectManifestEntry['recoverable'];
  } = {},
): EffectManifestEntry {
  const draft: EffectManifestEntry = {
    logical_effect_id: logicalEffectId,
    ordinal,
    consequence_class: 'item',
    payload: {
      kind: 'inline',
      value: { item_id: `item:${logicalEffectId}`, custody: 'drop_locus:test' },
    },
    descriptor_hash: hashLogicalContent({ placeholder: true }),
    accounting,
    polarity: options.polarity ?? 'adverse',
    compensation_of: options.compensationOf ?? null,
    recoverable: options.recoverable ?? null,
  };
  return {
    ...draft,
    descriptor_hash: computeEffectDescriptorHash(draft),
  };
}

function rootFor(
  envelope: AcceptedEnvelope,
  effects: readonly EffectManifestEntry[],
  options: Partial<
    Pick<
      ResolutionRoot,
      'outcome' | 'reservation_disposition' | 'root_id'
    >
  > = {},
): ResolutionRoot {
  return {
    root_id: options.root_id ?? `root:${envelope.envelope_id}`,
    envelope_id: envelope.envelope_id,
    policy: envelope.policy,
    outcome: options.outcome ?? 'resolved',
    effect_manifest: effects,
    causal_input_refs: [TRIGGER],
    read_set: [],
    write_set: [],
    reservation_disposition: options.reservation_disposition ?? null,
  };
}

function syntheticRecord<TArtifact extends ConsequenceArtifact>(
  artifact: TArtifact,
  sequence: number,
): ReceiptBackedArtifact<TArtifact> {
  return makeReceiptBackedArtifact(
    artifact,
    hashLogicalContent({ receipt: sequence, artifact }),
    sequence,
  );
}

function hasCode(validation: ValidationResult, code: ValidationCode): boolean {
  return validation.issues.some((issue) => issue.code === code);
}

function budgetWith(
  dimension: string,
  amount: number,
): Readonly<Record<string, number>> {
  return JSON.parse(
    `{${JSON.stringify(dimension)}:${amount}}`,
  ) as Readonly<Record<string, number>>;
}

function appendArtifact(
  logger: AuditLogger,
  artifact: ConsequenceArtifact,
): ReceiptBackedArtifact {
  const receipt = logger.write(
    toUncheckedConsequenceReceiptInput('subject:test', artifact),
  );
  const parsed = consequenceArtifactFromReceipt(receipt);
  assert.ok(parsed, 'consequence receipt must parse as an artifact');
  return parsed;
}

function readAuditReceipts(receiptPath: string): AuditReceipt[] {
  return fs
    .readFileSync(receiptPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AuditReceipt);
}

function foldReceipts(receipts: readonly AuditReceipt[]) {
  const records = receipts.map((receipt) => {
    const parsed = consequenceArtifactFromReceipt(receipt);
    assert.ok(parsed, 'all focused fixture receipts must be consequence artifacts');
    return parsed;
  });
  return foldConsequenceArtifacts(records, {
    evidence_resolver: () => true,
  });
}

test('canonical logical hash is stable under object key reordering', () => {
  assert.equal(
    hashLogicalContent({ beta: 2, alpha: 1 }),
    hashLogicalContent({ alpha: 1, beta: 2 }),
  );
});

test('same logical key is idempotent only for identical canonical content', () => {
  const envelope = ece();
  const first = syntheticRecord(artifactForEnvelope(envelope), 1);
  const retry = syntheticRecord(artifactForEnvelope(envelope), 2);
  assert.equal(
    classifyLogicalAppend(first, retry),
    'duplicate_identical',
  );

  const changed: ExposureCommitmentEnvelope = {
    ...envelope,
    policy: ref('risk-policy:mutated'),
  };
  const conflict = syntheticRecord(artifactForEnvelope(changed), 3);
  assert.equal(classifyLogicalAppend(first, conflict), 'integrity_fault');

  const folded = foldConsequenceArtifacts([first, conflict], {
    evidence_resolver: () => true,
  });
  assert.equal(folded.integrity_faults.length, 1);
  assert.equal(
    folded.integrity_faults[0]?.code,
    'LOGICAL_KEY_CONFLICT',
  );
  assert.equal(
    folded.episodes.get(envelope.envelope_id)?.envelope
      ?.logical_content_hash,
    first.logical_content_hash,
  );
});

test('root manifest rejects ordinal, logical-ID, and descriptor drift', () => {
  const envelope = ece();
  const basis = basisFor(envelope);
  const good = effect('loss:1', 0, { item: 1 });

  const badOrdinal = { ...good, ordinal: 2 };
  const ordinalResult = validateRoot(
    envelope,
    basis,
    rootFor(envelope, [badOrdinal]),
  );
  assert.ok(hasCode(ordinalResult, 'MANIFEST_ORDINAL_INVALID'));
  assert.ok(hasCode(ordinalResult, 'DESCRIPTOR_MISMATCH'));

  const duplicate = effect('loss:1', 1, { item: 1 });
  const duplicateResult = validateRoot(
    envelope,
    basis,
    rootFor(envelope, [good, duplicate]),
  );
  assert.ok(
    duplicateResult.issues.some(
      (issue) =>
        issue.code === 'MALFORMED'
        && issue.message.includes('logical effect IDs'),
    ),
  );

  const descriptorDrift = {
    ...good,
    payload: {
      kind: 'inline' as const,
      value: { item_id: 'item:changed' },
    },
  };
  const descriptorResult = validateRoot(
    envelope,
    basis,
    rootFor(envelope, [descriptorDrift]),
  );
  assert.ok(hasCode(descriptorResult, 'DESCRIPTOR_MISMATCH'));
});

test('ECE basis preserves accepted disclosure and context bindings', () => {
  const contextRef = ref('standing-context:test:revision:1');
  const envelope: ExposureCommitmentEnvelope = {
    ...ece(
      'exposure:test:basis-binding',
      'interaction:test:basis-binding:subject:test',
    ),
    standing_context_revision_refs: [contextRef],
  };
  const validBasis: ResolutionBasis = {
    ...basisFor(envelope),
    standing_context_revision_refs: [contextRef],
  };
  assert.equal(validateBasis(envelope, validBasis).ok, true);

  const missingContext: ResolutionBasis = {
    ...validBasis,
    standing_context_revision_refs: [],
  };
  assert.ok(
    hasCode(validateBasis(envelope, missingContext), 'HASH_MISMATCH'),
  );

  const changedDisclosure: ResolutionBasis = {
    ...validBasis,
    disclosure_refs: [ref('risk-disclosure:changed')],
  };
  assert.ok(
    hasCode(validateBasis(envelope, changedDisclosure), 'HASH_MISMATCH'),
  );
});

test('runtime validators reject untyped envelope discriminators', () => {
  const invalidExposure = {
    ...ece(
      'exposure:test:invalid-discriminators',
      'interaction:test:invalid-discriminators:subject:test',
    ),
    acceptance_source: 'invented_source',
    initiator_ref: { kind: 'invented_initiator', id: 'actor:test' },
  } as unknown as ExposureCommitmentEnvelope;
  const exposureValidation = validateEnvelope(invalidExposure);
  assert.ok(
    exposureValidation.issues.some(
      (issue) => issue.path === 'envelope.acceptance_source',
    ),
  );
  assert.ok(
    exposureValidation.issues.some(
      (issue) => issue.path === 'envelope.initiator_ref.kind',
    ),
  );

  const recoveryBase: RecoveryCommitmentEnvelope = {
    envelope_kind: 'rce',
    envelope_id: 'recovery:test:invalid-discriminators',
    subject_id: 'subject:test',
    server_acceptance_key:
      'recovery:test:invalid-discriminators:subject:test',
    policy: POLICY,
    original_root_id: 'root:original:invalid-discriminators',
    original_effect_ids: ['loss:item:invalid-discriminators'],
    route: 'self_recovery',
    compensation_of: [
      {
        root_id: 'root:original:invalid-discriminators',
        logical_effect_id: 'loss:item:invalid-discriminators',
      },
    ],
    reservation: {
      kind: 'scalar',
      logical_effect_id: 'loss:item:invalid-discriminators',
      reserved: { item: 1 },
    },
    reservation_authority: { kind: 'subject' },
    terminal_boundary: TERMINAL_BOUNDARY,
  };
  const invalidReservation = {
    ...recoveryBase,
    reservation: {
      kind: 'invented_reservation',
      logical_effect_id: recoveryBase.original_effect_ids[0],
      reserved: { item: 1 },
    },
  } as unknown as RecoveryCommitmentEnvelope;
  assert.ok(
    validateEnvelope(invalidReservation).issues.some(
      (issue) => issue.path === 'envelope.reservation.kind',
    ),
  );

  const invalidAuthority = {
    ...recoveryBase,
    reservation_authority: { kind: 'invented_authority' },
  } as unknown as RecoveryCommitmentEnvelope;
  assert.ok(
    validateEnvelope(invalidAuthority).issues.some(
      (issue) => issue.path === 'envelope.reservation_authority.kind',
    ),
  );

  const invalidRemediation = {
    envelope_kind: 'mce',
    envelope_id: 'remediation:test:invalid-discriminators',
    subject_id: 'subject:test',
    server_acceptance_key:
      'remediation:test:invalid-discriminators:subject:test',
    policy: POLICY,
    target_root_id: 'root:target:invalid-discriminators',
    target_effect_ids: ['loss:item:invalid-discriminators'],
    authority: { kind: 'invented_authority' },
    trigger_evidence: ref('fault:invalid-discriminators'),
    reason: 'invalid authority test',
    scope: 'one target',
    compensable_delta: { item: 1 },
  } as unknown as RemediationCommitmentEnvelope;
  assert.ok(
    validateEnvelope(invalidRemediation).issues.some(
      (issue) => issue.path === 'envelope.authority.kind',
    ),
  );
});

test('runtime validators reject malformed optional envelope and basis fields', () => {
  const envelope = ece(
    'exposure:test:invalid-optional-fields',
    'interaction:test:invalid-optional-fields:subject:test',
  );
  const invalidCorrelation = {
    ...envelope,
    client_correlation_key: 0,
  } as unknown as ExposureCommitmentEnvelope;
  assert.ok(
    validateEnvelope(invalidCorrelation).issues.some(
      (issue) => issue.path === 'envelope.client_correlation_key',
    ),
  );

  const invalidInteraction = {
    ...envelope,
    interaction_id: {},
  } as unknown as ExposureCommitmentEnvelope;
  assert.ok(
    validateEnvelope(invalidInteraction).issues.some(
      (issue) => issue.path === 'envelope.interaction_id',
    ),
  );

  const invalidProtection = {
    ...envelope,
    protection_commitment: false,
  } as unknown as ExposureCommitmentEnvelope;
  assert.ok(
    validateEnvelope(invalidProtection).issues.some(
      (issue) => issue.path === 'envelope.protection_commitment',
    ),
  );

  const invalidTriggerEvidence = {
    ...basisFor(envelope),
    trigger: { kind: 'test_resolution', evidence_ref: false },
  } as unknown as ResolutionBasis;
  assert.ok(
    validateBasis(envelope, invalidTriggerEvidence).issues.some(
      (issue) => issue.path === 'basis.trigger.evidence_ref',
    ),
  );

  const invalidTimeBoundary = {
    ...basisFor(envelope),
    server_time_boundary: 0,
  } as unknown as ResolutionBasis;
  assert.ok(
    validateBasis(envelope, invalidTimeBoundary).issues.some(
      (issue) => issue.path === 'basis.server_time_boundary',
    ),
  );

  const invalidRng = {
    ...basisFor(envelope),
    rng: false,
  } as unknown as ResolutionBasis;
  assert.ok(
    validateBasis(envelope, invalidRng).issues.some(
      (issue) => issue.path === 'basis.rng',
    ),
  );

  const invalidDisposition = {
    ...rootFor(envelope, []),
    reservation_disposition: false,
  } as unknown as ResolutionRoot;
  assert.ok(
    validateRoot(
      envelope,
      basisFor(envelope),
      invalidDisposition,
    ).issues.some(
      (issue) => issue.path === 'root.reservation_disposition',
    ),
  );
});

test('inherited-only artifact references fail closed before canonical hashing', () => {
  const inheritedRef = (id: string): ArtifactRef =>
    Object.create(ref(id)) as ArtifactRef;
  const firstPolicy = inheritedRef('risk-policy:inherited:first');
  const secondPolicy = inheritedRef('risk-policy:inherited:second');
  assert.equal(
    hashLogicalContent(firstPolicy),
    hashLogicalContent(secondPolicy),
    'inherited fields are absent from canonical JSON and must never validate',
  );

  const invalidEnvelope = {
    ...ece(
      'exposure:test:inherited-refs',
      'interaction:test:inherited-refs:subject:test',
    ),
    policy: firstPolicy,
    risk_declaration: inheritedRef('risk-disclosure:inherited'),
  };
  const validation = validateEnvelope(invalidEnvelope);
  assert.ok(
    validation.issues.some((issue) => issue.path === 'envelope.policy'),
  );
  assert.ok(
    validation.issues.some(
      (issue) => issue.path === 'envelope.risk_declaration',
    ),
  );
});

test('effect compensation references fail closed for every envelope kind', () => {
  const envelope = ece(
    'exposure:test:malformed-compensation',
    'interaction:test:malformed-compensation:subject:test',
  );
  const malformedEffect = effect(
    'loss:item:malformed-compensation',
    0,
    { item: 1 },
    {
      compensationOf: { unexpected: 'shape' } as unknown as
        EffectManifestEntry['compensation_of'],
    },
  );
  const validation = validateRoot(
    envelope,
    basisFor(envelope),
    rootFor(envelope, [malformedEffect]),
  );
  assert.ok(
    validation.issues.some(
      (issue) =>
        issue.code === 'MALFORMED'
        && issue.path === 'root.effect_manifest[0].compensation_of.root_id',
    ),
  );
  assert.ok(
    validation.issues.some(
      (issue) =>
        issue.code === 'MALFORMED'
        && issue.path
          === 'root.effect_manifest[0].compensation_of.logical_effect_id',
    ),
  );
});

test('prototype-named accounting cannot bypass an ECE ceiling', () => {
  const envelope: ExposureCommitmentEnvelope = {
    ...ece(
      'exposure:test:prototype-accounting',
      'interaction:test:prototype-accounting:subject:test',
    ),
    aggregate_ceiling: {},
  };
  const dangerousEffect = effect(
    'loss:item:prototype-accounting',
    0,
    budgetWith('constructor', 1),
  );
  assert.ok(
    hasCode(
      validateRoot(
        envelope,
        basisFor(envelope),
        rootFor(envelope, [dangerousEffect]),
      ),
      'ACCOUNTING_EXCEEDED',
    ),
  );
});

test('real canonical receipts survive close/reopen and seal gates projection', () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'akalynth-consequence-kernel-'),
  );
  const receiptPath = path.join(tempDir, 'receipts.jsonl');
  const keyPath = path.join(tempDir, 'chronicle.key');
  fs.writeFileSync(keyPath, Buffer.alloc(32, 0x5a), { mode: 0o600 });

  try {
    const envelope = ece();
    const basis = basisFor(envelope);
    const manifest = [
      effect('loss:item:1', 0, { item: 4 }, {
        recoverable: {
          kind: 'scalar',
          recoverable_total: { item: 4 },
        },
      }),
    ];
    const root = rootFor(envelope, manifest);

    let logger = createAuditLogger({ receiptPath, keyPath });
    appendArtifact(logger, artifactForEnvelope(envelope));
    appendArtifact(logger, {
      artifact_kind: 'resolution_basis',
      basis,
    });
    appendArtifact(logger, {
      artifact_kind: 'resolution_root',
      root,
    });
    logger.close();

    const beforeResume = readAuditReceipts(receiptPath);
    assert.equal(beforeResume.length, 3);
    const rootPrefix = foldReceipts(beforeResume);
    const rootEpisode = rootPrefix.episodes.get(envelope.envelope_id);
    assert.equal(rootEpisode?.authoritative, true);
    assert.equal(rootEpisode?.projection_ready, false);
    assert.equal(rootEpisode?.terminal_outcome, null);

    logger = createAuditLogger({ receiptPath, keyPath });
    const child = appendArtifact(logger, {
      artifact_kind: 'child_effect',
      child: {
        root_id: root.root_id,
        ordinal: 0,
        logical_effect_id: manifest[0]!.logical_effect_id,
        descriptor_hash: manifest[0]!.descriptor_hash,
        evidence: { custody_receipt: 'custody:test:1' },
      },
    });
    appendArtifact(logger, {
      artifact_kind: 'bundle_seal',
      seal: {
        root_id: root.root_id,
        child_receipt_hashes: [child.receipt_hash],
      },
    });
    logger.close();

    const afterResume = readAuditReceipts(receiptPath);
    assert.deepEqual(
      afterResume.map((receipt) => receipt.sequence),
      [1, 2, 3, 4, 5],
    );
    afterResume.slice(1).forEach((receipt, index) => {
      assert.equal(receipt.prev_hash, afterResume[index]!.event_hash);
    });
    const tampered = structuredClone(afterResume[0]!);
    tampered.inputs = {
      ...tampered.inputs,
      logical_key: 'envelope:tampered',
    };
    assert.throws(
      () => consequenceArtifactFromReceipt(tampered),
      /receipt hash failure/,
    );

    const partialChild = foldReceipts(afterResume.slice(0, 4));
    assert.equal(
      partialChild.episodes.get(envelope.envelope_id)?.projection_ready,
      false,
    );

    const completed = foldReceipts(afterResume);
    const completedEpisode = completed.episodes.get(envelope.envelope_id);
    assert.equal(completed.integrity_faults.length, 0);
    assert.equal(completedEpisode?.authoritative, true);
    assert.equal(completedEpisode?.projection_ready, true);
    assert.equal(completedEpisode?.terminal_outcome, 'resolved');

    const replayedTwice = foldReceipts([...afterResume, ...afterResume]);
    assert.equal(replayedTwice.integrity_faults.length, 0);
    assert.equal(
      replayedTwice.episodes.get(envelope.envelope_id)?.projection_ready,
      true,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('physical child interleaving seals only in manifest order', () => {
  const envelope = ece(
    'exposure:test:interleaved',
    'interaction:test:interleaved:subject:test',
  );
  const basis = basisFor(envelope);
  const effects = [
    effect('loss:0', 0, { item: 1 }),
    effect('loss:1', 1, { item: 1 }),
  ];
  const root = rootFor(envelope, effects);
  let sequence = 1;
  const envelopeRecord = syntheticRecord(artifactForEnvelope(envelope), sequence++);
  const basisRecord = syntheticRecord<ResolutionBasisArtifact>(
    { artifact_kind: 'resolution_basis', basis },
    sequence++,
  );
  const rootRecord = syntheticRecord<ResolutionRootArtifact>(
    { artifact_kind: 'resolution_root', root },
    sequence++,
  );
  const childOne = syntheticRecord<ChildEffectArtifact>(
    {
      artifact_kind: 'child_effect',
      child: {
        root_id: root.root_id,
        ordinal: 1,
        logical_effect_id: effects[1]!.logical_effect_id,
        descriptor_hash: effects[1]!.descriptor_hash,
        evidence: { child: 1 },
      },
    },
    sequence++,
  );
  const childZero = syntheticRecord<ChildEffectArtifact>(
    {
      artifact_kind: 'child_effect',
      child: {
        root_id: root.root_id,
        ordinal: 0,
        logical_effect_id: effects[0]!.logical_effect_id,
        descriptor_hash: effects[0]!.descriptor_hash,
        evidence: { child: 0 },
      },
    },
    sequence++,
  );
  const seal = syntheticRecord<BundleSealArtifact>(
    {
      artifact_kind: 'bundle_seal',
      seal: {
        root_id: root.root_id,
        child_receipt_hashes: [
          childZero.receipt_hash,
          childOne.receipt_hash,
        ],
      },
    },
    sequence++,
  );
  const folded = foldConsequenceArtifacts(
    [
      envelopeRecord,
      basisRecord,
      rootRecord,
      childOne,
      childZero,
      seal,
    ],
    { evidence_resolver: () => true },
  );
  assert.equal(folded.integrity_faults.length, 0);
  assert.equal(
    folded.episodes.get(envelope.envelope_id)?.projection_ready,
    true,
  );
});

test('child drift and incomplete or reordered seals cannot project', () => {
  const makePrefix = (
    suffix: string,
    effects: readonly EffectManifestEntry[],
  ): {
    envelope: ExposureCommitmentEnvelope;
    root: ResolutionRoot;
    records: ReceiptBackedArtifact[];
  } => {
    const envelope = ece(
      `exposure:test:seal-negative:${suffix}`,
      `interaction:test:seal-negative:${suffix}:subject:test`,
    );
    const basis = basisFor(envelope);
    const root = rootFor(envelope, effects);
    return {
      envelope,
      root,
      records: [
        syntheticRecord(artifactForEnvelope(envelope), 1),
        syntheticRecord(
          { artifact_kind: 'resolution_basis', basis },
          2,
        ),
        syntheticRecord(
          { artifact_kind: 'resolution_root', root },
          3,
        ),
      ],
    };
  };

  const driftEffect = effect('loss:seal-negative:drift', 0, { item: 1 });
  const drift = makePrefix('drift', [driftEffect]);
  const driftChild = syntheticRecord<ChildEffectArtifact>(
    {
      artifact_kind: 'child_effect',
      child: {
        root_id: drift.root.root_id,
        ordinal: 0,
        logical_effect_id: 'loss:seal-negative:changed',
        descriptor_hash: hashLogicalContent({ descriptor: 'changed' }),
        evidence: { drift: true },
      },
    },
    4,
  );
  const driftFold = foldConsequenceArtifacts(
    [
      ...drift.records,
      driftChild,
      syntheticRecord<BundleSealArtifact>(
        {
          artifact_kind: 'bundle_seal',
          seal: {
            root_id: drift.root.root_id,
            child_receipt_hashes: [driftChild.receipt_hash],
          },
        },
        5,
      ),
    ],
    { evidence_resolver: () => true },
  );
  assert.ok(
    driftFold.integrity_faults.some(
      (issue) => issue.code === 'DESCRIPTOR_MISMATCH',
    ),
  );
  assert.ok(
    driftFold.integrity_faults.some(
      (issue) => issue.code === 'SEAL_INCOMPLETE',
    ),
  );
  assert.equal(
    driftFold.episodes.get(drift.envelope.envelope_id)?.authoritative,
    true,
  );
  assert.equal(
    driftFold.episodes.get(drift.envelope.envelope_id)?.projection_ready,
    false,
  );

  const effects = [
    effect('loss:seal-negative:0', 0, { item: 1 }),
    effect('loss:seal-negative:1', 1, { item: 1 }),
  ];
  const missing = makePrefix('missing', effects);
  const missingChild = syntheticRecord<ChildEffectArtifact>(
    {
      artifact_kind: 'child_effect',
      child: {
        root_id: missing.root.root_id,
        ordinal: 0,
        logical_effect_id: effects[0]!.logical_effect_id,
        descriptor_hash: effects[0]!.descriptor_hash,
        evidence: { child: 0 },
      },
    },
    4,
  );
  const missingFold = foldConsequenceArtifacts(
    [
      ...missing.records,
      missingChild,
      syntheticRecord<BundleSealArtifact>(
        {
          artifact_kind: 'bundle_seal',
          seal: {
            root_id: missing.root.root_id,
            child_receipt_hashes: [missingChild.receipt_hash],
          },
        },
        5,
      ),
    ],
    { evidence_resolver: () => true },
  );
  assert.ok(
    missingFold.integrity_faults.some(
      (issue) =>
        issue.code === 'SEAL_INCOMPLETE'
        && issue.path === 'children[1]',
    ),
  );
  assert.equal(
    missingFold.episodes.get(missing.envelope.envelope_id)
      ?.projection_ready,
    false,
  );

  const reordered = makePrefix('reordered', effects);
  const reorderedChildren = effects.map((manifestEffect, index) =>
    syntheticRecord<ChildEffectArtifact>(
      {
        artifact_kind: 'child_effect',
        child: {
          root_id: reordered.root.root_id,
          ordinal: index,
          logical_effect_id: manifestEffect.logical_effect_id,
          descriptor_hash: manifestEffect.descriptor_hash,
          evidence: { child: index },
        },
      },
      index + 4,
    )
  );
  const reorderedFold = foldConsequenceArtifacts(
    [
      ...reordered.records,
      ...reorderedChildren,
      syntheticRecord<BundleSealArtifact>(
        {
          artifact_kind: 'bundle_seal',
          seal: {
            root_id: reordered.root.root_id,
            child_receipt_hashes: [
              reorderedChildren[1]!.receipt_hash,
              reorderedChildren[0]!.receipt_hash,
            ],
          },
        },
        6,
      ),
    ],
    { evidence_resolver: () => true },
  );
  assert.ok(
    reorderedFold.integrity_faults.some(
      (issue) =>
        issue.code === 'SEAL_INCOMPLETE'
        && issue.path === 'seal.child_receipt_hashes',
    ),
  );
  assert.equal(
    reorderedFold.episodes.get(reordered.envelope.envelope_id)
      ?.authoritative,
    true,
  );
  assert.equal(
    reorderedFold.episodes.get(reordered.envelope.envelope_id)
      ?.projection_ready,
    false,
  );
});

test('empty terminal root still requires and accepts an empty seal', () => {
  const envelope = ece(
    'exposure:test:empty',
    'interaction:test:empty:subject:test',
  );
  const basis = basisFor(envelope);
  const root = rootFor(envelope, [], {
    outcome: 'no_consequence',
  });
  const records: ReceiptBackedArtifact[] = [
    syntheticRecord<EnvelopeArtifact>(artifactForEnvelope(envelope), 1),
    syntheticRecord<ResolutionBasisArtifact>(
      { artifact_kind: 'resolution_basis', basis },
      2,
    ),
    syntheticRecord<ResolutionRootArtifact>(
      { artifact_kind: 'resolution_root', root },
      3,
    ),
  ];
  const unsealed = foldConsequenceArtifacts(records, {
    evidence_resolver: () => true,
  });
  assert.equal(
    unsealed.episodes.get(envelope.envelope_id)?.authoritative,
    true,
  );
  assert.equal(
    unsealed.episodes.get(envelope.envelope_id)?.projection_ready,
    false,
  );

  const sealed = foldConsequenceArtifacts(
    [
      ...records,
      syntheticRecord<BundleSealArtifact>(
        {
          artifact_kind: 'bundle_seal',
          seal: { root_id: root.root_id, child_receipt_hashes: [] },
        },
        4,
      ),
    ],
    { evidence_resolver: () => true },
  );
  assert.equal(sealed.integrity_faults.length, 0);
  assert.equal(
    sealed.episodes.get(envelope.envelope_id)?.terminal_outcome,
    'no_consequence',
  );
});

test('fatal logical conflict quarantines only the affected sealed episode', () => {
  const envelope = ece(
    'exposure:test:quarantine',
    'interaction:test:quarantine:subject:test',
  );
  const basis = basisFor(envelope);
  const root = rootFor(envelope, [], { outcome: 'no_consequence' });
  const validSeal = syntheticRecord<BundleSealArtifact>(
    {
      artifact_kind: 'bundle_seal',
      seal: { root_id: root.root_id, child_receipt_hashes: [] },
    },
    4,
  );
  const conflictingSeal = syntheticRecord<BundleSealArtifact>(
    {
      artifact_kind: 'bundle_seal',
      seal: {
        root_id: root.root_id,
        child_receipt_hashes: [hashLogicalContent({ impossible: true })],
      },
    },
    5,
  );
  const unaffectedEnvelope = ece(
    'exposure:test:unaffected',
    'interaction:test:unaffected:subject:test',
  );
  const unaffectedBasis = basisFor(unaffectedEnvelope);
  const unaffectedRoot = rootFor(unaffectedEnvelope, [], {
    outcome: 'no_consequence',
  });
  const folded = foldConsequenceArtifacts(
    [
      syntheticRecord(artifactForEnvelope(envelope), 1),
      syntheticRecord(
        { artifact_kind: 'resolution_basis', basis },
        2,
      ),
      syntheticRecord(
        { artifact_kind: 'resolution_root', root },
        3,
      ),
      validSeal,
      conflictingSeal,
      syntheticRecord(artifactForEnvelope(unaffectedEnvelope), 6),
      syntheticRecord(
        { artifact_kind: 'resolution_basis', basis: unaffectedBasis },
        7,
      ),
      syntheticRecord(
        { artifact_kind: 'resolution_root', root: unaffectedRoot },
        8,
      ),
      syntheticRecord(
        {
          artifact_kind: 'bundle_seal',
          seal: {
            root_id: unaffectedRoot.root_id,
            child_receipt_hashes: [],
          },
        },
        9,
      ),
    ],
    { evidence_resolver: () => true },
  );
  const episode = folded.episodes.get(envelope.envelope_id);
  assert.ok(
    folded.integrity_faults.some(
      (issue) => issue.code === 'LOGICAL_KEY_CONFLICT',
    ),
  );
  assert.equal(episode?.integrity_quarantined, true);
  assert.equal(episode?.projection_ready, false);
  assert.equal(episode?.terminal_outcome, null);
  assert.equal(
    folded.episodes.get(unaffectedEnvelope.envelope_id)?.projection_ready,
    true,
  );
  assert.equal(
    folded.episodes.get(unaffectedEnvelope.envelope_id)
      ?.integrity_quarantined,
    false,
  );
});

test('malformed and unattributable artifacts fail closed with global quarantine', () => {
  const validEnvelope = ece(
    'exposure:test:global-quarantine',
    'interaction:test:global-quarantine:subject:test',
  );
  const validBasis = basisFor(validEnvelope);
  const validRoot = rootFor(validEnvelope, [], {
    outcome: 'no_consequence',
  });
  const validRecords: ReceiptBackedArtifact[] = [
    syntheticRecord(artifactForEnvelope(validEnvelope), 1),
    syntheticRecord(
      { artifact_kind: 'resolution_basis', basis: validBasis },
      2,
    ),
    syntheticRecord(
      { artifact_kind: 'resolution_root', root: validRoot },
      3,
    ),
    syntheticRecord(
      {
        artifact_kind: 'bundle_seal',
        seal: {
          root_id: validRoot.root_id,
          child_receipt_hashes: [],
        },
      },
      4,
    ),
  ];

  const malformedArtifacts = [
    {
      artifact_kind: 'envelope',
      envelope: {
        ...ece(
          'exposure:test:malformed-envelope',
          'interaction:test:malformed-envelope:subject:test',
        ),
        standing_context_revision_refs: null,
      },
    },
    {
      artifact_kind: 'resolution_basis',
      basis: {
        ...validBasis,
        envelope_id: 'exposure:test:malformed-basis',
        disclosure_refs: null,
      },
    },
    {
      artifact_kind: 'resolution_root',
      root: {
        ...validRoot,
        envelope_id: 'exposure:test:malformed-root',
        effect_manifest: null,
      },
    },
    {
      artifact_kind: 'bundle_seal',
      seal: {
        root_id: 'root:test:malformed-seal',
        child_receipt_hashes: null,
      },
    },
  ] as unknown as ConsequenceArtifact[];
  const malformedRecords = malformedArtifacts.map((artifact, index) =>
    syntheticRecord(artifact, index + 5)
  );
  const unknownRootChild = syntheticRecord<ChildEffectArtifact>(
    {
      artifact_kind: 'child_effect',
      child: {
        root_id: 'root:test:unknown',
        ordinal: 0,
        logical_effect_id: 'effect:test:unknown',
        descriptor_hash: hashLogicalContent({ descriptor: 'unknown' }),
        evidence: { unknown_parent: true },
      },
    },
    9,
  );

  const folded = foldConsequenceArtifacts(
    [...validRecords, ...malformedRecords, unknownRootChild],
    { evidence_resolver: () => true },
  );
  assert.equal(
    folded.integrity_faults.filter(
      (issue) => issue.code === 'MALFORMED',
    ).length,
    malformedArtifacts.length,
  );
  assert.ok(
    folded.integrity_faults.some(
      (issue) =>
        issue.code === 'MISSING_PARENT'
        && issue.episode_id === undefined,
    ),
  );
  const validEpisode = folded.episodes.get(validEnvelope.envelope_id);
  assert.equal(validEpisode?.authoritative, true);
  assert.equal(validEpisode?.integrity_quarantined, true);
  assert.equal(validEpisode?.projection_ready, false);
  assert.equal(validEpisode?.terminal_outcome, null);
});

test('fold requires retrievable evidence, not a hash alone', () => {
  const envelope = ece(
    'exposure:test:missing-evidence',
    'interaction:test:missing-evidence:subject:test',
  );
  const folded = foldConsequenceArtifacts(
    [syntheticRecord(artifactForEnvelope(envelope), 1)],
    {
      evidence_resolver: (artifactRef) =>
        artifactRef.id !== envelope.risk_declaration.id,
    },
  );
  assert.ok(
    folded.integrity_faults.some(
      (issue) =>
        issue.code === 'MISSING_PARENT'
        && issue.path === 'envelope.risk_declaration',
    ),
  );
  assert.equal(folded.episodes.has(envelope.envelope_id), false);
});

test('RCE fold rejects concurrent over-reservation of one recovery line', () => {
  const dimension = '__proto__';
  const originalEnvelope: ExposureCommitmentEnvelope = {
    ...ece(
      'exposure:test:reservation-source',
      'interaction:test:reservation-source:subject:test',
    ),
    aggregate_ceiling: budgetWith(dimension, 10),
  };
  const originalBasis = basisFor(originalEnvelope);
  const originalEffect = effect(
    'loss:item:reservation-source',
    0,
    budgetWith(dimension, 10),
    {
      recoverable: {
        kind: 'scalar',
        recoverable_total: budgetWith(dimension, 10),
      },
    },
  );
  const originalRoot = rootFor(originalEnvelope, [originalEffect]);
  const originalChild = syntheticRecord<ChildEffectArtifact>(
    {
      artifact_kind: 'child_effect',
      child: {
        root_id: originalRoot.root_id,
        ordinal: 0,
        logical_effect_id: originalEffect.logical_effect_id,
        descriptor_hash: originalEffect.descriptor_hash,
        evidence: { custody: 'recovery:test' },
      },
    },
    4,
  );
  const recoveryEnvelope = (
    envelopeId: string,
    reserved: number,
  ): RecoveryCommitmentEnvelope => ({
    envelope_kind: 'rce',
    envelope_id: envelopeId,
    subject_id: 'subject:test',
    server_acceptance_key: `${envelopeId}:accept`,
    policy: POLICY,
    original_root_id: originalRoot.root_id,
    original_effect_ids: [originalEffect.logical_effect_id],
    route: 'self_recovery',
    compensation_of: [
      {
        root_id: originalRoot.root_id,
        logical_effect_id: originalEffect.logical_effect_id,
      },
    ],
    reservation: {
      kind: 'scalar',
      logical_effect_id: originalEffect.logical_effect_id,
      reserved: budgetWith(dimension, reserved),
    },
    reservation_authority: { kind: 'subject' },
    terminal_boundary: TERMINAL_BOUNDARY,
  });
  const firstRecovery = recoveryEnvelope('recovery:test:reserve:1', 7);
  const secondRecovery = recoveryEnvelope('recovery:test:reserve:2', 4);
  const folded = foldConsequenceArtifacts(
    [
      syntheticRecord(artifactForEnvelope(originalEnvelope), 1),
      syntheticRecord(
        { artifact_kind: 'resolution_basis', basis: originalBasis },
        2,
      ),
      syntheticRecord(
        { artifact_kind: 'resolution_root', root: originalRoot },
        3,
      ),
      originalChild,
      syntheticRecord(
        {
          artifact_kind: 'bundle_seal',
          seal: {
            root_id: originalRoot.root_id,
            child_receipt_hashes: [originalChild.receipt_hash],
          },
        },
        5,
      ),
      syntheticRecord(artifactForEnvelope(firstRecovery), 6),
      syntheticRecord(artifactForEnvelope(secondRecovery), 7),
    ],
    { evidence_resolver: () => true },
  );
  assert.ok(
    folded.integrity_faults.some(
      (issue) => issue.code === 'ACCOUNTING_EXCEEDED',
    ),
  );
  assert.equal(
    folded.episodes.get(firstRecovery.envelope_id)?.envelope !== null,
    true,
  );
  assert.equal(folded.episodes.has(secondRecovery.envelope_id), false);
});

test('RCE terminal accounting consumes or releases every reservation', () => {
  const originalRootId = 'root:original:recoverable';
  const originalEffectId = 'loss:item:recoverable';
  const envelope: RecoveryCommitmentEnvelope = {
    envelope_kind: 'rce',
    envelope_id: 'recovery:test:1',
    subject_id: 'subject:test',
    server_acceptance_key: 'recovery:test:1:subject:test',
    policy: POLICY,
    original_root_id: originalRootId,
    original_effect_ids: [originalEffectId],
    route: 'self_recovery',
    compensation_of: [
      { root_id: originalRootId, logical_effect_id: originalEffectId },
    ],
    reservation: {
      kind: 'scalar',
      logical_effect_id: originalEffectId,
      reserved: { item: 10 },
    },
    reservation_authority: { kind: 'subject' },
    terminal_boundary: TERMINAL_BOUNDARY,
  };
  const basis = basisFor(envelope);
  const compensation = effect('recovery:item:1', 0, { item: 4 }, {
    polarity: 'compensating',
    compensationOf: {
      root_id: originalRootId,
      logical_effect_id: originalEffectId,
    },
  });
  const validRoot = rootFor(envelope, [compensation], {
    reservation_disposition: {
      kind: 'scalar',
      consumed: { item: 4 },
      released: { item: 6 },
    },
  });
  assert.equal(validateRoot(envelope, basis, validRoot).ok, true);

  const residual = rootFor(envelope, [compensation], {
    reservation_disposition: {
      kind: 'scalar',
      consumed: { item: 4 },
      released: { item: 5 },
    },
  });
  assert.ok(
    hasCode(validateRoot(envelope, basis, residual), 'RCE_RESERVATION_RESIDUAL'),
  );

  const wrongCompensation = effect(
    'recovery:item:wrong-target',
    0,
    { item: 4 },
    {
      polarity: 'compensating',
      compensationOf: {
        root_id: 'root:wrong',
        logical_effect_id: originalEffectId,
      },
    },
  );
  assert.ok(
    hasCode(
      validateRoot(
        envelope,
        basis,
        rootFor(envelope, [wrongCompensation], {
          reservation_disposition: {
            kind: 'scalar',
            consumed: { item: 4 },
            released: { item: 6 },
          },
        }),
      ),
      'COMPENSATION_REQUIRED',
    ),
  );

  const aborted = rootFor(envelope, [], {
    outcome: 'aborted',
    reservation_disposition: {
      kind: 'scalar',
      consumed: {},
      released: { item: 10 },
    },
  });
  assert.equal(validateRoot(envelope, basis, aborted).ok, true);
});

test('recovery cannot mint a new recoverable consequence line', () => {
  const originalRootId = 'root:original:no-remint';
  const originalEffectId = 'loss:item:no-remint';
  const envelope: RecoveryCommitmentEnvelope = {
    envelope_kind: 'rce',
    envelope_id: 'recovery:test:no-remint',
    subject_id: 'subject:test',
    server_acceptance_key: 'recovery:test:no-remint:subject:test',
    policy: POLICY,
    original_root_id: originalRootId,
    original_effect_ids: [originalEffectId],
    route: 'self_recovery',
    compensation_of: [
      { root_id: originalRootId, logical_effect_id: originalEffectId },
    ],
    reservation: {
      kind: 'scalar',
      logical_effect_id: originalEffectId,
      reserved: { item: 1 },
    },
    reservation_authority: { kind: 'subject' },
    terminal_boundary: TERMINAL_BOUNDARY,
  };
  const compensation = effect('recovery:item:no-remint', 0, { item: 1 }, {
    polarity: 'compensating',
    compensationOf: {
      root_id: originalRootId,
      logical_effect_id: originalEffectId,
    },
    recoverable: {
      kind: 'scalar',
      recoverable_total: { item: 1 },
    },
  });
  const validation = validateRoot(
    envelope,
    basisFor(envelope),
    rootFor(envelope, [compensation], {
      reservation_disposition: {
        kind: 'scalar',
        consumed: { item: 1 },
        released: {},
      },
    }),
  );
  assert.ok(hasCode(validation, 'MALFORMED'));
});

test('same-item recovery claim is consumed or released exactly once', () => {
  const envelope: RecoveryCommitmentEnvelope = {
    envelope_kind: 'rce',
    envelope_id: 'recovery:test:identity',
    subject_id: 'subject:test',
    server_acceptance_key: 'recovery:test:identity:subject:test',
    policy: POLICY,
    original_root_id: 'root:original:identity',
    original_effect_ids: ['loss:item:identity'],
    route: 'custody_transfer',
    compensation_of: [
      {
        root_id: 'root:original:identity',
        logical_effect_id: 'loss:item:identity',
      },
    ],
    reservation: {
      kind: 'identity',
      logical_effect_id: 'loss:item:identity',
      item_id: 'item:identity',
    },
    reservation_authority: { kind: 'subject' },
    terminal_boundary: TERMINAL_BOUNDARY,
  };
  const basis = basisFor(envelope);
  const invalid = rootFor(envelope, [], {
    outcome: 'aborted',
    reservation_disposition: {
      kind: 'identity',
      consumed: true,
      released: true,
    },
  });
  assert.ok(
    hasCode(validateRoot(envelope, basis, invalid), 'RCE_RESERVATION_RESIDUAL'),
  );
});

test('identity recovery enforces item, subject, exclusion, and receipted release', () => {
  const sourceEnvelope = ece(
    'exposure:test:identity-source',
    'interaction:test:identity-source:subject:test',
  );
  const sourceBasis = basisFor(sourceEnvelope);
  const sourceEffect = effect(
    'loss:item:identity-source',
    0,
    { item: 1 },
    {
      recoverable: {
        kind: 'identity',
        item_id: 'item:identity-source',
      },
    },
  );
  const sourceRoot = rootFor(sourceEnvelope, [sourceEffect]);
  const sourceChild = syntheticRecord<ChildEffectArtifact>(
    {
      artifact_kind: 'child_effect',
      child: {
        root_id: sourceRoot.root_id,
        ordinal: 0,
        logical_effect_id: sourceEffect.logical_effect_id,
        descriptor_hash: sourceEffect.descriptor_hash,
        evidence: { custody: 'drop-locus:identity-source' },
      },
    },
    4,
  );
  const sourceRecords: ReceiptBackedArtifact[] = [
    syntheticRecord(artifactForEnvelope(sourceEnvelope), 1),
    syntheticRecord(
      { artifact_kind: 'resolution_basis', basis: sourceBasis },
      2,
    ),
    syntheticRecord(
      { artifact_kind: 'resolution_root', root: sourceRoot },
      3,
    ),
    sourceChild,
    syntheticRecord(
      {
        artifact_kind: 'bundle_seal',
        seal: {
          root_id: sourceRoot.root_id,
          child_receipt_hashes: [sourceChild.receipt_hash],
        },
      },
      5,
    ),
  ];
  const recovery = (
    envelopeId: string,
    itemId: string,
    subjectId = sourceEnvelope.subject_id,
  ): RecoveryCommitmentEnvelope => ({
    envelope_kind: 'rce',
    envelope_id: envelopeId,
    subject_id: subjectId,
    server_acceptance_key: `${envelopeId}:accept`,
    policy: POLICY,
    original_root_id: sourceRoot.root_id,
    original_effect_ids: [sourceEffect.logical_effect_id],
    route: 'custody_transfer',
    compensation_of: [
      {
        root_id: sourceRoot.root_id,
        logical_effect_id: sourceEffect.logical_effect_id,
      },
    ],
    reservation: {
      kind: 'identity',
      logical_effect_id: sourceEffect.logical_effect_id,
      item_id: itemId,
    },
    reservation_authority: { kind: 'subject' },
    terminal_boundary: TERMINAL_BOUNDARY,
  });

  const wrongItem = recovery(
    'recovery:test:identity-wrong-item',
    'item:wrong',
  );
  const wrongSubject = recovery(
    'recovery:test:identity-wrong-subject',
    'item:identity-source',
    'subject:other',
  );
  const released = recovery(
    'recovery:test:identity-released',
    'item:identity-source',
  );
  const releasedBasis = basisFor(released);
  const releasedRoot = rootFor(released, [], {
    outcome: 'aborted',
    reservation_disposition: {
      kind: 'identity',
      consumed: false,
      released: true,
    },
  });
  const reused = recovery(
    'recovery:test:identity-reused',
    'item:identity-source',
  );
  const blocked = recovery(
    'recovery:test:identity-blocked',
    'item:identity-source',
  );

  const folded = foldConsequenceArtifacts(
    [
      ...sourceRecords,
      syntheticRecord(artifactForEnvelope(wrongItem), 6),
      syntheticRecord(artifactForEnvelope(wrongSubject), 7),
      syntheticRecord(artifactForEnvelope(released), 8),
      syntheticRecord(
        { artifact_kind: 'resolution_basis', basis: releasedBasis },
        9,
      ),
      syntheticRecord(
        { artifact_kind: 'resolution_root', root: releasedRoot },
        10,
      ),
      syntheticRecord(
        {
          artifact_kind: 'bundle_seal',
          seal: {
            root_id: releasedRoot.root_id,
            child_receipt_hashes: [],
          },
        },
        11,
      ),
      syntheticRecord(artifactForEnvelope(reused), 12),
      syntheticRecord(artifactForEnvelope(blocked), 13),
    ],
    { evidence_resolver: () => true },
  );

  assert.equal(folded.episodes.has(wrongItem.envelope_id), false);
  assert.equal(folded.episodes.has(wrongSubject.envelope_id), false);
  assert.equal(
    folded.episodes.get(released.envelope_id)?.terminal_outcome,
    'aborted',
  );
  assert.equal(folded.episodes.has(reused.envelope_id), true);
  assert.equal(folded.episodes.has(blocked.envelope_id), false);
  assert.ok(
    folded.integrity_faults.some(
      (issue) =>
        issue.episode_id === wrongSubject.envelope_id
        && issue.path.endsWith('.subject_id'),
    ),
  );
  assert.ok(
    folded.integrity_faults.some(
      (issue) =>
        issue.episode_id === blocked.envelope_id
        && issue.code === 'LOGICAL_KEY_CONFLICT',
    ),
  );
});

test('MCE requires authority and cannot exceed its compensable delta', () => {
  const unauthorized = {
    envelope_kind: 'mce',
    envelope_id: 'remediation:test:unauthorized',
    subject_id: 'subject:test',
    server_acceptance_key: 'remediation:test:unauthorized',
    policy: POLICY,
    target_root_id: 'root:target',
    target_effect_ids: ['loss:target'],
    trigger_evidence: ref('fault:test'),
    reason: 'integrity fault observed',
    scope: 'one effect',
    compensable_delta: { item: 1 },
  } as unknown as RemediationCommitmentEnvelope;
  assert.ok(
    hasCode(validateEnvelope(unauthorized), 'MCE_AUTHORITY_MISSING'),
  );

  const authorized: RemediationCommitmentEnvelope = {
    ...unauthorized,
    envelope_id: 'remediation:test:authorized',
    server_acceptance_key: 'remediation:test:authorized',
    authority: {
      kind: 'decision_receipt',
      decision_receipt_hash: hashLogicalContent({
        authority: 'operator:test',
      }),
    },
  };
  assert.equal(validateEnvelope(authorized).ok, true);
  assert.ok(
    hasCode(
      validateEnvelope(
        authorized,
        (artifactRef) =>
          artifactRef.id
          !== `receipt:${authorized.authority.kind === 'decision_receipt'
            ? authorized.authority.decision_receipt_hash
            : ''}`,
      ),
      'MISSING_PARENT',
    ),
  );
  const basis = basisFor(authorized);
  const excessive = effect('remediation:item:1', 0, { item: 2 }, {
    polarity: 'compensating',
    compensationOf: {
      root_id: authorized.target_root_id,
      logical_effect_id: authorized.target_effect_ids[0]!,
    },
  });
  assert.ok(
    hasCode(
      validateRoot(authorized, basis, rootFor(authorized, [excessive])),
      'ACCOUNTING_EXCEEDED',
    ),
  );
});

test('MCE delta is bounded by committed target accounting', () => {
  const targetEnvelope = ece(
    'exposure:test:mce-delta-target',
    'interaction:test:mce-delta-target:subject:test',
  );
  const targetBasis = basisFor(targetEnvelope);
  const targetEffect = effect('loss:mce-delta-target', 0, { item: 1 });
  const targetRoot = rootFor(targetEnvelope, [targetEffect]);
  const targetChild = syntheticRecord<ChildEffectArtifact>(
    {
      artifact_kind: 'child_effect',
      child: {
        root_id: targetRoot.root_id,
        ordinal: 0,
        logical_effect_id: targetEffect.logical_effect_id,
        descriptor_hash: targetEffect.descriptor_hash,
        evidence: { committed: true },
      },
    },
    4,
  );
  const remediation: RemediationCommitmentEnvelope = {
    envelope_kind: 'mce',
    envelope_id: 'remediation:test:mce-delta-overshoot',
    subject_id: targetEnvelope.subject_id,
    server_acceptance_key:
      'remediation:test:mce-delta-overshoot:subject:test',
    policy: POLICY,
    target_root_id: targetRoot.root_id,
    target_effect_ids: [targetEffect.logical_effect_id],
    authority: {
      kind: 'remediation_policy',
      policy: ref('remediation-policy:mce-delta'),
    },
    trigger_evidence: ref('integrity-fault:mce-delta'),
    reason: 'overshoot rejection test',
    scope: 'one target effect',
    compensable_delta: { item: 2 },
  };
  const folded = foldConsequenceArtifacts(
    [
      syntheticRecord(artifactForEnvelope(targetEnvelope), 1),
      syntheticRecord(
        { artifact_kind: 'resolution_basis', basis: targetBasis },
        2,
      ),
      syntheticRecord(
        { artifact_kind: 'resolution_root', root: targetRoot },
        3,
      ),
      targetChild,
      syntheticRecord(
        {
          artifact_kind: 'bundle_seal',
          seal: {
            root_id: targetRoot.root_id,
            child_receipt_hashes: [targetChild.receipt_hash],
          },
        },
        5,
      ),
      syntheticRecord(artifactForEnvelope(remediation), 6),
    ],
    { evidence_resolver: () => true },
  );
  assert.equal(folded.episodes.has(remediation.envelope_id), false);
  assert.ok(
    folded.integrity_faults.some(
      (issue) =>
        issue.episode_id === remediation.envelope_id
        && issue.code === 'ACCOUNTING_EXCEEDED',
    ),
  );
});

test('MCE cannot become projection-ready while target root is unsealed', () => {
  const targetEnvelope = ece(
    'exposure:test:mce-target',
    'interaction:test:mce-target:subject:test',
  );
  const targetBasis = basisFor(targetEnvelope);
  const targetEffect = effect('loss:mce-target', 0, { item: 1 });
  const targetRoot = rootFor(targetEnvelope, [targetEffect]);
  const remediation: RemediationCommitmentEnvelope = {
    envelope_kind: 'mce',
    envelope_id: 'remediation:test:quarantine',
    subject_id: 'subject:test',
    server_acceptance_key: 'remediation:test:quarantine',
    policy: POLICY,
    target_root_id: targetRoot.root_id,
    target_effect_ids: [targetEffect.logical_effect_id],
    authority: {
      kind: 'remediation_policy',
      policy: ref('remediation-policy:test'),
    },
    trigger_evidence: ref('integrity-fault:test'),
    reason: 'bounded correction',
    scope: 'target effect only',
    compensable_delta: { item: 1 },
  };
  const remediationBasis = basisFor(remediation);
  const remediationRoot = rootFor(remediation, [], {
    outcome: 'no_consequence',
  });

  const records: ReceiptBackedArtifact[] = [
    syntheticRecord(artifactForEnvelope(targetEnvelope), 1),
    syntheticRecord(
      { artifact_kind: 'resolution_basis', basis: targetBasis },
      2,
    ),
    syntheticRecord(
      { artifact_kind: 'resolution_root', root: targetRoot },
      3,
    ),
    syntheticRecord(artifactForEnvelope(remediation), 4),
    syntheticRecord(
      { artifact_kind: 'resolution_basis', basis: remediationBasis },
      5,
    ),
    syntheticRecord(
      { artifact_kind: 'resolution_root', root: remediationRoot },
      6,
    ),
    syntheticRecord(
      {
        artifact_kind: 'bundle_seal',
        seal: {
          root_id: remediationRoot.root_id,
          child_receipt_hashes: [],
        },
      },
      7,
    ),
  ];
  const folded = foldConsequenceArtifacts(records, {
    evidence_resolver: () => true,
  });
  assert.equal(folded.integrity_faults.length, 0);
  assert.equal(
    folded.episodes.get(remediation.envelope_id)?.authoritative,
    true,
  );
  assert.equal(
    folded.episodes.get(remediation.envelope_id)?.projection_ready,
    false,
  );
});

test('source quarantine propagates to sealed recovery and remediation', () => {
  const targetEnvelope = ece(
    'exposure:test:dependent-quarantine',
    'interaction:test:dependent-quarantine:subject:test',
  );
  const targetBasis = basisFor(targetEnvelope);
  const targetEffect = effect(
    'loss:dependent-quarantine',
    0,
    { item: 1 },
    {
      recoverable: {
        kind: 'scalar',
        recoverable_total: { item: 1 },
      },
    },
  );
  const targetRoot = rootFor(targetEnvelope, [targetEffect]);
  const targetChild = syntheticRecord<ChildEffectArtifact>(
    {
      artifact_kind: 'child_effect',
      child: {
        root_id: targetRoot.root_id,
        ordinal: 0,
        logical_effect_id: targetEffect.logical_effect_id,
        descriptor_hash: targetEffect.descriptor_hash,
        evidence: { custody: 'dependent-quarantine:test' },
      },
    },
    4,
  );
  const targetSeal = syntheticRecord<BundleSealArtifact>(
    {
      artifact_kind: 'bundle_seal',
      seal: {
        root_id: targetRoot.root_id,
        child_receipt_hashes: [targetChild.receipt_hash],
      },
    },
    5,
  );

  const recovery: RecoveryCommitmentEnvelope = {
    envelope_kind: 'rce',
    envelope_id: 'recovery:test:dependent-quarantine',
    subject_id: targetEnvelope.subject_id,
    server_acceptance_key:
      'recovery:test:dependent-quarantine:subject:test',
    policy: POLICY,
    original_root_id: targetRoot.root_id,
    original_effect_ids: [targetEffect.logical_effect_id],
    route: 'self_recovery',
    compensation_of: [
      {
        root_id: targetRoot.root_id,
        logical_effect_id: targetEffect.logical_effect_id,
      },
    ],
    reservation: {
      kind: 'scalar',
      logical_effect_id: targetEffect.logical_effect_id,
      reserved: { item: 1 },
    },
    reservation_authority: { kind: 'subject' },
    terminal_boundary: TERMINAL_BOUNDARY,
  };
  const recoveryBasis = basisFor(recovery);
  const recoveryEffect = effect(
    'recovery:dependent-quarantine',
    0,
    { item: 1 },
    {
      polarity: 'compensating',
      compensationOf: {
        root_id: targetRoot.root_id,
        logical_effect_id: targetEffect.logical_effect_id,
      },
    },
  );
  const recoveryRoot = rootFor(recovery, [recoveryEffect], {
    reservation_disposition: {
      kind: 'scalar',
      consumed: { item: 1 },
      released: {},
    },
  });
  const recoveryChild = syntheticRecord<ChildEffectArtifact>(
    {
      artifact_kind: 'child_effect',
      child: {
        root_id: recoveryRoot.root_id,
        ordinal: 0,
        logical_effect_id: recoveryEffect.logical_effect_id,
        descriptor_hash: recoveryEffect.descriptor_hash,
        evidence: { recovered: true },
      },
    },
    9,
  );

  const remediation: RemediationCommitmentEnvelope = {
    envelope_kind: 'mce',
    envelope_id: 'remediation:test:dependent-quarantine',
    subject_id: targetEnvelope.subject_id,
    server_acceptance_key:
      'remediation:test:dependent-quarantine:subject:test',
    policy: POLICY,
    target_root_id: targetRoot.root_id,
    target_effect_ids: [targetEffect.logical_effect_id],
    authority: {
      kind: 'remediation_policy',
      policy: ref('remediation-policy:dependent-quarantine'),
    },
    trigger_evidence: ref('integrity-fault:dependent-quarantine'),
    reason: 'bounded correction',
    scope: 'target effect only',
    compensable_delta: { item: 1 },
  };
  const remediationBasis = basisFor(remediation);
  const remediationRoot = rootFor(remediation, [], {
    outcome: 'no_consequence',
  });

  const conflictingTargetSeal = syntheticRecord<BundleSealArtifact>(
    {
      artifact_kind: 'bundle_seal',
      seal: {
        root_id: targetRoot.root_id,
        child_receipt_hashes: [],
      },
    },
    15,
  );
  const folded = foldConsequenceArtifacts(
    [
      syntheticRecord(artifactForEnvelope(targetEnvelope), 1),
      syntheticRecord(
        { artifact_kind: 'resolution_basis', basis: targetBasis },
        2,
      ),
      syntheticRecord(
        { artifact_kind: 'resolution_root', root: targetRoot },
        3,
      ),
      targetChild,
      targetSeal,
      syntheticRecord(artifactForEnvelope(recovery), 6),
      syntheticRecord(
        { artifact_kind: 'resolution_basis', basis: recoveryBasis },
        7,
      ),
      syntheticRecord(
        { artifact_kind: 'resolution_root', root: recoveryRoot },
        8,
      ),
      recoveryChild,
      syntheticRecord(
        {
          artifact_kind: 'bundle_seal',
          seal: {
            root_id: recoveryRoot.root_id,
            child_receipt_hashes: [recoveryChild.receipt_hash],
          },
        },
        10,
      ),
      syntheticRecord(artifactForEnvelope(remediation), 11),
      syntheticRecord(
        { artifact_kind: 'resolution_basis', basis: remediationBasis },
        12,
      ),
      syntheticRecord(
        { artifact_kind: 'resolution_root', root: remediationRoot },
        13,
      ),
      syntheticRecord(
        {
          artifact_kind: 'bundle_seal',
          seal: {
            root_id: remediationRoot.root_id,
            child_receipt_hashes: [],
          },
        },
        14,
      ),
      conflictingTargetSeal,
    ],
    { evidence_resolver: () => true },
  );

  for (const envelopeId of [
    targetEnvelope.envelope_id,
    recovery.envelope_id,
    remediation.envelope_id,
  ]) {
    const current = folded.episodes.get(envelopeId);
    assert.equal(current?.integrity_quarantined, true);
    assert.equal(current?.projection_ready, false);
    assert.equal(current?.terminal_outcome, null);
  }
});

test('production entrypoint does not activate the consequence kernel', () => {
  const entrypoint = fs.readFileSync(
    path.resolve(import.meta.dirname, '../src/index.ts'),
    'utf8',
  );
  assert.equal(
    entrypoint.includes('/consequence/'),
    false,
    'foundation slice must remain server-private and non-activating',
  );
});

console.log(
  `\n[test:consequence-contracts] all ${testsPassed} cases passed`,
);
