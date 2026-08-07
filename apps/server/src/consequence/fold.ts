import {
  classifyLogicalAppend,
  logicalKeyOf,
} from './hash.js';
import type {
  AcceptedEnvelope,
  BundleSealArtifact,
  ChildEffectArtifact,
  ConsequenceArtifact,
  ConsequenceEpisodeProjection,
  ConsequenceLedgerProjection,
  EnvelopeArtifact,
  ReceiptBackedArtifact,
  ResolutionBasisArtifact,
  ResolutionRootArtifact,
  ValidationIssue,
} from './types.js';
import {
  type EvidenceResolver,
  validateBasis,
  validateChild,
  validateEnvelope,
  isConsequenceArtifact,
  validateReceiptBackedArtifact,
  validateRoot,
  validateSeal,
} from './validate.js';

export interface FoldConsequenceOptions {
  /**
   * Resolves retained policy, disclosure, pre-state, authority, payload, and
   * receipt evidence. A canonical hash without retrievable evidence is not
   * sufficient for this fold.
   */
  readonly evidence_resolver: EvidenceResolver;
}

function integrityIssue(
  code: ValidationIssue['code'],
  path: string,
  message: string,
  episodeId?: string,
): ValidationIssue {
  return episodeId
    ? { code, path, message, episode_id: episodeId }
    : { code, path, message };
}

function episode(
  episodes: Map<string, ConsequenceEpisodeProjection>,
  envelopeId: string,
): ConsequenceEpisodeProjection {
  let current = episodes.get(envelopeId);
  if (!current) {
    current = {
      envelope_id: envelopeId,
      envelope: null,
      basis: null,
      root: null,
      children_by_ordinal: new Map(),
      seal: null,
      authoritative: false,
      projection_ready: false,
      terminal_outcome: null,
      integrity_quarantined: false,
    };
    episodes.set(envelopeId, current);
  }
  return current;
}

function pushValidation(
  target: ValidationIssue[],
  issues: readonly ValidationIssue[],
  episodeId?: string,
): boolean {
  target.push(
    ...issues.map((issue) =>
      episodeId && !issue.episode_id
        ? { ...issue, episode_id: episodeId }
        : issue
    ),
  );
  return issues.length === 0;
}

function findEpisodeByRootId(
  episodes: Map<string, ConsequenceEpisodeProjection>,
  rootId: string,
): ConsequenceEpisodeProjection | null {
  for (const current of episodes.values()) {
    if (current.root?.artifact.root.root_id === rootId) return current;
  }
  return null;
}

function episodeIdForArtifact(
  artifact: ConsequenceArtifact,
  episodes: Map<string, ConsequenceEpisodeProjection>,
): string | undefined {
  switch (artifact.artifact_kind) {
    case 'envelope':
      return artifact.envelope.envelope_id;
    case 'resolution_basis':
      return artifact.basis.envelope_id;
    case 'resolution_root':
      return artifact.root.envelope_id;
    case 'child_effect':
      return findEpisodeByRootId(
        episodes,
        artifact.child.root_id,
      )?.envelope_id;
    case 'bundle_seal':
      return findEpisodeByRootId(
        episodes,
        artifact.seal.root_id,
      )?.envelope_id;
  }
}

