import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = readFileSync(resolve(root, 'src/hooks/useGameClient.ts'), 'utf8');

function fail(message) {
  console.error(`debug-client gameplay wire authority verifier failed: ${message}`);
  process.exit(1);
}

function requireLiteral(label, literal) {
  if (!source.includes(literal)) fail(`missing ${label}: ${literal}`);
}

function functionBody(name) {
  const marker = `const ${name} = useCallback(`;
  const start = source.indexOf(marker);
  if (start === -1) fail(`missing useCallback action ${name}`);
  const next = source.indexOf('\n  const ', start + marker.length);
  if (next === -1) return source.slice(start);
  return source.slice(start, next);
}

function assertNoClientAuthorityFields(label, body) {
  for (const field of ['character_id', 'player_id', 'x:', 'y:', 'account_id', 'csrf']) {
    if (body.includes(field)) fail(`${label} must not carry client authority field ${field}`);
  }
}

function assertIntentOnlyAction(name, expected) {
  const body = functionBody(name);
  for (const literal of expected) requireLiteral(`${name} payload literal`, literal);
  assertNoClientAuthorityFields(name, body);
}

requireLiteral('create request body posts account-character v2 fields', '} satisfies AccountCharacterCreateRequest),');
requireLiteral('select request body posts selected character id', "body: JSON.stringify({ character_id: characterId }),");
requireLiteral('create/select responses validate play token handoff', 'if (!isAccountCharacterPlayResponse(body)) {');
requireLiteral('token login prefers selected account character token', "loginMsg = { type: 'login', token: identity.token };");
requireLiteral('guest token is fallback only', "loginMsg = { type: 'login', guest_token: guest };");

assertIntentOnlyAction('startWork', [
  "const payload: StartWorkContractMessage = { type: 'start_work_contract', contract_type: 'temple_sweep' };",
  'send(payload);',
]);
assertIntentOnlyAction('tickWork', [
  "const payload: WorkTickMessage = { type: 'work_tick', contract_id: s.workContract.contract_id };",
  'send(payload);',
]);
assertIntentOnlyAction('buyHouse', [
  "send({ type: 'buy_house', property_id: propertyId });",
]);
assertIntentOnlyAction('listHouse', [
  "send({ type: 'list_house', property_id: propertyId, price });",
]);
assertIntentOnlyAction('unlistHouse', [
  "send({ type: 'unlist_house', property_id: propertyId });",
]);

console.log('debug-client gameplay wire authority verifier passed');
