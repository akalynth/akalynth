import { URL } from 'node:url';
import { PROPERTY_LISTED_ACTION, PROPERTY_PURCHASED_ACTION, PROPERTY_TRANSFERRED_ACTION, PROPERTY_UNLISTED_ACTION, WALLET_CREDIT_ACTION, WALLET_DEBIT_ACTION, } from '../../../../packages/shared/types.js';
import { CSRF_COOKIE } from '../account/service.js';
import { parseCookies, safeEqual } from '../account/tokens.js';
const MAX_BODY = 8192;
const CSRF_HEADER = 'x-csrf-token';
function send(res, status, body) {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}
function readJson(req) {
    return new Promise((resolve) => {
        const chunks = [];
        let size = 0;
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY) {
                req.destroy();
                resolve({});
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => {
            try {
                const v = Buffer.concat(chunks).toString('utf8');
                const parsed = v ? JSON.parse(v) : {};
                resolve(parsed && typeof parsed === 'object' ? parsed : {});
            }
            catch {
                resolve({});
            }
        });
        req.on('error', () => resolve({}));
    });
}
function csrfOk(req, cookies) {
    const csrfCookie = cookies[CSRF_COOKIE];
    const csrfHeader = req.headers[CSRF_HEADER];
    return typeof csrfHeader === 'string' && !!csrfCookie && safeEqual(csrfCookie, csrfHeader);
}
function propertyBody(p, characterId) {
    return {
        property_id: p.property_id,
        zone: p.zone,
        plot_id: p.plot_id,
        district: p.district,
        status: p.status,
        owned_by_character: p.owner_player_id === characterId,
        primary_price_gold: p.primary_price_gold,
        listed_price_gold: p.listed_price_gold,
        sale_count: p.sale_count,
    };
}
function resolveCharacterForAccount(deps, account, bodyOrQuery) {
    const characterId = bodyOrQuery.character_id;
    if (typeof characterId !== 'string' || !characterId) {
        return { ok: false, status: 400, body: { ok: false, error: 'character_id_required' } };
    }
    const character = deps.findCharacter(characterId);
    if (!character || character.account_id !== account.accountId) {
        return { ok: false, status: 404, body: { ok: false, error: 'character_not_found' } };
    }
    return { ok: true, account, character };
}
function resolveAuthedCharacter(deps, req, bodyOrQuery, csrfRequired) {
    const cookies = parseCookies(req.headers.cookie);
    const account = deps.resolveAccount(cookies);
    if (!account)
        return { ok: false, status: 401, body: { ok: false, error: 'not_authenticated' } };
    if (csrfRequired && !csrfOk(req, cookies)) {
        return { ok: false, status: 403, body: { ok: false, error: 'csrf_failed' } };
    }
    return resolveCharacterForAccount(deps, account, bodyOrQuery);
}
function shopCatalog(deps) {
    return {
        items: Object.entries(deps.shopItems).map(([shop_key, item]) => ({
            shop_key,
            item_type: item.item_type,
            name: item.name,
            tag: item.tag,
            description: item.description,
            price_gold: item.price,
            currency: 'gold',
        })),
    };
}
export function makeWebEconomyRouter(deps) {
    return async function handleWebEconomy(req, res) {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = url.pathname;
        const method = (req.method ?? 'GET').toUpperCase();
        if (path === '/v1/shop/catalog' && method === 'GET') {
            send(res, 200, shopCatalog(deps));
            return true;
        }
        if (path === '/v1/wallet' && method === 'GET') {
            const query = { character_id: url.searchParams.get('character_id') };
            const resolved = resolveAuthedCharacter(deps, req, query, false);
            if (!resolved.ok)
                return (send(res, resolved.status, resolved.body), true);
            const characterId = resolved.character.character_id;
            send(res, 200, { ok: true, character_id: characterId, balance_gold: deps.getGoldBalance(characterId) });
            return true;
        }
        if (path === '/v1/shop/purchase' && method === 'POST') {
            const body = await readJson(req);
            const resolved = resolveAuthedCharacter(deps, req, body, true);
            if (!resolved.ok)
                return (send(res, resolved.status, resolved.body), true);
            const shopKey = body.shop_key;
            if (typeof shopKey !== 'string' || !shopKey) {
                send(res, 400, { ok: false, error: 'shop_key_required' });
                return true;
            }
            const item = deps.shopItems[shopKey];
            if (!item) {
                send(res, 400, { ok: false, error: 'unknown_shop_item' });
                return true;
            }
            const characterId = resolved.character.character_id;
            const result = await deps.withTreasuryLock(characterId, () => {
                if (!deps.canAfford(characterId, item.price)) {
                    return { status: 409, body: { ok: false, error: 'insufficient_gold' } };
                }
                deps.writeReceipt({
                    player_id: characterId,
                    action: WALLET_DEBIT_ACTION,
                    inputs: { amount: item.price, reason: 'action_cost:shop_purchase' },
                    result: 'ok',
                });
                const mintReceipt = deps.writeReceipt({
                    player_id: characterId,
                    action: 'item_minted',
                    inputs: { item_type: item.item_type, meta: { source: 'web_shop', shop_key: shopKey }, reason: 'shop_purchase' },
                    result: 'ok',
                });
                const itemId = deps.generateItemId(deps.computeReceiptHash(mintReceipt));
                deps.writeReceipt({
                    player_id: characterId,
                    action: 'item_added_to_inventory',
                    inputs: { item_id: itemId, slot: null, source: 'web_shop' },
                    result: 'ok',
                });
                deps.addInventoryItem(characterId, itemId);
                return {
                    status: 200,
                    body: {
                        ok: true,
                        item: { item_id: itemId, item_type: item.item_type, shop_key: shopKey },
                        balance_gold: deps.getGoldBalance(characterId),
                    },
                };
            });
            send(res, result.status, result.body);
            return true;
        }
        if (path === '/v1/work/start' && method === 'POST') {
            const body = await readJson(req);
            const resolved = resolveAuthedCharacter(deps, req, body, true);
            if (!resolved.ok)
                return (send(res, resolved.status, resolved.body), true);
            const characterId = resolved.character.character_id;
            const result = deps.startWorkContract(characterId);
            if (!result.ok)
                return (send(res, 409, { ok: false, error: result.error }), true);
            const response = {
                ok: true,
                character_id: characterId,
                contract_id: result.contract_id,
                contract_type: 'temple_sweep',
                payout_gold: result.payout_gold,
                cooldown_seconds: result.cooldown_seconds,
                min_duration_ms: result.min_duration_ms,
            };
            send(res, 200, response);
            return true;
        }
        if (path === '/v1/work/tick' && method === 'POST') {
            const body = await readJson(req);
            const resolved = resolveAuthedCharacter(deps, req, body, true);
            if (!resolved.ok)
                return (send(res, resolved.status, resolved.body), true);
            const contractId = body.contract_id;
            if (typeof contractId !== 'string' || !contractId) {
                send(res, 400, { ok: false, error: 'contract_id_required' });
                return true;
            }
            const characterId = resolved.character.character_id;
            const result = deps.tickWorkContract(characterId, contractId);
            if (!result.ok)
                return (send(res, 409, { ok: false, error: result.error }), true);
            const { ok: _ok, ...tickBody } = result;
            const response = { ok: true, character_id: characterId, ...tickBody };
            send(res, 200, response);
            return true;
        }
        if (path === '/v1/property/buy' && method === 'POST') {
            const body = await readJson(req);
            const resolved = resolveAuthedCharacter(deps, req, body, true);
            if (!resolved.ok)
                return (send(res, resolved.status, resolved.body), true);
            const propertyId = body.property_id;
            if (typeof propertyId !== 'string' || !propertyId) {
                send(res, 400, { ok: false, error: 'property_id_required' });
                return true;
            }
            const buyer = resolved.character.character_id;
            const result = await deps.withTreasuryLock(buyer, () => {
                const prop = deps.getProperty(propertyId);
                if (!prop)
                    return { status: 404, body: { ok: false, error: 'unknown_plot' } };
                if (prop.owner_player_id === buyer)
                    return { status: 409, body: { ok: false, error: 'cannot_buy_own' } };
                if (prop.status === 'unowned') {
                    const price = prop.primary_price_gold;
                    if (!deps.canAfford(buyer, price)) {
                        return { status: 409, body: { ok: false, error: 'insufficient_gold' } };
                    }
                    deps.writeReceipt({
                        player_id: buyer,
                        action: WALLET_DEBIT_ACTION,
                        inputs: { amount: price, reason: `property_purchase:${prop.property_id}` },
                        result: 'ok',
                    });
                    deps.writeReceipt({
                        player_id: buyer,
                        action: PROPERTY_PURCHASED_ACTION,
                        inputs: { property_id: prop.property_id, price },
                        result: 'ok',
                    });
                }
                else if (prop.status === 'listed' && prop.listed_price_gold != null && prop.owner_player_id) {
                    const price = prop.listed_price_gold;
                    const seller = prop.owner_player_id;
                    if (!deps.canAfford(buyer, price)) {
                        return { status: 409, body: { ok: false, error: 'insufficient_gold' } };
                    }
                    deps.writeReceipt({
                        player_id: buyer,
                        action: WALLET_DEBIT_ACTION,
                        inputs: { amount: price, reason: `property_transfer:${prop.property_id}` },
                        result: 'ok',
                    });
                    deps.writeReceipt({
                        player_id: seller,
                        action: WALLET_CREDIT_ACTION,
                        inputs: { amount: price, reason: `property_sale:${prop.property_id}` },
                        result: 'ok',
                    });
                    deps.writeReceipt({
                        player_id: buyer,
                        action: PROPERTY_TRANSFERRED_ACTION,
                        inputs: { property_id: prop.property_id, seller_id: seller, price },
                        result: 'ok',
                    });
                }
                else {
                    return { status: 409, body: { ok: false, error: 'not_for_sale' } };
                }
                const updated = deps.getProperty(propertyId);
                return {
                    status: 200,
                    body: { ok: true, property: propertyBody(updated, buyer), balance_gold: deps.getGoldBalance(buyer) },
                };
            });
            send(res, result.status, result.body);
            return true;
        }
        if (path === '/v1/property/list' && method === 'POST') {
            const body = await readJson(req);
            const resolved = resolveAuthedCharacter(deps, req, body, true);
            if (!resolved.ok)
                return (send(res, resolved.status, resolved.body), true);
            const propertyId = body.property_id;
            if (typeof propertyId !== 'string' || !propertyId) {
                send(res, 400, { ok: false, error: 'property_id_required' });
                return true;
            }
            if (!deps.isValidPrice(body.price_gold)) {
                send(res, 400, { ok: false, error: 'invalid_price' });
                return true;
            }
            const characterId = resolved.character.character_id;
            const prop = deps.getProperty(propertyId);
            if (!prop)
                return (send(res, 404, { ok: false, error: 'unknown_plot' }), true);
            if (prop.owner_player_id !== characterId)
                return (send(res, 403, { ok: false, error: 'not_owner' }), true);
            if (prop.status === 'listed')
                return (send(res, 409, { ok: false, error: 'already_listed' }), true);
            deps.writeReceipt({
                player_id: characterId,
                action: PROPERTY_LISTED_ACTION,
                inputs: { property_id: prop.property_id, price: body.price_gold },
                result: 'ok',
            });
            const updated = deps.getProperty(propertyId);
            send(res, 200, { ok: true, property: propertyBody(updated, characterId) });
            return true;
        }
        if (path === '/v1/property/unlist' && method === 'POST') {
            const body = await readJson(req);
            const resolved = resolveAuthedCharacter(deps, req, body, true);
            if (!resolved.ok)
                return (send(res, resolved.status, resolved.body), true);
            const propertyId = body.property_id;
            if (typeof propertyId !== 'string' || !propertyId) {
                send(res, 400, { ok: false, error: 'property_id_required' });
                return true;
            }
            const characterId = resolved.character.character_id;
            const prop = deps.getProperty(propertyId);
            if (!prop)
                return (send(res, 404, { ok: false, error: 'unknown_plot' }), true);
            if (prop.owner_player_id !== characterId)
                return (send(res, 403, { ok: false, error: 'not_owner' }), true);
            if (prop.status !== 'listed')
                return (send(res, 409, { ok: false, error: 'not_listed' }), true);
            deps.writeReceipt({
                player_id: characterId,
                action: PROPERTY_UNLISTED_ACTION,
                inputs: { property_id: prop.property_id },
                result: 'ok',
            });
            const updated = deps.getProperty(propertyId);
            send(res, 200, { ok: true, property: propertyBody(updated, characterId) });
            return true;
        }
        send(res, 404, { ok: false, error: 'not_found' });
        return true;
    };
}
