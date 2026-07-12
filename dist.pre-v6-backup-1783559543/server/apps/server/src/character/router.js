import { URL } from 'node:url';
import { CSRF_COOKIE } from '../account/service.js';
import { parseCookies, safeEqual } from '../account/tokens.js';
const MAX_BODY = 8192;
const CSRF_HEADER = 'x-csrf-token';
function send(res, r) {
    res.statusCode = r.status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(r.body));
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
export function makeCharacterRouter(deps) {
    const { service } = deps;
    function csrfOk(req, cookies) {
        const csrfCookie = cookies[CSRF_COOKIE];
        const csrfHeader = req.headers[CSRF_HEADER];
        return typeof csrfHeader === 'string' && !!csrfCookie && safeEqual(csrfCookie, csrfHeader);
    }
    return async function handleCharacter(req, res) {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = url.pathname;
        const method = (req.method ?? 'GET').toUpperCase();
        const cookies = parseCookies(req.headers.cookie);
        const account = () => deps.resolveAccount(cookies);
        // Public catalogs.
        if (path === '/v1/worlds' && method === 'GET')
            return (send(res, service.worlds()), true);
        if (path === '/v1/outfits' && method === 'GET')
            return (send(res, service.outfits(url.searchParams.get('sex'))), true);
        // Account-gated character endpoints.
        if (path === '/v1/characters' && method === 'GET') {
            const a = account();
            if (!a)
                return (send(res, { status: 401, body: { ok: false, error: 'not_authenticated' } }), true);
            return (send(res, service.list(a.accountId)), true);
        }
        if (path === '/v1/characters' && method === 'POST') {
            const a = account();
            if (!a)
                return (send(res, { status: 401, body: { ok: false, error: 'not_authenticated' } }), true);
            if (!csrfOk(req, cookies))
                return (send(res, { status: 403, body: { ok: false, error: 'csrf_failed' } }), true);
            if (deps.requireVerifiedForCreate && !a.emailVerified) {
                return (send(res, { status: 403, body: { ok: false, error: 'email_unverified', message: 'Verify your email before creating a character.' } }), true);
            }
            return (send(res, service.create(a.accountId, await readJson(req))), true);
        }
        if (path === '/v1/characters/select' && method === 'POST') {
            const a = account();
            if (!a)
                return (send(res, { status: 401, body: { ok: false, error: 'not_authenticated' } }), true);
            if (!csrfOk(req, cookies))
                return (send(res, { status: 403, body: { ok: false, error: 'csrf_failed' } }), true);
            return (send(res, service.select(a.accountId, await readJson(req))), true);
        }
        if (path === '/v1/characters/outfit' && method === 'POST') {
            const a = account();
            if (!a)
                return (send(res, { status: 401, body: { ok: false, error: 'not_authenticated' } }), true);
            if (!csrfOk(req, cookies))
                return (send(res, { status: 403, body: { ok: false, error: 'csrf_failed' } }), true);
            return (send(res, service.updateOutfit(a.accountId, await readJson(req))), true);
        }
        if (path === '/v1/library/discovery' && method === 'GET') {
            const a = account();
            if (!a)
                return (send(res, { status: 401, body: { ok: false, error: 'not_authenticated' } }), true);
            return (send(res, service.libraryDiscovery(a.accountId, url.searchParams.get('character_id'))), true);
        }
        send(res, { status: 404, body: { ok: false, error: 'not_found' } });
        return true;
    };
}