function validateRecoveryParent(
  envelope: Extract<AcceptedEnvelope, { envelope_kind: 'rce' }>,
  episodes: Map<string, ConsequenceEpisodeProjection>,
  faults: ValidationIssue[],
): boolean {
  const original = findEpisodeByRootId(episodes, envelope.original_root_id);
  if (!original?.root || !original.seal) {
    faults.push(
      integrityIssue(
        'MISSING_PARENT',
        `envelope:${envelope.envelope_id}.original_root_id`,
        'RCE acceptance requires a sealed original consequence root',
        envelope.envelope_id,
      ),
    );
    return false;
  }
  if (original.envelope?.artifact.envelope.envelope_kind !== 'ece') {
    faults.push(
      integrityIssue(
        'MISSING_PARENT',
        `envelope:${envelope.envelope_id}.original_root_id`,
        'recovery must target an original ECE consequence root',
        envelope.envelope_id,
      ),
    );
    return false;
  }
  if (
    envelope.reservation_authority.kind === 'subject'
    && original.envelope.artifact.envelope.subject_id !== envelope.subject_id
  ) {
    faults.push(
      integrityIssue(
        'MISSING_PARENT',
        `envelope:${envelope.envelope_id}.subject_id`,
        'subject-authorized recovery must belong to the original consequence subject',
        envelope.envelope_id,
      ),
    );
    return false;
  }
  const manifest = original.root.artifact.root.effect_manifest;
  const missing = envelope.original_effect_ids.filter((logicalEffectId) => {
    const effect = manifest.find(
      (entry) => entry.logical_effect_id === logicalEffectId,
    );
    return !effect?.recoverable;
  });
  if (missing.length > 0) {
    faults.push(
      integrityIssue(
        'MISSING_PARENT',
        `envelope:${envelope.envelope_id}.original_effect_ids`,
        `RCE references missing or non-recoverable effects: ${missing.join(', ')}`,
        envelope.envelope_id,
      ),
    );
    return false;
  }
  const reservedEffect = manifest.find(
    (effect) =>
      effect.logical_effect_id === envelope.reservation.logical_effect_id,
  );
  if (!reservedEffect?.recoverable) {
    faults.push(
      integrityIssue(
        'MISSING_PARENT',
        `envelope:${envelope.envelope_id}.reservation.logical_effect_id`,
        'reservation must target a recoverable original line',
        envelope.envelope_id,
      ),
    );
    return false;
  }
  if (envelope.reservation.kind === 'scalar') {
    if (reservedEffect.recoverable.kind !== 'scalar') {
      faults.push(
        integrityIssue(
          'MALFORMED',
          `envelope:${envelope.envelope_id}.reservation`,
          'scalar reservation cannot target an identity recovery line',
          envelope.envelope_id,
        ),
      );
      return false;
    }
    const alreadyAllocated: Record<string, number> = {};
    for (const current of episodes.values()) {
      const prior = current.envelope?.artifact.envelope;
      if (
        prior?.envelope_kind !== 'rce'
        || prior.original_root_id !== envelope.original_root_id
        || prior.reservation.kind !== 'scalar'
        || prior.reservation.logical_effect_id
          !== envelope.reservation.logical_effect_id
      ) {
        continue;
      }
      const disposition = current.root?.artifact.root.reservation_disposition;
      const allocation =
        disposition?.kind === 'scalar'
          ? disposition.consumed
          : prior.reservation.reserved;
      for (const [dimension, amount] of Object.entries(allocation)) {
        alreadyAllocated[dimension] =
          (alreadyAllocated[dimension] ?? 0) + amount;
      }
    }
    for (const [dimension, requested] of Object.entries(
      envelope.reservation.reserved,
    )) {
      const total =
        reservedEffect.recoverable.recoverable_total[dimension] ?? 0;
      if ((alreadyAllocated[dimension] ?? 0) + requested > total) {
        faults.push(
          integrityIssue(
            'ACCOUNTING_EXCEEDED',
            `envelope:${envelope.envelope_id}.reservation.reserved.${dimension}`,
            'recovery reservation exceeds the original unallocated amount',
            envelope.envelope_id,
          ),
        );
        return false;
      }
    }
  } else {
    if (
      reservedEffect.recoverable.kind !== 'identity'
      || reservedEffect.recoverable.item_id !== envelope.reservation.item_id
    ) {
      faults.push(
        integrityIssue(
          'MISSING_PARENT',
          `envelope:${envelope.envelope_id}.reservation.item_id`,
          'identity reservation must match the original recoverable item',
          envelope.envelope_id,
        ),
      );
      return false;
    }
    for (const current of episodes.values()) {
      const prior = current.envelope?.artifact.envelope;
      if (
        prior?.envelope_kind !== 'rce'
        || prior.original_root_id !== envelope.original_root_id
        || prior.reservation.kind !== 'identity'
        || prior.reservation.logical_effect_id
          !== envelope.reservation.logical_effect_id
      ) {
        continue;
      }
      const disposition = current.root?.artifact.root.reservation_disposition;
      if (disposition?.kind !== 'identity' || !disposition.released) {
        faults.push(
          integrityIssue(
            'LOGICAL_KEY_CONFLICT',
            `envelope:${envelope.envelope_id}.reservation.item_id`,
            'same-item recovery identity is already reserved or consumed',
            envelope.envelope_id,
          ),
        );
        return false;
      }
    }
  }
  return true;
}

