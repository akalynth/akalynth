// Absence Receipts — canonical hashing helper.
//
// Reuses the kernel's canonical JSON serializer and the same `blake3:` prefix
// convention used by receipt content addressing (see ../receipt/hasher.ts), so
// absence-receipt hashes are byte-compatible with the rest of the chain.

import { hashCanonicalJson } from '../receipt/hasher.js';

/** BLAKE3 over canonical JSON of `value`, prefixed `blake3:` (kernel convention). */
export function hashCanonical(value: unknown): string {
  return hashCanonicalJson(value);
}
