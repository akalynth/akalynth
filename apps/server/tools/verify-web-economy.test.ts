#!/usr/bin/env tsx
/**
 * Web economy router test.
 *
 * Proves the static portal command surface is account-gated, CSRF-protected,
 * receipt-backed, and does not create browser-local shop or property authority.
 */
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import {
  computeEventHash,
  computeInputsHash,
  computeOutputsHash,
  GENESIS_MARKER,
} from '@akalynth/coordination-kernel';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import {
  PROPERTY_CREATED_ACTION,
  PROPERTY_LISTED_ACTION,
  PROPERTY_PURCHASED_ACTION,
  PROPERTY_TRANSFERRED_ACTION,
  PROPERTY_UNLISTED_ACTION,
  WALLET_CREDIT_ACTION,
  WALLET_DEBIT_ACTION,
  WORK_CONTRACT_COMPLETED_ACTION,
  WORK_CONTRACT_STARTED_ACTION,
  WORK_CONTRACT_TICK_RECORDED_ACTION,
} from '../../../packages/shared/types.js';
import { CSRF_COOKIE, SESSION_COOKIE } from '../src/account/service.js';
import type { AccountCharacterRow } from '../src/persist/types.js';
import { computeReceiptHash, generateItemId } from '../src/persist/index.js';
import { makeWebEconomyRouter } from '../src/economy/router.js';
import {
  applyReceiptToProperty,
  clearPropertyProjection,
  getProperty,
  isValidPrice,
} from '../src/world/property.js';
import {
  applyReceiptToTreasury,
  canAfford,
  clearTreasuryProjection,
  getGoldBalance,
  withTreasuryLock,
} from '../src/world/treasury.js';
import {
  applyReceiptToWorkContracts,
  clearWorkContractsProjection,
  completeContract,
  recordTick,
  startContract,
} from '../src/world/work_contracts.js';

let failed = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
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

async function request(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers?: IncomingHttpHeaders
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = makeRes();
  await router(makeReq(method, url, body, headers), res);
  return { status: res.statusCode, body: JSON.parse(res.bodyText || '{}') as Record<string, unknown> };
}

function cookieHeader(csrf = 'csrf-ok'): string {
  return `${SESSION_COOKIE}=sess-ok; ${CSRF_COOKIE}=${csrf}`;
}

let lastEventHash: string | null = null;
let lastSequence = 0;
let logicalNowMs = 1_700_000_000_000;
const receipts: AuditReceipt[] = [];
const inventory = new Map<string, Set<string>>();

function writeReceipt(input: {
  player_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
}): AuditReceipt {
  const base = {
    actor_id: input.player_id,
    action: input.action,
    inputs: input.inputs,
    result: input.result,
  };
  const inputs_hash = computeInputsHash(base.inputs);
  const outputs_hash = computeOutputsHash(base.result);
  const timestamp = new Date(logicalNowMs).toISOString();
  logicalNowMs += 1000;
  const sequence = lastSequence + 1;
  const prev_hash = lastEventHash ?? GENESIS_MARKER;
  const body = { ...base, sequence, timestamp, prev_hash, inputs_hash, outputs_hash };
  const event_hash = computeEventHash(body);
  const full: AuditReceipt = { ...body, event_hash, signature: 'test-signature' };
  lastEventHash = event_hash;
  lastSequence = sequence;
  receipts.push(full);
  applyReceiptToTreasury(full);
  applyReceiptToProperty(full);
  applyReceiptToWorkContracts(full);
  return full;
}

function writeWorkReceipt(input: Omit<AuditReceipt, 'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'>): void {
  writeReceipt({
    player_id: input.actor_id,
    action: input.action,
    inputs: input.inputs ?? {},
    result: input.result,
  });
}

function resetState(): void {
  clearTreasuryProjection();
  clearPropertyProjection();
  clearWorkContractsProjection();
  receipts.length = 0;
  inventory.clear();
  lastEventHash = null;
  lastSequence = 0;
  logicalNowMs = 1_700_000_000_000;
}

function seedProperty(propertyId: string, primaryPrice: number): void {
  const [zone, plotId] = propertyId.split(':');
  writeReceipt({
    player_id: 'system',
    action: PROPERTY_CREATED_ACTION,
    inputs: { property_id: propertyId, zone, plot_id: plotId, x: 1, y: 1, width: 2, height: 2, district: 'Test', primary_price_gold: primaryPrice },
    result: 'ok',
  });
}

function fund(playerId: string, amount: number): void {
  writeReceipt({ player_id: playerId, action: WALLET_CREDIT_ACTION, inputs: { amount, reason: 'debug_grant' }, result: 'ok' });
}

