// HTTP router for builder draft preview sessions (PR-7).
// preview_only — no chronicle writes, no live registry mutation.
import { URL } from 'node:url';
import { buildPreviewOverlay } from './previewRegistry.js';
import { builderPreviewBindings, builderPreviewSessions, builderPreviewStore, } from './previewRuntime.js';
import { buildPreviewWorldFork } from './previewWorldFork.js';
import { assertPreviewReceiptsNonAuthoritative, endPreviewSession, startPreviewSession, } from './previewSession.js';
const MAX_BODY = 65536;
function json(res, status, body) {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}
function readJson(req) {
    return new Promise((resolve) => {
        const chunks = [];
        let size = 0;
        req.on('data', (c) => {
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
                resolve(parsed && typeof parsed === 'object' ? parsed : {});
            }
            catch {
                resolve({});
            }
        });
        req.on('error', () => resolve({}));
    });
}
function asManifest(body) {
    const manifest = body.manifest;
    if (!manifest || typeof manifest !== 'object')
        return null;
    return manifest;
}
export function makeBuilderPreviewRouter(deps = {}) {
    const store = deps.store ?? builderPreviewStore;
    const sessions = deps.sessions ?? builderPreviewSessions;
    const bindings = deps.bindings ?? builderPreviewBindings;
    const onPreviewBound = deps.onPreviewBound;
    const onPreviewUnbound = deps.onPreviewUnbound;
    return async function handleBuilderPreview(req, res) {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = url.pathname;
        const method = (req.method ?? 'GET').toUpperCase();
        if (path === '/v1/builder/preview/start' && method === 'POST') {
            const body = await readJson(req);
            const manifest = asManifest(body);
            const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
            const draftManifestRef = typeof body.draft_manifest_ref === 'string' ? body.draft_manifest_ref : '';
            const guestToken = typeof body.guest_token === 'string' ? body.guest_token : '';
            if (!manifest || !sessionId || !draftManifestRef) {
                json(res, 400, { ok: false, error: 'invalid_preview_start_body' });
                return true;
            }
            try {
                const active = startPreviewSession(store, manifest, sessionId, draftManifestRef);
                const fork = buildPreviewWorldFork(manifest);
                if (!fork.placement_validation.ok) {
                    json(res, 400, {
                        ok: false,
                        error: 'invalid_draft_placements',
                        placement_validation: fork.placement_validation,
                    });
                    return true;
                }
                sessions.set(sessionId, active);
                if (guestToken) {
                    bindings.bind(guestToken, sessionId, fork);
                    onPreviewBound?.(guestToken);
                }
                assertPreviewReceiptsNonAuthoritative(active.receipts);
                json(res, 200, {
                    ok: true,
                    preview_only: true,
                    session: active.session,
                    receipts: active.receipts,
                    builder_preview: fork,
                    guest_bound: Boolean(guestToken),
                });
            }
            catch (err) {
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
            const binding = bindings.getBindingBySession(sessionId);
            bindings.unbindBySession(sessionId);
            if (binding)
                onPreviewUnbound?.(binding.guest_token);
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
            }
            catch (err) {
                json(res, 400, { ok: false, error: String(err) });
            }
            return true;
        }
        if (path === '/v1/builder/preview/world-state' && method === 'GET') {
            const namespace = url.searchParams.get('ns') ?? '';
            const guestToken = url.searchParams.get('guest_token') ?? '';
            if (!namespace && !guestToken) {
                json(res, 400, { ok: false, error: 'missing_namespace_or_guest_token' });
                return true;
            }
            try {
                let fork = guestToken ? bindings.getByGuestToken(guestToken) : undefined;
                if (!fork && namespace) {
                    const loaded = store.get(namespace);
                    if (!loaded) {
                        json(res, 404, { ok: false, error: 'namespace_not_loaded' });
                        return true;
                    }
                    fork = buildPreviewWorldFork(loaded.manifest);
                }
                if (!fork) {
                    json(res, 404, { ok: false, error: 'preview_world_fork_not_found' });
                    return true;
                }
                if (namespace && fork.namespace !== namespace) {
                    json(res, 404, { ok: false, error: 'namespace_binding_mismatch' });
                    return true;
                }
                json(res, 200, {
                    ok: true,
                    preview_only: true,
                    builder_preview: fork,
                });
            }
            catch (err) {
                json(res, 400, { ok: false, error: String(err) });
            }
            return true;
        }
        return false;
    };
}
