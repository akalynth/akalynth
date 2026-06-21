#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const laneRoot = resolve(root, 'docs/asset-decisions/AKALYNTH_BETA_ACCOUNT_PLAY_PORTAL_HARDENING_V1');

const defaults = {
  reportPath: resolve(laneRoot, 'validation/beta_account_play_portal_report.json'),
  skipLive: false,
};

function parseArgs(argv) {
  const args = { ...defaults };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };
    if (arg === '--report') args.reportPath = resolve(readValue());
    else if (arg === '--skip-live') args.skipLive = true;
    else if (arg === '--help') {
      console.log([
        'Usage: node scripts/verify-beta-account-play-portal.mjs [options]',
        '',
        'Verifies the beta account.html -> /play/ portal contract.',
        '',
        'Options:',
        '  --report <file>  JSON report path.',
        '  --skip-live      Skip public HTTPS checks.',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

const files = {
  accountHtml: readFileSync(resolve(root, 'infra/web/beta/account.html'), 'utf8'),
  registerHtml: readFileSync(resolve(root, 'infra/web/beta/register.html'), 'utf8'),
  forgotHtml: readFileSync(resolve(root, 'infra/web/beta/forgot.html'), 'utf8'),
  debugIdentity: readFileSync(resolve(root, 'apps/debug-client/src/identity.ts'), 'utf8'),
  debugConfig: readFileSync(resolve(root, 'apps/debug-client/src/config.ts'), 'utf8'),
  accountRouter: readFileSync(resolve(root, 'apps/server/src/account/router.ts'), 'utf8'),
  accountService: readFileSync(resolve(root, 'apps/server/src/account/service.ts'), 'utf8'),
  sharedHttp: readFileSync(resolve(root, 'packages/shared/http.ts'), 'utf8'),
  protocolDoc: readFileSync(resolve(root, 'docs/PROTOCOL.md'), 'utf8'),
  liveSmokeScript: readFileSync(resolve(root, 'scripts/smoke-beta-account-play.mjs'), 'utf8'),
  androidGradle: readFileSync(resolve(root, 'apps/android/app/build.gradle.kts'), 'utf8'),
  androidPortalTest: readFileSync(resolve(root, 'apps/android/app/src/test/java/com/akalynth/client/config/BuildConfigPortalTest.kt'), 'utf8'),
};

function nowIso() {
  return new Date().toISOString();
}

function checkLiteral(report, id, file, literal) {
  const pass = files[file].includes(literal);
  report.checks.push({
    id,
    status: pass ? 'pass' : 'fail',
    evidence: { file, literal },
  });
  return pass;
}

function checkRegex(report, id, file, regex, evidence) {
  const pass = regex.test(files[file]);
  report.checks.push({
    id,
    status: pass ? 'pass' : 'fail',
    evidence: { file, pattern: String(regex), ...evidence },
  });
  return pass;
}

function head(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 10000 }, (res) => {
      res.resume();
      resolve({
        url,
        statusCode: res.statusCode ?? 0,
        contentType: res.headers['content-type'] ?? '',
        lastModified: res.headers['last-modified'] ?? '',
        server: res.headers.server ?? '',
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (error) => {
      resolve({ url, statusCode: 0, error: error.message });
    });
    req.end();
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = {
    id: 'AKALYNTH_BETA_ACCOUNT_PLAY_PORTAL_HARDENING_V1',
    status: 'running',
    generated_at: nowIso(),
    scope: 'beta static account portal, account-character play token handoff, debug-client /play/ identity bootstrap, Android beta portal URL',
    checks: [],
    notes: [
      'Does not require account credentials.',
      'Does not mutate runtime trees, runtime state, key/config custody, Caddy, or services.',
      'Live checks are limited to public HTTPS HEAD status for beta.akalynth.com/account.html and beta.akalynth.com/play/.',
    ],
  };

  const requireLiteral = (id, file, literal) => checkLiteral(report, id, file, literal);
  const requireRegex = (id, file, regex, evidence = {}) => checkRegex(report, id, file, regex, evidence);

  requireLiteral('account_page_targets_beta_api', 'accountHtml', "const API = 'https://beta-api.akalynth.com';");
  requireLiteral('account_page_and_debug_client_share_identity_key', 'accountHtml', "const IDENTITY_KEY = 'akalynth.identity.v1';");
  requireLiteral('debug_client_reads_same_identity_key', 'debugIdentity', "const KEY = 'akalynth.identity.v1';");
  requireLiteral('account_page_redirects_to_play_path', 'accountHtml', "const PLAY_PATH = '/play/';");
  requireLiteral('account_page_links_register_support_page', 'accountHtml', 'href="/register.html"');
  requireLiteral('account_page_links_forgot_support_page', 'accountHtml', 'href="/forgot.html"');
  requireLiteral('account_page_handles_verify_query_token', 'accountHtml', "params.get('verify')");
  requireLiteral('account_page_redirects_reset_query_to_forgot_page', 'accountHtml', "window.location.replace(`/forgot.html?reset=${encodeURIComponent(reset)}`);");
  requireLiteral('login_uses_account_api', 'accountHtml', "api('POST', '/v1/accounts/login'");
  requireLiteral('account_page_keeps_login_csrf_token_for_subsequent_posts', 'accountHtml', "if (typeof data.csrf_token === 'string' && data.csrf_token) sessionCsrfToken = data.csrf_token;");
  requireLiteral('account_page_keeps_me_csrf_token_for_subsequent_posts', 'accountHtml', 'if (typeof data.csrf_token === \'string\' && data.csrf_token) sessionCsrfToken = data.csrf_token;');
  requireLiteral('account_page_outfit_catalog_uses_name_field', 'accountHtml', 'found.name ?? String(outfitId).replace(/_/g, \' \')');
  requireLiteral('account_page_uses_login_csrf_token_when_cookie_unavailable', 'accountHtml', 'return m ? decodeURIComponent(m[1]) : sessionCsrfToken;');
  requireLiteral('session_check_uses_me_api', 'accountHtml', "api('GET', '/v1/accounts/me'");
  requireLiteral('account_page_me_uses_account_object_contract', 'accountHtml', 'if (!ok || !data.account) {');
  requireLiteral('email_verification_gate_present', 'accountHtml', 'if (!data.account.email_verified) { show(\'view-unverified\'); return; }');
  requireLiteral('resend_verification_uses_api', 'accountHtml', "api('POST', '/v1/accounts/verify/resend'");
  requireLiteral('server_routes_resend_verification_api', 'accountRouter', "path === '/v1/accounts/verify/resend'");
  requireLiteral('server_resend_requires_csrf', 'accountService', "resendVerification(ctx: RequestCtx): AccountResponse");
  requireLiteral('shared_http_exports_resend_response_type', 'sharedHttp', 'export interface AccountVerifyResendResponse');
  requireLiteral('protocol_doc_names_resend_endpoint', 'protocolDoc', '`/v1/accounts/verify/resend`');
  requireLiteral('character_list_uses_account_character_api', 'accountHtml', "api('GET', '/v1/characters')");
  requireLiteral('play_button_uses_character_select', 'accountHtml', "api('POST', '/v1/characters/select', { character_id: characterId })");
  requireLiteral('create_character_uses_account_character_api', 'accountHtml', "api('POST', '/v1/characters', { name, sex, outfit_id, world_id: 'rookguard' })");
  requireLiteral('account_page_has_expires_at_fallback', 'accountHtml', 'Date.now() + DEFAULT_PLAY_TOKEN_TTL_MS');
  requireLiteral('select_response_persists_play_token_identity', 'accountHtml', 'localStorage.setItem(IDENTITY_KEY, JSON.stringify(identityFromPlayResponse(data)));');
  requireLiteral('create_response_persists_play_token_identity', 'accountHtml', 'localStorage.setItem(IDENTITY_KEY, JSON.stringify(identityFromPlayResponse(data)));');
  requireLiteral('sign_out_clears_web_identity', 'accountHtml', 'localStorage.removeItem(IDENTITY_KEY);');
  requireLiteral('csrf_header_sent_for_account_requests', 'accountHtml', "headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },");
  requireLiteral('account_requests_include_session_cookies', 'accountHtml', "credentials: 'include',");
  requireLiteral('register_page_uses_register_api', 'registerHtml', "post('/v1/accounts/register'");
  requireLiteral('register_page_can_verify_dev_token', 'registerHtml', "post('/v1/accounts/verify-email'");
  requireLiteral('forgot_page_uses_reset_request_api', 'forgotHtml', "post('/v1/accounts/password-reset/request'");
  requireLiteral('forgot_page_uses_reset_confirm_api', 'forgotHtml', "post('/v1/accounts/password-reset/confirm'");
  requireLiteral('debug_client_prefers_stored_unexpired_identity', 'debugIdentity', 'export function hasValidToken(identity: StoredIdentity | null, nowMs: number = Date.now()): boolean {');
  requireLiteral('debug_client_production_uses_same_origin_http', 'debugConfig', 'return window.location.origin;');
  requireLiteral('debug_client_production_uses_same_origin_ws', 'debugConfig', 'return `${wsProto}//${url.host}`;');
  requireLiteral('live_smoke_requires_live_ack', 'liveSmokeScript', "Refusing to mutate beta without --live");
  requireLiteral('live_smoke_uses_playwright_core', 'liveSmokeScript', "await import('playwright-core')");
  requireLiteral('live_smoke_sets_localstorage_identity_key', 'liveSmokeScript', 'window.localStorage.setItem(key, value);');
  requireLiteral('live_smoke_asserts_token_login_not_guest', 'liveSmokeScript', "frame.type === 'login' && frame.token_present && !frame.guest_token_present");
  requireLiteral('live_smoke_omits_secret_tokens_from_receipt', 'liveSmokeScript', 'play_token_saved: false');
  requireLiteral('android_beta_portal_targets_beta_account_page', 'androidGradle', 'buildConfigField("String", "PORTAL_ACCOUNT_URL", "\\"https://beta.akalynth.com/account.html\\"")');
  requireLiteral('android_portal_test_rejects_api_hosts', 'androidPortalTest', 'assertFalse(portalUrl.contains("beta-api.akalynth.com"))');
  requireLiteral('android_portal_test_requires_account_html', 'androidPortalTest', 'assertTrue(portalUrl.endsWith("/account.html"))');

  if (!args.skipLive) {
    for (const url of ['https://beta.akalynth.com/account.html', 'https://beta.akalynth.com/play/']) {
      const result = await head(url);
      report.checks.push({
        id: `live_${new URL(url).pathname.replaceAll('/', '_').replace(/^_/, '') || 'root'}_returns_200`,
        status: result.statusCode === 200 ? 'pass' : 'fail',
        evidence: result,
      });
    }
  } else {
    report.checks.push({
      id: 'live_https_checks',
      status: 'skipped',
      evidence: { reason: '--skip-live' },
    });
  }

  const failed = report.checks.filter((check) => check.status === 'fail');
  report.status = failed.length === 0 ? 'pass' : 'fail';
  report.completed_at = nowIso();

  mkdirSync(dirname(args.reportPath), { recursive: true });
  writeFileSync(args.reportPath, `${JSON.stringify(report, null, 2)}\n`);

  if (failed.length > 0) {
    for (const check of failed) {
      console.error(`beta account/play portal verifier failed: ${check.id}`);
    }
    console.error(`report: ${args.reportPath}`);
    process.exit(1);
  }

  console.log(`beta account/play portal verifier passed: ${args.reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
