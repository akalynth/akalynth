#!/usr/bin/env tsx
/**
 * Character-under-account integration test (E4 / AKALYNTH_ACCOUNT_CHARACTER_V2_V1).
 *
 * Exercises the full E2->E4 bridge against a real in-memory DB (V16 schema):
 * register -> verify email -> login -> resolve session -> read catalogs ->
 * create / list / select characters. Asserts account gating, world/sex/outfit
 * validation, ownership enforcement, character limit, and privacy-bounded
 * receipts. mintCharacter / issuePlayToken are mocked (the real player+token
 * primitives are injected from index.ts in production). Run: npm run test:character-v2
 */
import Database from 'better-sqlite3';
import { initSchema } from '../src/persist/schema.js';
import { AccountStore } from '../src/account/store.js';
import { AccountService, SESSION_COOKIE, CSRF_COOKIE } from '../src/account/service.js';
import { hashPassword, verifyPassword } from '../src/account/password.js';
import { CharacterStore } from '../src/character/store.js';
import { CharacterService } from '../src/character/service.js';
import type { CharacterCreateResult } from '../src/api/http.js';

let failed = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}
function cookieValue(cookies: string[] | undefined, name: string): string | undefined {
  for (const sc of cookies ?? []) {
    const m = sc.match(new RegExp(`^${name}=([^;]*)`));
    if (m) return decodeURIComponent(m[1]);
  }
  return undefined;
}