function addAccounting(
  target: Record<string, number>,
  accounting: Readonly<Record<string, number>>,
): void {
  for (const [dimension, amount] of Object.entries(accounting)) {
    target[dimension] = (target[dimension] ?? 0) + amount;
  }
}

function validateRemediationParent(
  envelope: Extract<AcceptedEnvelope, { envelope_kind: 'mce' }>,
  episodes: Map<string, ConsequenceEpisodeProjection>,
  faults: ValidationIssue[],
): boolean {
  const target = findEpisodeByRootId(episodes, envelope.target_root_id);
  if (!target?.root) {
    faults.push(
      integrityIssue(
        'MISSING_PARENT',
        `envelope:${envelope.envelope_id}.target_root_id`,
        'MCE acceptance requires an authoritative target root',
        envelope.envelope_id,
      ),
    );
    return false;
  }
  const manifestIds = new Set(
    target.root.artifact.root.effect_manifest.map(
      (entry) => entry.logical_effect_id,
    ),
  );
  const missing = envelope.target_effect_ids.filter(
    (logicalEffectId) => !manifestIds.has(logicalEffectId),
  );
  if (missing.length > 0) {
    faults.push(
      integrityIssue(
        'MISSING_PARENT',
        `envelope:${envelope.envelope_id}.target_effect_ids`,
        `MCE references missing target effects: ${missing.join(', ')}`,
        envelope.envelope_id,
      ),
    );
    return false;
  }
  const targetAccounting: Record<string, number> = {};
  for (const effect of target.root.artifact.root.effect_manifest) {
    if (envelope.target_effect_ids.includes(effect.logical_effect_id)) {
      addAccounting(targetAccounting, effect.accounting);
    }
  }
  for (const [dimension, amount] of Object.entries(
    envelope.compensable_delta,
  )) {
    if (amount > (targetAccounting[dimension] ?? 0)) {
      faults.push(
        integrityIssue(
          'ACCOUNTING_EXCEEDED',
          `envelope:${envelope.envelope_id}.compensable_delta.${dimension}`,
          'remediation delta exceeds the targeted committed effect',
          envelope.envelope_id,
        ),
      );
      return false;
    }
  }
  return true;
}

function applyEnvelope(
  record: ReceiptBackedArtifact<EnvelopeArtifact>,
  episodes: Map<string, ConsequenceEpisodeProjection>,
  faults: ValidationIssue[],
  evidenceResolver: EvidenceResolver,
): void {
  const envelopeBody = record.artifact.envelope;
  const validation = validateEnvelope(envelopeBody, evidenceResolver);
  if (!pushValidation(
    faults,
    validation.issues,
    envelopeBody.envelope_id,
  )) return;
  if (
    envelopeBody.envelope_kind === 'rce'
    && !validateRecoveryParent(envelopeBody, episodes, faults)
  ) {
    return;
  }
  if (
    envelopeBody.envelope_kind === 'mce'
    && !validateRemediationParent(envelopeBody, episodes, faults)
  ) {
    return;
  }
  const current = episode(episodes, envelopeBody.envelope_id);
  if (current.envelope) {
    faults.push(
      integrityIssue(
        'LOGICAL_KEY_CONFLICT',
        record.logical_key,
        'an envelope identity is already bound',
        envelopeBody.envelope_id,
      ),
    );
    return;
  }
  current.envelope = record;
}

function applyBasis(
  record: ReceiptBackedArtifact<ResolutionBasisArtifact>,
  episodes: Map<string, ConsequenceEpisodeProjection>,
  faults: ValidationIssue[],
  evidenceResolver: EvidenceResolver,
): void {
  const basis = record.artifact.basis;
  const current = episodes.get(basis.envelope_id);
  if (!current?.envelope) {
    faults.push(
      integrityIssue(
        'MISSING_PARENT',
        record.logical_key,
        'resolution basis requires an accepted envelope',
        basis.envelope_id,
      ),
    );
    return;
  }
  const validation = validateBasis(
    current.envelope.artifact.envelope,
    basis,
    evidenceResolver,
  );
  if (!pushValidation(faults, validation.issues, basis.envelope_id)) return;
  current.basis = record;
}

