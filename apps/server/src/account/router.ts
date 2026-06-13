// HTTP router for the account API (E2). Self-contained: parses body + cookies +
// CSRF header, applies the AccountService, and writes the response (incl.
// Set-Cookie). handleHttp delegates `/v1/accounts/*` here.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { AccountService, AccountResponse, RequestCtx } from './service.js';
import { parseCookies } from './tokens.js';
import { RateLimiter } from './rateLimit.js';

const CSRF_HEADER = 'x-csrf-token';
const CLIENT_HEADER = 'x-akalynth-client';
const MAX_BODY = 8192;

function send(res: ServerResponse, r: AccountResponse): void {
  res.statusCode = r.status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  if (r.cookies && r.cookies.length) res.setHeader('Set-Cookie', r.cookies);
  if (r.headers) {
    for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  }
  res.end(JSON.stringify(r.body));
}

function rateLimited(res: ServerResponse, retryAfterSec: number): void {
  res.statusCode = 429;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('Retry-After', String(retryAfterSec));
  res.end(JSON.stringify({ ok: false, error: 'rate_limited', retry_after_sec: retryAfterSec }));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
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
        const s = Buffer.concat(chunks).toString('utf8');
        const v = s ? JSON.parse(s) : {};
        resolve(v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  return typeof v === 'string' ? v : undefined;
}

function clientIp(req: IncomingMessage): string {
  const xff = header(req, 'x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

export interface AccountRouterDeps {
  service: AccountService;
  loginLimiter: RateLimiter; // login attempts
  writeLimiter: RateLimiter; // register + reset-request
}

export function makeAccountRouter(deps: AccountRouterDeps) {
  const { service } = deps;
  const ctx = (req: IncomingMessage): RequestCtx => ({
    cookies: parseCookies(req.headers.cookie),
    csrfHeader: header(req, CSRF_HEADER),
    client: header(req, CLIENT_HEADER) ?? null,
  });

  return async function handleAccount(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const method = (req.method ?? 'GET').toUpperCase();

    if (path === '/v1/accounts/register' && method === 'POST') {
      const rl = deps.writeLimiter.check(`reg:${clientIp(req)}`);
      if (!rl.ok) return (rateLimited(res, rl.retryAfterSec), true);
      send(res, await service.register(await readJson(req)));
      return true;
    }
    if (path === '/v1/accounts/verify-email' && method === 'POST') {
      send(res, service.verifyEmail(await readJson(req)));
      return true;
    }
    if (path === '/v1/accounts/login' && method === 'POST') {
      const rl = deps.loginLimiter.check(`login:${clientIp(req)}`);
      if (!rl.ok) return (rateLimited(res, rl.retryAfterSec), true);
      send(res, await service.login(await readJson(req), ctx(req)));
      return true;
    }
    if (path === '/v1/accounts/logout' && method === 'POST') {
      send(res, service.logout(ctx(req)));
      return true;
    }
    if (path === '/v1/accounts/me' && method === 'GET') {
      send(res, service.me(ctx(req)));
      return true;
    }
    if (path === '/v1/accounts/authorize' && method === 'GET') {
      // Caddy forward_auth gate for operator Codex surfaces. surface from query;
      // original path from the X-Forwarded-Uri header Caddy sets on the subrequest.
      const url = new URL(req.url ?? '/', 'http://localhost');
      const surface = url.searchParams.get('surface') ?? '';
      const requestedUri = header(req, 'x-forwarded-uri') ?? '';
      send(res, service.authorize(ctx(req), surface, requestedUri));
      return true;
    }
    if (path === '/v1/accounts/password-reset/request' && method === 'POST') {
      const rl = deps.writeLimiter.check(`reset:${clientIp(req)}`);
      if (!rl.ok) return (rateLimited(res, rl.retryAfterSec), true);
      send(res, service.resetRequest(await readJson(req)));
      return true;
    }
    if (path === '/v1/accounts/password-reset/confirm' && method === 'POST') {
      send(res, await service.resetConfirm(await readJson(req)));
      return true;
    }

    send(res, { status: 404, body: { ok: false, error: 'not_found' } });
    return true;
  };
}
