// HTTP router for the character + catalog surface (E4). handleHttp delegates
// /v1/worlds, /v1/outfits, /v1/characters, /v1/characters/select, and
// /v1/characters/outfit here. The
// character endpoints require an account session (resolved from the cookie);
// create additionally requires a verified email.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { CharacterService, CharacterResult } from './service.js';
import { CSRF_COOKIE } from '../account/service.js';
import { parseCookies, safeEqual } from '../account/tokens.js';

const MAX_BODY = 8192;
const CSRF_HEADER = 'x-csrf-token';

function send(res: ServerResponse, r: CharacterResult): void {
  res.statusCode = r.status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(r.body));
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
        const v = Buffer.concat(chunks).toString('utf8');
        const parsed = v ? JSON.parse(v) : {};
        resolve(parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export interface SessionAccount {
  accountId: string;
  emailVerified: boolean;
}

export interface CharacterRouterDeps {
  service: CharacterService;
  resolveAccount: (cookies: Record<string, string>) => SessionAccount | null;
  requireVerifiedForCreate: boolean;
}

export function makeCharacterRouter(deps: CharacterRouterDeps) {
  const { service } = deps;
  function csrfOk(req: IncomingMessage, cookies: Record<string, string>): boolean {
    const csrfCookie = cookies[CSRF_COOKIE];
    const csrfHeader = req.headers[CSRF_HEADER];
    return typeof csrfHeader === 'string' && !!csrfCookie && safeEqual(csrfCookie, csrfHeader);
  }

  return async function handleCharacter(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const method = (req.method ?? 'GET').toUpperCase();
    const cookies = parseCookies(req.headers.cookie);
    const account = (): SessionAccount | null => deps.resolveAccount(cookies);

    // Public catalogs.
    if (path === '/v1/worlds' && method === 'GET') return (send(res, service.worlds()), true);
    if (path === '/v1/outfits' && method === 'GET') return (send(res, service.outfits(url.searchParams.get('sex'))), true);

    // Account-gated character endpoints.
    if (path === '/v1/characters' && method === 'GET') {
      const a = account();
      if (!a) return (send(res, { status: 401, body: { ok: false, error: 'not_authenticated' } }), true);
      return (send(res, service.list(a.accountId)), true);
    }
    if (path === '/v1/characters' && method === 'POST') {
      const a = account();
      if (!a) return (send(res, { status: 401, body: { ok: false, error: 'not_authenticated' } }), true);
      if (!csrfOk(req, cookies)) return (send(res, { status: 403, body: { ok: false, error: 'csrf_failed' } }), true);
      if (deps.requireVerifiedForCreate && !a.emailVerified) {
        return (send(res, { status: 403, body: { ok: false, error: 'email_unverified', message: 'Verify your email before creating a character.' } }), true);
      }
      return (send(res, service.create(a.accountId, await readJson(req))), true);
    }
    if (path === '/v1/characters/select' && method === 'POST') {
      const a = account();
      if (!a) return (send(res, { status: 401, body: { ok: false, error: 'not_authenticated' } }), true);
      if (!csrfOk(req, cookies)) return (send(res, { status: 403, body: { ok: false, error: 'csrf_failed' } }), true);
      return (send(res, service.select(a.accountId, await readJson(req))), true);
    }
    if (path === '/v1/characters/outfit' && method === 'POST') {
      const a = account();
      if (!a) return (send(res, { status: 401, body: { ok: false, error: 'not_authenticated' } }), true);
      if (!csrfOk(req, cookies)) return (send(res, { status: 403, body: { ok: false, error: 'csrf_failed' } }), true);
      return (send(res, service.updateOutfit(a.accountId, await readJson(req))), true);
    }
    if (path === '/v1/library/discovery' && method === 'GET') {
      const a = account();
      if (!a) return (send(res, { status: 401, body: { ok: false, error: 'not_authenticated' } }), true);
      return (send(res, service.libraryDiscovery(a.accountId, url.searchParams.get('character_id'))), true);
    }

    send(res, { status: 404, body: { ok: false, error: 'not_found' } });
    return true;
  };
}