async function main(): Promise<void> {
  const db = new Database(':memory:');
  initSchema(db);

  // ---- account side (E2) ----
  const accountService = new AccountService({
    store: new AccountStore(db),
    hashPassword,
    verifyPassword,
    emitReceipt: () => {},
    now: () => Date.now(),
    config: { secureCookies: false, sessionTtlSec: 3600, verificationTtlSec: 3600, resetTtlSec: 3600, devExposeLinks: true },
  });

  // ---- character side (E4) with mocked player/token primitives ----
  const created = new Set<string>();
  const mintCharacter = (name: string): CharacterCreateResult => {
    if (created.has(name.toLowerCase())) return { ok: false, code: 'name_taken', message: 'taken', status: 409 };
    created.add(name.toLowerCase());
    return { ok: true, player_id: `p_${name}`, name, token: `play_${name}`, issued_at: Date.now(), expires_at: Date.now() + 3600_000 };
  };
  const receipts: { action: string; accountId: string; characterId?: string; inputs?: Record<string, unknown> }[] = [];
  const characterService = new CharacterService({
    store: new CharacterStore(db),
    mintCharacter,
    issuePlayToken: (cid) => ({ token: `sel_${cid}`, expires_at: Date.now() + 3600_000 }),
    emitReceipt: (e) => receipts.push(e),
    now: () => Date.now(),
    maxCharactersPerAccount: 3,
  });
  const actions = () => receipts.map((r) => r.action);

  // ---- catalogs (public) ----
  const worlds = (characterService.worlds().body as { worlds: { world_id: string; name: string }[] }).worlds;
  check('GET worlds returns worlds', worlds.length >= 2);
  check('GET worlds advertises high_city', worlds.some((w) => w.world_id === 'high_city' && w.name === 'High City'));
  check('GET worlds omits legacy azura id', !worlds.some((w) => w.world_id === 'azura'));
  check('outfits(male) only male', (characterService.outfits('male').body as { outfits: { sex: string }[] }).outfits.every((o) => o.sex === 'male'));
  check('outfits(female) only female', (characterService.outfits('female').body as { outfits: { sex: string }[] }).outfits.every((o) => o.sex === 'female'));

  // ---- bring up an account: register -> verify -> login -> session ----
  const reg = await accountService.register({ email: 'pilot@example.com', password: 'a good password' });
  const vTok = (reg.body as { dev_verification_token: string }).dev_verification_token;
  accountService.verifyEmail({ token: vTok });
  const login = await accountService.login({ email: 'pilot@example.com', password: 'a good password' }, { cookies: {} });
  const sess = cookieValue(login.cookies, SESSION_COOKIE)!;
  const cookies = { [SESSION_COOKIE]: sess, [CSRF_COOKIE]: cookieValue(login.cookies, CSRF_COOKIE)! };
  const me = accountService.sessionAccount(cookies);
  check('sessionAccount resolves accountId + verified', !!me && me.emailVerified === true && me.accountId.startsWith('acc_'));
  const accountId = me!.accountId;

  // ---- create character (account-gated, valid) ----
  const c1 = characterService.create(accountId, { name: 'Aria', world_id: 'rookguard', sex: 'female', outfit_id: 'female_mage' });
  check('create 201', c1.status === 201);
  const c1body = c1.body as { ok: boolean; character: { character_id: string; world_id: string; sex: string; outfit_id: string }; token: string };
  check('create returns character + play token', c1body.ok && c1body.character.character_id === 'p_Aria' && c1body.token === 'play_Aria');
  check('create keeps canonical rookguard world id', c1body.character.world_id === 'rookguard');
  check('create persisted account_characters row', (db.prepare('SELECT count(*) c FROM account_characters WHERE account_id=?').get(accountId) as { c: number }).c === 1);
  check('receipts: created + world_assigned + outfit_selected', ['character_created', 'character_world_assigned', 'character_outfit_selected'].every((a) => actions().includes(a)));

  // ---- create validation ----
  check('create unknown world -> 400', characterService.create(accountId, { name: 'X', world_id: 'nope', sex: 'male', outfit_id: 'male_guard' }).status === 400);
  check('create bad sex -> 400', characterService.create(accountId, { name: 'X', world_id: 'azura', sex: 'other', outfit_id: 'male_guard' }).status === 400);
  check('create outfit-sex mismatch -> 400', characterService.create(accountId, { name: 'X', world_id: 'azura', sex: 'male', outfit_id: 'female_mage' }).status === 400);
  check('create name_taken propagates -> 409', characterService.create(accountId, { name: 'Aria', world_id: 'azura', sex: 'male', outfit_id: 'male_guard' }).status === 409);

  // ---- list (scoped to account) ----
  const list = (characterService.list(accountId).body as { characters: { character_id: string }[] }).characters;
  check('list returns the account character', list.length === 1 && list[0].character_id === 'p_Aria');
  check('list for other account is empty', (characterService.list('acc_other').body as { characters: unknown[] }).characters.length === 0);

  // ---- select (ownership enforced) ----
  const sel = characterService.select(accountId, { character_id: 'p_Aria' });
  check('select 200 + play token', sel.status === 200 && (sel.body as { token: string }).token === 'sel_p_Aria');
  check('receipt character_selected', actions().includes('character_selected'));
  check('select other account -> 404 (ownership)', characterService.select('acc_other', { character_id: 'p_Aria' }).status === 404);
  check('select unknown character -> 404', characterService.select(accountId, { character_id: 'p_nope' }).status === 404);

  // ---- character limit ----
  const c2 = characterService.create(accountId, { name: 'Bree', world_id: 'azura', sex: 'male', outfit_id: 'male_guard' });
  const c2body = c2.body as { character?: { world_id: string } };
  check('legacy azura create is accepted and normalized', c2.status === 201 && c2body.character?.world_id === 'high_city');
  check('legacy azura create is persisted as high_city', (db.prepare('SELECT world_id FROM account_characters WHERE character_id=?').get('p_Bree') as { world_id: string }).world_id === 'high_city');
  characterService.create(accountId, { name: 'Cole', world_id: 'azura', sex: 'male', outfit_id: 'male_mage' });
  check('create over limit (>3) -> 409', characterService.create(accountId, { name: 'Dane', world_id: 'azura', sex: 'male', outfit_id: 'male_wanderer' }).status === 409);

  // ---- privacy: character receipts carry only ids/world/sex/outfit, no email ----
  const leak = receipts.some((r) => JSON.stringify(r).includes('pilot@example.com'));
  check('no character receipt carried email/PII', !leak);
  check('receipt inputs only carry world/sex/outfit/character_id', receipts.every((r) => Object.keys(r.inputs ?? {}).every((k) => ['world_id', 'sex', 'outfit_id', 'character_id'].includes(k))));
  check('new character receipts do not emit legacy azura world id', receipts.every((r) => r.inputs?.world_id !== 'azura'));
}

main().then(() => {
  if (failed > 0) { console.error(`\n[verify-character-v2.test] ${failed} check(s) FAILED`); process.exit(1); }
  console.log('\n[verify-character-v2.test] all checks passed');
}).catch((e) => { console.error('crashed:', e); process.exit(1); });
