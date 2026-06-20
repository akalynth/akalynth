import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
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

resetAndroidClientUpdateCacheForTests();
const beta = getAndroidClientUpdate('beta');
assert.ok(beta && !('error' in beta));
assert.equal(beta.lane, 'beta');
assert.equal(beta.version_code, 2);
assert.match(beta.apk_url, /^https:\/\//);

const res = mockRes();
handleHttp(
  { method: 'GET', url: '/v1/client/android-update?lane=beta' } as IncomingMessage,
  res as unknown as ServerResponse,
  deps
);
assert.equal(res.statusCode, 200);
const body = JSON.parse(res.body);
assert.equal(body.lane, 'beta');
assert.equal(body.version_code, 2);
assert.match(body.apk_sha256, /^[a-f0-9]{64}$/);

const badLane = mockRes();
handleHttp(
  { method: 'GET', url: '/v1/client/android-update?lane=prod' } as IncomingMessage,
  badLane as unknown as ServerResponse,
  deps
);
assert.equal(badLane.statusCode, 400);

console.log('verify-android-client-update.test.ts: ok');