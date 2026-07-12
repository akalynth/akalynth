// Absence Receipts — bounded re-execution verifier (the exclusion proof).
//
// Given a committed chain and a set of AbsenceReceiptInputs, independently
// re-verify the claim by: (1) re-executing the chain genesis->to_seq using the
// kernel's own hash/linkage primitives, (2) recomputing the predicate and
// authority-snapshot hashes, (3) re-evaluating the predicate over
// [from_seq..to_seq] and asserting zero matches. No new crypto: reuses
// ../receipt/hasher.ts. See docs/ABSENCE_RECEIPTS.md.
import { verifyReceiptHashes, verifyChainLink, verifyGenesisReceipt, verifyEventSignature, } from '../receipt/hasher.js';
import { ABSENCE_CODE, } from './types.js';
import { evaluatePredicate, predicateHash, validatePredicate } from './predicate.js';
import { captureAuthoritySnapshot, hasAuthorityTransition } from './authority.js';
/**
 * Independently re-verify a single absence claim against the committed chain.
 * Returns a structured, buyer-legible outcome (never asserts global
 * nonexistence — only bounded non-observation).
 */
export function verifyAbsenceClaim(chain, inputs, opts = {}) {
    const findings = [];
    const computed = {
        predicate_hash: '',
        authority_snapshot_hash: '',
        head_event_hash: null,
        slice_first_prev_hash: null,
        slice_last_event_hash: null,
    };
    const finish = (result, extra, matched_count = 0) => ({
        result,
        findings: [...findings, ...extra],
        matched_count,
        computed: { ...computed },
    });
    const invalid = (code, message, data) => finish('absence_invalid', [{ code, severity: 'error', message, data }]);
    const unprovable = (code, message, data) => finish('absence_unprovable', [{ code, severity: 'warn', message, data }]);
    const receipts = [...chain].sort((a, b) => a.sequence - b.sequence);
    const { from_seq, to_seq } = inputs.interval ?? {};
    // ---- schema sanity ----
    if (!Number.isInteger(from_seq) ||
        !Number.isInteger(to_seq) ||
        from_seq < 1 ||
        to_seq < from_seq) {
        return invalid(ABSENCE_CODE.SCHEMA_INVALID, `invalid interval ${from_seq}..${to_seq}`);
    }
    const predCheck = validatePredicate(inputs.predicate?.definition);
    if (!predCheck.ok) {
        return invalid(ABSENCE_CODE.SCHEMA_INVALID, `invalid predicate: ${predCheck.reason}`);
    }
    // ---- contiguity: need a gap-free chain genesis..to_seq ----
    const bySeq = new Map();
    for (const r of receipts)
        bySeq.set(r.sequence, r);
    for (let s = 1; s <= to_seq; s++) {
        if (!bySeq.has(s)) {
            return unprovable(ABSENCE_CODE.LOG_GAP, `missing receipt at sequence ${s} (need contiguous 1..${to_seq})`);
        }
    }
    // ---- chain integrity over genesis..to_seq ----
    const head = bySeq.get(to_seq);
    const first = bySeq.get(from_seq);
    if (!verifyGenesisReceipt(bySeq.get(1))) {
        return invalid(ABSENCE_CODE.CHAIN_INVALID, 'first receipt is not genesis');
    }
    for (let s = 1; s <= to_seq; s++) {
        const r = bySeq.get(s);
        const h = verifyReceiptHashes(r);
        if (!h.ok)
            return invalid(ABSENCE_CODE.CHAIN_INVALID, `hash mismatch at seq ${s}: ${h.reason}`);
        if (s > 1 && !verifyChainLink(bySeq.get(s - 1), r)) {
            return invalid(ABSENCE_CODE.CHAIN_INVALID, `chain link broken at seq ${s}`);
        }
        if (opts.publicKey && !verifyEventSignature(r.prev_hash, r.event_hash, r.signature, opts.publicKey)) {
            return invalid(ABSENCE_CODE.CHAIN_INVALID, `signature invalid at seq ${s}`);
        }
    }
    computed.head_event_hash = head.event_hash;
    computed.slice_first_prev_hash = first.prev_hash;
    computed.slice_last_event_hash = head.event_hash;
    // ---- predicate hash binding ----
    computed.predicate_hash = predicateHash(inputs.predicate.definition);
    if (computed.predicate_hash !== inputs.predicate.canonical_form_hash) {
        return invalid(ABSENCE_CODE.PREDICATE_MISMATCH, 'predicate canonical_form_hash mismatch', {
            computed: computed.predicate_hash,
            claimed: inputs.predicate.canonical_form_hash,
        });
    }
    // ---- authority snapshot binding ----
    const snapshot = captureAuthoritySnapshot(receipts, to_seq);
    computed.authority_snapshot_hash = snapshot.hash;
    if (snapshot.hash !== inputs.authority_context.authority_snapshot_hash) {
        return invalid(ABSENCE_CODE.PREDICATE_MISMATCH, 'authority_snapshot_hash mismatch', {
            computed: snapshot.hash,
            claimed: inputs.authority_context.authority_snapshot_hash,
        });
    }
    // ---- committed-log + slice bindings ----
    if (inputs.committed_log.head_event_hash !== head.event_hash) {
        return invalid(ABSENCE_CODE.PREDICATE_MISMATCH, 'committed_log.head_event_hash mismatch');
    }
    if (inputs.proof.slice_first_prev_hash !== first.prev_hash) {
        return invalid(ABSENCE_CODE.PREDICATE_MISMATCH, 'proof.slice_first_prev_hash mismatch');
    }
    if (inputs.proof.slice_last_event_hash !== head.event_hash) {
        return invalid(ABSENCE_CODE.PREDICATE_MISMATCH, 'proof.slice_last_event_hash mismatch');
    }
    // ---- authority stability across the interval ----
    if (hasAuthorityTransition(receipts, from_seq, to_seq)) {
        return unprovable(ABSENCE_CODE.AUTHORITY_TRANSITION, `authority changed within [${from_seq}..${to_seq}]; segment into per-epoch sub-receipts`);
    }
    // ---- capture completeness is a NON-CLAIM unless separately attested ----
    if (!inputs.boundary.capture_completeness_ref) {
        findings.push({
            code: ABSENCE_CODE.CAPTURE_GAP,
            severity: 'info',
            message: 'capture completeness not attested: claim is bounded to this log only, not "did it happen".',
        });
    }
    // ---- re-execution: the exclusion proof ----
    const matchSeqs = [];
    for (let s = from_seq; s <= to_seq; s++) {
        if (evaluatePredicate(inputs.predicate.definition, bySeq.get(s)))
            matchSeqs.push(s);
    }
    if (matchSeqs.length > 0) {
        return finish('absence_invalid', [
            {
                code: ABSENCE_CODE.MATCH_FOUND,
                severity: 'error',
                message: `predicate matched ${matchSeqs.length} event(s) in [${from_seq}..${to_seq}] — absence claim is false`,
                data: { match_sequences: matchSeqs },
            },
        ], matchSeqs.length);
    }
    if (inputs.proof.matched_count !== 0) {
        return invalid(ABSENCE_CODE.PREDICATE_MISMATCH, `proof.matched_count claims ${inputs.proof.matched_count} but re-execution found 0`);
    }
    return finish('absent', [
        {
            code: ABSENCE_CODE.OK,
            severity: 'info',
            message: `no event matching predicate "${inputs.predicate.predicate_id}" in committed seq range ${from_seq}..${to_seq} under authority snapshot ${snapshot.hash}`,
        },
    ]);
}
