// In-memory builder draft namespace store (PR-6 scaffold).
// Isolates preview drafts from live world registries — no chronicle writes.
import { assertPreviewNamespace, validateDraftManifest, } from '../../../../packages/shared/builderDraft.js';
export class BuilderDraftNamespaceStore {
    drafts = new Map();
    load(manifest) {
        validateDraftManifest(manifest);
        assertPreviewNamespace(manifest.preview_namespace);
        const loaded = {
            manifest,
            loaded_utc: new Date().toISOString(),
        };
        this.drafts.set(manifest.preview_namespace, loaded);
        return loaded;
    }
    get(namespace) {
        assertPreviewNamespace(namespace);
        return this.drafts.get(namespace);
    }
    has(namespace) {
        assertPreviewNamespace(namespace);
        return this.drafts.has(namespace);
    }
    assertPreviewOnly(namespace) {
        assertPreviewNamespace(namespace);
        if (!this.drafts.has(namespace)) {
            throw new Error(`unknown preview namespace: ${namespace}`);
        }
    }
    rejectLiveNamespace(namespace) {
        if (!namespace.startsWith('preview:')) {
            throw new Error('live namespace mutation blocked for builder draft scaffold');
        }
    }
}
