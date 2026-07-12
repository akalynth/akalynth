// Absence Receipts — build + emit.
//
// evaluateAbsence(): pure — evaluate a claim over an existing chain and build
// the AbsenceReceiptInputs (the issuer's side of the proof).
// emitAbsenceReceipt(): append an absence_receipt to the chain via the logger.
import { ABSENCE_SCHEMA_VERSION, ABSENCE_ACTION, } from './types.js';
import { evaluatePredicate, predicateHash } from './predicate.js';
import { captureAuthoritySnapshot } from './authority.js';
import { verifyAbsenceClaim } from './verify.js';
export const DEFAULT_ABSENCE_CLAIMS = [
    'No event matching predicate P exists in committed log interval from_seq..to_seq.',
    'The predicate was evaluated against the named authority snapshot.',
    'The interval is a contiguous, hash-verified slice of the committed chain.',
];
export const DEFAULT_ABSENCE_NON_CLAIMS = [
    'Does not prove the event never occurred outside this boundary.',
    'Does not prove capture infrastructure was complete unless capture_completeness_ref is present.',
    'Does not prove the authority snapshot was correct, only that this snapshot was used.',
    'Absence is bound to seq, not time: late capture may add a true event with an earlier timestamp.',
];
/** Pure: build AbsenceReceiptInputs for `params` over `chain`, and self-verify. */
export function evaluateAbsence(chain, params) {
    const { from_seq, to_seq } = params;
    const bySeq = new Map(chain.map((r) => [r.sequence, r]));
    const head = bySeq.get(to_seq);
    const first = bySeq.get(from_seq);
    const snapshot = captureAuthoritySnapshot(chain, to_seq);
    let matched = 0;
    for (let s = from_seq; s <= to_seq; s++) {
        const r = bySeq.get(s);
        if (r && evaluatePredicate(params.predicate, r))
            matched++;
    }
    const inputs = {
        schema_version: ABSENCE_SCHEMA_VERSION,
        boundary: params.boundary,
        interval: {
            from_seq,
            to_seq,
            from_time: params.from_time,
            to_time: params.to_time,
        },
        predicate: {
            predicate_id: params.predicate_id,
            definition: params.predicate,
            canonical_form_hash: predicateHash(params.predicate),
            description: params.description,
        },
        committed_log: {
            log_id: params.log_id,
            head_event_hash: head ? head.event_hash : '',
        },
        authority_context: {
            authority_snapshot_hash: snapshot.hash,
            computed_at_seq: to_seq,
        },
        proof: {
            proof_type: 'bounded_reexecution.v1',
            matched_count: matched,
            slice_first_prev_hash: first ? first.prev_hash : '',
            slice_last_event_hash: head ? head.event_hash : '',
        },
        trust_boundary: {
            claims: DEFAULT_ABSENCE_CLAIMS,
            non_claims: DEFAULT_ABSENCE_NON_CLAIMS,
        },
    };
    const outcome = verifyAbsenceClaim(chain, inputs);
    return { inputs, outcome, result: outcome.result };
}
/**
 * Evaluate an absence claim and append it to the chain as an `absence_receipt`.
 * The CoordinationReceipt.result carries the computed AbsenceResult.
 */
export async function emitAbsenceReceipt(logger, chain, opts) {
    if (opts.require_issuer_capability) {
        const snap = captureAuthoritySnapshot(chain, opts.to_seq);
        const held = snap.map[opts.actor_id] ?? [];
        if (!held.includes(opts.require_issuer_capability)) {
            throw new Error(`actor "${opts.actor_id}" lacks capability "${opts.require_issuer_capability}" to issue an absence receipt`);
        }
    }
    const { inputs, result } = evaluateAbsence(chain, opts);
    return logger.appendReceipt(opts.actor_id, ABSENCE_ACTION, inputs, result);
}
