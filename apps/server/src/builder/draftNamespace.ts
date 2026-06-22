// In-memory builder draft namespace store (PR-6 scaffold).
// Isolates preview drafts from live world registries — no chronicle writes.

import type { BuilderDraftManifest } from '../../../../packages/shared/builderDraft.js';
import {
  assertPreviewNamespace,
  validateDraftManifest,
} from '../../../../packages/shared/builderDraft.js';

export interface LoadedBuilderDraft {
  manifest: BuilderDraftManifest;
  loaded_utc: string;
}

export class BuilderDraftNamespaceStore {
  private readonly drafts = new Map<string, LoadedBuilderDraft>();

  load(manifest: BuilderDraftManifest): LoadedBuilderDraft {
    validateDraftManifest(manifest);
    assertPreviewNamespace(manifest.preview_namespace);
    const loaded: LoadedBuilderDraft = {
      manifest,
      loaded_utc: new Date().toISOString(),
    };
    this.drafts.set(manifest.preview_namespace, loaded);
    return loaded;
  }

  get(namespace: string): LoadedBuilderDraft | undefined {
    assertPreviewNamespace(namespace);
    return this.drafts.get(namespace);
  }

  has(namespace: string): boolean {
    assertPreviewNamespace(namespace);
    return this.drafts.has(namespace);
  }

  assertPreviewOnly(namespace: string): void {
    assertPreviewNamespace(namespace);
    if (!this.drafts.has(namespace)) {
      throw new Error(`unknown preview namespace: ${namespace}`);
    }
  }

  rejectLiveNamespace(namespace: string): void {
    if (!namespace.startsWith('preview:')) {
      throw new Error('live namespace mutation blocked for builder draft scaffold');
    }
  }
}