// HTTP router for builder draft preview sessions (PR-7).
// preview_only — no chronicle writes, no live registry mutation.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { BuilderDraftManifest } from '../../../../packages/shared/builderDraft.js';
import { BuilderDraftNamespaceStore } from './draftNamespace.js';
import { buildPreviewOverlay } from './previewRegistry.js';
import {
  assertPreviewReceiptsNonAuthoritative,
  endPreviewSession,
  startPreviewSession,
  type ActivePreviewSession,
} from './previewSession.js';

const MAX_BODY = 65536;

export interface BuilderPreviewRouterDeps {
  store?: BuilderDraftNamespaceStore;
  sessions?: Map<string, ActivePreviewSession>;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
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

function asManifest(body: Record<string, unknown>): BuilderDraftManifest | null {
  const manifest = body.manifest;
  if (!manifest || typeof manifest !== 'object') return null;
  return manifest as BuilderDraftManifest;
}

export function makeBuilderPreviewRouter(deps: BuilderPreviewRouterDeps = {}) {
  const store = deps.store ?? new BuilderDraftNamespaceStore();
  const sessions = deps.sessions ?? new Map<string, ActivePreviewSession>();

  return async function handleBuilderPreview(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const method = (req.method ?? 'GET').toUpperCase();

    if (path === '/v1/builder/preview/start' && method === 'POST') {
      const body = await readJson(req);
      const manifest = asManifest(body);
      const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
      const draftManifestRef =
        typeof body.draft_manifest_ref === 'string' ? body.draft_manifest_ref : '';
      if (!manifest || !sessionId || !draftManifestRef) {
        json(res, 400, { ok: false, error: 'invalid_preview_start_body' });
        return true;
      }
      try {
        const active = startPreviewSession(store, manifest, sessionId, draftManifestRef);
        sessions.set(sessionId, active);
        assertPreviewReceiptsNonAuthoritative(active.receipts);
        json(res, 200, {
          ok: true,
          preview_only: true,
          session: active.session,
          receipts: active.receipts,
        });
      } catch (err) {
        json(res, 400, { ok: false, error: String(err) });
      }
      return true;
    }

    if (path === '/v1/builder/preview/end' && method === 'POST') {
      const body = await readJson(req);
      const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
      const active = sessions.get(sessionId);
      if (!active) {
        json(res, 404, { ok: false, error: 'preview_session_not_found' });
        return true;
      }
      const receipts = endPreviewSession(active);
      assertPreviewReceiptsNonAuthoritative(receipts);
      json(res, 200, {
        ok: true,
        preview_only: true,
        session: active.session,
        receipts,
      });
      return true;
    }

    if (path === '/v1/builder/preview/namespace' && method === 'GET') {
      const namespace = url.searchParams.get('ns') ?? '';
      if (!namespace) {
        json(res, 400, { ok: false, error: 'missing_namespace' });
        return true;
      }
      try {
        const loaded = store.get(namespace);
        if (!loaded) {
          json(res, 404, { ok: false, error: 'namespace_not_loaded' });
          return true;
        }
        const overlay = buildPreviewOverlay(loaded.manifest);
        json(res, 200, {
          ok: true,
          preview_only: true,
          namespace,
          loaded_utc: loaded.loaded_utc,
          object_id: loaded.manifest.object_id,
          source_object: loaded.manifest.source_object,
          status: loaded.manifest.status,
          overlay: {
            rooms: overlay.rooms.length,
            objects: overlay.objects.length,
            npc_lines: overlay.npc_lines.length,
          },
          registry: overlay,
        });
      } catch (err) {
        json(res, 400, { ok: false, error: String(err) });
      }
      return true;
    }

    return false;
  };
}