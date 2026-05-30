// Verify Transparency Endpoint Contract
// An unbootstrapped server (no auth key) must REFUSE /v1/transparency with 503
// rather than advertise an empty auth_public_key_hex. A bootstrapped server
// with a real key serves 200 with that key.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleHttp, type ApiDeps } from '../src/api/http.js';
import type { TransparencyResponse } from '../../../packages/shared/http.js';

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const r = fn();
    if (r instanceof Promise) {
      // verifier cases here are synchronous; guard anyway
      r.catch((err) => {
        console.error(`✗ ${name}`);
        console.error(`  ${err}`);
        process.exit(1);
      });
    }
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err}`);
    process.exit(1);
  }
}

function assertEquals<T>(actual: T, expected: T, msg?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

interface CapturedResponse {
  statusCode: number;
  body: string;
}

// Minimal ServerResponse stub capturing what json() touches.
function makeRes(): { res: ServerResponse; captured: CapturedResponse } {
  const captured: CapturedResponse = { statusCode: 0, body: '' };
  const res = {
    statusCode: 0,
    setHeader() {
      /* noop */
    },
    end(chunk?: unknown) {
      captured.statusCode = (this as { statusCode: number }).statusCode;
      captured.body = typeof chunk === 'string' ? chunk : '';
    },
  } as unknown as ServerResponse;
  return { res, captured };
}

function getTransparency(req: IncomingMessage, deps: Partial<ApiDeps>): CapturedResponse {
  const { res, captured } = makeRes();
  handleHttp(req, res, deps as ApiDeps);
  return captured;
}

const TRANSPARENCY_REQ = {
  url: '/v1/transparency',
  method: 'GET',
} as unknown as IncomingMessage;

function validTransparency(keyHex: string): TransparencyResponse {
  return {
    version: 'test',
    server_version: 'test',
    identity: { auth_public_key_hex: keyHex, key_derivation: 'blake3(test)' },
    principles: [],
    documentation: {
      monetization_constitution: '/docs/MONETIZATION_CONSTITUTION.md',
      architecture: '/docs/ARCHITECTURE.md',
      anticheat: '/docs/ANTICHEAT.md',
    },
    public_receipts_endpoint: '/v1/receipts/public',
    verification: {
      chain_integrity: 'npm run verify:lifecycle',
      monetization_policy: 'npm run verify:monetization',
      work_contracts: 'npm run verify:work-contracts',
    },
  };
}

console.log('=== Transparency Endpoint Contract ===');

test('no transparency provider → 503 (not empty-key 200)', () => {
  const out = getTransparency(TRANSPARENCY_REQ, { getTransparency: undefined });
  assertEquals(out.statusCode, 503, 'status');
  assertEquals(JSON.parse(out.body), { error: 'transparency_unavailable' }, 'body');
});

test('empty auth_public_key_hex → 503 (refuses false fairness proof)', () => {
  const out = getTransparency(TRANSPARENCY_REQ, {
    getTransparency: () => validTransparency(''),
  });
  assertEquals(out.statusCode, 503, 'status');
});

test('real auth key → 200 with the key', () => {
  const out = getTransparency(TRANSPARENCY_REQ, {
    getTransparency: () => validTransparency('abc123'),
  });
  assertEquals(out.statusCode, 200, 'status');
  const parsed = JSON.parse(out.body) as TransparencyResponse;
  assertEquals(parsed.identity.auth_public_key_hex, 'abc123', 'key');
});

console.log('All transparency contract checks passed.');
