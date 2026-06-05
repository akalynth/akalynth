#!/usr/bin/env tsx
/**
 * Unit test for the build-info loader (issue #145). Run: `npm run test:build-info`.
 * Proves loadBuildInfo() reads a BUILD_INFO.json and degrades to 'unknown' on a
 * missing or malformed file (so a non-git/dev build still serves valid health).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadBuildInfo, UNKNOWN_BUILD_INFO } from '../src/build-info.js';
import { handleHttp, type ApiDeps } from '../src/api/http.js';

let failed = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

const tmp = mkdtempSync(path.join(os.tmpdir(), 'akalynth-buildinfo-'));
try {
  // Present + valid -> parsed
  const good = path.join(tmp, 'BUILD_INFO.json');
  writeFileSync(
    good,
    JSON.stringify({
      commit: 'a'.repeat(40),
      commit_short: 'aaaaaaa',
      built_at: '2026-06-05T00:00:00.000Z',
      ref: 'main',
    }),
  );
  process.env.AKALYNTH_BUILD_INFO_PATH = good;
  const bi = loadBuildInfo();
  check('loads full commit from file', bi.commit === 'a'.repeat(40));
  check('loads commit_short from file', bi.commit_short === 'aaaaaaa');
  check('loads built_at from file', bi.built_at === '2026-06-05T00:00:00.000Z');
  check('loads ref from file', bi.ref === 'main');

  // Missing file -> unknown
  process.env.AKALYNTH_BUILD_INFO_PATH = path.join(tmp, 'does-not-exist.json');
  check('missing file -> unknown commit', loadBuildInfo().commit === 'unknown');

  // Malformed file -> unknown
  const bad = path.join(tmp, 'bad.json');
  writeFileSync(bad, '{ not valid json');
  process.env.AKALYNTH_BUILD_INFO_PATH = bad;
  check('malformed file -> unknown commit', loadBuildInfo().commit === 'unknown');

  // Partial file -> missing fields become 'unknown'
  const partial = path.join(tmp, 'partial.json');
  writeFileSync(partial, JSON.stringify({ commit: 'deadbeef' }));
  process.env.AKALYNTH_BUILD_INFO_PATH = partial;
  const bp = loadBuildInfo();
  check('partial file keeps commit', bp.commit === 'deadbeef');
  check('partial file -> unknown built_at', bp.built_at === 'unknown');

  check('UNKNOWN_BUILD_INFO is all unknown', Object.values(UNKNOWN_BUILD_INFO).every((v) => v === 'unknown'));

  // /v1/health serves commit + built_at from getBuildInfo (wiring test).
  {
    const COMMIT = 'b'.repeat(40);
    const BUILT_AT = '2026-01-01T00:00:00.000Z';
    const deps = {
      getVersion: () => '0.0.0-test',
      getTickMs: () => 100,
      getBuildInfo: () => ({ commit: COMMIT, commit_short: 'bbbbbbb', built_at: BUILT_AT, ref: 'test' }),
      listMaps: () => [],
      getMap: () => null,
      queryReceipts: () => ({}) as never,
    } as unknown as ApiDeps;

    let capturedBody = '';
    let capturedStatus = 0;
    const res = {
      statusCode: 0,
      setHeader: () => {},
      end: (chunk?: unknown) => {
        capturedStatus = res.statusCode;
        capturedBody = String(chunk ?? '');
      },
    };
    handleHttp({ method: 'GET', url: '/v1/health' } as IncomingMessage, res as unknown as ServerResponse, deps);
    const body = JSON.parse(capturedBody) as { ok?: boolean; commit?: string; built_at?: string };
    check('health responds 200', capturedStatus === 200);
    check('health exposes commit from getBuildInfo', body.commit === COMMIT);
    check('health exposes built_at from getBuildInfo', body.built_at === BUILT_AT);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
  delete process.env.AKALYNTH_BUILD_INFO_PATH;
}

if (failed > 0) {
  console.error(`\n[verify-build-info.test] ${failed} case(s) FAILED`);
  process.exit(1);
}
console.log('\n[verify-build-info.test] all cases passed');
