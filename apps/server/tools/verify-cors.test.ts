#!/usr/bin/env tsx
/**
 * CORS allowlist test (E5 companion / AKALYNTH_ACCOUNT_CORS_V1).
 *
 * The account portal lives on a different origin than the API and signs in with
 * HttpOnly cookies (`credentials: 'include'`). This asserts the credentialed-
 * CORS contract: explicit allowlisted origins are reflected (never `*`),
 * credentials are enabled, x-csrf-token is permitted, disallowed origins get no
 * CORS headers, and localhost dev is gated by policy. Run: npm run test:cors
 */
import {
  normalizeOrigin,
  parseCorsOrigins,
  corsOriginAllowed,
  corsHeadersFor,
  CORS_ALLOW_HEADERS,
  type CorsPolicy,
} from '../src/api/cors.js';

let failed = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

const DEFAULTS = [
  'https://akalynth.com',
  'https://www.akalynth.com',
  'https://beta.akalynth.com',
  'https://sim.akalynth.com',
  'https://codex.akalynth.com',
] as const;

// ---------------------------------------------------------------- normalizeOrigin
check('normalize drops default https port', normalizeOrigin('https://akalynth.com:443') === 'https://akalynth.com');
check('normalize lowercases host', normalizeOrigin('https://Akalynth.COM') === 'https://akalynth.com');
check('normalize strips path', normalizeOrigin('https://akalynth.com/account') === 'https://akalynth.com');
check('normalize keeps non-default port', normalizeOrigin('http://localhost:5173') === 'http://localhost:5173');
check('normalize rejects non-http scheme', normalizeOrigin('file:///etc/passwd') === null);
check('normalize rejects garbage', normalizeOrigin('not-an-origin') === null);

// ---------------------------------------------------------------- parseCorsOrigins
const fromEnv = parseCorsOrigins('https://akalynth.com, https://staging.akalynth.com', DEFAULTS);
check('env override parses both entries', fromEnv.has('https://akalynth.com') && fromEnv.has('https://staging.akalynth.com'));
check('env override ignores blank/whitespace', parseCorsOrigins(' , https://akalynth.com , ', DEFAULTS).size === 1);
check('blank env falls back to defaults', parseCorsOrigins('', DEFAULTS).size === DEFAULTS.length);
check('undefined env falls back to defaults', parseCorsOrigins(undefined, DEFAULTS).size === DEFAULTS.length);
check('invalid env entries dropped', !parseCorsOrigins('nonsense,https://akalynth.com', DEFAULTS).has('nonsense'));

// ---------------------------------------------------------------- policy: prod (no local dev)
const prod: CorsPolicy = { allow: parseCorsOrigins(undefined, DEFAULTS), allowLocalDev: false };
check('prod allows akalynth.com', corsOriginAllowed('https://akalynth.com', prod));
check('prod allows beta.akalynth.com', corsOriginAllowed('https://beta.akalynth.com', prod));
check('prod allows codex.akalynth.com', corsOriginAllowed('https://codex.akalynth.com', prod));
check('prod allows case-variant origin', corsOriginAllowed('https://Akalynth.com', prod));
check('prod rejects evil.example', !corsOriginAllowed('https://evil.example', prod));
check('prod rejects look-alike suffix', !corsOriginAllowed('https://akalynth.com.evil.example', prod));
check('prod rejects http (scheme mismatch)', !corsOriginAllowed('http://akalynth.com', prod));
check('prod rejects localhost (dev gate off)', !corsOriginAllowed('http://localhost:5173', prod));

// ---------------------------------------------------------------- policy: dev (local allowed)
const dev: CorsPolicy = { allow: parseCorsOrigins(undefined, DEFAULTS), allowLocalDev: true };
check('dev allows localhost any port', corsOriginAllowed('http://localhost:5173', dev));
check('dev allows 127.0.0.1', corsOriginAllowed('http://127.0.0.1:3000', dev));
check('dev still allows prod origin', corsOriginAllowed('https://akalynth.com', dev));
check('dev still rejects evil.example', !corsOriginAllowed('https://evil.example', dev));

// ---------------------------------------------------------------- corsHeadersFor
const h = corsHeadersFor('https://akalynth.com', prod);
check('headers: reflects exact origin (never *)', !!h && h['access-control-allow-origin'] === 'https://akalynth.com');
check('headers: credentials enabled', !!h && h['access-control-allow-credentials'] === 'true');
check('headers: never wildcard with credentials', !!h && h['access-control-allow-origin'] !== '*');
check('headers: allows x-csrf-token', !!h && h['access-control-allow-headers'] === CORS_ALLOW_HEADERS && CORS_ALLOW_HEADERS.includes('x-csrf-token'));
check('headers: Vary Origin set', !!h && h.vary === 'Origin');
check('headers: methods include OPTIONS+POST', !!h && h['access-control-allow-methods'].includes('OPTIONS') && h['access-control-allow-methods'].includes('POST'));
check('disallowed origin -> null (no CORS headers)', corsHeadersFor('https://evil.example', prod) === null);
check('absent origin -> null', corsHeadersFor(undefined, prod) === null);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll CORS checks passed');