function applyRoot(
  record: ReceiptBackedArtifact<ResolutionRootArtifact>,
  episodes: Map<string, ConsequenceEpisodeProjection>,
  faults: ValidationIssue[],
  evidenceResolver: EvidenceResolver,
): void {
  const root = record.artifact.root;
  const current = episodes.get(root.envelope_id);
  if (!current?.envelope || !current.basis) {
    faults.push(
      integrityIssue(
        'MISSING_PARENT',
        record.logical_key,
        'resolution root requires an accepted envelope and durable basis',
        root.envelope_id,
      ),
    );
    return;
  }
  const otherRoot = findEpisodeByRootId(episodes, root.root_id);
  if (otherRoot && otherRoot !== current) {
    faults.push(
      integrityIssue(
        'LOGICAL_KEY_CONFLICT',
        `root_id:${root.root_id}`,
        'root identity is already used by another envelope',
        root.envelope_id,
      ),
    );
    return;
  }
  const validation = validateRoot(
    current.envelope.artifact.envelope,
    current.basis.artifact.basis,
    root,
    evidenceResolver,
  );
  if (!pushValidation(faults, validation.issues, root.envelope_id)) return;
  current.root = record;
}

function applyChild(
  record: ReceiptBackedArtifact<ChildEffectArtifact>,
  episodes: Map<string, ConsequenceEpisodeProjection>,
  faults: ValidationIssue[],
): void {
  const child = record.artifact.child;
  const current = findEpisodeByRootId(episodes, child.root_id);
  if (!current?.root) {
    faults.push(
      integrityIssue(
        'MISSING_PARENT',
        record.logical_key,
        'child evidence requires an authoritative root',
      ),
    );
    return;
  }
  const validation = validateChild(current.root.artifact.root, child);
  if (!pushValidation(
    faults,
    validation.issues,
    current.envelope_id,
  )) return;
  current.children_by_ordinal.set(child.ordinal, record);
}

function applySeal(
  record: ReceiptBackedArtifact<BundleSealArtifact>,
  episodes: Map<string, ConsequenceEpisodeProjection>,
  faults: ValidationIssue[],
): void {
  const seal = record.artifact.seal;
  const current = findEpisodeByRootId(episodes, seal.root_id);
  if (!current?.root) {
    faults.push(
      integrityIssue(
        'MISSING_PARENT',
        record.logical_key,
        'bundle seal requires an authoritative root',
      ),
    );
    return;
  }
  const validation = validateSeal(
    current.root.artifact.root,
    [...current.children_by_ordinal.values()],
    seal,
  );
  if (!pushValidation(
    faults,
    validation.issues,
    current.envelope_id,
  )) return;
  current.seal = record;
}

function applyArtifact(
  record: ReceiptBackedArtifact,
  episodes: Map<string, ConsequenceEpisodeProjection>,
  faults: ValidationIssue[],
  evidenceResolver: EvidenceResolver,
): void {
  switch (record.artifact.artifact_kind) {
    case 'envelope':
      applyEnvelope(
        record as ReceiptBackedArtifact<EnvelopeArtifact>,
        episodes,
        faults,
        evidenceResolver,
      );
      return;
    case 'resolution_basis':
      applyBasis(
        record as ReceiptBackedArtifact<ResolutionBasisArtifact>,
        episodes,
        faults,
        evidenceResolver,
      );
      return;
    case 'resolution_root':
      applyRoot(
        record as ReceiptBackedArtifact<ResolutionRootArtifact>,
        episodes,
        faults,
        evidenceResolver,
      );
      return;
    case 'child_effect':
      applyChild(
        record as ReceiptBackedArtifact<ChildEffectArtifact>,
        episodes,
        faults,
      );
      return;
    case 'bundle_seal':
      applySeal(
        record as ReceiptBackedArtifact<BundleSealArtifact>,
        episodes,
        faults,
      );
  }
}

