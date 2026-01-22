/**
 * Fork Primitives — Simulate Without Lying
 *
 * Explicitly non-authoritative branches for counterfactual exploration.
 *
 * The five isolation invariants (enforced in code):
 * 1. Simulated events NEVER have 'confirmed' status
 * 2. Simulated events ALWAYS have 'client_intent' source
 * 3. Simulated event IDs ALWAYS start with 'sim_'
 * 4. Simulated explanations ALWAYS contain '[SIMULATED]' marker
 * 5. Inherited entries precede simulated (no interleaving)
 */

import type {
  Fork,
  ForkMetadata,
  ForkPoint,
  ForkEntry,
  ForkPurpose,
  ForkEntryOrigin,
  WitnessEvent,
  Explanation,
  Snapshot,
  TimelineEntry,
  IsolationViolationType,
} from './types.js';

import { ForkIsolationViolation } from './types.js';

// ============================================================================
// Fork Isolation Validation
// ============================================================================

/**
 * Validate a fork entry maintains isolation invariants.
 *
 * Throws ForkIsolationViolation if any invariant is violated.
 */
export function validateForkEntry<TEvent extends WitnessEvent>(
  entry: ForkEntry<TEvent>
): void {
  // Only validate simulated entries
  if (entry.origin !== 'simulated') return;

  const event = entry.event;
  const explanation = entry.explanation;

  // Invariant 1: Simulated events NEVER have confirmed status
  if (event && event.status === 'confirmed') {
    throw new ForkIsolationViolation(
      'Simulated event cannot have confirmed status',
      'confirmed_simulation',
      { event_id: event.event_id, status: event.status }
    );
  }

  // Invariant 2: Simulated events ALWAYS have client_intent source
  if (event && event.source !== 'client_intent') {
    throw new ForkIsolationViolation(
      'Simulated event must have client_intent source',
      'server_source',
      { event_id: event.event_id, source: event.source }
    );
  }

  // Invariant 3: Simulated event IDs ALWAYS start with 'sim_' or 'fork_'
  if (event && !isSimulatedEventId(event.event_id)) {
    throw new ForkIsolationViolation(
      'Simulated event ID must start with sim_ or fork_',
      'invalid_event_id',
      { event_id: event.event_id }
    );
  }

  // Invariant 4: Simulated explanations ALWAYS contain [SIMULATED]
  if (explanation && !explanation.reason.includes('[SIMULATED]')) {
    throw new ForkIsolationViolation(
      'Simulated explanation must contain [SIMULATED] marker',
      'missing_marker',
      { explanation_id: explanation.explanation_id, reason: explanation.reason }
    );
  }

  // Also check explanation decision is never confirmed
  if (explanation && explanation.decision === 'confirmed') {
    throw new ForkIsolationViolation(
      'Simulated explanation cannot have confirmed decision',
      'confirmed_simulation',
      { explanation_id: explanation.explanation_id, decision: explanation.decision }
    );
  }
}

/**
 * Validate an entire fork maintains isolation invariants.
 */
export function validateFork<TEvent extends WitnessEvent>(
  fork: Fork<TEvent>
): void {
  // Check fork ID format
  if (!isValidForkId(fork.metadata.fork_id)) {
    throw new ForkIsolationViolation(
      'Fork ID must start with fork_ and have additional characters',
      'invalid_fork_id',
      { fork_id: fork.metadata.fork_id }
    );
  }

  // Check all entries
  let seenSimulated = false;

  for (const entry of fork.entries) {
    // Invariant 5: Inherited entries precede simulated
    if (entry.origin === 'inherited' && seenSimulated) {
      throw new ForkIsolationViolation(
        'Inherited entry cannot appear after simulated entry',
        'interleaved_entries',
        { sequence: entry.sequence }
      );
    }

    if (entry.origin === 'simulated') {
      seenSimulated = true;
    }

    // Validate individual entry
    validateForkEntry(entry);
  }
}

/**
 * Check if an event ID indicates a simulated event.
 */
export function isSimulatedEventId(event_id: string): boolean {
  return event_id.startsWith('sim_') || event_id.startsWith('fork_');
}

/**
 * Check if a fork ID has valid format.
 */
export function isValidForkId(fork_id: string): boolean {
  return fork_id.startsWith('fork_') && fork_id.length > 5;
}

// ============================================================================
// Fork Builder
// ============================================================================

/**
 * Create a fork from a timeline at a specific point.
 *
 * Pure function — no side effects.
 */
