// Absence Receipts (`absence_receipt.v1`) — public surface.
// See docs/ABSENCE_RECEIPTS.md for the normative spec.

export * from './types.js';
export { hashCanonical } from './hash.js';
export { evaluatePredicate, predicateHash, validatePredicate } from './predicate.js';
export { captureAuthoritySnapshot, hasAuthorityTransition, type AuthoritySnapshot } from './authority.js';
export { verifyAbsenceClaim, type VerifyAbsenceOpts } from './verify.js';
export {
  evaluateAbsence,
  emitAbsenceReceipt,
  DEFAULT_ABSENCE_CLAIMS,
  DEFAULT_ABSENCE_NON_CLAIMS,
  type BuildAbsenceParams,
  type AbsenceEvaluation,
  type EmitAbsenceOptions,
} from './emit.js';
