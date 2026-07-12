/**
 * WLA Conformance Suite
 *
 * Executable validator for RFC WLA-001 Witness-Ledger Architecture.
 *
 * @example
 * ```typescript
 * import { validate, formatResult } from '@akalynth/coordination-kernel/conformance';
 *
 * const result = validate(myImplementation);
 * console.log(formatResult(result));
 *
 * if (!result.conforms) {
 *   process.exit(1);
 * }
 * ```
 *
 * @module conformance
 */
// Validators
export { validate, validateWitnessLite, validateWitnessStandard, validateWitnessFull, } from './validators.js';
// Formatters
export { formatResult, formatResultJson, formatResultMarkdown } from './formatter.js';
// Version
export const CONFORMANCE_SUITE_VERSION = '1.0.0';
export const RFC_VERSION = 'WLA-001';