export function createFork<TEvent extends WitnessEvent>(
  entries: TimelineEntry<TEvent>[],
  branch_sequence: number,
  label: string,
  created_by: string,
  purpose: ForkPurpose = 'what_if',
  description?: string
): Fork<TEvent> {
  const now = Date.now();

  // Find branch entry
  const branch_entry = entries.find(e => e.sequence === branch_sequence);

  // Create metadata
  const metadata: ForkMetadata = {
    fork_id: `fork_${now}_${Math.random().toString(36).slice(2, 8)}`,
    label,
    created_by,
    created_at_ms: now,
    purpose,
    description: description ?? null,
  };

  // Create branch point
  const branch_point: ForkPoint = {
    sequence: branch_sequence,
    event_id: branch_entry?.event?.event_id ?? null,
    state_hash: branch_entry?.snapshot?.state_hash ?? null,
    created_at_ms: now,
  };

  // Create inherited entries (up to and including branch point)
  const fork_entries: ForkEntry<TEvent>[] = entries
    .filter(e => e.sequence <= branch_sequence)
    .map(e => ({
      sequence: e.sequence,
      event: e.event,
      explanation: e.explanation,
      snapshot: e.snapshot,
      origin: 'inherited' as ForkEntryOrigin,
    }));

  const fork: Fork<TEvent> = {
    metadata,
    branch_point,
    entries: fork_entries,
  };

  // Validate before returning
  validateFork(fork);

  return fork;
}

// ============================================================================
// Fork Operations (immutable)
// ============================================================================

/**
 * Append a simulated entry to a fork.
 *
 * Returns a NEW fork (immutable).
 */
export function appendSimulatedEntry<TEvent extends WitnessEvent>(
  fork: Fork<TEvent>,
  entry: ForkEntry<TEvent>
): Fork<TEvent> {
  // Validate it's actually simulated
  if (entry.origin !== 'simulated') {
    throw new ForkIsolationViolation(
      'appendSimulatedEntry requires a simulated entry',
      'invalid_event_id',
      { origin: entry.origin }
    );
  }

  // Validate the entry itself
  validateForkEntry(entry);

  // Check sequence ordering
  const max_sequence = fork.entries.length > 0
    ? Math.max(...fork.entries.map(e => e.sequence))
    : 0;

  if (entry.sequence <= max_sequence) {
    throw new Error(
      `Entry sequence ${entry.sequence} must be greater than max ${max_sequence}`
    );
  }

  // Create new fork with appended entry
  return {
    ...fork,
    entries: [...fork.entries, entry],
  };
}

/**
 * Reset a fork to its branch point (clear all simulated entries).
 *
 * Returns a NEW fork (immutable).
 */
export function resetForkToBase<TEvent extends WitnessEvent>(
  fork: Fork<TEvent>
): Fork<TEvent> {
  return {
    ...fork,
    entries: fork.entries.filter(e => e.origin === 'inherited'),
  };
}

/**
 * Trim a fork to a specific sequence (remove everything after).
 *
 * Returns a NEW fork (immutable).
 */
export function trimForkToSequence<TEvent extends WitnessEvent>(
  fork: Fork<TEvent>,
  sequence: number
): Fork<TEvent> {
  return {
    ...fork,
    entries: fork.entries.filter(e => e.sequence <= sequence),
  };
}

// ============================================================================
// Fork Query Helpers
// ============================================================================

/**
 * Check if a fork has diverged (has simulated entries).
 */
export function hasDiverged<TEvent extends WitnessEvent>(
  fork: Fork<TEvent>
): boolean {
  return fork.entries.some(e => e.origin === 'simulated');
}

/**
 * Get inherited entries.
 */
export function getInheritedEntries<TEvent extends WitnessEvent>(
  fork: Fork<TEvent>
): ForkEntry<TEvent>[] {
  return fork.entries.filter(e => e.origin === 'inherited');
}

/**
 * Get simulated entries.
 */
export function getSimulatedEntries<TEvent extends WitnessEvent>(
  fork: Fork<TEvent>
): ForkEntry<TEvent>[] {
  return fork.entries.filter(e => e.origin === 'simulated');
}

/**
 * Get entry at a specific sequence.
 */
export function getEntryAtSequence<TEvent extends WitnessEvent>(
  fork: Fork<TEvent>,
  sequence: number
): ForkEntry<TEvent> | undefined {
  return fork.entries.find(e => e.sequence === sequence);
}

/**
 * Get the last entry in the fork.
 */
export function getLastEntry<TEvent extends WitnessEvent>(
  fork: Fork<TEvent>
): ForkEntry<TEvent> | undefined {
  return fork.entries.length > 0
    ? fork.entries[fork.entries.length - 1]
    : undefined;
}
