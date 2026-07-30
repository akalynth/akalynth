#!/usr/bin/env tsx
/* eslint-disable no-console */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createPublicKeyFromSeed,
  GENESIS_MARKER,
  verifyChainLink,
  verifyEventSignature,
  verifyGenesisReceipt,
  verifyReceiptHashes,
} from '@akalynth/coordination-kernel';
import type { CoordinationReceipt } from '@akalynth/coordination-kernel';

interface Args {
  receipts: string;
  key: string;
  exception: string;
  copiedFromCanonical?: string;
  testFixtureAuthority: boolean;
  json: boolean;
}

interface BoundaryReceipt {
  sequence: number;
  timestamp: string;
  actor_id: string;
  action: string;
  prev_hash: string;
  event_hash: string;
}

interface ReceiptKeyException {
  schema_version: 'akalynth.receipt_key_exception.v1';
  exception_id: string;
  status: 'approved_bounded_exception';
  authority: {
    kind: 'project_owner';
    evidence: string;
  };
  lane: 'beta';
  canonical_chain: string;
  scope: {
    signature_not_verifiable: {
      from_sequence: 1;
      to_sequence: number;
    };
    current_key_required: {
      from_sequence: number;
      through: 'chain_head';
    };
    allowed_failure: 'historical_signature_key_unavailable';
    hash_link_sequence_exceptions: 0;
  };
  historical_prefix_custody: {
    through_sequence: number;
    byte_length: number;
    sha256: string;
    framing: 'exact_jsonl_bytes_including_signatures';
  };
  boundary: {
    before: BoundaryReceipt;
    after: BoundaryReceipt;
    link_matches: true;
  };
  current_verifying_key: {
    fingerprint_algorithm: 'sha256(raw_ed25519_public_key_32_bytes)';
    fingerprint: string;
    required_from_sequence: number;
  };
  observations: {
    current_key_mtime_utc: string;
    prior_key_available: false;
    rotation_receipt_found: false;
    cause_status: 'unknown_historical_key_transition';
  };
  nonclaims: string[];
}

const REQUIRED_NONCLAIMS = [
  'Signatures in the exception range are not authenticated.',
  'Receipts in the exception range may not be rewritten, re-signed, removed, or reordered.',
  'No hash, link, sequence, or JSONL framing failure is excused.',
  'No signature failure after the exception range is excused.',
  'The exception cannot expand to future sequences or other lanes.',
] as const;

const APPROVED_EXCEPTION = {
  id: 'beta.receipts.historical-key-gap.seq-1-48.v1',
  sha256: 'e314f2297df493e207b644f4a954b6c363ea16c1bd69b82d202740a826e83a5b',
  canonicalChain: '/var/lib/akalynth-beta/audit/receipts.jsonl',
  exceptionEnd: 48,
  currentStart: 49,
  historicalPrefixBytes: 33195,
  historicalPrefixSha256:
    '9b82d24a1d6113779a6e070b101d7fe138c4f2748f582f132e61f222464ec030',
  publicKeyFingerprint:
    'sha256:16b9c6a3d97f86d9cc244958f684153d575a7d7e4d053a327a78d0106498f428',
  relativeArtifact:
    'docs/decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/receipt-key-exception.v1.json',
} as const;

function fail(message: string): never {
  console.error(`[verify:receipt-key-epoch] FAIL ${message}`);
  process.exit(1);
}

function valueAfter(args: string[], name: string): string {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) fail(`missing required ${name}`);
  return args[index + 1];
}

function optionalValueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1]) fail(`missing value for ${name}`);
  return args[index + 1];
}

function resolveArgumentPath(value: string): string {
  if (path.isAbsolute(value)) return value;
  return path.resolve(process.env.INIT_CWD || process.cwd(), value);
}

function parseArgs(argv: string[]): Args {
  return {
    receipts: resolveArgumentPath(valueAfter(argv, '--receipts')),
    key: resolveArgumentPath(valueAfter(argv, '--key')),
    exception: resolveArgumentPath(valueAfter(argv, '--exception')),
    copiedFromCanonical: optionalValueAfter(argv, '--copied-from-canonical'),
    testFixtureAuthority: argv.includes('--test-fixture-authority'),
    json: argv.includes('--json'),
  };
}

