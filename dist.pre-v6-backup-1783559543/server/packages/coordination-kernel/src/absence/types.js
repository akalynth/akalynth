// Absence Receipts (`absence_receipt.v1`) — types.
//
// An absence receipt is a CoordinationReceipt with action `absence_receipt`
// whose `inputs` are the AbsenceReceiptInputs below. It proves bounded
// non-observation: "no event matching predicate P appears in committed log
// interval [from_seq..to_seq] under a named authority snapshot." See
// docs/ABSENCE_RECEIPTS.md for the normative spec.
export const ABSENCE_SCHEMA_VERSION = 'absence_receipt.v1';
export const ABSENCE_ACTION = 'absence_receipt';
export const ABSENCE_CODE = {
    OK: 'ABSENCE_OK',
    LOG_GAP: 'ABSENCE_LOG_GAP',
    AUTHORITY_TRANSITION: 'ABSENCE_AUTHORITY_TRANSITION',
    CAPTURE_GAP: 'ABSENCE_CAPTURE_GAP',
    PREDICATE_MISMATCH: 'ABSENCE_PREDICATE_MISMATCH',
    MATCH_FOUND: 'ABSENCE_MATCH_FOUND',
    CHAIN_INVALID: 'ABSENCE_CHAIN_INVALID',
    SCHEMA_INVALID: 'ABSENCE_SCHEMA_INVALID',
};
