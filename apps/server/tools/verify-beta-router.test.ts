#!/usr/bin/env tsx
/**
 * Focused HTTP contract test for Beta Player Readiness v1.
 *
 * The service is deliberately faked here: service/store behavior has its own
 * verifier, while this file proves route selection, account-cookie gates,
 * double-submit CSRF, response status, and event rate limiting.
 */
import assert from 'node:assert/strict';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type {
  BetaFeedbackRequest,
  BetaReadinessEventRequest,
} from '../../../packages/shared/http.js';
import { CSRF_COOKIE, SESSION_COOKIE } from '../src/account/service.js';
import { RateLimiter } from '../src/account/rateLimit.js';
import { makeBetaRouter } from '../src/beta/router.js';
import type { BetaService } from '../src/beta/service.js';

type ResponseCapture = ServerResponse & {
  bodyText: string;
  headersOut: Record<string, string | number | readonly string[]>;
};

function makeReq(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers: IncomingHttpHeaders = {},
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
      if (chunk != null) {
        this.bodyText += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      }
      return this as unknown as ServerResponse;
    },
  };
  return res as ResponseCapture;
}

function cookieHeader(csrf = 'csrf-ok'): string {
  return `${SESSION_COOKIE}=session-ok; ${CSRF_COOKIE}=${csrf}`;
}

const calls = {
  status: [] as string[],
  events: [] as Array<{ accountId: string | null; input: BetaReadinessEventRequest }>,
  feedback: [] as Array<{ accountId: string; input: BetaFeedbackRequest }>,
  invites: [] as Array<{ accountId: string; code: unknown }>,
};

const service = {
  status(accountId: string) {
    calls.status.push(accountId);
    return { ok: true as const, enabled: true, cohort: null };
  },
  recordEvent(accountId: string | null, input: BetaReadinessEventRequest) {
    calls.events.push({ accountId, input });
    return {
      ok: true as const,
      event_id: 'be_router_verify',
      server_recorded_at: '2026-07-30T00:00:00.000Z',
    };
  },
  submitFeedback(accountId: string, input: BetaFeedbackRequest) {
    calls.feedback.push({ accountId, input });
    return { ok: true as const, feedback_id: 'bf_router_verify', status: 'open' as const };
  },
  claimInvite(code: unknown, accountId: string) {
    calls.invites.push({ accountId, code });
    if (code === 'invalid-code') {
      return { ok: false as const, status: 403 as const, error: 'beta_invite_invalid' as const };
    }
    if (code === 'closed-code') {
      return { ok: false as const, status: 409 as const, error: 'beta_invite_unavailable' as const };
    }
    return { ok: true as const, cohort: null };
  },
} as unknown as BetaService;

const router = makeBetaRouter({
  service,
  resolveAccount: (cookies) => (
    cookies[SESSION_COOKIE] === 'session-ok'
      ? { accountId: 'acc-router-verify', emailVerified: true }
      : null
  ),
  eventLimiter: new RateLimiter(1, 60_000),
  feedbackLimiter: new RateLimiter(10, 60_000),
});

async function request(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers?: IncomingHttpHeaders,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = makeRes();
  const handled = await router(makeReq(method, url, body, headers), res);
  assert.equal(handled, true);
  return {
    status: res.statusCode,
    body: JSON.parse(res.bodyText || '{}') as Record<string, unknown>,
  };
}

async function main(): Promise<void> {
  let response = await request('GET', '/v1/beta/me');
  assert.deepEqual(response, {
    status: 401,
    body: { ok: false, error: 'not_authenticated' },
  });
  assert.equal(calls.status.length, 0);

  response = await request('GET', '/v1/beta/me', undefined, {
    cookie: cookieHeader(),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, enabled: true, cohort: null });
  assert.deepEqual(calls.status, ['acc-router-verify']);

  const eventBody = {
    event: 'browser_mount',
    client_session_id: 'router_session_123456',
    map: 'Rookguard',
  };
  response = await request('POST', '/v1/beta/events', eventBody);
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.event_id, 'be_router_verify');
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0]?.accountId, null);
  assert.deepEqual(calls.events[0]?.input, eventBody);

  response = await request('POST', '/v1/beta/events', eventBody);
  assert.equal(response.status, 429);
  assert.equal(response.body.error, 'rate_limited');
  assert.equal(typeof response.body.retry_after_sec, 'number');
  assert.equal(calls.events.length, 1);

  const feedbackBody = {
    severity: 'P1',
    category: 'gameplay',
    title: 'Movement stopped',
    body: 'The character could not move.',
    client_session_id: 'router_session_123456',
    map: 'Rookguard',
  };
  response = await request('POST', '/v1/beta/feedback', feedbackBody);
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'not_authenticated');
  assert.equal(calls.feedback.length, 0);

  response = await request('POST', '/v1/beta/feedback', feedbackBody, {
    cookie: cookieHeader(),
    'x-csrf-token': 'wrong',
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'csrf_failed');
  assert.equal(calls.feedback.length, 0);

  response = await request('POST', '/v1/beta/feedback', feedbackBody, {
    cookie: cookieHeader(),
    'x-csrf-token': 'csrf-ok',
  });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body, {
    ok: true,
    feedback_id: 'bf_router_verify',
    status: 'open',
  });
  assert.equal(calls.feedback.length, 1);
  assert.equal(calls.feedback[0]?.accountId, 'acc-router-verify');
  assert.deepEqual(calls.feedback[0]?.input, feedbackBody);

  response = await request('POST', '/v1/beta/invites/redeem', { invite_code: 'valid-code' });
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'not_authenticated');
  assert.equal(calls.invites.length, 0);

  response = await request(
    'POST',
    '/v1/beta/invites/redeem',
    { invite_code: 'valid-code' },
    { cookie: cookieHeader(), 'x-csrf-token': 'wrong' },
  );
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'csrf_failed');
  assert.equal(calls.invites.length, 0);

  response = await request(
    'POST',
    '/v1/beta/invites/redeem',
    { invite_code: 'valid-code' },
    { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, cohort: null });
  assert.deepEqual(calls.invites[0], {
    accountId: 'acc-router-verify',
    code: 'valid-code',
  });

  response = await request(
    'POST',
    '/v1/beta/invites/redeem',
    { invite_code: 'invalid-code' },
    { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' },
  );
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'beta_invite_invalid');
  assert.equal(typeof response.body.message, 'string');

  response = await request(
    'POST',
    '/v1/beta/invites/redeem',
    { invite_code: 'closed-code' },
    { cookie: cookieHeader(), 'x-csrf-token': 'csrf-ok' },
  );
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'beta_invite_unavailable');
  assert.equal(typeof response.body.message, 'string');

  console.log('[verify-beta-router] PASS: auth, CSRF, status, anonymous event, and rate-limit contracts');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