function expectObject(
  value: unknown,
  label: string,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const object = value as Record<string, unknown>;
  const actualKeys = Object.keys(object).sort();
  const requiredKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== requiredKeys.length ||
    actualKeys.some((key, index) => key !== requiredKeys[index])
  ) {
    fail(`${label} fields must be exactly: ${requiredKeys.join(', ')}`);
  }
  return object;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function expectUtcTimestamp(value: unknown, label: string): string {
  const timestamp = expectString(value, label);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(timestamp) ||
    Number.isNaN(Date.parse(timestamp))
  ) {
    fail(`${label} must be a valid UTC RFC 3339 timestamp`);
  }
  return timestamp;
}

function expectInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) fail(`${label} must be a safe integer`);
  return value as number;
}

function expectLiteral<T extends string | number | boolean>(
  value: unknown,
  expected: T,
  label: string,
): T {
  if (value !== expected) fail(`${label} must equal ${JSON.stringify(expected)}`);
  return expected;
}

function validateBoundaryReceipt(value: unknown, label: string): BoundaryReceipt {
  const object = expectObject(value, label, [
    'sequence',
    'timestamp',
    'actor_id',
    'action',
    'prev_hash',
    'event_hash',
  ]);
  const receipt = {
    sequence: expectInteger(object.sequence, `${label}.sequence`),
    timestamp: expectUtcTimestamp(object.timestamp, `${label}.timestamp`),
    actor_id: expectString(object.actor_id, `${label}.actor_id`),
    action: expectString(object.action, `${label}.action`),
    prev_hash: expectString(object.prev_hash, `${label}.prev_hash`),
    event_hash: expectString(object.event_hash, `${label}.event_hash`),
  };
  if (
    !/^blake3:[0-9a-f]{64}$/.test(receipt.prev_hash) &&
    !(receipt.sequence === 1 && receipt.prev_hash === GENESIS_MARKER)
  ) {
    fail(`${label}.prev_hash must be genesis or a lowercase blake3 hash`);
  }
  if (!/^blake3:[0-9a-f]{64}$/.test(receipt.event_hash)) {
    fail(`${label}.event_hash must be a lowercase blake3 hash`);
  }
  return receipt;
}

