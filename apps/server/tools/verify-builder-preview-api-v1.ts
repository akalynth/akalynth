// Proof target: builder_preview_api_v1
// Authority: AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1 (PR-7 HTTP preview API)

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import type { BuilderDraftManifest } from '../../../packages/shared/builderDraft.js';
import { BuilderDraftNamespaceStore } from '../src/builder/draftNamespace.js';
import { makeBuilderPreviewRouter } from '../src/builder/previewRoutes.js';
import { PreviewSessionBindingStore } from '../src/builder/previewSessionBinding.js';

const PACKET_AUTHORITY = 'AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1';
const PROOF_TARGET = 'builder_preview_api_v1';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '../../..');
const SAMPLE = path.join(
  REPO_ROOT,
  '../akalynth-codex/samples/rookguard-builder-draft-manifest.sample.json',
);

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

class MockResponse extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = '';

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  end(chunk?: string) {
    if (chunk) this.body += chunk;
    this.emit('finish');
  }
}

function mockReq(method: string, url: string, body?: unknown): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  (req as { method: string }).method = method;
  (req as { url: string }).url = url;
  queueMicrotask(() => {
    if (body !== undefined) {
      req.emit('data', Buffer.from(JSON.stringify(body)));
    }
    req.emit('end');
  });
  return req;
}

async function invoke(
  handler: ReturnType<typeof makeBuilderPreviewRouter>,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const req = mockReq(method, url, body);
  const res = new MockResponse();
  const handled = await handler(req, res as unknown as ServerResponse);
  assert(handled, `route not handled: ${method} ${url}`);
  return { status: res.statusCode, json: JSON.parse(res.body || '{}') as Record<string, unknown> };
}

async function main() {
  const manifest = JSON.parse(readFileSync(SAMPLE, 'utf8')) as BuilderDraftManifest;
  const store = new BuilderDraftNamespaceStore();
  const sessions = new Map();
  const bindings = new PreviewSessionBindingStore();
  const handler = makeBuilderPreviewRouter({ store, sessions, bindings });

  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: 'POST /v1/builder/preview/start loads namespace and emits preview_only receipts',
      fn: async () => {
        const r = await invoke(handler, 'POST', '/v1/builder/preview/start', {
          manifest,
          session_id: 'AKALYNTH_PREVIEW_API_TEST_V1',
          draft_manifest_ref: 'codex/samples/rookguard-builder-draft-manifest.sample.json',
        });
        assert(r.status === 200, 'status');
        assert(r.json.ok === true, 'ok');
        assert(r.json.preview_only === true, 'preview_only');
        const receipts = r.json.receipts as Array<{ lane: string }>;
        assert(receipts.every((x) => x.lane === 'preview_only'), 'receipt lanes');
      },
    },
    {
      name: 'GET /v1/builder/preview/namespace returns loaded draft metadata',
      fn: async () => {
        const r = await invoke(
          handler,
          'GET',
          `/v1/builder/preview/namespace?ns=${encodeURIComponent(manifest.preview_namespace)}`,
        );
        assert(r.status === 200, 'status');
        assert(r.json.object_id === manifest.object_id, 'object_id');
        const overlay = r.json.overlay as { rooms: number; objects: number } | undefined;
        assert(overlay && overlay.rooms === 2 && overlay.objects === 6, 'overlay counts');
      },
    },
    {
      name: 'POST /v1/builder/preview/end closes session with end receipt',
      fn: async () => {
        const r = await invoke(handler, 'POST', '/v1/builder/preview/end', {
          session_id: 'AKALYNTH_PREVIEW_API_TEST_V1',
        });
        assert(r.status === 200, 'status');
        const receipts = r.json.receipts as Array<{ receipt_type: string; lane: string }>;
        assert(receipts.some((x) => x.receipt_type === 'preview_session_end'), 'end receipt');
        assert(receipts.every((x) => x.lane === 'preview_only'), 'lanes');
      },
    },
    {
      name: 'live namespace query is rejected',
      fn: async () => {
        const r = await invoke(handler, 'GET', '/v1/builder/preview/namespace?ns=rookguard');
        assert(r.status === 400, 'status');
      },
    },
    {
      name: 'POST /v1/builder/preview/start binds guest_token and returns builder_preview fork',
      fn: async () => {
        const r = await invoke(handler, 'POST', '/v1/builder/preview/start', {
          manifest,
          session_id: 'AKALYNTH_PREVIEW_API_BIND_V1',
          draft_manifest_ref: 'codex/samples/rookguard-builder-draft-manifest.sample.json',
          guest_token: 'gt_preview_bind_test',
        });
        assert(r.status === 200, 'status');
        assert(r.json.guest_bound === true, 'guest_bound');
        const fork = r.json.builder_preview as { map_name: string; objects: unknown[] } | undefined;
        assert(fork && fork.map_name === 'Rookguard' && fork.objects.length === 6, 'fork');
      },
    },
    {
      name: 'GET /v1/builder/preview/world-state returns bound fork by guest_token',
      fn: async () => {
        const r = await invoke(
          handler,
          'GET',
          `/v1/builder/preview/world-state?guest_token=${encodeURIComponent('gt_preview_bind_test')}`,
        );
        assert(r.status === 200, 'status');
        const fork = r.json.builder_preview as { namespace: string } | undefined;
        assert(fork && fork.namespace === manifest.preview_namespace, 'namespace');
      },
    },
    {
      name: 'GET /v1/builder/preview/world-state returns fork by loaded namespace',
      fn: async () => {
        const r = await invoke(
          handler,
          'GET',
          `/v1/builder/preview/world-state?ns=${encodeURIComponent(manifest.preview_namespace)}`,
        );
        assert(r.status === 200, 'status');
        const fork = r.json.builder_preview as { npc_lines: unknown[] } | undefined;
        assert(fork && fork.npc_lines.length === 2, 'npc lines');
      },
    },
    {
      name: 'POST /v1/builder/preview/end unbinds guest_token fork',
      fn: async () => {
        const end = await invoke(handler, 'POST', '/v1/builder/preview/end', {
          session_id: 'AKALYNTH_PREVIEW_API_BIND_V1',
        });
        assert(end.status === 200, 'end status');
        const r = await invoke(
          handler,
          'GET',
          `/v1/builder/preview/world-state?guest_token=${encodeURIComponent('gt_preview_bind_test')}`,
        );
        assert(r.status === 404, 'unbound status');
      },
    },
  ];

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✓ ${t.name}`);
    } catch (err) {
      console.error(`✗ ${t.name}`);
      console.error(`  ${err}`);
      process.exit(1);
    }
  }

  console.log(`builder-preview-api-v1 OK (${PACKET_AUTHORITY} / ${PROOF_TARGET})`);
}

main();