// Absence Receipts — authority snapshot (pure replay of capability receipts).
//
// There is no standalone authority-graph object in the kernel; authority is
// reconstructed by replaying capability_granted / capability_revoked receipts
// (cf. capability/registry.ts applyRegistryReceipt). This module performs that
// reduction PURELY (no shared global registry) so the result is deterministic
// and safe to hash.

import type { CoordinationReceipt } from '../types.js';
import { hashCanonical } from './hash.js';

export interface AuthoritySnapshot {
  /** actor_id -> sorted capability list (actors with no caps are omitted). */
  map: Record<string, string[]>;
  /** blake3 of the canonical map. */
  hash: string;
}

/** Replay capability receipts up to and including `toSeq` into a canonical snapshot. */
export function captureAuthoritySnapshot(
  receipts: CoordinationReceipt[],
  toSeq: number,
): AuthoritySnapshot {
  const caps = new Map<string, Set<string>>();
  for (const r of receipts) {
    if (r.sequence > toSeq) continue;
    const cap = (r.inputs as Record<string, unknown> | undefined)?.capability;
    if (typeof cap !== 'string') continue;
    if (r.action === 'capability_granted') {
      if (!caps.has(r.actor_id)) caps.set(r.actor_id, new Set());
      caps.get(r.actor_id)!.add(cap);
    } else if (r.action === 'capability_revoked') {
      caps.get(r.actor_id)?.delete(cap);
    }
  }

  const map: Record<string, string[]> = {};
  for (const actorId of [...caps.keys()].sort()) {
    const set = caps.get(actorId)!;
    if (set.size > 0) map[actorId] = [...set].sort();
  }
  return { map, hash: hashCanonical(map) };
}

/**
 * True if any capability_granted/revoked receipt falls within [fromSeq, toSeq].
 * Such a transition means the authority snapshot is not stable across the
 * interval, so a single-snapshot absence claim is not provable (v1).
 */
export function hasAuthorityTransition(
  receipts: CoordinationReceipt[],
  fromSeq: number,
  toSeq: number,
): boolean {
  return receipts.some(
    (r) =>
      r.sequence >= fromSeq &&
      r.sequence <= toSeq &&
      (r.action === 'capability_granted' || r.action === 'capability_revoked'),
  );
}