function validateException(value: unknown): ReceiptKeyException {
  const root = expectObject(value, 'exception', [
    '$schema',
    'schema_version',
    'exception_id',
    'status',
    'authority',
    'lane',
    'canonical_chain',
    'scope',
    'historical_prefix_custody',
    'boundary',
    'current_verifying_key',
    'observations',
    'nonclaims',
  ]);
  expectLiteral(
    root.$schema,
    './receipt-key-exception.v1.schema.json',
    'exception.$schema',
  );
  const schemaVersion = expectLiteral(
    root.schema_version,
    'akalynth.receipt_key_exception.v1',
    'exception.schema_version',
  );
  const status = expectLiteral(
    root.status,
    'approved_bounded_exception',
    'exception.status',
  );
  const lane = expectLiteral(root.lane, 'beta', 'exception.lane');

  const authorityBody = expectObject(root.authority, 'exception.authority', [
    'kind',
    'evidence',
  ]);
  const authority = {
    kind: expectLiteral(authorityBody.kind, 'project_owner', 'exception.authority.kind'),
    evidence: expectString(authorityBody.evidence, 'exception.authority.evidence'),
  };

  const scopeBody = expectObject(root.scope, 'exception.scope', [
    'signature_not_verifiable',
    'current_key_required',
    'allowed_failure',
    'hash_link_sequence_exceptions',
  ]);
  const historicalBody = expectObject(
    scopeBody.signature_not_verifiable,
    'exception.scope.signature_not_verifiable',
    ['from_sequence', 'to_sequence'],
  );
  const currentBody = expectObject(
    scopeBody.current_key_required,
    'exception.scope.current_key_required',
    ['from_sequence', 'through'],
  );
  const exceptionEnd = expectInteger(
    historicalBody.to_sequence,
    'exception.scope.signature_not_verifiable.to_sequence',
  );
  if (exceptionEnd < 1) fail('exception range must contain at least sequence 1');
  const currentStart = expectInteger(
    currentBody.from_sequence,
    'exception.scope.current_key_required.from_sequence',
  );
  expectLiteral(
    historicalBody.from_sequence,
    1,
    'exception.scope.signature_not_verifiable.from_sequence',
  );
  if (currentStart !== exceptionEnd + 1) {
    fail('current-key range must begin immediately after the exception range');
  }
  const scope = {
    signature_not_verifiable: {
      from_sequence: 1 as const,
      to_sequence: exceptionEnd,
    },
    current_key_required: {
      from_sequence: currentStart,
      through: expectLiteral(
        currentBody.through,
        'chain_head',
        'exception.scope.current_key_required.through',
      ),
    },
    allowed_failure: expectLiteral(
      scopeBody.allowed_failure,
      'historical_signature_key_unavailable',
      'exception.scope.allowed_failure',
    ),
    hash_link_sequence_exceptions: expectLiteral(
      scopeBody.hash_link_sequence_exceptions,
      0,
      'exception.scope.hash_link_sequence_exceptions',
    ),
  };

  const prefixBody = expectObject(
    root.historical_prefix_custody,
    'exception.historical_prefix_custody',
    ['through_sequence', 'byte_length', 'sha256', 'framing'],
  );
  const historicalPrefixCustody = {
    through_sequence: expectInteger(
      prefixBody.through_sequence,
      'exception.historical_prefix_custody.through_sequence',
    ),
    byte_length: expectInteger(
      prefixBody.byte_length,
      'exception.historical_prefix_custody.byte_length',
    ),
    sha256: expectString(
      prefixBody.sha256,
      'exception.historical_prefix_custody.sha256',
    ),
    framing: expectLiteral(
      prefixBody.framing,
      'exact_jsonl_bytes_including_signatures',
      'exception.historical_prefix_custody.framing',
    ),
  };
  if (historicalPrefixCustody.through_sequence !== exceptionEnd) {
    fail('historical prefix custody must end at the exception boundary');
  }
  if (historicalPrefixCustody.byte_length < 1) {
    fail('historical prefix custody byte_length must be positive');
  }
  if (!/^[0-9a-f]{64}$/.test(historicalPrefixCustody.sha256)) {
    fail('historical prefix custody sha256 must be lowercase hexadecimal');
  }

  const boundaryBody = expectObject(root.boundary, 'exception.boundary', [
    'before',
    'after',
    'link_matches',
  ]);
  const boundary = {
    before: validateBoundaryReceipt(boundaryBody.before, 'exception.boundary.before'),
    after: validateBoundaryReceipt(boundaryBody.after, 'exception.boundary.after'),
    link_matches: expectLiteral(
      boundaryBody.link_matches,
      true,
      'exception.boundary.link_matches',
    ),
  };
  if (boundary.before.sequence !== exceptionEnd) {
    fail('exception boundary.before must be the final excepted sequence');
  }
  if (boundary.after.sequence !== currentStart) {
    fail('exception boundary.after must be the first current-key sequence');
  }
  if (boundary.after.prev_hash !== boundary.before.event_hash) {
    fail('exception boundary records do not link');
  }

  const keyBody = expectObject(
    root.current_verifying_key,
    'exception.current_verifying_key',
    ['fingerprint_algorithm', 'fingerprint', 'required_from_sequence'],
  );
  const fingerprint = expectString(
    keyBody.fingerprint,
    'exception.current_verifying_key.fingerprint',
  );
  if (!/^sha256:[0-9a-f]{64}$/.test(fingerprint)) {
    fail('exception.current_verifying_key.fingerprint must be a lowercase sha256 fingerprint');
  }
  const currentVerifyingKey = {
    fingerprint_algorithm: expectLiteral(
      keyBody.fingerprint_algorithm,
      'sha256(raw_ed25519_public_key_32_bytes)',
      'exception.current_verifying_key.fingerprint_algorithm',
    ),
    fingerprint,
    required_from_sequence: expectInteger(
      keyBody.required_from_sequence,
      'exception.current_verifying_key.required_from_sequence',
    ),
  };
  if (currentVerifyingKey.required_from_sequence !== currentStart) {
    fail('key fingerprint requirement must begin at the current-key range');
  }

  const observationsBody = expectObject(root.observations, 'exception.observations', [
    'current_key_mtime_utc',
    'prior_key_available',
    'rotation_receipt_found',
    'cause_status',
  ]);
  const observations = {
    current_key_mtime_utc: expectUtcTimestamp(
      observationsBody.current_key_mtime_utc,
      'exception.observations.current_key_mtime_utc',
    ),
    prior_key_available: expectLiteral(
      observationsBody.prior_key_available,
      false,
      'exception.observations.prior_key_available',
    ),
    rotation_receipt_found: expectLiteral(
      observationsBody.rotation_receipt_found,
      false,
      'exception.observations.rotation_receipt_found',
    ),
    cause_status: expectLiteral(
      observationsBody.cause_status,
      'unknown_historical_key_transition',
      'exception.observations.cause_status',
    ),
  };

  if (!Array.isArray(root.nonclaims)) fail('exception.nonclaims must be an array');
  if (
    root.nonclaims.length !== REQUIRED_NONCLAIMS.length ||
    root.nonclaims.some((claim, index) => claim !== REQUIRED_NONCLAIMS[index])
  ) {
    fail('exception.nonclaims must match the closed approved nonclaim set');
  }

  return {
    schema_version: schemaVersion,
    exception_id: expectString(root.exception_id, 'exception.exception_id'),
    status,
    authority,
    lane,
    canonical_chain: expectString(root.canonical_chain, 'exception.canonical_chain'),
    scope,
    historical_prefix_custody: historicalPrefixCustody,
    boundary,
    current_verifying_key: currentVerifyingKey,
    observations,
    nonclaims: [...REQUIRED_NONCLAIMS],
  };
}