function finalizeEpisodes(
  episodes: Map<string, ConsequenceEpisodeProjection>,
  integrityFaults: readonly ValidationIssue[],
): void {
  const quarantineAll = integrityFaults.some((issue) => !issue.episode_id);
  const quarantinedEpisodeIds = new Set(
    integrityFaults
      .map((issue) => issue.episode_id)
      .filter((episodeId): episodeId is string => Boolean(episodeId)),
  );
  for (const current of episodes.values()) {
    current.authoritative = current.root !== null;
    current.integrity_quarantined =
      quarantineAll || quarantinedEpisodeIds.has(current.envelope_id);
    current.projection_ready =
      current.seal !== null && !current.integrity_quarantined;
    current.terminal_outcome = current.projection_ready
      ? current.root?.artifact.root.outcome ?? null
      : null;
  }

  let dependencyStateChanged = true;
  while (dependencyStateChanged) {
    dependencyStateChanged = false;
    for (const current of episodes.values()) {
      if (!current.projection_ready) continue;

      const envelope = current.envelope?.artifact.envelope;
      const dependencyRootId =
        envelope?.envelope_kind === 'rce'
          ? envelope.original_root_id
          : envelope?.envelope_kind === 'mce'
            ? envelope.target_root_id
            : null;
      if (!dependencyRootId) continue;

      const dependency = findEpisodeByRootId(episodes, dependencyRootId);
      if (dependency?.projection_ready) continue;

      current.projection_ready = false;
      current.terminal_outcome = null;
      if (dependency?.integrity_quarantined) {
        current.integrity_quarantined = true;
      }
      dependencyStateChanged = true;
    }
  }

  for (const current of episodes.values()) {
    const envelope = current.envelope?.artifact.envelope;
    if (
      envelope?.envelope_kind === 'mce'
      && current.projection_ready
    ) {
      const target = findEpisodeByRootId(episodes, envelope.target_root_id);
      if (!target?.seal) {
        current.projection_ready = false;
        current.terminal_outcome = null;
      }
    }
  }
}

/**
 * Deterministically reconstruct consequence episode state from canonical
 * receipt-backed artifacts. Physical interleaving between episodes is safe;
 * causality is explicit through envelope/root references.
 */
export function foldConsequenceArtifacts(
  records: readonly ReceiptBackedArtifact[],
  options: FoldConsequenceOptions,
): ConsequenceLedgerProjection {
  const episodes = new Map<string, ConsequenceEpisodeProjection>();
  const integrityFaults: ValidationIssue[] = [];
  const byLogicalKey = new Map<string, ReceiptBackedArtifact>();

  for (const record of records) {
    if (!isConsequenceArtifact(record.artifact)) {
      integrityFaults.push(
        integrityIssue(
          'MALFORMED',
          'record.artifact',
          'receipt-backed consequence artifact is not structurally valid',
        ),
      );
      continue;
    }
    const keyValidation = validateReceiptBackedArtifact(
      record,
      logicalKeyOf(record.artifact),
    );
    if (!pushValidation(
      integrityFaults,
      keyValidation.issues,
      episodeIdForArtifact(record.artifact, episodes),
    )) continue;

    const existing = byLogicalKey.get(record.logical_key);
    const classification = classifyLogicalAppend(existing, record);
    if (classification === 'duplicate_identical') continue;
    if (classification === 'integrity_fault') {
      const affectedEpisodeIds = new Set(
        [existing, record]
          .map((candidate) =>
            candidate
              ? episodeIdForArtifact(candidate.artifact, episodes)
              : undefined
          )
          .filter((episodeId): episodeId is string => Boolean(episodeId)),
      );
      if (affectedEpisodeIds.size === 0) {
        integrityFaults.push(
          integrityIssue(
            'LOGICAL_KEY_CONFLICT',
            record.logical_key,
            'same logical key carries different canonical content',
          ),
        );
      } else {
        for (const episodeId of affectedEpisodeIds) {
          integrityFaults.push(
            integrityIssue(
              'LOGICAL_KEY_CONFLICT',
              record.logical_key,
              'same logical key carries different canonical content',
              episodeId,
            ),
          );
        }
      }
      continue;
    }

    byLogicalKey.set(record.logical_key, record);
    applyArtifact(
      record,
      episodes,
      integrityFaults,
      options.evidence_resolver,
    );
  }

  finalizeEpisodes(episodes, integrityFaults);
  const integrityQuarantinedEpisodeIds = new Set(
    [...episodes.values()]
      .filter((current) => current.integrity_quarantined)
      .map((current) => current.envelope_id),
  );
  return {
    episodes,
    integrity_faults: integrityFaults,
    integrity_quarantined_episode_ids: integrityQuarantinedEpisodeIds,
  };
}

export function artifactForEnvelope(
  envelope: AcceptedEnvelope,
): ConsequenceArtifact {
  return { artifact_kind: 'envelope', envelope };
}
