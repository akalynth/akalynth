import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { handleHttp, type ApiDeps } from '../src/api/http.js';
import {
  getAndroidClientUpdate,
  resetAndroidClientUpdateCacheForTests,
} from '../src/android-client-update.js';

function mockRes(): ServerResponse & { body: string; statusCode: number } {
  const res = {
    statusCode: 200,
    body: '',
    setHeader() {
      return this;
    },
    end(chunk?: string) {
      if (chunk) this.body = chunk;
    },
  };
  return res as ServerResponse & { body: string; statusCode: number };
}

const deps: ApiDeps = {
  getVersion: () => '0.1.0',
  getTickMs: () => 100,
  listMaps: () => [],
  getMap: () => null,
  queryReceipts: () => ({ receipts: [], total: 0, has_more: false }),
};

const previousBetaPath = process.env.AKALYNTH_ANDROID_BETA_UPDATE_JSON;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'akalynth-android-update-'));
const manifestPath = path.join(temp, 'beta-update.json');

try {
  delete process.env.AKALYNTH_ANDROID_BETA_UPDATE_JSON;
  resetAndroidClientUpdateCacheForTests();
  assert.deepEqual(getAndroidClientUpdate('beta'), {
    error: 'android_update_unavailable',
    status: 503,
  });
  const unavailable = mockRes();
  handleHttp(
    { method: 'GET', url: '/v1/client/android-update?lane=beta' } as IncomingMessage,
    unavailable as unknown as ServerResponse,
    deps
  );
  assert.equal(unavailable.statusCode, 503);

  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      ok: true,
      lane: 'beta',
      version_code: 12,
      version_name: '0.1.10-beta-self-update-identity',
      apk_url: 'https://beta.akalynth.com/download/akalynth-beta-v12.apk',
      apk_sha256: '9'.repeat(64),
      size_bytes: 42341209,
      required: false,
      published_at: '2026-07-30T00:00:00.000Z',
    }) + '\n'
  );
  process.env.AKALYNTH_ANDROID_BETA_UPDATE_JSON = manifestPath;
  resetAndroidClientUpdateCacheForTests();
  const beta = getAndroidClientUpdate('beta');
  assert.ok(beta && !('error' in beta));
  assert.equal(beta.lane, 'beta');
  assert.equal(beta.version_code, 12);
  assert.equal(
    beta.apk_url,
    'https://beta.akalynth.com/download/akalynth-beta-v12.apk'
  );

  const res = mockRes();
  handleHttp(
    { method: 'GET', url: '/v1/client/android-update?lane=beta' } as IncomingMessage,
    res as unknown as ServerResponse,
    deps
  );
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.version_code, 12);
  assert.match(body.apk_sha256, /^[a-f0-9]{64}$/);

  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      ...body,
      apk_url: 'https://beta.akalynth.com/download/akalynth-beta.apk',
    }) + '\n'
  );
  resetAndroidClientUpdateCacheForTests();
  assert.deepEqual(getAndroidClientUpdate('beta'), {
    error: 'android_update_unavailable',
    status: 503,
  });

  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      ...body,
      apk_url: 'https://beta.akalynth.com/download/akalynth-beta-v13.apk',
    }) + '\n'
  );
  resetAndroidClientUpdateCacheForTests();
  assert.deepEqual(getAndroidClientUpdate('beta'), {
    error: 'android_update_unavailable',
    status: 503,
  });

  const { required: _required, ...withoutRequired } = body;
  fs.writeFileSync(manifestPath, JSON.stringify(withoutRequired) + '\n');
  resetAndroidClientUpdateCacheForTests();
  assert.deepEqual(getAndroidClientUpdate('beta'), {
    error: 'android_update_unavailable',
    status: 503,
  });

  const badLane = mockRes();
  handleHttp(
    { method: 'GET', url: '/v1/client/android-update?lane=prod' } as IncomingMessage,
    badLane as unknown as ServerResponse,
    deps
  );
  assert.equal(badLane.statusCode, 400);

  console.log('verify-android-client-update.test.ts: ok');
} finally {
  if (previousBetaPath === undefined) {
    delete process.env.AKALYNTH_ANDROID_BETA_UPDATE_JSON;
  } else {
    process.env.AKALYNTH_ANDROID_BETA_UPDATE_JSON = previousBetaPath;
  }
  resetAndroidClientUpdateCacheForTests();
  fs.rmSync(temp, { recursive: true, force: true });
}