function readStableRegularFile(
  file: string,
  label: string,
  requirePrivateMode = false,
): Buffer {
  let canonical: string;
  try {
    canonical = fs.realpathSync(file);
  } catch (error) {
    fail(`${label} cannot be resolved: ${String(error)}`);
  }
  if (canonical !== path.resolve(file)) {
    fail(`${label} path must be canonical and contain no symlink indirection`);
  }

  let descriptor: number;
  try {
    descriptor = fs.openSync(
      file,
      fs.constants.O_RDONLY | fs.constants.O_CLOEXEC | fs.constants.O_NOFOLLOW,
    );
  } catch (error) {
    fail(`${label} cannot be opened safely: ${String(error)}`);
  }
  try {
    const before = fs.fstatSync(descriptor);
    if (!before.isFile()) fail(`${label} must be a regular file`);
    if (
      requirePrivateMode &&
      process.platform !== 'win32' &&
      (before.mode & 0o077) !== 0
    ) {
      fail(`${label} permissions must be 0600 or stricter`);
    }
    const body = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor);
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs ||
      body.length !== before.size
    ) {
      fail(`${label} changed while it was being read`);
    }
    return body;
  } finally {
    fs.closeSync(descriptor);
  }
}

function readException(file: string): {
  body: ReceiptKeyException;
  bytes: Buffer;
} {
  const bytes = readStableRegularFile(file, 'exception record');
  try {
    return {
      body: validateException(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))),
      bytes,
    };
  } catch (error) {
    if (error instanceof SyntaxError) fail(`exception record is malformed JSON: ${file}`);
    throw error;
  }
}

