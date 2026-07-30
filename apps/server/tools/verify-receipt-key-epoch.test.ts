#!/usr/bin/env tsx
/* eslint-disable no-console */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  GENESIS_MARKER,
  computeEventHash,
  computeInputsHash,
  computeOutputsHash,
  createPrivateKeyFromSeed,
  loadVerifyingKeyHex,
  signEvent,
} from '@akalynth/coordination-kernel';
import type { CoordinationReceipt } from '@akalynth/coordination-kernel';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'akalynth-key-epoch-'));
const tool = path.resolve('tools/verify-receipt-key-epoch.ts');
const acceptedException = path.resolve(
  '../../docs/decisions/AKALYNTH_BETA_RELEASE_REPAIR_V1/receipt-key-exception.v1.json',
);
const acceptedExceptionSha256 =
  'e314f2297df493e207b644f4a954b6c363ea16c1bd69b82d202740a826e83a5b';
const keyASeed = Buffer.alloc(32, 0x31);
const keyBSeed = Buffer.alloc(32, 0x32);
const keyA = createPrivateKeyFromSeed(keyASeed);
const keyB = createPrivateKeyFromSeed(keyBSeed);
const keyBPath = path.join(temp, 'current.key');
fs.writeFileSync(keyBPath, keyBSeed, { mode: 0o600 });

function buildChain(): CoordinationReceipt[] {
  const receipts: CoordinationReceipt[] = [];
  let previous = GENESIS_MARKER;
  for (let sequence = 1; sequence <= 4; sequence += 1) {
    const inputs = { sequence };
    const result = 'ok';
    const body: Omit<CoordinationReceipt, 'event_hash' | 'signature'> = {
      sequence,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString(),
      prev_hash: previous,
      actor_id: 'server',
      action: sequence % 2 === 0 ? 'server_heartbeat' : 'server_boot',
      inputs,
      result,
      inputs_hash: computeInputsHash(inputs),
      outputs_hash: computeOutputsHash(result),
    };
    const event_hash = computeEventHash(body);
    const signature = signEvent(
      previous,
      event_hash,
      sequence <= 2 ? keyA : keyB,
    );
    receipts.push({ ...body, event_hash, signature });
    previous = event_hash;
  }
  return receipts;
}

function writeChain(name: string, receipts: CoordinationReceipt[]): string {
  const file = path.join(temp, name);
  fs.writeFileSync(file, receipts.map((receipt) => JSON.stringify(receipt)).join('\n') + '\n');
  return file;
}

function exceptionFor(
  receipts: CoordinationReceipt[],
  exceptionEnd: number,
): Record<string, unknown> {
  const before = receipts[exceptionEnd - 1];
  const after = receipts[exceptionEnd];
  const publicKeyHex = loadVerifyingKeyHex(keyBPath);
  const fingerprint =
    'sha256:' +
    crypto.createHash('sha256').update(Buffer.from(publicKeyHex, 'hex')).digest('hex');
  const historicalPrefix = Buffer.from(
    receipts.slice(0, exceptionEnd).map((receipt) => JSON.stringify(receipt)).join('\n') +
      '\n',
  );
  return {
    $schema: './receipt-key-exception.v1.schema.json',
    schema_version: 'akalynth.receipt_key_exception.v1',
    exception_id: `test.exception.1-${exceptionEnd}`,
    status: 'approved_bounded_exception',
    authority: {
      kind: 'project_owner',
      evidence: 'Synthetic test authority only.',
    },
    lane: 'beta',
    canonical_chain: '/synthetic/test/receipts.jsonl',
    scope: {
      signature_not_verifiable: {
        from_sequence: 1,
        to_sequence: exceptionEnd,
      },
      current_key_required: {
        from_sequence: exceptionEnd + 1,
        through: 'chain_head',
      },
      allowed_failure: 'historical_signature_key_unavailable',
      hash_link_sequence_exceptions: 0,
    },
    historical_prefix_custody: {
      through_sequence: exceptionEnd,
      byte_length: historicalPrefix.length,
      sha256: crypto.createHash('sha256').update(historicalPrefix).digest('hex'),
      framing: 'exact_jsonl_bytes_including_signatures',
    },
    boundary: {
      before: {
        sequence: before.sequence,
        timestamp: before.timestamp,
        actor_id: before.actor_id,
        action: before.action,
        prev_hash: before.prev_hash,
        event_hash: before.event_hash,
      },
      after: {
        sequence: after?.sequence ?? exceptionEnd + 1,
        timestamp: after?.timestamp ?? '2026-01-01T00:00:05.000Z',
        actor_id: after?.actor_id ?? 'server',
        action: after?.action ?? 'server_boot',
        prev_hash: before.event_hash,
        event_hash: after?.event_hash ?? 'blake3:' + '0'.repeat(64),
      },
      link_matches: true,
    },
    current_verifying_key: {
      fingerprint_algorithm: 'sha256(raw_ed25519_public_key_32_bytes)',
      fingerprint,
      required_from_sequence: exceptionEnd + 1,
    },
    observations: {
      current_key_mtime_utc: '2026-01-01T00:00:00.000Z',
      prior_key_available: false,
      rotation_receipt_found: false,
      cause_status: 'unknown_historical_key_transition',
    },
    nonclaims: [
      'Signatures in the exception range are not authenticated.',
      'Receipts in the exception range may not be rewritten, re-signed, removed, or reordered.',
      'No hash, link, sequence, or JSONL framing failure is excused.',
      'No signature failure after the exception range is excused.',
      'The exception cannot expand to future sequences or other lanes.',
    ],
  };
}

