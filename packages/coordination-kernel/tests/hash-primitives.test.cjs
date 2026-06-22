const assert = require('node:assert/strict');

test('receipt and absence hashes share deterministic canonical BLAKE3 output', async () => {
  const hasher = await import('../dist/receipt/hasher.js');
  const absence = await import('../dist/absence/hash.js');
  const identityKey = await import('../dist/identity/key.js');
  const identityToken = await import('../dist/identity/token.js');

  const inputs = {
    z: [3, { b: true, a: 'rook' }],
    a: 1,
  };
  const result = 'cast_line:rookguard_canal';
  const expectedInputsHash = 'blake3:04f18b9f653e5ed4214b908c5826e5e614ecff73facc55ec2a5b68acc3affaf8';
  const expectedOutputsHash = 'blake3:216b8a411623428ce7e6668a20711c3ac5e74b690b0a14e4c5bd1bca9a3be6a9';
  const expectedEventHash = 'blake3:cf135a9cc8a47c5894b352a5f608719d37d32f0dbcb46cf630d60b205b6c79bc';

  assert.equal(hasher.hashCanonicalJson(inputs), expectedInputsHash);
  assert.equal(hasher.computeInputsHash(inputs), expectedInputsHash);
  assert.equal(absence.hashCanonical(inputs), expectedInputsHash);
  assert.equal(hasher.computeOutputsHash(result), expectedOutputsHash);

  const body = {
    receipt_id: 'receipt-test-001',
    prev_hash: 'genesis',
    action: 'rookguard.asset.check',
    actor: 'codex',
    inputs,
    result,
    inputs_hash: expectedInputsHash,
    outputs_hash: expectedOutputsHash,
    timestamp: '2026-06-22T05:30:00.000Z',
    metadata: { zone: 'rookguard', tile: [3, 2] },
  };
  assert.equal(hasher.computeEventHash(body), expectedEventHash);

  const seed = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i));
  assert.equal(
    Buffer.from(identityKey.deriveAuthSeed(seed)).toString('hex'),
    '9073b1b5d4ad286466e853811c8adf481c708c898a5ab25876a0e1f5d3338343',
  );
  assert.equal(
    identityToken.computeTokenId('p_rookguard_fixture', 1705849200000, '00112233445566778899aabbccddeeff'),
    'blake3:0900af1d473ff5e33605a1b878a9378a4a7a5fa736a551bc24b0fc4a79bf22c4',
  );
});