const characters = new Map<string, AccountCharacterRow>([
  ['p_buyer', { character_id: 'p_buyer', account_id: 'acc_ok', name: 'Buyer', world_id: 'high_city', sex: 'female', outfit_id: 'female_guard', created_at: '2026-01-01T00:00:00.000Z', created_receipt: null }],
  ['p_seller', { character_id: 'p_seller', account_id: 'acc_ok', name: 'Seller', world_id: 'high_city', sex: 'male', outfit_id: 'male_guard', created_at: '2026-01-01T00:00:00.000Z', created_receipt: null }],
  ['p_other', { character_id: 'p_other', account_id: 'acc_other', name: 'Other', world_id: 'high_city', sex: 'male', outfit_id: 'male_guard', created_at: '2026-01-01T00:00:00.000Z', created_receipt: null }],
]);

const router = makeWebEconomyRouter({
  resolveAccount: (cookies) => (cookies[SESSION_COOKIE] === 'sess-ok' ? { accountId: 'acc_ok', emailVerified: true } : null),
  findCharacter: (characterId) => characters.get(characterId),
  shopItems: {
    healing_herb: {
      item_type: 'healing_herb',
      price: 5,
      name: 'Healing Herb',
      tag: 'Consumable',
      description: 'A server-authoritative in-game item.',
    },
  },
  canAfford,
  getGoldBalance,
  withTreasuryLock,
  writeReceipt,
  computeReceiptHash,
  generateItemId,
  addInventoryItem: (playerId, itemId) => {
    if (!inventory.has(playerId)) inventory.set(playerId, new Set());
    inventory.get(playerId)!.add(itemId);
  },
  getProperty,
  isValidPrice,
  startWorkContract: (playerId) => startContract(playerId, 'temple_sweep', logicalNowMs, writeWorkReceipt),
  tickWorkContract: (playerId, contractId) => {
    const tickResult = recordTick(playerId, contractId, logicalNowMs, writeWorkReceipt);
    if (!tickResult.ok) return tickResult;
    if (!tickResult.ready_to_complete) {
      return {
        ok: true as const,
        contract_id: contractId,
        ticks_observed: tickResult.ticks_observed,
        ticks_required: tickResult.ticks_required,
        remaining_ms: tickResult.remaining_ms,
        completed: false,
      };
    }
    const completeResult = completeContract(playerId, contractId, logicalNowMs, writeWorkReceipt);
    if (!completeResult.ok) return completeResult;
    return {
      ok: true as const,
      contract_id: contractId,
      ticks_observed: tickResult.ticks_observed,
      ticks_required: tickResult.ticks_required,
      remaining_ms: tickResult.remaining_ms,
      completed: true,
      credited_gold: completeResult.credited_gold,
      balance_gold: getGoldBalance(playerId),
    };
  },
});

