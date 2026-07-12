import { URL } from 'node:url';
const MAX_BODY = 65536;
function send(res, response) {
    res.statusCode = response.status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(response.body));
}
function rateLimited(res, retryAfterSec) {
    send(res, { status: 429, body: { ok: false, error: 'rate_limited', retry_after_sec: retryAfterSec } });
}
function clientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim())
        return xff.split(',')[0].trim();
    return req.socket.remoteAddress ?? 'unknown';
}
function authHeader(req) {
    const value = req.headers.authorization;
    return typeof value === 'string' ? value : undefined;
}
function readJson(req) {
    return new Promise((resolve) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY) {
                req.destroy();
                resolve({});
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                const parsed = raw ? JSON.parse(raw) : {};
                resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
            }
            catch {
                resolve({});
            }
        });
        req.on('error', () => resolve({}));
    });
}
export function makePrincipalRouter(deps) {
    const { service } = deps;
    return async function handlePrincipal(req, res) {
        const path = new URL(req.url ?? '/', 'http://localhost').pathname;
        const method = (req.method ?? 'GET').toUpperCase();
        if (path === '/v1/principals/policy' && method === 'GET') {
            send(res, service.policy());
            return true;
        }
        if (path === '/v1/principals/me' && method === 'GET') {
            send(res, service.me(authHeader(req)));
            return true;
        }
        if (path === '/v1/principals/register' && method === 'POST') {
            const rl = deps.writeLimiter.check(`principal-register:${clientIp(req)}`);
            if (!rl.ok)
                return (rateLimited(res, rl.retryAfterSec), true);
            send(res, service.register(await readJson(req)));
            return true;
        }
        if (path === '/v1/principals/challenge' && method === 'POST') {
            const rl = deps.challengeLimiter.check(`principal-challenge:${clientIp(req)}`);
            if (!rl.ok)
                return (rateLimited(res, rl.retryAfterSec), true);
            send(res, service.challenge(await readJson(req)));
            return true;
        }
        if (path === '/v1/principals/verify' && method === 'POST') {
            send(res, service.verify(await readJson(req)));
            return true;
        }
        if (path === '/v1/principals/terms' && method === 'POST') {
            send(res, service.acceptTerms(authHeader(req), await readJson(req)));
            return true;
        }
        if (path === '/v1/principals/retire' && method === 'POST') {
            send(res, service.retire(authHeader(req), await readJson(req)));
            return true;
        }
        if (path === '/v1/principals/delete-request' && method === 'POST') {
            send(res, service.deletePrincipal(authHeader(req), await readJson(req)));
            return true;
        }
        if (path === '/v1/principals/block' && method === 'POST') {
            send(res, service.block(authHeader(req), await readJson(req)));
            return true;
        }
        if (path === '/v1/principals/report' && method === 'POST') {
            send(res, service.report(authHeader(req), await readJson(req)));
            return true;
        }
        if (path === '/v1/principals/pgp-bind' && method === 'POST') {
            send(res, service.pgpBind(authHeader(req), await readJson(req)));
            return true;
        }
        if (path === '/v1/principals/moderation/reports' && method === 'GET') {
            const url = new URL(req.url ?? '/', 'http://localhost');
            send(res, service.listReports(authHeader(req), {
                status: url.searchParams.get('status') ?? 'open',
                limit: Number(url.searchParams.get('limit') ?? 50),
            }));
            return true;
        }
        if (path === '/v1/principals/moderation/resolve' && method === 'POST') {
            send(res, service.resolveReport(authHeader(req), await readJson(req)));
            return true;
        }
        send(res, { status: 404, body: { ok: false, error: 'not_found' } });
        return true;
    };
}
