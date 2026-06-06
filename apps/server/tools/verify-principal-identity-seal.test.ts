#!/usr/bin/env tsx
/**
 * Identity Seal v1 integration test.
 *
 * Exercises principal registration, canonical challenge signing, replay
 * rejection, report/block controls, server-derived moderation capability, PGP
 * pending intake, retirement, deletion/anonymization, and receipt privacy.
 */
import { createSign, generateKeyPairSync } from 'node:crypto';
import Database from 'better-sqlite3';
import { initSchema } from '../src/persist/schema.js';
import { PrincipalStore } from '../src/principal/store.js';
import { PrincipalService } from '../src/principal/service.js';

let failed = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

function sign(privateKeyPem: string, canonicalPayload: string): string {
  const signer = createSign('SHA256');
  signer.update(canonicalPayload, 'utf8');
  signer.end();
  return signer.sign(privateKeyPem).toString('base64url');
}

function keypair() {
  const kp = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    publicKeyPem: kp.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: kp.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

function bearer(token: string): string {
  return `Bearer ${token}`;
}

async function main(): Promise<void> {
  const db = new Database(':memory:');
  initSchema(db);
  const store = new PrincipalStore(db);
  const receipts: Array<{ action: string; principalId: string | null; inputs?: Record<string, unknown>; result: string }> = [];
  const svc = new PrincipalService({
    store,
    emitReceipt: (e) => receipts.push(e),
    now: () => Date.now(),
    config: {
      domain: 'akalynth.com',
      challengeTtlMs: 60_000,
      sessionTtlMs: 3600_000,
      termsVersion: 'identity-seal-terms-v1',
    },
  });

  const aliceKeys = keypair();
  const bobKeys = keypair();

  check('register requires terms', svc.register({ handle: 'NoTerms', public_key_spki_pem: aliceKeys.publicKeyPem }).status === 400);
  check('register rejects invalid handle', svc.register({ handle: '1bad', public_key_spki_pem: aliceKeys.publicKeyPem, accepted_terms: true }).status === 400);

  const reg = svc.register({
    handle: 'RookguardKarol',
    display_name: 'Karol',
    public_key_spki_pem: aliceKeys.publicKeyPem,
    accepted_terms: true,
    client: 'android',
  });
  check('register principal 201', reg.status === 201);
  const regBody = reg.body as { principal: { principal_id: string; recovery_mode: string }; key_fingerprint: string; loss_warning: string };
  const aliceId = regBody.principal.principal_id;
  check('register returns recovery none and loss warning', regBody.principal.recovery_mode === 'none' && regBody.loss_warning.includes('no recovery'));
  check('principal_created receipt emitted', receipts.some((r) => r.action === 'principal_created' && r.principalId === aliceId));
  check('terms receipt emitted', receipts.some((r) => r.action === 'principal_terms_accepted'));
  check('duplicate handle rejected', svc.register({ handle: 'rookguardkarol', public_key_spki_pem: bobKeys.publicKeyPem, accepted_terms: true }).status === 409);

  const bobReg = svc.register({
    handle: 'HighCityBree',
    public_key_spki_pem: bobKeys.publicKeyPem,
    accepted_terms: true,
    client: 'android',
  });
  const bobId = (bobReg.body as { principal: { principal_id: string } }).principal.principal_id;

  const chal = svc.challenge({ principal_id: aliceId, purpose: 'principal_login', domain: 'akalynth.com', client: 'android' });
  check('login challenge 200', chal.status === 200);
  const chalBody = chal.body as { challenge_id: string; canonical_payload: string };
  const sig = sign(aliceKeys.privateKeyPem, chalBody.canonical_payload);

  const verify = svc.verify({ principal_id: aliceId, challenge_id: chalBody.challenge_id, signature_base64url: sig });
  check('verify signed challenge returns session', verify.status === 200);
  const verifyBody = verify.body as { session_token: string; principal: { capabilities: string[]; identity_level: string } };
  check('session is key-bound with basic UGC capabilities', verifyBody.principal.identity_level === 'key_bound' && verifyBody.principal.capabilities.includes('forum:report'));
  check('replay challenge rejected', svc.verify({ principal_id: aliceId, challenge_id: chalBody.challenge_id, signature_base64url: sig }).status === 409);

  const badChal = svc.challenge({ principal_id: aliceId, purpose: 'principal_login', domain: 'akalynth.com', client: 'android' });
  const badBody = badChal.body as { challenge_id: string; canonical_payload: string };
  const badSig = sign(bobKeys.privateKeyPem, badBody.canonical_payload);
  check('wrong key signature rejected', svc.verify({ principal_id: aliceId, challenge_id: badBody.challenge_id, signature_base64url: badSig }).status === 401);

  const auth = bearer(verifyBody.session_token);
  check('me works with principal session', svc.me(auth).status === 200);
  check('block target principal', svc.block(auth, { target_principal_id: bobId, reason: 'spam' }).status === 200);
  const report = svc.report(auth, { target_principal_id: bobId, content_ref: 'forum:post:1', reason: 'abuse', detail: 'bad post' });
  check('report target principal', report.status === 201);
  const reportId = (report.body as { report_id: string }).report_id;
  check('normal player cannot read moderation queue', svc.listReports(auth, { status: 'open' }).status === 403);

  db.prepare(`UPDATE principals SET roles_json = ? WHERE principal_id = ?`).run(JSON.stringify(['player', 'moderator']), aliceId);
  check('moderator can read moderation queue', svc.listReports(auth, { status: 'open' }).status === 200);
  check('moderator can resolve report', svc.resolveReport(auth, { report_id: reportId, resolution: 'warning', reason: 'confirmed' }).status === 200);
  check('moderation receipt records derived capability', receipts.some((r) => r.action === 'principal_moderation_action' && r.inputs?.derived_capability === 'moderation:resolve'));

  const pgp = svc.pgpBind(auth, { armored_public_key: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nplaceholder\n-----END PGP PUBLIC KEY BLOCK-----' });
  check('pgp intake is pending, not authority', pgp.status === 202 && (pgp.body as { authority_claim_enabled: boolean }).authority_claim_enabled === false);

  const retireChallenge = svc.challenge({ principal_id: aliceId, purpose: 'principal_retire', domain: 'akalynth.com', client: 'android' });
  const retireBody = retireChallenge.body as { challenge_id: string; canonical_payload: string };
  const retireSig = sign(aliceKeys.privateKeyPem, retireBody.canonical_payload);
  check('retire requires signed challenge', svc.retire(auth, { challenge_id: retireBody.challenge_id, signature_base64url: retireSig }).status === 200);
  check('retired session no longer authenticates', svc.me(auth).status === 401);

  const deletedKeys = keypair();
  const deletedReg = svc.register({ handle: 'DeleteMe', public_key_spki_pem: deletedKeys.publicKeyPem, accepted_terms: true, client: 'android' });
  const deletedId = (deletedReg.body as { principal: { principal_id: string } }).principal.principal_id;
  const deletedChallenge = svc.challenge({ principal_id: deletedId, purpose: 'principal_login', domain: 'akalynth.com', client: 'android' });
  const deletedLoginBody = deletedChallenge.body as { challenge_id: string; canonical_payload: string };
  const deletedLogin = svc.verify({
    principal_id: deletedId,
    challenge_id: deletedLoginBody.challenge_id,
    signature_base64url: sign(deletedKeys.privateKeyPem, deletedLoginBody.canonical_payload),
  });
  const deletedAuth = bearer((deletedLogin.body as { session_token: string }).session_token);
  const deleteChallenge = svc.challenge({ principal_id: deletedId, purpose: 'principal_delete', domain: 'akalynth.com', client: 'android' });
  const deleteBody = deleteChallenge.body as { challenge_id: string; canonical_payload: string };
  check('delete/anonymize requires signed challenge', svc.deletePrincipal(deletedAuth, {
    challenge_id: deleteBody.challenge_id,
    signature_base64url: sign(deletedKeys.privateKeyPem, deleteBody.canonical_payload),
  }).status === 200);
  const deletedRow = db.prepare(`SELECT handle, status FROM principals WHERE principal_id = ?`).get(deletedId) as { handle: string; status: string };
  check('principal deletion anonymizes handle and status', deletedRow.status === 'principal_deleted' && deletedRow.handle.startsWith('deleted_'));

  const receiptJson = JSON.stringify(receipts);
  check('receipts do not contain raw session token', !receiptJson.includes(verifyBody.session_token));
  check('receipts do not contain private keys or signatures', !receiptJson.includes('PRIVATE KEY') && !receiptJson.includes(sig));
}

main().then(() => {
  if (failed > 0) {
    console.error(`\n[verify-principal-identity-seal.test] ${failed} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\n[verify-principal-identity-seal.test] all checks passed');
}).catch((e) => {
  console.error('test crashed:', e);
  process.exit(1);
});
