// Shared in-process builder preview runtime state (store, sessions, bindings).

import { BuilderDraftNamespaceStore } from './draftNamespace.js';
import { PreviewSessionBindingStore } from './previewSessionBinding.js';
import type { ActivePreviewSession } from './previewSession.js';

export const builderPreviewStore = new BuilderDraftNamespaceStore();
export const builderPreviewSessions = new Map<string, ActivePreviewSession>();
export const builderPreviewBindings = new PreviewSessionBindingStore();