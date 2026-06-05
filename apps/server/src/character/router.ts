// HTTP router for the character + catalog surface (E4). handleHttp delegates
// /v1/worlds, /v1/outfits, /v1/characters, /v1/characters/select here. The
// character endpoints require an account session (resolved from the cookie);
// create additionally requires a verified email.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { CharacterService, CharacterResult } from './service.js';
import { parseCookies } from '../account/tokens.js';

const MAX_BODY = 8192;

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
  return async function handleCharacter(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const method = (req.method ?? 'GET').toUpperCase();
    const account = (): SessionAccount | null => deps.resolveAccount(parseCookies(req.headers.cookie));

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
      if (deps.requireVerifiedForCreate && !a.emailVerified) {
        return (send(res, { status: 403, body: { ok: false, error: 'email_unverified', message: 'Verify your email before creating a character.' } }), true);
      }
      return (send(res, service.create(a.accountId, await readJson(req))), true);
    }
    if (path === '/v1/characters/select' && method === 'POST') {
      const a = account();
      if (!a) return (send(res, { status: 401, body: { ok: false, error: 'not_authenticated' } }), true);
      return (send(res, service.select(a.accountId, await readJson(req))), true);
    }

    send(res, { status: 404, body: { ok: false, error: 'not_found' } });
    return true;
  };
}
