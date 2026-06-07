// Absence Receipts — pure, restricted predicate evaluation + hashing.

import type { CoordinationReceipt } from '../types.js';
import type { Predicate } from './types.js';
import { hashCanonical } from './hash.js';

/** Receipt fields a predicate may read. `inputs` allows dotted sub-paths. */
const ALLOWED_ROOTS = new Set(['action', 'actor_id', 'result', 'inputs']);
const MAX_DEPTH = 32;

/** Canonical predicate hash: blake3(canonicalize(predicate)). */
export function predicateHash(predicate: Predicate): string {
  return hashCanonical(predicate);
}

/** Structural equality over JSON values via canonical hashing (pure, order-stable). */
function jsonEqual(a: unknown, b: unknown): boolean {
  return hashCanonical(a) === hashCanonical(b);
}

/**
 * Resolve a dotted field path against the receipt's allowed surface, using
 * own-property access only (no prototype walking). Non-`inputs` roots are
 * scalar and reject sub-paths.
 */
function resolveField(
  receipt: CoordinationReceipt,
  field: string,
): { found: boolean; value: unknown } {
  const parts = field.split('.');
  const root = parts[0];
  if (!ALLOWED_ROOTS.has(root)) return { found: false, value: undefined };
  if (root !== 'inputs' && parts.length > 1) return { found: false, value: undefined };

  let cur: unknown =
    root === 'action'
      ? receipt.action
      : root === 'actor_id'
        ? receipt.actor_id
        : root === 'result'
          ? receipt.result
          : receipt.inputs;

  for (let i = 1; i < parts.length; i++) {
    if (cur === null || typeof cur !== 'object') return { found: false, value: undefined };
    const obj = cur as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(obj, parts[i])) {
      return { found: false, value: undefined };
    }
    cur = obj[parts[i]];
  }
  return { found: true, value: cur };
}

/** Evaluate a (validated) predicate against a single receipt. Pure. */
export function evaluatePredicate(predicate: Predicate, receipt: CoordinationReceipt): boolean {
  switch (predicate.op) {
    case 'eq': {
      const r = resolveField(receipt, predicate.field);
      return r.found && jsonEqual(r.value, predicate.value);
    }
    case 'in': {
      const r = resolveField(receipt, predicate.field);
      return r.found && predicate.value.some((v) => jsonEqual(r.value, v));
    }
    case 'exists':
      return resolveField(receipt, predicate.field).found;
    case 'and':
      return predicate.clauses.every((c) => evaluatePredicate(c, receipt));
    case 'or':
      return predicate.clauses.some((c) => evaluatePredicate(c, receipt));
    case 'not':
      return !evaluatePredicate(predicate.clause, receipt);
    default:
      return false;
  }
}

function validField(field: string): { ok: boolean; reason?: string } {
  const root = field.split('.')[0];
  if (!ALLOWED_ROOTS.has(root)) return { ok: false, reason: `field root not allowed: ${root}` };
  if (root !== 'inputs' && field.includes('.')) {
    return { ok: false, reason: `field "${root}" has no sub-fields` };
  }
  return { ok: true };
}

/**
 * Structural validation: ensures the value is a well-formed predicate using
 * only the allowed operators and field roots (defends against impure or
 * malformed predicates before evaluation/hashing).
 */
export function validatePredicate(predicate: unknown, depth = 0): { ok: boolean; reason?: string } {
  if (depth > MAX_DEPTH) return { ok: false, reason: 'predicate nesting too deep' };
  if (predicate === null || typeof predicate !== 'object') {
    return { ok: false, reason: 'predicate must be an object' };
  }
  const p = predicate as Record<string, unknown>;
  switch (p.op) {
    case 'eq':
      if (typeof p.field !== 'string') return { ok: false, reason: 'eq.field must be a string' };
      return validField(p.field);
    case 'in':
      if (typeof p.field !== 'string') return { ok: false, reason: 'in.field must be a string' };
      if (!Array.isArray(p.value)) return { ok: false, reason: 'in.value must be an array' };
      return validField(p.field);
    case 'exists':
      if (typeof p.field !== 'string') return { ok: false, reason: 'exists.field must be a string' };
      return validField(p.field);
    case 'and':
    case 'or': {
      if (!Array.isArray(p.clauses) || p.clauses.length === 0) {
        return { ok: false, reason: `${p.op}.clauses must be a non-empty array` };
      }
      for (const c of p.clauses) {
        const r = validatePredicate(c, depth + 1);
        if (!r.ok) return r;
      }
      return { ok: true };
    }
    case 'not':
      return validatePredicate(p.clause, depth + 1);
    default:
      return { ok: false, reason: `unknown predicate op: ${String(p.op)}` };
  }
}