async function main(): Promise<void> {
  resetState();
  let res = await request('GET', '/v1/shop/catalog');
  check('shop catalog is public', res.status === 200 && Array.isArray(res.body.items));

  res = await request('GET', '/v1/wallet?character_id=p_buyer');
  check('wallet read requires account session', res.status === 401 && res.body.error === 'not_authenticated');

  res = await request('GET', '/v1/wallet?character_id=p_buyer', undefined, { cookie: cookieHeader() });
  check('wallet read requires account-owned character', res.status === 200 && res.body.balance_gold === 0);

  res = await request('GET', '/v1/wallet?character_id=p_other', undefined, { cookie: cookieHeader() });
  check('wallet rejects character owned by another account', res.status === 404 && res.body.error === 'character_not_found');
  check('cross-account wallet read emits no receipts', receipts.length === 0);

  res = await request('POST', '/v1/shop/purchase', { character_id: 'p_buyer', shop_key: 'healing_herb' });
  check('shop purchase requires account session', res.status === 401 && res.body.error === 'not_authenticated');

  res = await request('POST', '/v1/shop/purchase', { character_id: 'p_buyer', shop_key: 'healing_herb' }, { cookie: cookieHeader(), 'x-csrf-token': 'bad' });
  check('shop purchase requires matching csrf', res.status === 403 && res.body.error === 'csrf_failed');
  check('auth/csrf rejected shop requests emit no receipts', receipts.length === 0);

  res = await request('POST', '/v1/shop/purchase', { character_id: 'p_buyer', shop_key: 'healing_herb' }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  check('shop purchase without gold is rejected', res.status === 409 && res.body.error === 'insufficient_gold');
  check('rejected shop purchase emitted no debit/mint receipts', receipts.every((r) => r.action !== WALLET_DEBIT_ACTION && r.action !== 'item_minted'));

  fund('p_buyer', 10);
  res = await request('POST', '/v1/shop/purchase', { character_id: 'p_buyer', shop_key: 'healing_herb' }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  const shopActions = receipts.slice(-3).map((r) => r.action);
  const minted = receipts.findLast((r) => r.action === 'item_minted')!;
  const expectedItemId = generateItemId(computeReceiptHash(minted));
  check('shop purchase succeeds', res.status === 200 && res.body.ok === true && res.body.balance_gold === 5);
  check('shop purchase emits debit -> mint -> inventory receipts', JSON.stringify(shopActions) === JSON.stringify([WALLET_DEBIT_ACTION, 'item_minted', 'item_added_to_inventory']));
  check('shop item id is derived from mint receipt hash', (res.body.item as { item_id?: string }).item_id === expectedItemId);
  check('shop inventory mirror updated', inventory.get('p_buyer')?.has(expectedItemId) === true);
  check('shop receipts do not carry account/session/csrf tokens', receipts.every((r) => !JSON.stringify(r).includes('sess-ok') && !JSON.stringify(r).includes('csrf-ok')));

  res = await request('POST', '/v1/work/start', { character_id: 'p_buyer' });
  check('work start requires account session', res.status === 401 && res.body.error === 'not_authenticated');

  res = await request('POST', '/v1/work/start', { character_id: 'p_other' }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  check('work start rejects character owned by another account', res.status === 404 && res.body.error === 'character_not_found');
  check('cross-account work start emits no receipts', receipts.filter((r) => r.action === WORK_CONTRACT_STARTED_ACTION).length === 0);

  res = await request('POST', '/v1/work/start', { character_id: 'p_buyer' }, { cookie: cookieHeader(), 'x-csrf-token': 'bad' });
  check('work start requires matching csrf', res.status === 403 && res.body.error === 'csrf_failed');

  res = await request('POST', '/v1/work/start', { character_id: 'p_buyer' }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  const contractId = res.body.contract_id as string;
  check('work start succeeds', res.status === 200 && res.body.ok === true && typeof contractId === 'string' && contractId.startsWith('wc_'));
  check('work start emits work_contract_started receipt', receipts.at(-1)?.action === WORK_CONTRACT_STARTED_ACTION);

  res = await request('POST', '/v1/work/tick', { character_id: 'p_buyer', contract_id: contractId });
  check('work tick requires account session', res.status === 401 && res.body.error === 'not_authenticated');

  res = await request('POST', '/v1/work/tick', { character_id: 'p_buyer', contract_id: contractId }, { cookie: cookieHeader(), 'x-csrf-token': 'bad' });
  check('work tick requires matching csrf', res.status === 403 && res.body.error === 'csrf_failed');
  check('auth/csrf rejected work tick emits no receipts', receipts.filter((r) => r.action === WORK_CONTRACT_TICK_RECORDED_ACTION).length === 0);

  res = await request('POST', '/v1/work/tick', { character_id: 'p_buyer' }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  check('work tick requires contract id', res.status === 400 && res.body.error === 'contract_id_required');

  for (let i = 0; i < 6; i++) {
    logicalNowMs += 5_000;
    res = await request('POST', '/v1/work/tick', { character_id: 'p_buyer', contract_id: contractId }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  }
  check('work tick completes after presence gates', res.status === 200 && res.body.completed === true && res.body.credited_gold === 10);
  check('work completion updates wallet balance', res.body.balance_gold === getGoldBalance('p_buyer'));
  check('work receipts include ticks, completion, and wallet credit', [WORK_CONTRACT_TICK_RECORDED_ACTION, WORK_CONTRACT_COMPLETED_ACTION, WALLET_CREDIT_ACTION].every((a) => receipts.some((r) => r.action === a)));

  resetState();
  seedProperty('Azura:H1', 100);
  res = await request('POST', '/v1/property/buy', { character_id: 'p_buyer', property_id: 'Azura:H1' });
  check('property buy requires account session', res.status === 401 && res.body.error === 'not_authenticated');

  res = await request('POST', '/v1/property/buy', { character_id: 'p_buyer', property_id: 'Azura:H1' }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  check('property buy without gold is rejected', res.status === 409 && res.body.error === 'insufficient_gold');
  check('rejected property buy emitted no purchase receipt', receipts.every((r) => r.action !== PROPERTY_PURCHASED_ACTION));

  fund('p_buyer', 150);
  res = await request('POST', '/v1/property/buy', { character_id: 'p_buyer', property_id: 'Azura:H1' }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  check('primary property buy succeeds', res.status === 200 && res.body.balance_gold === 50);
  check('primary property buy owns plot', getProperty('Azura:H1')?.owner_player_id === 'p_buyer');
  check('primary buy emitted wallet debit + property purchase', receipts.slice(-2).map((r) => r.action).join(',') === `${WALLET_DEBIT_ACTION},${PROPERTY_PURCHASED_ACTION}`);

  res = await request('POST', '/v1/property/list', { character_id: 'p_buyer', property_id: 'Azura:H1', price_gold: 75 });
  check('property list requires account session', res.status === 401 && res.body.error === 'not_authenticated');

  res = await request('POST', '/v1/property/list', { character_id: 'p_buyer', property_id: 'Azura:H1', price_gold: 75 }, { cookie: cookieHeader(), 'x-csrf-token': 'bad' });
  check('property list requires matching csrf', res.status === 403 && res.body.error === 'csrf_failed');
  check('auth/csrf rejected property list emits no listing receipt', receipts.every((r) => r.action !== PROPERTY_LISTED_ACTION));

  res = await request('POST', '/v1/property/list', { character_id: 'p_seller', property_id: 'Azura:H1', price_gold: 75 }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  check('property list rejects non-owner', res.status === 403 && res.body.error === 'not_owner');
  check('non-owner property list emits no listing receipt', receipts.every((r) => r.action !== PROPERTY_LISTED_ACTION));

  res = await request('POST', '/v1/property/list', { character_id: 'p_buyer', property_id: 'Azura:H1', price_gold: 75 }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  check('property list succeeds for owner', res.status === 200 && getProperty('Azura:H1')?.status === 'listed');
  check('property list emitted property_listed receipt', receipts.at(-1)?.action === PROPERTY_LISTED_ACTION);

  fund('p_seller', 300);
  seedProperty('Azura:H2', 100);
  await request('POST', '/v1/property/buy', { character_id: 'p_seller', property_id: 'Azura:H2' }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  await request('POST', '/v1/property/list', { character_id: 'p_seller', property_id: 'Azura:H2', price_gold: 60 }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  fund('p_buyer', 60);
  res = await request('POST', '/v1/property/buy', { character_id: 'p_buyer', property_id: 'Azura:H2' }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  check('resale property buy succeeds', res.status === 200 && getProperty('Azura:H2')?.owner_player_id === 'p_buyer');
  check('resale debits buyer wallet', getGoldBalance('p_buyer') === 50);
  check('resale credits seller wallet', getGoldBalance('p_seller') === 260);
  check('resale emits buyer debit + seller credit + transfer', receipts.slice(-3).map((r) => r.action).join(',') === `${WALLET_DEBIT_ACTION},${WALLET_CREDIT_ACTION},${PROPERTY_TRANSFERRED_ACTION}`);

  res = await request('POST', '/v1/property/unlist', { character_id: 'p_buyer', property_id: 'Azura:H1' }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  check('property unlist succeeds for owner', res.status === 200 && getProperty('Azura:H1')?.status === 'owned');
  check('property unlist emitted property_unlisted receipt', receipts.at(-1)?.action === PROPERTY_UNLISTED_ACTION);

  res = await request('POST', '/v1/property/unlist', { character_id: 'p_buyer', property_id: 'Azura:H1' });
  check('property unlist requires account session', res.status === 401 && res.body.error === 'not_authenticated');

  res = await request('POST', '/v1/property/unlist', { character_id: 'p_buyer', property_id: 'Azura:H1' }, { cookie: cookieHeader(), 'x-csrf-token': 'bad' });
  check('property unlist requires matching csrf', res.status === 403 && res.body.error === 'csrf_failed');
  check('auth/csrf rejected property unlist emits no unlist receipt', receipts.at(-1)?.action === PROPERTY_UNLISTED_ACTION);

  res = await request('POST', '/v1/property/unlist', { character_id: 'p_seller', property_id: 'Azura:H1' }, { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' });
  check('property unlist rejects non-owner', res.status === 403 && res.body.error === 'not_owner');
  check('non-owner property unlist emits no second unlist receipt', receipts.filter((r) => r.action === PROPERTY_UNLISTED_ACTION).length === 1);
}

main().then(() => {
  if (failed > 0) {
    console.error(`\n[verify-web-economy.test] ${failed} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\n[verify-web-economy.test] all checks passed');
}).catch((e) => {
  console.error('crashed:', e);
  process.exit(1);
});
