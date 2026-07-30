// HTTP router for Beta Player Readiness and Measurement v1.
//
// Client events are intentionally additive and bounded. Gameplay commands do
// not pass through this router, and all mutating authenticated requests use the
// existing double-submit CSRF contract.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { CSRF_COOKIE } from '../account/service.js';
import { parseCookies, safeEqual } from '../account/tokens.js';
import { RateLimiter } from '../account/rateLimit.js';
import { BetaService } from './service.js';
import type { BetaFeedbackRequest, BetaReadinessEventRequest } from '../../../../packages/shared/http.js';

const MAX_BODY = 12_000;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
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
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        resolve(parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

export interface BetaRouterDeps {
  service: BetaService;
  resolveAccount: (cookies: Record<string, string>) => { accountId: string; emailVerified: boolean } | null;
  eventLimiter: RateLimiter;
  feedbackLimiter: RateLimiter;
}

export function makeBetaRouter(deps: BetaRouterDeps) {
  return async function handleBeta(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const method = (req.method ?? 'GET').toUpperCase();
    const cookies = parseCookies(req.headers.cookie);
    const account = () => deps.resolveAccount(cookies);

    if (path === '/v1/beta/me' && method === 'GET') {
      const resolved = account();
      if (!resolved) return (send(res, 401, { ok: false, error: 'not_authenticated' }), true);
      send(res, 200, deps.service.status(resolved.accountId));
      return true;
    }

    if (path === '/v1/beta/events' && method === 'POST') {
      const rate = deps.eventLimiter.check(`beta-event:${clientIp(req)}`);
      if (!rate.ok) {
        return (send(res, 429, { ok: false, error: 'rate_limited', retry_after_sec: rate.retryAfterSec }), true);
      }
      const result = deps.service.recordEvent(
        account()?.accountId ?? null,
        await readJson(req) as unknown as BetaReadinessEventRequest,
      );
      if ('status' in result) send(res, result.status, { ok: false, error: result.error });
      else send(res, 200, result);
      return true;
    }

    if (path === '/v1/beta/feedback' && method === 'POST') {
      const rate = deps.feedbackLimiter.check(`beta-feedback:${clientIp(req)}`);
      if (!rate.ok) {
        return (send(res, 429, { ok: false, error: 'rate_limited', retry_after_sec: rate.retryAfterSec }), true);
      }
      const resolved = account();
      if (!resolved) return (send(res, 401, { ok: false, error: 'not_authenticated' }), true);
      const csrf = cookies[CSRF_COOKIE];
      const header = req.headers['x-csrf-token'];
      if (typeof header !== 'string' || !csrf || !safeEqual(csrf, header)) {
        return (send(res, 403, { ok: false, error: 'csrf_failed' }), true);
      }
      const result = deps.service.submitFeedback(
        resolved.accountId,
        await readJson(req) as unknown as BetaFeedbackRequest,
      );
      if (typeof result.status === 'number') send(res, result.status, { ok: false, error: result.error });
      else send(res, 201, result);
      return true;
    }

    if (path === '/v1/beta/invites/redeem' && method === 'POST') {
      const resolved = account();
      if (!resolved) return (send(res, 401, { ok: false, error: 'not_authenticated' }), true);
      const csrf = cookies[CSRF_COOKIE];
      const header = req.headers['x-csrf-token'];
      if (typeof header !== 'string' || !csrf || !safeEqual(csrf, header)) {
        return (send(res, 403, { ok: false, error: 'csrf_failed' }), true);
      }
      const body = await readJson(req);
      const result = deps.service.claimInvite(body.invite_code, resolved.accountId);
      if (!result.ok) {
        const message = result.error === 'beta_invite_invalid'
          ? 'That beta invite is invalid, expired, or already used.'
          : 'This beta cohort is not accepting new players.';
        send(res, result.status, { ok: false, error: result.error, message });
      } else {
        send(res, 200, result);
      }
      return true;
    }

    send(res, 404, { ok: false, error: 'not_found' });
    return true;
  };
}
