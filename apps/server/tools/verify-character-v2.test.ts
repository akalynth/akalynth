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
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { initSchema } from '../src/persist/schema.js';
import { AccountStore } from '../src/account/store.js';
import { AccountService, SESSION_COOKIE, CSRF_COOKIE } from '../src/account/service.js';
import { hashPassword, verifyPassword } from '../src/account/password.js';
import { CharacterStore } from '../src/character/store.js';
import { CharacterService } from '../src/character/service.js';
import { makeCharacterRouter } from '../src/character/router.js';
import { accountCharacterLoginProjection } from '../src/character/loginProjection.js';
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
type ResponseCapture = ServerResponse & {
  bodyText: string;
  headersOut: Record<string, string | number | readonly string[]>;
};

function makeReq(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers: IncomingHttpHeaders = {}
): IncomingMessage {
  const payload = body ? JSON.stringify(body) : '';
  let sent = false;
  const req = new Readable({
    read() {
      if (sent) return;
      sent = true;
      if (payload) this.push(Buffer.from(payload, 'utf8'));
      this.push(null);
    },
  }) as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function makeRes(): ResponseCapture {
  const res = {
    statusCode: 200,
    bodyText: '',
    headersOut: {},
    setHeader(name: string, value: string | number | readonly string[]) {
      this.headersOut[name.toLowerCase()] = value;
      return this as unknown as ServerResponse;
    },
    end(chunk?: unknown) {
      if (chunk != null) this.bodyText += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      return this as unknown as ServerResponse;
    },
  };
  return res as ResponseCapture;
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
  const characterStore = new CharacterStore(db);
  const characterService = new CharacterService({
    store: characterStore,
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
  const csrf = cookies[CSRF_COOKIE];
  const verifiedCookie = `${SESSION_COOKIE}=${sess}; ${CSRF_COOKIE}=${csrf}`;
  const unverifiedCookie = `${SESSION_COOKIE}=sess-unverified; ${CSRF_COOKIE}=csrf-unverified`;
  const router = makeCharacterRouter({
    service: characterService,
    resolveAccount: (parsed) => {
      if (parsed[SESSION_COOKIE] === sess) return { accountId, emailVerified: true };
      if (parsed[SESSION_COOKIE] === 'sess-unverified') return { accountId, emailVerified: false };
      return null;
    },
    requireVerifiedForCreate: true,
  });
  const request = async (
    method: string,
    url: string,
    body?: Record<string, unknown>,
    headers?: IncomingHttpHeaders
  ): Promise<{ status: number; body: Record<string, unknown> }> => {
    const res = makeRes();
    await router(makeReq(method, url, body, headers), res);
    return { status: res.statusCode, body: JSON.parse(res.bodyText || '{}') as Record<string, unknown> };
  };

  // ---- HTTP router boundary: public catalogs; account session + CSRF + email verification ----
  let http = await request('GET', '/v1/worlds');
  check('HTTP GET /v1/worlds is public', http.status === 200 && Array.isArray(http.body.worlds));
  http = await request('GET', '/v1/characters');
  check('HTTP GET /v1/characters requires account session', http.status === 401 && http.body.error === 'not_authenticated');
  http = await request('POST', '/v1/characters', { name: 'NoCookie', world_id: 'rookguard', sex: 'male', outfit_id: 'male_guard' });
  check('HTTP POST /v1/characters requires account session', http.status === 401 && http.body.error === 'not_authenticated');
  http = await request('POST', '/v1/characters', { name: 'NoCsrf', world_id: 'rookguard', sex: 'male', outfit_id: 'male_guard' }, { cookie: verifiedCookie });
  check('HTTP POST /v1/characters requires matching csrf', http.status === 403 && http.body.error === 'csrf_failed');
  http = await request(
    'POST',
    '/v1/characters',
    { name: 'Unverified', world_id: 'rookguard', sex: 'male', outfit_id: 'male_guard' },
    { cookie: unverifiedCookie, 'x-csrf-token': 'csrf-unverified' }
  );
  check('HTTP POST /v1/characters requires verified email', http.status === 403 && http.body.error === 'email_unverified');

  // ---- create character (account-gated, valid) ----
  const c1 = characterService.create(accountId, { name: 'Aria', world_id: 'rookguard', sex: 'female', outfit_id: 'female_mage' });
  check('create 201', c1.status === 201);
  const c1body = c1.body as { ok: boolean; character: { character_id: string; world_id: string; sex: string; outfit_id: string }; token: string };
  check('create returns character + play token', c1body.ok && c1body.character.character_id === 'p_Aria' && c1body.token === 'play_Aria');
  check('create keeps canonical rookguard world id', c1body.character.world_id === 'rookguard');
  check('create persisted account_characters row', (db.prepare('SELECT count(*) c FROM account_characters WHERE account_id=?').get(accountId) as { c: number }).c === 1);
  const rookguardProjection = accountCharacterLoginProjection(characterStore.findById('p_Aria'));
  check('login projection: rookguard character enters Rookguard', rookguardProjection.map === 'Rookguard');
  check('login projection: female outfit with pending sprite stays null', rookguardProjection.sprite_id === null);
  check('receipts: created + world_assigned + outfit_selected', ['character_created', 'character_world_assigned', 'character_outfit_selected'].every((a) => actions().includes(a)));

  // ---- create validation ----
  check('create unknown world -> 400', characterService.create(accountId, { name: 'X', world_id: 'nope', sex: 'male', outfit_id: 'male_guard' }).status === 400);
  check('legacy azura world id is rejected -> 400', characterService.create(accountId, { name: 'X', world_id: 'azura', sex: 'male', outfit_id: 'male_guard' }).status === 400);
  check('create bad sex -> 400', characterService.create(accountId, { name: 'X', world_id: 'high_city', sex: 'other', outfit_id: 'male_guard' }).status === 400);
  check('create outfit-sex mismatch -> 400', characterService.create(accountId, { name: 'X', world_id: 'high_city', sex: 'male', outfit_id: 'female_mage' }).status === 400);
  check('create name_taken propagates -> 409', characterService.create(accountId, { name: 'Aria', world_id: 'high_city', sex: 'male', outfit_id: 'male_guard' }).status === 409);

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

  http = await request('GET', '/v1/characters', undefined, { cookie: verifiedCookie });
  check('HTTP GET /v1/characters lists account characters', http.status === 200 && Array.isArray(http.body.characters) && http.body.characters.length === 1);
  http = await request(
    'POST',
    '/v1/characters/select',
    { character_id: 'p_Aria' },
    { cookie: unverifiedCookie, 'x-csrf-token': 'csrf-unverified' }
  );
  check('HTTP POST /v1/characters/select allows unverified account session', http.status === 200 && http.body.token === 'sel_p_Aria');
  http = await request('POST', '/v1/characters/select', { character_id: 'p_Aria' }, { cookie: verifiedCookie });
  check('HTTP POST /v1/characters/select requires matching csrf', http.status === 403 && http.body.error === 'csrf_failed');
  http = await request(
    'POST',
    '/v1/characters',
    { name: 'RouterLegacy', world_id: 'azura', sex: 'male', outfit_id: 'male_guard' },
    { cookie: verifiedCookie, 'x-csrf-token': csrf }
  );
  check('HTTP POST /v1/characters rejects legacy azura world id', http.status === 400 && http.body.error === 'invalid_input');
  http = await request(
    'POST',
    '/v1/characters',
    { name: 'RouterHigh', world_id: 'high_city', sex: 'male', outfit_id: 'male_guard' },
    { cookie: verifiedCookie, 'x-csrf-token': csrf }
  );
  check('HTTP POST /v1/characters creates canonical high_city character', http.status === 201 && (http.body.character as { world_id?: string } | undefined)?.world_id === 'high_city');
  const highCityProjection = accountCharacterLoginProjection(characterStore.findById('p_RouterHigh'));
  check('login projection: high_city character enters Azura runtime map', highCityProjection.map === 'Azura');
  check('login projection: outfit sprite follows catalog', highCityProjection.sprite_id === 'guard_city_01');
  const missingProjection = accountCharacterLoginProjection(undefined);
  check('login projection: missing account row falls back guest-safe', missingProjection.map === 'Rookguard' && missingProjection.sprite_id === null);

  // ---- character limit ----
  const c2 = characterService.create(accountId, { name: 'Bree', world_id: 'high_city', sex: 'male', outfit_id: 'male_guard' });
  const c2body = c2.body as { character?: { world_id: string } };
  check('canonical high_city create succeeds', c2.status === 201 && c2body.character?.world_id === 'high_city');
  check('canonical high_city is persisted', (db.prepare('SELECT world_id FROM account_characters WHERE character_id=?').get('p_Bree') as { world_id: string }).world_id === 'high_city');
  characterService.create(accountId, { name: 'Cole', world_id: 'high_city', sex: 'male', outfit_id: 'male_mage' });
  check('create over limit (>3) -> 409', characterService.create(accountId, { name: 'Dane', world_id: 'high_city', sex: 'male', outfit_id: 'male_wanderer' }).status === 409);

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