function writeException(
  name: string,
  receipts: CoordinationReceipt[],
  exceptionEnd: number,
  mutate?: (body: Record<string, any>) => void,
): string {
  const body = exceptionFor(receipts, exceptionEnd);
  mutate?.(body);
  const file = path.join(temp, name);
  fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
  return file;
}

function run(
  receipts: string,
  exception: string,
  declareCopiedChain = true,
  fixtureAuthority = true,
  json = true,
) {
  const copiedArgs = declareCopiedChain
    ? ['--copied-from-canonical', '/synthetic/test/receipts.jsonl']
    : [];
  const authorityArgs = fixtureAuthority ? ['--test-fixture-authority'] : [];
  const outputArgs = json ? ['--json'] : [];
  return spawnSync(
    process.execPath,
    [
      path.resolve('../../node_modules/tsx/dist/cli.mjs'),
      tool,
      '--receipts',
      receipts,
      '--key',
      keyBPath,
      '--exception',
      exception,
      ...copiedArgs,
      ...authorityArgs,
      ...outputArgs,
    ],
    {
      cwd: path.resolve('.'),
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: fixtureAuthority ? 'test' : 'production' },
    },
  );
}

try {
  assert.equal(
    crypto.createHash('sha256').update(fs.readFileSync(acceptedException)).digest('hex'),
    acceptedExceptionSha256,
    'committed receipt exception must match the accepted authority digest',
  );
  const valid = buildChain();
  const validPath = writeChain('valid.jsonl', valid);
  const validException = writeException('valid-exception.json', valid, 2);
  const pass = run(validPath, validException);
  assert.equal(pass.status, 0, pass.stderr);
  const body = JSON.parse(pass.stdout);
  assert.equal(
    body.status,
    'PASS_TEST_FIXTURE_WITH_BOUNDED_HISTORICAL_SIGNATURE_EXCEPTION',
  );
  assert.equal(body.exception_artifact, validException);
  assert.equal(
    body.exception_artifact_sha256,
    crypto.createHash('sha256').update(fs.readFileSync(validException)).digest('hex'),
  );
  assert.equal(body.receipt_artifact_role, 'declared_copy_of_canonical_chain');
  assert.equal(body.signature_not_verifiable.count, 2);
  assert.equal(
    body.signature_not_verifiable.status,
    'not_verifiable_by_approved_exception',
  );
  assert.equal(body.current_key_epoch.signatures_verified, 2);

  const plainFixturePass = run(validPath, validException, true, true, false);
  assert.equal(plainFixturePass.status, 0, plainFixturePass.stderr);
  assert.match(
    plainFixturePass.stdout,
    /^PASS_TEST_FIXTURE_WITH_BOUNDED_HISTORICAL_SIGNATURE_EXCEPTION\n/,
  );
  assert.doesNotMatch(
    plainFixturePass.stdout,
    /^PASS_WITH_BOUNDED_HISTORICAL_SIGNATURE_EXCEPTION\n/,
  );

  const substitutedAuthority = run(validPath, validException, true, false);
  assert.notEqual(substitutedAuthority.status, 0);
  assert.match(substitutedAuthority.stderr, /does not match accepted Release Repair v1 authority/);

  const undeclaredCopy = run(validPath, validException, false);
  assert.notEqual(undeclaredCopy.status, 0);
  assert.match(undeclaredCopy.stderr, /requires --copied-from-canonical/);

  const narrowException = writeException('narrow-exception.json', valid, 1);
  const tooNarrow = run(validPath, narrowException);
  assert.notEqual(tooNarrow.status, 0);
  assert.match(tooNarrow.stderr, /signature invalid at sequence 2/);

  const prefixTampered = structuredClone(valid);
  prefixTampered[0].inputs.sequence = 99;
  const prefixTamperedPath = writeChain('prefix-tampered.jsonl', prefixTampered);
  const prefixFailure = run(prefixTamperedPath, validException);
  assert.notEqual(prefixFailure.status, 0);
  assert.match(prefixFailure.stderr, /historical prefix bytes differ/);

  const historicalSignatureTampered = structuredClone(valid);
  historicalSignatureTampered[0].signature = '00'.repeat(64);
  const historicalSignatureTamperedPath = writeChain(
    'historical-signature-tampered.jsonl',
    historicalSignatureTampered,
  );
  const historicalSignatureFailure = run(
    historicalSignatureTamperedPath,
    validException,
  );
  assert.notEqual(historicalSignatureFailure.status, 0);
  assert.match(historicalSignatureFailure.stderr, /historical prefix bytes differ/);

  const suffixTampered = structuredClone(valid);
  suffixTampered[3].signature = '00'.repeat(64);
  const suffixTamperedPath = writeChain('suffix-tampered.jsonl', suffixTampered);
  const suffixFailure = run(suffixTamperedPath, validException);
  assert.notEqual(suffixFailure.status, 0);
  assert.match(suffixFailure.stderr, /signature invalid at sequence 4/);

  const missing = structuredClone(valid);
  missing.splice(1, 1);
  const missingPath = writeChain('missing.jsonl', missing);
  const missingFailure = run(missingPath, validException);
  assert.notEqual(missingFailure.status, 0);
  assert.match(missingFailure.stderr, /historical prefix bytes differ/);

  const overbroadException = writeException('overbroad-exception.json', valid, 4);
  const overbroad = run(validPath, overbroadException);
  assert.notEqual(overbroad.status, 0);
  assert.match(overbroad.stderr, /does not extend beyond exception end 4/);

  const tornPath = path.join(temp, 'torn.jsonl');
  fs.writeFileSync(tornPath, valid.map((receipt) => JSON.stringify(receipt)).join('\n'));
  const torn = run(tornPath, validException);
  assert.notEqual(torn.status, 0);
  assert.match(torn.stderr, /missing its final newline/);

  const blankPath = path.join(temp, 'blank.jsonl');
  fs.writeFileSync(
    blankPath,
    valid.map((receipt) => JSON.stringify(receipt)).join('\n\n') + '\n',
  );
  const blank = run(blankPath, validException);
  assert.notEqual(blank.status, 0);
  assert.match(blank.stderr, /historical prefix bytes differ/);

  const wrongBoundary = writeException(
    'wrong-boundary.json',
    valid,
    2,
    (exception) => {
      exception.boundary.after.action = 'server_shutdown';
    },
  );
  const boundaryFailure = run(validPath, wrongBoundary);
  assert.notEqual(boundaryFailure.status, 0);
  assert.match(boundaryFailure.stderr, /approved boundary after.action/);

  const wrongFingerprint = writeException(
    'wrong-fingerprint.json',
    valid,
    2,
    (exception) => {
      exception.current_verifying_key.fingerprint = 'sha256:' + '0'.repeat(64);
    },
  );
  const fingerprintFailure = run(validPath, wrongFingerprint);
  assert.notEqual(fingerprintFailure.status, 0);
  assert.match(fingerprintFailure.stderr, /does not match approved exception/);

  const extraField = writeException('extra-field.json', valid, 2, (exception) => {
    exception.unapproved_extension = true;
  });
  const closedObjectFailure = run(validPath, extraField);
  assert.notEqual(closedObjectFailure.status, 0);
  assert.match(closedObjectFailure.stderr, /exception fields must be exactly/);

  console.log('bounded receipt key-epoch verifier tests passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