function isReceipt(value: unknown): value is CoordinationReceipt {
  if (value === null || typeof value !== 'object') return false;
  const receipt = value as Record<string, unknown>;
  return (
    typeof receipt.sequence === 'number' &&
    typeof receipt.timestamp === 'string' &&
    typeof receipt.prev_hash === 'string' &&
    typeof receipt.event_hash === 'string' &&
    typeof receipt.signature === 'string' &&
    typeof receipt.actor_id === 'string' &&
    typeof receipt.action === 'string' &&
    receipt.inputs !== null &&
    typeof receipt.inputs === 'object' &&
    typeof receipt.result === 'string' &&
    typeof receipt.inputs_hash === 'string' &&
    typeof receipt.outputs_hash === 'string'
  );
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const exceptionArtifact = readException(args.exception);
  const exception = exceptionArtifact.body;
  if (!path.isAbsolute(exception.canonical_chain)) {
    fail('exception.canonical_chain must be an absolute path');
  }
  if (args.receipts !== path.normalize(exception.canonical_chain)) {
    if (args.copiedFromCanonical !== exception.canonical_chain) {
      fail(
        'non-canonical receipt artifact requires --copied-from-canonical matching exception.canonical_chain',
      );
    }
  } else if (args.copiedFromCanonical !== undefined) {
    fail('--copied-from-canonical is forbidden when verifying the canonical chain itself');
  }
  const exceptionArtifactSha256 = crypto
    .createHash('sha256')
    .update(exceptionArtifact.bytes)
    .digest('hex');
  if (args.testFixtureAuthority) {
    if (process.env.NODE_ENV !== 'test') {
      fail('--test-fixture-authority is available only under NODE_ENV=test');
    }
  } else {
    const normalizedSuffix = APPROVED_EXCEPTION.relativeArtifact.split('/').join(path.sep);
    if (
      exception.exception_id !== APPROVED_EXCEPTION.id ||
      exceptionArtifactSha256 !== APPROVED_EXCEPTION.sha256 ||
      exception.canonical_chain !== APPROVED_EXCEPTION.canonicalChain ||
      exception.scope.signature_not_verifiable.to_sequence !==
        APPROVED_EXCEPTION.exceptionEnd ||
      exception.scope.current_key_required.from_sequence !==
        APPROVED_EXCEPTION.currentStart ||
      exception.historical_prefix_custody.byte_length !==
        APPROVED_EXCEPTION.historicalPrefixBytes ||
      exception.historical_prefix_custody.sha256 !==
        APPROVED_EXCEPTION.historicalPrefixSha256 ||
      exception.current_verifying_key.fingerprint !==
        APPROVED_EXCEPTION.publicKeyFingerprint ||
      !args.exception.endsWith(path.sep + normalizedSuffix)
    ) {
      fail('exception artifact does not match accepted Release Repair v1 authority');
    }
  }
  const exceptionEnd = exception.scope.signature_not_verifiable.to_sequence;
  const currentStart = exception.scope.current_key_required.from_sequence;

  const keyBytes = readStableRegularFile(args.key, 'verification key', true);
  if (keyBytes.length !== 32) fail('verification key must contain exactly 32 bytes');
  const verifyingKey = createPublicKeyFromSeed(new Uint8Array(keyBytes));
  const publicKeyDer = verifyingKey.export({ format: 'der', type: 'spki' }) as Buffer;
  const publicKeyHex = Buffer.from(publicKeyDer.subarray(-32)).toString('hex');
  const publicKeyFingerprint =
    'sha256:' +
    crypto.createHash('sha256').update(Buffer.from(publicKeyHex, 'hex')).digest('hex');
  if (publicKeyFingerprint !== exception.current_verifying_key.fingerprint) {
    fail(
      `verification key fingerprint ${publicKeyFingerprint} does not match approved exception`,
    );
  }

  const receiptBytes = readStableRegularFile(args.receipts, 'receipt chain');
  let historicalPrefixEnd = -1;
  let newlineCount = 0;
  for (let index = 0; index < receiptBytes.length; index += 1) {
    if (receiptBytes[index] !== 0x0a) continue;
    newlineCount += 1;
    if (newlineCount === exceptionEnd) {
      historicalPrefixEnd = index + 1;
      break;
    }
  }
  if (historicalPrefixEnd < 0) {
    fail(`receipt chain does not contain complete sequences 1..${exceptionEnd}`);
  }
  const historicalPrefix = receiptBytes.subarray(0, historicalPrefixEnd);
  const historicalPrefixSha256 = crypto
    .createHash('sha256')
    .update(historicalPrefix)
    .digest('hex');
  if (
    historicalPrefix.length !== exception.historical_prefix_custody.byte_length ||
    historicalPrefixSha256 !== exception.historical_prefix_custody.sha256
  ) {
    fail('historical prefix bytes differ from the accepted immutable custody record');
  }
  const receiptBody = new TextDecoder('utf-8', { fatal: true }).decode(receiptBytes);
  if (!receiptBody.endsWith('\n')) fail('receipt chain is missing its final newline');
  const lines = receiptBody.slice(0, -1).split('\n');
  let previous: CoordinationReceipt | null = null;
  let expectedSequence = 1;
  let signatureSkipped = 0;
  let signatureVerified = 0;
  let boundaryBefore: CoordinationReceipt | null = null;
  let boundaryAfter: CoordinationReceipt | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) fail(`blank JSONL record at line ${index + 1}`);
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      fail(`malformed JSON at line ${index + 1}`);
    }
    if (!isReceipt(value)) fail(`invalid receipt shape at line ${index + 1}`);
    const receipt = value;
    if (receipt.sequence !== expectedSequence) {
      fail(`sequence ${receipt.sequence} encountered; expected ${expectedSequence}`);
    }

    if (previous === null) {
      if (!verifyGenesisReceipt(receipt)) fail('first receipt is not genesis');
    } else if (!verifyChainLink(previous, receipt)) {
      fail(`chain link broken between sequences ${previous.sequence} and ${receipt.sequence}`);
    }

    const hashes = verifyReceiptHashes(receipt);
    if (!hashes.ok) fail(`sequence ${receipt.sequence}: ${hashes.reason ?? 'hash failure'}`);

    if (receipt.sequence === exception.boundary.before.sequence) boundaryBefore = receipt;
    if (receipt.sequence === exception.boundary.after.sequence) boundaryAfter = receipt;

    if (receipt.sequence <= exceptionEnd) {
      signatureSkipped += 1;
    } else {
      if (!verifyEventSignature(receipt.prev_hash, receipt.event_hash, receipt.signature, verifyingKey)) {
        fail(`signature invalid at sequence ${receipt.sequence}`);
      }
      signatureVerified += 1;
    }

    previous = receipt;
    expectedSequence += 1;
  }

  const headSequence = expectedSequence - 1;
  if (headSequence === 0) fail('receipt chain is empty');
  if (headSequence <= exceptionEnd) {
    fail(`chain head ${headSequence} does not extend beyond exception end ${exceptionEnd}`);
  }
  if (signatureSkipped !== exceptionEnd) {
    fail(
      `exception range must be exactly 1..${exceptionEnd}; observed ${signatureSkipped} receipts`,
    );
  }
  if (boundaryBefore === null || boundaryAfter === null) {
    fail('approved exception boundary is not present in the receipt chain');
  }
  for (const [label, actual, expected] of [
    ['before', boundaryBefore, exception.boundary.before],
    ['after', boundaryAfter, exception.boundary.after],
  ] as const) {
    for (const field of [
      'sequence',
      'timestamp',
      'actor_id',
      'action',
      'prev_hash',
      'event_hash',
    ] as const) {
      if (actual[field] !== expected[field]) {
        fail(`approved boundary ${label}.${field} does not match sequence ${actual.sequence}`);
      }
    }
  }

  const result = {
    ok: true,
    status: args.testFixtureAuthority
      ? 'PASS_TEST_FIXTURE_WITH_BOUNDED_HISTORICAL_SIGNATURE_EXCEPTION'
      : 'PASS_WITH_BOUNDED_HISTORICAL_SIGNATURE_EXCEPTION',
    exception_id: exception.exception_id,
    exception_artifact: args.exception,
    exception_artifact_sha256: exceptionArtifactSha256,
    canonical_chain_declared: exception.canonical_chain,
    receipts_artifact: args.receipts,
    receipt_artifact_role:
      args.receipts === path.normalize(exception.canonical_chain)
        ? 'canonical_chain'
        : 'declared_copy_of_canonical_chain',
    receipts: headSequence,
    head_sequence: headSequence,
    head_event_hash: previous?.event_hash ?? null,
    structural_verification: {
      start_sequence: 1,
      end_sequence: headSequence,
      status: 'full_hash_link_sequence_and_framing_pass',
    },
    signature_not_verifiable: {
      start_sequence: 1,
      end_sequence: exceptionEnd,
      count: signatureSkipped,
      status: 'not_verifiable_by_approved_exception',
      exact_prefix_bytes: historicalPrefix.length,
      exact_prefix_sha256: historicalPrefixSha256,
    },
    current_key_epoch: {
      start_sequence: currentStart,
      end_sequence: headSequence,
      signatures_verified: signatureVerified,
      public_key_fingerprint: publicKeyFingerprint,
    },
    boundary: `${exceptionEnd}->${currentStart}`,
  };

  if (args.json) console.log(JSON.stringify(result));
  else {
    console.log(
      `${result.status}\n` +
        `structural=1..${headSequence}\n` +
        `current_key_signatures=${currentStart}..${headSequence}\n` +
        `signature_not_verifiable=1..${exceptionEnd}\n` +
        `boundary=${exceptionEnd}->${currentStart}`,
    );
  }
}

main();
